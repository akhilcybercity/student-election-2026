// routes/candidates.js — Candidate assignment with Unified DB
const router = require('express').Router();
const db     = require('../db');
const { requireAdmin } = require('../middleware/auth');
const multer = require('multer');
const fs     = require('fs');
const path   = require('path');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '..', '..', 'public', 'uploads', 'candidates');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${req.params.id}${ext}`);
  }
});

const upload = multer({ storage });

// GET /api/candidates?classId=
router.get('/', async (req, res) => {
  try {
    const { classId } = req.query;
    if (!classId) return res.status(400).json({ error: 'classId is required' });
    const rows = await db.candidates.byClass(classId);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/candidates — assign candidate to position
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { student_id, class_id, position_id } = req.body;
    if (!student_id || !class_id || !position_id)
      return res.status(400).json({ error: 'student_id, class_id, position_id required' });

    const c = await db.candidates.add({ student_id, class_id, position_id });
    res.status(201).json(c);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// POST /api/candidates/:id/photo — upload candidate photo
router.post('/:id/photo', requireAdmin, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const isMySQL = !!process.env.DB_HOST;
    let studentId = null;

    if (isMySQL) {
      const p = db.getPool();
      const [[cand]] = await p.query('SELECT student_id FROM candidates WHERE id = ?', [req.params.id]);
      if (cand) studentId = cand.student_id;
    } else {
      const data = require('../db/jsonDb').readData();
      const cand = data.candidates.find(c => c.id === req.params.id);
      if (cand) studentId = cand.student_id;
    }

    if (!studentId) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    const ext = path.extname(req.file.originalname);
    const photoPath = `/uploads/students/${studentId}${ext}`;

    const studentUploadDir = path.join(__dirname, '..', '..', 'public', 'uploads', 'students');
    if (!fs.existsSync(studentUploadDir)) {
      fs.mkdirSync(studentUploadDir, { recursive: true });
    }

    const destPath = path.join(studentUploadDir, `${studentId}${ext}`);
    fs.renameSync(req.file.path, destPath);

    // Update photo on student record
    if (isMySQL) {
      const p = db.getPool();
      await p.query('UPDATE students SET photo = ? WHERE id = ?', [photoPath, studentId]);
    } else {
      const data = require('../db/jsonDb').readData();
      const idx = data.students.findIndex(s => s.id === studentId);
      if (idx !== -1) {
        data.students[idx].photo = photoPath;
        require('../db/jsonDb').writeData(data);
      }
    }

    res.json({ success: true, photo: photoPath });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/candidates/:id
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await db.candidates.delete(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
