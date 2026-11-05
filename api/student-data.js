/* Một hàm cho sáu API dữ liệu học sinh (gộp để không vượt giới hạn 12 hàm của Vercel Hobby).
   Chọn xử lý bằng tham số res: draft, review-error, skill-history, vq-progress, submit-daily, submit-weekly.
   Đường dẫn cũ (/api/draft, /api/submit-daily…) được vercel.json chuyển tới đây, trang web không đổi.
   Logic từng API nằm ở lib/student/, không thay đổi. */

const handlers = {
  'draft': require('../lib/student/draft.js'),
  'review-error': require('../lib/student/review-error.js'),
  'skill-history': require('../lib/student/skill-history.js'),
  'vq-progress': require('../lib/student/vq-progress.js'),
  'submit-daily': require('../lib/student/submit-daily.js'),
  'submit-weekly': require('../lib/student/submit-weekly.js'),
};

module.exports = async function handler(req, res) {
  let name = req.query && req.query.res;
  if (!name) {
    try { name = new URL(req.url, 'http://localhost').searchParams.get('res'); } catch (e) { name = null; }
  }
  const h = handlers[String(name || '')];
  if (!h) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(404).json({ ok: false, error: 'res không hợp lệ' });
  }
  return h(req, res);
};
