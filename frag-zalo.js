  /* ---------- Nhắc Zalo ---------- */
  const SITE = 'https://nvu-academy-ielts.vercel.app';
  const DAY_VI_Z = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  let ZL = { index: null, quiz: null };

  function isoToday() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function viDate(iso) {
    const d = new Date(iso + 'T00:00:00');
    return `${DAY_VI_Z[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  function loadZalo() {
    const dt = document.getElementById('zl-date');
    if (!dt.value) dt.value = isoToday();
    buildZalo();
  }

  async function buildZalo() {
    const cls = document.getElementById('class-filter-zalo').value;
    const date = document.getElementById('zl-date').value || isoToday();
    const morning = document.getElementById('zl-morning');
    const remind = document.getElementById('zl-remind');
    const status = document.getElementById('zl-status');
    if (!cls) { morning.value = ''; remind.value = ''; status.textContent = 'Hãy chọn lớp'; return; }
    status.textContent = 'Đang soạn…';
    try {
      if (!ZL.index) ZL.index = (await (await fetch('daily-index.json', { cache: 'no-cache' })).json()).practices || [];
      if (!ZL.quiz) { try { ZL.quiz = (await (await fetch('quiz-week1-ielts14.json', { cache: 'no-cache' })).json()).quiz; } catch (e) { ZL.quiz = false; } }
      const clsName = (document.querySelector('#class-filter-zalo option:checked') || {}).textContent || cls;
      const mine = ZL.index.filter(p => (p.class_codes || []).includes(cls));
      const { data: students } = await db.from('students').select('id, full_name').eq('class_code', cls).order('full_name');
      const ids = (students || []).map(s => s.id);
      let scores = [], quizRes = [];
      if (ids.length) {
        const [a, b] = await Promise.all([
          db.from('daily_scores').select('student_id, practice_date, section').in('student_id', ids),
          db.from('weekly_quiz_results').select('student_id, week_number').in('student_id', ids)
        ]);
        scores = a.data || []; quizRes = b.data || [];
      }
      const doneSet = new Set(scores.map(r => r.student_id + '|' + r.practice_date + '|' + r.section));
      const done = (sid, p) => doneSet.has(sid + '|' + p.date + '|' + (p.section || 'listening'));

      /* Tin sáng */
      const todays = mine.filter(p => p.date === date);
      const dayName = DAY_VI_Z[new Date(date + 'T00:00:00').getDay()];
      const quizToday = ZL.quiz && (ZL.quiz.class_codes || []).includes(cls) &&
        (['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(ZL.quiz.available_day) === new Date(date + 'T00:00:00').getDay());
      const extra = document.getElementById('zl-extra').value.trim();
      const lines = [`📚 ${clsName} · ${viDate(date)}`, '', 'Hôm nay các bạn cần làm:'];
      let n = 1;
      if (extra) lines.push(`${n++}. Từ vựng: ${extra.replace(/^vocab hôm nay:\s*/i, '').replace(/^từ vựng:\s*/i, '')}`);
      todays.forEach(p => lines.push(`${n++}. Daily Practice: ${p.title}${p.subtitle ? ' (' + p.subtitle + ')' : ''}\n   👉 ${SITE}/daily-practice.html?p=${p.id}`));
      if (quizToday) lines.push(`${n++}. Weekly Quiz (${ZL.quiz.max_score} điểm)\n   👉 ${SITE}/weekly-quiz.html`);
      if (n === 1) lines.push('(Chưa có bài nào được xếp cho hôm nay)');
      lines.push('', `⏰ Hạn nộp: ${cls === 'IELTS13' ? '23:30 tối nay' : cls === 'IELTS14' ? '0:00 đêm nay' : '23:00 tối nay'}.`);

      const owed = {};
      mine.filter(p => p.date < date).forEach(p => {
        (students || []).forEach(s => { if (!done(s.id, p)) (owed[s.full_name] = owed[s.full_name] || []).push(`${p.title} ${viDate(p.date).split(' ').slice(-1)[0]}`); });
      });
      const owedNames = Object.keys(owed);
      if (owedNames.length) {
        lines.push('', '📌 Bài còn thiếu, các bạn làm bù sớm nhé:');
        owedNames.forEach(nm => lines.push(`- ${nm}: ${owed[nm].join('; ')}`));
        lines.push(`Làm bù tại: ${SITE}/daily-practice.html`);
      }
      lines.push('', 'Chúc cả lớp học tốt! — Mr. Nam');
      morning.value = lines.join('\n');

      /* Tin nhắc chưa nộp */
      const due = mine.filter(p => p.date === date);
      const rl = [];
      if (!due.length) rl.push(`(Không có bài Daily Practice nào của ${viDate(date)} để kiểm tra)`);
      due.forEach(p => {
        const missing = (students || []).filter(s => !done(s.id, p)).map(s => s.full_name);
        rl.push(`⏰ Nhắc nộp bài: ${p.title} (${viDate(p.date)})`);
        if (!missing.length) rl.push('Cả lớp đã nộp bài. Cảm ơn các bạn! 🎉');
        else {
          rl.push(`Thầy chưa thấy bài của ${missing.length}/${(students || []).length} bạn:`);
          missing.forEach(nm => rl.push(`- ${nm}`));
          rl.push('', `Các bạn làm và nộp tại: ${SITE}/daily-practice.html?p=${p.id}`);
          rl.push('Bạn nào chưa kịp thì làm bù và nhắn thầy nhé.');
        }
        rl.push('');
      });
      if (quizToday) {
        const missingQ = (students || []).filter(s => !quizRes.some(r => r.student_id === s.id && r.week_number === ZL.quiz.week_number)).map(s => s.full_name);
        rl.push(`⏰ Weekly Quiz tuần ${ZL.quiz.week_number}`);
        rl.push(missingQ.length ? `Chưa làm (${missingQ.length}/${(students || []).length}): ${missingQ.join(', ')}` : 'Cả lớp đã làm quiz. 🎉');
      }
      remind.value = rl.join('\n').trim();
      status.textContent = `${(students || []).length} học sinh · cập nhật ${new Date().toLocaleTimeString('vi-VN')}`;
    } catch (e) {
      status.textContent = 'Lỗi: ' + e.message;
    }
  }

  async function copyZalo(id, btn) {
    const ta = document.getElementById(id);
    try { await navigator.clipboard.writeText(ta.value); }
    catch (e) { ta.select(); document.execCommand('copy'); }
    const old = btn.textContent; btn.textContent = 'Đã copy ✓';
    setTimeout(() => btn.textContent = old, 1500);
  }
