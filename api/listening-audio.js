/* Tạo audio Listening bằng ElevenLabs. Chỉ học sinh đã đăng nhập (student_id hợp lệ) mới gọi được.
   Biến môi trường: ELEVENLABS_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY */

const VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; /* giọng mặc định của ElevenLabs, dùng được với gói miễn phí */
const MODEL_ID = 'eleven_multilingual_v2';
const MAX_CHARS = 600;

const SB_URL = () => (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_HEAD = () => {
  const k = process.env.SUPABASE_SERVICE_KEY || '';
  return k.startsWith('sb_') ? { apikey: k } : { apikey: k, Authorization: 'Bearer ' + k };
};
const bad = (res, code, msg) => res.status(code).json({ ok: false, error: msg });

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return bad(res, 405, 'Chỉ dùng POST');
  if (!process.env.ELEVENLABS_API_KEY) return bad(res, 500, 'Thiếu biến môi trường ELEVENLABS_API_KEY trên Vercel');

  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const studentId = String(b.student_id || '');
    if (!/^[0-9a-f-]{36}$/i.test(studentId)) return bad(res, 400, 'student_id không hợp lệ');
    const st = await (await fetch(SB_URL() + '/rest/v1/students?id=eq.' + studentId + '&select=id', { headers: SB_HEAD() })).json();
    if (!Array.isArray(st) || !st.length) return bad(res, 403, 'Không tìm thấy học sinh');

    const text = String(b.text || '').trim();
    if (!text) return bad(res, 400, 'Thiếu text');
    if (text.length > MAX_CHARS) return bad(res, 400, 'Đoạn text quá dài (tối đa ' + MAX_CHARS + ' ký tự)');

    const r = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + VOICE_ID, {
      method: 'POST',
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: MODEL_ID })
    });
    if (!r.ok) return bad(res, 502, 'ElevenLabs lỗi ' + r.status + ': ' + (await r.text()).slice(0, 200));

    const audio = Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    return res.status(200).send(audio);
  } catch (e) {
    return bad(res, 500, 'Lỗi máy chủ: ' + e.message);
  }
};
