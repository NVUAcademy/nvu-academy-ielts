/* Ghi kết quả Weekly Quiz của học sinh qua máy chủ (thay cho việc ghi thẳng bằng khóa công khai).
   Máy chủ kiểm tra học sinh, tuần, điểm và đáp án trước khi lưu bằng khóa dịch vụ.
   Biến môi trường: SUPABASE_URL, SUPABASE_SERVICE_KEY (đã có) */

const SB_URL = () => (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_HEAD = () => {
  const k = process.env.SUPABASE_SERVICE_KEY || '';
  return k.startsWith('sb_') ? { apikey: k } : { apikey: k, Authorization: 'Bearer ' + k };
};
const sb = (path, opts) => fetch(SB_URL() + path, { ...opts, headers: { ...SB_HEAD(), ...(opts && opts.headers) } });
const bad = (res, code, msg) => res.status(code).json({ ok: false, error: msg });
const isInt = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
const str = (v, max) => String(v == null ? '' : v).slice(0, max);

/* Chỉ nhận ngày nằm trong khoảng 14 ngày quanh hôm nay (giờ Việt Nam) */
function dateOk(d) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const today = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
  const diff = Math.abs(new Date(d + 'T00:00:00Z') - new Date(today + 'T00:00:00Z')) / 86400000;
  return diff <= 14;
}

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
    if (!/^[0-9a-f-]{36}$/i.test(studentId)) return bad(res, 400, 'student_id không hợp lệ');
    const st = await (await sb('/rest/v1/students?id=eq.' + studentId + '&select=id')).json();
    if (!Array.isArray(st)) return bad(res, 500, 'Supabase từ chối khóa dịch vụ');
    if (!st.length) return bad(res, 403, 'Không tìm thấy học sinh');

    const quizDate = String(b.quiz_date || '');
    if (!dateOk(quizDate)) return bad(res, 400, 'Ngày làm bài không hợp lệ');
    const weekNumber = b.week_number;
    if (!isInt(weekNumber, 1, 52)) return bad(res, 400, 'week_number không hợp lệ');

    const maxScore = b.max_score;
    if (!isInt(maxScore, 1, 200)) return bad(res, 400, 'max_score không hợp lệ');
    const parts = ['part_a_score', 'part_b_score', 'part_c_score', 'part_d_score'];
    for (const p of parts) if (b[p] != null && !isInt(b[p], 0, maxScore)) return bad(res, 400, p + ' không hợp lệ');
    if (!isInt(b.total_score, 0, maxScore)) return bad(res, 400, 'total_score không hợp lệ');

    const answers = b.answers && typeof b.answers === 'object' && !Array.isArray(b.answers) ? b.answers : {};
    if (JSON.stringify(answers).length > 50000) return bad(res, 400, 'Bài làm quá dài');
    const partSeconds = b.part_seconds && typeof b.part_seconds === 'object' && !Array.isArray(b.part_seconds) ? b.part_seconds : {};

    /* Đã có kết quả tuần này chưa: nếu có thì không ghi lỗi sai lần hai */
    const existing = await (await sb(`/rest/v1/weekly_quiz_results?select=id&student_id=eq.${studentId}&week_number=eq.${weekNumber}`)).json();
    const alreadySaved = Array.isArray(existing) && existing.length > 0;

    const core = {
      student_id: studentId, quiz_date: quizDate, week_number: weekNumber,
      part_a_score: b.part_a_score ?? null, part_b_score: b.part_b_score ?? null,
      part_c_score: b.part_c_score ?? null, part_d_score: b.part_d_score ?? null,
      total_score: b.total_score, max_score: maxScore
    };
    const quizId = str(b.quiz_id, 80);
    const row = { ...core, answers, part_seconds: partSeconds, quiz_id: quizId || null };
    const upsert = body => sb('/rest/v1/weekly_quiz_results?on_conflict=student_id,week_number', {
      method: 'POST', headers: { 'content-type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(body)
    });
    let up = await upsert(row);
    if (!up.ok && /column|schema cache/i.test(await up.text())) up = await upsert(core);
    if (!up.ok) return bad(res, 500, 'Không lưu được kết quả: ' + (await up.text()).slice(0, 160));

    if (!alreadySaved && Array.isArray(b.errors) && b.errors.length) {
      const rows = b.errors.slice(0, 80).map(e => ({
        student_id: studentId, error_type: str(e.error_type, 40) || 'other',
        error_content: str(e.error_content, 500), correct_answer: str(e.correct_answer, 500),
        context: str(e.context, 500), source: 'weekly_quiz'
      }));
      const el = await sb('/rest/v1/error_logs', { method: 'POST', headers: { 'content-type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(rows) });
      if (!el.ok) return bad(res, 500, 'Đã lưu kết quả nhưng chưa ghi được lỗi sai: ' + (await el.text()).slice(0, 160));
    }

    return res.status(200).json({ ok: true, already_saved: alreadySaved });
  } catch (e) {
    return bad(res, 500, 'Lỗi máy chủ: ' + e.message);
  }
};
