/* Tiến độ Vocab Quest của học sinh (XP, điểm, các ngày đã học) qua máy chủ.
   Máy chủ kiểm tra học sinh và dữ liệu trước khi đọc hoặc ghi bằng khóa dịch vụ.
   Biến môi trường: SUPABASE_URL, SUPABASE_SERVICE_KEY (đã có) */

const SB_URL = () => (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_HEAD = () => {
  const k = process.env.SUPABASE_SERVICE_KEY || '';
  return k.startsWith('sb_') ? { apikey: k } : { apikey: k, Authorization: 'Bearer ' + k };
};
const sb = (path, opts) => fetch(SB_URL() + path, { ...opts, headers: { ...SB_HEAD(), ...(opts && opts.headers) } });
const bad = (res, code, msg) => res.status(code).json({ ok: false, error: msg });
const isInt = (v, max) => Number.isInteger(v) && v >= 0 && v <= max;
const XP_PER_LV = 120; /* giữ đúng với vq-build/build-vq.js */

/* POST đọc từ thân yêu cầu, GET đọc từ tham số trên đường dẫn */
const params = req => req.method === 'POST'
  ? (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}))
  : Object.fromEntries(new URL(req.url, 'http://localhost').searchParams);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET' && req.method !== 'POST') return bad(res, 405, 'GET hoặc POST thôi');
  for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY'])
    if (!process.env[k]) return bad(res, 500, 'Thiếu biến môi trường ' + k + ' trên Vercel');

  try {
    const b = params(req);

    const studentId = String(b.student_id || '');
    if (!/^[0-9a-f-]{36}$/i.test(studentId)) return bad(res, 400, 'student_id không hợp lệ');
    const st = await (await sb('/rest/v1/students?id=eq.' + studentId + '&select=id')).json();
    if (!Array.isArray(st)) return bad(res, 500, 'Supabase từ chối khóa dịch vụ');
    if (!st.length) return bad(res, 403, 'Không tìm thấy học sinh');

    const gameId = String(b.game_id || '').slice(0, 60);
    if (!gameId) return bad(res, 400, 'Thiếu game_id');
    const key = `student_id=eq.${studentId}&game_id=eq.${encodeURIComponent(gameId)}`;

    if (req.method === 'GET') {
      const rows = await (await sb('/rest/v1/vocab_progress?select=prog,xp&' + key)).json();
      return res.status(200).json({ ok: true, data: Array.isArray(rows) && rows.length ? rows[0] : null });
    }

    const prog = b.prog;
    if (!prog || typeof prog !== 'object' || Array.isArray(prog)) return bad(res, 400, 'prog không hợp lệ');
    if (JSON.stringify(prog).length > 300000) return bad(res, 400, 'Dữ liệu tiến độ quá lớn');
    const xp = isInt(b.xp, 10000000) ? b.xp : 0;
    const points = isInt(b.points, 10000000) ? b.points : 0;
    const daysDone = Object.values(prog.days || {}).filter(d => d && d.fin).length;

    const up = await sb('/rest/v1/vocab_progress?on_conflict=student_id,game_id', {
      method: 'POST', headers: { 'content-type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ student_id: studentId, game_id: gameId, xp, points, level: Math.floor(xp / XP_PER_LV) + 1, days_done: daysDone, prog, updated_at: new Date().toISOString() })
    });
    if (!up.ok) return bad(res, 500, 'Không lưu được tiến độ: ' + (await up.text()).slice(0, 160));
    return res.status(200).json({ ok: true });
  } catch (e) {
    return bad(res, 500, 'Lỗi máy chủ: ' + e.message);
  }
};
