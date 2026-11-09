/* Nhận xét của trợ giảng gửi cho học sinh (tro-giang.html và index.html).
   POST (trợ giảng/giáo viên): kiểm tra đăng nhập và có trong staff_emails, lưu nhận xét và/hoặc file ghi âm.
   GET (học sinh): trả về các nhận xét 60 ngày gần nhất (tối đa 50), kèm link nghe có hạn 1 giờ nếu có ghi âm.
   Biến môi trường: SUPABASE_URL, SUPABASE_SERVICE_KEY (đã có) */

const SB_URL = () => (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_HEAD = () => {
  const k = process.env.SUPABASE_SERVICE_KEY || '';
  return k.startsWith('sb_') ? { apikey: k } : { apikey: k, Authorization: 'Bearer ' + k };
};
const sb = (path, opts) => fetch(SB_URL() + path, { ...opts, headers: { ...SB_HEAD(), ...(opts && opts.headers) } });
const bad = (res, code, msg) => res.status(code).json({ ok: false, error: msg });
const UUID = /^[0-9a-f-]{36}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_B64 = 3 * 1024 * 1024; /* khoảng 2 MB file ghi âm */
const EXT = { 'audio/webm': 'webm', 'audio/mp4': 'm4a', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/wav': 'wav' };

/* Lấy email từ đăng nhập của người gọi, rồi kiểm tra có trong staff_emails không */
async function staffEmail(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const u = await fetch(SB_URL() + '/auth/v1/user', { headers: { ...SB_HEAD(), Authorization: 'Bearer ' + token } });
  if (!u.ok) return null;
  const user = await u.json();
  const email = String(user.email || '').toLowerCase();
  if (!email) return null;
  const rows = await (await sb('/rest/v1/staff_emails?select=email&email=ilike.' + encodeURIComponent(email))).json();
  return Array.isArray(rows) && rows.length ? email : null;
}

/* Học sinh thấy phản hồi của trợ giảng trong 60 ngày gần nhất (tính theo ngày của bài tập); file ghi âm gốc không bị xóa */
const KEEP_DAYS = 60;
const cutoff = () => new Date(Date.now() - KEEP_DAYS * 86400000).toISOString().slice(0, 10);

/* Tạo link nghe có hạn 1 giờ cho file ghi âm */
async function signedUrl(path) {
  const r = await sb('/storage/v1/object/sign/voice-notes/' + path.split('/').map(encodeURIComponent).join('/'), {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ expiresIn: 3600 })
  });
  const s = await r.json().catch(() => ({}));
  if (!s.signedURL) {
    /* Ghi lại lỗi để xem trong nhật ký Vercel (chỉ giữ 1 giờ). Không ghi nội dung nhạy cảm, chỉ mã lỗi và đường dẫn file */
    console.error('voice-reply: không ký được link nghe', r.status, path, String(s.message || s.error || '').slice(0, 160));
    return null;
  }
  return SB_URL() + '/storage/v1' + s.signedURL;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET' && req.method !== 'POST') return bad(res, 405, 'GET hoặc POST thôi');
  for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY'])
    if (!process.env[k]) return bad(res, 500, 'Thiếu biến môi trường ' + k + ' trên Vercel');

  try {
    if (req.method === 'GET') {
      res.setHeader('Cache-Control', 'no-store');
      const q = Object.fromEntries(new URL(req.url, 'http://localhost').searchParams);
      const studentId = String(q.student_id || '');
      if (!UUID.test(studentId)) return bad(res, 400, 'student_id không hợp lệ');
      const st = await (await sb('/rest/v1/students?id=eq.' + studentId + '&select=id')).json();
      if (!Array.isArray(st) || !st.length) return bad(res, 403, 'Không tìm thấy học sinh');

      const rows = await (await sb('/rest/v1/voice_replies?select=id,practice_id,practice_date,section,path,comment,created_at&student_id=eq.' + studentId + '&practice_date=gte.' + cutoff() + '&order=created_at.desc&limit=50')).json();
      const replies = [];
      for (const r of Array.isArray(rows) ? rows : []) {
        const url = r.path ? await signedUrl(r.path) : null;
        /* has_audio: bản ghi có file nhưng chưa tạo được link (url = null) thì trang học sinh báo lỗi thay vì im lặng */
        replies.push({ id: r.id, practice_id: r.practice_id, date: r.practice_date, section: r.section, created_at: r.created_at, comment: r.comment || '', url, has_audio: !!r.path });
      }
      return res.status(200).json({ ok: true, replies });
    }

    /* POST: chỉ trợ giảng / giáo viên */
    const email = await staffEmail(req);
    if (!email) return bad(res, 403, 'Chỉ trợ giảng hoặc giáo viên được gửi nhận xét');
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const studentId = String(b.student_id || '');
    if (!UUID.test(studentId)) return bad(res, 400, 'student_id không hợp lệ');
    const practiceId = String(b.practice_id || '').slice(0, 80);
    const practiceDate = String(b.practice_date || '');
    const section = String(b.section || '').slice(0, 40);
    if (!practiceId || !DATE.test(practiceDate)) return bad(res, 400, 'Thiếu thông tin bài làm');

    const comment = String(b.comment || '').trim().slice(0, 1000);
    const audio = String(b.audio || '');
    const mime = String(b.mime || '').toLowerCase().split(';')[0];
    if (!comment && !audio) return bad(res, 400, 'Cần có nhận xét hoặc ghi âm');
    if (audio) {
      if (!EXT[mime]) return bad(res, 400, 'Định dạng ghi âm không được hỗ trợ');
      if (!/^[A-Za-z0-9+/=]+$/.test(audio)) return bad(res, 400, 'Âm thanh không hợp lệ');
      if (audio.length > MAX_B64) return bad(res, 413, 'Ghi âm quá dài, tối đa khoảng 2 phút');
      if (audio.length < 1000) return bad(res, 400, 'Ghi âm quá ngắn');
    }

    const st = await (await sb('/rest/v1/students?id=eq.' + studentId + '&select=id')).json();
    if (!Array.isArray(st) || !st.length) return bad(res, 403, 'Không tìm thấy học sinh');

    let path = null;
    if (audio) {
      path = 'replies/' + studentId + '/' + Date.now() + '.' + EXT[mime];
      const up = await sb('/storage/v1/object/voice-notes/' + path.split('/').map(encodeURIComponent).join('/'), {
        method: 'POST', headers: { 'content-type': mime, 'x-upsert': 'false' }, body: Buffer.from(audio, 'base64')
      });
      if (!up.ok) return bad(res, 500, 'Không lưu được file ghi âm: ' + (await up.text()).slice(0, 160));
    }

    /* Lưu nhận xét chữ vào đúng dòng bài làm của học sinh (chỗ trang học sinh và trang giáo viên đọc).
       Chỉ ghi khi có chữ mới, nên không xóa nhận xét cũ nếu ô để trống. */
    if (comment) {
      const up = await sb('/rest/v1/daily_scores?student_id=eq.' + studentId + '&practice_id=eq.' + encodeURIComponent(practiceId) + '&practice_date=eq.' + practiceDate + '&section=eq.' + encodeURIComponent(section), {
        method: 'PATCH', headers: { 'content-type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ teacher_comment: comment })
      });
      if (!up.ok) return bad(res, 500, 'Không lưu được nhận xét vào bài làm: ' + (await up.text()).slice(0, 160));
    }

    const ins = await sb('/rest/v1/voice_replies', {
      method: 'POST', headers: { 'content-type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ student_id: studentId, practice_id: practiceId, practice_date: practiceDate, section, path, comment: comment || null, created_by: email })
    });
    if (!ins.ok) return bad(res, 500, 'Không ghi được nhận xét: ' + (await ins.text()).slice(0, 160));
    return res.status(200).json({ ok: true });
  } catch (e) {
    return bad(res, 500, 'Lỗi máy chủ: ' + e.message);
  }
};
