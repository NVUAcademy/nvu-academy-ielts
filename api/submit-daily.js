/* Ghi điểm Daily Practice của học sinh qua máy chủ (thay cho việc ghi thẳng bằng khóa công khai).
   Máy chủ kiểm tra học sinh, ngày, điểm và đường dẫn voice trước khi lưu bằng khóa dịch vụ.
   Biến môi trường: SUPABASE_URL, SUPABASE_SERVICE_KEY (đã có) */

const SB_URL = () => (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_HEAD = () => {
  const k = process.env.SUPABASE_SERVICE_KEY || '';
  return k.startsWith('sb_') ? { apikey: k } : { apikey: k, Authorization: 'Bearer ' + k };
};
const sb = (path, opts) => fetch(SB_URL() + path, { ...opts, headers: { ...SB_HEAD(), ...(opts && opts.headers) } });
const { cleanVoices, mergeVoices } = require('../lib/voices.js');
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

    /* Ghi âm lại: chỉ thay file voice của bài đã nộp, giữ nguyên điểm, lỗi và nhận xét.
       voice_path: bản ghi chính (cột voice_path); voices: bản ghi theo từng bước ghi âm (bài có nhiều bước ghi âm, lưu trong answers._voices). Cần ít nhất một trong hai. */
    if (b.voice_only === true) {
      const pd = String(b.practice_date || ''), pid = str(b.practice_id, 80), sec = str(b.section, 40), vp = str(b.voice_path, 200);
      if (!dateOk(pd) || !pid || !sec) return bad(res, 400, 'Thiếu thông tin bài tập');
      const cv = cleanVoices(b.voices, studentId);
      if (cv.error) return bad(res, 403, cv.error);
      const hasVoices = Object.keys(cv.voices).length > 0;
      if (!vp && !hasVoices) return bad(res, 400, 'Thiếu bản ghi âm');
      if (vp && !vp.startsWith('daily/' + studentId + '/')) return bad(res, 403, 'voice_path không thuộc học sinh này');
      const where = `student_id=eq.${studentId}&practice_date=eq.${pd}&section=eq.${encodeURIComponent(sec)}&practice_id=eq.${encodeURIComponent(pid)}`;
      const patch = {};
      if (vp) patch.voice_path = vp;
      if (hasVoices) {
        const cur = await (await sb(`/rest/v1/daily_scores?select=id,answers&${where}`)).json().catch(() => []);
        if (!Array.isArray(cur) || !cur.length) return bad(res, 404, 'Chưa có bài nộp để ghi âm lại');
        const a0 = cur[0].answers && typeof cur[0].answers === 'object' ? cur[0].answers : {};
        patch.answers = { ...a0, _voices: mergeVoices(a0._voices, cv.voices) };
      }
      const up = await sb(`/rest/v1/daily_scores?${where}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(patch)
      });
      const rows = await up.json().catch(() => []);
      if (!up.ok || !Array.isArray(rows) || !rows.length) return bad(res, 404, 'Chưa có bài nộp để ghi âm lại');
      return res.status(200).json({ ok: true });
    }

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
    /* max_score 0: bài không có phần chấm tự động (chỉ viết và ghi âm, như bài Sunday Class day) */
    if (!isInt(maxScore) || maxScore > 60) return bad(res, 400, 'max_score không hợp lệ');
    if (!isInt(score) || score > maxScore) return bad(res, 400, 'score không hợp lệ');

    /* Đường dẫn voice phải nằm trong thư mục của chính học sinh này */
    let voicePath = null;
    if (b.voice_path != null && b.voice_path !== '') {
      voicePath = str(b.voice_path, 200);
      if (!voicePath.startsWith('daily/' + studentId + '/')) return bad(res, 403, 'voice_path không thuộc học sinh này');
    }
    const answers = b.answers && typeof b.answers === 'object' && !Array.isArray(b.answers) ? b.answers : {};
    if (JSON.stringify(answers).length > 50000) return bad(res, 400, 'Bài làm quá dài');
    const cv = cleanVoices(b.voices, studentId);
    if (cv.error) return bad(res, 403, cv.error);
    delete answers._voices; /* học sinh không tự ghi được trường này, chỉ nhận qua voices đã kiểm tra */

    /* Đã có bài này chưa: nếu có thì không ghi lỗi sai lần thứ hai */
    const existing = await (await sb(`/rest/v1/daily_scores?select=id,answers&student_id=eq.${studentId}&practice_date=eq.${practiceDate}&section=eq.${encodeURIComponent(section)}`)).json();
    const alreadySaved = Array.isArray(existing) && existing.length > 0;
    /* Lần làm thứ mấy: lưu trong answers._attempts (không đổi cấu trúc bảng) */
    const attempt = alreadySaved ? ((Number(existing[0].answers && existing[0].answers._attempts) || 1) + 1) : 1;

    const core = {
      student_id: studentId, practice_date: practiceDate, day_of_week: str(b.day_of_week, 20), section,
      score, max_score: maxScore, time_taken_seconds: isInt(b.time_taken_seconds) ? b.time_taken_seconds : null
    };
    answers._attempts = attempt;
    /* Bản ghi theo bước: giữ các bản ghi cũ, bước nào có bản mới thì thay (làm lại không ghi âm thì giữ nguyên) */
    const merged = mergeVoices(alreadySaved && existing[0].answers ? existing[0].answers._voices : null, cv.voices);
    if (Object.keys(merged).length) answers._voices = merged;
    const row = { ...core, answers, practice_id: practiceId };
    if (voicePath) row.voice_path = voicePath; /* làm lại không có ghi âm mới thì giữ ghi âm cũ */
    let up = await sb('/rest/v1/daily_scores?on_conflict=student_id,practice_date,section', {
      method: 'POST', headers: { 'content-type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(row)
    });
    if (!up.ok && /column|schema cache/i.test(await up.text())) {
      up = await sb('/rest/v1/daily_scores?on_conflict=student_id,practice_date,section', {
        method: 'POST', headers: { 'content-type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(core)
      });
    }
    if (!up.ok) return bad(res, 500, 'Không lưu được điểm: ' + (await up.text()).slice(0, 160));

    /* Lần đầu ghi đủ lỗi; từ lần thứ 3 trở đi ghi lại các câu còn sai để học sinh luyện thêm */
    if ((attempt === 1 || attempt >= 3) && Array.isArray(b.errors) && b.errors.length) {
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
