/* Kiểm tra mọi file daily-*.json của tất cả các lớp trước khi đưa lên web.
   Chạy: node scripts/check-daily.js   (báo lỗi và thoát với mã 1 nếu có bài sai)
   Bắt các lỗi đã gặp: bài đọc thiếu đoạn văn, đoạn văn bị đặt nhầm thành câu hỏi, đáp án trắc nghiệm không có trong lựa chọn,
   câu điền thiếu đáp án, và daily-index.json trỏ tới file không tồn tại. */

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const MCQ = require('../mcq-multi.js');

const errors = [];
const err = (file, where, msg) => errors.push(file + ' · ' + where + ': ' + msg);

/* Đoạn văn có thể nằm ở trường passage, context, hoặc sau "Text:" / "Đoạn văn:" trong instructions (trang daily-practice hiện được cả ba) */
const passageOf = st => st.passage || st.passage_source || (Array.isArray(st.context) ? st.context.join(' ') : st.context) ||
  (String(st.instructions || '').match(/\s*(?:Text|Đoạn văn):\s*([\s\S]+)$/i) || [])[1] || '';
const needsPassage = st => (st.kind === 'fill' || st.kind === 'mcq') && /read the text|reading/i.test((st.title || '') + ' ' + (st.instructions || ''));

const files = fs.readdirSync(ROOT).filter(f => /^daily-.*\.json$/.test(f) && f !== 'daily-index.json');
for (const f of files) {
  let j;
  try { j = JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/^\uFEFF/, '')); }
  catch (e) { err(f, 'file', 'JSON lỗi: ' + e.message); continue; }
  for (const st of j.steps || []) {
    const where = st.title || st.id;
    if (needsPassage(st)) {
      const text = passageOf(st);
      if (!text) err(f, where, 'bài đọc không có đoạn văn (thêm "Text: ..." vào instructions hoặc trường passage)');
      else if (!st.passage_source && text.split(/\s+/).length < 15) err(f, where, 'đoạn văn quá ngắn (' + text.split(/\s+/).length + ' từ), kiểm tra lại');
    }
    for (const it of st.items || []) {
      const label = it.q || it.label || it.id;
      if (/^\s*Text:/i.test(label)) err(f, where, 'đoạn văn bị đặt nhầm thành câu hỏi (' + it.id + '), chuyển lên instructions');
      if (st.kind === 'mcq' && it.options) {
        /* answer: "B" (một đáp án) hoặc ["B","C"] / "B, C" kèm "multi": 2 (chọn nhiều). Số multi phải khớp số đáp án. */
        const ans = MCQ.letters(it.answer), n = MCQ.need(it);
        if (!ans.length) err(f, where, 'câu mcq không có đáp án (' + it.id + ')');
        for (const k of ans) if (!(k in it.options)) err(f, where, 'đáp án "' + k + '" không có trong lựa chọn (' + it.id + ')');
        if ('multi' in it && !(Number.isInteger(it.multi) && it.multi >= 1)) err(f, where, '"multi" phải là số nguyên từ 1 trở lên (' + it.id + ')');
        if (n && ans.length !== n) err(f, where, '"multi": ' + n + ' nhưng answer có ' + ans.length + ' đáp án (' + it.id + ')');
        if (!n && ans.length > 1) err(f, where, 'answer có ' + ans.length + ' đáp án nhưng thiếu "multi": ' + ans.length + ' (' + it.id + ')');
        if (n && n >= Object.keys(it.options).length) err(f, where, '"multi": ' + n + ' không nhỏ hơn số lựa chọn (' + it.id + ')');
      }
      if (st.kind === 'fill' && (!it.fields || !it.fields.length || it.fields.some(x => !x || !String(x.answer || '').trim()))) err(f, where, 'câu điền thiếu đáp án (' + it.id + ')');
    }
  }
}

try {
  const idx = JSON.parse(fs.readFileSync(path.join(ROOT, 'daily-index.json'), 'utf8').replace(/^\uFEFF/, ''));
  for (const e of Array.isArray(idx) ? idx : idx.items || []) if (e.file && !fs.existsSync(path.join(ROOT, e.file))) err('daily-index.json', e.id || e.file, 'trỏ tới file không tồn tại ' + e.file);
} catch (e) { err('daily-index.json', 'file', 'JSON lỗi: ' + e.message); }

console.log('Đã kiểm tra ' + files.length + ' file daily.');
if (errors.length) { console.log('Có ' + errors.length + ' lỗi:\n- ' + errors.join('\n- ')); process.exit(1); }
console.log('Không có lỗi.');
