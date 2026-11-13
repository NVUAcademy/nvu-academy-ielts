/* Xuất ghi âm của học sinh lên Google Drive, theo ngày, tên file rõ ràng.
   - Chạy tự động mỗi ngày qua Vercel Cron (Authorization: Bearer CRON_SECRET).
   - Hoặc giáo viên/trợ giảng bấm nút "Đẩy lên Drive" ở trang giáo viên (Authorization: Bearer <phiên đăng nhập Supabase>).
   Biến môi trường:
     GOOGLE_SA_JSON       nội dung file khóa JSON của tài khoản dịch vụ Google
     DRIVE_FOLDERS        {"FOUNDATION11":"<id thư mục Drive>"} (mỗi lớp một thư mục gốc)
     CRON_SECRET          chuỗi bí mật cho cron
     TEACHER_EMAILS       email giáo viên/trợ giảng được bấm nút, cách nhau bằng dấu phẩy (mặc định: leviethoainam287@gmail.com)
     SUPABASE_URL, SUPABASE_SERVICE_KEY  (đã có)
     SITE_URL             (tuỳ chọn) mặc định https://nvu-academy-ielts.vercel.app */
const crypto = require('crypto');

const SB_URL = () => (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_HEAD = () => {
  const k = process.env.SUPABASE_SERVICE_KEY || '';
  return k.startsWith('sb_') ? { apikey: k } : { apikey: k, Authorization: 'Bearer ' + k };
};
const sb = (path, opts) => fetch(SB_URL() + path, { ...opts, headers: { ...SB_HEAD(), ...(opts && opts.headers) } });
const DOW = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const vnDate = (d = new Date()) => new Date(d.getTime() + 7 * 3600e3).toISOString().slice(0, 10);   // ngày theo giờ Việt Nam
const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const ascii = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function fileName(r) {
  const d = new Date(r.date + 'T00:00:00Z'), ext = (r.path.split('.').pop() || 'wav').toLowerCase();
  return `${r.date}_${DOW[d.getUTCDay()]}_${ascii(r.cls)}_${ascii(r.student)}_${r.src === 'daily' ? 'Daily' : 'Speaking'}-${ascii(r.title).slice(0, 40)}${r.step ? '-' + ascii(r.step) : ''}.${ext}`;
}

/* ---------- Google ---------- */
async function googleToken() {
  const sa = JSON.parse(process.env.GOOGLE_SA_JSON);
  const now = Math.floor(Date.now() / 1000), b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const head = b64({ alg: 'RS256', typ: 'JWT' }), claim = b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/drive', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3300 });
  const sig = crypto.createSign('RSA-SHA256').update(head + '.' + claim).sign(sa.private_key).toString('base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + head + '.' + claim + '.' + sig });
  const j = await r.json(); if (!r.ok) throw new Error('Google token: ' + (j.error_description || j.error));
  return { token: j.access_token, email: sa.client_email };
}
async function gd(token, url, opts) {
  const r = await fetch(url, { ...opts, headers: { Authorization: 'Bearer ' + token, ...(opts && opts.headers) } });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = { raw: t }; }
  if (!r.ok) throw new Error('Drive ' + r.status + ': ' + ((j.error && j.error.message) || t.slice(0, 200)));
  return j;
}
async function ensureFolder(token, parentId, name, cache) {
  const key = parentId + '/' + name; if (cache[key]) return cache[key];
  const q = encodeURIComponent(`name='${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const f = await gd(token, `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)&supportsAllDrives=true&includeItemsFromAllDrives=true`);
  let id = f.files && f.files[0] && f.files[0].id;
  if (!id) id = (await gd(token, 'https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }) })).id;
  return (cache[key] = id);
}
async function uploadFile(token, parentId, name, mime, buf) {
  const boundary = 'nvu' + crypto.randomBytes(8).toString('hex');
  const meta = Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, parents: [parentId] })}\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`);
  const body = Buffer.concat([meta, buf, Buffer.from(`\r\n--${boundary}--`)]);
  return gd(token, 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name', { method: 'POST', headers: { 'content-type': 'multipart/related; boundary=' + boundary }, body });
}

/* ---------- xác thực ---------- */
async function authorised(req) {
  const h = String(req.headers.authorization || ''); const tok = h.replace(/^Bearer\s+/i, '');
  if (!tok) return false;
  if (process.env.CRON_SECRET && tok === process.env.CRON_SECRET) return 'cron';
  const r = await fetch(SB_URL() + '/auth/v1/user', { headers: { apikey: SB_HEAD().apikey, Authorization: 'Bearer ' + tok } });
  if (!r.ok) return false; const u = await r.json();
  if (!u || !u.email) return false;
  const email = String(u.email).toLowerCase();
  /* danh sách giáo viên / trợ giảng nằm trong bảng staff_emails; TEACHER_EMAILS là danh sách dự phòng */
  const rows = await (await sb('/rest/v1/staff_emails?select=email&email=eq.' + encodeURIComponent(email))).json().catch(() => []);
  if (Array.isArray(rows) && rows.length) return u.email;
  const allow = (process.env.TEACHER_EMAILS || '').toLowerCase().split(',').map(x => x.trim()).filter(Boolean);
  return allow.includes(email) ? u.email : false;
}

/* ---------- gom ghi âm cần xuất ---------- */
async function collect(cls, from) {
  const site = (process.env.SITE_URL || 'https://nvu-academy-ielts.vercel.app').replace(/\/$/, '');
  let titles = {}; try { (await (await fetch(site + '/daily-index.json')).json()).practices.forEach(p => { titles[p.id] = p.title; }); } catch (e) {}
  const out = [];
  const a = await (await sb(`/rest/v1/daily_scores?select=id,practice_date,practice_id,voice_path,students!inner(full_name,class_code)&voice_path=not.is.null&students.class_code=eq.${cls}&practice_date=gte.${from}&order=practice_date.asc`)).json();
  if (!Array.isArray(a)) throw new Error('Supabase daily_scores: ' + JSON.stringify(a).slice(0, 160));
  /* Bài có nhiều bước ghi âm: mỗi bản ghi theo bước nằm trong answers._voices (lấy riêng; lỗi thì chỉ xuất bản ghi chính) */
  const voicesById = {};
  try {
    const ids = a.map(r => r.id);
    for (let i = 0; i < ids.length; i += 100) {
      const part = ids.slice(i, i + 100).join(',');
      let vr = await (await sb(`/rest/v1/daily_scores?select=id,voices:answers->_voices&id=in.(${part})`)).json();
      if (!Array.isArray(vr)) { /* cú pháp chọn trường JSON bị từ chối: lấy cả answers rồi tự tách */
        const full = await (await sb(`/rest/v1/daily_scores?select=id,answers&id=in.(${part})`)).json();
        vr = Array.isArray(full) ? full.map(x => ({ id: x.id, voices: x.answers && x.answers._voices })) : [];
      }
      vr.forEach(x => { if (x.voices && typeof x.voices === 'object') voicesById[x.id] = x.voices; });
    }
  } catch (e) {}
  a.forEach(r => {
    const title = titles[r.practice_id] || r.practice_id || 'Daily Practice';
    const base = { src: 'daily', student: r.students.full_name, cls, date: r.practice_date, title, path: r.voice_path };
    const no = k => parseInt(String(k).replace(/\D/g, ''), 10) || 0;
    const vs = Object.entries(voicesById[r.id] || {}).filter(([, v]) => v && v.p).sort((x, y) => no(x[0]) - no(y[0]));
    if (!vs.length) { out.push(base); return; }
    vs.forEach(([k, v]) => out.push({ ...base, step: k, title: title + ' ' + String(v.t || k).replace(/^Step\s*\d+\s*·\s*/i, ''), path: v.p }));
    if (r.voice_path && !vs.some(([, v]) => v.p === r.voice_path)) out.push(base);
  });
  const b = await (await sb(`/rest/v1/speaking_submissions?select=id,audio_url,question,submitted_at,students!inner(full_name,class_code)&students.class_code=eq.${cls}&submitted_at=gte.${from}T00:00:00%2B07:00&order=submitted_at.asc`)).json();
  if (!Array.isArray(b)) throw new Error('Supabase speaking_submissions: ' + JSON.stringify(b).slice(0, 160));
  b.forEach(r => { if (r.audio_url) out.push({ src: 'speaking', student: r.students.full_name, cls, date: vnDate(new Date(r.submitted_at)), title: (r.question || 'Speaking').slice(0, 40), path: r.audio_url }); });
  return out;
}

module.exports = async function handler(req, res) {
  try {
    const who = await authorised(req);
    if (!who) return res.status(401).json({ ok: false, error: 'Không có quyền' });

    /* ?task=report: gửi báo cáo tiến độ trong ngày qua email (xem lib/daily-report.js) */
    if ((req.query || {}).task === 'report') {
      if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) return res.status(500).json({ ok: false, error: 'Thiếu SUPABASE_URL / SUPABASE_SERVICE_KEY trên Vercel' });
      const report = require('../lib/daily-report.js');
      const mail = await report.buildReport(req.query.date);
      if (req.query.dry) return res.status(200).json({ ok: true, dry: true, subject: mail.subject, html: mail.html });
      const sent = await report.sendReport(mail);
      return res.status(200).json({ ok: true, day: mail.day, subject: mail.subject, ...sent });
    }

    /* ?task=meow: tự chấm Meow theo bài đã nộp của ngày hôm trước (xem lib/meow-auto.js). &dry=1 chỉ xem trước. */
    if ((req.query || {}).task === 'meow') {
      if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) return res.status(500).json({ ok: false, error: 'Thiếu SUPABASE_URL / SUPABASE_SERVICE_KEY trên Vercel' });
      const q = req.query;
      if (q.date && !/^\d{4}-\d{2}-\d{2}$/.test(q.date)) return res.status(400).json({ ok: false, error: 'date phải dạng YYYY-MM-DD' });
      const day = q.date || new Date(Date.now() + 7 * 3600e3 - 86400e3).toISOString().slice(0, 10);
      const meow = require('../lib/meow-auto.js');
      const site = process.env.SITE_URL || 'https://nvu-academy-ielts.vercel.app';
      const { rows, summary } = await meow.computeMeow(day, site);
      if (q.dry) return res.status(200).json({ ok: true, dry: true, day, summary, would_write: rows.length });
      const written = await meow.writeMeow(rows);
      return res.status(200).json({ ok: true, day, written, summary });
    }

    for (const k of ['GOOGLE_SA_JSON', 'DRIVE_FOLDERS', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY']) if (!process.env[k]) return res.status(500).json({ ok: false, error: 'Thiếu biến môi trường ' + k + ' trên Vercel' });
    const folders = JSON.parse(process.env.DRIVE_FOLDERS);
    const q = req.query || {}, days = Math.max(1, Math.min(14, parseInt(q.days || '3', 10) || 3));
    const only = q.cls ? String(q.cls).toUpperCase() : null;
    const from = addDays(vnDate(), -(days - 1));
    const { token, email } = await googleToken();
    const cache = {}, report = { ok: true, by: who, from, uploaded: 0, skipped: 0, failed: [], classes: {} };
    for (const cls of Object.keys(folders)) {
      if (only && cls !== only) continue;
      const rows = await collect(cls, from); report.classes[cls] = rows.length;
      const have = new Set(); const ex = await (await sb('/rest/v1/recording_exports?select=path&path=in.(' + rows.map(r => '"' + r.path.replace(/"/g, '') + '"').join(',') + ')')).json().catch(() => []);
      if (Array.isArray(ex)) ex.forEach(e => have.add(e.path));
      for (const r of rows) {
        if (have.has(r.path)) { report.skipped++; continue; }
        try {
          const dl = await sb('/storage/v1/object/voice-notes/' + r.path.split('/').map(encodeURIComponent).join('/'));
          if (!dl.ok) throw new Error('tải file lỗi ' + dl.status);
          const buf = Buffer.from(await dl.arrayBuffer());
          const dayFolder = await ensureFolder(token, folders[cls], r.date, cache);
          const mime = /\.wav$/i.test(r.path) ? 'audio/wav' : /\.mp3$/i.test(r.path) ? 'audio/mpeg' : /\.m4a$|\.mp4$/i.test(r.path) ? 'audio/mp4' : 'audio/webm';
          const f = await uploadFile(token, dayFolder, fileName(r), mime, buf);
          await sb('/rest/v1/recording_exports', { method: 'POST', headers: { 'content-type': 'application/json', Prefer: 'resolution=ignore-duplicates' }, body: JSON.stringify({ path: r.path, class_code: cls, drive_file_id: f.id, file_name: f.name }) });
          report.uploaded++;
        } catch (e) { report.failed.push({ file: fileName(r), error: String(e.message).slice(0, 160) }); }
      }
    }
    report.serviceAccount = email;
    res.status(200).json(report);
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e).slice(0, 300) });
  }
};
