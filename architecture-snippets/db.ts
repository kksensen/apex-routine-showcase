// ============================================
// Database — Initialization & Migrations
// ============================================

import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  // Prevent race condition: only one initialization at a time
  if (dbPromise) return dbPromise;
  dbPromise = initDatabase();
  try {
    db = await dbPromise;
    return db;
  } finally {
    dbPromise = null;
  }
}

async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  const database = await SQLite.openDatabaseAsync('rotina.db');
  await runMigrations(database);
  return database;
}

async function runMigrations(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY DEFAULT 1,
      name TEXT NOT NULL,
      photo_uri TEXT,
      day_start_time TEXT DEFAULT '06:00',
      theme TEXT DEFAULT 'auto',
      notifications_enabled INTEGER DEFAULT 1,
      current_streak INTEGER DEFAULT 0,
      longest_streak INTEGER DEFAULT 0,
      energy_points INTEGER DEFAULT 0,
      energy_cap INTEGER DEFAULT 100,
      freezes INTEGER DEFAULT 0,
      last_gamification_date TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT DEFAULT 'outro',
      color TEXT DEFAULT '#6366F1',
      time TEXT,
      duration INTEGER,
      is_apex INTEGER DEFAULT 0,
      energy_cost INTEGER DEFAULT 10,
      specific_date TEXT,
      recurrence_type TEXT CHECK(recurrence_type IN ('daily', 'weekly', 'monthly') OR recurrence_type IS NULL),
      recurrence_days TEXT,
      recurrence_day_of_month INTEGER,
      recurrence_end_date TEXT,
      notification_enabled INTEGER DEFAULT 0,
      notification_minutes_before INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS task_completions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      completion_date TEXT NOT NULL,
      completed_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      UNIQUE(task_id, completion_date)
    );

    CREATE TABLE IF NOT EXISTS recurrence_exceptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      exception_date TEXT NOT NULL,
      is_deleted INTEGER DEFAULT 0,
      modified_title TEXT,
      modified_time TEXT,
      modified_description TEXT,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      UNIQUE(task_id, exception_date)
    );

    CREATE TABLE IF NOT EXISTS daily_apex (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      task_id TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS focus_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      tag_id TEXT,
      category TEXT,
      session_date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      focus_duration INTEGER DEFAULT 0,
      rest_duration INTEGER DEFAULT 0,
      is_completed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_specific_date ON tasks(specific_date);
    CREATE INDEX IF NOT EXISTS idx_tasks_recurrence ON tasks(recurrence_type);
    CREATE INDEX IF NOT EXISTS idx_completions_date ON task_completions(completion_date);
    CREATE INDEX IF NOT EXISTS idx_completions_task ON task_completions(task_id);
    CREATE INDEX IF NOT EXISTS idx_exceptions_task ON recurrence_exceptions(task_id);
    CREATE INDEX IF NOT EXISTS idx_daily_apex_date ON daily_apex(date);
    CREATE INDEX IF NOT EXISTS idx_focus_task ON focus_sessions(task_id);
    CREATE INDEX IF NOT EXISTS idx_focus_date ON focus_sessions(session_date);
    CREATE INDEX IF NOT EXISTS idx_focus_tag ON focus_sessions(tag_id);
  `);

  // ---- Incremental Migrations ----
  // Check if columns exist before adding them (avoids native crash from ALTER TABLE errors)
  await safeAddColumn(database, 'profile', 'energy_cap', 'INTEGER DEFAULT 100');
  await safeAddColumn(database, 'tasks', 'energy_cost', 'INTEGER DEFAULT 10');
  await safeAddColumn(database, 'tasks', 'subject', 'TEXT');
  await safeAddColumn(database, 'tasks', 'is_fixed', 'INTEGER DEFAULT 0');
  await safeAddColumn(database, 'tasks', 'end_time', 'TEXT');
  await safeAddColumn(database, 'tasks', 'recurrence_interval', 'INTEGER DEFAULT 1');
  await safeAddColumn(database, 'tasks', 'tag_id', 'TEXT');
  await safeAddColumn(database, 'profile', 'onboarding_completed', 'INTEGER DEFAULT 0');
  await safeAddColumn(database, 'profile', 'primary_goal', 'TEXT');
  await safeAddColumn(database, 'profile', 'current_state', 'TEXT');
  await safeAddColumn(database, 'profile', 'last_checkin_date', 'TEXT');
  await safeAddColumn(database, 'profile', 'current_energy_level', 'TEXT');

  // V2/V3 updates
  await safeAddColumn(database, 'tasks', 'is_paused', 'INTEGER DEFAULT 0');
  await safeAddColumn(database, 'focus_sessions', 'quality', 'TEXT');
}

/**
 * Safely adds a column to a table if it doesn't exist yet.
 * Uses PRAGMA table_info to check first, avoiding ALTER TABLE errors
 * that can corrupt the native Android SQLite connection state.
 */
async function safeAddColumn(
  database: SQLite.SQLiteDatabase,
  table: string,
  column: string,
  definition: string,
): Promise<void> {
  const rows = await database.getAllAsync<{ name: string }>(
    `PRAGMA table_info(${table})`
  );
  const columnExists = rows.some(row => row.name === column);
  if (!columnExists) {
    await database.execAsync(
      `ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`
    );
  }
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
}
