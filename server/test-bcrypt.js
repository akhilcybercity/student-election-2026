// server/test-bcrypt.js
const bcrypt = require('bcryptjs');

const hash = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lF06';
const testPassword = 'admin123';

bcrypt.compare(testPassword, hash, (err, res) => {
  if (err) {
    console.error('Error comparing password:', err);
  } else {
    console.log('Is valid?', res);
  }
});
