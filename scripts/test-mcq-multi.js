/* Kiểm thử MCQ chọn nhiều đáp án. Chạy: node scripts/test-mcq-multi.js
   Gồm: logic chấm (mcq-multi.js), giao diện (HTML sinh ra), và các hàm thật trong daily-practice.html (itemOk, givenText, correctText, filledCount). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const MCQ = require('../mcq-multi.js');

/* Item mẫu từ yêu cầu */
const SAMPLE = {
  id: 's5_1',
  q: '19–20. Which TWO optional after-school lessons are new?',
  options: { A: 'swimming', B: 'piano', C: 'acting', D: 'cycling', E: 'theatre sound and lighting' },
  answer: ['B', 'C'],
  multi: 2,
  explain: 'Đáp án B và C.'
};
const SINGLE = { id: 's1_1', q: 'Pick one', options: { A: 'x', B: 'y', C: 'z' }, answer: 'B', explain: 'B' };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ---------- chấm điểm ---------- */
test('chọn đúng, thứ tự khác: ["C","B"] đúng với ["B","C"]', () => {
  assert.equal(MCQ.same('C,B', SAMPLE.answer), true);
  assert.equal(MCQ.same(['C', 'B'], SAMPLE.answer), true);
  assert.equal(MCQ.same('B,C', SAMPLE.answer), true);
});
test('chọn thiếu một đáp án: sai toàn bộ, không có điểm từng phần', () => {
  assert.equal(MCQ.same('B', SAMPLE.answer), false);
  assert.equal(MCQ.same('C', SAMPLE.answer), false);
  assert.equal(MCQ.same('', SAMPLE.answer), false);
});
test('chọn thừa một đáp án: sai toàn bộ', () => {
  assert.equal(MCQ.same('B,C,D', SAMPLE.answer), false);
  assert.equal(MCQ.same('A,B,C', SAMPLE.answer), false);
});
test('chọn sai một trong hai đáp án: sai', () => {
  assert.equal(MCQ.same('B,D', SAMPLE.answer), false);
});
test('chữ hoa và chữ thường đều được chấp nhận', () => {
  assert.equal(MCQ.same('c, b', SAMPLE.answer), true);
  assert.equal(MCQ.same('b', SINGLE.answer), true);
});
test('answer dạng chuỗi "B, C" (tương thích file cũ) cho kết quả giống mảng', () => {
  assert.equal(MCQ.same('C,B', 'B, C'), true);
  assert.equal(MCQ.same('B,C', 'B,C'), true);
  assert.equal(MCQ.same('B', 'B, C'), false);
  assert.deepEqual(MCQ.letters('B, C'), MCQ.letters(['B', 'C']));
});
test('item một đáp án giữ nguyên hành vi', () => {
  assert.equal(MCQ.same('B', SINGLE.answer), true);
  assert.equal(MCQ.same('A', SINGLE.answer), false);
  assert.equal(MCQ.same('', SINGLE.answer), false);
  assert.equal(MCQ.need(SINGLE), 0);
  assert.equal(MCQ.need({ multi: 1 }), 0);
});
test('đáp án rỗng không bao giờ được tính đúng, kể cả khi học sinh bỏ trống', () => {
  assert.equal(MCQ.same('', ''), false);
  assert.equal(MCQ.same(undefined, []), false);
});

/* ---------- chọn đáp án ---------- */
test('đã chọn đủ N thì không chọn thêm được; bỏ một đáp án rồi chọn lại', () => {
  let v = '';
  v = MCQ.toggle(v, 'C', 2); assert.equal(v, 'C');
  v = MCQ.toggle(v, 'B', 2); assert.equal(v, 'B,C');
  assert.equal(MCQ.toggle(v, 'D', 2), 'B,C', 'chọn thêm khi đã đủ phải bị chặn');
  v = MCQ.toggle(v, 'B', 2); assert.equal(v, 'C');
  v = MCQ.toggle(v, 'D', 2); assert.equal(v, 'C,D');
});
test('done: item nhiều đáp án chỉ tính đã làm khi chọn đủ N', () => {
  assert.equal(MCQ.done(SAMPLE, ''), false);
  assert.equal(MCQ.done(SAMPLE, 'B'), false);
  assert.equal(MCQ.done(SAMPLE, 'B,C'), true);
  assert.equal(MCQ.done(SINGLE, 'B'), true);
  assert.equal(MCQ.done(SINGLE, ''), false);
});

/* ---------- giao diện ---------- */
test('multi > 1 hiển thị checkbox, không có radio, và dòng nhắc "Chọn 2 đáp án"', () => {
  const html = MCQ.itemHtml(SAMPLE, '', esc);
  assert.match(html, /Chọn 2 đáp án/);
  assert.equal((html.match(/type="checkbox"/g) || []).length, 5);
  assert.doesNotMatch(html, /type="radio"/);
  assert.doesNotMatch(html, /disabled/, 'chưa chọn gì thì không khóa ô nào');
});
test('chọn 1 trên 2: chưa khóa ô nào', () => {
  const html = MCQ.itemHtml(SAMPLE, 'B', esc);
  assert.equal((html.match(/disabled/g) || []).length, 0);
  assert.equal((html.match(/checked/g) || []).length, 1);
});
test('đã chọn đủ 2: các ô chưa chọn bị khóa, hai ô đã chọn vẫn bỏ được', () => {
  const html = MCQ.itemHtml(SAMPLE, 'B,C', esc);
  assert.equal((html.match(/disabled/g) || []).length, 3);
  assert.equal((html.match(/checked/g) || []).length, 2);
  const boxes = html.match(/<input[^>]*>/g);
  for (const b of boxes) assert.equal(/checked/.test(b), !/disabled/.test(b), 'ô đã chọn không bị khóa, ô chưa chọn thì bị khóa: ' + b);
});
test('item một đáp án vẫn là radio và không có dòng nhắc', () => {
  const html = MCQ.itemHtml(SINGLE, 'B', esc);
  assert.equal((html.match(/type="radio"/g) || []).length, 3);
  assert.doesNotMatch(html, /checkbox|Chọn \d/);
  assert.match(html, /name="s1_1" checked/);
});

/* ---------- mã thật trong daily-practice.html ---------- */
const page = fs.readFileSync(path.join(__dirname, '..', 'daily-practice.html'), 'utf8');
function grab(name) { /* lấy nguyên hàm theo tên bằng cách ghép ngoặc nhọn */
  const i = page.indexOf('function ' + name + '(');
  assert.ok(i >= 0, 'không tìm thấy hàm ' + name);
  let depth = 0, j = page.indexOf('{', i);
  for (let k = j; k < page.length; k++) { if (page[k] === '{') depth++; else if (page[k] === '}' && --depth === 0) return page.slice(i, k + 1); }
  throw new Error('thiếu } của ' + name);
}
function pageCtx(answers, items) {
  const ctx = { MCQ, answers, P: { steps: [{ kind: 'mcq', items }] } };
  vm.createContext(ctx);
  vm.runInContext([grab('itemOk'), grab('closedItems'), grab('givenText'), grab('correctText'), grab('filledCount'), 'function fieldOk(){return false}'].join('\n'), ctx);
  return ctx;
}
test('trang: itemOk, givenText, correctText với item nhiều đáp án', () => {
  const ok = pageCtx({ s5_1: 'C,B' }, [SAMPLE]);
  assert.equal(ok.itemOk(SAMPLE, 'mcq'), true);
  assert.equal(ok.correctText(SAMPLE, 'mcq'), 'B, C', 'đáp án đúng hiển thị dạng "B, C"');
  assert.equal(ok.givenText(SAMPLE, 'mcq'), 'B, C');
  const less = pageCtx({ s5_1: 'B' }, [SAMPLE]);
  assert.equal(less.itemOk(SAMPLE, 'mcq'), false);
  assert.equal(less.givenText(SAMPLE, 'mcq'), 'B');
  const more = pageCtx({ s5_1: 'B,C,D' }, [SAMPLE]);
  assert.equal(more.itemOk(SAMPLE, 'mcq'), false);
  const blank = pageCtx({}, [SAMPLE]);
  assert.equal(blank.givenText(SAMPLE, 'mcq'), '(blank)');
});
test('trang: item một đáp án giữ định dạng cũ "B. y"', () => {
  const c = pageCtx({ s1_1: 'B' }, [SINGLE]);
  assert.equal(c.itemOk(SINGLE, 'mcq'), true);
  assert.equal(c.givenText(SINGLE, 'mcq'), 'B. y');
  assert.equal(c.correctText(SINGLE, 'mcq'), 'B. y');
});
test('trang: answer dạng chuỗi "B, C" của file cũ vẫn chấm đúng', () => {
  const legacy = { ...SAMPLE, answer: 'B, C' };
  const c = pageCtx({ s5_1: 'C,B' }, [legacy]);
  assert.equal(c.itemOk(legacy, 'mcq'), true);
  assert.equal(c.correctText(legacy, 'mcq'), 'B, C');
});
test('trang: filledCount chỉ tính câu nhiều đáp án khi chọn đủ N', () => {
  assert.equal(pageCtx({ s5_1: 'B' }, [SAMPLE]).filledCount(), '0/1 câu');
  assert.equal(pageCtx({ s5_1: 'B,C' }, [SAMPLE]).filledCount(), '1/1 câu');
});
test('trang: phần giải thích dùng chung cho mọi mcq, hiện explain sau khi nộp', () => {
  assert.match(page, /r\.it\.explain \? `<br><span class="ex">\$\{esc\(r\.it\.explain\)\}<\/span>` : ''/);
});
