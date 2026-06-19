// db.js — Unified Database Adapter
require('dotenv').config();

let dbProvider;

// Check if MySQL credentials are provided
const useMySQL = process.env.DB_HOST || process.env.DB_NAME || process.env.DB_USER;

if (useMySQL) {
  console.log('🔌 Database mode: MySQL Cloud/Local Database');
  dbProvider = require('./db/mysql');
} else {
  console.log('📂 Database mode: Zero-Dependency Local JSON Database (db.json)');
  dbProvider = require('./db/jsonDb');
}

module.exports = dbProvider;
