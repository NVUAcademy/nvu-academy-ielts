/* Ghi điểm Daily Practice của học sinh qua máy chủ (thay cho việc ghi thẳng bằng khóa công khai).
   Máy chủ kiểm tra học sinh, ngày, điểm và đường dẫn voice trước khi lưu bằng khóa dịch vụ.
   Biến môi trường: SUPABASE_URL, SUPABASE_SERVICE_KEY (đã có) */

const SB_URL = () => (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_HEAD = () => {
  const k = process.env.SUPABASE_SERVICE_KEY || '';
  return k.startsWith('sb_') ? { apikey: k } : { apikey: k, Authorization: 'Bearer ' + k };
};
const sb = (path, opts) => fetch(SB_URL() + path, { ...opts, headers: { ...SB_HEAD(), ...(opts && opts.headers) } });
const bad = (res, code, msg) => res.status(code).json({ ok: false, error: msg });
const isInt = v => Number.isInteger(v) && v >= 0;
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

    const practiceDate = String(b.practice_date || '');
    if (!dateOk(practiceDate)) return bad(res, 400, 'Ngày bài tập không hợp lệ');
    const section = str(b.section, 40);
    const practiceId = str(b.practice_id, 80);
    const maxScore = b.max_score;
    const score = b.score;
    if (!section || !practiceId) return bad(res, 400, 'Thiếu thông tin bài tập');
    if (!isInt(maxScore) || maxScore < 1 || maxScore > 60) return bad(res, 400, 'max_score không hợp lệ');
    if (!isInt(score) || score > maxScore) return bad(res, 400, 'score không hợp lệ');

    /* Đường dẫn voice phải nằm trong thư mục của chính học sinh này */
    let voicePath = null;
    if (b.voice_path != null && b.voice_path !== '') {
      voicePath = str(b.voice_path, 200);
      if (!voicePath.startsWith('daily/' + studentId + '/')) return bad(res, 403, 'voice_path không thuộc học sinh này');
    }
    const answers = b.answers && typeof b.answers === 'object' && !Array.isArray(b.answers) ? b.answers : {};
    if (JSON.stringify(answers).length > 50000) return bad(res, 400, 'Bài làm quá dài');

    /* Đã có bài này chưa: nếu có thì không ghi lỗi sai lần thứ hai */
    const existing = await (await sb(`/rest/v1/daily_scores?select=id&student_id=eq.${studentId}&practice_date=eq.${practiceDate}&section=eq.${encodeURIComponent(section)}`)).json();
    const alreadySaved = Array.isArray(existing) && existing.length > 0;

    const core = {
      student_id: studentId, practice_date: practiceDate, day_of_week: str(b.day_of_week, 20), section,
      score, max_score: maxScore, time_taken_seconds: isInt(b.time_taken_seconds) ? b.time_taken_seconds : null
    };
    const row = { ...core, answers, practice_id: practiceId, voice_path: voicePath };
    let up = await sb('/rest/v1/daily_scores?on_conflict=student_id,practice_date,section', {
      method: 'POST', headers: { 'content-type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(row)
    });
    if (!up.ok && /column|schema cache/i.test(await up.text())) {
      up = await sb('/rest/v1/daily_scores?on_conflict=student_id,practice_date,section', {
        method: 'POST', headers: { 'content-type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(core)
      });
    }
    if (!up.ok) return bad(res, 500, 'Không lưu được điểm: ' + (await up.text()).slice(0, 160));

    if (!alreadySaved && Array.isArray(b.errors) && b.errors.length) {
      const rows = b.errors.slice(0, 60).map(e => ({
        student_id: studentId, error_type: str(e.error_type, 40) || 'listening',
        error_content: str(e.error_content, 500), correct_answer: str(e.correct_answer, 500),
        context: str(e.context, 500), source: 'daily_practice', practice_date: practiceDate
      }));
      const el = await sb('/rest/v1/error_logs', { method: 'POST', headers: { 'content-type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(rows) });
      if (!el.ok) return bad(res, 500, 'Đã lưu điểm nhưng chưa ghi được lỗi sai: ' + (await el.text()).slice(0, 160));
    }

    return res.status(200).json({ ok: true, already_saved: alreadySaved });
  } catch (e) {
    return bad(res, 500, 'Lỗi máy chủ: ' + e.message);
  }
};
