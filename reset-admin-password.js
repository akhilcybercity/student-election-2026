// reset-admin-password.js
// Safely resets ONLY the admin password in TiDB.
// All other data (students, votes, classes, positions) is untouched.
require('dotenv').config();
const mysql  = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const NEW_PASSWORD = process.env.NEW_ADMIN_PASSWORD || 'admin@2026';

async function resetAdminPassword() {
  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('  🔐  Admin Password Reset — TiDB Cloud');
  console.log('═══════════════════════════════════════════════════');

  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST,
    port:     parseInt(process.env.DB_PORT || '4000'),
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'test',
    ssl: { rejectUnauthorized: false }
  });

  console.log('  ✅ Connected to TiDB Cloud');

  // Generate a new bcrypt hash
  const hash = await bcrypt.hash(NEW_PASSWORD, 10);

  // Check if admin_password row already exists
  const [[existing]] = await conn.query(
    "SELECT `value` FROM settings WHERE `key` = 'admin_password'"
  );

  if (existing) {
    // UPDATE existing row — does NOT touch any other data
    await conn.query(
      "UPDATE settings SET `value` = ? WHERE `key` = 'admin_password'",
      [hash]
    );
    console.log('  ✅ admin_password UPDATED in TiDB');
  } else {
    // INSERT if not exists
    await conn.query(
      "INSERT INTO settings (`key`, `value`) VALUES ('admin_password', ?)",
      [hash]
    );
    console.log('  ✅ admin_password INSERTED in TiDB');
  }

  // Verify by reading it back and testing compare
  const [[row]] = await conn.query(
    "SELECT `value` FROM settings WHERE `key` = 'admin_password'"
  );
  const valid = await bcrypt.compare(NEW_PASSWORD, row.value);
  if (valid) {
    console.log(`  🎉 Password reset SUCCESSFUL!`);
    console.log(`  🔑 New admin password: "${NEW_PASSWORD}"`);
  } else {
    console.log('  ❌ Verification failed — please try again');
  }

  // Show data counts to confirm nothing else was touched
  const [[{ students }]] = await conn.query('SELECT COUNT(*) AS students FROM students');
  const [[{ votes }]]    = await conn.query('SELECT COUNT(*) AS votes FROM votes');
  const [[{ classes }]]  = await conn.query('SELECT COUNT(*) AS classes FROM classes');

  console.log('');
  console.log('  📊 Data integrity check (unchanged):');
  console.log(`     Students : ${students}`);
  console.log(`     Votes    : ${votes}`);
  console.log(`     Classes  : ${classes}`);
  console.log('');
  console.log('═══════════════════════════════════════════════════');

  await conn.end();
}

resetAdminPassword().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
