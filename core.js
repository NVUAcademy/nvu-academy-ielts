/* =========================================================
   Vocab Quest — mỗi ngày 20 từ, 6 màn chơi, phiếu tổng kết để chụp gửi Zalo.
   Không cần tài khoản: tiến độ lưu trên thiết bị của học sinh.
   ========================================================= */
const $ = (s,r=document)=>r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct = (a,b) => b ? Math.round(a/b*100) : 0;
const posChip = p => p ? `<span class="chip pos">${esc(p)}</span>` : '';
const bar = (p,color) => `<div class="bar" role="progressbar" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100"><i style="width:${p}%;${color?`--bc:var(--${color})`:''}"></i></div>`;
const win = (title,body,color='',extra='',tag='h2') => `<section class="win ${color?'c-'+color:''}"><header class="win-bar"><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span><${tag}>${title}</${tag}><span class="grow"></span>${extra}</header><div class="win-body">${body}</div></section>`;
const empty = (msg,btn='') => `<div class="empty"><span>${msg}</span>${btn}</div>`;
let toastT; function toast(m){const t=$('#toast');t.textContent=m;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>t.hidden=true,3200)}
function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
const pick = a => a[Math.floor(Math.random()*a.length)];
const escRe = s => String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
let audioCtx=null;
function beep(f=880){ try{ audioCtx ||= new (window.AudioContext||window.webkitAudioContext)(); const o=audioCtx.createOscillator(), g=audioCtx.createGain(); o.frequency.value=f; o.type='square'; g.gain.value=.06; o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime+.25);}catch{} }
const KEY = k => 'vq:'+CFG.id+':'+k;
const ls = { get(k,d){try{const v=localStorage.getItem(KEY(k));return v==null?d:JSON.parse(v)}catch{return d}}, set(k,v){try{localStorage.setItem(KEY(k),JSON.stringify(v))}catch{}}, del(k){try{localStorage.removeItem(KEY(k))}catch{}} };
const today = () => new Date().toLocaleDateString('en-CA');
const pad = n => String(n).padStart(2,'0');
const fmtTime = iso => { const d=new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} · ${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`; };
const drawSprites = () => {};

/* ---------- vocabulary ---------- */
/*PARSE_VOCAB*/
const WEEKS = CFG.weeks.map(w=>{
  const words = parseVocab(w.tsv).map((r,i)=>({...r, id:`w${w.week}-${String(i+1).padStart(3,'0')}`, week:w.week}));
  const days=[]; for(let i=0;i<words.length;i+=CFG.perDay) days.push(words.slice(i,i+CFG.perDay));
  if(days.length>1 && days[days.length-1].length < Math.ceil(CFG.perDay/3)){ const last=days.pop(); days[days.length-1]=days[days.length-1].concat(last); }
  return {week:w.week, words, days};
});
const hasGap = v => v.example && new RegExp(escRe(v.word),'i').test(v.example);
const posKey = v => String(v.pos||'').split(/[ ,]/)[0].toLowerCase();

/* ---------- heroes, voices, sound bank, battlefield FX (shared with the full app) ---------- */
/*HERO_BLOCK*/
const HERO_IMG = CFG.img.heroes, FOE_IMG = CFG.img.foes;
const heroCv = (kind, cls='') => { const k=HEROES[kind]?kind:'knight'; return `<img src="${HERO_IMG[k]}" alt="${esc(HEROES[k].name)}" class="hero-cv ${cls}" width="200" height="200" decoding="async">`; };
/*SOUND_BLOCK*/
/*FX_BLOCK*/

/* ---------- battle stages ---------- */
const STAGES = [
 {name:'Village Outskirts', foe:'Goblin Scout',      img:'goblin'},
 {name:'Whispering Woods',  foe:'Grey Wolf',         img:'wolf'},
 {name:'Bandit Pass',       foe:'Bandit Captain',    img:'bandit'},
 {name:'Troll Bridge',      foe:'Bridge Troll',      img:'troll'},
 {name:'Castle Gate',       foe:'The Black Knight',  img:'blackknight', boss:1},
 {name:'Haunted Crypt',     foe:'Crypt Goblin King', img:'goblin',      filter:'grayscale(.55) hue-rotate(200deg) brightness(.92) contrast(1.1)'},
 {name:'Frozen Peak',       foe:'Frost Wolf',        img:'wolf',        filter:'hue-rotate(180deg) saturate(.55) brightness(1.18)'},
 {name:'Smugglers’ Cove',   foe:'Bandit Warlord',    img:'bandit',      filter:'sepia(.35) hue-rotate(-25deg) saturate(1.3) contrast(1.1)'},
 {name:'Ember Keep',        foe:'Ember Troll',       img:'troll',       filter:'sepia(.5) hue-rotate(-35deg) saturate(1.8) brightness(1.05)'},
 {name:'Throne of Shadows', foe:'The Crimson Knight',img:'blackknight', filter:'sepia(.4) saturate(2.4) hue-rotate(-30deg) brightness(1.15)', boss:1}
];
const foeImg = (st, cls='') => `<img src="${FOE_IMG[st.img]}" alt="${esc(st.foe)}" class="foe-cv ${cls}" width="200" height="200" decoding="async" ${st.filter?`style="filter:${st.filter}"`:''}>`;
const QPS = 10;
const critAt = kind => kind==='prince' ? 1 : 2;
function foeFor(kind, day){ // word battle = realm stage `day`; sound duel = a different foe from the second half of the realm
  const base = STAGES[(day-1 + (kind==='sound'?5:0)) % STAGES.length];
  const boss = !!base.boss;
  return {...base, need: Math.min(8, 4 + Math.ceil(day/3) + (boss?1:0)), atk: 4 + Math.floor(day/2) + (boss?2:0)};
}
const heroStats = kind => ({max: 24 + ((HEROES[kind]||{}).hp||0), dmg: 4});

/* ---------- state ---------- */
const S = { ui:{greet:null, greeted:false, pickHero:null, nameDraft:''}, view:'boot', profile:null, prog:null, week:null, day:null, play:null, B:null };
const OPEN_ALL = /#open/i.test(location.hash);
const weekOf = n => WEEKS.find(w=>w.week===n) || WEEKS[WEEKS.length-1];
const nameKey = n => String(n||'').trim().toLowerCase().replace(/\s+/g,' ');
const dayKey = (w,d) => `w${w}d${d}`;
function dayRec(w=S.week, d=S.day){ const k=dayKey(w,d); const days=S.prog.days; return days[k] ||= {st:{}, att:{}, miss:{}, fin:null}; }
function saveProg(){ if(S.profile) ls.set('prog:'+nameKey(S.profile.name), S.prog); }
function saveProfiles(){ const all=ls.get('profiles',{}); all[nameKey(S.profile.name)]={name:S.profile.name, hero:S.profile.hero}; ls.set('profiles',all); ls.set('last',nameKey(S.profile.name)); }
function loadProfile(key){
  const all=ls.get('profiles',{}); const p=all[key]; if(!p) return false;
  S.profile={name:p.name, hero:p.hero}; S.prog=ls.get('prog:'+key,{days:{}}); if(!S.prog.days) S.prog={days:{}};
  ls.set('last',key); return true;
}
const STAGE_DEFS = [
  {k:'learn', ic:'📖', name:'Học 20 từ', en:'Learn', desc:'Nghe, đọc theo, lật thẻ từng từ.'},
  {k:'quiz',  ic:'✎',  name:'Quiz nghĩa', en:'Meaning quiz', desc:'Mỗi từ một câu, chọn đáp án đúng.'},
  {k:'gap',   ic:'▭',  name:'Điền vào chỗ trống', en:'Fill the gap', desc:'Chọn từ phù hợp với câu.'},
  {k:'spell', ic:'✍',  name:'Viết đúng chính tả', en:'Spell it', desc:'Nhìn nghĩa, gõ lại từ.'},
  {k:'battle',ic:'⚔',  name:'Word Battle', en:'Word Battle', desc:'Đánh bại quái vật bằng từ vựng.'},
  {k:'sound', ic:'♪',  name:'Sound Duel', en:'Sound Duel', desc:'Nghe và chọn âm đúng.'}
];
const cur = () => weekOf(S.week);
const dayWords = (w=S.week,d=S.day) => weekOf(w).days[d-1] || [];
function needFor(kind){
  const n = kind==='quiz' ? dayWords().length : kind==='gap' ? Math.min(10, dayWords().filter(hasGap).length) : Math.min(10, dayWords().length);
  return {n, need: Math.max(1, Math.ceil(n*CFG.pass))};
}
const stageOK = (dr,k) => !!(dr.st[k] && dr.st[k].ok);
const allDone = dr => STAGE_DEFS.every(s=>stageOK(dr,s.k));
const dayDone = (w,d) => !!(S.prog.days[dayKey(w,d)] && S.prog.days[dayKey(w,d)].fin);
function dayLock(w,d){ // returns '' if open, otherwise a message
  if(OPEN_ALL || d===1) return '';
  const prev=S.prog.days[dayKey(w,d-1)];
  if(!prev || !prev.fin) return `Hoàn thành Day ${d-1} trước`;
  if(CFG.lockByDate && prev.fin.date===today()) return 'Mở vào ngày mai';
  return '';
}

/* ---------- boot & views ---------- */
function boot(){
  S.week = WEEKS[WEEKS.length-1].week;
  const last=ls.get('last',null);
  if(last && loadProfile(last)){ S.view='home'; }
  else S.view='welcome';
  render();
  if(S.view==='home') greetNow(true);
}
function greetNow(quiet){ if(!S.profile) return; S.ui.greeted=true; showGreeting(S.profile.hero, heroLine(S.profile.hero, S.profile.name)); }
function render(){
  const app=$('#app'); const keep={}; app.querySelectorAll('input[id]').forEach(el=>{ keep[el.id]=el.value; });
  app.innerHTML = view();
  Object.entries(keep).forEach(([id,v])=>{ const el=document.getElementById(id); if(el && !el.dataset.fresh) el.value=v; });
  fxStart();
}
function view(){
  switch(S.view){
    case 'welcome': return welcomeView();
    case 'home': return homeView();
    case 'day': return dayView();
    case 'words': return wordsView();
    case 'learn': return learnView();
    case 'quiz': case 'gap': return quizView();
    case 'spell': return spellView();
    case 'battle': case 'sound': return battleView();
    case 'summary': return summaryView();
  }
  return '';
}
const topbar = (extra='') => `<div class="vq-top cue"><div>${heroCv(S.profile.hero,'bob')}</div><div class="vq-who"><span class="eyebrow">${esc(CFG.cls)}</span><b>${esc(S.profile.name)}</b><span class="small muted">The ${esc(HEROES[S.profile.hero].name)}</span></div><div class="acts">${extra}<button class="btn sm ghost" data-a="switch">Đổi học sinh</button></div></div>`;

function welcomeView(){
  const saved=Object.values(ls.get('profiles',{}));
  const cur_=S.ui.pickHero || 'princess', h=HEROES[cur_];
  return `<div class="gate-hero"><span class="crown" aria-hidden="true">♛</span><h1>${esc(CFG.title)}</h1><p class="pixel muted">${esc(CFG.cls)} · mỗi ngày 20 từ</p></div>
  ${win('Chào mừng! Welcome', `<p class="muted" style="text-align:center">Nhập tên của em và chọn nhân vật. Tiến độ được lưu ngay trên điện thoại này.</p>
    <div class="stack" style="align-items:center"><input class="nm-in" id="nm" type="text" maxlength="40" placeholder="Họ và tên (ví dụ: Nguyễn Văn An)" autocomplete="name" value="${esc(S.ui.nameDraft)}"></div>
    ${saved.length?`<div class="stack" style="align-items:center"><span class="small muted">Đã có trên máy này:</span><div class="sel-list">${saved.map(p=>`<button class="btn sm" data-a="use-profile" data-v="${esc(nameKey(p.name))}">${esc(p.name)}</button>`).join('')}</div></div>`:''}
    <div class="hero-grid">${HERO_KEYS.map(k=>{const x=HEROES[k];return `<button class="hero-card-pick c-${x.color} ${k===cur_?'on':''}" data-a="hero-pick" data-v="${k}" aria-pressed="${k===cur_}">${heroCv(k,'bob')}<b>${x.name}</b><span class="eyebrow">${x.ability}</span></button>`;}).join('')}</div>
    <div class="hero-detail c-${h.color}">${heroCv(cur_,'big bob')}<div class="stack"><span class="eyebrow">${esc(h.title)}</span><span class="hello" style="font-size:clamp(30px,5vw,42px)">The ${esc(h.name)}</span>
      <div class="row"><span class="chip lilac">${esc(h.ability)}</span><button class="say-btn" data-a="hero-voice" data-v="${cur_}" title="Nghe nhân vật">🔊</button></div>
      <p class="intro-line">“${esc(HERO_VOICE[cur_].intro)}”</p><p>${esc(h.desc)}</p>
      <div class="row"><button class="btn primary" data-a="start">Bắt đầu học</button></div></div></div>`,'lilac')}`;
}

function overall(){
  let done=0,total=0; WEEKS.forEach(w=>w.days.forEach((_,i)=>{ total++; if(dayDone(w.week,i+1)) done++; })); return {done,total};
}
function homeView(){
  const wk=cur(), o=overall();
  const tabs = WEEKS.length>1 ? `<div class="tabs">${WEEKS.map(w=>`<button data-a="week" data-v="${w.week}" aria-pressed="${w.week===S.week}">Week ${w.week}</button>`).join('')}</div>` : '';
  let nowSet=false;
  const cards = wk.days.map((ws,i)=>{ const d=i+1, fin=S.prog.days[dayKey(wk.week,d)]; const done=fin&&fin.fin, lock=dayLock(wk.week,d);
    const isNow = !done && !lock && !nowSet; if(isNow) nowSet=true;
    const topics=[...new Set(ws.map(v=>v.topic).filter(Boolean))].slice(0,2).join(' · ');
    return `<button class="daycard ${done?'done':''} ${isNow?'now':''}" data-a="day" data-v="${d}" ${lock?'disabled':''}>
      <span class="eyebrow">Week ${wk.week}</span><b>Day ${d}</b><span class="small muted">${ws.length} từ${topics?' · '+esc(topics):''}</span>
      ${done?`<span class="chip good">✓ ${fin.fin.mastered}/${ws.length} từ thuộc</span><span class="small muted">${esc(fin.fin.date)}</span>`:lock?`<span class="chip">🔒 ${esc(lock)}</span>`:`<span class="chip ${isNow?'warn':''}">${isNow?'Học hôm nay':'Sẵn sàng'}</span>`}
    </button>`; }).join('');
  return `${topbar()}
  ${win('Lộ trình học', `${tabs}<div class="bar-row"><span class="small muted">${o.done}/${o.total} ngày đã hoàn thành</span><span class="small muted">${pct(o.done,o.total)}%</span>${bar(pct(o.done,o.total),'mint')}</div>
    <p class="small muted">Mỗi ngày học đúng ${CFG.perDay} từ, qua 6 màn. Xong tất cả màn sẽ có <b>phiếu tổng kết</b> để chụp màn hình gửi vào nhóm Zalo.${CFG.lockByDate?' Ngày tiếp theo sẽ mở vào hôm sau.':''}</p>
    <div class="daygrid">${cards}</div>`,'mint')}
  <p class="vq-foot">Mẹo: nên học bằng tai nghe hoặc ở nơi yên tĩnh, đọc to từng từ.</p>`;
}

function dayView(){
  const ws=dayWords(), dr=dayRec(), done=allDone(dr);
  let nowSet=false;
  const rows = STAGE_DEFS.map((s,i)=>{
    const ok=stageOK(dr,s.k), prevOk = i===0 || stageOK(dr,STAGE_DEFS[i-1].k) || !!dr.fin || OPEN_ALL;
    const isNow=!ok&&prevOk&&!nowSet; if(isNow) nowSet=true;
    const r=dr.st[s.k]; let res='';
    if(ok){ res = s.k==='learn' ? 'Đã học' : r.skip ? 'Bỏ qua' : (r.max ? `${r.score}/${r.max}` : 'Thắng'); }
    const nd = needFor(s.k);
    const desc = s.k==='quiz'||s.k==='gap'||s.k==='spell' ? `${s.desc} Cần đúng ${nd.need}/${nd.n}.` : s.k==='battle'||s.k==='sound' ? `${s.desc} Thắng trong ${QPS} câu.` : s.desc;
    return `<button class="step ${ok?'done':''} ${isNow?'now':''}" data-a="stage" data-v="${s.k}" ${prevOk?'':'disabled'}><span class="ic">${s.ic}</span><span><b>${i+1}. ${s.name}</b><span class="small muted">${esc(desc)}</span></span><span class="chip ${ok?'good':isNow?'warn':''}">${ok?'✓ '+esc(res):isNow?'Tiếp theo':prevOk?'Làm lại':'🔒'}</span></button>`;
  }).join('');
  const prog = STAGE_DEFS.filter(s=>stageOK(dr,s.k)).length;
  return `${topbar('<button class="btn sm" data-a="home">← Lộ trình</button>')}
  ${win(`Week ${S.week} · Day ${S.day}`, `<div class="bar-row"><span class="small muted">${prog}/${STAGE_DEFS.length} màn · ${ws.length} từ hôm nay</span><span class="small muted">${pct(prog,STAGE_DEFS.length)}%</span>${bar(pct(prog,STAGE_DEFS.length),'butter')}</div>
    <div class="row"><button class="btn sm" data-a="words">📋 Xem danh sách ${ws.length} từ</button>${dr.fin?`<button class="btn sm primary" data-a="summary">🏅 Xem phiếu tổng kết</button>`:''}</div>
    ${done&&!dr.fin?`<div class="notice">Em đã qua tất cả các màn! <button class="btn sm primary" data-a="finish">Nhận phiếu tổng kết</button></div>`:''}
    <div class="steps">${rows}</div>`,'butter')}`;
}

function wordsView(){
  const ws=dayWords();
  return `${topbar('<button class="btn sm" data-a="day" data-v="'+S.day+'">← Day '+S.day+'</button>')}
  ${win(`Day ${S.day} · ${ws.length} từ`, `<p class="small muted">Bấm 🔊 để nghe từ và câu ví dụ. Nghe, rồi đọc to 2 lần.</p><div class="tbl-wrap"><table><thead><tr><th>Từ</th><th>Nghĩa</th><th>Ví dụ</th></tr></thead><tbody>${ws.map(v=>`<tr><td>${sayBtn(v.word,'🔊','Nghe từ')} <b>${esc(v.word)}</b> ${posChip(v.pos)}</td><td class="wrap">${esc(v.meaning)}</td><td class="wrap muted">${v.example?sayBtn(v.example,'🔊','Nghe câu')+' ':''}${esc(v.example||'')}</td></tr>`).join('')}</tbody></table></div>`,'mint')}`;
}

/* ---------- 1. learn ---------- */
function learnStart(){ const ws=dayWords(); S.play={kind:'learn', i:0, flip:false, flipped:new Set()}; S.view='learn'; }
function learnView(){
  const p=S.play, ws=dayWords(), v=ws[p.i];
  const last=p.i===ws.length-1;
  return `${topbar('<button class="btn sm" data-a="day" data-v="'+S.day+'">← Day '+S.day+'</button>')}
  ${win(`Học từ · ${p.i+1}/${ws.length}`, `${bar(pct(p.i,ws.length),'mint')}
  <p class="muted small" style="text-align:center">Bấm 🔊 nghe · bấm 🔁 nghe 2 lần và đọc theo · chạm vào thẻ để lật xem nghĩa</p>
  <div class="flash ${p.flip?'flipped':''}" data-a="flip" role="button" tabindex="0" aria-label="Lật thẻ"><div class="flash-in">
    <div class="face"><span class="w">${esc(v.word)}</span>${posChip(v.pos)}<div class="say-row">${sayBtn(v.word,'🔊 Nghe','Nghe từ')}<button class="say-btn" data-a="say2" data-t="${esc(v.word)}" title="Nghe hai lần và đọc theo">🔁 Đọc theo</button></div></div>
    <div class="face back">${posChip(v.pos)}<b style="font-size:20px">${esc(v.meaning)}</b>${v.example?`<i>${esc(v.example)}</i>`:''}<div class="say-row">${sayBtn(v.word,'🔊 Từ','Nghe từ')}${v.example?sayBtn(v.example,'🔊 Câu','Nghe câu'):''}</div></div></div></div>
  <div class="row" style="justify-content:center"><button class="btn" data-a="l-prev" ${p.i===0?'disabled':''}>← Trước</button><button class="btn primary" data-a="l-next" ${p.flipped.has(p.i)?'':'disabled'}>${last?'Hoàn thành ✓':'Từ tiếp →'}</button></div>
  ${p.flipped.has(p.i)?'':'<p class="small muted" style="text-align:center">Lật thẻ để xem nghĩa trước khi sang từ tiếp theo.</p>'}`,'mint')}`;
}

/* ---------- 2/3. quiz + gap ---------- */
function distract(w, pool, n=3){
  const seen=new Set([w.word.toLowerCase()]), seenM=new Set([w.meaning]);
  const same=shuffle(pool.filter(v=>v.id!==w.id&&posKey(v)===posKey(w))), rest=shuffle(pool.filter(v=>v.id!==w.id&&posKey(v)!==posKey(w)));
  const out=[]; for(const v of [...same,...rest]){ if(seen.has(v.word.toLowerCase())||seenM.has(v.meaning)) continue; seen.add(v.word.toLowerCase()); seenM.add(v.meaning); out.push(v); if(out.length>=n) break; } return out;
}
const missed = () => dayRec().miss;
function byMiss(list){ const m=missed(); return shuffle(list).sort((a,b)=>(m[b.id]||0)-(m[a.id]||0)); }
function quizStart(kind){
  const ws=dayWords(), pool=cur().words; let src;
  if(kind==='gap') src=byMiss(ws.filter(hasGap)).slice(0,10); else src=ws;
  const dirs = kind==='gap' ? src.map(()=> 'gap') : shuffle(src.map((_,i)=> i%2?'w2m':'m2w'));
  const qs = shuffle(src.map((w,i)=>({id:w.id, dir:dirs[i], opts:shuffle([w.id,...distract(w,pool).map(v=>v.id)])})));
  S.play={kind, qs, i:0, score:0, ans:null, wrong:[]}; S.view=kind;
  dayRec().att[kind]=(dayRec().att[kind]||0)+1; saveProg();
}
const W = id => cur().words.find(v=>v.id===id) || {};
function quizView(){
  const q=S.play, back='<button class="btn sm" data-a="day" data-v="'+S.day+'">← Day '+S.day+'</button>';
  const title = q.kind==='gap' ? 'Fill the gap' : 'Meaning quiz';
  if(q.i>=q.qs.length){
    const nd=needFor(q.kind), ok=q.score>=nd.need;
    return `${topbar(back)}${win(title+' · kết quả', `<div class="empty" style="font-style:normal"><span class="eyebrow">${ok?'Đạt!':'Chưa đạt'}</span><span class="big-score">${q.score} / ${q.qs.length}</span>
      <span>${ok?'Rất tốt! Em đã qua màn này.':`Cần đúng ít nhất ${nd.need}/${q.qs.length}. Ôn lại các từ bên dưới rồi thử lại nhé.`}</span>
      ${q.wrong.length?`<div class="stack" style="text-align:left;width:100%;max-width:460px"><span class="eyebrow">Từ cần ôn</span>${[...new Set(q.wrong)].map(id=>`<div class="quote"><b>${esc(W(id).word)}</b> · ${esc(W(id).meaning)} ${sayBtn(W(id).word)}</div>`).join('')}</div>`:''}
      <div class="row">${ok?'<button class="btn primary" data-a="stage-next">Tiếp tục →</button>':''}<button class="btn ${ok?'':'primary'}" data-a="stage" data-v="${q.kind}">Làm lại</button></div></div>`,'lilac')}`;
  }
  const c=q.qs[q.i], v=W(c.id);
  const prompt = c.dir==='w2m' ? `<p class="small muted">Từ này nghĩa là gì?</p><p class="hello" style="font-size:clamp(28px,5vw,40px)">${esc(v.word)} ${sayBtn(v.word)}</p>${posChip(v.pos)}`
    : c.dir==='m2w' ? `<p class="small muted">Từ nào có nghĩa là…</p><p style="font-size:21px;font-family:var(--display)">${esc(v.meaning)}</p>${posChip(v.pos)}`
    : `<p class="small muted">Chọn từ điền vào chỗ trống.</p><p style="font-size:21px;font-family:var(--display);font-style:italic">${esc(v.example.replace(new RegExp(escRe(v.word)+'\\w*','ig'),'________'))}</p>`;
  const label = id => c.dir==='w2m' ? W(id).meaning : W(id).word;
  return `${topbar(back)}${win(`${title} · ${q.i+1}/${q.qs.length}`, `<div class="cue stack" style="max-width:620px;margin:0 auto;width:100%">
    <div class="row between"><span class="eyebrow">Câu ${q.i+1} / ${q.qs.length}</span><span class="chip lilac">Đúng ${q.score}</span></div>${bar(pct(q.i,q.qs.length),'lilac')}${prompt}
    <div class="match" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">${c.opts.map(id=>{ let cls=''; if(q.ans){ if(id===c.id) cls='ok-show'; else if(id===q.ans) cls='no'; }
      return `<button data-a="q-ans" data-v="${esc(id)}" class="${cls}" ${q.ans?'disabled':''}>${esc(label(id))}</button>`; }).join('')}</div>
    ${q.ans?`<div class="notice" style="background:color-mix(in srgb,var(--${q.ans===c.id?'mint':'pink'}) 70%,var(--paper))">${q.ans===c.id?'Chính xác!':`Đáp án: <b>${esc(v.word)}</b> = ${esc(v.meaning)}.`}${v.example&&c.dir!=='gap'?`<br><i>${esc(v.example)}</i>`:''} <button class="btn sm" data-a="q-next">${q.i+1<q.qs.length?'Câu tiếp':'Xem kết quả'}</button></div>`:''}</div>`,'lilac')}`;
}
function addMiss(id){ const m=missed(); m[id]=(m[id]||0)+1; saveProg(); }

/* ---------- 4. spell ---------- */
function spellStart(){
  const ws=byMiss(dayWords()).slice(0,10);
  S.play={kind:'spell', ids:shuffle(ws.map(v=>v.id)), i:0, score:0, res:null, wrong:[]}; S.view='spell';
  dayRec().att.spell=(dayRec().att.spell||0)+1; saveProg();
}
const norm = s => String(s||'').toLowerCase().replace(/[’']/g,"'").replace(/[.!?,;:]+$/,'').replace(/\s+/g,' ').trim();
function spellView(){
  const sp=S.play, back='<button class="btn sm" data-a="day" data-v="'+S.day+'">← Day '+S.day+'</button>';
  if(sp.i>=sp.ids.length){
    const nd=needFor('spell'), ok=sp.score>=nd.need;
    return `${topbar(back)}${win('Spell it · kết quả', `<div class="empty" style="font-style:normal"><span class="eyebrow">${ok?'Đạt!':'Chưa đạt'}</span><span class="big-score">${sp.score} / ${sp.ids.length}</span>
      <span>${ok?'Chính tả rất tốt!':`Cần đúng ít nhất ${nd.need}/${sp.ids.length}. Xem lại cách viết các từ sai rồi thử lại.`}</span>
      ${sp.wrong.length?`<div class="stack" style="text-align:left;width:100%;max-width:460px"><span class="eyebrow">Từ cần ôn</span>${[...new Set(sp.wrong)].map(id=>`<div class="quote"><b>${esc(W(id).word)}</b> · ${esc(W(id).meaning)} ${sayBtn(W(id).word)}</div>`).join('')}</div>`:''}
      <div class="row">${ok?'<button class="btn primary" data-a="stage-next">Tiếp tục →</button>':''}<button class="btn ${ok?'':'primary'}" data-a="stage" data-v="spell">Làm lại</button></div></div>`,'lilac')}`;
  }
  const v=W(sp.ids[sp.i]);
  return `${topbar(back)}${win(`Spell it · ${sp.i+1}/${sp.ids.length}`, `<div class="cue stack" style="max-width:560px;margin:0 auto;width:100%"><div class="row between"><span class="eyebrow">Câu ${sp.i+1} / ${sp.ids.length}</span><span class="chip lilac">Đúng ${sp.score}</span></div>${bar(pct(sp.i,sp.ids.length),'lilac')}
    <p class="muted small">Gõ từ tiếng Anh có nghĩa:</p><p style="font-size:20px;font-weight:700">${esc(v.meaning)}</p><div>${posChip(v.pos)} ${sayBtn(v.word,'🔊 Nghe từ','Nghe từ')}</div>
    ${v.example?`<p class="muted"><i>${esc(v.example.replace(new RegExp(escRe(v.word),'ig'),'_____'))}</i></p>`:''}
    <form data-f="spell" class="row"><input id="spell-in" data-fresh="1" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Từ tiếng Anh" style="flex:1;min-width:160px" ${sp.res?'disabled':''}><button class="btn primary" type="submit" ${sp.res?'disabled':''}>Kiểm tra</button></form>
    ${sp.res?`<div class="notice" style="background:var(--${sp.res.ok?'mint':'pink'})">${sp.res.ok?'Chính xác!':`Chưa đúng. Từ đúng là <b>${esc(v.word)}</b>.`} <button class="btn sm" data-a="spell-next">${sp.i+1<sp.ids.length?'Từ tiếp':'Xem kết quả'}</button></div>`:''}</div>`,'lilac')}`;
}

/* ---------- 5/6. battles ---------- */
let qInt=null;
function wordQ(B){
  const ws=dayWords(), pool=cur().words, m=missed();
  const fresh=ws.filter(v=>!B.used.includes(v.id)); const src=fresh.length?fresh:ws;
  const w = src.map(v=>[v,(m[v.id]||0)+Math.random()*1.2]).sort((a,b)=>b[1]-a[1])[0][0];
  const kinds=['w2m','m2w'].concat(hasGap(w)?['gap']:[]);
  return {id:w.id, dir:pick(kinds), opts:shuffle([w.id,...distract(w,pool).map(v=>v.id)])};
}
function battleStart(kind){
  const hk=S.profile.hero, hs=heroStats(hk), st=foeFor(kind,S.day), tMax=hk==='ranger'?25:15, emax=st.need*hs.dmg;
  const B={view:'battle', kind, st, hs, hp:hs.max, ehp:emax, emax, streak:0, ans:null, tLeft:tMax, tMax, hints:hk==='sorceress'?2:0, hidden:[], asked:0, correct:0, missed:[], used:[], log:'', anim:null, q:null};
  B.q = kind==='sound' ? makeSoundQ() : wordQ(B);
  S.B=B; S.view=kind; dayRec().att[kind]=(dayRec().att[kind]||0)+1; saveProg(); beep(520); qTimerStart();
}
function qTimerStart(){
  clearInterval(qInt);
  qInt=setInterval(()=>{ const B=S.B; if(!B||B.view!=='battle'||B.ans) return;
    B.tLeft--; const b=$('#q-time'), s=$('#q-secs'); if(b) b.style.width=pct(B.tLeft,B.tMax)+'%'; if(s) s.textContent=B.tLeft+'s';
    if(B.tLeft<=0) battleAnswer('__timeout__'); },1000);
}
function battleView(){
  const B=S.B, back='<button class="btn sm" data-a="retreat">Rút lui</button>';
  const st=B.st, hk=S.profile.hero, hs=B.hs;
  if(B.view==='win'||B.view==='lose'){
    const ok=B.view==='win';
    return `${topbar('<button class="btn sm" data-a="day" data-v="'+S.day+'">← Day '+S.day+'</button>')}${win(ok?'Chiến thắng! Victory':'Thua rồi… Defeated', `<div class="empty" style="font-style:normal">${foeImg(st,'big')}<span class="eyebrow">${esc(st.name)}</span>
      <span class="big-score">${B.correct} / ${B.asked}</span>
      <span>${ok?`Em đã đánh bại ${esc(st.foe)}!`:(B.why==='hp'?`${esc(st.foe)} đã hạ gục nhân vật của em.`:`${esc(st.foe)} vẫn còn đứng sau ${QPS} câu.`)+' Ôn lại các từ bên dưới rồi thử lại nhé.'}</span>
      ${B.missedList.length?`<div class="stack" style="text-align:left;width:100%;max-width:460px"><span class="eyebrow">Cần ôn</span>${B.missedList.map(m=>m.sound?`<div class="quote">${esc(m.right)} — ${esc(m.note)}</div>`:`<div class="quote"><b>${esc(m.word)}</b> · ${esc(m.meaning)} ${sayBtn(m.word)}</div>`).join('')}</div>`:''}
      <div class="row">${ok?'<button class="btn primary" data-a="stage-next">Tiếp tục →</button>':''}<button class="btn ${ok?'':'primary'}" data-a="stage" data-v="${B.kind}">Chơi lại</button></div></div>`,ok?'mint':'peach')}`;
  }
  const q=B.q, v=q.sound?{}:W(q.id);
  const prompt = q.sound ? `${q.html}<div><button class="btn sm" data-a="q-say">🔊 Hear it</button></div>` : q.dir==='w2m' ? `<p class="small muted">What does this word mean?</p><p class="hello" style="font-size:clamp(26px,5vw,36px)">${esc(v.word)}</p>${posChip(v.pos)}`
    : q.dir==='m2w' ? `<p class="small muted">Which word means…</p><p style="font-size:20px;font-family:var(--display)">${esc(v.meaning)}</p>${posChip(v.pos)}`
    : `<p class="small muted">Complete the sentence.</p><p style="font-size:20px;font-family:var(--display);font-style:italic">${esc(String(v.example).replace(new RegExp(escRe(v.word)+'\\w*','ig'),'________'))}</p>`;
  const label = id => q.sound ? q.opts[Number(id)] : q.dir==='w2m' ? W(id).meaning : W(id).word;
  const optKeys = q.sound ? q.opts.map((_,i)=>String(i)) : q.opts, ck=qKey(q), an=B.anim||{};
  return `${topbar(back)}${win(`${B.kind==='sound'?'♪ Sound Duel':'⚔ Word Battle'} · ${esc(st.name)}`, `
    <div class="arena ${st.boss?'boss':''} ${an.who==='player'?'shake':''}" data-k="${an.k||''}">
      <div class="arena-bg" style="background-image:url('${FOE_IMG[st.img]}');${st.filter?`filter:${st.filter} blur(4px) saturate(1.05);`:''}" aria-hidden="true"></div>
      <div class="arena-sky" aria-hidden="true"></div><div class="rays" aria-hidden="true"></div><div class="floor" aria-hidden="true"></div>
      <canvas class="arena-fx" id="arena-fx" aria-hidden="true"></canvas>
      <div class="drape l" aria-hidden="true"></div><div class="drape r" aria-hidden="true"></div>
      <div class="banner l" aria-hidden="true"><i style="--fl:var(--${HEROES[hk].color})"></i></div><div class="banner r" aria-hidden="true"><i style="--fl:#6b2a44"></i></div>
      <span class="corner tl" aria-hidden="true">❦</span><span class="corner tr" aria-hidden="true">❦</span><span class="corner bl" aria-hidden="true">❦</span><span class="corner br" aria-hidden="true">❦</span>
      <div class="fighter me ${an.who==='player'?'hit':''} ${an.who==='enemy'?'lunge':''}">${an.who==='player'?`<span class="dmg" data-k="${an.k}">−${an.dmg}</span>`:''}${an.heal?`<span class="dmg heal" data-k="${an.k}h">+${an.heal}</span>`:''}${heroCv(hk)}<div class="hp me"><i style="width:${pct(B.hp,hs.max)}%"></i></div><span class="tag">${esc(HEROES[hk].name)} · ${B.hp}/${hs.max}</span></div>
      <div class="fighter enemy ${an.who==='enemy'?'hit':''} ${an.who==='player'&&B.ehp>0?'lunge':''}" ${B.ehp<=0?'style="opacity:.45;filter:grayscale(.7)"':''}>${an.who==='enemy'?`<span class="dmg ${an.crit?'crit':''}" data-k="${an.k}">−${an.dmg}${an.crit?'!':''}</span><span class="slash ${an.crit?'crit':''}" aria-hidden="true"></span>`:''}${foeImg(st)}<div class="hp"><i style="width:${pct(B.ehp,B.emax)}%"></i></div><span class="tag">${esc(st.foe)} · ${B.ehp>0?`${B.ehp}/${B.emax}`:'Defeated'}</span></div>
    </div>
    <p class="battle-log">${esc(B.log||`${st.foe} chặn đường! Đánh trúng ${st.need} lần trong ${QPS} câu để thắng.`)}</p>
    <div class="cue stack">
      <div class="row between"><span class="eyebrow">Câu ${Math.min(B.asked+(B.ans?0:1),QPS)} / ${QPS}${B.ehp<=0?' · vòng ôn thêm':` · chuỗi ${B.streak}${B.streak>=critAt(hk)?' · đòn tiếp theo là chí mạng!':''}`}</span><span class="small muted" id="q-secs">${B.ans?'':B.tLeft+'s'}</span></div>
      ${bar(pct(B.asked,QPS),'butter')}<div class="qtime"><i id="q-time" style="width:${B.ans?0:pct(B.tLeft,B.tMax)}%"></i></div>
      ${prompt}
      <div class="match" style="grid-template-columns:repeat(auto-fit,minmax(${q.sound&&q.opts.length>2?150:200}px,1fr))">${optKeys.map(id=>{let cls=''; const gone=(B.hidden||[]).includes(id)&&!B.ans; if(B.ans){ if(id===ck) cls='ok-show'; else if(id===B.ans) cls='no'; } return `<button data-a="q-ans2" data-v="${esc(id)}" class="${cls}" ${B.ans||gone?'disabled':''} ${gone?'style="opacity:.25;text-decoration:line-through"':''}>${esc(label(id))}</button>`;}).join('')}</div>
      ${hk==='sorceress'&&!B.ans&&B.ehp>0&&optKeys.length>2?`<div><button class="btn sm alt" data-a="q-hint" ${B.hints>0&&!(B.hidden||[]).length?'':'disabled'}>✦ Arcane Insight · ${B.hints} left</button></div>`:''}
      ${B.ans&&q.sound?`<p class="small">${esc(q.explain)} <button class="btn ghost small" data-a="q-say">🔊 hear it again</button></p>`:''}
      ${B.ans&&!q.sound&&B.ans!==q.id?`<p class="small"><b>${esc(v.word)}</b>: ${esc(v.meaning)}</p>`:''}
    </div>`, st.boss?'peach':'lilac')}`;
}
function battleAnswer(choice){
  const B=S.B; if(!B||B.ans||B.view!=='battle') return;
  const hk=S.profile.hero, hs=B.hs, st=B.st, q=B.q, ck=qKey(q), w=q.sound?{word:q.opts[q.ans]}:W(q.id);
  B.ans = choice==='__timeout__' ? '__none__' : choice; B.asked++;
  const k=Math.random().toString(36).slice(2,7);
  const miss = () => { if(q.sound) B.missed.push({sound:true, right:q.opts[q.ans], note:q.explain}); else { B.missed.push({word:w.word, meaning:w.meaning, id:q.id}); addMiss(q.id); } };
  if(choice===ck && B.ehp<=0){ B.correct++; B.log='Tuyệt! Em trả lời đúng vòng ôn thêm.'; beep(1200); }
  else if(choice===ck){
    B.correct++; const crit=B.streak>=critAt(hk), dmg=hs.dmg*(crit?2:1); B.streak++; B.ehp=Math.max(0,B.ehp-dmg); B.anim={who:'enemy',dmg,crit,k};
    if(hk==='princess' && B.hp<hs.max){ const h=Math.min(2,hs.max-B.hp); B.hp+=h; B.anim.heal=h; }
    B.log = B.ehp<=0 ? (B.asked<QPS ? `${st.foe} bị đánh bại! Trả lời nốt các câu còn lại để ôn thêm.` : `${st.foe} bị đánh bại!`) : crit ? `Đòn chí mạng! −${dmg} cho ${st.foe}.` : `Em đánh trúng ${st.foe}, −${dmg}.`; beep(crit?1100:880);
  } else if(B.ehp<=0){ B.streak=0; B.log=`Câu này chưa đúng. Đáp án: “${w.word}”.`; miss(); beep(300); }
  else { B.streak=0; const dmg=Math.max(1, st.atk+(Math.random()<.3?1:0)-(hk==='knight'?2:0)); B.hp=Math.max(0,B.hp-dmg); B.anim={who:'player',dmg,k};
    B.log = choice==='__timeout__' ? `Chậm quá! ${st.foe} đánh em −${dmg}.` : `${st.foe} đánh em −${dmg}.`; beep(220); miss(); }
  render();
  setTimeout(()=>{
    if(S.B!==B) return;
    if(B.hp<=0) return battleEnd(false);
    if(B.asked>=QPS) return battleEnd(B.ehp<=0);
    B.used.push(q.sound?q.key:q.id); B.q = B.kind==='sound' ? makeSoundQ(B.used) : wordQ(B); B.ans=null; B.hidden=[]; B.tLeft=B.tMax; B.anim=null; render(); qTimerStart();
  }, q.sound ? 2200 : 1300);
}
function battleEnd(won){
  clearInterval(qInt); const B=S.B; B.view=won?'win':'lose'; B.why = won?'':(B.hp<=0?'hp':'time');
  B.missedList = []; const seen=new Set(); B.missed.forEach(m=>{ const key=m.sound?m.right:m.id; if(!seen.has(key)){ seen.add(key); B.missedList.push(m); } });
  if(won) recordStage(B.kind, {score:B.correct, max:B.asked});
  won ? (beep(660),setTimeout(()=>beep(990),180)) : beep(180);
  render();
}

/* ---------- stage bookkeeping ---------- */
function recordStage(k, r){
  const dr=dayRec(); if(dr.fin) { saveProg(); return; } // already completed: replays are practice only
  const prev=dr.st[k]; dr.st[k]={ok:true, score:r.score, max:r.max, ts:new Date().toISOString(), best:Math.max(r.score, prev&&prev.best||0)};
  saveProg();
}
function stageStart(k){
  clearInterval(qInt); S.B=null;
  if(k==='gap' && dayWords().filter(hasGap).length<3){ recordStage('gap',{score:0,max:0}); const r=dayRec().st.gap; if(r) r.skip=true; saveProg(); return nextStageAfter('gap'); }
  if(k==='learn') learnStart(); else if(k==='quiz'||k==='gap') quizStart(k); else if(k==='spell') spellStart(); else battleStart(k);
}
function nextStageAfter(k){
  const dr=dayRec(), i=STAGE_DEFS.findIndex(s=>s.k===k), nx=STAGE_DEFS[i+1];
  if(!nx || allDone(dr)){ if(allDone(dr) && !dr.fin) return finishDay(); S.view='day'; return render(); }
  S.view='day'; render();
}
function finishDay(){
  const dr=dayRec(), ws=dayWords(); if(dr.fin){ S.view='summary'; return render(); }
  const status = ws.map(v=>({id:v.id, miss:dr.miss[v.id]||0}));
  const mastered = status.filter(s=>s.miss<=1).length;
  const review = status.filter(s=>s.miss>=2).map(s=>s.id);
  const ts=new Date().toISOString();
  let h=5381; for(const c of `${nameKey(S.profile.name)}|${S.week}|${S.day}|${ts}|${mastered}`) h=((h<<5)+h+c.charCodeAt(0))>>>0;
  dr.fin={ts, date:today(), mastered, review, code:h.toString(36).toUpperCase().padStart(5,'0').slice(-5)};
  saveProg(); S.view='summary'; render(); beep(660); setTimeout(()=>beep(990),180); setTimeout(()=>beep(1320),380);
}

/* ---------- summary ---------- */
function summaryView(){
  const dr=dayRec(), ws=dayWords(), f=dr.fin, hk=S.profile.hero;
  const res = k => { const r=dr.st[k]; if(!r) return '—'; return r.max ? `${r.score}/${r.max}` : '✓'; };
  const attempts = k => dr.att[k] ? ` · ${dr.att[k]} lần` : '';
  const rows = [['📖 Học 20 từ', '✓'],['✎ Meaning quiz', res('quiz')+attempts('quiz')],['▭ Fill the gap', res('gap')+attempts('gap')],['✍ Spell it', res('spell')+attempts('spell')],['⚔ Word Battle', 'Thắng '+res('battle')+attempts('battle')],['♪ Sound Duel', 'Thắng '+res('sound')+attempts('sound')]];
  const rev = ws.filter(v=>f.review.includes(v.id));
  return `${topbar('<button class="btn sm" data-a="day" data-v="'+S.day+'">← Day '+S.day+'</button>')}
  <div class="notice">📸 <b>Chụp màn hình phiếu này</b> rồi gửi vào nhóm Zalo của lớp. Bạn nào chưa có phiếu là chưa hoàn thành bài hôm nay.</div>
  <div class="cert" id="cert">
    <span class="crown" aria-hidden="true">♛</span><h2>PHIẾU TỔNG KẾT NGÀY HỌC</h2>
    <div class="person">${heroCv(hk)}<div><b>${esc(S.profile.name)}</b><span>${esc(CFG.cls)} · Week ${S.week} · Day ${S.day}</span></div></div>
    <div class="big">${f.mastered}<small> / ${ws.length} từ đã thuộc</small></div>
    ${bar(pct(f.mastered,ws.length),f.mastered>=ws.length*0.85?'mint':'butter')}
    <table><tbody>${rows.map(r=>`<tr><td>${r[0]}</td><td>${esc(r[1])}</td></tr>`).join('')}</tbody></table>
    <div class="wgrid">${ws.map(v=>{const m=dr.miss[v.id]||0; return `<span class="w${Math.min(2,m>=2?2:m)}" title="${esc(v.meaning)}">${m>=2?'✗':m===1?'~':'✓'} ${esc(v.word)}</span>`;}).join('')}</div>
    <div class="legend"><span><i style="background:var(--mint)"></i>thuộc</span><span><i style="background:var(--butter)"></i>sai 1 lần</span><span><i style="background:var(--pink)"></i>cần ôn lại</span></div>
    <div class="foot"><span>${fmtTime(f.ts)}</span><span>Mã <span class="seal">${esc(f.code)}</span></span></div>
  </div>
  ${rev.length?`<div class="cue stack"><span class="eyebrow">Từ cần ôn lại trước buổi học</span>${rev.map(v=>`<div class="quote"><b>${esc(v.word)}</b> · ${esc(v.meaning)} ${sayBtn(v.word)}</div>`).join('')}</div>`:''}
  <div class="row" style="justify-content:center"><button class="btn primary" data-a="copy">📋 Sao chép kết quả gửi Zalo</button><button class="btn" data-a="home">Về lộ trình</button></div>`;
}
function zaloText(){
  const dr=dayRec(), ws=dayWords(), f=dr.fin; const r=k=>dr.st[k]&&dr.st[k].max?`${dr.st[k].score}/${dr.st[k].max}`:'✓';
  const rev=ws.filter(v=>f.review.includes(v.id)).map(v=>v.word);
  return `📚 ${CFG.cls} — ${S.profile.name}\nWeek ${S.week} · Day ${S.day}\nQuiz ${r('quiz')} · Gap ${r('gap')} · Spell ${r('spell')} · Battle ✓ · Sound ✓\nĐã thuộc: ${f.mastered}/${ws.length} từ\n${rev.length?'Cần ôn: '+rev.join(', ')+'\n':''}Hoàn thành: ${fmtTime(f.ts)} · Mã ${f.code}`;
}
async function copyText(t){
  try{ await navigator.clipboard.writeText(t); return true; }catch{}
  try{ const ta=document.createElement('textarea'); ta.value=t; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); const ok=document.execCommand('copy'); ta.remove(); return ok; }catch{ return false; }
}

/* ---------- events ---------- */
document.addEventListener('click', async ev=>{
  const el=ev.target.closest('[data-a]'); if(!el) return;
  const a=el.dataset.a, v=el.dataset.v;
  switch(a){
    case 'say': sayAloud(el.dataset.t); return;
    case 'say2': sayTwice(el.dataset.t); toast('Nghe, rồi đọc theo mỗi lần nhé.'); return;
    case 'hero-pick': S.ui.pickHero=v; S.ui.nameDraft=($('#nm')||{}).value ?? S.ui.nameDraft; render(); heroSpeak(v, HERO_VOICE[v].intro); return;
    case 'hero-voice': heroSpeak(v, HERO_VOICE[v].intro); return;
    case 'greet-say': { const g=S.ui.greet; if(g){ heroSpeak(g.kind,g.line); g.spoken=true; el.textContent='🔊 Hear again'; } return; }
    case 'greet-tap': { if(ev.target!==el) return; }
    case 'greet-close': { const o=document.querySelector('.greet'); try{ speechSynthesis.cancel(); }catch{} S.ui.greet=null; if(o){ o.classList.add('out'); setTimeout(()=>{ const r=document.getElementById('greet-root'); if(r && !S.ui.greet) r.innerHTML=''; },420); } return; }
    case 'start': { const name=(($('#nm')||{}).value||'').trim().replace(/\s+/g,' '); if(name.length<2){ toast('Em nhập họ tên trước nhé.'); const i=$('#nm'); if(i) i.focus(); return; }
      const hero=S.ui.pickHero||'princess'; S.profile={name, hero}; const key=nameKey(name);
      S.prog=ls.get('prog:'+key,{days:{}}); if(!S.prog.days) S.prog={days:{}}; saveProfiles(); saveProg(); S.view='home'; S.ui.nameDraft=''; S.ui.pickHero=null; render(); greetNow(); return; }
    case 'use-profile': { if(loadProfile(v)){ S.view='home'; render(); greetNow(); } return; }
    case 'switch': clearInterval(qInt); S.B=null; S.play=null; S.profile=null; S.prog=null; ls.del('last'); S.ui.greeted=false; S.ui.greet=null; { const r=document.getElementById('greet-root'); if(r) r.innerHTML=''; } S.view='welcome'; break;
    case 'week': S.week=Number(v); break;
    case 'home': clearInterval(qInt); S.B=null; S.view='home'; break;
    case 'day': clearInterval(qInt); S.B=null; S.day=Number(v); S.view='day'; { const d=dayRec(); if(dayLock(S.week,S.day)){ toast(dayLock(S.week,S.day)); S.view='home'; } } break;
    case 'words': S.view='words'; break;
    case 'stage': stageStart(v); break;
    case 'stage-next': nextStageAfter(S.view==='learn'?'learn':S.view); return;
    case 'finish': finishDay(); return;
    case 'summary': S.view='summary'; break;
    case 'copy': { const ok=await copyText(zaloText()); toast(ok?'Đã sao chép! Dán vào Zalo cùng ảnh chụp màn hình.':'Không sao chép được. Hãy chụp màn hình phiếu.'); return; }
    case 'flip': S.play.flip=!S.play.flip; if(S.play.flip) S.play.flipped.add(S.play.i); break;
    case 'l-prev': S.play.i=Math.max(0,S.play.i-1); S.play.flip=false; break;
    case 'l-next': { const p=S.play, ws=dayWords(); if(p.i>=ws.length-1){ recordStage('learn',{score:ws.length,max:0}); nextStageAfter('learn'); return; } p.i++; p.flip=false; break; }
    case 'q-ans': { const q=S.play, c=q.qs[q.i]; if(q.ans) return; q.ans=v; if(v===c.id) q.score++; else { q.wrong.push(c.id); addMiss(c.id); } break; }
    case 'q-next': { const q=S.play; q.i++; q.ans=null; if(q.i>=q.qs.length){ const nd=needFor(q.kind); if(q.score>=nd.need) recordStage(q.kind,{score:q.score,max:q.qs.length}); } break; }
    case 'spell-next': { const sp=S.play; sp.i++; sp.res=null; if(sp.i>=sp.ids.length){ const nd=needFor('spell'); if(sp.score>=nd.need) recordStage('spell',{score:sp.score,max:sp.ids.length}); } break; }
    case 'q-ans2': battleAnswer(v); return;
    case 'q-say': { const B=S.B; if(B&&B.q&&B.q.say) sayTwice(B.q.say); return; }
    case 'q-hint': { const B=S.B; if(!B||B.ans||B.hints<=0) return; const keys=B.q.sound?B.q.opts.map((_,i)=>String(i)):B.q.opts; if(keys.length<3) return; B.hints--; B.hidden=shuffle(keys.filter(id=>id!==qKey(B.q))).slice(0,2); beep(1300); break; }
    case 'retreat': clearInterval(qInt); S.B=null; S.view='day'; break;
    default: return;
  }
  render();
});
document.addEventListener('submit', ev=>{
  const f=ev.target; if(f.dataset.f!=='spell') return; ev.preventDefault();
  const sp=S.play; if(!sp||sp.res) return; const val=norm(($('#spell-in')||{}).value), w=W(sp.ids[sp.i]); if(!val) return;
  const ok = val===norm(w.word); sp.res={ok}; if(ok) sp.score++; else { sp.wrong.push(w.id); addMiss(w.id); } render();
});
document.addEventListener('keydown', ev=>{
  if((ev.key==='Enter'||ev.key===' ') && ev.target.dataset && ev.target.dataset.a==='flip'){ ev.preventDefault(); ev.target.click(); }
  if(ev.key==='Escape' && S.ui.greet){ const b=document.querySelector('.greet [data-a="greet-close"]'); if(b) b.click(); }
});
try{ if(window.speechSynthesis) speechSynthesis.getVoices(); }catch{}
/*PAGE_FX*/
boot();
