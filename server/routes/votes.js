// routes/votes.js — Voting actions with Unified DB
const router = require('express').Router();
const db     = require('../db');
const { requireAdmin } = require('../middleware/auth');

// POST /api/votes — cast a ballot
router.post('/', async (req, res) => {
  try {
    const { voter_id, selections, class_id } = req.body;
    if (!voter_id || !selections || !class_id) {
      return res.status(400).json({ error: 'voter_id, selections, class_id required' });
    }

    // Verify settings state
    const open = await db.settings.get('election_open');
    if (open !== 'true') {
      return res.status(400).json({ error: 'Voting is currently closed' });
    }

    await db.votes.cast({ voter_id, selections, class_id });
    res.json({ success: true });
  } catch (e) {
    if (e.code === 'already_voted' || e.code === 'is_absent') {
      return res.status(400).json({ error: e.message, code: e.code });
    }
    res.status(500).json({ error: e.message });
  }
});

// GET /api/votes/results — election results
router.get('/results', async (req, res) => {
  try {
    const { classId } = req.query;
    const results = await db.votes.results(classId);
    res.json(results);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/votes/stats — global stats
router.get('/stats', async (req, res) => {
  try {
    const stats = await db.votes.stats();
    res.json(stats);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/votes/reset — reset all vote counts (admin only)
router.delete('/reset', requireAdmin, async (req, res) => {
  try {
    await db.votes.reset();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
