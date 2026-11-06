/* Chống rời bài cho Daily Practice và bài kiểm tra tuần.
   Chỉ tính là vi phạm khi học sinh chuyển sang tab khác, mở ứng dụng khác hoặc đóng trình duyệt
   trong lúc đang làm bài. Thông báo, cửa sổ mất focus và các việc khác không bị tính.
   Lần thứ 3 bài bị khóa. Số lần lưu trong nháp trên máy chủ (answers._v), không thêm bảng mới. */
(function () {
  var MAX = 3;
  var opts = null, inited = false;

  function state() {
    var a = (opts && opts.answers()) || {};
    return a._v || { count: 0, locked: false };
  }
  function clean(a) {
    var c = Object.assign({}, a || {});
    delete c._v;
    return c;
  }
  function banner() {
    var el = document.getElementById('viol-banner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'viol-banner';
      document.body.appendChild(el);
    }
    return el;
  }
  function render() {
    if (!opts) return;
    var el = banner(), s = state();
    if (s.locked) {
      el.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(20,16,24,.88);color:#fff;display:flex;align-items:center;justify-content:center;padding:24px;font-size:18px;text-align:center;line-height:1.6';
      el.innerHTML = '<div style="max-width:460px"><b style="font-size:22px">Bài đã bị khóa</b><p>Bạn đã rời bài làm ' + MAX + ' lần. Hãy báo giáo viên để được mở khóa.</p></div>';
      el.style.display = '';
    } else if (s.count > 0 && opts.isActive()) {
      el.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:9998;background:#B05468;color:#fff;padding:10px 14px;font-size:15px;text-align:center';
      el.innerHTML = 'Bạn đã rời bài làm ' + s.count + '/' + MAX + ' lần. Lần thứ ' + MAX + ' bài sẽ bị khóa.';
      el.style.display = '';
    } else {
      el.style.display = 'none';
    }
  }
  function onHidden() {
    if (!opts || !opts.isActive()) return;
    var a = opts.answers(), s = state();
    if (s.locked) return;
    s.count = (s.count || 0) + 1;
    s.locked = s.count >= MAX;
    a._v = s;
    opts.persist();
    opts.sendNow();
    render();
  }

  window.ViolationGuard = {
    MAX: MAX,
    init: function (o) {
      opts = o;
      if (inited) return;
      inited = true;
      /* Chỉ tính khi trang bị ẩn từ 30 giây trở lên (tắt màn hình tạm thời không bị tính).
         Đóng trình duyệt (pagehide) tính ngay. */
      var hideTimer = null;
      document.addEventListener('visibilitychange', function () {
        clearTimeout(hideTimer);
        if (document.visibilityState === 'hidden') {
          hideTimer = setTimeout(function () { if (document.visibilityState === 'hidden') onHidden(); }, 30000);
        } else {
          render();
        }
      });
      window.addEventListener('pagehide', function () { clearTimeout(hideTimer); onHidden(); });
      document.addEventListener('paste', function (e) {
        if (opts && opts.isActive() && e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) e.preventDefault();
      });
    },
    render: render,
    isLocked: function () { return state().locked; },
    clean: clean
  };
})();
