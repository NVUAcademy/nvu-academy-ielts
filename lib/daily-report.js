/* Báo cáo tiến độ học sinh trong ngày gửi cho giáo viên qua email (Resend).
   Được gọi từ api/export-recordings.js?task=report — nằm ở lib/ để không tính là một hàm API riêng.
   Biến môi trường:
     RESEND_API_KEY   khóa API của Resend (đặt trên Vercel)
     REPORT_FROM      người gửi (mặc định onboarding@resend.dev)
     REPORT_TO        email nhận, cách nhau bằng dấu phẩy (mặc định: TEACHER_EMAILS)
     SUPABASE_URL, SUPABASE_SERVICE_KEY (đã có) */
const SB_URL = () => (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_HEAD = () => {
  const k = process.env.SUPABASE_SERVICE_KEY || '';
  return k.startsWith('sb_') ? { apikey: k } : { apikey: k, Authorization: 'Bearer ' + k };
};
const sb = (path, opts) => fetch(SB_URL() + path, { ...opts, headers: { ...SB_HEAD(), ...(opts && opts.headers) } });
const vnDate = (d = new Date()) => new Date(d.getTime() + 7 * 3600e3).toISOString().slice(0, 10);
const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

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
    <p style="margin-top:20px;color:#8B7355;font-size:12px">Email tự động từ NVU Academy.</p></div>`;
  return { subject, html };
}

/* Dựng báo cáo cho một ngày (YYYY-MM-DD). Mặc định là ngày vừa kết thúc theo giờ Việt Nam:
   chạy lúc 00:30 thì báo cáo cho ngày hôm trước. */
async function buildReport(day) {
  const d = day || vnDate(new Date(Date.now() - 3 * 3600e3));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error('date phải dạng YYYY-MM-DD');
  const classes = summarise(await collect(d));
  return { day: d, ...render(d, classes) };
}

/* Gửi báo cáo qua Resend */
async function sendReport({ subject, html }) {
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

module.exports = { buildReport, sendReport, summarise, render };
