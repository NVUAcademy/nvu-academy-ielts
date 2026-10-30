/* =========================================================
   IELTS Studio — Firebase adapter
   The page was written for the claude.ai artifact runtime, which
   provides window.claude.use('db' | 'user' | 'assets').
   This file recreates that same interface on top of Firebase:
     db     -> Cloud Firestore (same doc/collection/onSnapshot API)
     user   -> Firebase Authentication (email/password or Google)
     assets -> Cloud Storage for Firebase (video homework uploads)
   It also shows a sign-in screen and, for the teacher, a one-click
   import of the starter data in data/seed.json.
   ========================================================= */
(function () {
  var cfg = window.FIREBASE_CONFIG;
  var TEACHER_UID = window.TEACHER_UID || '';
  if (!cfg || !cfg.apiKey || cfg.apiKey.indexOf('PASTE') === 0) {
    document.addEventListener('DOMContentLoaded', function () {
      document.body.insertAdjacentHTML('afterbegin',
        '<div style="max-width:560px;margin:40px auto;padding:20px;border:1px solid #b08d57;border-radius:14px;font-family:system-ui;background:#fffcf6">' +
        '<b>Setup needed:</b> fill in <code>firebase-config.js</code> with your Firebase project settings, then reload.</div>');
    });
    return;
  }

  firebase.initializeApp(cfg);
  var auth = firebase.auth();
  var fs = firebase.firestore();
  var storage = null;
  try { storage = firebase.storage(); } catch (e) { storage = null; }

  var resolveAuth;
  var authReady = new Promise(function (r) { resolveAuth = r; });

  /* ---------- sign-in screen ---------- */
  var CSS = '#auth-wrap{position:fixed;inset:0;z-index:100;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:24px 16px;' +
    'background:radial-gradient(90% 60% at 50% -10%,#f3d6dc,transparent 60%),#f8f2e9;font-family:"Jost","Futura",system-ui,sans-serif;color:#2f2638}' +
    '#auth-card{margin:auto;width:min(420px,100%);background:#fffcf6;border:1px solid #b08d57;outline:1px solid rgba(176,141,87,.5);outline-offset:5px;' +
    'border-radius:200px 200px 22px 22px;padding:44px 26px 26px;text-align:center;box-shadow:0 24px 60px -24px rgba(64,40,52,.45)}' +
    '#auth-card h1{font-family:"Bodoni Moda",Didot,Georgia,serif;font-weight:500;font-size:34px;margin:6px 0 2px}#auth-card h1 i{color:#b08d57}' +
    '#auth-card .crown{font-size:30px;color:#b08d57}#auth-card p{margin:6px 0;color:#7d7183;font-size:14px}' +
    '#auth-card form{display:flex;flex-direction:column;gap:10px;margin-top:14px;text-align:left}' +
    '#auth-card label{font-size:11px;letter-spacing:1.4px;text-transform:uppercase;font-weight:600;color:#7d7183;display:flex;flex-direction:column;gap:4px}' +
    '#auth-card input{font:inherit;font-size:15px;padding:10px 12px;border:1px solid rgba(176,141,87,.6);border-radius:12px;background:#fff;color:#2f2638;text-transform:none;letter-spacing:normal}' +
    '#auth-card button{font:inherit;cursor:pointer;border-radius:999px;padding:10px 18px;font-weight:600;font-size:13px;letter-spacing:1.4px;text-transform:uppercase;border:1px solid #b08d57}' +
    '#auth-card .primary{background:#2f2638;color:#fffcf6;border-color:#2f2638}#auth-card .google{background:#fff;color:#2f2638;width:100%;margin-top:14px}' +
    '#auth-card .link{background:none;border:0;padding:4px;text-transform:none;letter-spacing:0;font-weight:500;text-decoration:underline;color:#7d7183}' +
    '#auth-card .err{color:#b05468;font-size:13px;min-height:1.2em}#auth-card .or{margin:14px 0 0;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#b08d57}';

  function esc(s) { return String(s || '').replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function showLogin(mode) {
    mode = mode || 'in';
    var old = document.getElementById('auth-wrap'); if (old) old.remove();
    if (!document.getElementById('auth-css')) { var st = document.createElement('style'); st.id = 'auth-css'; st.textContent = CSS; document.head.appendChild(st); }
    var up = mode === 'up';
    document.body.insertAdjacentHTML('beforeend',
      '<div id="auth-wrap"><div id="auth-card"><div class="crown">♛</div><h1>IELTS <i>Studio</i></h1>' +
      '<p>' + (up ? 'Create your free account to join your class.' : 'Sign in to enter your classroom.') + '</p>' +
      '<form id="auth-form">' +
      (up ? '<label>Your full name<input id="au-name" required maxlength="40" autocomplete="name"></label>' : '') +
      '<label>Email<input id="au-email" type="email" required autocomplete="email"></label>' +
      '<label>Password<input id="au-pass" type="password" required minlength="6" autocomplete="' + (up ? 'new-password' : 'current-password') + '"></label>' +
      '<div class="err" id="au-err"></div>' +
      '<button class="primary" type="submit">' + (up ? 'Create account' : 'Sign in') + '</button></form>' +
      '<p class="or">or</p><button class="google" id="au-google" type="button">Continue with Google</button>' +
      '<p>' + (up ? 'Already have an account? <button class="link" id="au-switch" type="button">Sign in</button>'
                  : 'New student? <button class="link" id="au-switch" type="button">Create an account</button>') +
      (up ? '' : ' · <button class="link" id="au-reset" type="button">Forgot password?</button>') + '</p></div></div>');
    var err = document.getElementById('au-err');
    function fail(e) {
      var m = (e && e.code) || '';
      err.textContent = m.indexOf('wrong-password') > -1 || m.indexOf('invalid-credential') > -1 ? 'Wrong email or password.'
        : m.indexOf('user-not-found') > -1 ? 'No account with this email. Create one first.'
        : m.indexOf('email-already-in-use') > -1 ? 'This email already has an account. Sign in instead.'
        : m.indexOf('weak-password') > -1 ? 'Use a password with at least 6 characters.'
        : m.indexOf('popup') > -1 ? 'The Google window was closed. Try again.'
        : 'Could not sign in. Check your connection and try again.';
    }
    document.getElementById('au-form') && null;
    document.getElementById('auth-form').addEventListener('submit', function (ev) {
      ev.preventDefault(); err.textContent = '';
      var email = document.getElementById('au-email').value.trim(), pass = document.getElementById('au-pass').value;
      if (up) {
        var name = document.getElementById('au-name').value.trim();
        auth.createUserWithEmailAndPassword(email, pass).then(function (c) { return c.user.updateProfile({ displayName: name }); }).then(function () { location.reload(); }).catch(fail);
      } else {
        auth.signInWithEmailAndPassword(email, pass).catch(fail);
      }
    });
    document.getElementById('au-google').addEventListener('click', function () {
      auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(function (e) {
        if (String(e && e.code).indexOf('popup-blocked') > -1) auth.signInWithRedirect(new firebase.auth.GoogleAuthProvider()); else fail(e);
      });
    });
    document.getElementById('au-switch').addEventListener('click', function () { showLogin(up ? 'in' : 'up'); });
    var rs = document.getElementById('au-reset');
    if (rs) rs.addEventListener('click', function () {
      var email = document.getElementById('au-email').value.trim();
      if (!email) { err.textContent = 'Type your email above first.'; return; }
      auth.sendPasswordResetEmail(email).then(function () { err.style.color = '#5e8b6e'; err.textContent = 'Check your inbox for a reset link.'; }).catch(fail);
    });
  }

  function signOutButton() {
    if (document.getElementById('signout-pill')) return;
    var b = document.createElement('button');
    b.id = 'signout-pill'; b.textContent = 'Sign out';
    b.style.cssText = 'position:fixed;left:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 12px);z-index:35;font:600 11px/1 system-ui;letter-spacing:1px;text-transform:uppercase;padding:8px 12px;border-radius:999px;border:1px solid #b08d57;background:rgba(255,252,246,.9);color:#2f2638;cursor:pointer';
    b.onclick = function () { try { localStorage.removeItem('gate'); } catch (e) {} auth.signOut().then(function () { location.reload(); }); };
    document.body.appendChild(b);
  }

  /* ---------- teacher helpers: setup notice + starter-data import ---------- */
  function teacherTools(u) {
    if (!TEACHER_UID) {
      console.log('[IELTS Studio] Your user id is:', u.uid);
      document.body.insertAdjacentHTML('beforeend',
        '<div style="position:fixed;right:12px;bottom:12px;z-index:60;max-width:360px;padding:14px;border:1px solid #b08d57;border-radius:14px;background:#fffcf6;font:14px system-ui;box-shadow:0 10px 30px rgba(0,0,0,.2)">' +
        '<b>Teacher setup:</b> copy this id into <code>TEACHER_UID</code> in <code>firebase-config.js</code> and in <code>firestore.rules</code>, then redeploy:<br>' +
        '<input readonly value="' + esc(u.uid) + '" style="width:100%;margin-top:8px;padding:6px;font:13px monospace" onclick="this.select()"></div>');
      return;
    }
    if (u.uid !== TEACHER_UID) return;
    fs.collection('classes').limit(1).get().then(function (snap) {
      if (!snap.empty) return;
      var box = document.createElement('div');
      box.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:60;max-width:340px;padding:14px;border:1px solid #b08d57;border-radius:14px;background:#fffcf6;font:14px system-ui;box-shadow:0 10px 30px rgba(0,0,0,.2)';
      box.innerHTML = '<b>Your classroom is empty.</b><br>Import the starter data (classes, lessons, 128 words, prompts, samples, homework)?<br>' +
        '<button id="seed-go" style="margin-top:10px;padding:8px 14px;border-radius:999px;border:1px solid #2f2638;background:#2f2638;color:#fff;cursor:pointer">Import starter data</button> ' +
        '<button id="seed-no" style="margin-top:10px;padding:8px 14px;border-radius:999px;border:1px solid #b08d57;background:#fff;cursor:pointer">Not now</button>';
      document.body.appendChild(box);
      document.getElementById('seed-no').onclick = function () { box.remove(); };
      document.getElementById('seed-go').onclick = function () {
        this.disabled = true; this.textContent = 'Importing…';
        fetch('data/seed.json').then(function (r) { return r.json(); }).then(function (seed) {
          var keys = Object.keys(seed), chunks = [];
          for (var i = 0; i < keys.length; i += 400) chunks.push(keys.slice(i, i + 400));
          return chunks.reduce(function (p, chunk) {
            return p.then(function () { var b = fs.batch(); chunk.forEach(function (k) { b.set(fs.doc(k), seed[k]); }); return b.commit(); });
          }, Promise.resolve()).then(function () { box.innerHTML = '<b>Imported ' + keys.length + ' items.</b> The page updates by itself.'; setTimeout(function () { box.remove(); }, 4000); });
        }).catch(function (e) { box.innerHTML = '<b>Import failed:</b> ' + esc(e && e.message); });
      };
    });
  }

  auth.onAuthStateChanged(function (u) {
    if (u) {
      var w = document.getElementById('auth-wrap'); if (w) w.remove();
      resolveAuth(u); signOutButton(); teacherTools(u);
    } else {
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { showLogin('in'); });
      else showLogin('in');
    }
  });

  /* ---------- the window.claude interface the page expects ---------- */
  function initials(name) { return (name || '?').split(/\s+/).map(function (x) { return x[0]; }).join('').slice(0, 2).toUpperCase(); }
  function avatarFor(u) {
    if (u.photoURL) return u.photoURL;
    var svg = "<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><rect width='64' height='64' rx='32' fill='%23EBC7C9'/><text x='32' y='40' font-family='Georgia' font-size='24' text-anchor='middle' fill='%232F2638'>" + initials(u.displayName || u.email) + "</text></svg>";
    return 'data:image/svg+xml,' + svg.replace(/#/g, '%23');
  }
  var userNS = {
    me: function () { return authReady.then(function (u) { var own = !!TEACHER_UID && u.uid === TEACHER_UID; return { id: u.uid, name: u.displayName || '', avatarUrl: avatarFor(u), color: '#b08d57', email: u.email || null, isOwner: own, canEdit: own }; }); },
    id: function () { return authReady.then(function (u) { return u.uid; }); },
    isOwner: function () { return authReady.then(function (u) { return !!TEACHER_UID && u.uid === TEACHER_UID; }); },
    canEdit: function () { return userNS.isOwner(); },
    can: function () { return Promise.resolve(null); },
    name: function () { return authReady.then(function (u) { return u.displayName || ''; }); },
    profiles: function (ids) { var o = {}; [].concat(ids || []).forEach(function (id) { o[id] = { id: id, name: '', avatarUrl: '', color: '#b08d57', email: null, isMe: false, guest: false }; }); return Promise.resolve(o); },
    search: function () { return Promise.resolve([]); }
  };
  var dbNS = { doc: function (p) { return fs.doc(p); }, collection: function (p) { return fs.collection(p); } };
  var assetsNS = !storage ? null : {
    upload: function (blob, opts) {
      return authReady.then(function (u) {
        var name = (blob.name || 'upload').replace(/[^\w.\-]+/g, '_');
        // Teacher files (homework materials) go to materials/, readable by every signed-in student.
        var folder = (TEACHER_UID && u.uid === TEACHER_UID) ? 'materials/' : 'uploads/' + u.uid + '/';
        var ref = storage.ref(folder + Date.now() + '-' + name);
        return ref.put(blob, { contentType: (opts && opts.type) || blob.type }).then(function () { return ref.getDownloadURL(); })
          .then(function (url) { return { id: url, url: url, sizeBytes: blob.size, contentType: (opts && opts.type) || blob.type }; });
      });
    },
    list: function () { return Promise.resolve({ assets: [], usage: {} }); },
    delete: function () { return Promise.resolve({ deleted: false }); }
  };
  window.claude = {
    use: function (name) {
      return authReady.then(function () {
        if (name === 'db') return dbNS;
        if (name === 'user') return userNS;
        if (name === 'assets') return assetsNS;
        return null;
      });
    }
  };
})();
