const router = require('express').Router();
const db     = require('../db');
const { requireAdmin, requireUser } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

// Helper to initialize Cabinet class and positions dynamically
async function ensureCabinetInit() {
  const isMySQL = !!process.env.DB_HOST;
  
  // 1. Ensure Cabinet class exists
  if (isMySQL) {
    const p = db.getPool();
    await p.query(`
      INSERT IGNORE INTO classes (id, name, course, year, section)
      VALUES ('class-cabinet', 'Cabinet', 'Cabinet', 0, 'C')
    `);
  } else {
    // JSON DB
    const data = require('../db/jsonDb').readData ? require('../db/jsonDb').readData() : null;
    if (data) {
      const exists = data.classes.some(c => c.id === 'class-cabinet');
      if (!exists) {
        data.classes.push({
          id: 'class-cabinet',
          name: 'Cabinet',
          course: 'Cabinet',
          year: 0,
          section: 'C',
          created_at: new Date().toISOString()
        });
        require('../db/jsonDb').writeData(data);
      }
    }
  }

  // 2. Ensure the 6 Cabinet positions exist
  const cabinetPositions = [
    { id: 'pos-cabinet-chairperson', label: 'Chairperson', gender: 'Any', icon: '👑', sort_order: 10 },
    { id: 'pos-cabinet-vice-chairperson', label: 'Vice Chairperson', gender: 'Any', icon: '🥈', sort_order: 11 },
    { id: 'pos-cabinet-sports-sec', label: 'Sports Secretary', gender: 'Any', icon: '⚽', sort_order: 12 },
    { id: 'pos-cabinet-sports-jsec', label: 'Sports Joint Secretary', gender: 'Any', icon: '👟', sort_order: 13 },
    { id: 'pos-cabinet-cult-sec', label: 'Cultural Secretary', gender: 'Any', icon: '🎭', sort_order: 14 },
    { id: 'pos-cabinet-cult-jsec', label: 'Cultural Joint Secretary', gender: 'Any', icon: '🎷', sort_order: 15 }
  ];

  for (const pos of cabinetPositions) {
    if (isMySQL) {
      const p = db.getPool();
      await p.query(`
        INSERT IGNORE INTO positions (id, label, gender, icon, sort_order)
        VALUES (?, ?, ?, ?, ?)
      `, [pos.id, pos.label, pos.gender, pos.icon, pos.sort_order]);
    } else {
      const data = require('../db/jsonDb').readData();
      const exists = data.positions.some(p => p.id === pos.id);
      if (!exists) {
        data.positions.push({
          ...pos,
          created_at: new Date().toISOString()
        });
        require('../db/jsonDb').writeData(data);
      }
    }
  }
}

// GET /api/cabinet/winners - returns calculated class winners
router.get('/winners', requireUser, async (req, res) => {
  try {
    const winners = await db.cabinet.getWinners();
    res.json(winners);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/cabinet/setup - dynamically creates candidates based on winners
router.post('/setup', requireAdmin, async (req, res) => {
  try {
    await ensureCabinetInit();
    const winners = await db.cabinet.getWinners();
    const isMySQL = !!process.env.DB_HOST;
    
    // 1. Delete existing cabinet candidates
    if (isMySQL) {
      const p = db.getPool();
      await p.query("DELETE FROM candidates WHERE class_id = 'class-cabinet'");
    } else {
      const data = require('../db/jsonDb').readData();
      data.candidates = data.candidates.filter(c => c.class_id !== 'class-cabinet');
      require('../db/jsonDb').writeData(data);
    }

    // 2. Map winners to their respective cabinet positions and insert
    let insertedCount = 0;
    const errors = [];

    // Clear and sync voters
    await db.cabinet.clearVoters();

    for (const w of winners) {
      // Add voter
      await db.cabinet.addVoter(w.student_id);

      let cabinetPosId = null;
      
      const isClassRep = w.position_id === 'pos-cr-boy' || w.position_id === 'pos-cr-girl';
      const isSportsRep = w.position_id === 'pos-sports-boy' || w.position_id === 'pos-sports-girl';
      const isCultRep = w.position_id === 'pos-cultural-boy' || w.position_id === 'pos-cultural-girl';

      if (parseInt(w.year) === 2) {
        if (isClassRep) cabinetPosId = 'pos-cabinet-chairperson';
        if (isSportsRep) cabinetPosId = 'pos-cabinet-sports-sec';
        if (isCultRep) cabinetPosId = 'pos-cabinet-cult-sec';
      } else if (parseInt(w.year) === 1) {
        if (isClassRep) cabinetPosId = 'pos-cabinet-vice-chairperson';
        if (isSportsRep) cabinetPosId = 'pos-cabinet-sports-jsec';
        if (isCultRep) cabinetPosId = 'pos-cabinet-cult-jsec';
      }

      if (cabinetPosId) {
        try {
          if (isMySQL) {
            const p = db.getPool();
            // MySQL insert
            await p.query(`
              INSERT INTO candidates (id, student_id, class_id, position_id)
              VALUES (?, ?, 'class-cabinet', ?)
            `, [uuidv4(), w.student_id, cabinetPosId]);
          } else {
            // JSON DB insert
            const data = require('../db/jsonDb').readData();
            data.candidates.push({
              id: uuidv4(),
              student_id: w.student_id,
              class_id: 'class-cabinet',
              position_id: cabinetPosId,
              created_at: new Date().toISOString()
            });
            require('../db/jsonDb').writeData(data);
          }
          insertedCount++;
        } catch (err) {
          // Skip duplicates (if a student somehow won multiple standard posts)
          errors.push(err.message);
        }
      }
    }

    res.json({ success: true, candidatesRegistered: insertedCount, errors });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/cabinet/voters - get current eligible voters
router.get('/voters', requireUser, async (req, res) => {
  try {
    const list = await db.cabinet.getVoters();
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/cabinet/voters - manually add a voter
router.post('/voters', requireAdmin, async (req, res) => {
  try {
    const { student_id } = req.body;
    if (!student_id) return res.status(400).json({ error: 'student_id is required' });
    await db.cabinet.addVoter(student_id);
    res.status(201).json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/cabinet/voters/:studentId - manually remove a voter
router.delete('/voters/:studentId', requireAdmin, async (req, res) => {
  try {
    await db.cabinet.deleteVoter(req.params.studentId);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/cabinet/voters/all - manually add all active students as voters
router.post('/voters/all', requireAdmin, async (req, res) => {
  try {
    const isMySQL = !!process.env.DB_HOST;
    if (isMySQL) {
      const p = db.getPool();
      await p.query("INSERT IGNORE INTO cabinet_voters (student_id) SELECT id FROM students WHERE is_absent = 0 AND id != 'admin'");
    } else {
      const data = require('../db/jsonDb').readData();
      data.cabinet_voters = data.cabinet_voters || [];
      const activeStudentIds = data.students.filter(s => !s.is_absent && s.id !== 'admin').map(s => s.id);
      activeStudentIds.forEach(id => {
        if (!data.cabinet_voters.includes(id)) {
          data.cabinet_voters.push(id);
        }
      });
      require('../db/jsonDb').writeData(data);
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/cabinet/voters/:studentId/vote — reset ONE voter's cabinet votes (allow re-vote)
router.delete('/voters/:studentId/vote', requireAdmin, async (req, res) => {
  try {
    const { studentId } = req.params;
    const isMySQL = !!process.env.DB_HOST;
    if (isMySQL) {
      const p = db.getPool();
      await p.query("DELETE FROM votes WHERE voter_id = ? AND class_id = 'class-cabinet'", [studentId]);
    } else {
      const data = require('../db/jsonDb').readData();
      data.votes = data.votes.filter(v => !(v.voter_id === studentId && v.class_id === 'class-cabinet'));
      require('../db/jsonDb').writeData(data);
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
