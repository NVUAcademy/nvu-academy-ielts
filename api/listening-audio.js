/* Tạo audio Listening bằng ElevenLabs, có 2 giọng cho hội thoại, lưu sẵn vào Supabase Storage để không tạo lại.
   Chỉ học sinh đã đăng nhập (student_id hợp lệ) mới gọi được. Tốc độ đọc theo lớp của học sinh.
   Gửi: { student_id, lines: [{ speaker: 'A' | 'B', text }] }  (hoặc { student_id, text } cho một giọng)
   Trả: { ok, url } là link nghe có hạn 1 giờ.
   Biến môi trường: ELEVENLABS_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY */

const crypto = require('crypto');

const VOICES = { A: 'Xb7hH8MSUJpSbSDYk0k2', B: 'BNgbHR0DNeZixGQVzloa' }; /* A: Alice (nữ, Anh), B: David - British Storyteller (nam, Anh) */
const MODEL_ID = 'eleven_multilingual_v2';
const MAX_LINE = 600, MAX_TOTAL = 2500, MAX_LINES = 30;
/* Tốc độ đọc theo lớp (0.7 đến 1.2). Lớp không có trong bảng dùng 0.85 */
const SPEED_BY_CLASS = { FOUNDATION11: 0.75, IELTS13: 0.85, IELTS14: 0.9 };
const DEFAULT_SPEED = 0.85;
const BUCKET = 'voice-notes';
const CONCURRENCY = 3;

const SB_URL = () => (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_HEAD = () => {
  const k = process.env.SUPABASE_SERVICE_KEY || '';
  return k.startsWith('sb_') ? { apikey: k } : { apikey: k, Authorization: 'Bearer ' + k };
};
const sb = (path, opts) => fetch(SB_URL() + path, { ...opts, headers: { ...SB_HEAD(), ...(opts && opts.headers) } });
const bad = (res, code, msg) => res.status(code).json({ ok: false, error: msg });

/* Link nghe có hạn; trả null nếu file chưa có */
async function signedUrl(path) {
  const r = await sb('/storage/v1/object/sign/' + BUCKET + '/' + path, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ expiresIn: 3600 })
  });
  if (!r.ok) return null;
  const j = await r.json();
  const u = j.signedURL || j.signedUrl;
  return u ? SB_URL() + '/storage/v1' + u : null;
}

/* Azure AI Speech (ưu tiên nếu có AZURE_SPEECH_KEY). Giọng nữ Anh: Sonia; giọng nam Anh: Ryan. */
const AZURE_VOICES = { A: 'en-GB-SoniaNeural', B: 'en-GB-RyanNeural' };
const useAzure = () => !!process.env.AZURE_SPEECH_KEY;
const xmlEsc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
async function speakAzure(text, speaker, speed) {
  const region = process.env.AZURE_SPEECH_REGION;
  if (!region) throw new Error('Thiếu AZURE_SPEECH_REGION trên Vercel (ví dụ southeastasia)');
  const pct = Math.round((speed - 1) * 100);
  const ssml = `<speak version="1.0" xml:lang="en-GB"><voice name="${AZURE_VOICES[speaker]}"><prosody rate="${pct}%">${xmlEsc(text).replace(/IELTS/g, '<phoneme alphabet="ipa" ph="ˈaɪ.ɛlts">IELTS</phoneme>')}</prosody></voice></speak>`;
  const r = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: { 'Ocp-Apim-Subscription-Key': process.env.AZURE_SPEECH_KEY, 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': 'audio-24khz-96kbitrate-mono-mp3', 'User-Agent': 'nvu-academy' },
    body: ssml
  });
  if (!r.ok) throw new Error('Azure lỗi ' + r.status + ': ' + (await r.text()).slice(0, 200));
  return Buffer.from(await r.arrayBuffer());
}
function speak(text, speaker, speed) {
  return useAzure() ? speakAzure(text, speaker, speed) : speakEleven(text.replace(/IELTS/g, 'eye elts'), VOICES[speaker], speed);
}

async function speakEleven(text, voice, speed) {
  const r = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + voice + '?output_format=mp3_44100_128', {
    method: 'POST',
    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'content-type': 'application/json', accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: MODEL_ID, voice_settings: { stability: 0.6, similarity_boost: 0.75, speed } })
  });
  if (!r.ok) throw new Error('ElevenLabs lỗi ' + r.status + ': ' + (await r.text()).slice(0, 200));
  return Buffer.from(await r.arrayBuffer());
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return bad(res, 405, 'Chỉ dùng POST');
  for (const k of ['ELEVENLABS_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY'])
    if (!process.env[k]) return bad(res, 500, 'Thiếu biến môi trường ' + k + ' trên Vercel');

  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const studentId = String(b.student_id || '');
    if (!/^[0-9a-f-]{36}$/i.test(studentId)) return bad(res, 400, 'student_id không hợp lệ');
    const st = await (await sb('/rest/v1/students?id=eq.' + studentId + '&select=id,class_code')).json();
    if (!Array.isArray(st) || !st.length) return bad(res, 403, 'Không tìm thấy học sinh');
    const speed = SPEED_BY_CLASS[st[0].class_code] || DEFAULT_SPEED;

    const raw = Array.isArray(b.lines) ? b.lines : [{ speaker: 'A', text: b.text }];
    const lines = raw.map(l => ({ speaker: l && l.speaker === 'B' ? 'B' : 'A', text: String((l && l.text) || '').trim() })).filter(l => l.text);
    if (!lines.length) return bad(res, 400, 'Thiếu nội dung cần đọc');
    if (lines.length > MAX_LINES) return bad(res, 400, 'Quá nhiều câu (tối đa ' + MAX_LINES + ')');
    if (lines.some(l => l.text.length > MAX_LINE)) return bad(res, 400, 'Có câu quá dài (tối đa ' + MAX_LINE + ' ký tự)');
    if (lines.reduce((n, l) => n + l.text.length, 0) > MAX_TOTAL) return bad(res, 400, 'Đoạn quá dài (tối đa ' + MAX_TOTAL + ' ký tự)');

    /* Cùng nội dung và tốc độ thì dùng lại file đã tạo */
    const hash = crypto.createHash('sha256').update(JSON.stringify({ lines, speed, v: useAzure() ? AZURE_VOICES : VOICES, m: useAzure() ? 'azure' : MODEL_ID, pv: 2 })).digest('hex').slice(0, 32);
    const path = 'listening/' + hash + '.mp3';
    const cached = await signedUrl(path);
    if (cached) return res.status(200).json({ ok: true, url: cached, cached: true });

    /* Gói Starter chỉ cho 3 yêu cầu cùng lúc, nên tạo từng nhóm 3 câu */
    const parts = [];
    for (let i = 0; i < lines.length; i += CONCURRENCY)
      parts.push(...await Promise.all(lines.slice(i, i + CONCURRENCY).map(l => speak(l.text, l.speaker, speed))));
    const audio = Buffer.concat(parts);
    const up = await sb('/storage/v1/object/' + BUCKET + '/' + path, {
      method: 'POST', headers: { 'content-type': 'audio/mpeg', 'x-upsert': 'true' }, body: audio
    });
    if (!up.ok) return bad(res, 500, 'Không lưu được audio: ' + (await up.text()).slice(0, 160));
    const url = await signedUrl(path);
    if (!url) return bad(res, 500, 'Không tạo được link nghe');
    return res.status(200).json({ ok: true, url, cached: false });
  } catch (e) {
    return bad(res, 500, 'Lỗi: ' + e.message);
  }
};
