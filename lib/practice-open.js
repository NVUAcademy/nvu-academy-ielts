/* Khóa bài Daily Practice theo ngày (giờ Việt Nam), dùng chung cho api/submit-daily và api/draft.
   Ngày mở của bài: ngày trong bảng schedule của lớp học sinh (nếu lớp có lịch cho bài đó),
   nếu không thì ngày trong daily-index.json. Học sinh không được nộp bài chưa tới ngày mở,
   kể cả khi tự sửa tham số d trên đường dẫn. */

const todayVN = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);

/* daily-index.json lấy từ chính trang web (cache trong hàm vài phút) */
let IDX = null, IDX_AT = 0;
async function indexDate(req, practiceId) {
  try {
    if (!IDX || Date.now() - IDX_AT > 5 * 60 * 1000) {
      const host = (req.headers && (req.headers['x-forwarded-host'] || req.headers.host)) || '';
      const base = host ? 'https://' + host : (process.env.SITE_URL || '').replace(/\/$/, '');
      const r = await fetch(base + '/daily-index.json');
      if (r.ok) { IDX = (await r.json()).practices || []; IDX_AT = Date.now(); }
    }
    const m = (IDX || []).find(x => x.id === practiceId);
    return m && m.date ? m.date : null;
  } catch (e) { return null; }
}

/* Trả về null nếu được nộp, hoặc câu báo lỗi nếu bài chưa mở */
async function practiceLocked({ sb, req, studentId, classCode, practiceId, practiceDate }) {
  const today = todayVN();
  if (practiceDate > today) return 'Bài này chưa mở (mở ngày ' + practiceDate + ')';
  let open = null;
  if (classCode) {
    const rows = await (await sb(`/rest/v1/schedule?select=day&class_code=eq.${encodeURIComponent(classCode)}&practice_id=eq.${encodeURIComponent(practiceId)}`)).json().catch(() => []);
    const days = Array.isArray(rows) ? rows.map(r => r.day).filter(Boolean).sort() : [];
    if (days.length) open = days[0];
  }
  if (!open) open = await indexDate(req, practiceId);
  if (open && open > today) return 'Bài này chưa mở (mở ngày ' + open + ')';
  return null;
}

module.exports = { todayVN, practiceLocked };
