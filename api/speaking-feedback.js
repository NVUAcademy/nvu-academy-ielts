/* NVU Academy: AI feedback cho Speaking (ghi âm của học sinh)
   Luồng: học sinh ghi âm -> file nằm trong Supabase Storage (bucket voice-notes) -> hàm này
   tải file, chuyển thành chữ bằng OpenAI (Whisper), nhờ Claude nhận xét, lưu kết quả vào speaking_submissions.
   Khóa API đặt trong biến môi trường của Vercel, KHÔNG nằm trong trang web.

   Biến môi trường cần có:
     ANTHROPIC_API_KEY, OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY
   Tuỳ chọn: CLAUDE_MODEL (mặc định claude-sonnet-5-5), WHISPER_MODEL (mặc định whisper-1), DAILY_LIMIT (mặc định 8) */

const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-5-5';
const WHISPER_MODEL = process.env.WHISPER_MODEL || 'whisper-1';
const DAILY_LIMIT = parseInt(process.env.DAILY_LIMIT || '8', 10);
const MAX_AUDIO_BYTES = 12 * 1024 * 1024;

const SB_URL = () => (process.env.SUPABASE_URL || '').replace(/\/$/, '');
/* Khóa kiểu mới (sb_secret_...) không phải JWT nên chỉ gửi header apikey; khóa service_role cũ (JWT) vẫn cần Bearer */
const SB_HEAD = () => {
  const k = process.env.SUPABASE_SERVICE_KEY || '';
  return k.startsWith('sb_') ? { apikey: k } : { apikey: k, Authorization: 'Bearer ' + k };
};

/* ---------- Tiện ích so khớp giọng nói với văn bản mẫu ---------- */
function normWord(w) { return String(w || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]/g, ''); }
function words(s) { return String(s || '').split(/\s+/).map(normWord).filter(Boolean); }

/* Căn hàng hai chuỗi từ (Levenshtein theo từ) và trả về các từ thiếu, thừa, hoặc đọc khác */
function alignWords(target, spoken) {
  const a = words(target), b = words(spoken);
  const n = a.length, m = b.length, d = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 0; i <= n; i++) d[i][0] = i;
  for (let j = 0; j <= m; j++) d[0][j] = j;
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  const out = []; let i = n, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)) {
      if (a[i - 1] !== b[j - 1]) out.push({ type: 'diff', expected: a[i - 1], heard: b[j - 1] });
      i--; j--;
    } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) { out.push({ type: 'missing', expected: a[i - 1] }); i--; }
    else { out.push({ type: 'extra', heard: b[j - 1] }); j--; }
  }
  const correct = n - out.filter(x => x.type !== 'extra').length;
  return { diffs: out.reverse(), expectedCount: n, accuracy: n ? Math.max(0, Math.round(correct / n * 100)) : null };
}

function fluencyStats(whisper) {
  const w = (whisper.words || []);
  const dur = whisper.duration || (w.length ? w[w.length - 1].end : 0);
  let longPauses = 0, maxPause = 0;
  for (let i = 1; i < w.length; i++) { const gap = w[i].start - w[i - 1].end; if (gap > 0.6) longPauses++; if (gap > maxPause) maxPause = gap; }
  const spoken = w.length || words(whisper.text).length;
  const wpm = dur > 0 ? Math.round(spoken / (dur / 60)) : null;
  const logp = (whisper.segments || []).map(s => s.avg_logprob).filter(x => typeof x === 'number');
  const conf = logp.length ? +(logp.reduce((x, y) => x + y, 0) / logp.length).toFixed(2) : null;
  return { duration_sec: Math.round(dur * 10) / 10, words_spoken: spoken, words_per_min: wpm, long_pauses: longPauses, max_pause_sec: +maxPause.toFixed(1), avg_logprob: conf };
}

/* ---------- Gọi dịch vụ ngoài ---------- */
async function transcribe(buf, filename, mime) {
  const fd = new FormData();
  fd.append('file', new Blob([buf], { type: mime || 'audio/webm' }), filename);
  fd.append('model', WHISPER_MODEL);
  fd.append('language', 'en');
  fd.append('response_format', 'verbose_json');
  fd.append('timestamp_granularities[]', 'word');
  fd.append('timestamp_granularities[]', 'segment');
  fd.append('temperature', '0');   /* Không đưa văn bản mẫu vào prompt để Whisper không tự sửa lỗi phát âm giúp học sinh */
  const r = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: 'Bearer ' + process.env.OPENAI_API_KEY }, body: fd, signal: AbortSignal.timeout(25000) }).catch(e => { throw new Error('Whisper: ' + (e.name === 'TimeoutError' ? 'quá thời gian chờ (25 giây)' : e.message)); });
  if (!r.ok) throw new Error('Whisper: ' + r.status + ' ' + (await r.text()).slice(0, 300));
  return r.json();
}

/* ---------- Azure Pronunciation Assessment (tuỳ chọn, bật khi có AZURE_SPEECH_KEY và AZURE_SPEECH_REGION) ---------- */
const AZURE_MAX_SEC = 30;   /* REST chỉ chấm được đoạn ngắn: lấy tối đa 30 giây đầu */

function wavTrim(buf, maxSec) {
  if (buf.length < 44 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') return null;
  let p = 12, dataStart = -1, dataLen = 0;
  while (p + 8 <= buf.length) {
    const id = buf.toString('ascii', p, p + 4), size = buf.readUInt32LE(p + 4);
    if (id === 'data') { dataStart = p + 8; dataLen = Math.min(size, buf.length - dataStart); break; }
    p += 8 + size + (size % 2);
  }
  if (dataStart < 0) return null;
  const rate = buf.readUInt32LE(24), ch = buf.readUInt16LE(22), bits = buf.readUInt16LE(34);
  if (rate !== 16000 || ch !== 1 || bits !== 16) return null;
  const take = Math.min(dataLen, rate * 2 * maxSec);
  const head = Buffer.alloc(44); buf.copy(head, 0, 0, 44);
  head.writeUInt32LE(36 + take, 4); head.writeUInt32LE(take, 40);
  return Buffer.concat([head, buf.subarray(dataStart, dataStart + take)]);
}

async function azureAssess(wavBuf, referenceText) {
  const region = process.env.AZURE_SPEECH_REGION, key = process.env.AZURE_SPEECH_KEY;
  const clip = wavTrim(wavBuf, AZURE_MAX_SEC);
  if (!clip) throw new Error('file không phải WAV 16 kHz');
  const cfg = { GradingSystem: 'HundredMark', Granularity: 'Phoneme', Dimension: 'Comprehensive', EnableMiscue: !!referenceText, EnableProsodyAssessment: true, PhonemeAlphabet: 'IPA' };
  if (referenceText) cfg.ReferenceText = referenceText;
  const url = `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US&format=detailed`;
  const r = await fetch(url, { method: 'POST', headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000', Accept: 'application/json', 'Pronunciation-Assessment': Buffer.from(JSON.stringify(cfg)).toString('base64') }, body: clip, signal: AbortSignal.timeout(28000) }).catch(e => { throw new Error('Azure: ' + (e.name === 'TimeoutError' ? 'quá thời gian chờ (28 giây). Region đang dùng: "' + region + '", kiểm tra lại AZURE_SPEECH_REGION và mạng của dịch vụ Speech' : (e.cause && e.cause.code ? e.cause.code + ' ' : '') + e.message)); });
  if (!r.ok) throw new Error('Azure: ' + r.status + ' ' + (await r.text()).slice(0, 200));
  const j = await r.json();
  if (j.RecognitionStatus && j.RecognitionStatus !== 'Success') throw new Error('Azure không nhận ra giọng nói (' + j.RecognitionStatus + ')');
  const n = (j.NBest || [])[0]; if (!n) throw new Error('Azure không trả về kết quả');
  const pa = o => (o && o.PronunciationAssessment) || o || {};
  const top = pa(n);
  const wordsOut = (n.Words || []).map(w => ({ w: w.Word, acc: Math.round(pa(w).AccuracyScore), err: pa(w).ErrorType || 'None', ph: (w.Phonemes || []).map(x => ({ p: x.Phoneme, acc: Math.round(pa(x).AccuracyScore) })) }));
  const agg = {};
  wordsOut.forEach(w => w.ph.forEach(x => { const a = agg[x.p] || (agg[x.p] = { sum: 0, n: 0 }); a.sum += x.acc; a.n++; }));
  const weakPhonemes = Object.entries(agg).map(([p, a]) => ({ phoneme: p, avg: Math.round(a.sum / a.n), count: a.n })).filter(x => x.avg < 70).sort((a, b) => a.avg - b.avg).slice(0, 5);
  const weakWords = wordsOut.filter(w => w.acc < 70 || (w.err && w.err !== 'None')).sort((a, b) => a.acc - b.acc).slice(0, 8)
    .map(w => ({ word: w.w, score: w.acc, error: w.err, weak_phonemes: w.ph.filter(x => x.acc < 60).map(x => x.p + ':' + x.acc) }));
  return {
    pronunciation: Math.round(top.PronScore || 0), accuracy: Math.round(top.AccuracyScore || 0), fluency: Math.round(top.FluencyScore || 0),
    completeness: top.CompletenessScore != null ? Math.round(top.CompletenessScore) : null, prosody: top.ProsodyScore != null ? Math.round(top.ProsodyScore) : null,
    assessed_seconds: Math.round(Math.min(wavBuf.length / 32000, AZURE_MAX_SEC)), weak_words: weakWords, weak_phonemes: weakPhonemes
  };
}

async function askClaude(system, user) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 1800, system, messages: [{ role: 'user', content: user }] }), signal: AbortSignal.timeout(30000)
  }).catch(e => { throw new Error('Claude: ' + (e.name === 'TimeoutError' ? 'quá thời gian chờ (30 giây)' : e.message)); });
  if (!r.ok) throw new Error('Claude: ' + r.status + ' ' + (await r.text()).slice(0, 300));
  const j = await r.json();
  const text = (j.content || []).map(c => c.text || '').join('');
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('Claude không trả về JSON');
  return JSON.parse(m[0]);
}

async function sb(path, opts) {
  const r = await fetch(SB_URL() + path, { ...opts, headers: { ...SB_HEAD(), ...(opts && opts.headers) } });
  return r;
}

const SYSTEM = `Bạn là giám khảo và huấn luyện viên IELTS Speaking cho học sinh Việt Nam (trình độ A2 đến B2) của thầy Nam. Trả lời bằng tiếng Việt, ngắn gọn, ấm áp, cụ thể; ví dụ và từ cần luyện giữ bằng tiếng Anh.
Quy tắc:
- Bạn nhận được bản chép lời (transcript) từ nhận dạng giọng nói và KHÔNG nghe được âm thanh. Nếu có "Điểm phát âm Azure" thì đó là dữ liệu đáng tin nhất cho phần phát âm: dựa vào điểm từng từ và từng âm (IPA) để chỉ ra từ và âm cần sửa, và dùng nó để định điểm pronunciation. Nếu KHÔNG có dữ liệu Azure, phần phát âm chỉ là ƯỚC LƯỢNG dựa trên từ bị nhận sai so với văn bản mẫu và các lỗi thường gặp của người Việt (âm cuối /s/ /z/ /t/ /d/, /b/ và /p/, /s/ và /ʃ/, trọng âm, ngắt cụm); khi đó không khẳng định chắc chắn, dùng "có thể".
- Không bịa lỗi. Chỉ nêu từ có trong dữ liệu. Tối đa 2 điểm cần sửa, 1 điểm khen, 1 việc luyện tiếp.
- Điểm band là ước lượng tham khảo (thang 0 đến 9, bước 0.5), ghi rõ chưa phải điểm chính thức.
- Chỉ trả về một đối tượng JSON, không thêm chữ nào bên ngoài.`;

function buildPrompt(p) {
  return `Loại bài: ${p.task_type === 'read_aloud' ? 'Đọc theo văn bản mẫu (shadowing / read aloud)' : p.task_type === 'mixed' ? 'Đọc theo văn bản mẫu ở phần đầu, sau đó nói thêm tự do (phần mẫu chỉ so với phần đầu bản chép lời)' : 'Nói tự do theo đề'}
Đề hoặc ngữ cảnh: ${p.prompt || '(không có)'}
Văn bản mẫu: ${p.target_text || '(không có)'}
Lần thứ: ${p.attempt}
${p.previous ? `Lần trước: độ khớp ${p.previous.accuracy}%, điểm phát âm Azure ${p.previous.azure_pronunciation ?? 'không có'}, các từ cần sửa là ${JSON.stringify(p.previous.focus_words)}.` : ''}

Transcript của học sinh: """${p.transcript}"""
Thống kê lưu loát: ${JSON.stringify(p.fluency)}
Độ khớp với văn bản mẫu: ${p.align && p.align.accuracy !== null ? p.align.accuracy + '%' : 'không áp dụng'}
Điểm phát âm Azure (thang 100, đo trên ${p.azure ? p.azure.assessed_seconds + ' giây đầu' : ''}): ${p.azure ? JSON.stringify(p.azure) : 'không có'}
Khác biệt so với mẫu: ${JSON.stringify((p.align && p.align.diffs || []).filter(x => p.task_type !== 'mixed' || x.type !== 'extra').slice(0, 25))}

Trả về JSON đúng dạng:
{
 "summary": "2 câu tổng quan",
 "praise": "1 điểm khen cụ thể",
 "fix": [{"point":"điểm cần sửa","example":"ví dụ từ bài của em","how":"cách sửa ngắn"}],
 "focus_words": ["tối đa 6 từ tiếng Anh nên đọc lại, lấy từ dữ liệu"],
 "focus_sounds": ["tối đa 3 âm cần luyện, ví dụ /b/ và /p/"],
 "next_step": "1 việc luyện tiếp",
 "band": {"fluency": 0, "lexical": 0, "grammar": 0, "pronunciation_estimate": 0, "overall": 0},
 "improved": ${p.previous ? '"nhận xét ngắn so với lần trước"' : 'null'},
 "retry_text": "một câu ngắn (tối đa 25 từ) học sinh nên đọc lại để luyện đúng các âm trên, chứa các từ focus_words"
}`;
}

/* ---------- Xử lý yêu cầu ---------- */
function bad(res, code, msg) { res.status(code).json({ ok: false, error: msg }); }

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return bad(res, 405, 'POST only');
  for (const k of ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY'])
    if (!process.env[k]) return bad(res, 500, 'Thiếu biến môi trường ' + k + ' trên Vercel');

  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const action = b.action || 'feedback';
  const studentId = String(b.student_id || '');
  if (!/^[0-9a-f-]{36}$/i.test(studentId)) return bad(res, 400, 'student_id không hợp lệ');

  /* Học sinh phải tồn tại */
  const st = await (await sb('/rest/v1/students?id=eq.' + studentId + '&select=id,full_name,class_code')).json();
  if (!Array.isArray(st)) return bad(res, 500, 'Supabase từ chối khóa dịch vụ: ' + String((st && (st.message || st.hint)) || '').slice(0, 160));
  if (!st.length) return bad(res, 403, 'Không tìm thấy học sinh');
  /* Chỉ các lớp được mở AI (mặc định IELTS 13 và IELTS 14; đổi bằng biến AI_CLASSES) */
  const AI_CLASSES = (process.env.AI_CLASSES || 'IELTS13,IELTS14').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  if (action !== 'history' && !AI_CLASSES.includes(String(st[0].class_code).toUpperCase())) return bad(res, 403, 'Lớp của em chưa mở tính năng AI chấm nói. Thầy sẽ nghe và nhận xét trực tiếp.');

  if (action === 'history') {
    const rows = await (await sb('/rest/v1/speaking_submissions?student_id=eq.' + studentId + '&order=submitted_at.desc&limit=30&select=id,question,transcript,overall_band,feedback_json,submitted_at,attempt,teacher_comment,approved')).json();
    return res.status(200).json({ ok: true, items: rows });
  }

  /* Chẩn đoán tạm thời: kiểm tra Azure có phản hồi không (không lưu gì, không lộ khóa) */
  if (action === 'azure_probe') {
    const pp = String(b.voice_path || '');
    if (!pp.startsWith('daily/' + studentId + '/') || !process.env.AZURE_SPEECH_KEY) return bad(res, 400, 'thiếu điều kiện');
    const fr0 = await sb('/storage/v1/object/voice-notes/' + pp.split('/').map(encodeURIComponent).join('/'));
    const clip = wavTrim(Buffer.from(await fr0.arrayBuffer()), 10);
    const region = process.env.AZURE_SPEECH_REGION, out = { region: JSON.stringify(region), keyLen: (process.env.AZURE_SPEECH_KEY || '').length };
    const tryIt = async (name, url, headers) => {
      const t0 = Date.now();
      try {
        const r = await fetch(url, { method: 'POST', headers: { 'Ocp-Apim-Subscription-Key': process.env.AZURE_SPEECH_KEY, 'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000', Accept: 'application/json', ...headers }, body: clip, signal: AbortSignal.timeout(12000) });
        out[name] = { status: r.status, ms: Date.now() - t0, body: (await r.text()).slice(0, 220) };
      } catch (e) { out[name] = { error: e.name + ' ' + (e.cause && e.cause.code ? e.cause.code : e.message), ms: Date.now() - t0 }; }
    };
    const base = `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US`;
    await tryIt('plain', base, {});
    await tryIt('pa_basic', base + '&format=detailed', { 'Pronunciation-Assessment': Buffer.from(JSON.stringify({ ReferenceText: 'The bread is baked and packed in boxes.', GradingSystem: 'HundredMark', Granularity: 'Phoneme', Dimension: 'Comprehensive' })).toString('base64') });
    return res.status(200).json({ ok: true, probe: out });
  }

  /* action = feedback */
  const path = String(b.voice_path || '');
  if (!path.startsWith('daily/' + studentId + '/') && !path.startsWith('speaking/' + studentId + '/')) return bad(res, 403, 'Đường dẫn file không thuộc học sinh này');

  /* Giới hạn mỗi ngày để tránh tốn phí */
  const since = new Date(); since.setHours(0, 0, 0, 0);
  const cnt = await sb('/rest/v1/speaking_submissions?student_id=eq.' + studentId + '&submitted_at=gte.' + encodeURIComponent(since.toISOString()) + '&select=id', { headers: { Prefer: 'count=exact', Range: '0-0' } });
  const used = parseInt((cnt.headers.get('content-range') || '*/0').split('/')[1], 10) || 0;
  if (used >= DAILY_LIMIT) return bad(res, 429, `Em đã dùng hết ${DAILY_LIMIT} lượt AI hôm nay. Mai em quay lại nhé.`);

  try {
    /* 1. Tải audio từ kho riêng */
    const fr = await sb('/storage/v1/object/voice-notes/' + path.split('/').map(encodeURIComponent).join('/'));
    if (!fr.ok) return bad(res, 404, 'Không tải được file ghi âm');
    const buf = Buffer.from(await fr.arrayBuffer());
    if (buf.length > MAX_AUDIO_BYTES) return bad(res, 413, 'File ghi âm quá dài, hãy ghi dưới 2 phút');
    const ext = (path.split('.').pop() || 'webm').toLowerCase();

    /* 2. Chuyển thành chữ */
    const w = await transcribe(buf, 'voice.' + ext, fr.headers.get('content-type'));
    const transcript = (w.text || '').trim();
    if (words(transcript).length < 3) return bad(res, 422, 'Không nghe rõ giọng nói. Em ghi âm lại ở nơi yên tĩnh hơn nhé.');

    /* 3. So khớp và thống kê */
    const task_type = ['read_aloud', 'mixed'].includes(b.task_type) ? b.task_type : 'free';
    /* 'mixed' = đọc theo mẫu rồi nói thêm: chỉ so phần đầu của bản chép lời với văn bản mẫu */
    const spokenForAlign = task_type === 'mixed' ? words(transcript).slice(0, Math.ceil(words(b.target_text).length * 1.3) + 3).join(' ') : transcript;
    const align = task_type !== 'free' && b.target_text ? alignWords(b.target_text, spokenForAlign) : null;
    const fluency = fluencyStats(w);
    let previous = null;
    if (b.parent_id) {
      const pr = await (await sb('/rest/v1/speaking_submissions?id=eq.' + encodeURIComponent(b.parent_id) + '&student_id=eq.' + studentId + '&select=feedback_json')).json();
      if (pr[0] && pr[0].feedback_json) previous = { accuracy: pr[0].feedback_json.accuracy, focus_words: pr[0].feedback_json.focus_words || [], azure_pronunciation: pr[0].feedback_json.azure ? pr[0].feedback_json.azure.pronunciation : null };
    }
    const attempt = previous ? (parseInt(b.attempt, 10) || 2) : 1;

    /* 3b. Azure chấm phát âm từng từ và từng âm (nếu đã cấu hình và file là WAV) */
    let azure = null, azureError = null;
    if (process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION) {
      try {
        const ref = task_type !== 'free' && b.target_text ? b.target_text : words(transcript).slice(0, 80).join(' ');
        azure = await azureAssess(buf, ref);
      } catch (e) { azureError = String(e.message || e).slice(0, 200); }
    }

    /* 4. Claude nhận xét */
    const fb = await askClaude(SYSTEM, buildPrompt({ task_type, prompt: b.prompt, target_text: b.target_text, attempt, previous, transcript, fluency, align, azure }));
    fb.accuracy = align ? align.accuracy : null;
    fb.azure = azure; if (azureError) fb.azure_error = azureError;
    if (azure && !(fb.focus_words || []).length) fb.focus_words = azure.weak_words.map(x => x.word).slice(0, 6);
    fb.fluency = fluency;
    fb.diffs = align ? align.diffs.filter(x => task_type !== 'mixed' || x.type !== 'extra').slice(0, 25) : [];

    /* 5. Lưu */
    const row = {
      student_id: studentId, question: String(b.prompt || b.target_text || '').slice(0, 500) || 'Free speaking', transcript,
      audio_url: path, fluency_score: fb.band && fb.band.fluency, vocabulary_score: fb.band && fb.band.lexical,
      grammar_score: fb.band && fb.band.grammar, pronunciation_score: fb.band && fb.band.pronunciation_estimate, overall_band: fb.band && fb.band.overall,
      feedback_json: fb, task_type, target_text: b.target_text || null, attempt, parent_id: b.parent_id || null
    };
    const ins = await sb('/rest/v1/speaking_submissions', { method: 'POST', headers: { 'content-type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(row) });
    const saved = ins.ok ? (await ins.json())[0] : null;
    return res.status(200).json({ ok: true, id: saved && saved.id, transcript, feedback: fb, attempt, saved: !!saved });
  } catch (e) {
    return bad(res, 502, String(e.message || e).slice(0, 400));
  }
};

module.exports._test = { alignWords, fluencyStats, words, wavTrim };
