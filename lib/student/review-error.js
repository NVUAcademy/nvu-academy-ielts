/* Ghi tiến độ ôn lỗi sai của học sinh (errors.html) qua máy chủ.
   Máy chủ chỉ cho sửa lỗi thuộc chính học sinh đó, rồi ghi bằng khóa dịch vụ.
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

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return bad(res, 405, 'POST only');
  for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY'])
    if (!process.env[k]) return bad(res, 500, 'Thiếu biến môi trường ' + k + ' trên Vercel');

  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const studentId = String(b.student_id || '');
    const errorId = String(b.error_id || '');
    if (!UUID.test(studentId)) return bad(res, 400, 'student_id không hợp lệ');
    if (!UUID.test(errorId)) return bad(res, 400, 'error_id không hợp lệ');

    const st = await (await sb('/rest/v1/students?id=eq.' + studentId + '&select=id')).json();
    if (!Array.isArray(st)) return bad(res, 500, 'Supabase từ chối khóa dịch vụ');
    if (!st.length) return bad(res, 403, 'Không tìm thấy học sinh');

    /* Lỗi này phải thuộc đúng học sinh đang gọi */
    const owned = await (await sb('/rest/v1/error_logs?select=id&id=eq.' + errorId + '&student_id=eq.' + studentId)).json();
    if (!Array.isArray(owned) || !owned.length) return bad(res, 403, 'Lỗi này không thuộc học sinh này');

    const streak = b.review_streak;
    if (!Number.isInteger(streak) || streak < 0 || streak > 1000) return bad(res, 400, 'review_streak không hợp lệ');
    const lastReview = String(b.last_review || '');
    if (!DATE.test(lastReview)) return bad(res, 400, 'last_review không hợp lệ');
    if (typeof b.is_resolved !== 'boolean') return bad(res, 400, 'is_resolved không hợp lệ');
    const resolvedAt = b.resolved_at == null ? null : new Date(b.resolved_at);
    if (resolvedAt && isNaN(resolvedAt)) return bad(res, 400, 'resolved_at không hợp lệ');

    const up = await sb('/rest/v1/error_logs?id=eq.' + errorId, {
      method: 'PATCH', headers: { 'content-type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ review_streak: streak, last_review: lastReview, is_resolved: b.is_resolved, resolved_at: resolvedAt ? resolvedAt.toISOString() : null })
    });
    if (!up.ok) return bad(res, 500, 'Không lưu được tiến độ: ' + (await up.text()).slice(0, 160));
    return res.status(200).json({ ok: true });
  } catch (e) {
    return bad(res, 500, 'Lỗi máy chủ: ' + e.message);
  }
};
