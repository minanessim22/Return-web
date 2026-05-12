import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { statSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const DATA_DIR = path.join(process.cwd(), 'src', 'data');
const JSON_STORE_PATH = path.join(DATA_DIR, 'store.json');
export const SQLITE_DB_PATH = path.join(DATA_DIR, 'return.db');

type TableConfig = {
  key: string;
  name: string;
  createSql: string;
  insertSql: string;
  selectSql: string;
  clearSql: string;
  indexes?: string[];
  project: (item: any) => any[];
};

const TABLES: TableConfig[] = [
  {
    key: 'users',
    name: 'users',
    createSql: `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT,
      username TEXT,
      role TEXT,
      status TEXT,
      updated_at TEXT,
      payload TEXT NOT NULL
    )`,
    insertSql: 'INSERT OR REPLACE INTO users (id,name,email,username,role,status,updated_at,payload) VALUES (?,?,?,?,?,?,?,?)',
    selectSql: 'SELECT payload FROM users ORDER BY updated_at DESC, id DESC',
    clearSql: 'DELETE FROM users',
    project: (item) => [item.id, item.name || '', item.email || '', item.username || '', item.role || '', item.status || '', item.updatedAt || item.createdAt || '', JSON.stringify(item)],
    indexes: ['CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)', 'CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)', 'CREATE INDEX IF NOT EXISTS idx_users_status ON users(status)']
  },
  {
    key: 'sessions',
    name: 'sessions',
    createSql: `CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      expires_at TEXT,
      last_seen_at TEXT,
      updated_at TEXT,
      payload TEXT NOT NULL
    )`,
    insertSql: 'INSERT OR REPLACE INTO sessions (id,user_id,expires_at,last_seen_at,updated_at,payload) VALUES (?,?,?,?,?,?)',
    selectSql: 'SELECT payload FROM sessions ORDER BY updated_at DESC, id DESC',
    clearSql: 'DELETE FROM sessions',
    project: (item) => [item.id, item.userId || '', item.expiresAt || '', item.lastSeenAt || '', item.lastSeenAt || item.createdAt || '', JSON.stringify(item)],
    indexes: ['CREATE INDEX IF NOT EXISTS idx_sessions_user_expires ON sessions(user_id, expires_at)', 'CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)']
  },
  {
    key: 'verificationRequests',
    name: 'verification_requests',
    createSql: `CREATE TABLE IF NOT EXISTS verification_requests (
      id TEXT PRIMARY KEY,
      email TEXT,
      purpose TEXT,
      expires_at TEXT,
      consumed_at TEXT,
      updated_at TEXT,
      payload TEXT NOT NULL
    )`,
    insertSql: 'INSERT OR REPLACE INTO verification_requests (id,email,purpose,expires_at,consumed_at,updated_at,payload) VALUES (?,?,?,?,?,?,?)',
    selectSql: 'SELECT payload FROM verification_requests ORDER BY updated_at DESC, id DESC',
    clearSql: 'DELETE FROM verification_requests',
    project: (item) => [item.id, item.email || '', item.purpose || '', item.expiresAt || '', item.consumedAt || '', item.consumedAt || item.createdAt || '', JSON.stringify(item)],
    indexes: ['CREATE INDEX IF NOT EXISTS idx_verification_email_purpose ON verification_requests(email, purpose)', 'CREATE INDEX IF NOT EXISTS idx_verification_expires ON verification_requests(expires_at)']
  },
  {
    key: 'cases',
    name: 'cases',
    createSql: `CREATE TABLE IF NOT EXISTS cases (
      id TEXT PRIMARY KEY,
      reference_code TEXT,
      owner_user_id TEXT,
      type TEXT,
      status TEXT,
      category TEXT,
      display_name TEXT,
      updated_at TEXT,
      payload TEXT NOT NULL
    )`,
    insertSql: 'INSERT OR REPLACE INTO cases (id,reference_code,owner_user_id,type,status,category,display_name,updated_at,payload) VALUES (?,?,?,?,?,?,?,?,?)',
    selectSql: 'SELECT payload FROM cases ORDER BY updated_at DESC, id DESC',
    clearSql: 'DELETE FROM cases',
    project: (item) => [item.id, item.referenceCode || '', item.ownerUserId || '', item.type || '', item.status || '', item.category || '', item.fullName || item.estimatedName || item.displayName || '', item.updatedAt || item.createdAt || '', JSON.stringify(item)],
    indexes: ['CREATE INDEX IF NOT EXISTS idx_cases_owner_status ON cases(owner_user_id, status)', 'CREATE INDEX IF NOT EXISTS idx_cases_type_status ON cases(type, status)', 'CREATE INDEX IF NOT EXISTS idx_cases_reference_code ON cases(reference_code)']
  },
  {
    key: 'matches',
    name: 'matches',
    createSql: `CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      case_id TEXT,
      other_case_id TEXT,
      score REAL,
      status TEXT,
      updated_at TEXT,
      payload TEXT NOT NULL
    )`,
    insertSql: 'INSERT OR REPLACE INTO matches (id,case_id,other_case_id,score,status,updated_at,payload) VALUES (?,?,?,?,?,?,?)',
    selectSql: 'SELECT payload FROM matches ORDER BY updated_at DESC, id DESC',
    clearSql: 'DELETE FROM matches',
    project: (item) => [item.id, item.caseId || '', item.otherCaseId || '', Number(item.score || 0), item.status || '', item.confirmedAt || item.createdAt || '', JSON.stringify(item)],
    indexes: ['CREATE INDEX IF NOT EXISTS idx_matches_case_status ON matches(case_id, status)', 'CREATE INDEX IF NOT EXISTS idx_matches_other_case_status ON matches(other_case_id, status)', 'CREATE INDEX IF NOT EXISTS idx_matches_score ON matches(score DESC)']
  },
  {
    key: 'notifications',
    name: 'notifications',
    createSql: `CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      title TEXT,
      type TEXT,
      is_read INTEGER,
      updated_at TEXT,
      payload TEXT NOT NULL
    )`,
    insertSql: 'INSERT OR REPLACE INTO notifications (id,user_id,title,type,is_read,updated_at,payload) VALUES (?,?,?,?,?,?,?)',
    selectSql: 'SELECT payload FROM notifications ORDER BY updated_at DESC, id DESC',
    clearSql: 'DELETE FROM notifications',
    project: (item) => [item.id, item.userId || '', item.title || '', item.type || '', item.isRead ? 1 : 0, item.readAt || item.createdAt || '', JSON.stringify(item)],
    indexes: ['CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read)', 'CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type)']
  },
  {
    key: 'devices',
    name: 'devices',
    createSql: `CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      owner_user_id TEXT,
      type TEXT,
      label TEXT,
      status TEXT,
      linked_profile_id TEXT,
      updated_at TEXT,
      payload TEXT NOT NULL
    )`,
    insertSql: 'INSERT OR REPLACE INTO devices (id,owner_user_id,type,label,status,linked_profile_id,updated_at,payload) VALUES (?,?,?,?,?,?,?,?)',
    selectSql: 'SELECT payload FROM devices ORDER BY updated_at DESC, id DESC',
    clearSql: 'DELETE FROM devices',
    project: (item) => [item.id, item.ownerUserId || '', item.type || '', item.label || '', item.status || '', item.linkedProfileId || '', item.updatedAt || item.createdAt || '', JSON.stringify(item)],
    indexes: ['CREATE INDEX IF NOT EXISTS idx_devices_owner_status ON devices(owner_user_id, status)', 'CREATE INDEX IF NOT EXISTS idx_devices_profile ON devices(linked_profile_id)']
  },
  {
    key: 'identificationProfiles',
    name: 'identification_profiles',
    createSql: `CREATE TABLE IF NOT EXISTS identification_profiles (
      id TEXT PRIMARY KEY,
      owner_user_id TEXT,
      display_name TEXT,
      category TEXT,
      qr_public_token TEXT,
      is_active INTEGER,
      updated_at TEXT,
      payload TEXT NOT NULL
    )`,
    insertSql: 'INSERT OR REPLACE INTO identification_profiles (id,owner_user_id,display_name,category,qr_public_token,is_active,updated_at,payload) VALUES (?,?,?,?,?,?,?,?)',
    selectSql: 'SELECT payload FROM identification_profiles ORDER BY updated_at DESC, id DESC',
    clearSql: 'DELETE FROM identification_profiles',
    project: (item) => [item.id, item.ownerUserId || '', item.displayName || '', item.category || '', item.qrPublicToken || '', item.isActive ? 1 : 0, item.updatedAt || item.createdAt || '', JSON.stringify(item)],
    indexes: ['CREATE INDEX IF NOT EXISTS idx_profiles_owner_active ON identification_profiles(owner_user_id, is_active)', 'CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_qr_token ON identification_profiles(qr_public_token)']
  },
  {
    key: 'scanEvents',
    name: 'scan_events',
    createSql: `CREATE TABLE IF NOT EXISTS scan_events (
      id TEXT PRIMARY KEY,
      profile_id TEXT,
      type TEXT,
      created_at TEXT,
      payload TEXT NOT NULL
    )`,
    insertSql: 'INSERT OR REPLACE INTO scan_events (id,profile_id,type,created_at,payload) VALUES (?,?,?,?,?)',
    selectSql: 'SELECT payload FROM scan_events ORDER BY created_at DESC, id DESC',
    clearSql: 'DELETE FROM scan_events',
    project: (item) => [item.id, item.profileId || '', item.type || '', item.createdAt || '', JSON.stringify(item)],
    indexes: ['CREATE INDEX IF NOT EXISTS idx_scan_events_profile_created ON scan_events(profile_id, created_at DESC)']
  },
  {
    key: 'auditLogs',
    name: 'audit_logs',
    createSql: `CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      event TEXT,
      severity TEXT,
      user_id TEXT,
      created_at TEXT,
      payload TEXT NOT NULL
    )`,
    insertSql: 'INSERT OR REPLACE INTO audit_logs (id,event,severity,user_id,created_at,payload) VALUES (?,?,?,?,?,?)',
    selectSql: 'SELECT payload FROM audit_logs ORDER BY created_at DESC, id DESC',
    clearSql: 'DELETE FROM audit_logs',
    project: (item) => [item.id, item.event || '', item.severity || '', item.userId || '', item.createdAt || '', JSON.stringify(item)],
    indexes: ['CREATE INDEX IF NOT EXISTS idx_audit_logs_event_created ON audit_logs(event, created_at DESC)', 'CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created ON audit_logs(user_id, created_at DESC)']
  },
  {
    key: 'conversations',
    name: 'conversations',
    createSql: `CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      created_by_user_id TEXT,
      title TEXT,
      related_case_id TEXT,
      related_match_id TEXT,
      updated_at TEXT,
      payload TEXT NOT NULL
    )`,
    insertSql: 'INSERT OR REPLACE INTO conversations (id,created_by_user_id,title,related_case_id,related_match_id,updated_at,payload) VALUES (?,?,?,?,?,?,?)',
    selectSql: 'SELECT payload FROM conversations ORDER BY updated_at DESC, id DESC',
    clearSql: 'DELETE FROM conversations',
    project: (item) => [item.id, item.createdByUserId || '', item.title || '', item.relatedCaseId || '', item.relatedMatchId || '', item.updatedAt || item.createdAt || '', JSON.stringify(item)],
    indexes: ['CREATE INDEX IF NOT EXISTS idx_conversations_creator_updated ON conversations(created_by_user_id, updated_at DESC)', 'CREATE INDEX IF NOT EXISTS idx_conversations_match ON conversations(related_match_id)']
  }
];

let db: DatabaseSync | null = null;
let initialized = false;

function openDb() {
  mkdirSync(DATA_DIR, { recursive: true });
  if (!db) {
    db = new DatabaseSync(SQLITE_DB_PATH);
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA synchronous = NORMAL;');
    db.exec('PRAGMA busy_timeout = 5000;');
    db.exec('PRAGMA foreign_keys = OFF;');
  }
  return db;
}

function ensureSchema() {
  const database = openDb();
  for (const table of TABLES) {
    database.exec(table.createSql);
    for (const indexSql of table.indexes || []) {
      database.exec(indexSql);
    }
  }
}

function getTotalRows(database: DatabaseSync) {
  let total = 0;
  for (const table of TABLES) {
    const row = database.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get() as { count: number };
    total += Number(row?.count || 0);
  }
  return total;
}

function importJsonStore(database: DatabaseSync) {
  if (!existsSync(JSON_STORE_PATH)) return;
  try {
    const raw = JSON.parse(readFileSync(JSON_STORE_PATH, 'utf-8'));
    persistRawStore(database, raw, false);
  } catch (error) {
    console.warn('Unable to import legacy JSON store into SQLite.', error);
  }
}

export function ensureSqliteReady() {
  if (initialized) return openDb();
  const database = openDb();
  ensureSchema();
  if (getTotalRows(database) === 0) {
    importJsonStore(database);
  }
  initialized = true;
  return database;
}

export function readRawStoreFromSqlite() {
  const database = ensureSqliteReady();
  const result: Record<string, any[]> = {};
  for (const table of TABLES) {
    const rows = database.prepare(table.selectSql).all() as Array<{ payload: string }>;
    result[table.key] = rows.map((row) => {
      try {
        return JSON.parse(row.payload);
      } catch {
        return null;
      }
    }).filter(Boolean);
  }
  return result;
}

function persistRawStore(database: DatabaseSync, store: Record<string, any>, backupJson = true) {
  database.exec('BEGIN');
  try {
    for (const table of TABLES) {
      database.exec(table.clearSql);
      const items = Array.isArray(store?.[table.key]) ? store[table.key] : [];
      if (items.length === 0) continue;
      const statement = database.prepare(table.insertSql);
      for (const item of items) {
        statement.run(...table.project(item));
      }
    }
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }

  if (backupJson) {
    try {
      writeFileSync(JSON_STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
    } catch (error) {
      console.warn('Unable to write JSON backup for SQLite store.', error);
    }
  }
}

export function writeRawStoreToSqlite(store: Record<string, any>, backupJson = true) {
  const database = ensureSqliteReady();
  persistRawStore(database, store, backupJson);
}

export function listSqliteTables() {
  ensureSqliteReady();
  return TABLES.map((table) => {
    const columns = openDb().prepare(`PRAGMA table_info(${table.name})`).all() as Array<{ name: string; type: string }>;
    const countRow = openDb().prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get() as { count: number };
    return {
      name: table.name,
      storeKey: table.key,
      count: Number(countRow?.count || 0),
      columns: columns.map((column) => ({ name: column.name, type: column.type }))
    };
  });
}

export function readSqliteTable(tableName: string, limit = 100, offset = 0) {
  ensureSqliteReady();
  const table = TABLES.find((entry) => entry.name === tableName || entry.key === tableName);
  if (!table) {
    throw new Error('TABLE_NOT_FOUND');
  }

  const rows = openDb().prepare(`SELECT * FROM ${table.name} ORDER BY ROWID DESC LIMIT ? OFFSET ?`).all(limit, offset) as Array<Record<string, unknown>>;
  return {
    table: table.name,
    rows: rows.map((row) => {
      const payload = typeof row.payload === 'string' ? safeJson(row.payload) : undefined;
      return {
        ...row,
        payload,
        payloadPreview: payload && typeof payload === 'object' ? buildPayloadPreview(payload as Record<string, any>) : undefined
      };
    })
  };
}

function safeJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function buildPayloadPreview(payload: Record<string, any>) {
  const preview: Record<string, unknown> = {};
  for (const key of ['id', 'name', 'email', 'username', 'referenceCode', 'type', 'status', 'category', 'displayName', 'title', 'body', 'label', 'score', 'updatedAt', 'createdAt']) {
    if (payload[key] !== undefined) preview[key] = payload[key];
  }
  return preview;
}


export function getSqliteHealth() {
  const database = ensureSqliteReady();
  const fileStats = existsSync(SQLITE_DB_PATH) ? statSync(SQLITE_DB_PATH) : null;
  return {
    file: path.relative(process.cwd(), SQLITE_DB_PATH),
    sizeBytes: fileStats?.size || 0,
    totalRows: getTotalRows(database),
    walEnabled: true,
    indexedTables: TABLES.filter((table) => (table.indexes || []).length > 0).map((table) => table.name)
  };
}
