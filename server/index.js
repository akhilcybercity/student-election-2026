// index.js — Election Management System — Express Server
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app = express();

// ─── CORS — allow both Render and Railway deployments ────────────
const allowedOrigins = [
  process.env.RENDER_URL,    // e.g. https://your-app.onrender.com
  process.env.RAILWAY_URL,   // e.g. https://your-app.up.railway.app
  'http://localhost:3000',
  'http://localhost:5000',
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, curl, Postman) or matching origins
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      cb(null, true);
    } else {
      cb(new Error('CORS: origin not allowed — ' + origin));
    }
  },
  credentials: true
}));
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
app.use('/api/staff',      require('./routes/staff'));
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
const DEPLOYMENT = process.env.RAILWAY_ENVIRONMENT
  ? `Railway (${process.env.RAILWAY_ENVIRONMENT})`
  : process.env.RENDER
  ? 'Render'
  : 'Local';

app.listen(PORT, () => {
  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log('  🗳️  Election Management System — Server');
  console.log('═══════════════════════════════════════════════');
  console.log(`  ✅ Running at: http://localhost:${PORT}`);
  console.log(`  🌐 Platform:   ${DEPLOYMENT}`);
  console.log(`  📁 Static:     /public`);
  console.log(`  🔌 DB Host:    ${process.env.DB_HOST || 'localhost (JSON mode)'}`);
  console.log('  Press Ctrl+C to stop');
  console.log('═══════════════════════════════════════════════');
  console.log('');
});
