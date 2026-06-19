// index.js — Election Management System — Express Server
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app = express();

// ─── Middleware ───────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Serve static frontend ────────────────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'public')));

// ─── API Routes ───────────────────────────────────────────────────
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/settings',   require('./routes/settings'));
app.use('/api/classes',    require('./routes/classes'));
app.use('/api/positions',  require('./routes/positions'));
app.use('/api/students',   require('./routes/students'));
app.use('/api/candidates', require('./routes/candidates'));
app.use('/api/votes',      require('./routes/votes'));

// ─── Health check ────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// ─── Fallback: serve frontend for non-API routes ─────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ─── Error handler ────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Start ────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log('  🗳️  Election Management System — Server');
  console.log('═══════════════════════════════════════════════');
  console.log(`  ✅ Running at: http://localhost:${PORT}`);
  console.log(`  📁 Static:     /public`);
  console.log(`  🔌 DB Host:    ${process.env.DB_HOST || 'localhost'}`);
  console.log('  Press Ctrl+C to stop');
  console.log('═══════════════════════════════════════════════');
  console.log('');
});
