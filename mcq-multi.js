/* MCQ chọn nhiều đáp án (multi-answer) cho Daily Practice. Dùng chung cho daily-practice.html, teacher-dashboard.html và scripts/test-mcq-multi.js.

   Schema của một item mcq:
     { "id": "s5_1", "q": "...", "options": {"A": "...", "B": "..."}, "answer": "B" }              một đáp án (như cũ)
     { "id": "s5_2", "q": "...", "options": {...}, "answer": ["B", "C"], "multi": 2 }            hai đáp án
   `answer` chấp nhận mảng ["B","C"] hoặc chuỗi "B, C" / "B,C" (tương thích file cũ). Chữ hoa hoặc thường đều được.
   Đáp án của học sinh luôn lưu dạng CHUỖI chữ cái đã sắp xếp, ví dụ "B,C", để bản nháp, API nộp bài và trang giáo viên không phải đổi.
   Chấm: so sánh tập hợp, đúng toàn bộ hoặc sai toàn bộ, không cho điểm từng phần.
   Quiz tuần (weekly-quiz.html) dùng cùng quy ước: câu {"type": "mcq", "answer": ["B","C"], "multi": 2}. */
(function (root) {
  /* "B, C" | ["c","B"] | "b" -> ["B","C"]: chữ hoa, không trùng, đã sắp xếp */
  const letters = v => [...new Set((Array.isArray(v) ? v.join(',') : String(v == null ? '' : v)).toUpperCase().split(/[^A-Z]+/).filter(Boolean))].sort();
  /* Số đáp án cần chọn; 0 nghĩa là item một đáp án (multi vắng mặt hoặc nhỏ hơn 2) */
  const need = it => { const n = parseInt(it && it.multi, 10); return n > 1 ? n : 0; };
  /* Đúng khi hai tập chữ cái bằng nhau (không theo thứ tự) và đáp án không rỗng */
  const same = (given, answer) => { const g = letters(given), a = letters(answer); return a.length > 0 && g.length === a.length && g.every((l, i) => l === a[i]); };
  /* Đã trả lời xong chưa: item nhiều đáp án phải chọn đủ N, item một đáp án chỉ cần có lựa chọn */
  const done = (it, given) => need(it) ? letters(given).length === need(it) : !!String(given || '').trim();
  /* Bật hoặc tắt một đáp án. Đã đủ N thì không thêm được nữa (phải bỏ một đáp án trước). Trả về chuỗi mới dạng "B,C" */
  const toggle = (given, key, n) => {
    const sel = letters(given), k = String(key).toUpperCase(), i = sel.indexOf(k);
    if (i >= 0) sel.splice(i, 1); else if (sel.length < n) sel.push(k);
    return sel.sort().join(',');
  };
  /* Chữ hiển thị đáp án của học sinh và đáp án đúng cho item nhiều đáp án: "B, C" */
  const text = v => letters(v).join(', ');

  /* Dòng nhắc "Chọn N đáp án" cho item nhiều đáp án (rỗng với item một đáp án) */
  const hintHtml = it => need(it) ? `<div class="sub" style="margin:-2px 0 8px;font-size:15px">Chọn ${need(it)} đáp án</div>` : '';

  /* Các ô lựa chọn: item một đáp án giữ nguyên giao diện radio cũ; item nhiều đáp án là checkbox, đủ N thì khóa ô chưa chọn.
     esc là hàm escape HTML của trang. Dùng chung cho Daily Practice (itemHtml) và quiz tuần (weekly-quiz.html). */
  function optionsHtml(it, given, esc) {
    const n = need(it), entries = Object.entries(it.options);
    if (!n) {
      return entries.map(([k, t]) =>
        `<label class="opt ${given === k ? 'sel' : ''}"><input type="radio" name="${it.id}" ${given === k ? 'checked' : ''} onchange="setAns('${it.id}','${k}',true)"><span><b>${k}.</b> ${esc(t)}</span></label>`).join('');
    }
    const sel = letters(given), full = sel.length >= n;
    return entries.map(([k, t]) => {
      const on = sel.includes(k.toUpperCase()), lock = full && !on;
      return `<label class="opt ${on ? 'sel' : ''}"${lock ? ' style="opacity:.5;cursor:not-allowed"' : ''}><input type="checkbox" name="${it.id}" ${on ? 'checked' : ''} ${lock ? 'disabled' : ''} onchange="toggleMulti('${it.id}','${k}',${n})"><span><b>${k}.</b> ${esc(t)}</span></label>`;
    }).join('');
  }

  /* HTML của một câu mcq trong Daily Practice */
  const itemHtml = (it, given, esc) => `<div class="q"><div class="qt">${esc(it.q)}</div>${hintHtml(it)}${optionsHtml(it, given, esc)}</div>`;

  const api = { letters, need, same, done, toggle, text, hintHtml, optionsHtml, itemHtml };
  root.MCQ = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
