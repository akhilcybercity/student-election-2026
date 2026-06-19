// routes/auth.js — Authentication with Unified DB
const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const db      = require('../db');
const { signToken, requireAdmin } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Password required' });

    const hash = await db.settings.get('admin_password');
    if (!hash) return res.status(500).json({ error: 'Admin password not configured' });

    const valid = await bcrypt.compare(password, hash);
    if (!valid) return res.status(401).json({ error: 'Incorrect password' });

    const token = signToken();
    res.json({ token });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/auth/change-password  (admin protected)
router.post('/change-password', requireAdmin, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 4)
      return res.status(400).json({ error: 'Invalid input' });

    const hash = await db.settings.get('admin_password');
    const valid = await bcrypt.compare(currentPassword, hash);
    if (!valid) return res.status(401).json({ error: 'Current password incorrect' });

    const newHash = await bcrypt.hash(newPassword, 10);
    await db.settings.update({ admin_password: newHash });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
