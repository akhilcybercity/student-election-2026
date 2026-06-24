// routes/settings.js — Election settings with Unified DB
const router = require('express').Router();
const db     = require('../db');
const { requireAdmin, requireUser } = require('../middleware/auth');

// GET /api/settings/active-voter (polling endpoint for terminals)
router.get('/active-voter', async (req, res) => {
  try {
    const sessionId = req.query.sessionId || req.query.session_id || '1';
    const val = await db.sessions.get(sessionId);
    const activeVoter = (val && val !== '""' && val !== '') ? JSON.parse(val) : null;
    res.json({ activeVoter });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/settings/active-voter (require user admin/staff to activate terminal)
router.post('/active-voter', requireUser, async (req, res) => {
  const { studentId, classId, name } = req.body;
  const sessionId = req.body.sessionId || req.body.session_id || (req.user && req.user.session_id) || '1';
  
  if (!studentId || !classId || !name) {
    return res.status(400).json({ error: 'Missing studentId, classId, or name' });
  }
  
  // If the logged-in user is a Staff member, verify they manage this student's class
  if (req.user && req.user.role === 'staff') {
    const assignedClasses = req.user.classes || [];
    if (!assignedClasses.includes(classId)) {
      return res.status(403).json({ error: 'Forbidden: You are not assigned to manage this student\'s class.' });
    }
  }

  const activeVoter = { studentId, classId, name };
  try {
    await db.sessions.updateActiveVoter(sessionId, JSON.stringify(activeVoter));
    res.json({ success: true, activeVoter });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/settings/active-voter (clears the active voter queue for a session)
router.delete('/active-voter', async (req, res) => {
  try {
    const sessionId = req.query.sessionId || req.query.session_id || '1';
    await db.sessions.updateActiveVoter(sessionId, '');
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// GET /api/settings — public (needed by vote page)
router.get('/', async (req, res) => {
  try {
    const settings = await db.settings.getAll();
    res.json(settings);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/settings
router.put('/', requireAdmin, async (req, res) => {
  try {
    const { election_name, college_name, election_open } = req.body;
    const updates = {};
    if (election_name !== undefined) updates.election_name = election_name;
    if (college_name !== undefined)  updates.college_name = college_name;
    if (election_open !== undefined) updates.election_open = String(election_open);

    await db.settings.update(updates);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
