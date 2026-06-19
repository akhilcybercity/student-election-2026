// routes/classes.js — Class operations with Unified DB
const router = require('express').Router();
const db     = require('../db');
const { requireAdmin } = require('../middleware/auth');

// GET /api/classes
router.get('/', async (req, res) => {
  try {
    const rows = await db.classes.all();
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/classes
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { name, course, year, section } = req.body;
    if (!name || !course || !section) return res.status(400).json({ error: 'name, course, section required' });
    const cls = await db.classes.add({ name, course, year, section });
    res.status(201).json(cls);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/classes/:id
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { name, course, year, section } = req.body;
    const cls = await db.classes.update(req.params.id, { name, course, year, section });
    res.json(cls);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/classes/:id
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await db.classes.delete(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/classes/:id/stats
router.get('/:id/stats', async (req, res) => {
  try {
    const stats = await db.classes.stats(req.params.id);
    res.json(stats);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
