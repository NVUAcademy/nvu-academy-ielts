/* Vẽ biểu đồ Task 1 theo phong cách handout I2: nền be, tiêu đề chữ có chân, chú thích bên phải, màu xanh và xanh lá */
function drawChart(c) {
  if (!c) return '';
  const esc2 = s => String(s ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const wrapStart = '<div style="background:#F5EFE6;border-radius:14px;padding:14px 16px;border:1px solid #E2D6C2">';
  const title = '<div style="font-family:\'Bodoni Moda\',Georgia,serif;font-size:17px;margin-bottom:6px">' + esc2(c.title) + '</div>';
  const wrapEnd = '</div>';

  if (c.type === 'table') {
    const head = '<tr>' + c.headers.map(h => '<th style="background:#D9E6D0;padding:8px 10px;border:1px solid #C9D6BF;text-align:left">' + esc2(h) + '</th>').join('') + '</tr>';
    const body = c.rows.map(r => '<tr>' + r.map(v => '<td style="padding:8px 10px;border:1px solid #DCD3C4">' + esc2(v) + '</td>').join('') + '</tr>').join('');
    return wrapStart + title + '<table style="border-collapse:collapse;width:100%;background:#FFFCF6;font-size:15px">' + head + body + '</table>' + wrapEnd;
  }

  if (c.type === 'process') {
    const items = c.steps.map((s, i) => '<div style="display:flex;gap:10px;align-items:center;margin:6px 0"><span style="min-width:28px;height:28px;border-radius:50%;background:#7E9B5B;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:14px">' + (i + 1) + '</span><span style="background:#FFFCF6;border:1px solid #DCD3C4;border-radius:10px;padding:6px 12px;font-size:15px">' + esc2(s) + '</span></div>').join('');
    return wrapStart + title + items + wrapEnd;
  }

  const W = 640, H = 330, L = 52, R = 150, T = 20, B = 40;
  const pw = W - L - R, ph = H - T - B;
  const all = c.series.flatMap(s => s.values);
  const maxV = Math.ceil(Math.max(...all) / 10) * 10 || 10;
  const yOf = v => T + ph - (v / maxV) * ph;
  let grid = '';
  for (let g = 0; g <= 5; g++) {
    const v = Math.round(maxV * g / 5), y = yOf(v);
    grid += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '" stroke="#DCD3C4"/>';
    grid += '<text x="' + (L - 8) + '" y="' + (y + 4) + '" font-size="12" text-anchor="end" fill="#7D7183">' + v + '</text>';
  }
  const n = c.labels.length, step = pw / n;
  let plot = '';
  if (c.type === 'bar') {
    const groupW = step * 0.72, barW = groupW / c.series.length;
    c.labels.forEach((lab, i) => {
      const x0 = L + i * step + (step - groupW) / 2;
      c.series.forEach((s, k) => {
        const v = s.values[i], y = yOf(v);
        plot += '<rect x="' + (x0 + k * barW) + '" y="' + y + '" width="' + (barW - 2) + '" height="' + (T + ph - y) + '" fill="' + s.color + '"/>';
      });
      plot += '<text x="' + (L + i * step + step / 2) + '" y="' + (H - B + 16) + '" font-size="12" text-anchor="middle" fill="#2F2638">' + esc2(lab) + '</text>';
    });
  } else if (c.type === 'line') {
    c.series.forEach(s => {
      const pts = s.values.map((v, i) => (L + i * step + step / 2) + ',' + yOf(v)).join(' ');
      plot += '<polyline points="' + pts + '" fill="none" stroke="' + s.color + '" stroke-width="2.5"/>';
      s.values.forEach((v, i) => { plot += '<circle cx="' + (L + i * step + step / 2) + '" cy="' + yOf(v) + '" r="3.5" fill="' + s.color + '"/>'; });
    });
    c.labels.forEach((lab, i) => { plot += '<text x="' + (L + i * step + step / 2) + '" y="' + (H - B + 16) + '" font-size="12" text-anchor="middle" fill="#2F2638">' + esc2(lab) + '</text>'; });
  }
  const legend = c.series.map((s, k) => '<rect x="' + (W - R + 14) + '" y="' + (T + 10 + k * 22) + '" width="14" height="14" fill="' + s.color + '"/><text x="' + (W - R + 34) + '" y="' + (T + 22 + k * 22) + '" font-size="13" fill="#2F2638">' + esc2(s.name) + '</text>').join('');
  const svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="display:block;max-width:' + W + 'px">' + grid + plot + legend +
    '<text x="' + L + '" y="' + (T - 4) + '" font-size="12" fill="#7D7183">' + esc2(c.unit || '') + '</text></svg>';
  return wrapStart + title + svg + wrapEnd;
}
