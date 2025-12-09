import pg from 'pg';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

const { Pool } = pg;

// 1. Helper to get the Database URL
function getDatabaseUrl() {
  // Option A: Try Global Settings (Fastest)
  if (global.paldea?.settings?.neonDbUrl) {
    return global.paldea.settings.neonDbUrl;
  }

  // Option B: Fallback to reading settings.json using Current Working Directory (CWD)
  try {
    // Uses process.cwd() to target the root folder where you started the bot
    const settingsPath = path.join(process.cwd(), 'json', 'settings.json');

    if (fs.existsSync(settingsPath)) {
      const rawData = fs.readFileSync(settingsPath, 'utf8');
      const settings = JSON.parse(rawData);
      return settings.neonDbUrl;
    }
  } catch (error) {
    console.error('❌ Failed to load settings.json for DB URL:', error.message);
  }

  console.error('❌ CRITICAL: No NeonDB URL found in global.paldea.settings or json/settings.json');
  process.exit(1);
}

// 2. Defined Schema directly in code
const SCHEMA_SQL = `
-- Users Table: Stores economy, exp, and registration status
CREATE TABLE IF NOT EXISTS users (
    id BIGINT PRIMARY KEY,
    money BIGINT DEFAULT 0,
    exp BIGINT DEFAULT 0,
    registered BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    data JSONB DEFAULT '{}'::jsonb -- Stores flexible data like { "lastTimeGetReward": "..." }
);

-- Groups Table: Stores chat settings
CREATE TABLE IF NOT EXISTS groups (
    id BIGINT PRIMARY KEY,
    settings JSONB DEFAULT '{}'::jsonb, -- e.g. { "welcome_message": true }
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_money ON users(money DESC);
CREATE INDEX IF NOT EXISTS idx_users_exp ON users(exp DESC);
`;

// Initialize connection pool
// Note: We call getDatabaseUrl() immediately.
const pool = new Pool({
  connectionString: getDatabaseUrl(),
  ssl: { rejectUnauthorized: false } // Required for NeonDB
});

export const db = {
  pool,

  // Initialize Database: Runs the embedded schema automatically
  async connect() {
    try {
      const client = await pool.connect();
      console.log(chalk.blue.bold('CONNECTING TO DATABASE...'));
global.log.database('Connected to NeonDB');

      // Run the embedded schema string
      await client.query(SCHEMA_SQL);

global.log.database('Database Schema Synced');
      console.log('');
      client.release();
    } catch (err) {
      console.error('❌ Database Connection Error:', err);
      process.exit(1);
    }
  },

  // Developer Tool: Wipe and Recreate Tables
  async reset() {
    const client = await pool.connect();
    try {
      log.database('Resetting Database...');
      await client.query('DROP TABLE IF EXISTS users CASCADE');
      await client.query('DROP TABLE IF EXISTS groups CASCADE');

      // Re-run the embedded schema
      await client.query(SCHEMA_SQL);

      log.database('Database Reset Complete');
      return true;
    } catch (err) {
      console.error('❌ Reset Error:', err);
      throw err;
    } finally {
      client.release();
    }
  }
};

/**
 * Users Data Wrapper
 * Mimics your old "usersData.get/set" style but uses SQL.
 */
export const usersData = {
  async get(userId) {
    const res = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    // If user exists, return data. If not, return default structure (but don't insert yet)
    if (res.rows.length > 0) return res.rows[0];
    return { id: userId, money: 0, exp: 0, registered: false, data: {} };
  },

  async set(userId, updateData) {
    // Determine if we need to insert or update
    const exists = await pool.query('SELECT 1 FROM users WHERE id = $1', [userId]);

    if (exists.rowCount === 0) {
      // Create new user
      const { money = 0, exp = 0, registered = false, data = {} } = updateData;
      await pool.query(
        'INSERT INTO users (id, money, exp, registered, data) VALUES ($1, $2, $3, $4, $5)',
        [userId, money, exp, registered, data]
      );
    } else {
      // Dynamic Update
      const fields = [];
      const values = [];
      let idx = 1;

      for (const [key, value] of Object.entries(updateData)) {
        if (key === 'id') continue; // Skip ID
        fields.push(`${key} = $${idx++}`);
        values.push(value);
      }

      if (fields.length > 0) {
        values.push(userId);
        await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = $${idx}`, values);
      }
    }
    return this.get(userId);
  }
};

/**
 * Groups Data Wrapper
 */
export const groupsData = {
  async get(groupId) {
    const res = await pool.query('SELECT * FROM groups WHERE id = $1', [groupId]);
    if (res.rows.length > 0) return res.rows[0];
    return { id: groupId, settings: {}, data: {} }; // Return default, insert on first save
  },

  async set(groupId, updateData) {
    const exists = await pool.query('SELECT 1 FROM groups WHERE id = $1', [groupId]);

    if (exists.rowCount === 0) {
      const { settings = {}, data = {} } = updateData;
      await pool.query(
        'INSERT INTO groups (id, settings, data) VALUES ($1, $2, $3)',
        [groupId, settings, data]
      );
    } else {
      const fields = [];
      const values = [];
      let idx = 1;

      for (const [key, value] of Object.entries(updateData)) {
        if (key === 'id') continue;
        fields.push(`${key} = $${idx++}`);
        values.push(value);
      }

      if (fields.length > 0) {
        values.push(groupId);
        await pool.query(`UPDATE groups SET ${fields.join(', ')} WHERE id = $${idx}`, values);
      }
    }
    return this.get(groupId);
  }
};
