// routes/positions.js — Positions management with Unified DB
const router = require('express').Router();
const db     = require('../db');
const { requireAdmin } = require('../middleware/auth');

// GET /api/positions
router.get('/', async (req, res) => {
  try {
    const rows = await db.positions.all();
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/positions
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { label, gender, icon, sort_order } = req.body;
    if (!label) return res.status(400).json({ error: 'label is required' });
    if (!['Boy','Girl','Any'].includes(gender))
      return res.status(400).json({ error: 'gender must be Boy, Girl, or Any' });

    const pos = await db.positions.add({ label, gender, icon, sort_order });
    res.status(201).json(pos);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/positions/:id
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { label, gender, icon, sort_order } = req.body;
    const pos = await db.positions.update(req.params.id, { label, gender, icon, sort_order });
    res.json(pos);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/positions/:id
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await db.positions.delete(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
