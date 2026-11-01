/* NVU Academy: áp dụng nền học sinh đã chọn ở trang chủ cho mọi trang (quiz, daily practice, tài liệu, game) */
(function () {
  /* Mặc định là video núi mùa thu. Khóa nvu_bg2 để học sinh cũ cũng được đổi sang mặc định mới */
  var id = 'v-autumn';
  try { id = localStorage.getItem('nvu_bg2') || 'v-autumn'; } catch (e) {}
  if (!id || id === 'cream') return;
  var VIDEOS = { 'v-swamp': 'backgrounds/bg-swamp-cat.mp4', 'v-chill': 'backgrounds/bg-chill-cat.mp4', 'v-autumn': 'backgrounds/bg-autumn.mp4' };
  var css = '' +
    '#nvubg{position:fixed;inset:0;z-index:-1;pointer-events:none;overflow:hidden}' +
    'html.nvu-bg,html.nvu-bg body{background:transparent !important}' +
    'html.nvu-bg-aurora{background:linear-gradient(120deg,#F8F2E9,#EBC7C9,#D9CFE7,#C9DBE6,#CBDCCB,#F8F2E9) !important;background-size:400% 400% !important;animation:nvuAur 22s ease infinite}' +
    '@keyframes nvuAur{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}' +
    'html.nvu-bg-sakura{background:linear-gradient(180deg,#FBEFEF,#F8F2E9) !important}' +
    'html.nvu-bg-night{background:linear-gradient(180deg,#14101B,#241C2B 60%,#2D2338) !important}' +
    'html.nvu-bg-rain{background:linear-gradient(180deg,#E3EAF0,#C9DBE6 70%,#B9CBD8) !important}' +
    'html.nvu-bg .wrap{background:rgba(248,242,233,.86);border-radius:26px;padding-left:20px;padding-right:20px;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}' +
    '.nvu-petal{position:absolute;top:-30px;width:12px;height:16px;background:radial-gradient(circle at 30% 30%,#fff 0,#EBC7C9 60%,#D99AA3);border-radius:80% 0 80% 0;opacity:.8;animation:nvuFall linear infinite}' +
    '@keyframes nvuFall{to{transform:translate3d(var(--dx,60px),110vh,0) rotate(540deg)}}' +
    '.nvu-star{position:absolute;width:3px;height:3px;border-radius:50%;background:#fff;animation:nvuTw 3s ease-in-out infinite}' +
    '@keyframes nvuTw{0%,100%{opacity:.15}50%{opacity:1}}' +
    '.nvu-drop{position:absolute;top:-40px;width:1.5px;height:34px;background:linear-gradient(transparent,rgba(255,255,255,.75));animation:nvuRain linear infinite}' +
    '@keyframes nvuRain{to{transform:translateY(115vh)}}' +
    '.nvu-vid{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}' +
    '.nvu-shade{position:absolute;inset:0;background:rgba(248,242,233,.18)}';
  function init() {
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    var root = document.documentElement; root.classList.add('nvu-bg');
    if (!VIDEOS[id]) root.classList.add('nvu-bg-' + id);
    var fx = document.createElement('div'); fx.id = 'nvubg'; document.body.insertBefore(fx, document.body.firstChild);
    function mk(cls, n, fn) { for (var i = 0; i < n; i++) { var e = document.createElement('div'); e.className = cls; fn(e); fx.appendChild(e); } }
    var r = Math.random;
    if (id === 'sakura') mk('nvu-petal', 22, function (e) { e.style.left = r() * 100 + '%'; e.style.animationDuration = (9 + r() * 9) + 's'; e.style.animationDelay = (-r() * 15) + 's'; e.style.setProperty('--dx', (r() * 160 - 40) + 'px'); });
    if (id === 'night') mk('nvu-star', 70, function (e) { e.style.left = r() * 100 + '%'; e.style.top = r() * 100 + '%'; e.style.animationDelay = (r() * 3) + 's'; e.style.animationDuration = (2 + r() * 3) + 's'; });
    if (id === 'rain') mk('nvu-drop', 45, function (e) { e.style.left = r() * 100 + '%'; e.style.animationDuration = (0.9 + r() * 0.9) + 's'; e.style.animationDelay = (-r() * 2) + 's'; });
    if (VIDEOS[id]) {
      var v = document.createElement('video'); v.className = 'nvu-vid'; v.src = VIDEOS[id]; v.muted = true; v.loop = true; v.autoplay = true; v.playsInline = true; v.setAttribute('playsinline', '');
      fx.appendChild(v); var p = v.play(); if (p && p.catch) p.catch(function () {});
      var sh = document.createElement('div'); sh.className = 'nvu-shade'; fx.appendChild(sh);
    }
  }
  if (document.body) init(); else document.addEventListener('DOMContentLoaded', init);
})();
