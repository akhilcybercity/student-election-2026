// routes/auth.js — Authentication with Unified DB
const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const db      = require('../db');
const { signToken, requireAdmin } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!password) return res.status(400).json({ error: 'Password required' });

    // 1. Admin login fallback (username is admin or omitted)
    if (!username || username.toLowerCase() === 'admin') {
      const hash = await db.settings.get('admin_password');
      if (!hash) return res.status(500).json({ error: 'Admin password not configured' });

      const valid = await bcrypt.compare(password, hash);
      if (!valid) return res.status(401).json({ error: 'Incorrect password' });

      const token = signToken({ role: 'admin', username: 'admin' });
      return res.json({ token, role: 'admin', username: 'admin' });
    }

    // 2. Staff login
    const staff = await db.staff.getByUsername(username);
    if (!staff) {
      return res.status(401).json({ error: 'Incorrect username or password' });
    }

    const valid = await bcrypt.compare(password, staff.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Incorrect username or password' });
    }

    const token = signToken({
      role: 'staff',
      id: staff.id,
      username: staff.username,
      session_id: staff.session_id,
      classes: staff.classes || []
    });

    res.json({
      token,
      role: 'staff',
      username: staff.username,
      sessionId: staff.session_id,
      classes: staff.classes || []
    });
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
