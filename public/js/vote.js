/**
 * vote.js — Student Voting Portal (API version)
 */

let voteState = {
  step: 'lookup',
  classId: null, studentId: null, student: null, cls: null,
  selections: {},
};

function showScreen(name) {
  document.querySelectorAll('.vote-screen').forEach(s => s.style.display='none');
  const el = document.getElementById(`screen-${name}`);
  if (el) { el.style.display='block'; el.classList.remove('fade-in'); void el.offsetWidth; el.classList.add('fade-in'); }
  updateStepDots(name); voteState.step = name;
}

function updateStepDots(step) {
  const steps = ['lookup','ballot','confirm','success'];
  const idx = steps.indexOf(step);
  document.querySelectorAll('.step-dot').forEach((dot,i) => {
    dot.classList.remove('active','done');
    if (i < idx)  dot.classList.add('done');
    if (i === idx) dot.classList.add('active');
  });
}

async function initLookup() {
  try {
    const settings = await API.Settings.get();
    if (!settings.election_open) {
      showErrorScreen('Voting is Currently Closed','The election has not started yet or has been closed. Please check back later.');
      return;
    }
    const classes = await API.Classes.all();
    const classSelect = document.getElementById('vote-class-select');
    classSelect.innerHTML = '<option value="">— Select your class —</option>' + classes.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
    document.querySelectorAll('.election-name-text').forEach(el => el.textContent = settings.election_name || 'Student Council Elections');
    document.title = `Vote — ${settings.election_name || 'Elections'}`;
    showScreen('lookup');
  } catch(e) {
    showErrorScreen('Connection Error', 'Cannot reach the server. Please check your internet connection and try again.');
  }
}

async function onClassChange() {
  const classId = document.getElementById('vote-class-select').value;
  const studentSelect = document.getElementById('vote-student-select');
  const studentWrap   = document.getElementById('student-select-wrap');
  if (!classId) { studentWrap.style.display='none'; return; }
  try {
    const students = await API.Students.all({ classId });
    const sorted = students.sort((a,b) => a.name.localeCompare(b.name));
    studentSelect.innerHTML = '<option value="">— Select your name —</option>' +
      sorted.map(s=>`<option value="${s.id}">${s.name}${s.roll_no?' ('+s.roll_no+')':''}</option>`).join('');
    studentWrap.style.display='block';
  } catch(e) { showLookupError('Could not load students. Try again.'); }
}

async function proceedToVote() {
  const classId   = document.getElementById('vote-class-select').value;
  const studentId = document.getElementById('vote-student-select').value;
  document.getElementById('lookup-error').style.display='none';
  if (!classId)   { showLookupError('Please select your class');  return; }
  if (!studentId) { showLookupError('Please select your name');   return; }
  try {
    const student = await API.Students.get(studentId);
    if (student.has_voted) {
      showErrorScreen('Already Voted', `${student.name}, you have already cast your vote. Each student is allowed only one vote.`);
      return;
    }
    if (student.is_absent) {
      showErrorScreen('Marked as Absent', `${student.name} is marked absent. If you are present, please contact your class teacher.`);
      return;
    }
    const classes = await API.Classes.all();
    const cls = classes.find(c => c.id === classId);
    voteState.classId=classId; voteState.studentId=studentId; voteState.student=student; voteState.cls=cls; voteState.selections={};
    await buildBallot();
    showScreen('ballot');
  } catch(e) { showLookupError(e.message); }
}

function showLookupError(msg) {
  const el = document.getElementById('lookup-error');
  el.textContent = '⚠️ ' + msg; el.style.display='flex';
}

async function buildBallot() {
  const { classId, student, cls } = voteState;
  document.getElementById('voter-name').textContent = student.name;
  document.getElementById('voter-meta').textContent = `${cls.name} · ${cls.course} · ${student.gender}`;
  const container = document.getElementById('ballot-posts');
  container.innerHTML = '<div class="text-center text-muted" style="padding:20px">⏳ Loading ballot…</div>';
  try {
    const [positions, candidates] = await Promise.all([
      API.Positions.all(),
      API.Candidates.byClass(classId)
    ]);
    container.innerHTML = '';
    positions.forEach(pos => {
      const posCandidates = candidates.filter(c => c.position_id === pos.id);
      const section = document.createElement('div');
      section.className = 'post-section';
      const genderClass  = pos.gender === 'Boy' ? 'boy' : pos.gender === 'Girl' ? 'girl' : 'any';
      const genderSymbol = pos.gender === 'Boy' ? '♂' : pos.gender === 'Girl' ? '♀' : '⚥';
      let candHtml = '';
      if (!posCandidates.length) {
        candHtml = `<div class="no-candidates">No candidates registered for this post</div>`;
      } else {
        candHtml = `<div class="candidates-list">` +
          posCandidates.map(c => `
            <label class="candidate-option" id="opt-${pos.id}-${c.id}" onclick="selectCandidate('${pos.id}','${c.id}')">
              <input type="radio" name="post-${pos.id}" value="${c.id}" />
              <div class="candidate-radio"><div class="candidate-radio-dot"></div></div>
              <div class="candidate-info">
                <div class="candidate-name-text">${c.student_name}</div>
                ${c.roll_no?`<div class="candidate-roll-text">${c.roll_no}</div>`:''}
              </div>
              <span class="candidate-check">✓</span>
            </label>`).join('') +
          `<label class="nota-option" id="nota-${pos.id}" onclick="selectCandidate('${pos.id}','NOTA')">
            <input type="radio" name="post-${pos.id}" value="NOTA" />
            <div class="candidate-radio"><div class="candidate-radio-dot"></div></div>
            <div class="candidate-info"><div class="candidate-name-text text-muted">None of the Above (NOTA)</div></div>
          </label></div>`;
      }
      section.innerHTML = `
        <div class="post-header">
          <span class="post-header-icon">${pos.icon}</span>
          <span class="post-header-label">${pos.label}</span>
          <span class="post-header-gender ${genderClass}">${genderSymbol} ${pos.gender}</span>
        </div>${candHtml}`;
      container.appendChild(section);
    });
    window._ballotPositions = positions;
  } catch(e) { container.innerHTML=`<div class="alert alert-error">❌ ${e.message}</div>`; }
}

function selectCandidate(posId, candidateId) {
  voteState.selections[posId] = candidateId;
  document.querySelectorAll(`[id^="opt-${posId}-"]`).forEach(el => el.classList.remove('selected'));
  const nota = document.getElementById(`nota-${posId}`);
  if (nota) nota.classList.remove('selected');
  if (candidateId === 'NOTA') { if (nota) nota.classList.add('selected'); }
  else {
    const opt = document.getElementById(`opt-${posId}-${candidateId}`);
    if (opt) opt.classList.add('selected');
  }
  updateBallotSummary();
}

function updateBallotSummary() {
  const total    = (window._ballotPositions||[]).length;
  const selected = Object.keys(voteState.selections).length;
  const el = document.getElementById('ballot-summary-text');
  el.textContent = `${selected} of ${total} posts selected`;
  el.style.color = selected === total ? '#34d399' : 'var(--white-70)';
}

async function proceedToConfirm() {
  const total    = (window._ballotPositions||[]).length;
  const selected = Object.keys(voteState.selections).length;
  if (selected < total) {
    showToast(`Please select a candidate for all ${total} posts (${total-selected} remaining)`, 'error');
    return;
  }
  await buildConfirmScreen();
  showScreen('confirm');
}

async function buildConfirmScreen() {
  const positions = window._ballotPositions || await API.Positions.all();
  const candidates = await API.Candidates.byClass(voteState.classId);
  const container = document.getElementById('confirm-items');
  container.innerHTML = positions.map(pos => {
    const cid = voteState.selections[pos.id];
    let candidateName = 'None of the Above (NOTA)';
    if (cid && cid !== 'NOTA') {
      const c = candidates.find(x => x.id === cid);
      if (c) candidateName = c.student_name;
    }
    return `<div class="confirm-item">
      <div>
        <div class="confirm-post-name">${pos.icon} ${pos.label} — ${pos.gender}</div>
        <div class="confirm-candidate-name">${candidateName}</div>
      </div>
      <span style="color:var(--indigo-light);font-size:1.1rem">✓</span>
    </div>`;
  }).join('');
}

function goBackToBallot() { showScreen('ballot'); }

async function submitVote() {
  const btn = document.getElementById('submit-vote-btn');
  btn.disabled=true; btn.textContent='⏳ Submitting…';
  try {
    const positions = window._ballotPositions || [];
    const candidates = await API.Candidates.byClass(voteState.classId);
    const selections = [];
    for (const [posId, cid] of Object.entries(voteState.selections)) {
      if (cid === 'NOTA') continue;
      const c = candidates.find(x => x.id === cid);
      if (c) selections.push({ candidate_id: cid, position_id: posId });
    }
    await API.Votes.cast({ voter_id: voteState.studentId, selections, class_id: voteState.classId });
    setTimeout(() => showScreen('success'), 400);
  } catch(e) {
    if (e.code === 'already_voted') showErrorScreen('Already Voted', e.message);
    else if (e.code === 'is_absent') showErrorScreen('Marked as Absent', e.message);
    else { btn.disabled=false; btn.textContent='✅ Submit My Vote'; showToast(e.message,'error'); }
  }
}

function showErrorScreen(title, msg) {
  document.getElementById('error-title-text').textContent = title;
  document.getElementById('error-msg-text').textContent   = msg;
  showScreen('error');
}

function showToast(msg, type='info') {
  const icons = {success:'✅',error:'❌',warning:'⚠️',info:'ℹ️'};
  const tc = document.getElementById('toast-container');
  const t  = document.createElement('div');
  t.className=`toast toast-${type}`;
  t.innerHTML=`<span>${icons[type]}</span> <span>${msg}</span>`;
  tc.appendChild(t);
  setTimeout(()=>{t.classList.add('hide');setTimeout(()=>t.remove(),350);},4000);
}

document.addEventListener('DOMContentLoaded', () => { initLookup(); });
