/**
 * api.js — Frontend API wrapper
 * Replaces localStorage db.js — all calls go to the Node.js server
 */

const API_BASE = window.location.origin;

// ─── Auth token ──────────────────────────────────────────────────
const Auth = {
  getToken: () => sessionStorage.getItem('ems_token'),
  setToken: (t) => sessionStorage.setItem('ems_token', t),
  clear:    () => sessionStorage.removeItem('ems_token'),
  isLoggedIn: () => !!sessionStorage.getItem('ems_token'),
};

// ─── Core fetch wrapper ──────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const token = Auth.getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.code   = data.error;
    err.status = res.status;
    throw err;
  }
  return data;
}

// ─── Multipart fetch (for file upload) ──────────────────────────
async function apiUpload(path, formData) {
  const token = Auth.getToken();
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers, body: formData });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ─── API namespaces ──────────────────────────────────────────────
const API = {
  // Settings
  Settings: {
    get:              ()      => apiFetch('/api/settings'),
    update:           (data)  => apiFetch('/api/settings', { method:'PUT', body: JSON.stringify(data) }),
    getActiveVoter:   (sessionId) => apiFetch(`/api/settings/active-voter${sessionId ? '?sessionId=' + sessionId : ''}`),
    setActiveVoter:   (data)  => apiFetch('/api/settings/active-voter', { method:'POST', body: JSON.stringify(data) }),
    clearActiveVoter: (sessionId) => apiFetch(`/api/settings/active-voter${sessionId ? '?sessionId=' + sessionId : ''}`, { method:'DELETE' }),
    sessions:         ()      => apiFetch('/api/settings/sessions'),
    updateSession:    (id, d) => apiFetch(`/api/settings/sessions/${id}`, { method:'PUT', body: JSON.stringify(d) }),
  },


  // Auth
  Auth: {
    login:          (username, password)        => apiFetch('/api/auth/login',           { method:'POST', body: JSON.stringify({ username, password }) }),
    changePassword: (currentPassword, newPassword) => apiFetch('/api/auth/change-password', { method:'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
  },

  // Classes
  Classes: {
    all:    ()      => apiFetch('/api/classes'),
    add:    (data)  => apiFetch('/api/classes', { method:'POST', body: JSON.stringify(data) }),
    update: (id, d) => apiFetch(`/api/classes/${id}`, { method:'PUT',    body: JSON.stringify(d) }),
    delete: (id)    => apiFetch(`/api/classes/${id}`, { method:'DELETE'  }),
    stats:  (id)    => apiFetch(`/api/classes/${id}/stats`),
  },

  // Staff (NEW)
  Staff: {
    all:    ()      => apiFetch('/api/staff'),
    add:    (data)  => apiFetch('/api/staff', { method:'POST', body: JSON.stringify(data) }),
    update: (id, d) => apiFetch(`/api/staff/${id}`, { method:'PUT',    body: JSON.stringify(d) }),
    delete: (id)    => apiFetch(`/api/staff/${id}`, { method:'DELETE'  }),
  },

  // Positions
  Positions: {
    all:    ()       => apiFetch('/api/positions'),
    add:    (data)   => apiFetch('/api/positions', { method:'POST', body: JSON.stringify(data) }),
    update: (id, d)  => apiFetch(`/api/positions/${id}`, { method:'PUT',   body: JSON.stringify(d) }),
    delete: (id)     => apiFetch(`/api/positions/${id}`, { method:'DELETE' }),
  },

  // Students
  Students: {
    all:         (filters = {}) => {
      const q = new URLSearchParams(filters).toString();
      return apiFetch(`/api/students${q ? '?'+q : ''}`);
    },
    get:         (id)      => apiFetch(`/api/students/${id}`),
    add:         (data)    => apiFetch('/api/students',        { method:'POST',  body: JSON.stringify(data) }),
    update:      (id, d)   => apiFetch(`/api/students/${id}`, { method:'PUT',   body: JSON.stringify(d) }),
    delete:      (id)      => apiFetch(`/api/students/${id}`, { method:'DELETE' }),
    markAbsent:  (id, val) => apiFetch(`/api/students/${id}/absent`, { method:'PATCH', body: JSON.stringify({ is_absent: val }) }),
    import:      (formData)=> apiUpload('/api/students/import', formData),
    globalStats: ()        => apiFetch('/api/students/stats/global'),
  },

  // Candidates
  Candidates: {
    byClass: (classId) => apiFetch(`/api/candidates?classId=${classId}`),
    add:     (data)    => apiFetch('/api/candidates',        { method:'POST',  body: JSON.stringify(data) }),
    delete:  (id)      => apiFetch(`/api/candidates/${id}`,  { method:'DELETE' }),
  },

  // Votes
  Votes: {
    cast:    (data)      => apiFetch('/api/votes',         { method:'POST',  body: JSON.stringify(data) }),
    results: (classId)   => apiFetch(`/api/votes/results${classId ? '?classId='+classId : ''}`),
    stats:   ()          => apiFetch('/api/votes/stats'),
    reset:   ()          => apiFetch('/api/votes/reset',   { method:'DELETE' }),
  },

  // Cabinet
  Cabinet: {
    getWinners: () => apiFetch('/api/cabinet/winners'),
    setup:      () => apiFetch('/api/cabinet/setup', { method: 'POST' }),
  },
};
