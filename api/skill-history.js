/* Lịch sử làm bài luyện đề của học sinh cho cả 4 kỹ năng (bảng skill_history).
   Máy chủ kiểm tra học sinh và dữ liệu trước khi đọc hoặc ghi bằng khóa dịch vụ.
   Biến môi trường: SUPABASE_URL, SUPABASE_SERVICE_KEY (đã có) */

const SB_URL = () => (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_HEAD = () => {
  const k = process.env.SUPABASE_SERVICE_KEY || '';
  return k.startsWith('sb_') ? { apikey: k } : { apikey: k, Authorization: 'Bearer ' + k };
};
const sb = (path, opts) => fetch(SB_URL() + path, { ...opts, headers: { ...SB_HEAD(), ...(opts && opts.headers) } });
const bad = (res, code, msg) => res.status(code).json({ ok: false, error: msg });
const SKILLS = ['speaking', 'writing', 'reading', 'listening'];
const num = v => (typeof v === 'number' && isFinite(v) ? v : null);

/* POST đọc từ thân yêu cầu, GET đọc từ tham số trên đường dẫn */
const params = req => req.method === 'POST'
  ? (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}))
  : Object.fromEntries(new URL(req.url, 'http://localhost').searchParams);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET' && req.method !== 'POST') return bad(res, 405, 'GET hoặc POST thôi');
  for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY'])
    if (!process.env[k]) return bad(res, 500, 'Thiếu biến môi trường ' + k + ' trên Vercel');

  try {
    const b = params(req);

    const studentId = String(b.student_id || '');
    if (!/^[0-9a-f-]{36}$/i.test(studentId)) return bad(res, 400, 'student_id không hợp lệ');
    const st = await (await sb('/rest/v1/students?id=eq.' + studentId + '&select=id')).json();
    if (!Array.isArray(st)) return bad(res, 500, 'Supabase từ chối khóa dịch vụ');
    if (!st.length) return bad(res, 403, 'Không tìm thấy học sinh');

    if (req.method === 'GET') {
      const skill = String(b.skill || '');
      const filter = SKILLS.includes(skill) ? '&skill=eq.' + skill : '';
      const rows = await (await sb('/rest/v1/skill_history?select=id,skill,test_id,test_title,score,max_score,band,detail,created_at&student_id=eq.' + studentId + filter + '&order=created_at.desc&limit=50')).json();
      return res.status(200).json({ ok: true, data: Array.isArray(rows) ? rows : [] });
    }

    const skill = String(b.skill || '');
    if (!SKILLS.includes(skill)) return bad(res, 400, 'skill không hợp lệ');
    const testId = String(b.test_id || '').slice(0, 80);
    if (!testId) return bad(res, 400, 'Thiếu test_id');
    const detail = b.detail && typeof b.detail === 'object' && !Array.isArray(b.detail) ? b.detail : {};
    if (JSON.stringify(detail).length > 100000) return bad(res, 400, 'Dữ liệu bài làm quá lớn');

    const up = await sb('/rest/v1/skill_history', {
      method: 'POST', headers: { 'content-type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ student_id: studentId, skill, test_id: testId, test_title: String(b.test_title || '').slice(0, 200), score: num(b.score), max_score: num(b.max_score), band: num(b.band), detail })
    });
    if (!up.ok) return bad(res, 500, 'Không lưu được lịch sử: ' + (await up.text()).slice(0, 160));
    return res.status(200).json({ ok: true });
  } catch (e) {
    return bad(res, 500, 'Lỗi máy chủ: ' + e.message);
  }
};
