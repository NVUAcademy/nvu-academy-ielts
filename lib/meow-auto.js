/* Tự chấm Meow theo bài đã nộp, chạy mỗi đêm qua api/export-recordings.js?task=meow.
   Với mỗi lớp đã bật Meow và mỗi bài luyện tập có trong ngày:
     - nộp đúng hạn của lớp  -> du (Đủ)
     - nộp sau hạn          -> muon (Muộn)
     - không nộp            -> khong (Không nộp)
   Chỉ điền ô còn trống; ô thầy đã chấm thì giữ nguyên. Nửa / Bù do thầy chấm tay.
   Hạn nộp (giờ Việt Nam) giống trang giáo viên: IELTS13 23:30, IELTS14 0:00 hôm sau, lớp khác 23:00.
   Biến môi trường: SUPABASE_URL, SUPABASE_SERVICE_KEY (đã có), SITE_URL (tuỳ chọn). */
const SB_URL = () => (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_HEAD = () => {
  const k = process.env.SUPABASE_SERVICE_KEY || '';
  return k.startsWith('sb_') ? { apikey: k } : { apikey: k, Authorization: 'Bearer ' + k };
};
const sb = (path, opts) => fetch(SB_URL() + path, { ...opts, headers: { ...SB_HEAD(), ...(opts && opts.headers) } });
const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/* Hạn nộp của lớp trong ngày, dưới dạng mốc thời gian (giờ Việt Nam, +07:00) */
function deadlineFor(cls, day) {
  if (cls === 'IELTS13') return new Date(day + 'T23:30:00+07:00');
  if (cls === 'IELTS14') return new Date(addDays(day, 1) + 'T00:00:00+07:00');
  return new Date(day + 'T23:00:00+07:00');
}

/* Tính trạng thái Meow cho mọi học sinh trong một ngày. Trả về danh sách {student_id, day, status} cần ghi. */
async function computeMeow(day, siteUrl) {
  const classesRes = await (await sb('/rest/v1/classes?select=class_code&meow_enabled=eq.true')).json();
  if (!Array.isArray(classesRes)) throw new Error('Supabase classes: ' + JSON.stringify(classesRes).slice(0, 160));
  const index = await (await fetch(siteUrl.replace(/\/$/, '') + '/daily-index.json')).json();
  const todays = (index.practices || []).filter(p => p.date === day);
  const out = [], summary = {};

  for (const { class_code: cls } of classesRes) {
    const practiceIds = todays.filter(p => (p.class_codes || []).includes(cls)).map(p => p.id);
    if (!practiceIds.length) continue;
    const students = await (await sb('/rest/v1/students?select=id&class_code=eq.' + encodeURIComponent(cls))).json();
    if (!Array.isArray(students) || !students.length) continue;
    const ids = students.map(s => s.id);
    const scores = await (await sb('/rest/v1/daily_scores?select=student_id,practice_id,created_at&practice_date=eq.' + day + '&student_id=in.(' + ids.join(',') + ')')).json();
    const existing = await (await sb('/rest/v1/meow_status?select=student_id&day=eq.' + day + '&student_id=in.(' + ids.join(',') + ')')).json();
    const filled = new Set((Array.isArray(existing) ? existing : []).map(r => r.student_id));
    const dl = deadlineFor(cls, day);
    const counts = { du: 0, muon: 0, khong: 0 };

    for (const id of ids) {
      if (filled.has(id)) continue;
      const mine = (Array.isArray(scores) ? scores : []).filter(r => r.student_id === id && practiceIds.includes(r.practice_id));
      let status = 'khong';
      if (mine.length) {
        const first = mine.reduce((a, b) => (new Date(a.created_at) <= new Date(b.created_at) ? a : b));
        status = new Date(first.created_at) <= dl ? 'du' : 'muon';
      }
      counts[status]++;
      out.push({ student_id: id, day, status });
    }
    summary[cls] = { practices: practiceIds, ...counts, skipped_already_marked: filled.size };
  }
  return { rows: out, summary };
}

/* Ghi các ô còn trống. Đã có dòng thì bỏ qua (ignore-duplicates). */
async function writeMeow(rows) {
  if (!rows.length) return 0;
  const res = await sb('/rest/v1/meow_status?on_conflict=student_id,day', {
    method: 'POST', headers: { 'content-type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify(rows.map(r => ({ ...r, updated_at: new Date().toISOString() })))
  });
  if (!res.ok) throw new Error('Ghi meow_status: ' + (await res.text()).slice(0, 200));
  return rows.length;
}

module.exports = { computeMeow, writeMeow, deadlineFor };
