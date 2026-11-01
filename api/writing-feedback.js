/* AI chấm bài viết ngắn của học sinh (Pre-IELTS, Intermediate). Trả lời tiếng Việt, ví dụ tiếng Anh.
   Biến môi trường: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY (đã có)
   Tuỳ chọn: CLAUDE_MODEL, AI_CLASSES (mặc định IELTS13,IELTS14), WRITING_LIMIT (số bài viết AI chấm mỗi ngày, mặc định 4) */
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-5-5';
const AI_CLASSES = (process.env.AI_CLASSES || 'IELTS13,IELTS14').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
const LIMIT = Math.max(1, parseInt(process.env.WRITING_LIMIT || '4', 10) || 4);

const SB_URL = () => (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_HEAD = () => {
  const k = process.env.SUPABASE_SERVICE_KEY || '';
  return k.startsWith('sb_') ? { apikey: k } : { apikey: k, Authorization: 'Bearer ' + k };
};
const sb = (path, opts) => fetch(SB_URL() + path, { ...opts, headers: { ...SB_HEAD(), ...(opts && opts.headers) } });
const bad = (res, code, msg) => res.status(code).json({ ok: false, error: msg });
const wordCount = t => (String(t).match(/[A-Za-z0-9’'-]+/g) || []).length;

const SYSTEM = `Bạn là giáo viên IELTS Writing thân thiện, chấm bài viết ngắn của học sinh Việt Nam do thầy Nam dạy. Nhận xét bằng tiếng Việt, ngắn gọn, cụ thể, ấm áp. Câu ví dụ, lỗi trích dẫn và bản sửa giữ bằng tiếng Anh.
Quy tắc:
- Chấm theo trình độ lớp học sinh (được cho trong yêu cầu). Với Pre-IELTS (khoảng A2 đến B1) đừng chê vì thiếu cấu trúc nâng cao; chỉ yêu cầu những gì lớp đã học.
- Chỉ nêu lỗi có THẬT trong bài. Trích đúng nguyên văn đoạn có lỗi (trường "quote"). Không bịa lỗi, không bịa nội dung học sinh chưa viết.
- Tối đa 3 lỗi quan trọng nhất (ưu tiên lỗi lặp lại hoặc lỗi chặn người đọc hiểu), 1 điểm khen cụ thể, 1 việc luyện tiếp.
- Điểm band ước lượng theo 4 tiêu chí TA, CC, LR, GRA (thang 0 đến 9, bước 0.5) và overall; phải thận trọng, chưa phải điểm chính thức.
- Nếu bài quá ngắn hoặc lạc đề, nói rõ điều đó trong "summary" và cho band thấp tương ứng.
- Trong nội dung các chuỗi JSON TUYỆT ĐỐI không dùng dấu nháy kép ("); khi trích dẫn hãy dùng nháy đơn ('). Không xuống dòng bên trong chuỗi.
- Chỉ trả về MỘT đối tượng JSON, không thêm chữ nào bên ngoài, đúng dạng:
{"band":{"ta":0,"cc":0,"lr":0,"gra":0,"overall":0},"summary":"...","praise":"...","fixes":[{"quote":"...","problem":"...","correction":"...","rule":"..."}],"checklist":[{"item":"...","ok":true}],"rewrite":"một câu mẫu viết lại hay hơn dựa trên ý của học sinh","next_step":"..."}
Trường "checklist" liệt kê tiêu chí lớp đã học (nếu được cung cấp trong yêu cầu), mỗi tiêu chí ok đúng hoặc sai.`;

async function askClaude(user, retry) {
  try { return await askClaudeOnce(user + (retry ? '\n\nLưu ý: lần trước JSON bị lỗi cú pháp. Không dùng dấu nháy kép bên trong giá trị chuỗi, chỉ dùng nháy đơn.' : '')); }
  catch (e) { if (!retry && /JSON/i.test(String(e.message))) return askClaude(user, true); throw e; }
}
async function askClaudeOnce(user) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 1600, system: SYSTEM, messages: [{ role: 'user', content: user }] })
  });
  if (!r.ok) throw new Error('Claude: ' + r.status + ' ' + (await r.text()).slice(0, 300));
  const j = await r.json();
  const text = (j.content || []).map(c => c.text || '').join('');
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('Claude không trả về JSON');
  return parseClaudeJson(m[0]);
}

/* Claude đôi khi thiếu dấu phẩy hoặc để dấu phẩy thừa: thử sửa trước khi báo lỗi */
function parseClaudeJson(s) {
  try { return JSON.parse(s); } catch (e) {}
  const fixed = s.replace(/,\s*([}\]])/g, '$1').replace(/([}\]"0-9el])\s*\n\s*(?=["{[])/g, '$1,\n');
  try { return JSON.parse(fixed); } catch (e) { throw new Error('Phản hồi AI bị lỗi định dạng, em thử lại hoặc báo thầy'); }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return bad(res, 405, 'POST only');
  for (const k of ['ANTHROPIC_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY'])
    if (!process.env[k]) return bad(res, 500, 'Thiếu biến môi trường ' + k + ' trên Vercel');

  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const studentId = String(b.student_id || '');
    if (!/^[0-9a-f-]{36}$/i.test(studentId)) return bad(res, 400, 'student_id không hợp lệ');
    const st = await (await sb('/rest/v1/students?id=eq.' + studentId + '&select=id,full_name,class_code')).json();
    if (!Array.isArray(st)) return bad(res, 500, 'Supabase từ chối khóa dịch vụ: ' + String((st && (st.message || st.hint)) || '').slice(0, 160));
    if (!st.length) return bad(res, 403, 'Không tìm thấy học sinh');
    if (!AI_CLASSES.includes(String(st[0].class_code).toUpperCase())) return bad(res, 403, 'Lớp của em chưa mở tính năng AI chấm bài viết. Thầy sẽ nhận xét trực tiếp.');

    const text = String(b.text || '').trim(), prompt = String(b.prompt || '').slice(0, 1500);
    const practiceId = String(b.practice_id || '').slice(0, 80), itemId = String(b.item_id || '').slice(0, 40), date = /^\d{4}-\d{2}-\d{2}$/.test(b.date || '') ? b.date : new Date().toISOString().slice(0, 10);
    const n = wordCount(text);
    if (n < 5) return bad(res, 422, 'Bài viết còn quá ngắn để chấm (dưới 5 từ).');
    if (text.length > 3000) return bad(res, 413, 'Bài viết quá dài (tối đa khoảng 450 từ).');

    /* Giới hạn mỗi ngày (giờ Việt Nam). Chấm lại cùng một câu trong cùng bài thì không tính thêm. */
    const vn = new Date(Date.now() + 7 * 3600e3), start = new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate()) - 7 * 3600e3).toISOString();
    const cnt = await sb('/rest/v1/writing_feedback?student_id=eq.' + studentId + '&created_at=gte.' + encodeURIComponent(start) + '&select=id', { headers: { Prefer: 'count=exact', Range: '0-0' } });
    const used = parseInt((cnt.headers.get('content-range') || '*/0').split('/')[1], 10) || 0;
    const same = await (await sb('/rest/v1/writing_feedback?student_id=eq.' + studentId + '&practice_id=eq.' + encodeURIComponent(practiceId) + '&practice_date=eq.' + date + '&item_id=eq.' + encodeURIComponent(itemId) + '&select=id')).json();
    if (used >= LIMIT && !(Array.isArray(same) && same.length)) return bad(res, 429, `Em đã dùng hết ${LIMIT} lượt AI chấm viết hôm nay. Mai em quay lại nhé.`);

    const level = String(b.level || 'Pre-IELTS (A2 đến B1)').slice(0, 60);
    const crit = Array.isArray(b.criteria) ? b.criteria.slice(0, 8).map(x => '- ' + String(x).slice(0, 140)).join('\n') : '';
    const user = `Trình độ lớp: ${level}
Loại bài: ${String(b.task_type || 'bài viết ngắn').slice(0, 60)}
Số từ học sinh viết: ${n}${b.min_words ? ' (yêu cầu khoảng ' + parseInt(b.min_words, 10) + ' từ)' : ''}
Đề bài: ${prompt || '(không có)'}
${crit ? 'Tiêu chí lớp đã học (đưa vào checklist):\n' + crit + '\n' : ''}
Bài viết của học sinh:
"""
${text}
"""`;
    const fb = await askClaude(user);
    fb.word_count = n;
    const overall = fb.band && Number(fb.band.overall);

    await sb('/rest/v1/writing_feedback?on_conflict=student_id,practice_id,practice_date,item_id', {
      method: 'POST', headers: { 'content-type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ student_id: studentId, practice_id: practiceId, practice_date: date, item_id: itemId, text, feedback: fb, overall: isFinite(overall) ? overall : null, created_at: new Date().toISOString() })
    });
    res.status(200).json({ ok: true, feedback: fb });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e).slice(0, 300) });
  }
};
