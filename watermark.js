/* Watermark bản quyền: chữ chéo mờ trên toàn trang kèm dòng © ở góc dưới.
   Không chặn thao tác (pointer-events: none). Có tên học sinh đang đăng nhập để biết nguồn nếu ảnh chụp bị đưa ra ngoài. */
(function () {
  var ID = 'nvu-wm', FOOT = 'nvu-wm-foot';
  function who() {
    try { var s = JSON.parse(localStorage.getItem('nvu_student') || 'null'); return s && s.name ? String(s.name) : ''; } catch (e) { return ''; }
  }
  function tile() {
    var c = document.createElement('canvas'); c.width = 360; c.height = 220;
    var g = c.getContext('2d'); if (!g) return '';
    g.translate(180, 110); g.rotate(-Math.PI / 7);
    g.textAlign = 'center'; g.fillStyle = '#000';
    g.font = '600 15px sans-serif'; g.fillText('© NVU Academy', 0, -6);
    var n = who(); if (n) { g.font = '12px sans-serif'; g.fillText(n, 0, 14); }
    return c.toDataURL('image/png');
  }
  function mount() {
    if (!document.body) return;
    if (!document.getElementById(ID)) {
      var u = tile(), d = document.createElement('div'); d.id = ID;
      d.style.cssText = 'position:fixed;inset:0;z-index:9000;pointer-events:none;opacity:.07;background-repeat:repeat;' + (u ? 'background-image:url(' + u + ')' : '');
      document.body.appendChild(d);
    }
    if (!document.getElementById(FOOT)) {
      var f = document.createElement('div'); f.id = FOOT; f.textContent = '© NVU Academy. Không sao chép nội dung và thiết kế.';
      f.style.cssText = 'position:fixed;right:8px;bottom:4px;z-index:9000;pointer-events:none;font:11px sans-serif;color:#000;opacity:.4';
      document.body.appendChild(f);
    }
  }
  function start() {
    mount();
    /* Bị xóa khỏi trang thì gắn lại */
    new MutationObserver(function () { if (!document.getElementById(ID) || !document.getElementById(FOOT)) mount(); }).observe(document.body, { childList: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
