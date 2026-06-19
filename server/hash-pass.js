// server/hash-pass.js
const bcrypt = require('bcryptjs');

bcrypt.hash('admin123', 10, (err, hash) => {
  if (err) {
    console.error(err);
  } else {
    console.log('New Hash:', hash);
    bcrypt.compare('admin123', hash, (e, res) => {
      console.log('Verifying matches:', res);
    });
  }
});
