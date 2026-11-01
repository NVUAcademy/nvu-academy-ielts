/* Dựng Vocab_Quest_Pre.html và Vocab_Quest_Inter.html từ engine của Foundation_Vocab_Quest.html. */
const fs = require('fs'), path = require('path');
const { PRE, INTER, toTsv } = require('./vq-data.js');
const ROOT = path.join(__dirname, '..');
const { FOUND3 } = require('./found3.js');
/* Nguồn: bản Foundation gốc (trước khi thêm Week 3 và EXP) để các chỗ vá luôn khớp */
const SRC = fs.readFileSync(path.join(ROOT, 'Foundation_Vocab_Quest.before-week3.html'), 'utf8');

const SB_URL = 'https://sxnxbbosfyapmmkrhcdj.supabase.co';
const SB_KEY = 'sb_publishable_OMyiSjOVcKOfRdZO9JwSZg_8XogOYkZ';

/* ---------- kiểm tra dữ liệu ---------- */
const escRe = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function check(name, list, perDay) {
  const seen = new Set(); let noGap = [], noCol = [];
  list.forEach((l, i) => {
    const [w, m, ex, topic, type, col] = l.split('|');
    if (seen.has(w.toLowerCase())) throw new Error(name + ': trùng từ ' + w); seen.add(w.toLowerCase());
    const key = w.replace(/^(a|an|the)\s+/i, '');
    const plain = col.replace(/[\[\]]/g, '');
    if (!new RegExp(escRe(key), 'i').test(plain)) noCol.push(w + ' → ' + col);
    if (!new RegExp(escRe(w), 'i').test(ex)) noGap.push(w);
    if ((col.match(/\[/g) || []).length !== 1 || (col.match(/\]/g) || []).length !== 1) throw new Error(name + ': thiếu hoặc thừa [ ] ở ' + w);
  });
  console.log(name + ': ' + list.length + ' từ, ' + Math.ceil(list.length / perDay) + ' ngày');
  if (noCol.length) throw new Error(name + ': collocation không chứa từ khóa:\n' + noCol.join('\n'));
  console.log('  không dùng được câu điền chỗ trống (example không chứa từ gốc): ' + (noGap.join(', ') || 'không'));
}
check('PRE', PRE, 10); check('INTER', INTER, 10);

/* ---------- vá engine ---------- */
function rep(s, from, to, label) {
  const i = s.indexOf(from);
  if (i < 0) throw new Error('Không tìm thấy đoạn cần sửa: ' + (label || from.slice(0, 60)));
  if (s.indexOf(from, i + 1) >= 0 && !label.startsWith('*')) throw new Error('Đoạn cần sửa xuất hiện nhiều lần: ' + label);
  return label.startsWith('*') ? s.split(from).join(to) : s.slice(0, i) + to + s.slice(i + from.length);
}

function engine(s) {
  /* 1. parseVocab: thêm cột collocation */
  s = rep(s, "let cols = ['word','meaning','example','topic','pos'];", "let cols = ['word','meaning','example','topic','pos','colloc'];", 'cols');
  s = rep(s, "pos:['pos','part of speech','type','loại từ']};", "pos:['pos','part of speech','type','loại từ'],colloc:['collocation','collocations','colloc','kết hợp từ']};", 'aliases');
  s = rep(s, "const r={word:'',meaning:'',example:'',topic:'',pos:''};", "const r={word:'',meaning:'',example:'',topic:'',pos:'',colloc:''};", 'rrow');

  /* 2. hàm collocation */
  s = rep(s, "const posKey = v => String(v.pos||'').split(/[ ,]/)[0].toLowerCase();",
`const posKey = v => String(v.pos||'').split(/[ ,]/)[0].toLowerCase();
/* collocation: phần trong [ ] là "bạn đồng hành" (partner) */
const colPartner = v => { const m=String(v.colloc||'').match(/\\[([^\\]]+)\\]/); return m?m[1]:''; };
const colPlain = v => String(v.colloc||'').replace(/[\\[\\]]/g,'');
const colRe = v => new RegExp(escRe(String(v.word).replace(/^(a|an|the)\\s+/i,'')),'i');
const hasCol = v => !!v.colloc && colRe(v).test(colPlain(v));
const hasCol2 = v => hasCol(v) && !!colPartner(v);
const colBlank = v => colPlain(v).replace(colRe(v),'________');
const colBlank2 = v => String(v.colloc).replace(/\\[[^\\]]+\\]/,'________');
function colOpts(w, dir, pool){
  if(dir==='col2'){ const seen=new Set([colPartner(w).toLowerCase()]); const out=[];
    for(const v of shuffle(pool.filter(x=>x.id!==w.id&&colPartner(x)))){ const p=colPartner(v).toLowerCase(); if(seen.has(p)) continue; seen.add(p); out.push(v.id); if(out.length>=3) break; }
    return shuffle([w.id,...out]); }
  return shuffle([w.id,...distract(w,pool).map(v=>v.id)]);
}`, 'posKey');

  /* 3. stage Collocation */
  s = rep(s, "const STAGE_DEFS = [", "const STAGE_BASE = [", 'STAGE_DEFS');
  s = rep(s, "name:'Học 20 từ'", "name:'Học '+CFG.perDay+' từ'", 'learn name');
  s = rep(s, "const cur = () => weekOf(S.week);",
`const STAGE_DEFS = STAGE_BASE.flatMap(s=> s.k==='gap' && CFG.colloc ? [s,{k:'colloc', ic:'🔗', name:'Collocation', en:'Collocation', desc:'Chọn từ đi cùng để hoàn thành cụm từ (collocation).'}] : [s]);
const cur = () => weekOf(S.week);`, 'cur');
  s = rep(s, "kind==='gap' ? Math.min(10, dayWords().filter(hasGap).length) :", "kind==='gap' ? Math.min(10, dayWords().filter(hasGap).length) : kind==='colloc' ? Math.min(10, dayWords().filter(hasCol).length) :", 'needFor');
  s = rep(s, "s.k==='quiz'||s.k==='gap'||s.k==='spell' ? `${s.desc} Cần đúng", "s.k==='quiz'||s.k==='gap'||s.k==='colloc'||s.k==='spell' ? `${s.desc} Cần đúng", 'dayView desc');

  /* 4. quiz: collocation */
  s = rep(s, "if(kind==='gap') src=byMiss(ws.filter(hasGap)).slice(0,10); else src=ws;", "if(kind==='gap') src=byMiss(ws.filter(hasGap)).slice(0,10); else if(kind==='colloc') src=byMiss(ws.filter(hasCol)).slice(0,10); else src=ws;", 'quizStart src');
  s = rep(s, "const dirs = kind==='gap' ? src.map(()=> 'gap') : shuffle(src.map((_,i)=> i%2?'w2m':'m2w'));", "const dirs = kind==='gap' ? src.map(()=> 'gap') : kind==='colloc' ? src.map((w,i)=> (i%2&&hasCol2(w))?'col2':'col') : shuffle(src.map((_,i)=> i%2?'w2m':'m2w'));", 'quizStart dirs');
  s = rep(s, "opts:shuffle([w.id,...distract(w,pool).map(v=>v.id)])})));", "opts:(dirs[i]==='col'||dirs[i]==='col2')?colOpts(w,dirs[i],pool):shuffle([w.id,...distract(w,pool).map(v=>v.id)])})));", 'quizStart opts');
  s = rep(s, "const title = q.kind==='gap' ? 'Fill the gap' : 'Meaning quiz';", "const title = q.kind==='gap' ? 'Fill the gap' : q.kind==='colloc' ? 'Collocation' : 'Meaning quiz';", 'quizView title');
  s = rep(s, "const prompt = c.dir==='w2m' ? `<p class=\"small muted\">Từ này nghĩa là gì?</p>",
    "const prompt = c.dir==='col' ? `<p class=\"small muted\">Chọn từ điền vào cụm từ (collocation).</p><p style=\"font-size:21px;font-family:var(--display)\">${esc(colBlank(v))}</p><p class=\"small muted\">${esc(v.meaning)}</p>`\n    : c.dir==='col2' ? `<p class=\"small muted\">Chọn từ đi cùng với <b>${esc(v.word)}</b>.</p><p style=\"font-size:21px;font-family:var(--display)\">${esc(colBlank2(v))}</p>`\n    : c.dir==='w2m' ? `<p class=\"small muted\">Từ này nghĩa là gì?</p>", 'quizView prompt');
  s = rep(s, "const label = id => c.dir==='w2m' ? W(id).meaning : W(id).word;", "const label = id => c.dir==='w2m' ? W(id).meaning : c.dir==='col2' ? colPartner(W(id)) : W(id).word;", 'quizView label');
  s = rep(s, "${v.example&&c.dir!=='gap'?`<br><i>${esc(v.example)}</i>`:''}", "${(c.dir==='col'||c.dir==='col2')?`<br><b>${esc(colPlain(v))}</b>`:(v.example&&c.dir!=='gap'?`<br><i>${esc(v.example)}</i>`:'')}", 'quizView notice');

  s = rep(s, "case 'quiz': case 'gap': return quizView();", "case 'quiz': case 'gap': case 'colloc': return quizView();", 'view switch');

  /* 5. stageStart */
  s = rep(s, "if(k==='learn') learnStart(); else if(k==='quiz'||k==='gap') quizStart(k);",
    "if(k==='colloc' && dayWords().filter(hasCol).length<3){ recordStage('colloc',{score:0,max:0}); const r=dayRec().st.colloc; if(r) r.skip=true; saveProg(); return nextStageAfter('colloc'); }\n  if(k==='learn') learnStart(); else if(k==='quiz'||k==='gap'||k==='colloc') quizStart(k);", 'stageStart');

  /* 6. battle / boss: câu hỏi collocation */
  s = rep(s, "const kinds=['w2m','m2w'].concat(hasGap(w)?['gap']:[]);\n  return {id:w.id, dir:pick(kinds), opts:shuffle([w.id,...distract(w,pool).map(v=>v.id)])};",
`const kinds=['w2m','m2w'].concat(hasGap(w)?['gap']:[]);
  if(CFG.colloc){ const wt=(B.st&&B.st.boss)?4:3; for(let i=0;i<wt;i++){ if(hasCol(w)) kinds.push('col'); if(hasCol2(w)) kinds.push('col2'); } }
  const dir=pick(kinds);
  return {id:w.id, dir, opts:(dir==='col'||dir==='col2')?colOpts(w,dir,pool):shuffle([w.id,...distract(w,pool).map(v=>v.id)])};`, 'wordQ');
  s = rep(s, ": q.dir==='w2m' ? `<p class=\"small muted\">What does this word mean?</p>",
    ": q.dir==='col' ? `<p class=\"small muted\">Collocation: choose the missing word.</p><p style=\"font-size:20px;font-family:var(--display)\">${esc(colBlank(v))}</p><p class=\"small muted\">${esc(v.meaning)}</p>`\n    : q.dir==='col2' ? `<p class=\"small muted\">Which word goes with <b>${esc(v.word)}</b>?</p><p style=\"font-size:20px;font-family:var(--display)\">${esc(colBlank2(v))}</p>`\n    : q.dir==='w2m' ? `<p class=\"small muted\">What does this word mean?</p>", 'battle prompt');
  s = rep(s, "const label = id => q.sound ? q.opts[Number(id)] : q.dir==='w2m' ? W(id).meaning : W(id).word;", "const label = id => q.sound ? q.opts[Number(id)] : q.dir==='w2m' ? W(id).meaning : q.dir==='col2' ? colPartner(W(id)) : W(id).word;", 'battle label');
  s = rep(s, "${B.ans&&!q.sound&&B.ans!==q.id?`<p class=\"small\"><b>${esc(v.word)}</b>: ${esc(v.meaning)}</p>`:''}", "${B.ans&&!q.sound&&B.ans!==q.id?`<p class=\"small\"><b>${esc(v.word)}</b>: ${esc(v.meaning)}${(q.dir==='col'||q.dir==='col2')?' · <b>'+esc(colPlain(v))+'</b>':''}</p>`:''}", 'battle feedback');

  /* 7. EXP / điểm / cấp độ lưu trong tiến độ nhân vật */
  s = rep(s, "function saveProg(){ if(S.profile) ls.set('prog:'+nameKey(S.profile.name), S.prog); }",
`const XP_PER_LV = 120;
const lvOf = xp => Math.floor((xp||0)/XP_PER_LV)+1;
const STAGE_XP = {learn:5, quiz:10, gap:10, colloc:15, spell:10, battle:25, sound:15};
function xpAdd(amt, pts=0, quiet=false){
  const p=S.prog; if(!p) return 0; const old=lvOf(p.xp); p.xp=(p.xp||0)+amt; p.pts=(p.pts||0)+pts;
  p.daily ||= {}; const r=p.daily[today()] ||= {xp:0,pts:0,battles:0,wins:0}; r.xp+=amt; r.pts+=pts;
  if(!quiet && amt>0){ toast(lvOf(p.xp)>old ? '🎉 Lên cấp '+lvOf(p.xp)+'! (+'+amt+' EXP)' : '⭐ +'+amt+' EXP'); }
  return amt;
}
function xpOnce(key, amt, pts=0){ const dr=dayRec(); dr.xpGot ||= {}; if(dr.xpGot[key]) return 0; dr.xpGot[key]=amt; return xpAdd(amt, pts); }
const dayXp = dr => Object.values((dr&&dr.xpGot)||{}).reduce((a,b)=>a+b,0);
const daysDone = () => Object.values((S.prog&&S.prog.days)||{}).filter(d=>d&&d.fin).length;
/* Đồng bộ lên Supabase theo tài khoản đăng nhập (nếu có) */
const LOGIN = (()=>{ try{ return JSON.parse(localStorage.getItem('nvu_student')||'null'); }catch{ return null; } })();
const VQDB = (LOGIN && window.supabase) ? window.supabase.createClient('${SB_URL}','${SB_KEY}') : null;
let syncT=null;
function syncPush(){ if(!VQDB||!LOGIN||!S.prog) return; clearTimeout(syncT); syncT=setTimeout(async()=>{ try{
  await VQDB.from('vocab_progress').upsert({student_id:LOGIN.id, game_id:CFG.id, xp:S.prog.xp||0, points:S.prog.pts||0, level:lvOf(S.prog.xp), days_done:daysDone(), prog:S.prog, updated_at:new Date().toISOString()},{onConflict:'student_id,game_id'}); }catch(e){} },900); }
function mergeProg(a,b){ const out={...b,...a}; out.days={...(b.days||{})};
  for(const [k,v] of Object.entries(a.days||{})){ const r=out.days[k]; if(!r || (!!v.fin&&!r.fin) || (!!v.fin===!!r.fin && Object.keys(v.st||{}).length>=Object.keys(r.st||{}).length)) out.days[k]=v; }
  out.xp=Math.max(a.xp||0,b.xp||0); out.pts=Math.max(a.pts||0,b.pts||0); out.daily={...(b.daily||{})};
  for(const [d,v] of Object.entries(a.daily||{})){ const r=out.daily[d]; out.daily[d]= r ? {xp:Math.max(r.xp,v.xp),pts:Math.max(r.pts,v.pts),battles:Math.max(r.battles||0,v.battles||0),wins:Math.max(r.wins||0,v.wins||0)} : v; }
  return out; }
async function syncPull(){ if(!VQDB||!LOGIN||!S.prog||!S.profile) return; try{
  const {data}=await VQDB.from('vocab_progress').select('prog,xp').eq('student_id',LOGIN.id).eq('game_id',CFG.id).maybeSingle();
  if(data&&data.prog){ S.prog=mergeProg(S.prog,data.prog); ls.set('prog:'+nameKey(S.profile.name), S.prog); render(); }
  syncPush(); }catch(e){} }
function saveProg(){ if(S.profile) ls.set('prog:'+nameKey(S.profile.name), S.prog); syncPush(); }`, 'saveProg');

  /* recordStage: cộng EXP lần đầu qua màn trong ngày */
  s = rep(s, "const prev=dr.st[k]; dr.st[k]={ok:true, score:r.score, max:r.max, ts:new Date().toISOString(), best:Math.max(r.score, prev&&prev.best||0)};\n  saveProg();",
`const prev=dr.st[k]; dr.st[k]={ok:true, score:r.score, max:r.max, ts:new Date().toISOString(), best:Math.max(r.score, prev&&prev.best||0)};
  if(!(prev&&prev.ok)){ let amt=STAGE_XP[k]||10; if(k==='battle'){ try{ if(foeFor('battle',S.day).boss) amt+=25; }catch(e){} } xpOnce('st-'+k, amt, r.score||0); }
  saveProg();`, 'recordStage');
  /* battle: EXP theo từng câu đúng (tối đa 20 câu/ngày), thống kê trận */
  s = rep(s, "if(choice===ck && B.ehp<=0){ B.correct++;", "if(choice===ck){ const dr=dayRec(); dr.bc=(dr.bc||0)+1; xpAdd(dr.bc<=20?2:0, 1, true); }\n  if(choice===ck && B.ehp<=0){ B.correct++;", 'battleAnswer xp');
  s = rep(s, "S.B=B; S.view=kind; dayRec().att[kind]=(dayRec().att[kind]||0)+1; saveProg(); beep(520); qTimerStart();", "B.xp0=(S.prog.xp||0); S.B=B; S.view=kind; dayRec().att[kind]=(dayRec().att[kind]||0)+1; saveProg(); beep(520); qTimerStart();", 'battleStart');
  s = rep(s, "if(won) recordStage(B.kind, {score:B.correct, max:B.asked});", "{ const dd=(S.prog.daily ||= {})[today()] ||= {xp:0,pts:0,battles:0,wins:0}; dd.battles=(dd.battles||0)+1; if(won) dd.wins=(dd.wins||0)+1; }\n  if(won) recordStage(B.kind, {score:B.correct, max:B.asked});\n  B.xpGain=(S.prog.xp||0)-(B.xp0||0); saveProg();", 'battleEnd');
  s = rep(s, "<span class=\"big-score\">${B.correct} / ${B.asked}</span>\n      <span>${ok?`Em đã đánh bại", "<span class=\"big-score\">${B.correct} / ${B.asked}</span><span class=\"chip good\">⭐ +${B.xpGain||0} EXP · Lv ${lvOf(S.prog.xp)}</span>\n      <span>${ok?`Em đã đánh bại", 'battle result');
  /* hoàn thành ngày */
  s = rep(s, "dr.fin={ts, date:today(), mastered, review, code:h.toString(36).toUpperCase().padStart(5,'0').slice(-5)};\n  saveProg();", "dr.fin={ts, date:today(), mastered, review, code:h.toString(36).toUpperCase().padStart(5,'0').slice(-5)};\n  xpOnce('day', 30+mastered*2, mastered);\n  saveProg();", 'finishDay');

  /* hiển thị cấp độ ở thanh trên */
  s = rep(s, "<span class=\"small muted\">The ${esc(HEROES[S.profile.hero].name)}</span></div><div class=\"acts\">${extra}<button class=\"btn sm ghost\" data-a=\"switch\">Đổi học sinh</button></div></div>`;",
    "<span class=\"small muted\">The ${esc(HEROES[S.profile.hero].name)}</span><span class=\"small\">⭐ Lv ${lvOf(S.prog.xp)} · ${(S.prog.xp||0)} EXP · ${(S.prog.pts||0)} điểm</span><div style=\"max-width:200px\">${bar(pct((S.prog.xp||0)%XP_PER_LV,XP_PER_LV),'butter')}</div></div><div class=\"acts\">${extra}${LOGIN?'':'<button class=\"btn sm ghost\" data-a=\"switch\">Đổi học sinh</button>'}</div></div>`;", 'topbar');
  /* phiếu tổng kết */
  s = rep(s, "['♪ Sound Duel', 'Thắng '+res('sound')+attempts('sound')]];", "['♪ Sound Duel', 'Thắng '+res('sound')+attempts('sound')],['⭐ EXP ngày này', '+'+dayXp(dr)+' EXP · Lv '+lvOf(S.prog.xp)]];", 'summary rows');
  s = rep(s, "['▭ Fill the gap', res('gap')+attempts('gap')],", "['▭ Fill the gap', res('gap')+attempts('gap')],...(CFG.colloc?[['🔗 Collocation', res('colloc')+attempts('colloc')]]:[]),", 'summary colloc');
  s = rep(s, "Quiz ${r('quiz')} · Gap ${r('gap')} · Spell ${r('spell')} · Battle ✓ · Sound ✓\\n", "Quiz ${r('quiz')} · Gap ${r('gap')}${CFG.colloc?' · Colloc '+r('colloc'):''} · Spell ${r('spell')} · Battle ✓ · Sound ✓\\n⭐ +${dayXp(dr)} EXP · Lv ${lvOf(S.prog.xp)} (${S.prog.xp||0} EXP)\\n", 'zalo');

  /* 8. đăng nhập tự nhận học sinh, không cần nhập tên */
  s = rep(s, "const last=ls.get('last',null);\n  if(last && loadProfile(last)){ S.view='home'; }", "let last=ls.get('last',null); if(LOGIN) last=nameKey(LOGIN.name);\n  /* Đăng nhập lần đầu mà máy chỉ có một hồ sơ cũ (nhập tên tay): nhận hồ sơ đó cho tài khoản này để không mất tiến độ */\n  if(LOGIN){ const all=ls.get('profiles',{}), ks=Object.keys(all); if(!all[last] && ks.length===1){ const old=ks[0]; all[last]={name:LOGIN.name, hero:all[old].hero}; ls.set('profiles',all); ls.set('prog:'+last, ls.get('prog:'+old,{days:{}})); } }\n  if(CFG.classes && LOGIN && LOGIN.classCode && !CFG.classes.includes(LOGIN.classCode)){ const to=({FOUNDATION11:'Foundation_Vocab_Quest.html',FOUNDATION12:'Foundation_Vocab_Quest.html',IELTS13:'Vocab_Quest_Pre.html',IELTS14:'Vocab_Quest_Inter.html'})[LOGIN.classCode]; if(to) { location.replace(to); return; } }\n  if(last && loadProfile(last)){ S.view='home'; }", 'boot');
  s = rep(s, "if(S.view==='home') greetNow(true);\n}", "if(S.view==='home') greetNow(true);\n  syncPull();\n}", 'boot end');
  s = rep(s, "value=\"${esc(S.ui.nameDraft)}\">", "value=\"${esc(LOGIN?LOGIN.name:S.ui.nameDraft)}\" ${LOGIN?'readonly':''}>", 'welcome name');
  s = rep(s, "Tiến độ được lưu ngay trên điện thoại này.", "Tiến độ, EXP và cấp độ của em được lưu theo tài khoản.", 'welcome text');
  s = rep(s, "${saved.length?`<div class=\"stack\"", "${(saved.length&&!LOGIN)?`<div class=\"stack\"", 'welcome saved');
  s = rep(s, "S.prog=ls.get('prog:'+key,{days:{}}); if(!S.prog.days) S.prog={days:{}}; saveProfiles(); saveProg(); S.view='home'; S.ui.nameDraft=''; S.ui.pickHero=null; render(); greetNow(); return; }",
    "S.prog=ls.get('prog:'+key,{days:{}}); if(!S.prog.days) S.prog={days:{}}; saveProfiles(); saveProg(); S.view='home'; S.ui.nameDraft=''; S.ui.pickHero=null; render(); greetNow(); syncPull(); return; }", 'start');

  /* 9. chữ cứng "20 từ" */
  s = rep(s, "· mỗi ngày 20 từ", "· mỗi ngày ${CFG.perDay} từ", 'per day text');
  s = rep(s, "qua 6 màn.", "qua ${STAGE_DEFS.length} màn.", 'six stages');
  s = rep(s, "['📖 Học 20 từ', '✓']", "['📖 Học '+CFG.perDay+' từ', '✓']", 'summary learn');

  /* 9b. nghe từ: lấy file mp3 của Oxford cho từ đơn, lỗi thì dùng giọng máy */
  s = rep(s, "function sayAloud(text){",
`let wordAudio=null;
function sayAloud(text){
  const w=String(text).trim().toLowerCase();
  if(!/^[a-z]+$/.test(w)) return sayAloudTTS(text);
  const fail=()=>sayAloudTTS(text);
  try{ if(wordAudio) wordAudio.pause(); }catch{}
  const a=new Audio('https://www.oxfordlearnersdictionaries.com/media/english/us_pron/'+w[0]+'/'+w.slice(0,3)+'/'+w.slice(0,5)+'/'+w+'__us_1.mp3');
  a.onerror=fail; wordAudio=a;
  const p=a.play(); if(p&&p.catch) p.catch(fail);
}
function sayAloudTTS(text){`, 'sayAloud');

  /* 10. hiển thị collocation ở bảng từ và mặt sau thẻ học */
  s = rep(s, "<th>Từ</th><th>Nghĩa</th><th>Ví dụ</th></tr></thead>", "<th>Từ</th><th>Nghĩa</th><th>Ví dụ</th>${CFG.colloc?'<th>Collocation</th>':''}</tr></thead>", 'words thead');
  s = rep(s, "${esc(v.example||'')}</td></tr>`).join('')}</tbody>", "${esc(v.example||'')}</td>${CFG.colloc?`<td class=\"wrap\"><b>${esc(colPlain(v))}</b></td>`:''}</tr>`).join('')}</tbody>", 'words row');
  s = rep(s, "${v.example?`<i>${esc(v.example)}</i>`:''}<div class=\"say-row\">${sayBtn(v.word,'🔊 Từ','Nghe từ')}", "${v.example?`<i>${esc(v.example)}</i>`:''}${v.colloc?`<span class=\"small\">🔗 <b>${esc(colPlain(v))}</b></span>`:''}<div class=\"say-row\">${sayBtn(v.word,'🔊 Từ','Nghe từ')}", 'flash back');
  return s;
}

/* ---------- dựng file ---------- */
const lines = SRC.split('\n');
const ci = lines.findIndex(l => l.startsWith('const CFG = '));
let cfgText = lines[ci].slice('const CFG = '.length).trim(); if (cfgText.endsWith(';')) cfgText = cfgText.slice(0, -1);
const BASE = JSON.parse(cfgText);

function build(out, opts) {
  const cfg = opts.foundation
    /* Foundation: giữ cấu hình gốc và Week 1, thêm Week 3; có EXP nhưng không có collocation */
    ? { ...BASE, colloc: false, classes: opts.classes, weeks: [...BASE.weeks.filter(w => w.week !== 3), { week: 3, tsv: toTsv(FOUND3, 5) }] }
    : { ...BASE, id: opts.id, cls: opts.cls, title: opts.title, perDay: 10, pass: 0.8, lockByDate: true, colloc: true, classes: opts.classes,
      weeks: [{ week: 1, tsv: toTsv(opts.list) }] };
  const L = lines.slice(); L[ci] = 'const CFG = ' + JSON.stringify(cfg) + ';';
  let s = L.join('\n');
  s = engine(s);
  s = s.split('Foundation Vocab').join(opts.title);
  s = rep(s, '<head>', '<head>\n<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>', 'head');
  fs.writeFileSync(path.join(ROOT, out), s);
  console.log('Wrote', out, (s.length / 1024).toFixed(0) + 'KB');
}
build('Vocab_Quest_Pre.html', { id: 'ielts13', cls: 'IELTS 13 (Pre-IELTS)', title: 'Pre-IELTS Vocab', classes: ['IELTS13'], list: PRE });
build('Vocab_Quest_Inter.html', { id: 'ielts14', cls: 'IELTS 14 (Intermediate)', title: 'Intermediate Vocab', classes: ['IELTS14'], list: INTER });
build('Foundation_Vocab_Quest.html', { foundation: true, title: 'Foundation Vocab', classes: ['FOUNDATION11', 'FOUNDATION12'] });
