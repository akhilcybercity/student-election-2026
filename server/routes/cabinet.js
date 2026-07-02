const router = require('express').Router();
const db     = require('../db');
const { requireAdmin } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

// Helper to initialize Cabinet class and positions dynamically
async function ensureCabinetInit() {
  const isMySQL = !!process.env.DB_HOST;
  
  // 1. Ensure Cabinet class exists
  if (isMySQL) {
    const p = db.positions.getPool ? db.positions.getPool() : null; // MySQL pool
    if (p) {
      await p.query(`
        INSERT IGNORE INTO classes (id, name, course, year, section)
        VALUES ('class-cabinet', 'Cabinet', 'Cabinet', 0, 'C')
      `);
    }
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
      const p = db.positions.getPool();
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
router.get('/winners', requireAdmin, async (req, res) => {
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
      const p = db.positions.getPool();
      await p.query("DELETE FROM candidates WHERE class_id = 'class-cabinet'");
    } else {
      const data = require('../db/jsonDb').readData();
      data.candidates = data.candidates.filter(c => c.class_id !== 'class-cabinet');
      require('../db/jsonDb').writeData(data);
    }

    // 2. Map winners to their respective cabinet positions and insert
    let insertedCount = 0;
    const errors = [];

    for (const w of winners) {
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
            const p = db.positions.getPool();
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

module.exports = router;
