import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const Database = require('better-sqlite3')

test('Selah Moments: Migration V8, Words for the Soul, Reflections, and Reminders', async (t) => {
  const db = new Database(':memory:')

  // Create base schema up to V7
  db.exec(`
    CREATE TABLE schema_version (version INTEGER PRIMARY KEY);
    INSERT INTO schema_version (version) VALUES (7);

    CREATE TABLE tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL
    );
  `)

  await t.test('Migration V8 creates all four moments tables and indices safely', () => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS selah_moments_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        message TEXT NOT NULL,
        source_type TEXT NOT NULL DEFAULT 'original',
        scripture_ref TEXT,
        is_favorite INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS selah_moments_prompts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        question TEXT NOT NULL,
        day_hint TEXT,
        theme TEXT
      );

      CREATE TABLE IF NOT EXISTS selah_moments_reflections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        week_key TEXT NOT NULL,
        date_key TEXT NOT NULL,
        prompt_id INTEGER,
        prompt_question TEXT NOT NULL,
        category TEXT NOT NULL,
        response_text TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS selah_moments_reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'General',
        is_pinned INTEGER NOT NULL DEFAULT 0,
        is_favorite INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_moments_reflections_week ON selah_moments_reflections(week_key);
      CREATE INDEX IF NOT EXISTS idx_moments_reflections_date ON selah_moments_reflections(date_key);
      CREATE INDEX IF NOT EXISTS idx_moments_messages_category ON selah_moments_messages(category);
      CREATE INDEX IF NOT EXISTS idx_moments_reminders_pinned ON selah_moments_reminders(is_pinned, updated_at);

      INSERT OR REPLACE INTO schema_version (version) VALUES (8);
    `)

    const versionRow = db.prepare('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1').get()
    assert.equal(versionRow.version, 8)

    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name)
    assert.ok(tables.includes('selah_moments_messages'))
    assert.ok(tables.includes('selah_moments_prompts'))
    assert.ok(tables.includes('selah_moments_reflections'))
    assert.ok(tables.includes('selah_moments_reminders'))
  })

  await t.test('Words for the Soul: seed messages, category filtering, scripture attribution, and favorites', () => {
    const seedMessages = [
      { cat: 'Self-worth and confidence', msg: 'Your worth is not determined by how much you accomplish.', type: 'original', ref: null },
      { cat: 'Self-worth and confidence', msg: 'I praise you because I am fearfully and wonderfully made; your works are wonderful, I know that full well.', type: 'scripture', ref: 'Psalm 139:14' },
      { cat: 'Faith and spirituality', msg: 'Be still, and know that I am God.', type: 'scripture', ref: 'Psalm 46:10' },
      { cat: 'Patience and personal growth', msg: 'You are allowed to grow at your own pace.', type: 'original', ref: null },
      { cat: 'Resilience and overcoming difficulties', msg: 'Sometimes, beginning again is an act of courage.', type: 'original', ref: null },
      { cat: 'Rest and self-compassion', msg: 'Rest is not a reward for exhaustion. It is part of being human.', type: 'original', ref: null },
      { cat: 'Discipline and consistency', msg: 'Small, quiet daily efforts compound into extraordinary transformations.', type: 'original', ref: null },
      { cat: 'Gratitude and appreciation', msg: 'This is the day which the LORD hath made; we will rejoice and be glad in it.', type: 'scripture', ref: 'Psalm 118:24' },
      { cat: 'Hope and new beginnings', msg: 'Every morning is a clean canvas.', type: 'original', ref: null },
      { cat: 'Relationships and kindness', msg: 'A quiet word of appreciation can lighten someone’s entire week.', type: 'original', ref: null }
    ]

    const insertMsg = db.prepare(`
      INSERT INTO selah_moments_messages (category, message, source_type, scripture_ref)
      VALUES (?, ?, ?, ?)
    `)
    for (const m of seedMessages) {
      insertMsg.run(m.cat, m.msg, m.type, m.ref)
    }

    // Verify all 10 categories/messages seeded
    const all = db.prepare('SELECT * FROM selah_moments_messages').all()
    assert.equal(all.length, 10)

    // Verify category query
    const faith = db.prepare('SELECT * FROM selah_moments_messages WHERE category = ?').all('Faith and spirituality')
    assert.equal(faith.length, 1)
    assert.equal(faith[0].source_type, 'scripture')
    assert.equal(faith[0].scripture_ref, 'Psalm 46:10')

    // Verify toggle favorite
    db.prepare('UPDATE selah_moments_messages SET is_favorite = 1 WHERE id = ?').run(faith[0].id)
    const favs = db.prepare('SELECT * FROM selah_moments_messages WHERE is_favorite = 1').all()
    assert.equal(favs.length, 1)
    assert.equal(favs[0].id, faith[0].id)

    // Toggle off
    db.prepare('UPDATE selah_moments_messages SET is_favorite = 0 WHERE id = ?').run(faith[0].id)
    const favsAfter = db.prepare('SELECT * FROM selah_moments_messages WHERE is_favorite = 1').all()
    assert.equal(favsAfter.length, 0)
  })

  await t.test('Weekly Reflections: prompts, saving reflections, editing, history, and gentle deletion', () => {
    // Insert reflection prompts
    const insertPrompt = db.prepare(`
      INSERT INTO selah_moments_prompts (category, question, day_hint, theme)
      VALUES (?, ?, ?, ?)
    `)
    insertPrompt.run('Personal growth', 'What did you learn about yourself this week?', 'monday', 'A New Beginning')
    insertPrompt.run('Gratitude', 'What made you genuinely happy this week?', 'friday', 'Gratitude and Wins')

    const prompts = db.prepare('SELECT * FROM selah_moments_prompts').all()
    assert.equal(prompts.length, 2)

    // Save reflection for current week
    const nowIso = new Date().toISOString()
    const insertRefl = db.prepare(`
      INSERT INTO selah_moments_reflections (week_key, date_key, prompt_id, prompt_question, category, response_text, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const res = insertRefl.run(
      '2026-W46',
      '2026-11-16',
      prompts[0].id,
      prompts[0].question,
      'Personal growth',
      'I learned that I focus much better when I take quiet breaks instead of pushing through exhaustion.',
      nowIso,
      nowIso
    )

    const savedId = res.lastInsertRowid
    const reflection = db.prepare('SELECT * FROM selah_moments_reflections WHERE id = ?').get(savedId)
    assert.ok(reflection)
    assert.equal(reflection.week_key, '2026-W46')
    assert.ok(reflection.response_text.includes('quiet breaks'))

    // Edit reflection
    db.prepare('UPDATE selah_moments_reflections SET response_text = ?, updated_at = ? WHERE id = ?')
      .run('Updated response text with deeper reflection.', new Date().toISOString(), savedId)

    const updated = db.prepare('SELECT * FROM selah_moments_reflections WHERE id = ?').get(savedId)
    assert.equal(updated.response_text, 'Updated response text with deeper reflection.')

    // List by week
    const weekReflections = db.prepare('SELECT * FROM selah_moments_reflections WHERE week_key = ?').all('2026-W46')
    assert.equal(weekReflections.length, 1)

    // Delete reflection
    db.prepare('DELETE FROM selah_moments_reflections WHERE id = ?').run(savedId)
    const afterDelete = db.prepare('SELECT * FROM selah_moments_reflections WHERE id = ?').get(savedId)
    assert.equal(afterDelete, undefined)
  })

  await t.test('My Little Reminders: CRUD, pinning to top, searching, and category filtering', () => {
    const insertRem = db.prepare(`
      INSERT INTO selah_moments_reminders (title, content, category, is_pinned, is_favorite, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    const nowIso = new Date().toISOString()
    insertRem.run('Grace Over Perfection', 'Remember that mistakes are how you learn.', 'Personal Affirmation', 0, 1, nowIso, nowIso)
    insertRem.run('Philippians 4:13', 'I can do all things through Christ which strengtheneth me.', 'Bible Verse', 1, 0, nowIso, nowIso)
    insertRem.run('Exam Season Grounding', 'Breathe deeply. One question at a time.', 'For Difficult Days', 0, 0, nowIso, nowIso)

    // Query ordered by pinned DESC
    const list = db.prepare('SELECT * FROM selah_moments_reminders ORDER BY is_pinned DESC, id ASC').all()
    assert.equal(list.length, 3)
    assert.equal(list[0].title, 'Philippians 4:13') // Pinned comes first
    assert.equal(list[0].is_pinned, 1)

    // Search query
    const searchResult = db.prepare("SELECT * FROM selah_moments_reminders WHERE title LIKE '%Grace%' OR content LIKE '%Grace%'").all()
    assert.equal(searchResult.length, 1)
    assert.equal(searchResult[0].title, 'Grace Over Perfection')

    // Category query
    const bibleVerses = db.prepare('SELECT * FROM selah_moments_reminders WHERE category = ?').all('Bible Verse')
    assert.equal(bibleVerses.length, 1)

    // Update reminder
    db.prepare('UPDATE selah_moments_reminders SET title = ?, is_pinned = 1 WHERE id = ?').run('Grace & Patience Over Perfection', searchResult[0].id)
    const updated = db.prepare('SELECT * FROM selah_moments_reminders WHERE id = ?').get(searchResult[0].id)
    assert.equal(updated.title, 'Grace & Patience Over Perfection')
    assert.equal(updated.is_pinned, 1)

    // Delete reminder
    db.prepare('DELETE FROM selah_moments_reminders WHERE id = ?').run(searchResult[0].id)
    const count = db.prepare('SELECT count(*) as count FROM selah_moments_reminders').get().count
    assert.equal(count, 2)
  })
})
