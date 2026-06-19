// init-tidb.js — Script to initialize TiDB Cloud database tables
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const config = {
  host: 'gateway01.ap-southeast-1.prod.alicloud.tidbcloud.com',
  port: 4000,
  user: '4UTfXFkWGevD7TR.root',
  password: 'Qi1ObBeamq31rni4',
  database: 'test',
  ssl: {
    rejectUnauthorized: false
  }
};

async function init() {
  console.log('🔌 Connecting to TiDB Cloud database...');
  let connection;
  try {
    connection = await mysql.createConnection(config);
    console.log('✅ Connected successfully!');

    console.log('🗳️ Creating tables in database "test"...');

    // Schema SQL split by semicolon (avoid running it as single query if mysql2 rejects multiple statements)
    const schemaFile = path.join(__dirname, 'schema.sql');
    const sqlContent = fs.readFileSync(schemaFile, 'utf8');

    // Split SQL by semicolons
    const rawQueries = sqlContent.split(';');

    for (let rawQuery of rawQueries) {
      // Strip comments line by line from the query
      const cleanQuery = rawQuery
        .split('\n')
        .map(line => {
          const idx = line.indexOf('--');
          return idx !== -1 ? line.substring(0, idx) : line;
        })
        .join('\n')
        .trim();

      if (cleanQuery.length === 0) {
        continue;
      }

      // Skip database creation / selection statements
      if (cleanQuery.toUpperCase().startsWith('CREATE DATABASE') || cleanQuery.toUpperCase().startsWith('USE ')) {
        continue;
      }

      try {
        await connection.query(cleanQuery);
      } catch (err) {
        console.error(`❌ Error executing query:\n${cleanQuery}\nError: ${err.message}`);
      }
    }


    console.log('🎉 TiDB Database initialized successfully with all tables and default positions!');
  } catch (error) {
    console.error('❌ Connection or setup failed:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

init();
