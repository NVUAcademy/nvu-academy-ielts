/* Thêm các kiểu biểu đồ: cycle (vòng tròn), map (bản đồ trước và sau), mixed (hai biểu đồ), diagram (sơ đồ có nhãn) */
(function () {
  const esc2 = s => String(s ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const box = '<div style="background:#F5EFE6;border-radius:14px;padding:14px 16px;border:1px solid #E2D6C2">';
  const ttl = t => '<div style="font-family:\'Bodoni Moda\',Georgia,serif;font-size:17px;margin-bottom:6px">' + esc2(t) + '</div>';
  const prev = drawChart;

  function cycle(c) {
    const W = 420, H = 320, cx = 210, cy = 160, r = 105, n = c.steps.length;
    let g = '';
    c.steps.forEach((s, i) => {
      const a = -Math.PI / 2 + i * 2 * Math.PI / n;
      const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
      const nx = cx + r * Math.cos(a + 2 * Math.PI / n / 2), ny = cy + r * Math.sin(a + 2 * Math.PI / n / 2);
      g += '<circle cx="' + x + '" cy="' + y + '" r="34" fill="#FFFCF6" stroke="#7E9B5B" stroke-width="2"/>';
      g += '<text x="' + x + '" y="' + (y + 4) + '" font-size="11" text-anchor="middle" fill="#2F2638">' + esc2(s) + '</text>';
    });
    return box + ttl(c.title) + '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="max-width:' + W + 'px">' + g + '</svg></div>';
  }

  function map(c) {
    const W = 640, H = 300;
    const panel = (x, label, items) => {
      let s = '<rect x="' + x + '" y="30" width="290" height="230" rx="8" fill="#FFFCF6" stroke="#B8A88E"/>';
      s += '<text x="' + (x + 145) + '" y="22" font-size="14" text-anchor="middle" fill="#2F2638">' + esc2(label) + '</text>';
      items.forEach(it => {
        s += '<rect x="' + (x + it.x) + '" y="' + (30 + it.y) + '" width="' + it.w + '" height="' + it.h + '" fill="' + it.fill + '" stroke="#8A7D6B"/>';
        s += '<text x="' + (x + it.x + it.w / 2) + '" y="' + (30 + it.y + it.h / 2 + 4) + '" font-size="12" text-anchor="middle" fill="#2F2638">' + esc2(it.label) + '</text>';
      });
      return s;
    };
    const svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="max-width:' + W + 'px">' +
      panel(10, c.labels[0], c.before) + panel(340, c.labels[1], c.after) + '</svg>';
    return box + ttl(c.title) + svg + '</div>';
  }

  function diagram(c) {
    const items = c.boxes.map((b, i) => '<div style="display:flex;gap:10px;align-items:flex-start;margin:6px 0"><span style="min-width:26px;height:26px;border-radius:6px;background:#5B7FA6;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:13px">' + (i + 1) + '</span><span style="background:#FFFCF6;border:1px solid #DCD3C4;border-radius:10px;padding:6px 12px;font-size:15px">' + esc2(b) + '</span></div>').join('');
    return box + ttl(c.title) + items + '</div>';
  }

  function mixed(c) {
    return box + ttl(c.title) + '<div style="margin-bottom:10px">' + drawChart(c.parts[0]) + '</div><div>' + drawChart(c.parts[1]) + '</div></div>';
  }

  window.drawChart = function (c) {
    if (!c) return '';
    if (c.type === 'cycle') return cycle(c);
    if (c.type === 'map') return map(c);
    if (c.type === 'diagram') return diagram(c);
    if (c.type === 'mixed') return mixed(c);
    return prev(c);
  };
})();
