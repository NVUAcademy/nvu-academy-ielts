/* Ghi và xem lịch sử đăng nhập của học sinh.
   POST (học sinh, lúc đăng nhập thành công): ghi một dòng vào login_log và cập nhật students.last_active.
   GET (giáo viên hoặc trợ giảng): trả về 200 lần đăng nhập gần nhất kèm tên và lớp, có thể lọc theo lớp.
   Biến môi trường: SUPABASE_URL, SUPABASE_SERVICE_KEY (đã có) */

const SB_URL = () => (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_HEAD = () => {
  const k = process.env.SUPABASE_SERVICE_KEY || '';
  return k.startsWith('sb_') ? { apikey: k } : { apikey: k, Authorization: 'Bearer ' + k };
};
const sb = (path, opts) => fetch(SB_URL() + path, { ...opts, headers: { ...SB_HEAD(), ...(opts && opts.headers) } });
const bad = (res, code, msg) => res.status(code).json({ ok: false, error: msg });
const UUID = /^[0-9a-f-]{36}$/i;
const METHODS = ['name', 'google'];

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

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET' && req.method !== 'POST') return bad(res, 405, 'GET hoặc POST thôi');
  for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY'])
    if (!process.env[k]) return bad(res, 500, 'Thiếu biến môi trường ' + k + ' trên Vercel');

  try {
    if (req.method === 'POST') {
      const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const studentId = String(b.student_id || '');
      if (!UUID.test(studentId)) return bad(res, 400, 'student_id không hợp lệ');
      const method = METHODS.includes(b.method) ? b.method : 'name';
      const st = await (await sb('/rest/v1/students?id=eq.' + studentId + '&select=id')).json();
      if (!Array.isArray(st) || !st.length) return bad(res, 403, 'Không tìm thấy học sinh');

      const now = new Date().toISOString();
      const ins = await sb('/rest/v1/login_log', {
        method: 'POST', headers: { 'content-type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ student_id: studentId, method, logged_at: now })
      });
      if (!ins.ok) return bad(res, 500, 'Không ghi được lịch sử: ' + (await ins.text()).slice(0, 160));
      await sb('/rest/v1/students?id=eq.' + studentId, {
        method: 'PATCH', headers: { 'content-type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ last_active: now })
      });
      return res.status(200).json({ ok: true });
    }

    /* GET: chỉ giáo viên hoặc trợ giảng */
    if (!(await staffEmail(req))) return bad(res, 401, 'Cần đăng nhập tài khoản giáo viên hoặc trợ giảng');
    const q = Object.fromEntries(new URL(req.url, 'http://localhost').searchParams);
    const classFilter = /^[A-Z0-9]{3,20}$/.test(String(q.class_code || '')) ? '&students.class_code=eq.' + q.class_code : '';
    const rows = await (await sb('/rest/v1/login_log?select=id,method,logged_at,students!inner(full_name,class_code)' + classFilter + '&order=logged_at.desc&limit=200')).json();
    if (!Array.isArray(rows)) return bad(res, 500, 'Không đọc được lịch sử');
    return res.status(200).json({ ok: true, data: rows.map(r => ({ id: r.id, method: r.method, logged_at: r.logged_at, name: r.students.full_name, class_code: r.students.class_code })) });
  } catch (e) {
    return bad(res, 500, 'Lỗi máy chủ: ' + e.message);
  }
};
