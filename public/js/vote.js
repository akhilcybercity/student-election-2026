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
  if (el) { el.style.display='flex'; el.classList.remove('fade-in'); void el.offsetWidth; el.classList.add('fade-in'); }
  updateStepDots(name); voteState.step = name;
}

function updateStepDots(step) {
  const steps = ['lookup','ballot','success'];
  const idx = steps.indexOf(step);
  document.querySelectorAll('.step-dot').forEach((dot,i) => {
    dot.classList.remove('active','done');
    if (i < idx)  dot.classList.add('done');
    if (i === idx) dot.classList.add('active');
  });
}

let isTerminalMode = true;
let terminalPollInterval = null;

async function initLookup() {
  isTerminalMode = true;

  try {
    const settings = await API.Settings.get();
    if (!settings.election_open) {
      showErrorScreen('Voting is Currently Closed','The election has not started yet or has been closed. Please check back later.');
      return;
    }
    document.querySelectorAll('.election-name-text').forEach(el => el.textContent = settings.election_name || 'Student Council Elections');
    document.title = `Vote — ${settings.election_name || 'Elections'}`;

    // Always hide home/back buttons on the voting terminal for security
    document.querySelectorAll('.back-btn').forEach(btn => btn.style.display = 'none');
    
    // Check URL parameters for session
    const urlParams = new URLSearchParams(window.location.search);
    const urlSession = urlParams.get('sessionId') || urlParams.get('session_id');
    if (urlSession) {
      localStorage.setItem('ems_booth_session_id', urlSession);
    }

    // Start waiting loop or prompt for session
    startTerminalPolling();
  } catch(e) {
    showErrorScreen('Connection Error', 'Cannot reach the server. Please check your internet connection and try again.');
  }
}

function setBoothSession(sessionId) {
  localStorage.setItem('ems_booth_session_id', sessionId);
  startTerminalPolling();
}

function clearBoothSession() {
  if (terminalPollInterval) clearInterval(terminalPollInterval);
  terminalPollInterval = null;
  localStorage.removeItem('ems_booth_session_id');
  document.getElementById('session-wait-card').style.display = 'none';
  document.getElementById('session-select-card').style.display = 'block';
}

function startTerminalPolling() {
  showScreen('terminal-wait');
  if (terminalPollInterval) clearInterval(terminalPollInterval);
  
  const sessionId = localStorage.getItem('ems_booth_session_id');
  if (!sessionId) {
    document.getElementById('session-wait-card').style.display = 'none';
    document.getElementById('session-select-card').style.display = 'block';
    return;
  }

  document.getElementById('session-select-card').style.display = 'none';
  document.getElementById('session-wait-card').style.display = 'block';
  document.getElementById('wait-session-label').textContent = `🔄 Session ${sessionId}: Waiting for activation...`;

  terminalPollInterval = setInterval(async () => {
    try {
      const res = await API.Settings.getActiveVoter(sessionId);
      if (res && res.activeVoter) {
        clearInterval(terminalPollInterval);
        terminalPollInterval = null;
        await loadActiveVoter(res.activeVoter);
      }
    } catch (e) {
      console.error('Polling active voter failed:', e);
    }
  }, 2000);
}

async function loadActiveVoter(voter) {
  try {
    const sessionId = localStorage.getItem('ems_booth_session_id') || '1';
    const student = await API.Students.get(voter.studentId);
    if (student.has_voted) {
      // Voter already voted, clear selection on server and resume polling
      await API.Settings.clearActiveVoter(sessionId);
      startTerminalPolling();
      return;
    }
    const classes = await API.Classes.all();
    const cls = classes.find(c => c.id === voter.classId);

    voteState.classId = voter.classId;
    voteState.studentId = voter.studentId;
    voteState.student = student;
    voteState.cls = cls;
    voteState.selections = {};

    // ✅ Always reset submit button before loading next voter's ballot
    const submitBtn = document.getElementById('submit-vote-btn');
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '✅ Submit Vote'; }

    showToast(`Identity verified: Welcome, ${student.name}!`, 'success');
    await buildBallot();
    showScreen('ballot');
    // Scroll ballot area to top for fresh start
    const ballotWrapper = document.querySelector('.ballot-wrapper');
    if (ballotWrapper) ballotWrapper.scrollTop = 0;
  } catch (e) {
    console.error('Error loading active voter details:', e);
    startTerminalPolling();
  }
}

function resetTerminal() {
  // Clear any existing poll loop
  if (terminalPollInterval) clearInterval(terminalPollInterval);
  terminalPollInterval = null;

  // Restore action buttons layout
  const act = document.getElementById('success-actions');
  if (act) act.style.display = 'flex';
  const home = document.getElementById('success-home-btn');
  if (home) home.style.display = 'flex';

  // Reset local state
  voteState = {
    step: 'lookup',
    classId: null, studentId: null, student: null, cls: null,
    selections: {},
  };

  // Start polling again
  startTerminalPolling();
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
  // Reset submit button every time a new ballot is built
  const submitBtn = document.getElementById('submit-vote-btn');
  if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '\u2705 Submit Vote'; }
  const container = document.getElementById('ballot-posts');
  container.innerHTML = '<div class="text-center text-muted" style="padding:20px">⏳ Loading ballot…</div>';
  try {
    const sessionId = localStorage.getItem('ems_booth_session_id') || '1';
    const [positions, candidates, sessionInfo] = await Promise.all([
      API.Positions.all(),
      API.Candidates.byClass(classId),
      apiFetch(`/api/settings/sessions/${sessionId}`).catch(() => null)
    ]);

    // Filter out Cabinet positions vs Standard positions first
    let displayPositions = positions;
    if (classId === 'class-cabinet') {
      displayPositions = positions.filter(p => p.id.startsWith('pos-cabinet-'));
    } else {
      displayPositions = positions.filter(p => !p.id.startsWith('pos-cabinet-'));
      // Further filter to only show the mapped re-election position if active
      if (sessionInfo && sessionInfo.re_election_class_id === classId && sessionInfo.re_election_position_id) {
        displayPositions = displayPositions.filter(p => p.id === sessionInfo.re_election_position_id);
      }
    }

    container.innerHTML = '';
    displayPositions.forEach(pos => {
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
          posCandidates.map(c => {
            const avatarHtml = c.photo
              ? `<img src="${c.photo}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,0.15);margin-right:12px" />`
              : `<div style="width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:center;font-size:1.2rem;margin-right:12px;opacity:0.7">👤</div>`;
            return `<label class="candidate-option" id="opt-${pos.id}-${c.id}" onclick="selectCandidate('${pos.id}','${c.id}')" style="display:flex;align-items:center;padding:12px 18px">
              <input type="radio" name="post-${pos.id}" value="${c.id}" />
              <div class="candidate-radio"><div class="candidate-radio-dot"></div></div>
              ${avatarHtml}
              <div class="candidate-info">
                <div class="candidate-name-text">${c.student_name}</div>
                ${c.roll_no?`<div class="candidate-roll-text">${c.roll_no}</div>`:''}
              </div>
              <span class="candidate-check">✓</span>
            </label>`;
          }).join('') +
          `<label class="nota-option" id="nota-${pos.id}" onclick="selectCandidate('${pos.id}','NOTA')" style="display:flex;align-items:center;padding:12px 18px">
            <input type="radio" name="post-${pos.id}" value="NOTA" />
            <div class="candidate-radio"><div class="candidate-radio-dot"></div></div>
            <div style="width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,0.04);display:flex;align-items:center;justify-content:center;font-size:1.2rem;margin-right:12px;opacity:0.5">🚫</div>
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
    window._ballotPositions = displayPositions;
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

  // Auto-scroll to the next unanswered post section
  const positions = window._ballotPositions || [];
  const currentIdx = positions.findIndex(p => String(p.id) === String(posId));
  if (currentIdx >= 0 && currentIdx < positions.length - 1) {
    // Scroll to next section
    setTimeout(() => {
      const sections = document.querySelectorAll('.post-section');
      const nextSection = sections[currentIdx + 1];
      if (nextSection) {
        nextSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 250);
  } else if (currentIdx === positions.length - 1) {
    // Last position selected — scroll to Submit button
    setTimeout(() => {
      const footer = document.querySelector('.ballot-footer');
      if (footer) footer.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 250);
  }
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
  // Skip review screen — submit directly to save time
  await submitVote();
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

    if (isTerminalMode) {
      try {
        const sessionId = localStorage.getItem('ems_booth_session_id') || '1';
        await API.Settings.clearActiveVoter(sessionId);
      } catch (err) {
        console.error('Failed to clear active voter on server:', err);
      }
    }

    setTimeout(() => {
      if (isTerminalMode) {
        // Customize success page for terminal mode
        const successSub = document.querySelector('.success-sub');
        if (successSub) {
          successSub.innerHTML = `Your vote has been successfully recorded.<br><br><span style="color:var(--gold);font-weight:700">✅ Ready for next voter! Returning to booth in 3 seconds...</span>`;
        }
        const act = document.getElementById('success-actions');
        if (act) act.style.display = 'none';

        // Reset terminal after 3 seconds WITHOUT page reload so session stays locked
        setTimeout(() => {
          resetTerminal();
        }, 3000);
      }
      showScreen('success');
    }, 400);
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
