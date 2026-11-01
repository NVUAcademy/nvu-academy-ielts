  /* ---------- Tiền Meow (giáo viên) ---------- */
  let MW = { start: '', cls: '', students: [], rows: [], redeem: [], scores: [] };
  const MW_OPTS = [['', '—'], ['du', 'Đủ'], ['muon', 'Muộn'], ['nua', 'Nửa'], ['bu', 'Bù'], ['khong', 'Không nộp']];
  const MW_DAYNAME = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const MW_COLOR = { du: '#dcebdc', muon: '#f0e4c0', nua: '#f3dccb', bu: '#e0d6ee', khong: '#f0cdd0' };

  function mwShort(iso) { return iso.slice(8, 10) + '/' + iso.slice(5, 7); }
  function mwShift(n) { MW.start = MEOW.addDays(MW.start || MEOW.weekStart(MEOW.iso(new Date())), 7 * n); loadMeow(); }
  function mwThisWeek() { MW.start = MEOW.weekStart(MEOW.iso(new Date())); loadMeow(); }

  async function loadMeow() {
    if (!MW.start) MW.start = MEOW.weekStart(MEOW.iso(new Date()));
    const cls = document.getElementById('class-filter-meow').value; MW.cls = cls;
    document.getElementById('mw-week').textContent = `Tuần ${mwShort(MW.start)} – ${mwShort(MEOW.addDays(MW.start, 6))}`;
    const box = document.getElementById('mw-grid');
    if (!cls) { box.innerHTML = emptyState('Chọn lớp để bắt đầu'); return; }
    const [{ data: cl }, { data: students, error }] = await Promise.all([
      db.from('classes').select('meow_enabled').eq('class_code', cls).maybeSingle(),
      db.from('students').select('id, full_name, avatar_emoji').eq('class_code', cls).order('full_name')
    ]);
    document.getElementById('mw-enabled').checked = !!(cl && cl.meow_enabled);
    if (error) { box.innerHTML = emptyState('Không tải được: ' + esc(error.message)); return; }
    MW.students = students || [];
    const ids = MW.students.map(s => s.id);
    if (!ids.length) { box.innerHTML = emptyState('Lớp chưa có học sinh'); return; }
    const [a, b, c] = await Promise.all([
      db.from('meow_status').select('student_id, day, status').in('student_id', ids).limit(10000),
      db.from('meow_redeem').select('*').in('student_id', ids).order('created_at', { ascending: false }),
      db.from('daily_scores').select('student_id, practice_date, created_at').in('student_id', ids).gte('practice_date', MW.start).lte('practice_date', MEOW.addDays(MW.start, 6))
    ]);
    MW.rows = a.data || []; MW.redeem = b.data || []; MW.scores = c.data || [];
    renderMeow();
  }

  function mwStatus(sid, day) { const r = MW.rows.find(x => x.student_id === sid && x.day === day); return r ? r.status : ''; }

  function renderMeow() {
    const box = document.getElementById('mw-grid');
    const days = [0, 1, 2, 3, 4, 5, 6].map(i => MEOW.addDays(MW.start, i));
    const today = MEOW.iso(new Date());
    const calcs = {};
    MW.students.forEach(s => {
      const rows = MW.rows.filter(r => r.student_id === s.id).map(r => ({ day: r.day, status: r.status }));
      const red = MW.redeem.filter(r => r.student_id === s.id).reduce((n, r) => n + r.amount, 0);
      calcs[s.id] = MEOW.calc(rows, red);
    });
    const head = '<tr><th style="min-width:120px">Ngày</th>' + MW.students.map(s => `<th style="text-align:center;min-width:112px">${esc(s.avatar_emoji || '')} ${esc(s.full_name)}</th>`).join('') + '</tr>';
    const body = days.map(d => {
      const t = MEOW.type(d), b = MEOW.base(d);
      return `<tr${d === today ? ' style="background:rgba(212,168,67,.12)"' : ''}><td><strong>${MW_DAYNAME[MEOW.dow(d)]} ${mwShort(d)}</strong><br><span style="font-size:11px;color:var(--muted)">${t === 'hoc' ? 'Ngày học' : 'Ngày ôn'} · tối đa ${b}</span></td>` +
        MW.students.map(s => {
          const v = mwStatus(s.id, d), m = v ? MEOW.dayMeow(v, d) : null;
          return `<td style="text-align:center"><select class="filter" style="background:${MW_COLOR[v] || ''};min-width:92px" onchange="setMeow('${esc(s.id)}','${d}',this.value)">${MW_OPTS.map(o => `<option value="${o[0]}"${o[0] === v ? ' selected' : ''}>${o[1]}</option>`).join('')}</select>${m !== null ? `<div style="font-size:11px;color:var(--muted);margin-top:2px">+${m}</div>` : ''}</td>`;
        }).join('') + '</tr>';
    }).join('');
    const weekOf = (s) => (calcs[s.id].weeks.find(w => w.start === MW.start) || { sum: 0, bonus: 0, total: 0 });
    const foot = [
      ['Meow trong tuần (ngày)', s => weekOf(s).sum],
      ['Thưởng đủ tuần', s => weekOf(s).bonus ? '+' + weekOf(s).bonus : '—'],
      ['Tổng tuần', s => `<b>${weekOf(s).total}</b>`],
      ['Chuỗi hiện tại', s => calcs[s.id].current + ' ngày'],
      ['Chuỗi dài nhất', s => calcs[s.id].longest + ' ngày'],
      ['Tổng đã kiếm', s => calcs[s.id].total],
      ['Đã đổi thưởng', s => calcs[s.id].redeemed],
      ['Số dư ví Meow', s => `<b style="font-size:17px;color:var(--accent)">${calcs[s.id].balance}</b>`]
    ].map(([label, fn]) => `<tr style="background:rgba(139,115,85,.05)"><td><strong>${label}</strong></td>${MW.students.map(s => `<td style="text-align:center">${fn(s)}</td>`).join('')}</tr>`).join('') +
      `<tr><td></td>${MW.students.map(s => `<td style="text-align:center"><button class="btn-sm" onclick="redeemMeow('${esc(s.id)}')">Đổi thưởng</button></td>`).join('')}</tr>`;
    box.innerHTML = `<table><thead>${head}</thead><tbody>${body}${foot}</tbody></table>`;
  }

  async function setMeow(sid, day, val) {
    let err;
    if (!val) { ({ error: err } = await db.from('meow_status').delete().eq('student_id', sid).eq('day', day)); MW.rows = MW.rows.filter(r => !(r.student_id === sid && r.day === day)); }
    else {
      ({ error: err } = await db.from('meow_status').upsert({ student_id: sid, day, status: val, updated_at: new Date().toISOString() }, { onConflict: 'student_id,day' }));
      const r = MW.rows.find(x => x.student_id === sid && x.day === day); if (r) r.status = val; else MW.rows.push({ student_id: sid, day, status: val });
    }
    if (err) alert('Không lưu được: ' + err.message);
    renderMeow();
  }

  async function suggestMeow() {
    if (!MW.cls) return;
    const today = MEOW.iso(new Date()), up = [];
    MW.students.forEach(s => {
      [0, 1, 2, 3, 4, 5, 6].map(i => MEOW.addDays(MW.start, i)).forEach(d => {
        if (MEOW.type(d) === 'hoc' || d > today || mwStatus(s.id, d)) return;
        const sub = MW.scores.filter(x => x.student_id === s.id && x.practice_date === d).sort((a, b) => a.created_at < b.created_at ? -1 : 1)[0];
        if (!sub) return;
        up.push({ student_id: s.id, day: d, status: new Date(sub.created_at) <= new Date(d + (MW.cls === 'IELTS13' ? 'T23:30:00' : 'T23:00:00')) ? 'du' : 'muon' });
      });
    });
    if (!up.length) { alert('Không có ô nào để gợi ý (chưa có bài nộp mới cho các ô còn trống).'); return; }
    if (!confirm(`Điền ${up.length} ô từ bài đã nộp? Thầy vẫn sửa được từng ô sau đó.`)) return;
    const { error } = await db.from('meow_status').upsert(up, { onConflict: 'student_id,day' });
    if (error) { alert('Không lưu được: ' + error.message); return; }
    loadMeow();
  }

  async function redeemMeow(sid) {
    const s = MW.students.find(x => x.id === sid);
    const rows = MW.rows.filter(r => r.student_id === sid).map(r => ({ day: r.day, status: r.status }));
    const bal = MEOW.calc(rows, MW.redeem.filter(r => r.student_id === sid).reduce((n, r) => n + r.amount, 0)).balance;
    const a = prompt(`${s.full_name} có ${bal} Meow. Đổi bao nhiêu Meow?`, ''); if (!a) return;
    const amount = parseInt(a, 10);
    if (!(amount > 0) || amount > bal) { alert('Số Meow không hợp lệ hoặc vượt quá số dư.'); return; }
    const note = prompt('Đổi lấy gì? (ghi chú)', '') || null;
    const { error } = await db.from('meow_redeem').insert({ student_id: sid, amount, note });
    if (error) { alert('Không lưu được: ' + error.message); return; }
    loadMeow();
  }

  async function toggleMeowClass(on) {
    if (!MW.cls) return;
    const { error } = await db.from('classes').update({ meow_enabled: on }).eq('class_code', MW.cls);
    if (error) alert('Không cập nhật được: ' + error.message);
  }

  /* ---------- Điểm danh (tick vắng, còn lại tự là có mặt) ---------- */
  let AT = { cls: '', students: [], absent: new Set(), sessionId: null };

  async function loadAttendance() {
    const cls = document.getElementById('class-filter-att').value; AT.cls = cls;
    const dayEl = document.getElementById('att-day'); if (!dayEl.value) dayEl.value = MEOW.iso(new Date());
    const list = document.getElementById('att-list');
    if (!cls) { list.innerHTML = '<div class="empty-state"><div class="empty-text">Chọn lớp và ngày</div></div>'; loadAttHistory(); return; }
    const { data: students } = await db.from('students').select('id, full_name, avatar_emoji').eq('class_code', cls).order('full_name');
    AT.students = students || [];
    const { data: sess } = await db.from('attendance_sessions').select('*').eq('class_code', cls).eq('day', dayEl.value).maybeSingle();
    AT.sessionId = sess ? sess.id : null; AT.absent = new Set();
    document.getElementById('att-label').value = sess ? (sess.label || '') : '';
    if (sess) { const { data: ab } = await db.from('attendance_absent').select('student_id').eq('session_id', sess.id); (ab || []).forEach(x => AT.absent.add(x.student_id)); }
    document.getElementById('att-status').textContent = sess ? 'Đã lưu trước đó, có thể sửa' : 'Chưa điểm danh buổi này, mặc định tất cả có mặt';
    renderAttList(); loadAttHistory();
  }

  function renderAttList() {
    const list = document.getElementById('att-list');
    if (!AT.students.length) { list.innerHTML = emptyState('Lớp chưa có học sinh'); return; }
    const absentN = AT.absent.size;
    list.innerHTML = `<div style="font-size:14px;color:var(--muted);margin-bottom:8px">Có mặt <b>${AT.students.length - absentN}</b> · Vắng <b>${absentN}</b> / ${AT.students.length}</div>` +
      AT.students.map(s => `<label style="display:flex;align-items:center;gap:12px;padding:10px 14px;border:1px solid var(--border);border-radius:12px;margin-bottom:8px;cursor:pointer;background:${AT.absent.has(s.id) ? 'rgba(192,57,43,.08)' : 'rgba(90,138,90,.08)'}">
        <input type="checkbox" style="width:20px;height:20px" ${AT.absent.has(s.id) ? 'checked' : ''} onchange="toggleAbsent('${esc(s.id)}', this.checked)">
        <span style="font-size:16px">${esc(s.avatar_emoji || '🎓')} <b>${esc(s.full_name)}</b></span>
        <span style="margin-left:auto;font-weight:700;font-size:13px;color:${AT.absent.has(s.id) ? 'var(--red)' : 'var(--green)'}">${AT.absent.has(s.id) ? 'VẮNG' : 'Có mặt'}</span></label>`).join('');
  }
  function toggleAbsent(id, on) { if (on) AT.absent.add(id); else AT.absent.delete(id); renderAttList(); }

  async function saveAttendance() {
    if (!AT.cls) { alert('Hãy chọn lớp'); return; }
    const day = document.getElementById('att-day').value;
    const label = document.getElementById('att-label').value.trim() || null;
    const { data: sess, error } = await db.from('attendance_sessions').upsert({ class_code: AT.cls, day, label }, { onConflict: 'class_code,day' }).select().single();
    if (error) { alert('Không lưu được: ' + error.message); return; }
    await db.from('attendance_absent').delete().eq('session_id', sess.id);
    if (AT.absent.size) {
      const { error: e2 } = await db.from('attendance_absent').insert([...AT.absent].map(student_id => ({ session_id: sess.id, student_id })));
      if (e2) { alert('Không lưu được danh sách vắng: ' + e2.message); return; }
    }
    AT.sessionId = sess.id;
    document.getElementById('att-status').textContent = '✓ Đã lưu ' + day;
    loadAttHistory();
  }

  async function loadAttHistory() {
    const box = document.getElementById('att-history');
    if (!AT.cls) { box.innerHTML = emptyState('Chọn lớp để xem lịch sử'); loadBirthdays(); return; }
    const { data: sess } = await db.from('attendance_sessions').select('id, day, label, attendance_absent(student_id)').eq('class_code', AT.cls).order('day', { ascending: false }).limit(60);
    const rows = sess || [];
    if (!rows.length) { box.innerHTML = emptyState('Chưa có buổi nào được điểm danh'); loadBirthdays(); return; }
    const name = {}; AT.students.forEach(s => name[s.id] = s.full_name);
    const absCount = {}; rows.forEach(r => (r.attendance_absent || []).forEach(a => absCount[a.student_id] = (absCount[a.student_id] || 0) + 1));
    box.innerHTML = `<div style="padding:12px 24px"><div class="section-sub" style="margin-bottom:8px">Có mặt / tổng ${rows.length} buổi đã điểm danh</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">${AT.students.map(s => `<span class="badge ${absCount[s.id] ? 'badge-gold' : 'badge-green'}">${esc(s.full_name)}: ${rows.length - (absCount[s.id] || 0)}/${rows.length}</span>`).join('')}</div></div>
      <table><thead><tr><th>Ngày</th><th>Buổi</th><th>Vắng</th></tr></thead><tbody>${rows.map(r => `<tr><td>${esc(r.day.split('-').reverse().join('/'))}</td><td>${esc(r.label || '')}</td><td style="color:var(--red)">${(r.attendance_absent || []).map(a => esc(name[a.student_id] || '?')).join(', ') || '<span style="color:var(--green)">Không ai vắng</span>'}</td></tr>`).join('')}</tbody></table>`;
    loadBirthdays();
  }

  async function loadBirthdays() {
    const box = document.getElementById('att-birthdays');
    const { data, error } = await db.from('student_profiles').select('birth_date, students(full_name, class_code)').not('birth_date', 'is', null);
    if (error) { box.innerHTML = emptyState('Không tải được: ' + esc(error.message)); return; }
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const list = (data || []).map(p => {
      const b = new Date(p.birth_date + 'T00:00:00'); let next = new Date(today.getFullYear(), b.getMonth(), b.getDate());
      if (next < today) next = new Date(today.getFullYear() + 1, b.getMonth(), b.getDate());
      return { name: p.students ? p.students.full_name : '?', cls: p.students ? p.students.class_code : '', days: Math.round((next - today) / 86400000), age: next.getFullYear() - b.getFullYear(), d: next };
    }).filter(x => x.days <= 30).sort((a, b) => a.days - b.days);
    box.innerHTML = list.length ? `<table><thead><tr><th>Học sinh</th><th>Lớp</th><th>Ngày</th><th>Tuổi</th><th></th></tr></thead><tbody>${list.map(x => `<tr><td><strong>${esc(x.name)}</strong></td><td><span class="badge badge-gold">${esc(x.cls)}</span></td><td>${String(x.d.getDate()).padStart(2, '0')}/${String(x.d.getMonth() + 1).padStart(2, '0')}</td><td>${x.age}</td><td>${x.days === 0 ? '<span class="badge badge-green">Hôm nay! 🎂</span>' : 'còn ' + x.days + ' ngày'}</td></tr>`).join('')}</tbody></table>`
      : emptyState('Chưa có sinh nhật nào trong 30 ngày tới (hoặc học sinh chưa nhập ngày sinh)');
  }

