/* Nháp bài đang làm của học sinh (Daily Practice và Weekly Quiz) qua máy chủ.
   Máy chủ kiểm tra học sinh, mã bài và ngày trước khi đọc, ghi hoặc xóa bằng khóa dịch vụ.
   Biến môi trường: SUPABASE_URL, SUPABASE_SERVICE_KEY (đã có) */

const SB_URL = () => (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_HEAD = () => {
  const k = process.env.SUPABASE_SERVICE_KEY || '';
  return k.startsWith('sb_') ? { apikey: k } : { apikey: k, Authorization: 'Bearer ' + k };
};
const sb = (path, opts) => fetch(SB_URL() + path, { ...opts, headers: { ...SB_HEAD(), ...(opts && opts.headers) } });
const bad = (res, code, msg) => res.status(code).json({ ok: false, error: msg });
const str = (v, max) => String(v == null ? '' : v).slice(0, max);

/* Chỉ nhận ngày nằm trong khoảng 14 ngày quanh hôm nay (giờ Việt Nam) */
function dateOk(d) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const today = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
  const diff = Math.abs(new Date(d + 'T00:00:00Z') - new Date(today + 'T00:00:00Z')) / 86400000;
  return diff <= 14;
}

/* POST đọc từ thân yêu cầu, GET và DELETE đọc từ tham số trên đường dẫn */
const params = req => req.method === 'POST'
  ? (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}))
  : Object.fromEntries(new URL(req.url, 'http://localhost').searchParams);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!['GET', 'POST', 'DELETE'].includes(req.method)) return bad(res, 405, 'GET, POST hoặc DELETE thôi');
  for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY'])
    if (!process.env[k]) return bad(res, 500, 'Thiếu biến môi trường ' + k + ' trên Vercel');

  try {
    const b = params(req);

    const studentId = String(b.student_id || '');
    if (!/^[0-9a-f-]{36}$/i.test(studentId)) return bad(res, 400, 'student_id không hợp lệ');
    const st = await (await sb('/rest/v1/students?id=eq.' + studentId + '&select=id')).json();
    if (!Array.isArray(st)) return bad(res, 500, 'Supabase từ chối khóa dịch vụ');
    if (!st.length) return bad(res, 403, 'Không tìm thấy học sinh');

    const practiceId = str(b.practice_id, 80);
    const practiceDate = String(b.practice_date || '');
    if (!practiceId) return bad(res, 400, 'Thiếu practice_id');
    if (!dateOk(practiceDate)) return bad(res, 400, 'Ngày bài tập không hợp lệ');

    const key = `student_id=eq.${studentId}&practice_id=eq.${encodeURIComponent(practiceId)}&practice_date=eq.${practiceDate}`;

    if (req.method === 'GET') {
      const rows = await (await sb('/rest/v1/daily_drafts?select=answers&' + key)).json();
      return res.status(200).json({ ok: true, data: Array.isArray(rows) && rows.length ? rows[0] : null });
    }

    if (req.method === 'DELETE') {
      const d = await sb('/rest/v1/daily_drafts?' + key, { method: 'DELETE' });
      if (!d.ok) return bad(res, 500, 'Không xóa được nháp: ' + (await d.text()).slice(0, 160));
      return res.status(200).json({ ok: true });
    }

    const answers = b.answers && typeof b.answers === 'object' && !Array.isArray(b.answers) ? b.answers : {};
    if (JSON.stringify(answers).length > 50000) return bad(res, 400, 'Bài làm quá dài');
    const up = await sb('/rest/v1/daily_drafts?on_conflict=student_id,practice_id,practice_date', {
      method: 'POST', headers: { 'content-type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ student_id: studentId, practice_id: practiceId, practice_date: practiceDate, answers, updated_at: new Date().toISOString() })
    });
    if (!up.ok) return bad(res, 500, 'Không lưu được nháp: ' + (await up.text()).slice(0, 160));
    return res.status(200).json({ ok: true });
  } catch (e) {
    return bad(res, 500, 'Lỗi máy chủ: ' + e.message);
  }
};
