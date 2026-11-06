/* Luyện phát âm cho lỗi âm (errors.html): học sinh đọc lại đáp án, Azure Pronunciation Assessment chấm.
   Luồng: trình duyệt đổi ghi âm thành WAV 16 kHz mono -> hàm này lưu file vào voice-notes,
   chấm phát âm từng từ và âm vị bằng Azure so với đáp án đúng, rồi ghi lượt vào error_voice_attempts.
   Đáp án mẫu lấy từ error_logs, không lấy từ trình duyệt.
   Biến môi trường: AZURE_SPEECH_KEY, AZURE_SPEECH_REGION, SUPABASE_URL, SUPABASE_SERVICE_KEY
   Tuỳ chọn: VOICE_DAILY_LIMIT (mặc định 30 lượt/ngày) */

const DAILY_LIMIT = parseInt(process.env.VOICE_DAILY_LIMIT || '80', 10);
const MAX_B64 = 1200 * 1024; /* khoảng 18 giây WAV 16 kHz mono */
const MIN_B64 = 2000;
const PASS = 60; /* điểm từng từ tối thiểu để tính là đọc đúng */

const SB_URL = () => (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_HEAD = () => {
  const k = process.env.SUPABASE_SERVICE_KEY || '';
  return k.startsWith('sb_') ? { apikey: k } : { apikey: k, Authorization: 'Bearer ' + k };
};
const sb = (path, opts) => fetch(SB_URL() + path, { ...opts, headers: { ...SB_HEAD(), ...(opts && opts.headers) } });
const bad = (res, code, msg) => res.status(code).json({ ok: false, error: msg });
const UUID = /^[0-9a-f-]{36}$/i;

/* Chấm phát âm bằng Azure REST: trả về điểm tổng và điểm từng từ */
async function azureAssess(wavBuf, referenceText) {
  const region = process.env.AZURE_SPEECH_REGION, key = process.env.AZURE_SPEECH_KEY;
  const cfg = { ReferenceText: referenceText, GradingSystem: 'HundredMark', Granularity: 'Phoneme', Dimension: 'Comprehensive', EnableMiscue: true, PhonemeAlphabet: 'IPA' };
  const url = `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US&format=detailed`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000', Accept: 'application/json', 'Pronunciation-Assessment': Buffer.from(JSON.stringify(cfg)).toString('base64') },
    body: wavBuf, signal: AbortSignal.timeout(28000)
  });
  if (!r.ok) throw new Error('Azure: ' + r.status + ' ' + (await r.text()).slice(0, 200));
  const j = await r.json();
  if (j.RecognitionStatus && j.RecognitionStatus !== 'Success') return { heard: '', words: [], pron: 0, status: j.RecognitionStatus };
  const n = (j.NBest || [])[0] || {};
  /* Azure có thể trả điểm trong mục con PronunciationAssessment, hoặc trực tiếp trên từ/âm (AccuracyScore, PronScore). Đọc được cả hai. */
  const pa = o => (o && (o.PronunciationAssessment || o)) || {};
  const words = (n.Words || []).map(w => ({
    word: w.Word, score: Math.round(pa(w).AccuracyScore || 0), error: pa(w).ErrorType || 'None',
    weak: (w.Phonemes || []).filter(p => (pa(p).AccuracyScore || 0) < 60).map(p => p.Phoneme)
  }));
  /* Điểm tổng: lấy PronScore nếu có; nếu Azure không trả về thì lấy trung bình điểm chính xác của các từ */
  const wordAvg = words.length ? Math.round(words.reduce((s, w) => s + w.score, 0) / words.length) : 0;
  const pron = Math.round(pa(n).PronScore || 0) || wordAvg;
  return { heard: words.map(w => w.word).join(' '), words, pron, pron_raw: Math.round(pa(n).PronScore || 0), status: 'Success' };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return bad(res, 405, 'POST only');
  for (const k of ['AZURE_SPEECH_KEY', 'AZURE_SPEECH_REGION', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY'])
    if (!process.env[k]) return bad(res, 500, 'Thiếu biến môi trường ' + k + ' trên Vercel');

  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const studentId = String(b.student_id || '');
    const errorId = String(b.error_id || '');
    if (!UUID.test(studentId)) return bad(res, 400, 'student_id không hợp lệ');
    const vocabMode = !errorId && typeof b.target === 'string' && b.target.trim().length > 0;
    if (!vocabMode && !UUID.test(errorId)) return bad(res, 400, 'error_id không hợp lệ');

    const audio = String(b.audio || '');
    if (!/^[A-Za-z0-9+/=]+$/.test(audio)) return bad(res, 400, 'Âm thanh không hợp lệ');
    if (audio.length > MAX_B64) return bad(res, 413, 'Ghi âm quá dài (tối đa khoảng 15 giây)');
    if (audio.length < MIN_B64) return bad(res, 400, 'Ghi âm quá ngắn, em đọc lại nhé');

    const st = await (await sb('/rest/v1/students?id=eq.' + studentId + '&select=id')).json();
    if (!Array.isArray(st)) return bad(res, 500, 'Supabase từ chối khóa dịch vụ');
    if (!st.length) return bad(res, 403, 'Không tìm thấy học sinh');

    /* Lấy đáp án mẫu từ chính lỗi này và chỉ cho đúng học sinh sở hữu lỗi */
    let target;
    if (vocabMode) {
      target = String(b.target).trim().slice(0, 60);
    } else {
      const owned = await (await sb('/rest/v1/error_logs?select=id,correct_answer&id=eq.' + errorId + '&student_id=eq.' + studentId)).json();
      if (!Array.isArray(owned) || !owned.length) return bad(res, 403, 'Lỗi này không thuộc học sinh này');
      target = String(owned[0].correct_answer || '').trim().slice(0, 200);
      if (!target) return bad(res, 400, 'Lỗi này chưa có đáp án mẫu để luyện');
    }

    /* Giới hạn số lượt mỗi ngày (giờ Việt Nam) */
    const vn = new Date(Date.now() + 7 * 3600e3);
    const start = new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate()) - 7 * 3600e3).toISOString();
    const cnt = await sb('/rest/v1/error_voice_attempts?student_id=eq.' + studentId + '&created_at=gte.' + encodeURIComponent(start) + '&select=id', { headers: { Prefer: 'count=exact', Range: '0-0' } });
    const used = parseInt((cnt.headers.get('content-range') || '*/0').split('/')[1], 10) || 0;
    if (used >= DAILY_LIMIT) return bad(res, 429, `Em đã dùng hết ${DAILY_LIMIT} lượt ghi âm hôm nay. Mai em quay lại nhé.`);

    /* Lưu file WAV vào kho ghi âm, đường dẫn riêng theo học sinh và lỗi */
    const wav = Buffer.from(audio, 'base64');
    const path = 'errors/' + studentId + '/' + errorId + '/' + Date.now() + '.wav';
    const up = await sb('/storage/v1/object/voice-notes/' + path.split('/').map(encodeURIComponent).join('/'), {
      method: 'POST', headers: { 'content-type': 'audio/wav', 'x-upsert': 'false' }, body: wav
    });
    if (!up.ok) return bad(res, 500, 'Không lưu được file ghi âm: ' + (await up.text()).slice(0, 160));

    const a = await azureAssess(wav, target);
    const weak = a.words.filter(w => w.score < PASS || (w.error && w.error !== 'None'));
    const audioOk = a.status === 'Success' && a.words.length > 0;
    /* Câu từ 3 từ trở lên được phép 1 từ chưa tốt; câu ngắn phải đọc đúng hết */
    const allowedWeak = a.words.length >= 3 ? 1 : 0;
    /* Từ mới (vocabMode): đạt khi điểm phát âm từ 60; lỗi sai thì dùng quy tắc cũ */
    const correct = vocabMode ? (audioOk && (a.pron || 0) >= 60) : (audioOk && weak.length <= allowedWeak);
    const verdict = correct ? 'ok' : 'retry';
    const problems = [];
    if (!audioOk) problems.push('Không nghe rõ giọng đọc. Em ghi lại ở nơi yên tĩnh và đưa micro gần miệng hơn.');
    weak.slice(0, 2).forEach(w => {
      const ph = w.weak.length ? ' (âm chưa rõ: ' + w.weak.join(', ') + ')' : '';
      problems.push(w.error === 'Omission' ? 'Em bỏ sót từ "' + w.word + '".' : 'Từ "' + w.word + '" còn chưa rõ' + ph + '.');
    });
    const clean = {
      audio_ok: audioOk, correct, heard: a.heard.slice(0, 200), score: a.pron,
      /* Chẩn đoán: điểm từng từ và điểm tổng Azure trả về (để kiểm tra khi điểm bất thường) */
      word_scores: (a.words || []).slice(0, 12).map(w => [w.word, w.score]), pron_raw: a.pron_raw,
      problems,
      feedback: verdict === 'ok' ? 'Em đọc đúng rồi, phát âm tốt!' : 'Em ghi lại nhé, đọc chậm và rõ từng âm.'
    };

    const ins = await sb('/rest/v1/error_voice_attempts', {
      method: 'POST', headers: { 'content-type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ student_id: studentId, error_id: vocabMode ? null : errorId, target, path, verdict, result: clean })
    });
    if (!ins.ok) return bad(res, 500, 'Không ghi được lượt luyện: ' + (await ins.text()).slice(0, 160));

    return res.status(200).json({ ok: true, verdict, ...clean, attempts_left: Math.max(0, DAILY_LIMIT - used - 1) });
  } catch (e) {
    return bad(res, 500, 'Lỗi máy chủ: ' + e.message);
  }
};
