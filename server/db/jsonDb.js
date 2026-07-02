// jsonDb.js — Zero-dependency JSON Database Provider
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_FILE = path.join(__dirname, '..', 'db.json');

// Initialize database with defaults if it doesn't exist
function initDb() {
  if (!fs.existsSync(DB_FILE)) {
    const defaults = {
      settings: [
        { key: 'election_name', value: 'Student Council Elections 2026' },
        { key: 'college_name', value: 'Your College Name' },
        { key: 'election_open', value: 'false' },
        { key: 'admin_password', value: '$2a$10$vJYO.9/BCeNEM3tzLu4qmufg.0x0Qju4yzrEZzpZ6GeZZ9yPlFEJi' } // admin123
      ],
      classes: [],
      positions: [
        { id: 'pos-cr-boy', label: 'Class Representative (Boy)', gender: 'Boy', icon: '🎓', sort_order: 1, created_at: new Date().toISOString() },
        { id: 'pos-cr-girl', label: 'Class Representative (Girl)', gender: 'Girl', icon: '🎓', sort_order: 2, created_at: new Date().toISOString() },
        { id: 'pos-sports-boy', label: 'Sports Representative (Boy)', gender: 'Boy', icon: '⚽', sort_order: 3, created_at: new Date().toISOString() },
        { id: 'pos-sports-girl', label: 'Sports Representative (Girl)', gender: 'Girl', icon: '⚽', sort_order: 4, created_at: new Date().toISOString() },
        { id: 'pos-cultural-boy', label: 'Cultural Representative (Boy)', gender: 'Boy', icon: '🎭', sort_order: 5, created_at: new Date().toISOString() },
        { id: 'pos-cultural-girl', label: 'Cultural Representative (Girl)', gender: 'Girl', icon: '🎭', sort_order: 6, created_at: new Date().toISOString() }
      ],
      students: [],
      candidates: [],
      votes: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(defaults, null, 2), 'utf8');
  }
}

// Read database helper
function readData() {
  initDb();
  try {
    const content = fs.readFileSync(DB_FILE, 'utf8');
    const data = JSON.parse(content);
    let changed = false;
    if (!data.sessions) {
      data.sessions = [
        { id: '1', name: 'Session 1', active_voter: '' },
        { id: '2', name: 'Session 2', active_voter: '' },
        { id: '3', name: 'Session 3', active_voter: '' }
      ];
      changed = true;
    }
    if (!data.staff) {
      data.staff = [];
      changed = true;
    }
    if (changed) {
      writeData(data);
    }
    return data;
  } catch (e) {
    console.error('Error reading JSON DB, returning empty defaults', e);
    return { settings: [], classes: [], positions: [], students: [], candidates: [], votes: [], sessions: [], staff: [] };
  }
}

// Write database helper (atomic write using temp file)
function writeData(data) {
  const tempPath = DB_FILE + '.tmp';
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tempPath, DB_FILE);
}

// Initialize on load
initDb();

const jsonDb = {
  settings: {
    get: async (key) => {
      const data = readData();
      const setting = data.settings.find(s => s.key === key);
      return setting ? setting.value : null;
    },
    getAll: async () => {
      const data = readData();
      const res = {};
      data.settings.forEach(s => {
        if (s.key !== 'admin_password') {
          res[s.key] = s.value === 'true' ? true : s.value === 'false' ? false : s.value;
        }
      });
      return res;
    },
    update: async (settingsObj) => {
      const data = readData();
      for (const [key, val] of Object.entries(settingsObj)) {
        const idx = data.settings.findIndex(s => s.key === key);
        const strVal = String(val);
        if (idx !== -1) {
          data.settings[idx].value = strVal;
        } else {
          data.settings.push({ key, value: strVal });
        }
      }
      writeData(data);
      return true;
    }
  },

  classes: {
    all: async () => {
      const data = readData();
      return data.classes.sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.name.localeCompare(b.name);
      });
    },
    get: async (id) => {
      const data = readData();
      return data.classes.find(c => c.id === id) || null;
    },
    add: async (cls) => {
      const data = readData();
      const newClass = {
        id: uuidv4(),
        name: cls.name.trim(),
        course: cls.course.trim(),
        year: parseInt(cls.year) || 1,
        section: cls.section.trim(),
        created_at: new Date().toISOString()
      };
      data.classes.push(newClass);
      writeData(data);
      return newClass;
    },
    update: async (id, cls) => {
      const data = readData();
      const idx = data.classes.findIndex(c => c.id === id);
      if (idx === -1) throw new Error('Class not found');
      data.classes[idx] = {
        ...data.classes[idx],
        name: cls.name.trim(),
        course: cls.course.trim(),
        year: parseInt(cls.year) || 1,
        section: cls.section.trim()
      };
      writeData(data);
      return data.classes[idx];
    },
    delete: async (id) => {
      const data = readData();
      data.classes = data.classes.filter(c => c.id !== id);
      data.students = data.students.filter(s => s.class_id !== id);
      data.candidates = data.candidates.filter(c => c.class_id !== id);
      data.votes = data.votes.filter(v => v.class_id !== id);
      writeData(data);
      return true;
    },
    stats: async (id) => {
      const data = readData();
      const students = data.students.filter(s => s.class_id === id);
      const total = students.filter(s => !s.is_absent).length;
      const voted = students.filter(s => s.has_voted).length;
      const absent = students.filter(s => s.is_absent).length;
      const pending = total - voted;
      return { total, voted, absent, pending };
    }
  },

  positions: {
    all: async () => {
      const data = readData();
      return data.positions.sort((a, b) => a.sort_order - b.sort_order);
    },
    get: async (id) => {
      const data = readData();
      return data.positions.find(p => p.id === id) || null;
    },
    add: async (pos) => {
      const data = readData();
      const newPos = {
        id: uuidv4(),
        label: pos.label.trim(),
        gender: pos.gender || 'Any',
        icon: pos.icon || '🏅',
        sort_order: parseInt(pos.sort_order) || 0,
        created_at: new Date().toISOString()
      };
      data.positions.push(newPos);
      writeData(data);
      return newPos;
    },
    update: async (id, pos) => {
      const data = readData();
      const idx = data.positions.findIndex(p => p.id === id);
      if (idx === -1) throw new Error('Position not found');
      data.positions[idx] = {
        ...data.positions[idx],
        label: pos.label.trim(),
        gender: pos.gender || 'Any',
        icon: pos.icon || '🏅',
        sort_order: parseInt(pos.sort_order) || 0
      };
      writeData(data);
      return data.positions[idx];
    },
    delete: async (id) => {
      const data = readData();
      data.positions = data.positions.filter(p => p.id !== id);
      data.candidates = data.candidates.filter(c => c.position_id !== id);
      writeData(data);
      return true;
    }
  },

  students: {
    all: async (filters = {}) => {
      const data = readData();
      let res = [...data.students];
      if (filters.classId) {
        res = res.filter(s => s.class_id === filters.classId);
      }
      if (filters.gender) {
        res = res.filter(s => s.gender === filters.gender);
      }
      if (filters.search) {
        const srch = filters.search.toLowerCase();
        res = res.filter(s => s.name.toLowerCase().includes(srch) || (s.roll_no && s.roll_no.toLowerCase().includes(srch)));
      }
      // Populate class name
      res = res.map(s => {
        const cls = data.classes.find(c => c.id === s.class_id);
        return {
          ...s,
          class_name: cls ? cls.name : '—'
        };
      });
      return res.sort((a, b) => a.name.localeCompare(b.name));
    },
    get: async (id) => {
      const data = readData();
      return data.students.find(s => s.id === id) || null;
    },
    add: async (stud) => {
      const data = readData();
      const newStudent = {
        id: uuidv4(),
        name: stud.name.trim(),
        roll_no: (stud.roll_no || '').trim(),
        gender: stud.gender,
        class_id: stud.class_id,
        has_voted: false,
        is_absent: false,
        voted_at: null,
        created_at: new Date().toISOString()
      };
      data.students.push(newStudent);
      writeData(data);
      return newStudent;
    },
    update: async (id, stud) => {
      const data = readData();
      const idx = data.students.findIndex(s => s.id === id);
      if (idx === -1) throw new Error('Student not found');
      data.students[idx] = {
        ...data.students[idx],
        name: stud.name.trim(),
        roll_no: (stud.roll_no || '').trim(),
        gender: stud.gender,
        class_id: stud.class_id
      };
      writeData(data);
      return data.students[idx];
    },
    delete: async (id) => {
      const data = readData();
      data.students = data.students.filter(s => s.id !== id);
      data.candidates = data.candidates.filter(c => c.student_id !== id);
      data.votes = data.votes.filter(v => v.voter_id !== id);
      writeData(data);
      return true;
    },
    markAbsent: async (id, isAbsent) => {
      const data = readData();
      const idx = data.students.findIndex(s => s.id === id);
      if (idx === -1) throw new Error('Student not found');
      if (data.students[idx].has_voted && isAbsent) {
        throw new Error('Cannot mark a voted student as absent');
      }
      data.students[idx].is_absent = !!isAbsent;
      writeData(data);
      return true;
    },
    import: async (studentsList) => {
      const data = readData();
      const classes = data.classes;
      const classMap = {};
      classes.forEach(c => {
        classMap[c.name.trim().toLowerCase()] = c.id;
      });

      const results = { imported: 0, skipped: 0, errors: [] };
      const existingRolls = new Set(data.students.filter(s => s.roll_no).map(s => s.roll_no.toLowerCase()));

      studentsList.forEach((row, i) => {
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
          return;
        }
        if (!gender) {
          results.errors.push({ row: rowNum, name, error: `Invalid gender "${genderRaw}"` });
          results.skipped++;
          return;
        }
        if (!className) {
          results.errors.push({ row: rowNum, name, error: 'Missing Class Name' });
          results.skipped++;
          return;
        }

        const classId = classMap[className.toLowerCase()];
        if (!classId) {
          results.errors.push({ row: rowNum, name, error: `Class "${className}" not found` });
          results.skipped++;
          return;
        }

        if (rollNo && existingRolls.has(rollNo.toLowerCase())) {
          results.errors.push({ row: rowNum, name, error: `Roll No "${rollNo}" already exists` });
          results.skipped++;
          return;
        }

        const newStudent = {
          id: uuidv4(),
          name,
          roll_no: rollNo,
          gender,
          class_id: classId,
          has_voted: false,
          is_absent: false,
          voted_at: null,
          created_at: new Date().toISOString()
        };

        data.students.push(newStudent);
        if (rollNo) existingRolls.add(rollNo.toLowerCase());
        results.imported++;
      });

      writeData(data);
      return results;
    },
    globalStats: async () => {
      const data = readData();
      const total_students = data.students.length;
      const total_voted = data.students.filter(s => s.has_voted).length;
      const total_absent = data.students.filter(s => s.is_absent).length;
      const total_pending = data.students.filter(s => !s.has_voted && !s.is_absent).length;
      const total_classes = data.classes.length;
      const total_votes = data.votes.length;
      return { total_students, total_voted, total_absent, total_pending, total_classes, total_votes };
    }
  },

  candidates: {
    byClass: async (classId) => {
      const data = readData();
      const cands = data.candidates.filter(c => c.class_id === classId);
      return cands.map(c => {
        const student = data.students.find(s => s.id === c.student_id);
        const position = data.positions.find(p => p.id === c.position_id);
        return {
          id: c.id,
          student_id: c.student_id,
          class_id: c.class_id,
          position_id: c.position_id,
          photo: student ? student.photo || null : null,
          student_name: student ? student.name : 'Unknown Student',
          student_gender: student ? student.gender : 'Boy',
          roll_no: student ? student.roll_no : '',
          position_label: position ? position.label : 'Unknown Position',
          position_gender: position ? position.gender : 'Any',
          icon: position ? position.icon : '🏅'
        };
      });
    },
    add: async (cand) => {
      const data = readData();
      const student = data.students.find(s => s.id === cand.student_id);
      const position = data.positions.find(p => p.id === cand.position_id);
      if (!student) throw new Error('Student not found');
      if (!position) throw new Error('Position not found');

      if (position.gender !== 'Any' && student.gender !== position.gender) {
        throw new Error(`This position is for ${position.gender} students only. "${student.name}" is ${student.gender}.`);
      }

      // Check duplicates
      const dup = data.candidates.find(c => c.student_id === cand.student_id && c.position_id === cand.position_id);
      if (dup) throw new Error('This student is already a candidate for this position');

      const newCand = {
        id: uuidv4(),
        student_id: cand.student_id,
        class_id: cand.class_id,
        position_id: cand.position_id,
        created_at: new Date().toISOString()
      };
      data.candidates.push(newCand);
      writeData(data);
      return {
        ...newCand,
        student_name: student.name,
        student_gender: student.gender,
        position_label: position.label,
        position_gender: position.gender,
        icon: position.icon
      };
    },
    delete: async (id) => {
      const data = readData();
      const votesCount = data.votes.filter(v => v.candidate_id === id).length;
      if (votesCount > 0) throw new Error('Cannot remove candidate with existing votes');

      data.candidates = data.candidates.filter(c => c.id !== id);
      writeData(data);
      return true;
    },
    updatePhoto: async (id, photoPath) => {
      const data = readData();
      const idx = data.candidates.findIndex(c => c.id === id);
      if (idx !== -1) {
        data.candidates[idx].photo = photoPath;
        writeData(data);
        return true;
      }
      return false;
    }
  },

  votes: {
    cast: async (vote) => {
      const data = readData();
      const voter = data.students.find(s => s.id === vote.voter_id);
      if (!voter) throw new Error('Voter not found');

      if (vote.class_id === 'class-cabinet') {
        const cabinetVoted = data.votes.some(
          v => v.voter_id === vote.voter_id && v.class_id === 'class-cabinet'
        );
        if (cabinetVoted) {
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

      if (voter.is_absent) {
        const err = new Error('You are marked as absent');
        err.code = 'is_absent';
        throw err;
      }

      // Record votes — skip any position already voted for (re-election safe guard)
      vote.selections.forEach(sel => {
        const alreadyVoted = data.votes.some(
          v => v.voter_id === vote.voter_id && v.position_id === sel.position_id
        );
        if (alreadyVoted) return; // silently skip — student already voted for this position

        data.votes.push({
          id: uuidv4(),
          voter_id: vote.voter_id,
          candidate_id: sel.candidate_id,
          position_id: sel.position_id,
          class_id: vote.class_id,
          voted_at: new Date().toISOString()
        });
      });

      // Mark voter as voted (only if standard vote, not cabinet)
      if (vote.class_id !== 'class-cabinet') {
        const voterIdx = data.students.findIndex(s => s.id === vote.voter_id);
        if (voterIdx !== -1) {
          data.students[voterIdx].has_voted = true;
          data.students[voterIdx].voted_at = new Date().toISOString();
        }
      }

      writeData(data);
      return true;
    },
    results: async (classId) => {
      const data = readData();
      let targetClasses = data.classes;
      if (classId) {
        targetClasses = targetClasses.filter(c => c.id === classId);
      }

      const results = [];

      for (const cls of targetClasses) {
        let stats;
        if (cls.id === 'class-cabinet') {
          const winners = await jsonDb.cabinet.getWinners();
          const totalVoters = winners.length;
          const uniqueVotedIds = new Set(
            data.votes.filter(v => v.class_id === 'class-cabinet').map(v => v.voter_id)
          );
          const voted = uniqueVotedIds.size;
          stats = {
            total: totalVoters,
            voted: voted,
            absent: 0,
            pending: Math.max(0, totalVoters - voted)
          };
        } else {
          const classStudents = data.students.filter(s => s.class_id === cls.id);
          const total = classStudents.filter(s => !s.is_absent).length;
          const voted = classStudents.filter(s => s.has_voted).length;
          const absent = classStudents.filter(s => s.is_absent).length;
          const pending = total - voted;
          stats = { total, voted, absent, pending };
        }

        const classVotes = data.votes.filter(v => v.class_id === cls.id);
        const classCandidates = data.candidates.filter(c => c.class_id === cls.id);
        
        let classPositions = data.positions;
        if (cls.id === 'class-cabinet') {
          classPositions = data.positions.filter(p => p.id.startsWith('pos-cabinet-'));
        } else {
          classPositions = data.positions.filter(p => !p.id.startsWith('pos-cabinet-'));
        }

        const posList = classPositions.map(pos => {
          const cands = classCandidates.filter(c => c.position_id === pos.id).map(cand => {
            const student = data.students.find(s => s.id === cand.student_id);
            const votesCount = classVotes.filter(v => v.candidate_id === cand.id).length;
            return {
              id: cand.id,
              name: student ? student.name : 'Unknown Student',
              votes: votesCount
            };
          });

          // Sort candidates by votes descending
          cands.sort((a, b) => b.votes - a.votes);

          return {
            id: pos.id,
            label: pos.label,
            gender: pos.gender,
            icon: pos.icon,
            candidates: cands
          };
        });

        results.push({
          class: cls,
          stats: stats,
          positions: posList
        });
      }

      return results;
    },
    stats: async () => {
      const data = readData();
      const total_students = data.students.length;
      const total_voted = data.students.filter(s => s.has_voted).length;
      const total_absent = data.students.filter(s => s.is_absent).length;
      const total_pending = data.students.filter(s => !s.has_voted && !s.is_absent).length;
      const total_classes = data.classes.length;
      const total_votes = data.votes.length;
      return { total_students, total_voted, total_absent, total_pending, total_classes, total_votes };
    },
    // Unlock students in a class so they can re-vote (after selective reset)
    // Sets has_voted=FALSE for all voted students in the class
    // Safe because cast() now skips duplicate votes per position
    unlockClassForReElection: async ({ classId }) => {
      const data = readData();
      let studentsUnlocked = 0;
      data.students.forEach(s => {
        if (s.class_id === classId) {
          s.has_voted = false;
          s.voted_at  = null;
          studentsUnlocked++;
        }
      });
      writeData(data);
      return { studentsUnlocked };
    },

    reset: async () => {
      const data = readData();
      data.votes = [];
      data.students.forEach(s => {
        s.has_voted = false;
        s.voted_at = null;
      });
      writeData(data);
      return true;
    },

    // Preview how many votes/students a selective reset would affect (read-only)
    previewReset: async ({ classId, positionId }) => {
      const data = readData();

      const affectedVotes = data.votes.filter(
        v => v.class_id === classId && v.position_id === positionId
      );
      const voteCount   = affectedVotes.length;
      const uniqueVoters = [...new Set(affectedVotes.map(v => v.voter_id))];
      const voterCount  = uniqueVoters.length;

      // Count how many of those voters would be fully unlocked
      let studentsToUnlock = 0;
      for (const vid of uniqueVoters) {
        const remaining = data.votes.filter(
          v => v.voter_id === vid && !(v.class_id === classId && v.position_id === positionId)
        ).length;
        if (remaining === 0) studentsToUnlock++;
      }

      const cls = data.classes.find(c => c.id === classId);
      const pos = data.positions.find(p => p.id === positionId);

      return {
        voteCount,
        voterCount,
        studentsToUnlock,
        className:      cls ? cls.name   : classId,
        positionLabel:  pos ? pos.label  : positionId,
        positionGender: pos ? pos.gender : 'Any'
      };
    },

    // Selective reset: delete votes for one class+position, unlock only affected students
    selectiveReset: async ({ classId, positionId }) => {
      const data = readData();

      const affectedVotes = data.votes.filter(
        v => v.class_id === classId && v.position_id === positionId
      );
      if (affectedVotes.length === 0) return { deletedVotes: 0, studentsReset: 0 };

      const uniqueVoters = [...new Set(affectedVotes.map(v => v.voter_id))];

      // Delete only those votes
      const deletedVotes = affectedVotes.length;
      data.votes = data.votes.filter(
        v => !(v.class_id === classId && v.position_id === positionId)
      );

      // Unlock students who have no remaining votes at all
      let studentsReset = 0;
      for (const vid of uniqueVoters) {
        const remaining = data.votes.filter(v => v.voter_id === vid).length;
        if (remaining === 0) {
          const idx = data.students.findIndex(s => s.id === vid);
          if (idx !== -1) {
            data.students[idx].has_voted = false;
            data.students[idx].voted_at  = null;
            studentsReset++;
          }
        }
      }

      writeData(data);
      return { deletedVotes, studentsReset };
    }

  },

  sessions: {
    get: async (id) => {
      const data = readData();
      const s = data.sessions.find(x => x.id === id);
      if (!s) return null;
      return {
        id: s.id,
        name: s.name,
        active_voter: s.active_voter || '',
        re_election_class_id: s.re_election_class_id || null,
        re_election_position_id: s.re_election_position_id || null
      };
    },
    updateActiveVoter: async (id, activeVoterVal) => {
      const data = readData();
      const idx = data.sessions.findIndex(x => x.id === id);
      if (idx !== -1) {
        data.sessions[idx].active_voter = activeVoterVal;
      } else {
        data.sessions.push({
          id,
          name: `Session ${id}`,
          active_voter: activeVoterVal,
          re_election_class_id: null,
          re_election_position_id: null
        });
      }
      writeData(data);
      return true;
    },
    updateReElection: async (id, classId, positionId) => {
      const data = readData();
      const idx = data.sessions.findIndex(x => x.id === id);
      if (idx !== -1) {
        data.sessions[idx].re_election_class_id = classId || null;
        data.sessions[idx].re_election_position_id = positionId || null;
        writeData(data);
        return true;
      }
      return false;
    },
    all: async () => {
      const data = readData();
      const list = data.sessions || [];
      let changed = false;
      list.forEach(s => {
        if (s.re_election_class_id === undefined) { s.re_election_class_id = null; changed = true; }
        if (s.re_election_position_id === undefined) { s.re_election_position_id = null; changed = true; }
      });
      if (changed) writeData(data);
      return list;
    }
  },

  staff: {
    all: async () => {
      const data = readData();
      return data.staff || [];
    },
    get: async (id) => {
      const data = readData();
      return data.staff.find(x => x.id === id) || null;
    },
    getByUsername: async (username) => {
      const data = readData();
      return data.staff.find(x => x.username.toLowerCase() === username.toLowerCase()) || null;
    },
    add: async (member) => {
      const data = readData();
      const newMember = {
        id: uuidv4(),
        username: member.username.trim(),
        password_hash: member.password_hash,
        session_id: member.session_id,
        classes: member.classes || []
      };
      data.staff = data.staff || [];
      data.staff.push(newMember);
      writeData(data);
      return newMember;
    },
    update: async (id, member) => {
      const data = readData();
      const idx = data.staff.findIndex(x => x.id === id);
      if (idx === -1) throw new Error('Staff member not found');
      
      const existing = data.staff[idx];
      data.staff[idx] = {
        ...existing,
        username: member.username !== undefined ? member.username.trim() : existing.username,
        password_hash: member.password_hash !== undefined ? member.password_hash : existing.password_hash,
        session_id: member.session_id !== undefined ? member.session_id : existing.session_id,
        classes: member.classes !== undefined ? member.classes : existing.classes
      };
      writeData(data);
      return data.staff[idx];
    },
    delete: async (id) => {
      const data = readData();
      data.staff = (data.staff || []).filter(x => x.id !== id);
      writeData(data);
      return true;
    }
  },

  cabinet: {
    getWinners: async () => {
      const data = readData();
      const classes = data.classes.filter(c => c.id !== 'class-cabinet');
      const positions = data.positions.filter(p => !p.id.startsWith('pos-cabinet-'));
      
      const winners = [];
      classes.forEach(cls => {
        positions.forEach(pos => {
          const classCands = data.candidates.filter(c => c.class_id === cls.id && c.position_id === pos.id);
          const candVotes = classCands.map(cand => {
            const votesCount = data.votes.filter(v => v.candidate_id === cand.id).length;
            return { cand, votesCount };
          });
          
          if (candVotes.length > 0) {
            candVotes.sort((a, b) => b.votesCount - a.votesCount);
            const maxVotes = candVotes[0].votesCount;
            const tied = candVotes.filter(cv => cv.votesCount === maxVotes);
            
            tied.forEach(cv => {
              const student = data.students.find(s => s.id === cv.cand.student_id);
              if (student) {
                winners.push({
                  student_id: cv.cand.student_id,
                  name: student.name,
                  gender: student.gender,
                  class_id: cls.id,
                  class_name: cls.name,
                  year: cls.year,
                  position_id: pos.id,
                  votes_count: maxVotes
                });
              }
            });
          }
        });
      });
      return winners;
    },
    getVoters: async () => {
      const data = readData();
      data.cabinet_voters = data.cabinet_voters || [];
      const list = [];
      data.cabinet_voters.forEach(voterId => {
        const student = data.students.find(s => s.id === voterId);
        if (student) {
          const cls = data.classes.find(c => c.id === student.class_id);
          list.push({
            student_id: voterId,
            name: student.name,
            roll_no: student.roll_no,
            gender: student.gender,
            class_name: cls ? cls.name : student.class_id,
            year: cls ? cls.year : 0
          });
        }
      });
      list.sort((a,b) => a.name.localeCompare(b.name));
      return list;
    },
    addVoter: async (studentId) => {
      const data = readData();
      data.cabinet_voters = data.cabinet_voters || [];
      if (!data.cabinet_voters.includes(studentId)) {
        data.cabinet_voters.push(studentId);
        writeData(data);
      }
      return true;
    },
    deleteVoter: async (studentId) => {
      const data = readData();
      data.cabinet_voters = data.cabinet_voters || [];
      data.cabinet_voters = data.cabinet_voters.filter(id => id !== studentId);
      writeData(data);
      return true;
    },
    clearVoters: async () => {
      const data = readData();
      data.cabinet_voters = [];
      writeData(data);
      return true;
    }
  }
};

module.exports = jsonDb;
