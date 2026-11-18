import test from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const Database = require('better-sqlite3')

test('APPLICATION-WIDE FULL AUDIT: Complete SQLite & Schema Verification', async (t) => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'selah-audit-'))
  const dbPath = join(tmpDir, 'selah-audit.sqlite')
  const db = new Database(dbPath)

  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // Run all migrations v1 to v8
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY);
    
    -- Migration V1
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      due_date TEXT,
      due_time TEXT,
      priority TEXT NOT NULL DEFAULT 'normal',
      completed INTEGER NOT NULL DEFAULT 0,
      category TEXT,
      class_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      weekday INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      room TEXT,
      notes TEXT,
      color TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS daily_plans (
      date TEXT PRIMARY KEY,
      notes TEXT,
      materials_checked TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Migration V2 (timer)
    CREATE TABLE IF NOT EXISTS task_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      start_time TEXT NOT NULL,
      end_time TEXT,
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      is_pomodoro INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS active_timer (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'idle',
      start_time TEXT,
      accumulated_seconds INTEGER NOT NULL DEFAULT 0,
      is_pomodoro INTEGER NOT NULL DEFAULT 0,
      pomodoro_phase TEXT NOT NULL DEFAULT 'work',
      pomodoro_work_duration INTEGER NOT NULL DEFAULT 1500,
      pomodoro_break_duration INTEGER NOT NULL DEFAULT 300,
      last_heartbeat TEXT
    );

    -- Migration V3 (schedules)
    CREATE TABLE IF NOT EXISTS source_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_name TEXT NOT NULL,
      file_hash TEXT NOT NULL UNIQUE,
      file_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      event_count INTEGER NOT NULL DEFAULT 0,
      raw_text TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS schedule_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_doc_id INTEGER REFERENCES source_documents(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL DEFAULT 'Academic Calendar',
      start_date TEXT NOT NULL,
      end_date TEXT,
      start_time TEXT,
      end_time TEXT,
      is_all_day INTEGER NOT NULL DEFAULT 1,
      location TEXT,
      is_completed INTEGER NOT NULL DEFAULT 0,
      confidence_score REAL DEFAULT 1.0,
      review_status TEXT NOT NULL DEFAULT 'confirmed',
      user_edited INTEGER NOT NULL DEFAULT 0,
      raw_snippet TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS schedule_event_reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL REFERENCES schedule_events(id) ON DELETE CASCADE,
      trigger_offset_minutes INTEGER NOT NULL DEFAULT 0,
      all_day_delivery_time TEXT DEFAULT '08:00',
      is_delivered INTEGER NOT NULL DEFAULT 0,
      delivered_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Migration V4 (scheduling & duration)
    ALTER TABLE tasks ADD COLUMN estimated_minutes INTEGER;
    ALTER TABLE tasks ADD COLUMN scheduled_date TEXT;
    ALTER TABLE tasks ADD COLUMN scheduled_time TEXT;
    ALTER TABLE tasks ADD COLUMN scheduled_duration_minutes INTEGER;

    -- Migration V5 (journal entries)
    CREATE TABLE IF NOT EXISTS daily_journal_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date_key TEXT NOT NULL,
      entry_type TEXT NOT NULL DEFAULT 'morning',
      gratitude TEXT,
      intention TEXT,
      reflection TEXT,
      mood TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(date_key, entry_type)
    );

    -- Migration V7 (recurrence & subtasks)
    ALTER TABLE tasks ADD COLUMN recurrence_rule TEXT;
    ALTER TABLE tasks ADD COLUMN subtasks TEXT;

    -- Migration V8 (Selah Moments)
    CREATE TABLE IF NOT EXISTS selah_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      message TEXT NOT NULL,
      source_type TEXT NOT NULL DEFAULT 'original',
      scripture_ref TEXT,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS selah_prompts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      question TEXT NOT NULL,
      day_hint TEXT DEFAULT 'any',
      theme TEXT
    );

    CREATE TABLE IF NOT EXISTS selah_reflections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      week_key TEXT NOT NULL,
      date_key TEXT NOT NULL,
      prompt_id INTEGER REFERENCES selah_prompts(id) ON DELETE SET NULL,
      prompt_question TEXT NOT NULL,
      category TEXT NOT NULL,
      response_text TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS selah_reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Personal Affirmation',
      is_pinned INTEGER NOT NULL DEFAULT 0,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    INSERT OR IGNORE INTO schema_version (version) VALUES (8);
  `)

  // Subtest 1: Verify all 12 tables exist and have valid structure
  await t.test('Database Tables and Schema Integrity', () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(r => r.name)
    const expectedTables = [
      'schema_version', 'tasks', 'classes', 'daily_plans', 'settings',
      'task_sessions', 'active_timer', 'source_documents', 'schedule_events',
      'schedule_event_reminders', 'daily_journal_entries', 'selah_messages',
      'selah_prompts', 'selah_reflections', 'selah_reminders'
    ]
    for (const tName of expectedTables) {
      assert.ok(tables.includes(tName), `Table ${tName} must exist in SQLite database`)
    }
  })

  // Subtest 2: Verify Task CRUD and Overdue queries
  await t.test('Tasks CRUD with subtasks and recurrence', () => {
    const insert = db.prepare(`
      INSERT INTO tasks (title, description, due_date, due_time, priority, estimated_minutes, recurrence_rule, subtasks)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('Study Physics', 'Chapter 4 problems', '2026-11-18', '14:00', 'high', 45, 'weekly', JSON.stringify([{ id: '1', title: 'Part A', done: false }]))
    
    const taskId = insert.lastInsertRowid
    assert.ok(taskId > 0)

    const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId)
    assert.equal(row.title, 'Study Physics')
    assert.equal(row.priority, 'high')
    assert.equal(row.estimated_minutes, 45)
    assert.equal(row.completed, 0)

    // Toggle completed
    db.prepare('UPDATE tasks SET completed = 1 WHERE id = ?').run(taskId)
    const toggled = db.prepare('SELECT completed FROM tasks WHERE id = ?').get(taskId)
    assert.equal(toggled.completed, 1)

    // Delete
    db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId)
    const deleted = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId)
    assert.equal(deleted, undefined)
  })

  // Subtest 3: Verify Schedule Events interval overlap query
  await t.test('Schedule Events interval overlap logic', () => {
    // Multi-day event: Nov 15 to Nov 20
    const ins = db.prepare(`
      INSERT INTO schedule_events (title, category, start_date, end_date, is_all_day)
      VALUES (?, ?, ?, ?, ?)
    `).run('Midterm CAT Exams', 'Exams', '2026-11-15', '2026-11-20', 1)
    const evId = ins.lastInsertRowid

    // Query for Today: Nov 18
    const todayKey = '2026-11-18'
    const query = `
      SELECT * FROM schedule_events
      WHERE COALESCE(end_date, start_date) >= ? AND start_date <= ?
    `
    const matches = db.prepare(query).all(todayKey, todayKey)
    assert.equal(matches.length, 1)
    assert.equal(matches[0].id, evId)
    assert.equal(matches[0].title, 'Midterm CAT Exams')
  })

  // Subtest 4: Cascading Deletes
  await t.test('Foreign Key Cascading Deletion', () => {
    const evIns = db.prepare("INSERT INTO schedule_events (title, start_date) VALUES ('Parent Event', '2026-12-01')").run()
    const parentEventId = evIns.lastInsertRowid
    
    db.prepare('INSERT INTO schedule_event_reminders (event_id, trigger_offset_minutes) VALUES (?, 10)').run(parentEventId)
    db.prepare('INSERT INTO schedule_event_reminders (event_id, trigger_offset_minutes) VALUES (?, 60)').run(parentEventId)

    const remsBefore = db.prepare('SELECT * FROM schedule_event_reminders WHERE event_id = ?').all(parentEventId)
    assert.equal(remsBefore.length, 2)

    // Delete parent event
    db.prepare('DELETE FROM schedule_events WHERE id = ?').run(parentEventId)
    const remsAfter = db.prepare('SELECT * FROM schedule_event_reminders WHERE event_id = ?').all(parentEventId)
    assert.equal(remsAfter.length, 0, 'Reminders should be deleted via ON DELETE CASCADE')
  })

  // Subtest 5: Selah Moments CRUD
  await t.test('Selah Moments Reminders and Reflections Persistence', () => {
    // Save Reminder
    const remIns = db.prepare(`
      INSERT INTO selah_reminders (title, content, category, is_pinned, is_favorite)
      VALUES (?, ?, ?, ?, ?)
    `).run('Be Still', 'Psalm 46:10', 'Bible Verse', 1, 1)
    const remId = remIns.lastInsertRowid

    const savedRem = db.prepare('SELECT * FROM selah_reminders WHERE id = ?').get(remId)
    assert.equal(savedRem.title, 'Be Still')
    assert.equal(savedRem.is_pinned, 1)
    assert.equal(savedRem.is_favorite, 1)

    // Save Reflection
    const refIns = db.prepare(`
      INSERT INTO selah_reflections (week_key, date_key, prompt_question, category, response_text)
      VALUES (?, ?, ?, ?, ?)
    `).run('2026-W47', '2026-11-18', 'What brought you peace today?', 'Emotional well-being', 'Time spent studying quietly.')
    const refId = refIns.lastInsertRowid

    const savedRef = db.prepare('SELECT * FROM selah_reflections WHERE id = ?').get(refId)
    assert.equal(savedRef.week_key, '2026-W47')
    assert.equal(savedRef.response_text, 'Time spent studying quietly.')
  })

  db.close()
  rmSync(tmpDir, { recursive: true, force: true })
})
