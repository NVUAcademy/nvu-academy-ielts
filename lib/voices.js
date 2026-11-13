/* Nhiều bản ghi âm trong một bài Daily Practice.
   Bài có từ 2 bước ghi âm trở lên: mỗi bước một bản ghi, lưu trong daily_scores.answers._voices (không đổi cấu trúc bảng):
     { "<mã bước>": { "p": "daily/<student_id>/<file>", "t": "<tên bước>" }, ... }
   Cột voice_path vẫn là một bản ghi "chính" (bản ghi của bước ghi âm đứng cuối) để các chỗ cũ tiếp tục chạy.
   Bài chỉ có một bước ghi âm thì không dùng _voices, mọi thứ như trước. */
const STEP_ID = /^[A-Za-z0-9_.-]{1,40}$/;
const MAX_VOICES = 8;
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);

/* Làm sạch phần voices học sinh gửi lên. Đường dẫn phải nằm trong thư mục của chính học sinh đó.
   Trả về { voices } hoặc { error }. */
function cleanVoices(input, studentId) {
  if (input == null) return { voices: {} };
  if (!isObj(input)) return { error: 'voices không hợp lệ' };
  const keys = Object.keys(input);
  if (keys.length > MAX_VOICES) return { error: 'Quá nhiều bản ghi trong một bài' };
  const out = {};
  for (const k of keys) {
    if (!STEP_ID.test(k)) return { error: 'Mã bước ghi âm không hợp lệ' };
    const v = input[k], p = isObj(v) ? String(v.p || '') : '';
    if (!p || p.length > 200 || p.includes('..') || !p.startsWith('daily/' + studentId + '/')) return { error: 'voices: đường dẫn không thuộc học sinh này' };
    out[k] = { p, t: isObj(v) ? String(v.t || '').slice(0, 80) : '' };
  }
  return { voices: out };
}

/* Gộp bản ghi mới vào bản ghi đã có: cùng một bước thì bản mới thay bản cũ, bước khác thì giữ nguyên */
function mergeVoices(existing, incoming) {
  return { ...(isObj(existing) ? existing : {}), ...(isObj(incoming) ? incoming : {}) };
}

module.exports = { cleanVoices, mergeVoices, MAX_VOICES };
