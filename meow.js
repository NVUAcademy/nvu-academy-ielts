/* Tiền Meow: bộ máy tính dùng chung (theo sheet "Cách tính Meow" của thầy Nam)
   Trạng thái mỗi ngày: du (Đủ), muon (Muộn), nua (Nửa), bu (Bù), khong (Không nộp). Ô trống = chưa chấm. */
(function (g) {
  var ST = { du: 'Đủ', muon: 'Muộn', nua: 'Nửa', bu: 'Bù', khong: 'Không nộp' };
  var FULL_OK = { du: 1, muon: 1, nua: 1, bu: 1 };      /* trạng thái được tính là "đã nộp" khi xét thưởng đủ tuần */
  var STREAK_PLUS = { du: 1, muon: 1, nua: 1 };        /* cộng chuỗi; Bù và Không nộp đưa chuỗi về 0; ô trống không đổi */

  function pad(n) { return String(n).padStart(2, '0'); }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function dow(s) { return new Date(s + 'T00:00:00').getDay(); }
  function type(s) { var d = dow(s); return (d === 1 || d === 6) ? 'hoc' : 'on'; }   /* Thứ 2, Thứ 7 là ngày học */
  function base(s) { return type(s) === 'hoc' ? 10 : 20; }
  function addDays(s, n) { var d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return iso(d); }
  function weekStart(s) { var d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return iso(d); }

  /* Gia hạn riêng một ngày cho TẤT CẢ các lớp (giờ Việt Nam). Nộp trước mốc này vẫn tính Đủ như nộp đúng hạn.
     Giữ giống DEADLINE_EXTEND trong lib/meow-auto.js. */
  var DEADLINE_EXTEND = { '2026-11-16': '2026-11-17T23:59:59+07:00' };
  /* Hạn nộp Daily Practice của lớp cls cho ngày s: IELTS13 23:30, IELTS14 0:00 hôm sau, lớp khác 23:00 (giờ Việt Nam) */
  /* Gia hạn riêng theo lớp (giờ Việt Nam). Giữ giống DEADLINE_EXTEND_CLASS trong lib/meow-auto.js. */
  var DEADLINE_EXTEND_CLASS = { IELTS13: { '2026-11-16': '2026-11-18T23:59:59+07:00', '2026-11-17': '2026-11-18T23:59:59+07:00' } };
  function deadline(cls, s) {
    if (DEADLINE_EXTEND_CLASS[cls] && DEADLINE_EXTEND_CLASS[cls][s]) return new Date(DEADLINE_EXTEND_CLASS[cls][s]);
    if (DEADLINE_EXTEND[s]) return new Date(DEADLINE_EXTEND[s]);
    if (cls === 'IELTS13') return new Date(s + 'T23:30:00+07:00');
    if (cls === 'IELTS14') return new Date(addDays(s, 1) + 'T00:00:00+07:00');
    return new Date(s + 'T23:00:00+07:00');
  }

  function dayMeow(status, s) {
    var b = base(s), t = type(s);
    if (status === 'du') return b;
    if (status === 'muon') return t === 'hoc' ? b : b / 2;
    if (status === 'nua' || status === 'bu') return b / 2;
    return 0;
  }

  /* rows: [{day:'YYYY-MM-DD', status}], redeemed: tổng Meow đã đổi */
  function calc(rows, redeemed) {
    rows = (rows || []).slice().sort(function (a, b) { return a.day < b.day ? -1 : 1; });
    var weeks = {}, order = [];
    rows.forEach(function (r) {
      var w = weekStart(r.day);
      if (!weeks[w]) { weeks[w] = { start: w, days: {} }; order.push(w); }
      weeks[w].days[r.day] = r.status;
    });
    var total = 0, bonusTotal = 0, bonusWeeks = 0;
    var list = order.map(function (w) {
      var wk = weeks[w], sum = 0, nBu = 0, filled = 0;
      for (var i = 0; i < 7; i++) {
        var d = addDays(w, i), s = wk.days[d];
        if (s) sum += dayMeow(s, d);
        if (s && FULL_OK[s]) filled++;
        if (s === 'bu') nBu++;
      }
      var full = filled === 7;
      var bonus = full ? Math.max(0, 100 - 5 * nBu) : 0;
      total += sum + bonus; bonusTotal += bonus; if (full) bonusWeeks++;
      return { start: w, days: wk.days, sum: sum, bonus: bonus, full: full, total: sum + bonus };
    });
    var cur = 0, longest = 0;
    rows.forEach(function (r) {
      if (STREAK_PLUS[r.status]) { cur++; if (cur > longest) longest = cur; }
      else if (r.status === 'bu' || r.status === 'khong') cur = 0;
    });
    redeemed = redeemed || 0;
    return { total: total, bonusTotal: bonusTotal, bonusWeeks: bonusWeeks, weeks: list, current: cur, longest: longest, redeemed: redeemed, balance: total - redeemed };
  }

  g.MEOW = { ST: ST, iso: iso, dow: dow, type: type, base: base, addDays: addDays, weekStart: weekStart, dayMeow: dayMeow, calc: calc, deadline: deadline, DEADLINE_EXTEND: DEADLINE_EXTEND };
})(window);
