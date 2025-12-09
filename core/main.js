import { starter } from './system/starter.js';
import { install } from './utility/install.js';
import log from './utility/log.js';
import { getSettings, setSettings } from './utility/genset.js';
import { db, usersData, groupsData } from './system/database.js'; // [NEW] Import Database
import fs from 'fs';

// --- 1. Global Error Handling ---
const catchError = (ctx, err) => log.error(`${ctx}:\n${err?.stack || err}`);

process
  .on('unhandledRejection', (err) => catchError('Unhandled Rejection', err))
  .on('uncaughtException', (err) => catchError('Uncaught Exception', err));

// --- 2. Global State Initialization ---
global.log = log;

// Load API keys
let api = {};
try {
  if (fs.existsSync('./json/api.json')) {
    api = JSON.parse(fs.readFileSync('./json/api.json', 'utf8'));
  } else {
    log.error('API file (./json/api.json) is missing.');
  }
} catch (e) {
  log.error('Error parsing API file:', e.message);
}

// Load Command Settings
let cmdset = {};
try {
  if (fs.existsSync('./json/cmdset.json')) {
    // [FIX] Changed 'api =' to 'cmdset =' to prevent overwriting
    cmdset = JSON.parse(fs.readFileSync('./json/cmdset.json', 'utf8'));
  } else {
    log.error('Commands Settings file (./json/cmdset.json) is missing.');
  }
} catch (e) {
  log.error('Error parsing Commands Settings file:', e.message);
}

// PERFORMANCE FIX: Load settings into memory ONCE
let runtimeSettings = getSettings();

global.paldea = {
  // Getter returns the cached memory object (Fast)
  get settings() { 
    return runtimeSettings; 
  },

  // Setter updates disk AND updates the cached memory object
  set settings(partialConfig) { 
    // setSettings returns the fully merged object
    runtimeSettings = setSettings(partialConfig); 
  },

  commands:  new Map(),
  events:    new Map(),
  cooldowns: new Map(),
  callbacks: new Map(),
  replies:   new Map(),
  instances: new Map(),
  tokens:    [],
  cmdset:    cmdset,
  api:       api,
};
  // [NEW] Database Access Layer
  // Attaching here allows access throughout the bot without extra imports
 global.db = {
    users: usersData,
    groups: groupsData
};

// Extend Paldea with Dynamic Getters
Object.assign(global.paldea, {
  get prefix() { return global.paldea.settings.prefix; },
  get subprefix() { return global.paldea.settings.subprefix; },
  get developers() { return global.paldea.settings.developers; },
  get vip() { return global.paldea.settings.vip; }
});

// --- 3. System Boot ---

async function main() {
  try {
    // [NEW] 1. Connect to NeonDB before starting the bot
    // This ensures schema is synced and DB is ready for commands
    await db.connect();

    // 2. Start the Bot Logic
    await starter();

    // 3. Install Utilities
    await install(global.log);

  } catch (err) {
    log.error('CRITICAL SYSTEM FAILURE:', err);
    process.exit(1);
  }
}

main();
