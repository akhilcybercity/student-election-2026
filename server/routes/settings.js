// routes/settings.js — Election settings with Unified DB
const router = require('express').Router();
const db     = require('../db');
const { requireAdmin, requireUser } = require('../middleware/auth');

// GET /api/settings/active-voter (polling endpoint for terminals)
router.get('/active-voter', async (req, res) => {
  try {
    const sessionId = req.query.sessionId || req.query.session_id || '1';
    const session = await db.sessions.get(sessionId);
    const val = session ? session.active_voter : '';
    const activeVoter = (val && val !== '""' && val !== '') ? JSON.parse(val) : null;
    res.json({
      activeVoter,
      reElectionClassId: session ? session.re_election_class_id : null,
      reElectionPositionId: session ? session.re_election_position_id : null
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/settings/sessions — returns all sessions (admin only or public)
router.get('/sessions', async (req, res) => {
  try {
    const sessions = await db.sessions.all();
    res.json(sessions);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/settings/sessions/:id — returns a single session (public for booth client)
router.get('/sessions/:id', async (req, res) => {
  try {
    const session = await db.sessions.get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/settings/sessions/:id — updates session re-election mapping (admin only)
router.put('/sessions/:id', requireAdmin, async (req, res) => {
  try {
    const { re_election_class_id, re_election_position_id } = req.body;
    await db.sessions.updateReElection(
      req.params.id,
      re_election_class_id,
      re_election_position_id
    );
    res.json({ success: true });
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
    let checkClassId = classId;
    
    // For cabinet elections, verify the student's actual class instead of the virtual 'class-cabinet'
    if (classId === 'class-cabinet') {
      try {
        const student = await db.students.get(studentId);
        if (student) {
          checkClassId = student.class_id;
        }
      } catch (e) {
        // Fall back to original classId if fetch fails
      }
    }

    if (!assignedClasses.includes(checkClassId)) {
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
