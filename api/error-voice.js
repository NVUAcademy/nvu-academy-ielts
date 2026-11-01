/* Luyện phát âm cho lỗi âm (errors.html): học sinh đọc lại đáp án, Gemini nghe file và nhận xét.
   Luồng: trình duyệt đổi ghi âm thành WAV 16 kHz mono -> hàm này lưu file vào voice-notes,
   nhờ Gemini chấm, ghi lượt vào error_voice_attempts. Đáp án mẫu lấy từ error_logs, không lấy từ trình duyệt.
   Biến môi trường: GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY
   Tuỳ chọn: GEMINI_MODEL (mặc định gemini-2.5-flash), VOICE_DAILY_LIMIT (mặc định 30 lượt/ngày) */

/* Thử lần lượt các model nhận được âm thanh; model nào báo 404 thì chuyển sang model sau */
const GEMINI_MODELS = (process.env.GEMINI_MODEL || 'gemini-3.8-flash,gemini-2.5-pro,gemini-2.5-flash').split(',').map(s => s.trim()).filter(Boolean);
const DAILY_LIMIT = parseInt(process.env.VOICE_DAILY_LIMIT || '30', 10);
const MAX_B64 = 1200 * 1024; /* khoảng 18 giây WAV 16 kHz mono */
const MIN_B64 = 2000;

const SB_URL = () => (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_HEAD = () => {
  const k = process.env.SUPABASE_SERVICE_KEY || '';
  return k.startsWith('sb_') ? { apikey: k } : { apikey: k, Authorization: 'Bearer ' + k };
};
const sb = (path, opts) => fetch(SB_URL() + path, { ...opts, headers: { ...SB_HEAD(), ...(opts && opts.headers) } });
const bad = (res, code, msg) => res.status(code).json({ ok: false, error: msg });
const UUID = /^[0-9a-f-]{36}$/i;

const PROMPT = target => `Học sinh Việt Nam đang luyện phát âm tiếng Anh. Em ấy phải đọc to đúng cụm: "${target}".
Hãy nghe file ghi âm đính kèm và trả về MỘT đối tượng JSON, không thêm chữ nào khác, đúng dạng:
{"audio_ok": true hoặc false, "heard": "những gì nghe được bằng tiếng Anh", "correct": true hoặc false, "problems": ["tối đa 2 ý, tiếng Việt, nêu cụ thể âm nào hoặc từ nào đọc sai"], "feedback": "một hoặc hai câu nhận xét ngắn bằng tiếng Việt, ấm áp", "verdict": "ok" hoặc "retry"}
Quy tắc:
- audio_ok = false nếu không nghe rõ giọng đọc, có quá nhiều tiếng ồn, hoặc gần như im lặng. Khi đó feedback phải nhắc học sinh ghi lại ở nơi yên tĩnh, gần micro.
- correct = true chỉ khi đọc đúng tất cả các âm và từ trong cụm mẫu. Chấp nhận giọng vùng miền nhẹ, không yêu cầu hoàn hảo như người bản xứ.
- verdict = "ok" chỉ khi audio_ok và correct đều true; còn lại là "retry".
- Trong các chuỗi JSON không dùng dấu nháy kép bên trong nội dung; dùng nháy đơn.`;

/* Gemini đôi khi thừa hoặc thiếu dấu phẩy: thử sửa trước khi báo lỗi */
function parseJson(s) {
  const m = String(s).match(/\{[\s\S]*\}/);
  const text = m ? m[0] : String(s);
  try { return JSON.parse(text); } catch (e) {}
  const fixed = text.replace(/,\s*([}\]])/g, '$1');
  try { return JSON.parse(fixed); } catch (e) { throw new Error('Phản hồi AI bị lỗi định dạng, em thử ghi lại nhé'); }
}

async function gradeWithGemini(target, b64) {
  let r = null;
  for (const model of GEMINI_MODELS) {
    r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT(target) }, { inline_data: { mime_type: 'audio/wav', data: b64 } }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
      }),
      signal: AbortSignal.timeout(40000)
    });
    if (r.status !== 404) break;
    if (model !== GEMINI_MODELS[GEMINI_MODELS.length - 1]) await r.text();
  }
  if (!r.ok) throw new Error('Gemini: ' + r.status + ' ' + (await r.text()).slice(0, 200));
  const j = await r.json();
  const text = ((j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || []).map(p => p.text || '').join('');
  return parseJson(text);
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return bad(res, 405, 'POST only');
  for (const k of ['GEMINI_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY'])
    if (!process.env[k]) return bad(res, 500, 'Thiếu biến môi trường ' + k + ' trên Vercel');

  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const studentId = String(b.student_id || '');
    const errorId = String(b.error_id || '');
    if (!UUID.test(studentId)) return bad(res, 400, 'student_id không hợp lệ');
    if (!UUID.test(errorId)) return bad(res, 400, 'error_id không hợp lệ');

    const audio = String(b.audio || '');
    if (!/^[A-Za-z0-9+/=]+$/.test(audio)) return bad(res, 400, 'Âm thanh không hợp lệ');
    if (audio.length > MAX_B64) return bad(res, 413, 'Ghi âm quá dài (tối đa khoảng 15 giây)');
    if (audio.length < MIN_B64) return bad(res, 400, 'Ghi âm quá ngắn, em đọc lại nhé');

    const st = await (await sb('/rest/v1/students?id=eq.' + studentId + '&select=id')).json();
    if (!Array.isArray(st)) return bad(res, 500, 'Supabase từ chối khóa dịch vụ');
    if (!st.length) return bad(res, 403, 'Không tìm thấy học sinh');

    /* Lấy đáp án mẫu từ chính lỗi này và chỉ cho đúng học sinh sở hữu lỗi */
    const owned = await (await sb('/rest/v1/error_logs?select=id,correct_answer&id=eq.' + errorId + '&student_id=eq.' + studentId)).json();
    if (!Array.isArray(owned) || !owned.length) return bad(res, 403, 'Lỗi này không thuộc học sinh này');
    const target = String(owned[0].correct_answer || '').trim().slice(0, 200);
    if (!target) return bad(res, 400, 'Lỗi này chưa có đáp án mẫu để luyện');

    /* Giới hạn số lượt mỗi ngày (giờ Việt Nam) */
    const vn = new Date(Date.now() + 7 * 3600e3);
    const start = new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate()) - 7 * 3600e3).toISOString();
    const cnt = await sb('/rest/v1/error_voice_attempts?student_id=eq.' + studentId + '&created_at=gte.' + encodeURIComponent(start) + '&select=id', { headers: { Prefer: 'count=exact', Range: '0-0' } });
    const used = parseInt((cnt.headers.get('content-range') || '*/0').split('/')[1], 10) || 0;
    if (used >= DAILY_LIMIT) return bad(res, 429, `Em đã dùng hết ${DAILY_LIMIT} lượt ghi âm hôm nay. Mai em quay lại nhé.`);

    /* Lưu file WAV vào kho ghi âm, đường dẫn riêng theo học sinh và lỗi */
    const path = `errors/${studentId}/${errorId}/${Date.now()}.wav`;
    const up = await sb('/storage/v1/object/voice-notes/' + path.split('/').map(encodeURIComponent).join('/'), {
      method: 'POST', headers: { 'content-type': 'audio/wav', 'x-upsert': 'false' }, body: Buffer.from(audio, 'base64')
    });
    if (!up.ok) return bad(res, 500, 'Không lưu được file ghi âm: ' + (await up.text()).slice(0, 160));

    const result = await gradeWithGemini(target, audio);
    const audioOk = result.audio_ok === true;
    const verdict = audioOk && result.correct === true ? 'ok' : 'retry';
    const clean = {
      audio_ok: audioOk, correct: result.correct === true, heard: String(result.heard || '').slice(0, 200),
      problems: (Array.isArray(result.problems) ? result.problems : []).slice(0, 2).map(p => String(p).slice(0, 200)),
      feedback: String(result.feedback || (verdict === 'ok' ? 'Em đọc tốt lắm!' : 'Em ghi lại nhé.')).slice(0, 400)
    };

    const ins = await sb('/rest/v1/error_voice_attempts', {
      method: 'POST', headers: { 'content-type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ student_id: studentId, error_id: errorId, target, path, verdict, result: clean })
    });
    if (!ins.ok) return bad(res, 500, 'Không ghi được lượt luyện: ' + (await ins.text()).slice(0, 160));

    return res.status(200).json({ ok: true, verdict, ...clean, attempts_left: Math.max(0, DAILY_LIMIT - used - 1) });
  } catch (e) {
    return bad(res, 500, 'Lỗi máy chủ: ' + e.message);
  }
};
