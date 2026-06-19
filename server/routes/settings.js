// routes/settings.js — Election settings with Unified DB
const router = require('express').Router();
const db     = require('../db');
const { requireAdmin } = require('../middleware/auth');

// GET /api/settings/active-voter
router.get('/active-voter', async (req, res) => {
  try {
    const val = await db.settings.get('active_voter');
    const activeVoter = (val && val !== '""' && val !== '') ? JSON.parse(val) : null;
    res.json({ activeVoter });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/settings/active-voter (require admin to activate terminal)
router.post('/active-voter', requireAdmin, async (req, res) => {
  const { studentId, classId, name } = req.body;
  if (!studentId || !classId || !name) {
    return res.status(400).json({ error: 'Missing studentId, classId, or name' });
  }
  const activeVoter = { studentId, classId, name };
  try {
    await db.settings.update({ active_voter: JSON.stringify(activeVoter) });
    res.json({ success: true, activeVoter });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/settings/active-voter (clears the active voter queue)
router.delete('/active-voter', async (req, res) => {
  try {
    await db.settings.update({ active_voter: '' });
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
