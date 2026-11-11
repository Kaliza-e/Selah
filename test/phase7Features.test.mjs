import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const Database = require('better-sqlite3')

function computeNextRecurrenceDate(fromDateStr, rule) {
  const base = fromDateStr && /^\d{4}-\d{2}-\d{2}$/.test(fromDateStr)
    ? new Date(`${fromDateStr}T12:00:00`)
    : new Date()
  const next = new Date(base)

  if (rule === 'daily') {
    next.setDate(next.getDate() + 1)
  } else if (rule === 'weekdays') {
    do {
      next.setDate(next.getDate() + 1)
    } while (next.getDay() === 0 || next.getDay() === 6)
  } else if (rule === 'weekly') {
    next.setDate(next.getDate() + 7)
  } else if (rule === 'monthly') {
    next.setMonth(next.getMonth() + 1)
  } else {
    return null
  }

  const y = next.getFullYear()
  const m = String(next.getMonth() + 1).padStart(2, '0')
  const d = String(next.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function resolveEffectiveTheme(pref, systemPrefersDark) {
  if (pref === 'system') return systemPrefersDark ? 'dark' : 'light'
  return pref
}

test('Recurrence next date calculation (Phase 7)', async (t) => {
  await t.test('calculates daily, weekdays, weekly, and monthly occurrences', () => {
    assert.equal(computeNextRecurrenceDate('2026-11-11', 'daily'), '2026-11-12')
    // 2026-11-13 is Friday -> next weekday is Monday 2026-11-16
    assert.equal(computeNextRecurrenceDate('2026-11-13', 'weekdays'), '2026-11-16')
    assert.equal(computeNextRecurrenceDate('2026-11-11', 'weekly'), '2026-11-18')
    assert.equal(computeNextRecurrenceDate('2026-11-11', 'monthly'), '2026-12-11')
    assert.equal(computeNextRecurrenceDate('2026-11-11', 'unknown'), null)
  })
})

test('SQLite V7: Recurrence, Subtasks, and Overdue Rollover', () => {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      due_date TEXT,
      completed INTEGER NOT NULL DEFAULT 0,
      recurrence_rule TEXT,
      subtasks TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `)

  const insert = db.prepare('INSERT INTO tasks (title, due_date, completed, recurrence_rule, subtasks) VALUES (?, ?, ?, ?, ?)')
  insert.run('Overdue Report', '2026-11-08', 0, null, null)
  insert.run('Old Completed Task', '2026-11-05', 1, null, null)
  insert.run('Future Task', '2026-11-15', 0, null, null)
  insert.run(
    'Weekly Review',
    '2026-11-11',
    0,
    'weekly',
    JSON.stringify([
      { id: '1', title: 'Check notes', done: true },
      { id: '2', title: 'Plan next week', done: false }
    ])
  )

  // Overdue rollover to today (2026-11-11)
  const rolloverRes = db
    .prepare('UPDATE tasks SET due_date = ? WHERE completed = 0 AND due_date IS NOT NULL AND due_date < ?')
    .run('2026-11-11', '2026-11-11')
  assert.equal(rolloverRes.changes, 1)

  const overdueMoved = db.prepare('SELECT due_date FROM tasks WHERE title = ?').get('Overdue Report')
  assert.equal(overdueMoved.due_date, '2026-11-11')

  const completedUntouched = db.prepare('SELECT due_date FROM tasks WHERE title = ?').get('Old Completed Task')
  assert.equal(completedUntouched.due_date, '2026-11-05')

  const futureUntouched = db.prepare('SELECT due_date FROM tasks WHERE title = ?').get('Future Task')
  assert.equal(futureUntouched.due_date, '2026-11-15')

  // Completing recurring task spawns next occurrence with reset subtasks
  const recurring = db.prepare('SELECT * FROM tasks WHERE title = ?').get('Weekly Review')
  const parsedSubtasks = JSON.parse(recurring.subtasks).map(s => ({ ...s, done: false }))
  const nextDue = computeNextRecurrenceDate(recurring.due_date, recurring.recurrence_rule)
  assert.equal(nextDue, '2026-11-18')
  insert.run(recurring.title, nextDue, 0, recurring.recurrence_rule, JSON.stringify(parsedSubtasks))

  const nextTask = db.prepare('SELECT * FROM tasks WHERE due_date = ? AND title = ?').get('2026-11-18', 'Weekly Review')
  assert.ok(nextTask)
  assert.equal(JSON.parse(nextTask.subtasks)[0].done, false)

  db.close()
})

test('Theme resolution respects system mode preference', () => {
  assert.equal(resolveEffectiveTheme('dark', false), 'dark')
  assert.equal(resolveEffectiveTheme('light', true), 'light')
  assert.equal(resolveEffectiveTheme('system', true), 'dark')
  assert.equal(resolveEffectiveTheme('system', false), 'light')
})

