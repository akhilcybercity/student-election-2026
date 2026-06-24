// routes/staff.js — Staff operations with Unified DB
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db     = require('../db');
const { requireAdmin } = require('../middleware/auth');

// GET /api/staff
router.get('/', requireAdmin, async (req, res) => {
  try {
    const rows = await db.staff.all();
    // Strip password_hash for security
    const safeRows = rows.map(r => {
      const { password_hash, ...rest } = r;
      return rest;
    });
    res.json(safeRows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/staff
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { username, password, session_id, classes } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    const existing = await db.staff.getByUsername(username);
    if (existing) return res.status(400).json({ error: 'Username already exists' });

    const hash = await bcrypt.hash(password, 10);
    const member = await db.staff.add({
      username,
      password_hash: hash,
      session_id: session_id || null,
      classes: classes || []
    });

    const { password_hash, ...safeMember } = member;
    res.status(201).json(safeMember);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/staff/:id
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { username, password, session_id, classes } = req.body;
    const updateObj = {};
    if (username !== undefined) updateObj.username = username;
    if (session_id !== undefined) updateObj.session_id = session_id || null;
    if (classes !== undefined) updateObj.classes = classes || [];
    
    if (password) {
      updateObj.password_hash = await bcrypt.hash(password, 10);
    }

    const member = await db.staff.update(req.params.id, updateObj);
    const { password_hash, ...safeMember } = member;
    res.json(safeMember);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/staff/:id
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await db.staff.delete(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
