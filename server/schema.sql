-- ═══════════════════════════════════════════════════════════════
-- Election Management System — MySQL Schema
-- Run this file once to set up the database
-- ═══════════════════════════════════════════════════════════════

-- CREATE DATABASE IF NOT EXISTS election_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- USE election_db;


-- ─── Settings ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  `key`   VARCHAR(100) PRIMARY KEY,
  `value` TEXT
);

INSERT IGNORE INTO settings VALUES
  ('election_name',   'Student Council Elections 2026'),
  ('college_name',    'Your College Name'),
  ('election_open',   'false'),
  ('admin_password',  '$2a$10$vJYO.9/BCeNEM3tzLu4qmufg.0x0Qju4yzrEZzpZ6GeZZ9yPlFEJi'); 
  -- Default password: admin123

-- ─── Classes ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS classes (
  id         VARCHAR(36)  PRIMARY KEY,
  name       VARCHAR(150) NOT NULL,
  course     VARCHAR(150),
  year       INT          DEFAULT 1,
  section    VARCHAR(10),
  created_at DATETIME     DEFAULT NOW()
);

-- ─── Positions (dynamic, admin-created) ──────────────────────────
CREATE TABLE IF NOT EXISTS positions (
  id         VARCHAR(36)              PRIMARY KEY,
  label      VARCHAR(150)             NOT NULL,
  gender     ENUM('Boy','Girl','Any') DEFAULT 'Any',
  icon       VARCHAR(20)              DEFAULT '🏅',
  sort_order INT                      DEFAULT 0,
  created_at DATETIME                 DEFAULT NOW()
);

INSERT IGNORE INTO positions (id, label, gender, icon, sort_order) VALUES
  ('pos-cr-boy',       'Class Representative (Boy)',  'Boy',  '🎓', 1),
  ('pos-cr-girl',      'Class Representative (Girl)', 'Girl', '🎓', 2),
  ('pos-sports-boy',   'Sports Representative (Boy)',  'Boy',  '⚽', 3),
  ('pos-sports-girl',  'Sports Representative (Girl)', 'Girl', '⚽', 4),
  ('pos-cultural-boy', 'Cultural Representative (Boy)', 'Boy',  '🎭', 5),
  ('pos-cultural-girl','Cultural Representative (Girl)','Girl', '🎭', 6);

-- ─── Students ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS students (
  id         VARCHAR(36)        PRIMARY KEY,
  name       VARCHAR(200)       NOT NULL,
  roll_no    VARCHAR(50)        DEFAULT '',
  gender     ENUM('Boy','Girl') NOT NULL,
  class_id   VARCHAR(36),
  has_voted  BOOLEAN            DEFAULT FALSE,
  is_absent  BOOLEAN            DEFAULT FALSE,
  voted_at   DATETIME           NULL,
  created_at DATETIME           DEFAULT NOW(),
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL
);

-- ─── Candidates ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS candidates (
  id          VARCHAR(36) PRIMARY KEY,
  student_id  VARCHAR(36) NOT NULL,
  class_id    VARCHAR(36) NOT NULL,
  position_id VARCHAR(36) NOT NULL,
  created_at  DATETIME    DEFAULT NOW(),
  UNIQUE KEY uq_student_position (student_id, position_id),
  FOREIGN KEY (student_id)  REFERENCES students(id)  ON DELETE CASCADE,
  FOREIGN KEY (class_id)    REFERENCES classes(id)   ON DELETE CASCADE,
  FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE CASCADE
);

-- ─── Votes ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS votes (
  id           VARCHAR(36) PRIMARY KEY,
  voter_id     VARCHAR(36) NOT NULL,
  candidate_id VARCHAR(36) NOT NULL,
  position_id  VARCHAR(36) NOT NULL,
  class_id     VARCHAR(36) NOT NULL,
  voted_at     DATETIME    DEFAULT NOW(),
  FOREIGN KEY (voter_id)     REFERENCES students(id)   ON DELETE CASCADE,
  FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
);

-- ─── Indexes ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_students_class    ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_students_gender   ON students(gender);
CREATE INDEX IF NOT EXISTS idx_candidates_class  ON candidates(class_id);
CREATE INDEX IF NOT EXISTS idx_votes_voter       ON votes(voter_id);
CREATE INDEX IF NOT EXISTS idx_votes_class       ON votes(class_id);
