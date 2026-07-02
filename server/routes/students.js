// routes/students.js — Student management and Excel import with Unified DB
const router  = require('express').Router();
const db      = require('../db');
const multer  = require('multer');
const XLSX    = require('xlsx');
const fs      = require('fs');
const path    = require('path');
const { requireAdmin, requireUser } = require('../middleware/auth');

// Student photo upload setup
const studentPhotoDir = path.join(__dirname, '..', '..', 'public', 'uploads', 'students');
if (!fs.existsSync(studentPhotoDir)) fs.mkdirSync(studentPhotoDir, { recursive: true });

const photoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, studentPhotoDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${req.params.id}${ext}`);
  }
});
const photoUpload = multer({ storage: photoStorage });

const excelUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

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
router.post('/', requireUser, async (req, res) => {
  try {
    const { name, roll_no, gender, class_id } = req.body;
    if (!name || !gender || !class_id) return res.status(400).json({ error: 'name, gender, class_id required' });
    if (!['Boy','Girl'].includes(gender)) return res.status(400).json({ error: 'gender must be Boy or Girl' });

    // Restrict staff to assigned classes
    if (req.user && req.user.role === 'staff') {
      const assignedClasses = req.user.classes || [];
      if (!assignedClasses.includes(class_id)) {
        return res.status(403).json({ error: 'Forbidden: You cannot add a student to an unassigned class.' });
      }
    }

    const s = await db.students.add({ name, roll_no, gender, class_id });
    res.status(201).json(s);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/students/:id/photo — upload student photo
router.post('/:id/photo', requireAdmin, photoUpload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const ext = path.extname(req.file.originalname);
    const photoPath = `/uploads/students/${req.params.id}${ext}`;
    const isMySQL = !!process.env.DB_HOST;
    if (isMySQL) {
      const p = db.getPool();
      await p.query('UPDATE students SET photo = ? WHERE id = ?', [photoPath, req.params.id]);
    } else {
      const data = require('../db/jsonDb').readData();
      const idx = data.students.findIndex(s => s.id === req.params.id);
      if (idx !== -1) { data.students[idx].photo = photoPath; require('../db/jsonDb').writeData(data); }
    }
    res.json({ success: true, photo: photoPath });
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
router.patch('/:id/absent', requireUser, async (req, res) => {
  try {
    const { is_absent } = req.body;

    // Restrict staff to assigned classes
    if (req.user && req.user.role === 'staff') {
      const student = await db.students.get(req.params.id);
      if (!student) return res.status(404).json({ error: 'Student not found' });
      const assignedClasses = req.user.classes || [];
      if (!assignedClasses.includes(student.class_id)) {
        return res.status(403).json({ error: 'Forbidden: You cannot manage attendance for this student.' });
      }
    }

    await db.students.markAbsent(req.params.id, is_absent);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/students/import — Excel bulk import
router.post('/import', requireAdmin, excelUpload.single('file'), async (req, res) => {
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
