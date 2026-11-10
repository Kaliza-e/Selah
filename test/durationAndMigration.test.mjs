import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const Database = require('better-sqlite3')

// Pure JS reproduction of duration parsing to verify logic in node test runner
const MAX_DURATION_MINUTES = 24 * 60

function parseDurationString(input) {
  if (input === null || input === undefined) return null
  if (typeof input === 'number') {
    if (isNaN(input) || input <= 0) return null
    const clamped = Math.round(input)
    return clamped <= MAX_DURATION_MINUTES ? clamped : null
  }

  const trimmed = String(input).trim().toLowerCase()
  if (!trimmed) return null

  const decimalHoursMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)$/)
  if (decimalHoursMatch) {
    const hours = parseFloat(decimalHoursMatch[1])
    if (isNaN(hours) || hours <= 0) return null
    const mins = Math.round(hours * 60)
    return mins <= MAX_DURATION_MINUTES ? mins : null
  }

  const hoursMinutesMatch = trimmed.match(/^(\d+)\s*(?:h|hr|hrs|hour|hours)(?:\s*(\d+)\s*(?:m|min|mins|minute|minutes)?)?$/)
  if (hoursMinutesMatch) {
    const hours = parseInt(hoursMinutesMatch[1], 10)
    const mins = hoursMinutesMatch[2] ? parseInt(hoursMinutesMatch[2], 10) : 0
    if (isNaN(hours) || (hours === 0 && mins === 0)) return null
    const total = hours * 60 + mins
    return total <= MAX_DURATION_MINUTES ? total : null
  }

  const minutesMatch = trimmed.match(/^(\d+)\s*(?:m|min|mins|minute|minutes)?$/)
  if (minutesMatch) {
    const mins = parseInt(minutesMatch[1], 10)
    if (isNaN(mins) || mins <= 0) return null
    return mins <= MAX_DURATION_MINUTES ? mins : null
  }

  return null
}

function formatDurationDisplay(minutes) {
  if (!minutes || minutes <= 0) return ''
  const clamped = Math.min(minutes, MAX_DURATION_MINUTES)
  const hrs = Math.floor(clamped / 60)
  const mins = clamped % 60

  if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`
  if (hrs > 0) return `${hrs}h`
  return `${mins}m`
}

test('Duration Parsing and Formatting (Phase 4)', async (t) => {
  await t.test('parses various valid human duration expressions', () => {
    assert.equal(parseDurationString('1h 30m'), 90)
    assert.equal(parseDurationString('1h30m'), 90)
    assert.equal(parseDurationString('45m'), 45)
    assert.equal(parseDurationString('45 mins'), 45)
    assert.equal(parseDurationString('2h'), 120)
    assert.equal(parseDurationString('2 hours'), 120)
    assert.equal(parseDurationString('1.5h'), 90)
    assert.equal(parseDurationString('30'), 30)
    assert.equal(parseDurationString(60), 60)
  })

  await t.test('enforces max 24h limit and rejects negative/invalid input', () => {
    assert.equal(parseDurationString('25h'), null)
    assert.equal(parseDurationString('1500m'), null)
    assert.equal(parseDurationString('-10m'), null)
    assert.equal(parseDurationString('0m'), null)
    assert.equal(parseDurationString('abc'), null)
    assert.equal(parseDurationString(''), null)
  })

  await t.test('formats minutes into concise readable units', () => {
    assert.equal(formatDurationDisplay(15), '15m')
    assert.equal(formatDurationDisplay(60), '1h')
    assert.equal(formatDurationDisplay(90), '1h 30m')
    assert.equal(formatDurationDisplay(120), '2h')
    assert.equal(formatDurationDisplay(150), '2h 30m')
    assert.equal(formatDurationDisplay(null), '')
  })
})

test('Migration V6: Seed Lesson Purge and Clean Slate', () => {
  const db = new Database(':memory:')

  // Setup initial schema
  db.exec(`
    CREATE TABLE schema_version (version INTEGER PRIMARY KEY);
    INSERT INTO schema_version (version) VALUES (5);

    CREATE TABLE classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      weekday INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      room TEXT,
      notes TEXT,
      color TEXT
    );

    CREATE TABLE tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      completed INTEGER DEFAULT 0
    );

    CREATE TABLE settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- Insert mock/seed classes
    INSERT INTO classes (title, weekday, start_time, room) VALUES
      ('Data Structures & Algorithms', 1, '08:30', 'Lab 2'),
      ('Computer Networks', 1, '10:30', 'Room 204'),
      ('Database Systems', 2, '09:00', 'Lab 1'),
      ('Real User Chemistry Class', 3, '14:00', 'Room 101');

    -- Insert user tasks
    INSERT INTO tasks (title) VALUES ('User Real Task 1'), ('User Real Task 2');

    INSERT INTO settings (key, value) VALUES ('has_seeded_lessons', 'true'), ('user_name', 'Student');
  `)

  // Execute Migration V6 logic
  db.exec(`
    DELETE FROM classes 
    WHERE (
      title IN ('Data Structures & Algorithms', 'Computer Networks', 'Database Systems', 'Web Development', 'Discrete Mathematics', 'Software Engineering', 'Sample Subject', 'Physics Sample', 'Sample Lesson')
      AND (room IN ('Lab 1', 'Lab 2', 'Lab 3', 'Room 204', 'Hall A') OR room IS NULL)
    );

    DELETE FROM settings WHERE key IN ('has_seeded_lessons', 'sample_data_initialized', 'seed_imported');

    INSERT OR REPLACE INTO schema_version (version) VALUES (6);
  `)

  // Verify seed classes were removed
  const remainingClasses = db.prepare('SELECT title FROM classes').all()
  assert.equal(remainingClasses.length, 1)
  assert.equal(remainingClasses[0].title, 'Real User Chemistry Class')

  // Verify user tasks are 100% preserved
  const userTasks = db.prepare('SELECT title FROM tasks').all()
  assert.equal(userTasks.length, 2)

  // Verify schema version is updated
  const version = db.prepare('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1').get()
  assert.equal(version.version, 6)

  // Verify setting flag cleaned
  const seedFlag = db.prepare("SELECT value FROM settings WHERE key = 'has_seeded_lessons'").get()
  assert.equal(seedFlag, undefined)
  const userName = db.prepare("SELECT value FROM settings WHERE key = 'user_name'").get()
  assert.equal(userName.value, 'Student')

  db.close()
})
