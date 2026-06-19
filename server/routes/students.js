// routes/students.js — Student management and Excel import with Unified DB
const router  = require('express').Router();
const db      = require('../db');
const multer  = require('multer');
const XLSX    = require('xlsx');
const { requireAdmin } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// GET /api/students
router.get('/', async (req, res) => {
  try {
    const { classId, gender, search } = req.query;
    const rows = await db.students.all({ classId, gender, search });
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/students/:id
router.get('/:id', async (req, res) => {
  try {
    const s = await db.students.get(req.params.id);
    if (!s) return res.status(404).json({ error: 'Not found' });
    res.json(s);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/students — add one student
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { name, roll_no, gender, class_id } = req.body;
    if (!name || !gender || !class_id) return res.status(400).json({ error: 'name, gender, class_id required' });
    if (!['Boy','Girl'].includes(gender)) return res.status(400).json({ error: 'gender must be Boy or Girl' });

    const s = await db.students.add({ name, roll_no, gender, class_id });
    res.status(201).json(s);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/students/:id
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { name, roll_no, gender, class_id } = req.body;
    const s = await db.students.update(req.params.id, { name, roll_no, gender, class_id });
    res.json(s);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/students/:id
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await db.students.delete(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/students/:id/absent
router.patch('/:id/absent', requireAdmin, async (req, res) => {
  try {
    const { is_absent } = req.body;
    await db.students.markAbsent(req.params.id, is_absent);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/students/import — Excel bulk import
router.post('/import', requireAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet    = workbook.Sheets[workbook.SheetNames[0]];
    const rows     = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    const results = await db.students.import(rows);
    res.json(results);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/students/stats/global — for dashboard
router.get('/stats/global', async (req, res) => {
  try {
    const stats = await db.students.globalStats();
    res.json(stats);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
