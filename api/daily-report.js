/* Gửi email tổng kết tiến độ học sinh trong ngày cho giáo viên.
   - Chạy tự động mỗi ngày qua Vercel Cron (Authorization: Bearer CRON_SECRET), lúc 23:45 giờ Việt Nam.
   - Hoặc giáo viên/trợ giảng đăng nhập có trong staff_emails có thể gọi tay để xem thử (?dry=1 chỉ trả về nội dung, không gửi).
   Biến môi trường:
     RESEND_API_KEY      khóa API của Resend (đặt trên Vercel, không đưa vào code)
     REPORT_FROM         người gửi, ví dụ "NVU Academy <báo-cáo@tên-miền-đã-xác-minh>"
                         (mặc định onboarding@resend.dev — chỉ gửi được tới email đăng ký Resend)
     REPORT_TO           email nhận báo cáo, cách nhau bằng dấu phẩy (mặc định: TEACHER_EMAILS)
     TEACHER_EMAILS      (đã có) danh sách email giáo viên
     CRON_SECRET, SUPABASE_URL, SUPABASE_SERVICE_KEY  (đã có) */
const SB_URL = () => (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_HEAD = () => {
  const k = process.env.SUPABASE_SERVICE_KEY || '';
  return k.startsWith('sb_') ? { apikey: k } : { apikey: k, Authorization: 'Bearer ' + k };
};
const sb = (path, opts) => fetch(SB_URL() + path, { ...opts, headers: { ...SB_HEAD(), ...(opts && opts.headers) } });
const vnDate = (d = new Date()) => new Date(d.getTime() + 7 * 3600e3).toISOString().slice(0, 10);   // ngày theo giờ Việt Nam
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- xác thực ---------- */
async function authorised(req) {
  const tok = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!tok) return false;
  if (process.env.CRON_SECRET && tok === process.env.CRON_SECRET) return 'cron';
  const r = await fetch(SB_URL() + '/auth/v1/user', { headers: { apikey: SB_HEAD().apikey, Authorization: 'Bearer ' + tok } });
  if (!r.ok) return false;
  const u = await r.json();
  if (!u || !u.email) return false;
  const email = String(u.email).toLowerCase();
  const rows = await (await sb('/rest/v1/staff_emails?select=email&email=eq.' + encodeURIComponent(email))).json().catch(() => []);
  if (Array.isArray(rows) && rows.length) return u.email;
  const allow = (process.env.TEACHER_EMAILS || '').toLowerCase().split(',').map(x => x.trim()).filter(Boolean);
  return allow.includes(email) ? u.email : false;
}

/* ---------- lấy dữ liệu trong ngày ---------- */
async function collect(day) {
  const dayStart = day + 'T00:00:00%2B07:00', nextStart = addDays(day, 1) + 'T00:00:00%2B07:00';
  const [students, scores, errors] = await Promise.all([
    sb('/rest/v1/students?select=id,full_name,class_code&order=class_code.asc,full_name.asc').then(r => r.json()),
    sb(`/rest/v1/daily_scores?select=student_id,section,score,max_score,practice_id&practice_date=eq.${day}`).then(r => r.json()),
    sb(`/rest/v1/error_logs?select=student_id&created_at=gte.${dayStart}&created_at=lt.${nextStart}`).then(r => r.json()),
  ]);
  if (!Array.isArray(students)) throw new Error('Supabase students: ' + JSON.stringify(students).slice(0, 160));
  if (!Array.isArray(scores)) throw new Error('Supabase daily_scores: ' + JSON.stringify(scores).slice(0, 160));
  if (!Array.isArray(errors)) throw new Error('Supabase error_logs: ' + JSON.stringify(errors).slice(0, 160));
  return { students, scores, errors };
}
function addDays(iso, n) { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

/* ---------- dựng nội dung email ---------- */
function summarise({ students, scores, errors }) {
  const byStudent = {}, errCount = {};
  scores.forEach(s => { (byStudent[s.student_id] = byStudent[s.student_id] || []).push(s); });
  errors.forEach(e => { errCount[e.student_id] = (errCount[e.student_id] || 0) + 1; });
  const classes = {};
  students.forEach(st => {
    const c = (classes[st.class_code] = classes[st.class_code] || { total: 0, done: 0, rows: [] });
    const mine = byStudent[st.id] || [];
    const score = mine.reduce((a, s) => a + (s.score || 0), 0), max = mine.reduce((a, s) => a + (s.max_score || 0), 0);
    c.total++; if (mine.length) c.done++;
    c.rows.push({ name: st.full_name, sections: mine.map(s => s.section), score, max, errors: errCount[st.id] || 0 });
  });
  return classes;
}
function render(day, classes) {
  const codes = Object.keys(classes).sort();
  const totalStudents = codes.reduce((a, c) => a + classes[c].total, 0), totalDone = codes.reduce((a, c) => a + classes[c].done, 0);
  const parts = [];
  for (const code of codes) {
    const c = classes[code];
    const body = c.rows.map(r => `<tr>
      <td style="padding:6px 10px;border-bottom:1px solid #eee">${esc(r.name)}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee">${r.sections.length ? esc([...new Set(r.sections)].join(', ')) : '<span style="color:#b00">chưa làm</span>'}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:center">${r.max ? r.score + '/' + r.max : '—'}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:center">${r.errors || '—'}</td>
    </tr>`).join('');
    parts.push(`<h3 style="margin:20px 0 6px">${esc(code)} — đã làm ${c.done}/${c.total} học sinh</h3>
      <table style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:14px">
        <thead><tr style="background:#f5f0eb;text-align:left">
          <th style="padding:6px 10px">Học sinh</th><th style="padding:6px 10px">Phần đã làm</th>
          <th style="padding:6px 10px;text-align:center">Điểm</th><th style="padding:6px 10px;text-align:center">Lỗi mới</th>
        </tr></thead><tbody>${body}</tbody></table>`);
  }
  const subject = `Tiến độ học ngày ${day}: ${totalDone}/${totalStudents} học sinh đã làm`;
  const html = `<div style="font-family:Arial,sans-serif;color:#2c2416;max-width:680px">
    <h2 style="margin:0 0 4px">Tiến độ học sinh — ${esc(day)}</h2>
    <p style="margin:0 0 12px;color:#8B7355">Tổng: ${totalDone}/${totalStudents} học sinh đã làm bài hôm nay.</p>
    ${parts.join('')}
    <p style="margin-top:20px;color:#8B7355;font-size:12px">Email tự động từ NVU Academy. Xem chi tiết trên trang giáo viên.</p></div>`;
  return { subject, html };
}

async function send({ subject, html }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('Thiếu biến môi trường RESEND_API_KEY trên Vercel');
  const to = (process.env.REPORT_TO || process.env.TEACHER_EMAILS || '').split(',').map(x => x.trim()).filter(Boolean);
  if (!to.length) throw new Error('Thiếu REPORT_TO (hoặc TEACHER_EMAILS) — chưa có email nhận báo cáo');
  const from = process.env.REPORT_FROM || 'NVU Academy <onboarding@resend.dev>';
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: 'Bearer ' + key, 'content-type': 'application/json' },
    body: JSON.stringify({ from, to, subject, html }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('Resend ' + r.status + ': ' + String(j.message || j.name || '').slice(0, 200));
  return { id: j.id, to };
}

module.exports = async function handler(req, res) {
  try {
    const who = await authorised(req);
    if (!who) return res.status(401).json({ ok: false, error: 'Không có quyền' });
    for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY']) if (!process.env[k]) return res.status(500).json({ ok: false, error: 'Thiếu biến môi trường ' + k + ' trên Vercel' });
    const day = (req.query && req.query.date) || vnDate();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return res.status(400).json({ ok: false, error: 'date phải dạng YYYY-MM-DD' });
    const classes = summarise(await collect(day));
    const mail = render(day, classes);
    if (req.query && req.query.dry) return res.status(200).json({ ok: true, dry: true, subject: mail.subject, html: mail.html });
    const sent = await send(mail);
    res.status(200).json({ ok: true, day, subject: mail.subject, ...sent });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e).slice(0, 300) });
  }
};
module.exports.summarise = summarise;
module.exports.render = render;
