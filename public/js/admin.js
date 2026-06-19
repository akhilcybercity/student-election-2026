/**
 * admin.js — Election Management System Admin Panel
 * Full rewrite: uses API.* fetch calls instead of DB.* localStorage
 */

// ─── Toast ────────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const icons = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };
  const tc = document.getElementById('toast-container');
  const t  = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `<span>${icons[type]}</span> <span>${msg}</span>`;
  tc.appendChild(t);
  setTimeout(() => { t.classList.add('hide'); setTimeout(() => t.remove(), 350); }, 3500);
}

// ─── Confirm dialog ───────────────────────────────────────────────
function showConfirm(title, body, onConfirm) {
  const overlay = document.getElementById('confirm-overlay');
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-body').textContent  = body;
  overlay.classList.add('active');
  document.getElementById('confirm-yes').onclick = () => { overlay.classList.remove('active'); onConfirm(); };
  document.getElementById('confirm-no').onclick  = () => overlay.classList.remove('active');
}

// ─── Auth ─────────────────────────────────────────────────────────
async function checkAuth() {
  if (Auth.isLoggedIn()) { showAdminPanel(); } 
}

async function doLogin() {
  const pw  = document.getElementById('login-password').value.trim();
  const err = document.getElementById('login-error');
  err.style.display = 'none';
  try {
    const { token } = await API.Auth.login(pw);
    Auth.setToken(token);
    showAdminPanel();
  } catch {
    err.style.display = 'flex';
    document.getElementById('login-password').value = '';
  }
}

function doLogout() {
  Auth.clear();
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('admin-panel').style.display  = 'none';
}

function showAdminPanel() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('admin-panel').style.display  = 'flex';
  navigateTo('dashboard');
  loadElectionToggle();
}

// ─── Election toggle ──────────────────────────────────────────────
async function loadElectionToggle() {
  try {
    const s = await API.Settings.get();
    const toggle = document.getElementById('election-toggle');
    const txt    = document.getElementById('election-status-text');
    toggle.checked = s.election_open;
    txt.textContent = s.election_open ? 'Open' : 'Closed';
    txt.style.color = s.election_open ? '#34d399' : '#fb7185';
  } catch {}
}

async function toggleElection() {
  try {
    const s   = await API.Settings.get();
    const val = !s.election_open;
    await API.Settings.update({ election_open: val });
    await loadElectionToggle();
    showToast(`Voting is now ${val ? 'OPEN 🟢' : 'CLOSED 🔴'}`, val ? 'success' : 'warning');
  } catch(e) { showToast(e.message, 'error'); }
}

// ─── Navigation ───────────────────────────────────────────────────
let currentPage = 'dashboard';
function navigateTo(page) {
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const navEl = document.querySelector(`[data-page="${page}"]`);
  if (navEl) navEl.classList.add('active');
  document.querySelectorAll('.page-section').forEach(s => s.style.display = 'none');
  const section = document.getElementById(`page-${page}`);
  if (section) { section.style.display='block'; section.classList.remove('fade-in'); void section.offsetWidth; section.classList.add('fade-in'); }
  const titles = { dashboard:'Dashboard', classes:'Manage Classes', students:'Manage Students', candidates:'Manage Candidates', positions:'Manage Positions', absent:'Mark Absent / Present', results:'Election Results', settings:'Settings' };
  document.getElementById('topbar-title').textContent = titles[page] || page;
  switch(page) {
    case 'dashboard':  renderDashboard();  break;
    case 'classes':    renderClasses();    break;
    case 'students':   renderStudents();   break;
    case 'candidates': renderCandidates(); break;
    case 'positions':  renderPositions();  break;
    case 'absent':     renderAbsent();     break;
    case 'results':    renderResults();    break;
    case 'settings':   renderSettings();   break;
  }
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('active');
}

// ─── Dashboard ────────────────────────────────────────────────────
async function renderDashboard() {
  try {
    const [stats, settings, classes] = await Promise.all([
      API.Votes.stats(), API.Settings.get(), API.Classes.all()
    ]);
    document.getElementById('dash-total-classes').textContent  = stats.total_classes  || 0;
    document.getElementById('dash-total-students').textContent = stats.total_students || 0;
    document.getElementById('dash-total-voted').textContent    = stats.total_voted    || 0;
    document.getElementById('dash-total-pending').textContent  = stats.total_pending  || 0;
    document.getElementById('dash-total-absent').textContent   = stats.total_absent   || 0;
    document.getElementById('dash-total-votes').textContent    = stats.total_votes    || 0;

    const eligible = (stats.total_students||0) - (stats.total_absent||0);
    const pct = eligible > 0 ? Math.round(((stats.total_voted||0) / eligible) * 100) : 0;
    document.getElementById('dash-turnout-pct').textContent = `${pct}%`;
    document.getElementById('dash-turnout-bar').style.width = `${Math.min(pct,100)}%`;

    const statusEl = document.getElementById('dash-election-status');
    statusEl.innerHTML = settings.election_open
      ? '<span class="badge badge-green">🟢 Voting is OPEN</span>'
      : '<span class="badge badge-red">🔴 Voting is CLOSED</span>';

    // Class-wise progress
    const tbody = document.getElementById('dash-class-progress');
    if (!classes.length) { tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted" style="padding:20px">No classes yet</td></tr>'; return; }

    const statsRows = await Promise.all(classes.slice(0,15).map(c => API.Classes.stats(c.id).then(s => ({ cls:c, s }))));
    tbody.innerHTML = statsRows.map(({ cls, s }) => {
      const p = s.total > 0 ? Math.round((s.voted / s.total) * 100) : 0;
      return `<tr>
        <td><strong>${cls.name}</strong></td>
        <td>${s.total}</td>
        <td><span class="badge badge-green">${s.voted}</span></td>
        <td><span class="badge badge-red">${s.absent}</span></td>
        <td><div style="display:flex;align-items:center;gap:8px;min-width:100px">
          <div class="progress-bar-wrap" style="flex:1"><div class="progress-bar-fill" style="width:${p}%"></div></div>
          <span class="text-xs text-muted">${p}%</span>
        </div></td>
      </tr>`;
    }).join('');
  } catch(e) { showToast('Dashboard error: ' + e.message, 'error'); }
}

// ─── Classes ──────────────────────────────────────────────────────
async function renderClasses() {
  try {
    const classes = await API.Classes.all();
    const badge = document.querySelector('[data-page="classes"] .nav-badge');
    if (badge) badge.textContent = classes.length;
    const grid = document.getElementById('classes-grid');
    if (!classes.length) { grid.innerHTML = `<div class="empty-state"><div class="empty-icon">🏫</div><p>No classes yet. Add your first class!</p></div>`; return; }

    const statsArr = await Promise.all(classes.map(c => API.Classes.stats(c.id).then(s => ({ id:c.id, s }))));
    const statsMap = {};
    statsArr.forEach(x => statsMap[x.id] = x.s);

    grid.innerHTML = classes.map(cls => {
      const s = statsMap[cls.id] || {};
      return `<div class="class-card" id="cls-${cls.id}">
        <div class="class-card-header">
          <div>
            <div class="class-card-title">${cls.name}</div>
            <div class="class-card-meta">${cls.course} · Year ${cls.year} · Section ${cls.section}</div>
          </div>
          <div class="class-card-actions">
            <button class="btn btn-ghost btn-sm" onclick="openEditClass('${cls.id}')">✏️</button>
            <button class="btn btn-danger btn-sm" onclick="confirmDeleteClass('${cls.id}','${cls.name}')">🗑️</button>
          </div>
        </div>
        <div class="divider" style="margin:10px 0"></div>
        <div class="class-card-stats">
          <div class="class-card-stat">👥 <strong>${(s.total||0)+(s.absent||0)}</strong> Students</div>
          <div class="class-card-stat">✅ <strong>${s.voted||0}</strong> Voted</div>
          <div class="class-card-stat">⏳ <strong>${s.pending||0}</strong> Pending</div>
          <div class="class-card-stat">🚫 <strong>${s.absent||0}</strong> Absent</div>
        </div>
      </div>`;
    }).join('');
  } catch(e) { showToast(e.message, 'error'); }
}

function openAddClass() {
  document.getElementById('class-modal-title').textContent = 'Add New Class';
  document.getElementById('class-id-field').value = '';
  ['class-name','class-course','class-section'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('class-year').value = '1';
  document.getElementById('class-modal').classList.add('active');
}

async function openEditClass(id) {
  try {
    const classes = await API.Classes.all();
    const cls = classes.find(c => c.id === id);
    if (!cls) return;
    document.getElementById('class-modal-title').textContent = 'Edit Class';
    document.getElementById('class-id-field').value  = cls.id;
    document.getElementById('class-name').value      = cls.name;
    document.getElementById('class-course').value    = cls.course;
    document.getElementById('class-year').value      = cls.year;
    document.getElementById('class-section').value   = cls.section;
    document.getElementById('class-modal').classList.add('active');
  } catch(e) { showToast(e.message,'error'); }
}

function closeClassModal() { document.getElementById('class-modal').classList.remove('active'); }

async function saveClass() {
  const id = document.getElementById('class-id-field').value.trim();
  const name=document.getElementById('class-name').value.trim(), course=document.getElementById('class-course').value.trim();
  const year=document.getElementById('class-year').value, section=document.getElementById('class-section').value.trim();
  if (!name||!course||!section) { showToast('Fill all fields','error'); return; }
  try {
    if (id) { await API.Classes.update(id,{name,course,year,section}); showToast('Class updated ✅','success'); }
    else     { await API.Classes.add({name,course,year,section}); showToast('Class added ✅','success'); }
    closeClassModal(); renderClasses();
  } catch(e) { showToast(e.message,'error'); }
}

function confirmDeleteClass(id, name) {
  showConfirm('Delete Class?', `Permanently delete "${name}" and all its students, candidates, and votes?`, async () => {
    try { await API.Classes.delete(id); showToast('Class deleted','warning'); renderClasses(); } catch(e) { showToast(e.message,'error'); }
  });
}

// ─── Positions ────────────────────────────────────────────────────
async function renderPositions() {
  try {
    const positions = await API.Positions.all();
    const list = document.getElementById('positions-list');
    if (!positions.length) {
      list.innerHTML = `<div class="empty-state"><div class="empty-icon">🏅</div><p>No positions yet. Create your first election position!</p></div>`;
      return;
    }
    list.innerHTML = positions.map(p => `
      <div class="class-card" style="margin-bottom:12px">
        <div class="class-card-header">
          <div>
            <div class="class-card-title">${p.icon} ${p.label}</div>
            <div class="class-card-meta">Gender: <span class="badge ${p.gender==='Boy'?'badge-indigo':p.gender==='Girl'?'badge-red':'badge-gray'}">${p.gender}</span> · Order: ${p.sort_order}</div>
          </div>
          <div class="class-card-actions">
            <button class="btn btn-ghost btn-sm" onclick="openEditPosition('${p.id}')">✏️</button>
            <button class="btn btn-danger btn-sm" onclick="confirmDeletePosition('${p.id}','${p.label}')">🗑️</button>
          </div>
        </div>
      </div>`).join('');
  } catch(e) { showToast(e.message,'error'); }
}

function openAddPosition() {
  document.getElementById('pos-modal-title').textContent = 'Add New Position';
  document.getElementById('pos-id-field').value = '';
  document.getElementById('pos-label').value    = '';
  document.getElementById('pos-icon').value     = '🏅';
  document.getElementById('pos-gender').value   = 'Boy';
  document.getElementById('pos-order').value    = '0';
  document.getElementById('pos-modal').classList.add('active');
}

async function openEditPosition(id) {
  try {
    const positions = await API.Positions.all();
    const p = positions.find(x => x.id === id);
    if (!p) return;
    document.getElementById('pos-modal-title').textContent = 'Edit Position';
    document.getElementById('pos-id-field').value = p.id;
    document.getElementById('pos-label').value    = p.label;
    document.getElementById('pos-icon').value     = p.icon;
    document.getElementById('pos-gender').value   = p.gender;
    document.getElementById('pos-order').value    = p.sort_order;
    document.getElementById('pos-modal').classList.add('active');
  } catch(e) { showToast(e.message,'error'); }
}

function closePosModal() { document.getElementById('pos-modal').classList.remove('active'); }

async function savePosition() {
  const id     = document.getElementById('pos-id-field').value.trim();
  const label  = document.getElementById('pos-label').value.trim();
  const icon   = document.getElementById('pos-icon').value.trim()   || '🏅';
  const gender = document.getElementById('pos-gender').value;
  const sort_order = parseInt(document.getElementById('pos-order').value) || 0;
  if (!label) { showToast('Position name is required','error'); return; }
  try {
    if (id) { await API.Positions.update(id,{label,icon,gender,sort_order}); showToast('Position updated ✅','success'); }
    else     { await API.Positions.add({label,icon,gender,sort_order});      showToast('Position created ✅','success'); }
    closePosModal(); renderPositions();
  } catch(e) { showToast(e.message,'error'); }
}

function confirmDeletePosition(id, label) {
  showConfirm('Delete Position?', `Delete "${label}"? Candidates assigned to this position will also be removed.`, async () => {
    try { await API.Positions.delete(id); showToast('Position deleted','warning'); renderPositions(); } catch(e) { showToast(e.message,'error'); }
  });
}

// ─── Students ────────────────────────────────────────────────────
let studentFilterClass='', studentFilterGender='', studentSearch='';

async function renderStudents() {
  try {
    const classes = await API.Classes.all();
    const classSelect = document.getElementById('student-filter-class');
    const addClassSel = document.getElementById('student-class-select');
    const opts = '<option value="">All Classes</option>' + classes.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
    classSelect.innerHTML = opts;
    addClassSel.innerHTML = '<option value="">— Select Class —</option>' + classes.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
    classSelect.value = studentFilterClass;
    renderStudentTable();
  } catch(e) { showToast(e.message,'error'); }
}

async function renderStudentTable() {
  try {
    const filters = {};
    if (studentFilterClass)  filters.classId = studentFilterClass;
    if (studentFilterGender) filters.gender  = studentFilterGender;
    if (studentSearch)       filters.search  = studentSearch;
    const students = await API.Students.all(filters);
    const badge = document.querySelector('[data-page="students"] .nav-badge');
    if (badge) badge.textContent = students.length;
    const tbody = document.getElementById('students-tbody');
    if (!students.length) { tbody.innerHTML='<tr><td colspan="6" class="text-center text-muted" style="padding:24px">No students found</td></tr>'; return; }
    tbody.innerHTML = students.map(s => {
      const statusBadge = s.is_absent ? '<span class="badge badge-red">Absent</span>' : s.has_voted ? '<span class="badge badge-green">Voted</span>' : '<span class="badge badge-gray">Pending</span>';
      const genderTag   = `<span class="gender-tag gender-${s.gender.toLowerCase()}">${s.gender==='Boy'?'♂':'♀'} ${s.gender}</span>`;
      return `<tr>
        <td><strong>${s.name}</strong>${s.roll_no?`<br><span class="text-xs text-muted">${s.roll_no}</span>`:''}</td>
        <td>${genderTag}</td>
        <td>${s.class_name||'—'}</td>
        <td>${statusBadge}</td>
        <td>${s.voted_at ? new Date(s.voted_at).toLocaleTimeString() : '—'}</td>
        <td><div style="display:flex;gap:6px">
          <button class="btn btn-ghost btn-sm" onclick="openEditStudent('${s.id}')">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="confirmDeleteStudent('${s.id}','${s.name.replace(/'/g,"\\'")}')">🗑️</button>
        </div></td>
      </tr>`;
    }).join('');
  } catch(e) { showToast(e.message,'error'); }
}

function openAddStudent() {
  document.getElementById('student-modal-title').textContent = 'Add New Student';
  document.getElementById('student-id-field').value = '';
  ['student-name','student-roll'].forEach(id => document.getElementById(id).value='');
  document.getElementById('student-gender').value = 'Boy';
  document.getElementById('student-class-select').value = '';
  document.getElementById('student-modal').classList.add('active');
}

async function openEditStudent(id) {
  try {
    const s = await API.Students.get(id);
    document.getElementById('student-modal-title').textContent = 'Edit Student';
    document.getElementById('student-id-field').value   = s.id;
    document.getElementById('student-name').value       = s.name;
    document.getElementById('student-roll').value       = s.roll_no||'';
    document.getElementById('student-gender').value     = s.gender;
    document.getElementById('student-class-select').value = s.class_id;
    document.getElementById('student-modal').classList.add('active');
  } catch(e) { showToast(e.message,'error'); }
}

function closeStudentModal() { document.getElementById('student-modal').classList.remove('active'); }

async function saveStudent() {
  const id       = document.getElementById('student-id-field').value.trim();
  const name     = document.getElementById('student-name').value.trim();
  const roll_no  = document.getElementById('student-roll').value.trim();
  const gender   = document.getElementById('student-gender').value;
  const class_id = document.getElementById('student-class-select').value;
  if (!name||!class_id) { showToast('Name and Class are required','error'); return; }
  try {
    if (id) { await API.Students.update(id,{name,roll_no,gender,class_id}); showToast('Student updated ✅','success'); }
    else     { await API.Students.add({name,roll_no,gender,class_id});      showToast('Student added ✅','success'); }
    closeStudentModal(); renderStudentTable();
  } catch(e) { showToast(e.message,'error'); }
}

function confirmDeleteStudent(id, name) {
  showConfirm('Remove Student?', `Remove "${name}"? Their vote data will also be deleted.`, async () => {
    try { await API.Students.delete(id); showToast('Student removed','warning'); renderStudentTable(); } catch(e) { showToast(e.message,'error'); }
  });
}

// ─── Excel Import ─────────────────────────────────────────────────
async function importExcel() {
  const file = document.getElementById('excel-file').files[0];
  if (!file) { showToast('Select an Excel file first','error'); return; }
  const btn = document.getElementById('import-btn');
  btn.disabled = true; btn.textContent = '⏳ Importing…';
  try {
    const fd = new FormData();
    fd.append('file', file);
    const res = await API.Students.import(fd);
    const errHtml = res.errors && res.errors.length
      ? `<div style="margin-top:12px;max-height:160px;overflow-y:auto">` +
        res.errors.map(e=>`<div class="text-xs text-muted" style="padding:3px 0;border-bottom:1px solid var(--white-05)">Row ${e.row}${e.name?' ('+e.name+')':''}: ${e.error}</div>`).join('') +
        `</div>` : '';
    document.getElementById('import-result').innerHTML = `
      <div class="alert alert-success">✅ Imported ${res.imported} students</div>
      ${res.skipped ? `<div class="alert alert-warning" style="margin-top:8px">⚠️ Skipped ${res.skipped} rows${errHtml}</div>` : ''}`;
    document.getElementById('excel-file').value = '';
    renderStudentTable();
  } catch(e) {
    document.getElementById('import-result').innerHTML = `<div class="alert alert-error">❌ ${e.message}</div>`;
  } finally {
    btn.disabled=false; btn.textContent='📥 Import Students';
  }
}

// ─── Candidates ───────────────────────────────────────────────────
async function renderCandidates() {
  try {
    const classes = await API.Classes.all();
    const sel = document.getElementById('cand-class-select');
    sel.innerHTML = '<option value="">— Select a Class —</option>' + classes.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
    document.getElementById('cand-posts-section').style.display = 'none';
  } catch(e) { showToast(e.message,'error'); }
}

async function loadCandidatePosts() {
  const classId = document.getElementById('cand-class-select').value;
  if (!classId) { document.getElementById('cand-posts-section').style.display='none'; return; }
  document.getElementById('cand-posts-section').style.display = 'block';
  try {
    const [positions, candidates, students] = await Promise.all([
      API.Positions.all(),
      API.Candidates.byClass(classId),
      API.Students.all({ classId })
    ]);
    const wrap = document.getElementById('cand-posts-wrap');
    if (!positions.length) {
      wrap.innerHTML = '<div class="alert alert-warning">⚠️ No positions defined yet. Go to <strong>Manage Positions</strong> first.</div>';
      return;
    }
    wrap.innerHTML = positions.map(pos => {
      const assigned = candidates.filter(c => c.position_id === pos.id);
      const eligible = students.filter(s =>
        (pos.gender === 'Any' || s.gender === pos.gender) &&
        !assigned.find(a => a.student_id === s.id)
      );
      const chips = assigned.map(c =>
        `<span class="candidate-chip">${c.student_name} <button class="candidate-chip-remove" onclick="removeCandidate('${c.id}','${classId}')">✕</button></span>`
      ).join('');
      return `<div class="candidate-post-section">
        <div class="candidate-post-header">
          <span>${pos.icon}</span>
          <span>${pos.label}</span>
          <span class="badge ${pos.gender==='Boy'?'badge-indigo':pos.gender==='Girl'?'badge-red':'badge-gray'}" style="margin-left:auto">${pos.gender}</span>
        </div>
        <div class="candidate-chips" id="chips-${pos.id}">${chips||'<span class="text-muted text-sm">No candidates assigned</span>'}</div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <select class="form-select" id="cand-add-${pos.id}" style="width:auto;flex:1;min-width:180px">
            <option value="">+ Add candidate (${pos.gender} only)</option>
            ${eligible.map(s=>`<option value="${s.id}">${s.name}${s.roll_no?' ('+s.roll_no+')':''}</option>`).join('')}
          </select>
          <button class="btn btn-primary btn-sm" onclick="addCandidate('${classId}','${pos.id}')">Add</button>
        </div>
      </div>`;
    }).join('<div class="divider"></div>');
  } catch(e) { showToast(e.message,'error'); }
}

async function addCandidate(classId, positionId) {
  const sel = document.getElementById(`cand-add-${positionId}`);
  const studentId = sel.value;
  if (!studentId) { showToast('Select a student first','error'); return; }
  try {
    await API.Candidates.add({ student_id: studentId, class_id: classId, position_id: positionId });
    showToast('Candidate added ✅','success'); loadCandidatePosts();
  } catch(e) { showToast(e.message,'error'); }
}

async function removeCandidate(candidateId, classId) {
  try {
    await API.Candidates.delete(candidateId);
    showToast('Candidate removed','warning'); loadCandidatePosts();
  } catch(e) { showToast(e.message,'error'); }
}

// ─── Absent ───────────────────────────────────────────────────────
async function renderAbsent() {
  try {
    const classes = await API.Classes.all();
    const sel = document.getElementById('absent-class-select');
    sel.innerHTML = '<option value="">— Select a Class —</option>' + classes.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
    document.getElementById('absent-list').innerHTML = '';
  } catch(e) { showToast(e.message,'error'); }
}

async function loadAbsentList() {
  const classId = document.getElementById('absent-class-select').value;
  const list    = document.getElementById('absent-list');
  if (!classId) { list.innerHTML=''; return; }
  try {
    const students = await API.Students.all({ classId });
    if (!students.length) { list.innerHTML='<div class="empty-state"><div class="empty-icon">👥</div><p>No students in this class</p></div>'; return; }
    const boys  = students.filter(s => s.gender==='Boy');
    const girls = students.filter(s => s.gender==='Girl');
    const renderGroup = (group, label) => {
      if (!group.length) return '';
      return `<div style="margin-bottom:20px">
        <div class="text-sm font-semi text-muted" style="margin-bottom:10px;text-transform:uppercase;letter-spacing:.06em">${label}</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px">
          ${group.map(s => `
            <div style="display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:var(--radius-sm);background:var(--white-05);border:1px solid var(--white-10)">
              <div style="flex:1">
                <div class="font-semi text-sm">${s.name}</div>
                ${s.roll_no?`<div class="text-xs text-muted">${s.roll_no}</div>`:''}
                ${s.has_voted?'<span class="badge badge-green" style="margin-top:3px">Voted</span>':''}
              </div>
              <label style="cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:3px">
                <div class="toggle-switch" style="width:38px;height:20px">
                  <input type="checkbox" id="abs-${s.id}" ${s.is_absent?'checked':''} onchange="toggleAbsent('${s.id}',this.checked)" ${s.has_voted?'disabled':''}>
                  <div class="toggle-track"></div>
                  <div class="toggle-thumb" style="top:2px;left:2px;width:16px;height:16px"></div>
                </div>
                <span class="text-xs" style="color:${s.is_absent?'#fb7185':'var(--white-70)'}">${s.is_absent?'Absent':'Present'}</span>
              </label>
            </div>`).join('')}
        </div>
      </div>`;
    };
    list.innerHTML = renderGroup(boys,'♂ Boys') + renderGroup(girls,'♀ Girls');
  } catch(e) { showToast(e.message,'error'); }
}

async function toggleAbsent(studentId, isAbsent) {
  try {
    await API.Students.markAbsent(studentId, isAbsent);
    showToast(isAbsent ? 'Marked as Absent 🚫' : 'Marked as Present ✅', isAbsent ? 'warning' : 'success');
  } catch(e) {
    showToast(e.message,'error');
    // Revert toggle
    const cb = document.getElementById(`abs-${studentId}`);
    if (cb) cb.checked = !isAbsent;
  }
}

// ─── Results ──────────────────────────────────────────────────────
async function renderResults() {
  const container = document.getElementById('results-container');
  container.innerHTML = '<div class="text-center text-muted" style="padding:40px">⏳ Loading results…</div>';
  try {
    const classId = document.getElementById('result-filter-class')?.value || '';
    const [results, classes] = await Promise.all([API.Votes.results(classId), API.Classes.all()]);

    // Populate filter
    const fSel = document.getElementById('result-filter-class');
    if (fSel && fSel.options.length <= 1) {
      fSel.innerHTML = '<option value="">All Classes</option>' + classes.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
    }

    if (!results.length) { container.innerHTML='<div class="empty-state"><div class="empty-icon">📊</div><p>No results yet</p></div>'; return; }

    container.innerHTML = results.map(({ class: cls, stats, positions }) => {
      const pct = stats.total > 0 ? Math.round((stats.voted / stats.total) * 100) : 0;
      const posHtml = positions.map(pos => {
        const maxV = pos.candidates.length ? pos.candidates[0].votes : 1;
        const candHtml = pos.candidates.length === 0
          ? '<div class="result-candidate"><span class="text-muted text-sm">No candidates</span></div>'
          : pos.candidates.map((c,i) => {
              const pv = maxV > 0 ? Math.round((c.votes/maxV)*100) : 0;
              return `<div class="result-candidate ${i===0&&c.votes>0?'winner':''}">
                <span class="result-candidate-name">${c.name} ${i===0&&c.votes>0?'<span class="winner-crown">👑</span>':''}</span>
                <div class="result-votes">
                  <div class="vote-bar-wrap"><div class="vote-bar-fill" style="width:${pv}%"></div></div>
                  <span class="vote-count">${c.votes}</span>
                </div>
              </div>`;
            }).join('');
        return `<div class="result-post-card">
          <div class="result-post-header">${pos.icon} ${pos.label} — ${pos.gender}</div>
          ${candHtml}
        </div>`;
      }).join('');
      return `<div class="result-class-card">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:14px">
          <div>
            <div class="result-class-title">${cls.name}</div>
            <div class="result-class-turnout">${cls.course} · Year ${cls.year} · Section ${cls.section}</div>
            <div style="display:flex;gap:12px;flex-wrap:wrap;font-size:.8125rem;color:var(--white-70)">
              <span>👥 ${(stats.total||0)+(stats.absent||0)} Total</span>
              <span>✅ ${stats.voted||0} Voted</span>
              <span>🚫 ${stats.absent||0} Absent</span>
              <span>⏳ ${stats.pending||0} Pending</span>
            </div>
          </div>
          <div style="text-align:right"><div style="font-size:1.5rem;font-weight:800">${pct}%</div><div class="text-xs text-muted">Turnout</div></div>
        </div>
        <div class="progress-bar-wrap" style="margin-bottom:16px"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
        <div class="result-posts-grid">${posHtml}</div>
      </div>`;
    }).join('');
  } catch(e) { container.innerHTML=`<div class="alert alert-error">❌ ${e.message}</div>`; }
}

async function exportResults() {
  try {
    const results = await API.Votes.results('');
    const settings = await API.Settings.get();
    let text = `${settings.election_name} — Results\nGenerated: ${new Date().toLocaleString()}\n\n`;
    results.forEach(({ class: cls, stats, positions }) => {
      text += `=== ${cls.name} (${cls.course}, Year ${cls.year}) ===\n`;
      text += `Turnout: ${stats.voted}/${(stats.total||0)+(stats.absent||0)} | Absent: ${stats.absent}\n\n`;
      positions.forEach(pos => {
        text += `  ${pos.icon} ${pos.label} — ${pos.gender}:\n`;
        if (!pos.candidates.length) text += '    No candidates\n';
        else pos.candidates.forEach((c,i) => { text += `    ${i===0&&c.votes>0?'👑 ':'   '}${c.name}: ${c.votes} vote${c.votes!==1?'s':''}\n`; });
        text += '\n';
      });
      text += '\n';
    });
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `election-results-${Date.now()}.txt`;
    a.click();
    showToast('Results exported ✅','success');
  } catch(e) { showToast(e.message,'error'); }
}

// ─── Settings ────────────────────────────────────────────────────
async function renderSettings() {
  try {
    const s = await API.Settings.get();
    document.getElementById('set-election-name').value = s.election_name||'';
    document.getElementById('set-college-name').value  = s.college_name||'';
  } catch(e) { showToast(e.message,'error'); }
}

async function saveGeneralSettings() {
  const election_name = document.getElementById('set-election-name').value.trim();
  const college_name  = document.getElementById('set-college-name').value.trim();
  if (!election_name||!college_name) { showToast('Fill all fields','error'); return; }
  try { await API.Settings.update({election_name,college_name}); showToast('Settings saved ✅','success'); } catch(e) { showToast(e.message,'error'); }
}

async function savePasswordSettings() {
  const curr = document.getElementById('set-curr-pass').value;
  const nw   = document.getElementById('set-new-pass').value;
  const conf = document.getElementById('set-conf-pass').value;
  if (nw.length < 4)  { showToast('New password must be at least 4 characters','error'); return; }
  if (nw !== conf)    { showToast('Passwords do not match','error'); return; }
  try {
    await API.Auth.changePassword(curr, nw);
    ['set-curr-pass','set-new-pass','set-conf-pass'].forEach(id => document.getElementById(id).value='');
    showToast('Password changed ✅','success');
  } catch(e) { showToast(e.message,'error'); }
}

async function resetAllVotes() {
  showConfirm('Reset All Votes?','This will clear ALL votes and mark all students as "not voted". Cannot be undone.', async () => {
    try { await API.Votes.reset(); showToast('All votes reset ⚠️','warning'); renderDashboard(); } catch(e) { showToast(e.message,'error'); }
  });
}

// ─── Mobile sidebar ───────────────────────────────────────────────
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('active');
}

// ─── Init ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('login-password').addEventListener('keydown', e => { if (e.key==='Enter') doLogin(); });
  document.getElementById('election-toggle').addEventListener('change', toggleElection);
  document.getElementById('student-filter-class').addEventListener('change',  e => { studentFilterClass  = e.target.value; renderStudentTable(); });
  document.getElementById('student-filter-gender').addEventListener('change', e => { studentFilterGender = e.target.value; renderStudentTable(); });
  document.getElementById('student-search').addEventListener('input',          e => { studentSearch       = e.target.value; renderStudentTable(); });
  document.getElementById('topbar-date').textContent = new Date().toLocaleDateString('en-IN',{weekday:'short',year:'numeric',month:'short',day:'numeric'});
  checkAuth();
});
