/* Kiểm thử nhiều bản ghi âm trong một bài Daily (lib/voices.js và api/submit-daily.js). Chạy: node --test scripts/test-voices.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { cleanVoices, mergeVoices } = require('../lib/voices.js');

const SID = '70e16b8a-3eb5-4ca7-ba28-bb24a299bbfc', OTHER = '9f355e27-2277-4e80-acff-9f11144e7495';
const P1 = `daily/${SID}/w5-thu-found11-s1-1111111111111.webm`, P5 = `daily/${SID}/w5-thu-found11-s5-2222222222222.webm`, P5B = `daily/${SID}/w5-thu-found11-s5-3333333333333.webm`;

/* ---------- lib/voices.js ---------- */
test('cleanVoices: nhận bản ghi hợp lệ trong thư mục của chính học sinh', () => {
  const r = cleanVoices({ s1: { p: P1, t: 'Step 1 · Shadowing' }, s5: { p: P5, t: 'Step 5 · Speaking Part 1' } }, SID);
  assert.equal(r.error, undefined);
  assert.deepEqual(Object.keys(r.voices), ['s1', 's5']);
  assert.equal(r.voices.s5.p, P5);
});
test('cleanVoices: từ chối đường dẫn của học sinh khác, đường dẫn có "..", mã bước sai, quá nhiều bản ghi', () => {
  assert.ok(cleanVoices({ s1: { p: `daily/${OTHER}/x.webm` } }, SID).error);
  assert.ok(cleanVoices({ s1: { p: `daily/${SID}/../${OTHER}/x.webm` } }, SID).error);
  assert.ok(cleanVoices({ 's 1': { p: P1 } }, SID).error);
  assert.ok(cleanVoices({ s1: P1 }, SID).error, 'giá trị phải là đối tượng {p, t}');
  const many = {}; for (let i = 0; i < 9; i++) many['s' + i] = { p: P1 };
  assert.ok(cleanVoices(many, SID).error);
  assert.ok(cleanVoices([P1], SID).error);
});
test('cleanVoices: không có voices thì trả về rỗng (bài một bước ghi âm)', () => {
  assert.deepEqual(cleanVoices(undefined, SID), { voices: {} });
  assert.deepEqual(cleanVoices({}, SID), { voices: {} });
});
test('mergeVoices: cùng bước thì bản mới thay bản cũ, bước khác giữ nguyên', () => {
  const m = mergeVoices({ s1: { p: P1, t: 'a' }, s5: { p: P5, t: 'b' } }, { s5: { p: P5B, t: 'b' } });
  assert.equal(m.s1.p, P1); assert.equal(m.s5.p, P5B);
  assert.deepEqual(mergeVoices(null, null), {});
});

/* ---------- api/submit-daily.js với máy chủ giả ---------- */
process.env.SUPABASE_URL = 'https://example.supabase.co'; process.env.SUPABASE_SERVICE_KEY = 'test';
const handler = require('../api/submit-daily.js');
const TODAY = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

async function call(body, existingRow) {
  const calls = { post: null, patch: null, selects: 0 };
  global.fetch = async (url, o = {}) => {
    const m = (o.method || 'GET').toUpperCase();
    if (url.includes('/rest/v1/students')) return { json: async () => [{ id: SID }] };
    if (url.includes('/rest/v1/daily_scores') && m === 'GET') { calls.selects++; return { json: async () => existingRow ? [existingRow] : [] }; }
    if (url.includes('/rest/v1/daily_scores') && m === 'POST') { calls.post = JSON.parse(o.body); return { ok: true, text: async () => '' }; }
    if (url.includes('/rest/v1/daily_scores') && m === 'PATCH') { calls.patch = JSON.parse(o.body); return { ok: true, json: async () => [{ id: 1 }] }; }
    if (url.includes('/rest/v1/error_logs')) return { ok: true, text: async () => '' };
    throw new Error('unexpected ' + m + ' ' + url);
  };
  const res = { statusCode: 0, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; }, end() { return this; } };
  await handler({ method: 'POST', headers: {}, body: { student_id: SID, practice_id: 'w5-thu-found11', practice_date: TODAY, section: 'speaking', day_of_week: 'thursday', score: 5, max_score: 13, time_taken_seconds: 600, ...body } }, res);
  return { res, calls };
}
const V = { s1: { p: P1, t: 'Step 1 · Shadowing' }, s5: { p: P5, t: 'Step 5 · Speaking Part 1' } };

test('nộp bài 2 bước ghi âm: voice_path là bản ghi chính, _voices có đủ cả hai bước', async () => {
  const { res, calls } = await call({ answers: { q1: 'a' }, voice_path: P5, voices: V });
  assert.equal(res.statusCode, 200);
  assert.equal(calls.post.voice_path, P5);
  assert.deepEqual(Object.keys(calls.post.answers._voices), ['s1', 's5']);
  assert.equal(calls.post.answers._voices.s1.p, P1);
  assert.equal(calls.post.answers.q1, 'a');
});
test('làm lại bài không ghi âm mới: giữ nguyên _voices và voice_path cũ', async () => {
  const { res, calls } = await call({ answers: { q1: 'b' } }, { id: 1, answers: { _attempts: 1, _voices: V } });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(calls.post.answers._voices, V);
  assert.equal('voice_path' in calls.post, false, 'không ghi đè voice_path khi không có bản ghi mới');
});
test('làm lại bài ghi âm lại một bước: bước đó thay mới, bước kia giữ', async () => {
  const { calls } = await call({ answers: {}, voice_path: P5B, voices: { s5: { p: P5B, t: 'Step 5 · Speaking Part 1' } } }, { id: 1, answers: { _attempts: 1, _voices: V } });
  assert.equal(calls.post.answers._voices.s5.p, P5B);
  assert.equal(calls.post.answers._voices.s1.p, P1);
  assert.equal(calls.post.voice_path, P5B);
});
test('bài một bước ghi âm (không gửi voices): không có _voices, như trước', async () => {
  const { calls } = await call({ answers: { q1: 'a' }, voice_path: P5 });
  assert.equal(calls.post.voice_path, P5);
  assert.equal('_voices' in calls.post.answers, false);
});
test('học sinh tự thêm _voices vào answers thì bị bỏ; đường dẫn của học sinh khác bị từ chối', async () => {
  const forged = await call({ answers: { _voices: { s1: { p: `daily/${OTHER}/x.webm` } } } });
  assert.equal(forged.res.statusCode, 200);
  assert.equal('_voices' in forged.calls.post.answers, false);
  const other = await call({ answers: {}, voices: { s1: { p: `daily/${OTHER}/x.webm`, t: 'x' } } });
  assert.equal(other.res.statusCode, 403);
  assert.equal(other.calls.post, null, 'không lưu gì khi bị từ chối');
});

test('ghi âm lại chỉ gửi voice_path (cách cũ): chỉ cập nhật voice_path', async () => {
  const { res, calls } = await call({ voice_only: true, voice_path: P5 });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(calls.patch, { voice_path: P5 });
  assert.equal(calls.selects, 0, 'không cần đọc bài nộp');
});
test('ghi âm lại một bước (voices): gộp vào _voices, giữ bước khác và các đáp án', async () => {
  const { res, calls } = await call({ voice_only: true, voices: { s1: { p: P5B, t: 'Step 1 · Shadowing' } } }, { id: 1, answers: { q1: 'a', _attempts: 2, _voices: V } });
  assert.equal(res.statusCode, 200);
  assert.equal('voice_path' in calls.patch, false);
  assert.equal(calls.patch.answers._voices.s1.p, P5B);
  assert.equal(calls.patch.answers._voices.s5.p, P5);
  assert.equal(calls.patch.answers.q1, 'a');
  assert.equal(calls.patch.answers._attempts, 2);
});
test('ghi âm lại: thiếu bản ghi, hoặc bài chưa nộp, hoặc đường dẫn lạ thì báo lỗi', async () => {
  assert.equal((await call({ voice_only: true })).res.statusCode, 400);
  assert.equal((await call({ voice_only: true, voices: V })).res.statusCode, 404, 'chưa có bài nộp');
  assert.equal((await call({ voice_only: true, voice_path: `daily/${OTHER}/x.webm` })).res.statusCode, 403);
  assert.equal((await call({ voice_only: true, voices: { s1: { p: `daily/${OTHER}/x.webm` } } })).res.statusCode, 403);
});

/* ---------- phía giáo viên, trợ giảng, xuất ghi âm và trang chủ: chạy đúng đoạn mã trong từng file ---------- */
const fs = require('fs'), vm = require('vm'), path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const between = (src, a, b) => { const i = src.indexOf(a); assert.ok(i >= 0, 'không thấy: ' + a.slice(0, 50)); const j = src.indexOf(b, i); assert.ok(j > i, 'không thấy: ' + b.slice(0, 50)); return src.slice(i, j + b.length); };
const run = (code, ctx) => { vm.createContext(ctx); return vm.runInContext(code, ctx); };
const plain = x => JSON.parse(JSON.stringify(x)); /* đưa dữ liệu từ vm về cùng môi trường để so sánh */
const fakeDb = (voices, fail) => ({ from: t => ({ select: () => ({ in: async () => t === 'daily_scores' ? (fail ? { data: null, error: { message: 'x' } } : { data: voices, error: null }) : { data: [], error: null }, eq: () => ({ gte: async () => ({ data: voices, error: fail ? { message: 'x' } : null }) }) }) }) });
const R1 = { id: 'r1', student_id: 's1', practice_id: 'p', practice_date: '2026-11-12', voice_path: P5, teacher_comment: 'khen', score: 5, max_score: 13, students: { full_name: 'An' } };
const R2 = { id: 'r2', student_id: 's2', practice_id: 'p', practice_date: '2026-11-12', voice_path: P1, teacher_comment: '', score: 3, max_score: 13, students: { full_name: 'Bo' } };
const V2 = { s5: { p: P5, t: 'Step 5 · Speaking Part 1' }, s1: { p: P1, t: 'Step 1 · Shadowing' } };

const td = read('teacher-dashboard.html');
const tabBlock = between(td, '    /* Bài có nhiều bước ghi âm lưu mỗi bản ghi theo bước', '    dailyRows.forEach(r => { r.ai = aiFrom(aiByPath[r.path]); rows.push(r); });');
async function buildRows(a, voices, fail) {
  const ctx = { a: { data: a }, db: fakeDb(voices, fail), titleOf: () => 'Thursday Daily Practice', cls: 'FOUNDATION11' };
  return run(`(async () => { ${tabBlock}\n return rows; })()`, ctx);
}
test('tab Ghi âm: bài 1 bước ghi âm chỉ 1 dòng như cũ', async () => {
  const rows = await buildRows([R1], []);
  assert.equal(rows.length, 1); assert.equal(rows[0].key, 'd' + 'r1'); assert.equal(rows[0].extra, undefined); assert.equal(rows[0].path, P5);
});
test('tab Ghi âm: bài 2 bước ghi âm thành 2 dòng, theo thứ tự bước, nhận xét ở bản ghi chính, dòng phụ dùng chung nhận xét', async () => {
  const rows = await buildRows([R1], [{ id: 'r1', voices: V2 }]);
  assert.deepEqual(plain(rows.map(r => r.key)), ['dr1:s1', 'dr1:s5']);
  assert.deepEqual(plain(rows.map(r => r.path)), [P1, P5]);
  assert.equal(rows[1].extra, undefined, 'bản ghi chính giữ ô nhận xét');
  assert.equal(rows[0].extra, true);
  assert.equal(rows[0].comment, 'khen', 'dòng phụ đọc nhận xét của dòng chính');
  rows[1].comment = 'đã sửa'; assert.equal(rows[0].comment, 'đã sửa');
  assert.match(rows[0].title, /Thursday Daily Practice · Shadowing$/); assert.match(rows[1].title, /· Speaking Part 1$/);
  assert.equal(rows[0].stepId, 's1');
});
test('tab Ghi âm: voice_path cũ không nằm trong _voices thì thêm dòng "bản ghi chính"', async () => {
  const rows = await buildRows([R2], [{ id: 'r2', voices: { s5: { p: P5, t: 'Step 5 · Speaking Part 1' } } }]);
  assert.deepEqual(plain(rows.map(r => r.key)), ['dr2:main', 'dr2:s5']);
  assert.equal(rows[0].extra, undefined); assert.equal(rows[0].path, P1); assert.equal(rows[1].extra, true);
});
test('tab Ghi âm: không lấy được _voices thì vẫn hiện bản ghi chính như cũ', async () => {
  const rows = await buildRows([R1], [], true);
  assert.equal(rows.length, 1); assert.equal(rows[0].path, P5);
});
test('trang giáo viên: subClips liệt kê mọi bản ghi của bài nộp', () => {
  const ctx = {}; run(between(td, '  function subClips(r) {', '    return clips;\n  }'), ctx);
  const two = ctx.subClips({ voice_path: P5, answers: { _voices: V2 } });
  assert.deepEqual(plain(two.map(c => c.path)), [P1, P5]);
  assert.equal(two[0].label, 'Nghe ghi âm: Shadowing');
  assert.equal(ctx.subClips({ voice_path: P5, answers: {} }).length, 1);
  assert.equal(ctx.subClips({ voice_path: null, answers: null }).length, 0);
  assert.equal(ctx.subClips({ voice_path: P1, answers: { _voices: { s5: V2.s5 } } })[0].label, 'Nghe ghi âm (bản ghi chính)');
});

const tg = read('tro-giang.html');
test('tro-giang: mỗi bước ghi âm một đoạn nghe, kèm tên bước', async () => {
  const code = between(tg, '  /* Bài có nhiều bước ghi âm: mỗi bản ghi theo bước nằm trong answers._voices', '  }));\n');
  const rows = [{ ...R1 }, { ...R2, voice_path: null }];
  const ctx = { rows, db: { ...fakeDb([{ id: 'r1', voices: V2 }]), storage: { from: () => ({ createSignedUrl: async p => ({ data: { signedUrl: 'https://u/' + p } }) }) } } };
  await run(`(async () => { ${code} })()`, ctx);
  assert.deepEqual(plain(ctx.rows[0].clips.map(c => c.label)), ['Shadowing', 'Speaking Part 1']);
  assert.ok(ctx.rows[0].clips.every(c => c.url.startsWith('https://u/')));
  assert.equal(ctx.rows[1].clips.length, 0, 'bài không ghi âm thì không có đoạn nghe');
});

const ex = read('api/export-recordings.js');
test('xuất ghi âm: mỗi bước ghi âm một file, tên file không trùng', async () => {
  const collectSrc = between(ex, 'async function collect(cls, from) {', '\n  return out;\n}');
  const ctx = {
    process, JSON, Object, Array, String, Promise, console,
    fetch: async () => ({ json: async () => ({ practices: [{ id: 'p', title: 'Thursday Daily Practice' }] }) }),
    sb: async url => url.includes('daily_scores?select=id,voices') ? { json: async () => [{ id: 'r1', voices: V2 }] }
      : url.includes('daily_scores') ? { json: async () => [{ id: 'r1', practice_date: '2026-11-12', practice_id: 'p', voice_path: P5, students: { full_name: 'An', class_code: 'F11' } }] }
      : { json: async () => [] },
    vnDate: () => '2026-11-12'
  };
  const collect = run('(' + collectSrc + ')', ctx);
  const out = await collect('F11', '2026-11-01');
  assert.equal(out.filter(o => o.src === 'daily').length, 2);
  assert.deepEqual(plain(out.filter(o => o.src === 'daily').map(o => o.step)), ['s1', 's5']);
  const fileName = run('(' + between(ex, 'function fileName(r) {', '\n}') + ')', { DOW: ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'], ascii: s => String(s).replace(/[^A-Za-z0-9]+/g, '-'), Date });
  const names = out.filter(o => o.src === 'daily').map(fileName);
  assert.equal(new Set(names).size, 2, 'hai bước ghi âm phải có hai tên file khác nhau: ' + names.join(' | '));
});

const ix = read('index.html');
test('trang chủ: ghi âm lại ở bất kỳ bước nào (mốc thời gian mới hơn lúc em thấy yêu cầu) thì ẩn thẻ "Cần ghi âm lại"', () => {
  const code = between(ix, '      const vpaths = [', "if (newest > st.seen) return '';");
  const f = (row, voices, seen) => run(`(function () { ${code} return 'show'; })()`, { row, voicesOf: voices, x: { practice_id: 'p', date: '2026-11-12' }, st: { seen }, Math, Object });
  const ts = n => `daily/${SID}/p-s1-${n}.webm`;
  assert.equal(f({ voice_path: ts(1000000000000) }, {}, 2000000000000), 'show', 'bản ghi cũ hơn lúc thấy yêu cầu: vẫn hiện thẻ');
  assert.equal(f({ voice_path: ts(3000000000000) }, {}, 2000000000000), '', 'bản ghi chính mới hơn: ẩn thẻ');
  assert.equal(f({ voice_path: ts(1000000000000) }, { 'p|2026-11-12': { s1: { p: ts(3000000000000) } } }, 2000000000000), '', 'chỉ bước phụ được ghi lại: cũng ẩn thẻ');
  assert.equal(f(undefined, {}, 1), 'show', 'không có bản ghi nào');
});

/* ---------- phương án dự phòng: cú pháp chọn trường JSON bị Supabase từ chối ---------- */
const arrowRejectedDb = answersRows => ({ from: t => ({ select: cols => ({ in: async () => t === 'daily_scores' ? (String(cols).includes('->') ? { data: null, error: { message: 'bad select' } } : { data: answersRows, error: null }) : { data: [], error: null } }) }) });
test('dự phòng: tab Ghi âm vẫn hiện đủ bản ghi theo bước khi cú pháp chọn trường JSON bị từ chối', async () => {
  const ctx = { a: { data: [R1] }, db: arrowRejectedDb([{ id: 'r1', answers: { q1: 'a', _voices: V2 } }]), titleOf: () => 'Thursday Daily Practice', cls: 'FOUNDATION11' };
  const rows = await run(`(async () => { ${tabBlock}\n return rows; })()`, ctx);
  assert.deepEqual(plain(rows.map(r => r.key)), ['dr1:s1', 'dr1:s5']);
});
test('dự phòng: tro-giang vẫn hiện đủ đoạn nghe theo bước', async () => {
  const code = between(tg, '  /* Bài có nhiều bước ghi âm: mỗi bản ghi theo bước nằm trong answers._voices', '  }));\n');
  const ctx = { rows: [{ ...R1 }], db: { ...arrowRejectedDb([{ id: 'r1', answers: { _voices: V2 } }]), storage: { from: () => ({ createSignedUrl: async p => ({ data: { signedUrl: 'https://u/' + p } }) }) } } };
  await run(`(async () => { ${code} })()`, ctx);
  assert.equal(ctx.rows[0].clips.length, 2);
});
test('dự phòng: xuất ghi âm vẫn xuất đủ bản ghi theo bước khi cú pháp chọn trường JSON bị từ chối', async () => {
  const collectSrc = between(ex, 'async function collect(cls, from) {', '\n  return out;\n}');
  const ctx = {
    process, JSON, Object, Array, String, Promise, console, Array,
    fetch: async () => ({ json: async () => ({ practices: [] }) }),
    sb: async url => url.includes('voices:answers') ? { json: async () => ({ message: 'bad select' }) }
      : url.includes('select=id,answers') ? { json: async () => [{ id: 'r1', answers: { _voices: V2 } }] }
      : url.includes('daily_scores') ? { json: async () => [{ id: 'r1', practice_date: '2026-11-12', practice_id: 'p', voice_path: P5, students: { full_name: 'An', class_code: 'F11' } }] }
      : { json: async () => [] },
    vnDate: () => '2026-11-12'
  };
  const out = await run('(' + collectSrc + ')', ctx).call(null, 'F11', '2026-11-01');
  assert.equal(out.filter(o => o.src === 'daily').length, 2);
});
