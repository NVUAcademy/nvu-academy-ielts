/* Tạo sẵn âm thanh Azure (giọng nữ) cho toàn bộ từ và câu ví dụ của Vocab Quest.
   Giáo viên chạy một lần cho mỗi bộ từ:
     node vq-build/prefetch-audio.js https://nvu-academy-ielts.vercel.app <student_uuid_của_tester>
   File đã tạo được lưu trên máy chủ, học sinh nghe sau đó không phải chờ.
   Script chỉ đọc file trong repo, không ghi gì vào database ngoài việc lưu file âm thanh qua API. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const [base, studentId] = process.argv.slice(2);
if (!base || !/^[0-9a-f-]{36}$/i.test(studentId || '')) {
  console.error('Cách dùng: node vq-build/prefetch-audio.js <địa chỉ trang> <student_uuid>');
  process.exit(1);
}
const root = path.join(__dirname, '..');
const items = new Set();

// 1) Pre-IELTS và Intermediate: vq-build/vq-data.js (mỗi dòng: word|nghĩa|ví dụ|...)
const dataSrc = fs.readFileSync(path.join(__dirname, 'vq-data.js'), 'utf8');
const sandbox = { module: { exports: {} } };
vm.runInNewContext(dataSrc, sandbox);
const { PRE = [], INTER = [] } = sandbox.module.exports;
for (const list of [PRE, INTER]) for (const line of list) {
  const [word, , example] = String(line).split('|');
  if (word) items.add(word.trim()); if (example) items.add(example.trim());
}

// 2) Foundation: cấu hình CFG trong Foundation_Vocab_Quest.html (tsv: Word \t Meaning \t Example ...)
const fh = fs.readFileSync(path.join(root, 'Foundation_Vocab_Quest.html'), 'utf8');
const cfg = JSON.parse(fh.match(/const CFG = (\{[\s\S]*?\});\n/)[1]);
for (const w of cfg.weeks) for (const row of w.tsv.split('\n').slice(1)) {
  const cols = row.split('\t');
  if (cols[0]) items.add(cols[0].trim());
  if (cols[2]) items.add(cols[2].trim());
}

const list = [...items].filter(Boolean);
console.log('Số mục cần tạo âm thanh:', list.length);
(async () => {
  let ok = 0, fail = 0;
  for (const text of list) {
    try {
      const r = await fetch(base.replace(/\/$/, '') + '/api/listening-audio', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, provider: 'azure', lines: [{ speaker: 'A', text }] })
      });
      const j = await r.json();
      if (j.ok) ok++; else { fail++; console.log('Lỗi:', text.slice(0, 40), j.error); }
    } catch (e) { fail++; console.log('Lỗi mạng:', text.slice(0, 40), e.message); }
    await new Promise(res => setTimeout(res, 400));
  }
  console.log('Xong. Thành công:', ok, '· Lỗi:', fail);
})();
