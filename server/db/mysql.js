// mysql.js — MySQL Connection and Provider
const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');

let pool = null;

function getPool() {
  if (!pool) {
    const dbConfig = {
      host:     process.env.DB_HOST     || 'localhost',
      port:     parseInt(process.env.DB_PORT || '3306'),
      user:     process.env.DB_USER     || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME     || 'election_db',
      waitForConnections: true,
      connectionLimit:    10,
      queueLimit:         0,
      timezone: '+00:00',
    };

    // Enable SSL if explicitly requested or if using port 4000 (TiDB Cloud)
    if (process.env.DB_SSL === 'true' || process.env.DB_PORT === '4000') {
      dbConfig.ssl = {
        rejectUnauthorized: false // allows working across all cloud MySQL providers
      };
    }

    pool = mysql.createPool(dbConfig);

    // Dyn alter table sessions to add re_election fields if they don't exist
    pool.query('ALTER TABLE sessions ADD COLUMN re_election_class_id VARCHAR(36) DEFAULT NULL').catch(()=>{});
    pool.query('ALTER TABLE sessions ADD COLUMN re_election_position_id VARCHAR(36) DEFAULT NULL').catch(()=>{});
    // Add photo column to candidates and students (VARCHAR first, upgrade to MEDIUMTEXT for base64 storage)
    pool.query('ALTER TABLE candidates ADD COLUMN photo VARCHAR(255) DEFAULT NULL').catch(()=>{});
    pool.query('ALTER TABLE students    ADD COLUMN photo VARCHAR(255) DEFAULT NULL').catch(()=>{});
    // Upgrade photo columns to MEDIUMTEXT so base64 data URLs (100k+ chars) fit without truncation
    pool.query('ALTER TABLE students    MODIFY COLUMN photo MEDIUMTEXT').catch(()=>{});
    pool.query('ALTER TABLE candidates  MODIFY COLUMN photo MEDIUMTEXT').catch(()=>{});
    // Add cabinet_voters table
    pool.query(`
      CREATE TABLE IF NOT EXISTS cabinet_voters (
        student_id VARCHAR(36) PRIMARY KEY,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
      )
    `).catch(()=>{});
  }
  return pool;
}


const mysqlDb = {
  getPool: getPool,
  settings: {
    get: async (key) => {
      const p = getPool();
      const [[row]] = await p.query("SELECT `value` FROM settings WHERE `key` = ?", [key]);
      return row ? row.value : null;
    },
    getAll: async () => {
      const p = getPool();
      const [rows] = await p.query("SELECT `key`, `value` FROM settings WHERE `key` != 'admin_password'");
      const res = {};
      rows.forEach(s => {
        res[s.key] = s.value === 'true' ? true : s.value === 'false' ? false : s.value;
      });
      return res;
    },
    update: async (settingsObj) => {
      const p = getPool();
      for (const [key, val] of Object.entries(settingsObj)) {
        const strVal = String(val);
        await p.query(
          "INSERT INTO settings (`key`, `value`) VALUES (?,?) ON DUPLICATE KEY UPDATE `value`=?",
          [key, strVal, strVal]
        );
      }
      return true;
    }
  },

  classes: {
    all: async () => {
      const p = getPool();
      const [rows] = await p.query("SELECT * FROM classes ORDER BY year, name");
      return rows;
    },
    get: async (id) => {
      const p = getPool();
      const [[row]] = await p.query("SELECT * FROM classes WHERE id=?", [id]);
      return row || null;
    },
    add: async (cls) => {
      const p = getPool();
      const newClass = {
        id: uuidv4(),
        name: cls.name.trim(),
        course: cls.course.trim(),
        year: parseInt(cls.year) || 1,
        section: cls.section.trim(),
      };
      await p.query(
        "INSERT INTO classes (id,name,course,year,section) VALUES (?,?,?,?,?)",
        [newClass.id, newClass.name, newClass.course, newClass.year, newClass.section]
      );
      return newClass;
    },
    update: async (id, cls) => {
      const p = getPool();
      await p.query(
        "UPDATE classes SET name=?,course=?,year=?,section=? WHERE id=?",
        [cls.name.trim(), cls.course.trim(), parseInt(cls.year) || 1, cls.section.trim(), id]
      );
      return { id, ...cls };
    },
    delete: async (id) => {
      const p = getPool();
      await p.query("DELETE FROM votes WHERE class_id=?", [id]);
      await p.query("DELETE FROM candidates WHERE class_id=?", [id]);
      await p.query("DELETE FROM students WHERE class_id=?", [id]);
      await p.query("DELETE FROM classes WHERE id=?", [id]);
      return true;
    },
    stats: async (id) => {
      const p = getPool();
      const [[{ total }]]  = await p.query("SELECT COUNT(*) AS total  FROM students WHERE class_id=? AND is_absent=0", [id]);
      const [[{ voted }]]  = await p.query("SELECT COUNT(*) AS voted  FROM students WHERE class_id=? AND has_voted=1", [id]);
      const [[{ absent }]] = await p.query("SELECT COUNT(*) AS absent FROM students WHERE class_id=? AND is_absent=1", [id]);
      return { total, voted, absent, pending: total - voted };
    }
  },

  positions: {
    all: async () => {
      const p = getPool();
      const [rows] = await p.query("SELECT * FROM positions ORDER BY sort_order, created_at");
      return rows;
    },
    get: async (id) => {
      const p = getPool();
      const [[row]] = await p.query("SELECT * FROM positions WHERE id=?", [id]);
      return row || null;
    },
    add: async (pos) => {
      const p = getPool();
      const newPos = {
        id: uuidv4(),
        label: pos.label.trim(),
        gender: pos.gender || 'Any',
        icon: pos.icon || '🏅',
        sort_order: parseInt(pos.sort_order) || 0,
      };
      await p.query(
        "INSERT INTO positions (id,label,gender,icon,sort_order) VALUES (?,?,?,?,?)",
        [newPos.id, newPos.label, newPos.gender, newPos.icon, newPos.sort_order]
      );
      return newPos;
    },
    update: async (id, pos) => {
      const p = getPool();
      await p.query(
        "UPDATE positions SET label=?,gender=?,icon=?,sort_order=? WHERE id=?",
        [pos.label.trim(), pos.gender || 'Any', pos.icon || '🏅', parseInt(pos.sort_order) || 0, id]
      );
      return { id, ...pos };
    },
    delete: async (id) => {
      const p = getPool();
      await p.query("DELETE FROM candidates WHERE position_id=?", [id]);
      await p.query("DELETE FROM positions WHERE id=?", [id]);
      return true;
    }
  },

  students: {
    all: async (filters = {}) => {
      const p = getPool();
      let sql = `
        SELECT s.*, c.name AS class_name
        FROM students s
        LEFT JOIN classes c ON s.class_id = c.id
        WHERE 1=1`;
      const params = [];
      if (filters.classId) {
        sql += ' AND s.class_id = ?';
        params.push(filters.classId);
      }
      if (filters.gender) {
        sql += ' AND s.gender = ?';
        params.push(filters.gender);
      }
      if (filters.search) {
        sql += ' AND (s.name LIKE ? OR s.roll_no LIKE ?)';
        params.push(`%${filters.search}%`, `%${filters.search}%`);
      }
      sql += ' ORDER BY s.name';
      const [rows] = await p.query(sql, params);
      return rows;
    },
    get: async (id) => {
      const p = getPool();
      const [[row]] = await p.query("SELECT * FROM students WHERE id=?", [id]);
      return row || null;
    },
    add: async (stud) => {
      const p = getPool();
      const newStudent = {
        id: uuidv4(),
        name: stud.name.trim(),
        roll_no: (stud.roll_no || '').trim(),
        gender: stud.gender,
        class_id: stud.class_id,
      };
      await p.query(
        "INSERT INTO students (id,name,roll_no,gender,class_id) VALUES (?,?,?,?,?)",
        [newStudent.id, newStudent.name, newStudent.roll_no, newStudent.gender, newStudent.class_id]
      );
      return { ...newStudent, has_voted: false, is_absent: false, voted_at: null };
    },
    update: async (id, stud) => {
      const p = getPool();
      await p.query(
        "UPDATE students SET name=?,roll_no=?,gender=?,class_id=? WHERE id=?",
        [stud.name.trim(), (stud.roll_no || '').trim(), stud.gender, stud.class_id, id]
      );
      return { id, ...stud };
    },
    delete: async (id) => {
      const p = getPool();
      await p.query("DELETE FROM votes WHERE voter_id=?", [id]);
      await p.query("DELETE FROM candidates WHERE student_id=?", [id]);
      await p.query("DELETE FROM students WHERE id=?", [id]);
      return true;
    },
    markAbsent: async (id, isAbsent) => {
      const p = getPool();
      const [[s]] = await p.query("SELECT has_voted FROM students WHERE id=?", [id]);
      if (s && s.has_voted && isAbsent) {
        throw new Error('Cannot mark a voted student as absent');
      }
      await p.query("UPDATE students SET is_absent=? WHERE id=?", [isAbsent ? 1 : 0, id]);
      return true;
    },
    import: async (studentsList) => {
      const p = getPool();
      const [classes] = await p.query("SELECT id, name FROM classes");
      const classMap = {};
      classes.forEach(c => {
        classMap[c.name.trim().toLowerCase()] = c.id;
      });

      const results = { imported: 0, skipped: 0, errors: [] };
      const [allStudents] = await p.query("SELECT roll_no FROM students WHERE roll_no != ''");
      const existingRolls = new Set(allStudents.map(s => s.roll_no.toLowerCase()));

      const batch = [];
      for (let i = 0; i < studentsList.length; i++) {
        const row = studentsList[i];
        const rowNum = i + 2;
        const name = (row.name || row.Name || '').trim();
        const rollNo = (row.roll_no || row.RollNo || row.rollNo || row['Roll No'] || '').toString().trim();
        const genderRaw = (row.gender || row.Gender || '').trim();
        const className = (row.class_name || row.className || row['Class Name'] || '').trim();

        let gender = '';
        if (['boy', 'male', 'm', 'b'].includes(genderRaw.toLowerCase())) gender = 'Boy';
        else if (['girl', 'female', 'f', 'g'].includes(genderRaw.toLowerCase())) gender = 'Girl';

        if (!name) {
          results.errors.push({ row: rowNum, error: 'Missing Name' });
          results.skipped++;
          continue;
        }
        if (!gender) {
          results.errors.push({ row: rowNum, name, error: `Invalid gender "${genderRaw}"` });
          results.skipped++;
          continue;
        }
        if (!className) {
          results.errors.push({ row: rowNum, name, error: 'Missing Class Name' });
          results.skipped++;
          continue;
        }

        const classId = classMap[className.toLowerCase()];
        if (!classId) {
          results.errors.push({ row: rowNum, name, error: `Class "${className}" not found` });
          results.skipped++;
          continue;
        }

        if (rollNo && existingRolls.has(rollNo.toLowerCase())) {
          results.errors.push({ row: rowNum, name, error: `Roll No "${rollNo}" already exists` });
          results.skipped++;
          continue;
        }

        batch.push([uuidv4(), name, rollNo, gender, classId]);
        if (rollNo) existingRolls.add(rollNo.toLowerCase());
        results.imported++;
      }

      if (batch.length > 0) {
        await p.query(
          "INSERT IGNORE INTO students (id,name,roll_no,gender,class_id) VALUES ?",
          [batch]
        );
      }

      return results;
    },
    globalStats: async () => {
      const p = getPool();
      const [[r]] = await p.query(`
        SELECT
          COUNT(*) AS total_students,
          SUM(has_voted)  AS total_voted,
          SUM(is_absent)  AS total_absent,
          SUM(CASE WHEN has_voted=0 AND is_absent=0 THEN 1 ELSE 0 END) AS total_pending
        FROM students`);
      const [[{ total_classes }]] = await p.query('SELECT COUNT(*) AS total_classes FROM classes');
      const [[{ total_votes   }]] = await p.query('SELECT COUNT(*) AS total_votes   FROM votes');
      return { ...r, total_classes, total_votes };
    }
  },

  candidates: {
    byClass: async (classId) => {
      const p = getPool();
      const [rows] = await p.query(`
        SELECT c.id, c.student_id, c.class_id, c.position_id, s.photo,
               s.name AS student_name, s.gender AS student_gender, s.roll_no,
               p.label AS position_label, p.gender AS position_gender, p.icon
        FROM candidates c
        JOIN students  s ON c.student_id  = s.id
        JOIN positions p ON c.position_id = p.id
        WHERE c.class_id = ?
        ORDER BY p.sort_order, s.name`, [classId]);
      return rows;
    },
    add: async (cand) => {
      const p = getPool();
      const [[student]]  = await p.query('SELECT * FROM students  WHERE id=?', [cand.student_id]);
      const [[position]] = await p.query('SELECT * FROM positions WHERE id=?', [cand.position_id]);
      if (!student)  throw new Error('Student not found');
      if (!position) throw new Error('Position not found');

      if (position.gender !== 'Any' && student.gender !== position.gender) {
        throw new Error(`This position is for ${position.gender} students only. "${student.name}" is ${student.gender}.`);
      }

      const id = uuidv4();
      await p.query(
        'INSERT INTO candidates (id,student_id,class_id,position_id) VALUES (?,?,?,?)',
        [id, cand.student_id, cand.class_id, cand.position_id]
      );

      return {
        id,
        student_id: cand.student_id,
        class_id: cand.class_id,
        position_id: cand.position_id,
        student_name: student.name,
        student_gender: student.gender,
        position_label: position.label,
        position_gender: position.gender,
        icon: position.icon
      };
    },
    delete: async (id) => {
      const p = getPool();
      const [[{ count }]] = await p.query('SELECT COUNT(*) AS count FROM votes WHERE candidate_id=?', [id]);
      if (count > 0) throw new Error('Cannot remove candidate with existing votes');
      await p.query('DELETE FROM candidates WHERE id=?', [id]);
      return true;
    },
    updatePhoto: async (id, photoPath) => {
      const p = getPool();
      await p.query('UPDATE candidates SET photo = ? WHERE id = ?', [photoPath, id]);
      return true;
    }
  },

  votes: {
    cast: async (vote) => {
      const p = getPool();
      const [[voter]] = await p.query('SELECT * FROM students WHERE id=?', [vote.voter_id]);
      if (!voter) throw new Error('Voter not found');

      if (vote.class_id === 'class-cabinet') {
        const [[{ cabinetVoted }]] = await p.query(
          "SELECT COUNT(*) AS cabinetVoted FROM votes WHERE voter_id=? AND class_id='class-cabinet'",
          [vote.voter_id]
        );
        if (cabinetVoted > 0) {
          const err = new Error('You have already voted in the Cabinet Election');
          err.code = 'already_voted';
          throw err;
        }
      } else {
        if (voter.has_voted) {
          const err = new Error('You have already voted');
          err.code = 'already_voted';
          throw err;
        }
      }

      if (voter.is_absent && vote.class_id !== 'class-cabinet') {
        const err = new Error('You are marked as absent');
        err.code = 'is_absent';
        throw err;
      }

      const conn = await p.getConnection();
      try {
        await conn.beginTransaction();

        for (const sel of vote.selections) {
          // Skip positions the student already voted for (re-election safe guard)
          const [[{ existing }]] = await conn.query(
            'SELECT COUNT(*) AS existing FROM votes WHERE voter_id=? AND position_id=?',
            [vote.voter_id, sel.position_id]
          );
          if (existing > 0) continue; // already voted for this position — skip silently

          await conn.query(
            'INSERT INTO votes (id,voter_id,candidate_id,position_id,class_id) VALUES (?,?,?,?,?)',
            [uuidv4(), vote.voter_id, sel.candidate_id, sel.position_id, vote.class_id]
          );
        }

        if (vote.class_id !== 'class-cabinet') {
          await conn.query(
            'UPDATE students SET has_voted=1, voted_at=NOW() WHERE id=?',
            [vote.voter_id]
          );
        }

        await conn.commit();
        return true;
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    },
    results: async (classId) => {
      const p = getPool();
      let sql = 'SELECT * FROM classes';
      const params = [];
      if (classId) {
        sql += ' WHERE id=?';
        params.push(classId);
      }
      sql += ' ORDER BY year, name';
      const [classes] = await p.query(sql, params);
      const results = [];

      for (const cls of classes) {
        let stats;
        if (cls.id === 'class-cabinet') {
          const winners = await mysqlDb.cabinet.getWinners();
          const totalVoters = winners.length;
          const [[{ voted }]] = await p.query(
            "SELECT COUNT(DISTINCT voter_id) AS voted FROM votes WHERE class_id='class-cabinet'"
          );
          stats = {
            total: totalVoters,
            voted: voted || 0,
            absent: 0,
            pending: Math.max(0, totalVoters - (voted || 0))
          };
        } else {
          const [[row]] = await p.query(`
            SELECT
              COUNT(CASE WHEN is_absent=0 THEN 1 END) AS total,
              SUM(has_voted) AS voted,
              SUM(is_absent) AS absent,
              COUNT(CASE WHEN has_voted=0 AND is_absent=0 THEN 1 END) AS pending
            FROM students WHERE class_id=?`, [cls.id]);
          stats = row ? {
            total: row.total || 0,
            voted: row.voted || 0,
            absent: row.absent || 0,
            pending: row.pending || 0
          } : { total: 0, voted: 0, absent: 0, pending: 0 };
        }

        // Only query cabinet positions for class-cabinet, and only standard positions for standard classes
        let positionsQuery = 'SELECT * FROM positions';
        if (cls.id === 'class-cabinet') {
          positionsQuery += " WHERE id LIKE 'pos-cabinet-%'";
        } else {
          positionsQuery += " WHERE id NOT LIKE 'pos-cabinet-%'";
        }
        positionsQuery += ' ORDER BY sort_order';
        const [positions] = await p.query(positionsQuery);
        
        const posList = [];
        for (const pos of positions) {
          const [cands] = await p.query(`
            SELECT c.id, s.name, COUNT(v.id) AS votes
            FROM candidates c
            JOIN students s ON c.student_id = s.id
            LEFT JOIN votes v ON v.candidate_id = c.id
            WHERE c.class_id=? AND c.position_id=?
            GROUP BY c.id, s.name
            ORDER BY votes DESC`, [cls.id, pos.id]);

          posList.push({
            id: pos.id,
            label: pos.label,
            gender: pos.gender,
            icon: pos.icon,
            candidates: cands
          });
        }

        results.push({
          class: cls,
          stats: stats,
          positions: posList
        });
      }

      return results;
    },
    stats: async () => {
      const p = getPool();
      const [[r]] = await p.query(`
        SELECT
          COUNT(*) AS total_students,
          SUM(has_voted)  AS total_voted,
          SUM(is_absent)  AS total_absent,
          SUM(CASE WHEN has_voted=0 AND is_absent=0 THEN 1 ELSE 0 END) AS total_pending
        FROM students`);
      const [[{ total_classes }]] = await p.query('SELECT COUNT(*) AS total_classes FROM classes');
      const [[{ total_votes   }]] = await p.query('SELECT COUNT(*) AS total_votes   FROM votes');
      return { ...r, total_classes, total_votes };
    },
    // Unlock students in a class so they can re-vote (after selective reset)
    // Sets has_voted=FALSE for all voted students in the class
    // Safe because cast() now skips duplicate votes per position
    unlockClassForReElection: async ({ classId }) => {
      const p = getPool();
      const [result] = await p.query(
        'UPDATE students SET has_voted=0, voted_at=NULL WHERE class_id=?',
        [classId]
      );
      return { studentsUnlocked: result.affectedRows };
    },

    reset: async () => {
      const p = getPool();
      await p.query('DELETE FROM votes');
      await p.query('UPDATE students SET has_voted=0, voted_at=NULL');
      return true;
    },

    // Preview how many votes/students a selective reset would affect (read-only)
    previewReset: async ({ classId, positionId }) => {
      const p = getPool();

      // Count votes to be deleted
      const [[{ voteCount }]] = await p.query(
        'SELECT COUNT(*) AS voteCount FROM votes WHERE class_id=? AND position_id=?',
        [classId, positionId]
      );

      // Count unique voters who cast that position vote in that class
      const [[{ voterCount }]] = await p.query(
        'SELECT COUNT(DISTINCT voter_id) AS voterCount FROM votes WHERE class_id=? AND position_id=?',
        [classId, positionId]
      );

      // Of those voters, how many will become fully unlocked (no remaining votes)?
      const [voterRows] = await p.query(
        'SELECT DISTINCT voter_id FROM votes WHERE class_id=? AND position_id=?',
        [classId, positionId]
      );
      let studentsToUnlock = 0;
      for (const { voter_id } of voterRows) {
        const [[{ remaining }]] = await p.query(
          'SELECT COUNT(*) AS remaining FROM votes WHERE voter_id=? AND NOT (class_id=? AND position_id=?)',
          [voter_id, classId, positionId]
        );
        if (remaining === 0) studentsToUnlock++;
      }

      // Class and position names for display
      const [[cls]]  = await p.query('SELECT name FROM classes WHERE id=?', [classId]);
      const [[pos]]  = await p.query('SELECT label, gender FROM positions WHERE id=?', [positionId]);

      return {
        voteCount,
        voterCount,
        studentsToUnlock,
        className:     cls  ? cls.name  : classId,
        positionLabel: pos  ? pos.label : positionId,
        positionGender: pos ? pos.gender : 'Any'
      };
    },

    // Selective reset: delete votes for one class+position, unlock only affected students
    selectiveReset: async ({ classId, positionId }) => {
      const p = getPool();

      // Find affected voters BEFORE deleting
      const [voterRows] = await p.query(
        'SELECT DISTINCT voter_id FROM votes WHERE class_id=? AND position_id=?',
        [classId, positionId]
      );

      if (voterRows.length === 0) {
        return { deletedVotes: 0, studentsReset: 0 };
      }

      // Delete ONLY those specific votes
      const [delResult] = await p.query(
        'DELETE FROM votes WHERE class_id=? AND position_id=?',
        [classId, positionId]
      );
      const deletedVotes = delResult.affectedRows;

      // Unlock students who now have zero remaining votes
      let studentsReset = 0;
      for (const { voter_id } of voterRows) {
        const [[{ remaining }]] = await p.query(
          'SELECT COUNT(*) AS remaining FROM votes WHERE voter_id=?',
          [voter_id]
        );
        if (remaining === 0) {
          await p.query(
            'UPDATE students SET has_voted=0, voted_at=NULL WHERE id=?',
            [voter_id]
          );
          studentsReset++;
        }
      }

      return { deletedVotes, studentsReset };
    }

  },

  sessions: {
    get: async (id) => {
      const p = getPool();
      const [[row]] = await p.query("SELECT * FROM sessions WHERE id = ?", [id]);
      return row || null;
    },
    updateActiveVoter: async (id, activeVoterVal) => {
      const p = getPool();
      await p.query(
        "INSERT INTO sessions (id, name, active_voter) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE active_voter = ?",
        [id, `Session ${id}`, activeVoterVal, activeVoterVal]
      );
      return true;
    },
    updateReElection: async (id, classId, positionId) => {
      const p = getPool();
      await p.query(
        "UPDATE sessions SET re_election_class_id = ?, re_election_position_id = ? WHERE id = ?",
        [classId || null, positionId || null, id]
      );
      return true;
    },
    all: async () => {
      const p = getPool();
      const [rows] = await p.query("SELECT * FROM sessions ORDER BY id");
      return rows;
    }
  },

  staff: {
    all: async () => {
      const p = getPool();
      const [rows] = await p.query("SELECT * FROM staff ORDER BY username");
      return rows.map(r => ({
        ...r,
        classes: r.classes ? JSON.parse(r.classes) : []
      }));
    },
    get: async (id) => {
      const p = getPool();
      const [[row]] = await p.query("SELECT * FROM staff WHERE id = ?", [id]);
      if (!row) return null;
      return {
        ...row,
        classes: row.classes ? JSON.parse(row.classes) : []
      };
    },
    getByUsername: async (username) => {
      const p = getPool();
      const [[row]] = await p.query("SELECT * FROM staff WHERE LOWER(username) = LOWER(?)", [username]);
      if (!row) return null;
      return {
        ...row,
        classes: row.classes ? JSON.parse(row.classes) : []
      };
    },
    add: async (member) => {
      const p = getPool();
      const id = uuidv4();
      const username = member.username.trim();
      const password_hash = member.password_hash;
      const session_id = member.session_id || null;
      const classesStr = JSON.stringify(member.classes || []);

      await p.query(
        "INSERT INTO staff (id, username, password_hash, session_id, classes) VALUES (?, ?, ?, ?, ?)",
        [id, username, password_hash, session_id, classesStr]
      );

      return {
        id,
        username,
        password_hash,
        session_id,
        classes: member.classes || []
      };
    },
    update: async (id, member) => {
      const p = getPool();
      const [[existing]] = await p.query("SELECT * FROM staff WHERE id = ?", [id]);
      if (!existing) throw new Error('Staff member not found');

      const username = member.username !== undefined ? member.username.trim() : existing.username;
      const password_hash = member.password_hash !== undefined ? member.password_hash : existing.password_hash;
      const session_id = member.session_id !== undefined ? member.session_id : existing.session_id;
      const classesStr = member.classes !== undefined ? JSON.stringify(member.classes) : existing.classes;

      await p.query(
        "UPDATE staff SET username = ?, password_hash = ?, session_id = ?, classes = ? WHERE id = ?",
        [username, password_hash, session_id, classesStr, id]
      );

      return {
        id,
        username,
        password_hash,
        session_id,
        classes: classesStr ? JSON.parse(classesStr) : []
      };
    },
    delete: async (id) => {
      const p = getPool();
      await p.query("DELETE FROM staff WHERE id = ?", [id]);
      return true;
    }
  },

  cabinet: {
    getWinners: async () => {
      const p = getPool();
      const [classes] = await p.query("SELECT * FROM classes WHERE id != 'class-cabinet'");
      const [positions] = await p.query("SELECT * FROM positions WHERE id NOT LIKE 'pos-cabinet-%'");
      
      const winners = [];
      for (const cls of classes) {
        for (const pos of positions) {
          const [cands] = await p.query(`
            SELECT c.id, c.student_id, COUNT(v.id) AS votes_count
            FROM candidates c
            LEFT JOIN votes v ON v.candidate_id = c.id
            WHERE c.class_id = ? AND c.position_id = ?
            GROUP BY c.id
            ORDER BY votes_count DESC
          `, [cls.id, pos.id]);
          
          if (cands.length > 0) {
            const maxVotes = cands[0].votes_count;
            const tiedCands = cands.filter(c => c.votes_count === maxVotes);
            for (const winnerCand of tiedCands) {
              const [[student]] = await p.query("SELECT name, gender FROM students WHERE id = ?", [winnerCand.student_id]);
              if (student) {
                winners.push({
                  student_id: winnerCand.student_id,
                  name: student.name,
                  gender: student.gender,
                  class_id: cls.id,
                  class_name: cls.name,
                  year: cls.year,
                  position_id: pos.id,
                  votes_count: maxVotes
                });
              }
            }
          }
        }
      }
      return winners;
    },
    getVoters: async () => {
      const p = getPool();
      const [rows] = await p.query(`
        SELECT cv.student_id, s.name, s.roll_no, s.gender, c.name AS class_name, c.year,
               CASE WHEN COUNT(v.voter_id) > 0 THEN 1 ELSE 0 END AS cabinet_has_voted,
               MIN(v.voted_at) AS cabinet_voted_at
        FROM cabinet_voters cv
        JOIN students s ON cv.student_id = s.id
        JOIN classes c ON s.class_id = c.id
        LEFT JOIN votes v ON v.voter_id = cv.student_id AND v.class_id = 'class-cabinet'
        GROUP BY cv.student_id, s.name, s.roll_no, s.gender, c.name, c.year
        ORDER BY s.name
      `);
      return rows;
    },
    addVoter: async (studentId) => {
      const p = getPool();
      await p.query("INSERT IGNORE INTO cabinet_voters (student_id) VALUES (?)", [studentId]);
      return true;
    },
    deleteVoter: async (studentId) => {
      const p = getPool();
      await p.query("DELETE FROM cabinet_voters WHERE student_id = ?", [studentId]);
      return true;
    },
    clearVoters: async () => {
      const p = getPool();
      await p.query("DELETE FROM cabinet_voters");
      return true;
    }
  }
};

module.exports = mysqlDb;
