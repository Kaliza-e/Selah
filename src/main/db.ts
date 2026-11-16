import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'node:path'
import { existsSync, mkdirSync, readFileSync, copyFileSync, readdirSync, unlinkSync } from 'node:fs'
import { encryptAtRest, decryptAtRest } from './security'
import { APP_CONFIG } from '../shared/appConfig'

export interface TaskRecord {
  id: number
  title: string
  description: string | null
  due_date: string | null
  due_time: string | null
  priority: 'low' | 'normal' | 'high'
  completed: number
  category: string | null
  class_id: number | null
  estimated_minutes?: number | null
  scheduled_date?: string | null
  scheduled_time?: string | null
  scheduled_duration_minutes?: number | null
  total_time_spent_seconds?: number
  recurrence_rule?: string | null
  subtasks?: string | null
  created_at: string
}

export interface TaskSessionRecord {
  id: number
  task_id: number
  start_time: string
  end_time: string | null
  duration_seconds: number
  is_pomodoro: number
  created_at: string
}

export interface ActiveTimerRecord {
  id: number
  task_id: number
  status: 'idle' | 'running' | 'paused'
  start_time: string | null
  accumulated_seconds: number
  is_pomodoro: number
  pomodoro_phase: 'work' | 'break'
  pomodoro_work_duration: number
  pomodoro_break_duration: number
  last_heartbeat: string | null
  task_title?: string
  total_time_spent_seconds?: number
}

export interface ClassRecord {
  id: number
  title: string
  weekday: number // 0 = Sun, 1 = Mon, ..., 6 = Sat
  start_time: string // HH:mm
  end_time: string | null // HH:mm
  room: string | null
  notes: string | null
  color?: string | null
  created_at: string
}

export type SubjectRecord = ClassRecord

export interface DailyPlanRecord {
  plan_date: string // YYYY-MM-DD
  notes: string | null
  materials_checked: string | null // JSON array of string ids/names
  created_at: string
  updated_at: string
}

export interface ImportHistoryRecord {
  id: number
  file_name: string
  file_type: string
  imported_count: number
  imported_at: string
}

export type ScheduleCategory =
  | 'Academic Calendar'
  | 'Exams'
  | 'Assignments'
  | 'Applications'
  | 'Events'
  | 'Workshops'
  | 'Meetings'
  | 'Personal'
  | 'Other'

export interface SourceDocumentRecord {
  id: number
  file_hash: string
  file_name: string
  file_type: string
  file_size: number
  event_count: number
  raw_text: string | null
  imported_at: string
}

export interface ScheduleEventRecord {
  id: number
  source_doc_id: number | null
  title: string
  description: string | null
  category: ScheduleCategory
  tags: string | null
  start_date: string // YYYY-MM-DD
  start_time: string | null // HH:mm
  end_date: string | null // YYYY-MM-DD
  end_time: string | null // HH:mm
  is_all_day: number // 0 or 1
  location: string | null
  recurrence_rule: string | null
  source_excerpt: string | null
  source_page: number | null
  confidence: 'high' | 'medium' | 'low'
  review_status: 'confirmed' | 'pending_review' | 'excluded'
  is_completed: number // 0 or 1
  user_edited: number // 0 or 1
  created_at: string
  updated_at: string
  reminders?: EventReminderRecord[]
  source_document_name?: string
}

export type ScheduleEvent = ScheduleEventRecord

export interface EventReminderRecord {
  id: number
  event_id: number
  trigger_offset_minutes: number
  all_day_delivery_time: string
  last_triggered_at: string | null
  is_delivered: number
  created_at: string
}

export interface SelahMessageRecord {
  id: number
  category: string
  message: string
  source_type: 'original' | 'scripture'
  scripture_ref: string | null
  is_favorite: number
  created_at: string
}

export interface SelahPromptRecord {
  id: number
  category: string
  question: string
  day_hint: string | null
  theme: string | null
}

export interface SelahReflectionRecord {
  id: number
  week_key: string
  date_key: string
  prompt_id: number | null
  prompt_question: string
  category: string
  response_text: string
  created_at: string
  updated_at: string
}

export interface SelahReminderRecord {
  id: number
  title: string
  content: string
  category: string
  is_pinned: number
  is_favorite: number
  created_at: string
  updated_at: string
}

let db: Database.Database

// Creates an automated snapshot backup of the current database into userData/backups/
export function createDatabaseBackup(): string | null {
  try {
    const dir = app.getPath('userData')
    let dbPath = join(dir, APP_CONFIG.databaseName)
    if (!existsSync(dbPath)) {
      dbPath = join(dir, 'hello11824.sqlite')
    }
    if (!existsSync(dbPath)) return null

    const backupsDir = join(dir, 'backups')
    if (!existsSync(backupsDir)) {
      mkdirSync(backupsDir, { recursive: true })
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupPath = join(backupsDir, `selah-backup-${timestamp}.sqlite`)
    copyFileSync(dbPath, backupPath)

    // Maintain a rolling window of the last 5 automated backups
    const existing = readdirSync(backupsDir)
      .filter(f => (f.startsWith('selah-backup-') || f.startsWith('hello11824-backup-')) && f.endsWith('.sqlite'))
      .sort()
      .reverse()

    if (existing.length > 5) {
      for (const oldFile of existing.slice(5)) {
        try {
          unlinkSync(join(backupsDir, oldFile))
        } catch {}
      }
    }

    return backupPath
  } catch (err) {
    console.error('Failed to create database backup:', err)
    return null
  }
}

export function getDatabase(): Database.Database {
  if (!db) {
    initDatabase()
  }
  return db
}

export function initDatabase(): Database.Database {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  const dbPath = join(dir, APP_CONFIG.databaseName)
  const prevDbPath = join(dir, 'hello11824.sqlite')
  const legacyDbPath = join(dir, 'daylight.sqlite')
  const prevProdDbPath = join(app.getPath('appData'), 'hello-118-24', 'hello11824.sqlite')

  // Seamless migration from previous databases
  if (!existsSync(dbPath)) {
    if (existsSync(prevDbPath)) {
      try {
        copyFileSync(prevDbPath, dbPath)
      } catch {
        // Continue with fresh database
      }
    } else if (existsSync(prevProdDbPath)) {
      try {
        copyFileSync(prevProdDbPath, dbPath)
      } catch {
        // Continue with fresh database
      }
    } else if (existsSync(legacyDbPath)) {
      try {
        copyFileSync(legacyDbPath, dbPath)
      } catch {
        // Continue with fresh database
      }
    }
  }

  try {
    db = new Database(dbPath)
    // Run integrity check
    const integrity = db.pragma('integrity_check') as Array<{ integrity_check: string }> | undefined
    if (integrity && integrity[0] && integrity[0].integrity_check !== 'ok') {
      console.warn('Database integrity check warning:', integrity)
    }
  } catch (err) {
    console.error('Failed to open database, attempting recovery from latest backup:', err)
    const backupsDir = join(dir, 'backups')
    let recovered = false
    if (existsSync(backupsDir)) {
      const backups = readdirSync(backupsDir)
        .filter(f => (f.startsWith('selah-backup-') || f.startsWith('hello11824-backup-')) && f.endsWith('.sqlite'))
        .sort()
        .reverse()
      if (backups[0]) {
        try {
          copyFileSync(join(backupsDir, backups[0]), dbPath)
          db = new Database(dbPath)
          recovered = true
        } catch {}
      }
    }
    if (!recovered) {
      db = new Database(dbPath)
    }
  }

  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // Create a backup snapshot before migrations
  createDatabaseBackup()

  // Run schema migrations
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    );
  `)

  const currentVersionRow = db.prepare('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1').get() as { version: number } | undefined
  const currentVersion = currentVersionRow?.version ?? 0

  if (currentVersion < 1) {
    db.exec(`
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
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS daily_plans (
        plan_date TEXT PRIMARY KEY,
        notes TEXT,
        materials_checked TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS import_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_name TEXT NOT NULL,
        file_type TEXT NOT NULL,
        imported_count INTEGER NOT NULL,
        imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE VIEW IF NOT EXISTS subjects AS SELECT * FROM classes;

      INSERT OR REPLACE INTO schema_version (version) VALUES (1);
    `)
  }

  if (currentVersion < 2) {
    try {
      const taskCols = db.prepare("PRAGMA table_info(tasks)").all() as Array<{ name: string }>
      if (!taskCols.some(col => col.name === 'estimated_minutes')) {
        db.exec(`ALTER TABLE tasks ADD COLUMN estimated_minutes INTEGER;`)
      }
      db.exec(`INSERT OR REPLACE INTO schema_version (version) VALUES (2);`)
    } catch (err) {
      console.error('Error running migration v2:', err)
    }
  }

  if (currentVersion < 3) {
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS source_documents (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          file_hash TEXT UNIQUE NOT NULL,
          file_name TEXT NOT NULL,
          file_type TEXT NOT NULL,
          file_size INTEGER NOT NULL,
          event_count INTEGER NOT NULL DEFAULT 0,
          raw_text TEXT,
          imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS schedule_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          source_doc_id INTEGER REFERENCES source_documents(id) ON DELETE SET NULL,
          title TEXT NOT NULL,
          description TEXT,
          category TEXT NOT NULL DEFAULT 'Other',
          tags TEXT,
          start_date TEXT NOT NULL,
          start_time TEXT,
          end_date TEXT,
          end_time TEXT,
          is_all_day INTEGER NOT NULL DEFAULT 1,
          location TEXT,
          recurrence_rule TEXT,
          source_excerpt TEXT,
          source_page INTEGER,
          confidence TEXT NOT NULL DEFAULT 'high',
          review_status TEXT NOT NULL DEFAULT 'confirmed',
          is_completed INTEGER NOT NULL DEFAULT 0,
          user_edited INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS event_reminders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          event_id INTEGER NOT NULL REFERENCES schedule_events(id) ON DELETE CASCADE,
          trigger_offset_minutes INTEGER NOT NULL DEFAULT 10,
          all_day_delivery_time TEXT NOT NULL DEFAULT '08:00',
          last_triggered_at TEXT,
          is_delivered INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_schedule_events_start ON schedule_events(start_date, start_time);
        CREATE INDEX IF NOT EXISTS idx_schedule_events_category ON schedule_events(category);
        CREATE INDEX IF NOT EXISTS idx_schedule_events_review ON schedule_events(review_status);
        CREATE INDEX IF NOT EXISTS idx_event_reminders_event ON event_reminders(event_id);

        INSERT OR REPLACE INTO schema_version (version) VALUES (3);
      `)
    } catch (err) {
      console.error('Error running migration v3:', err)
    }
  }

  if (currentVersion < 4) {
    try {
      const taskCols = db.prepare("PRAGMA table_info(tasks)").all() as Array<{ name: string }>
      if (!taskCols.some(col => col.name === 'scheduled_date')) {
        db.exec(`ALTER TABLE tasks ADD COLUMN scheduled_date TEXT;`)
      }
      if (!taskCols.some(col => col.name === 'scheduled_time')) {
        db.exec(`ALTER TABLE tasks ADD COLUMN scheduled_time TEXT;`)
      }
      if (!taskCols.some(col => col.name === 'scheduled_duration_minutes')) {
        db.exec(`ALTER TABLE tasks ADD COLUMN scheduled_duration_minutes INTEGER;`)
      }
      if (!taskCols.some(col => col.name === 'total_time_spent_seconds')) {
        db.exec(`ALTER TABLE tasks ADD COLUMN total_time_spent_seconds INTEGER NOT NULL DEFAULT 0;`)
      }

      db.exec(`
        CREATE TABLE IF NOT EXISTS task_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
          start_time TEXT NOT NULL,
          end_time TEXT,
          duration_seconds INTEGER NOT NULL DEFAULT 0,
          is_pomodoro INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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

        CREATE INDEX IF NOT EXISTS idx_task_sessions_task ON task_sessions(task_id);
        CREATE INDEX IF NOT EXISTS idx_tasks_scheduled ON tasks(scheduled_date, scheduled_time);

        INSERT OR REPLACE INTO schema_version (version) VALUES (4);
      `)
    } catch (err) {
      console.error('Error running migration v4:', err)
    }
  }

  if (currentVersion < 5) {
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS journal_entries (
          entry_date TEXT NOT NULL,
          check_in_type TEXT NOT NULL CHECK(check_in_type IN ('morning', 'evening')),
          gratitude TEXT,
          intention TEXT,
          reflection TEXT,
          mood TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (entry_date, check_in_type)
        );

        INSERT OR REPLACE INTO schema_version (version) VALUES (5);
      `)
    } catch (err) {
      console.error('Error running migration v5:', err)
    }
  }

  if (currentVersion < 6) {
    try {
      // Migration V6: Clean leftover seed/mock lessons and sample timetable content
      // Preserves all user-created tasks, custom schedules, and journal entries
      db.exec(`
        DELETE FROM classes 
        WHERE (
          title IN ('Data Structures & Algorithms', 'Computer Networks', 'Database Systems', 'Web Development', 'Discrete Mathematics', 'Software Engineering', 'Sample Subject', 'Physics Sample', 'Sample Lesson')
          AND (room IN ('Lab 1', 'Lab 2', 'Lab 3', 'Room 204', 'Hall A') OR room IS NULL)
        );

        DELETE FROM settings WHERE key IN ('has_seeded_lessons', 'sample_data_initialized', 'seed_imported');

        INSERT OR REPLACE INTO schema_version (version) VALUES (6);
      `)
    } catch (err) {
      console.error('Error running migration v6:', err)
    }
  }

  if (currentVersion < 7) {
    try {
      const taskCols = db.prepare("PRAGMA table_info(tasks)").all() as Array<{ name: string }>
      if (!taskCols.some(col => col.name === 'recurrence_rule')) {
        db.exec(`ALTER TABLE tasks ADD COLUMN recurrence_rule TEXT;`)
      }
      if (!taskCols.some(col => col.name === 'subtasks')) {
        db.exec(`ALTER TABLE tasks ADD COLUMN subtasks TEXT;`)
      }
      db.exec(`INSERT OR REPLACE INTO schema_version (version) VALUES (7);`)
    } catch (err) {
      console.error('Error running migration v7:', err)
    }
  }

  if (currentVersion < 8) {
    try {
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
      `)

      // Seed encouraging messages if empty
      const msgCount = (db.prepare('SELECT count(*) as count FROM selah_moments_messages').get() as { count: number }).count
      if (msgCount === 0) {
        const seedMessages = [
          // Self-worth and confidence
          { cat: 'Self-worth and confidence', msg: 'Your worth is not determined by how much you accomplish.', type: 'original', ref: null },
          { cat: 'Self-worth and confidence', msg: 'You are more than your achievements.', type: 'original', ref: null },
          { cat: 'Self-worth and confidence', msg: "You don't have to have everything figured out to be making progress.", type: 'original', ref: null },
          { cat: 'Self-worth and confidence', msg: 'Your worth is not measured by your productivity.', type: 'original', ref: null },
          { cat: 'Self-worth and confidence', msg: 'I praise you because I am fearfully and wonderfully made; your works are wonderful, I know that full well.', type: 'scripture', ref: 'Psalm 139:14' },
          { cat: 'Self-worth and confidence', msg: 'For we are God’s handiwork, created in Christ Jesus to do good works, which God prepared in advance for us to do.', type: 'scripture', ref: 'Ephesians 2:10' },

          // Faith and spirituality
          { cat: 'Faith and spirituality', msg: 'Surrender the outcome and focus on being faithful in this moment.', type: 'original', ref: null },
          { cat: 'Faith and spirituality', msg: 'When your steps feel small, remember God works through steady faithfulness.', type: 'original', ref: null },
          { cat: 'Faith and spirituality', msg: 'Be still, and know that I am God: I will be exalted among the heathen, I will be exalted in the earth.', type: 'scripture', ref: 'Psalm 46:10' },
          { cat: 'Faith and spirituality', msg: 'Trust in the LORD with all your heart and lean not on your own understanding; in all your ways submit to him, and he will make your paths straight.', type: 'scripture', ref: 'Proverbs 3:5-6' },
          { cat: 'Faith and spirituality', msg: 'The LORD is my shepherd; I shall not want. He maketh me to lie down in green pastures: he leadeth me beside the still waters.', type: 'scripture', ref: 'Psalm 23:1-2' },

          // Patience and personal growth
          { cat: 'Patience and personal growth', msg: 'You are allowed to grow at your own pace.', type: 'original', ref: null },
          { cat: 'Patience and personal growth', msg: 'Progress does not always have to be visible.', type: 'original', ref: null },
          { cat: 'Patience and personal growth', msg: 'Give yourself the same patience you give other people.', type: 'original', ref: null },
          { cat: 'Patience and personal growth', msg: "You don't need to have everything figured out to take the next step.", type: 'original', ref: null },
          { cat: 'Patience and personal growth', msg: 'To every thing there is a season, and a time to every purpose under the heaven.', type: 'scripture', ref: 'Ecclesiastes 3:1' },
          { cat: 'Patience and personal growth', msg: 'Let perseverance finish its work so that you may be mature and complete, not lacking anything.', type: 'scripture', ref: 'James 1:4' },

          // Resilience and overcoming difficulties
          { cat: 'Resilience and overcoming difficulties', msg: 'Sometimes, beginning again is an act of courage.', type: 'original', ref: null },
          { cat: 'Resilience and overcoming difficulties', msg: 'You have survived difficult days before, and you carry wisdom from every single one of them.', type: 'original', ref: null },
          { cat: 'Resilience and overcoming difficulties', msg: 'Strength is not about never feeling tired; it is continuing with a gentle heart.', type: 'original', ref: null },
          { cat: 'Resilience and overcoming difficulties', msg: 'My grace is sufficient for thee: for my strength is made perfect in weakness.', type: 'scripture', ref: '2 Corinthians 12:9' },
          { cat: 'Resilience and overcoming difficulties', msg: 'We are troubled on every side, yet not distressed; we are perplexed, but not in despair.', type: 'scripture', ref: '2 Corinthians 4:8' },

          // Rest and self-compassion
          { cat: 'Rest and self-compassion', msg: 'Rest is not a reward for exhaustion. It is part of being human.', type: 'original', ref: null },
          { cat: 'Rest and self-compassion', msg: 'You can be ambitious and still choose peace.', type: 'original', ref: null },
          { cat: 'Rest and self-compassion', msg: 'Taking a pause is not quitting; it is making space to breathe and realign.', type: 'original', ref: null },
          { cat: 'Rest and self-compassion', msg: 'Come unto me, all ye that labour and are heavy laden, and I will give you rest.', type: 'scripture', ref: 'Matthew 11:28' },
          { cat: 'Rest and self-compassion', msg: 'In returning and rest shall ye be saved; in quietness and in confidence shall be your strength.', type: 'scripture', ref: 'Isaiah 30:15' },

          // Discipline and consistency
          { cat: 'Discipline and consistency', msg: 'Small, quiet daily efforts compound into extraordinary transformations.', type: 'original', ref: null },
          { cat: 'Discipline and consistency', msg: 'Discipline is simply remembering what you truly want when the moment gets noisy.', type: 'original', ref: null },
          { cat: 'Discipline and consistency', msg: 'Commit your work to the LORD, and your plans will be established.', type: 'scripture', ref: 'Proverbs 16:3' },
          { cat: 'Discipline and consistency', msg: 'Let us not become weary in doing good, for at the proper time we will reap a harvest if we do not give up.', type: 'scripture', ref: 'Galatians 6:9' },

          // Gratitude and appreciation
          { cat: 'Gratitude and appreciation', msg: 'Do not become so focused on your future that you forget to enjoy your present.', type: 'original', ref: null },
          { cat: 'Gratitude and appreciation', msg: 'Look around you today: there is something ordinary that is actually a gift.', type: 'original', ref: null },
          { cat: 'Gratitude and appreciation', msg: 'This is the day which the LORD hath made; we will rejoice and be glad in it.', type: 'scripture', ref: 'Psalm 118:24' },
          { cat: 'Gratitude and appreciation', msg: 'Give thanks in all circumstances; for this is God’s will for you in Christ Jesus.', type: 'scripture', ref: '1 Thessalonians 5:18' },

          // Hope and new beginnings
          { cat: 'Hope and new beginnings', msg: 'Every morning is a clean canvas. What happened yesterday does not have to dictate today.', type: 'original', ref: null },
          { cat: 'Hope and new beginnings', msg: 'Hope is believing that tomorrow holds goodness, even when today is unclear.', type: 'original', ref: null },
          { cat: 'Hope and new beginnings', msg: 'The steadfast love of the LORD never ceases; his mercies never come to an end; they are new every morning: great is thy faithfulness.', type: 'scripture', ref: 'Lamentations 3:22-23' },
          { cat: 'Hope and new beginnings', msg: 'For I know the plans I have for you, declares the LORD, plans to prosper you and not to harm you, plans to give you hope and a future.', type: 'scripture', ref: 'Jeremiah 29:11' },

          // Relationships and kindness
          { cat: 'Relationships and kindness', msg: 'A quiet word of appreciation can lighten someone’s entire week.', type: 'original', ref: null },
          { cat: 'Relationships and kindness', msg: 'You do not have to carry everything alone. Let those who care for you share the weight.', type: 'original', ref: null },
          { cat: 'Relationships and kindness', msg: 'Be kind and compassionate to one another, forgiving each other, just as in Christ God forgave you.', type: 'scripture', ref: 'Ephesians 4:32' },
          { cat: 'Relationships and kindness', msg: 'As iron sharpens iron, so one person sharpens another.', type: 'scripture', ref: 'Proverbs 27:17' }
        ]

        const insertMsg = db.prepare(`
          INSERT INTO selah_moments_messages (category, message, source_type, scripture_ref)
          VALUES (?, ?, ?, ?)
        `)
        for (const m of seedMessages) {
          insertMsg.run(m.cat, m.msg, m.type, m.ref)
        }
      }

      // Seed prompts if empty
      const promptCount = (db.prepare('SELECT count(*) as count FROM selah_moments_prompts').get() as { count: number }).count
      if (promptCount === 0) {
        const seedPrompts = [
          // Weekly rhythm prompts
          { cat: 'Personal growth', q: 'What did you learn about yourself this week?', day: 'monday', theme: 'A New Beginning' },
          { cat: 'Future and purpose', q: 'What intention or attitude would you like to anchor this week in?', day: 'monday', theme: 'Fresh Focus' },
          { cat: 'Emotional well-being', q: 'How have you really been feeling lately? What has been weighing on your mind?', day: 'wednesday', theme: 'Pause and Reflect' },
          { cat: 'Personal growth', q: 'What is something you handled better this week than you would have in the past?', day: 'wednesday', theme: 'Midweek Check-in' },
          { cat: 'Gratitude', q: 'What made you genuinely happy this week, and what small win are you celebrating?', day: 'friday', theme: 'Gratitude and Wins' },
          { cat: 'Relationships', q: 'Who made your week better, and have you let them know?', day: 'friday', theme: 'Appreciation' },
          { cat: 'Faith', q: 'Where did you see God working in your life this week, and what can you surrender in prayer?', day: 'sunday', theme: 'A Moment with Yourself' },
          { cat: 'Emotional well-being', q: 'What do you need to forgive yourself for, and what do you need more of in your life?', day: 'sunday', theme: 'Restoration' },

          // Additional reflective prompts
          { cat: 'Personal growth', q: 'What challenged you, and what did it teach you?', day: 'any', theme: 'Growth Through Trials' },
          { cat: 'Gratitude', q: 'What is something small you are genuinely grateful for right now?', day: 'any', theme: 'Quiet Gratitude' },
          { cat: 'Emotional well-being', q: 'What thought or obligation can you gently set down today?', day: 'any', theme: 'Lightening the Load' },
          { cat: 'Faith', q: 'What Scripture or promise has brought comfort to your heart recently?', day: 'any', theme: 'Spiritual Strength' },
          { cat: 'Relationships', q: 'Did you make enough time for the people you care about, and how did you show kindness?', day: 'any', theme: 'Heart for Others' },
          { cat: 'Future and purpose', q: 'What is one thing you accomplished recently that you haven’t given yourself enough credit for?', day: 'any', theme: 'Giving Yourself Credit' },
          { cat: 'Future and purpose', q: 'Are you spending your time on things that genuinely matter to you?', day: 'any', theme: 'Living with Purpose' },
          { cat: 'Future and purpose', q: 'What would you like to do differently or more gently next week?', day: 'any', theme: 'Looking Forward' }
        ]

        const insertPrompt = db.prepare(`
          INSERT INTO selah_moments_prompts (category, question, day_hint, theme)
          VALUES (?, ?, ?, ?)
        `)
        for (const p of seedPrompts) {
          insertPrompt.run(p.cat, p.q, p.day, p.theme)
        }
      }

      db.exec(`INSERT OR REPLACE INTO schema_version (version) VALUES (8);`)
    } catch (err) {
      console.error('Error running migration v8:', err)
    }
  }

  // Ensure default settings exist
  const defaultSettings: Record<string, string> = {
    pinned: 'false',
    widget_mode: 'compact', // 'compact' or 'standard'
    launch_on_startup: 'true',
    start_minimized: 'false',
    notifications_enabled: 'true',
    class_reminder_minutes: '10',
    task_reminder_enabled: 'true',
    free_period_reminders_enabled: 'true',
    free_reminder_min_minutes: '20',
    free_reminder_days: 'all',
    quiet_hours_enabled: 'true',
    quiet_hours_start: '21:00',
    quiet_hours_end: '07:00',
    verse_visible: 'true',
    faith_enabled: 'true',
    journal_enabled: 'true',
    bible_translation: 'KJV'
  }

  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)')
  for (const [k, v] of Object.entries(defaultSettings)) {
    insertSetting.run(k, v)
  }

  return db
}

// ----------------- Database CRUD operations -----------------

// Settings
export function getSetting(key: string): string | null {
  const row = getDatabase().prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
  return row?.value ?? null
}

export function setSetting(key: string, value: string): void {
  getDatabase().prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value)
}

export function getAllSettings(): Record<string, string> {
  const rows = getDatabase().prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: string }>
  const result: Record<string, string> = {}
  for (const row of rows) {
    result[row.key] = row.value
  }
  return result
}

// Tasks
export function listTasks(filterDate?: string): TaskRecord[] {
  const d = getDatabase()
  if (filterDate) {
    return d.prepare(`
      SELECT * FROM tasks 
      WHERE due_date = ? OR (due_date IS NULL AND ? = 'all')
      ORDER BY completed ASC, 
        CASE priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END,
        due_time ASC NULLS LAST,
        id DESC
    `).all(filterDate, filterDate) as TaskRecord[]
  }
  return d.prepare(`
    SELECT * FROM tasks 
    ORDER BY completed ASC,
      CASE priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END,
      due_date ASC NULLS LAST,
      due_time ASC NULLS LAST,
      id DESC
  `).all() as TaskRecord[]
}

export function addTask(payload: {
  title: string
  description?: string
  dueDate?: string
  dueTime?: string
  priority?: 'low' | 'normal' | 'high'
  category?: string
  classId?: number
  estimatedMinutes?: number | null
  scheduledDate?: string | null
  scheduledTime?: string | null
  scheduledDurationMinutes?: number | null
  recurrenceRule?: string | null
  subtasks?: string | null
}): TaskRecord {
  const title = (payload.title || '').trim().slice(0, 240)
  if (!title) {
    throw new Error('Task title cannot be empty')
  }
  const priority = ['low', 'normal', 'high'].includes(payload.priority || '') ? payload.priority! : 'normal'
  const estMins = typeof payload.estimatedMinutes === 'number' && !isNaN(payload.estimatedMinutes) ? payload.estimatedMinutes : null
  const schedDate = payload.scheduledDate || null
  const schedTime = payload.scheduledTime || null
  const schedDur = typeof payload.scheduledDurationMinutes === 'number' && !isNaN(payload.scheduledDurationMinutes) ? payload.scheduledDurationMinutes : null
  const recRule = payload.recurrenceRule && ['daily', 'weekdays', 'weekly', 'monthly'].includes(payload.recurrenceRule) ? payload.recurrenceRule : null
  const subtasksJson = typeof payload.subtasks === 'string' ? payload.subtasks : null

  const d = getDatabase()
  const info = d.prepare(`
    INSERT INTO tasks (title, description, due_date, due_time, priority, category, class_id, estimated_minutes, scheduled_date, scheduled_time, scheduled_duration_minutes, recurrence_rule, subtasks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    title,
    payload.description?.trim() || null,
    payload.dueDate || null,
    payload.dueTime || null,
    priority,
    payload.category?.trim() || null,
    payload.classId || null,
    estMins,
    schedDate,
    schedTime,
    schedDur,
    recRule,
    subtasksJson
  )
  return d.prepare('SELECT * FROM tasks WHERE id = ?').get(info.lastInsertRowid) as TaskRecord
}

export function updateTask(id: number, payload: Partial<{
  title: string
  description: string | null
  dueDate: string | null
  dueTime: string | null
  priority: 'low' | 'normal' | 'high'
  completed: boolean
  category: string | null
  classId: number | null
  estimatedMinutes: number | null
  scheduledDate: string | null
  scheduledTime: string | null
  scheduledDurationMinutes: number | null
  totalTimeSpentSeconds: number
  recurrenceRule: string | null
  subtasks: string | null
}>): TaskRecord {
  const d = getDatabase()
  const existing = d.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRecord | undefined
  if (!existing) {
    throw new Error(`Task ${id} not found`)
  }

  const nextTitle = payload.title !== undefined ? payload.title.trim().slice(0, 240) : existing.title
  const nextDesc = payload.description !== undefined ? payload.description : existing.description
  const nextDueDate = payload.dueDate !== undefined ? payload.dueDate : existing.due_date
  const nextDueTime = payload.dueTime !== undefined ? payload.dueTime : existing.due_time
  const nextPriority = payload.priority !== undefined ? payload.priority : existing.priority
  const nextCompleted = payload.completed !== undefined ? (payload.completed ? 1 : 0) : existing.completed
  const nextCategory = payload.category !== undefined ? payload.category : existing.category
  const nextClassId = payload.classId !== undefined ? payload.classId : existing.class_id
  const nextEstMins = payload.estimatedMinutes !== undefined ? payload.estimatedMinutes : (existing.estimated_minutes ?? null)
  const nextSchedDate = payload.scheduledDate !== undefined ? payload.scheduledDate : (existing.scheduled_date ?? null)
  const nextSchedTime = payload.scheduledTime !== undefined ? payload.scheduledTime : (existing.scheduled_time ?? null)
  const nextSchedDur = payload.scheduledDurationMinutes !== undefined ? payload.scheduledDurationMinutes : (existing.scheduled_duration_minutes ?? null)
  const nextTotalSpent = payload.totalTimeSpentSeconds !== undefined ? payload.totalTimeSpentSeconds : (existing.total_time_spent_seconds ?? 0)
  const nextRecRule = payload.recurrenceRule !== undefined ? payload.recurrenceRule : (existing.recurrence_rule ?? null)
  const nextSubtasks = payload.subtasks !== undefined ? payload.subtasks : (existing.subtasks ?? null)

  d.prepare(`
    UPDATE tasks 
    SET title = ?, description = ?, due_date = ?, due_time = ?, priority = ?, completed = ?, category = ?, class_id = ?, estimated_minutes = ?,
        scheduled_date = ?, scheduled_time = ?, scheduled_duration_minutes = ?, total_time_spent_seconds = ?, recurrence_rule = ?, subtasks = ?
    WHERE id = ?
  `).run(nextTitle, nextDesc, nextDueDate, nextDueTime, nextPriority, nextCompleted, nextCategory, nextClassId, nextEstMins, nextSchedDate, nextSchedTime, nextSchedDur, nextTotalSpent, nextRecRule, nextSubtasks, id)

  return d.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRecord
}

function computeNextRecurrenceDate(currentDueDate: string | null, rule: string): string {
  const base = currentDueDate && /^\d{4}-\d{2}-\d{2}$/.test(currentDueDate)
    ? new Date(`${currentDueDate}T00:00:00`)
    : new Date()
  const now = new Date()
  const start = base > now ? base : new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const next = new Date(start)
  if (rule === 'daily') {
    next.setDate(next.getDate() + 1)
  } else if (rule === 'weekdays') {
    next.setDate(next.getDate() + 1)
    while (next.getDay() === 0 || next.getDay() === 6) {
      next.setDate(next.getDate() + 1)
    }
  } else if (rule === 'weekly') {
    next.setDate(next.getDate() + 7)
  } else if (rule === 'monthly') {
    next.setMonth(next.getMonth() + 1)
  }
  const y = next.getFullYear()
  const m = String(next.getMonth() + 1).padStart(2, '0')
  const d = String(next.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function toggleTask(id: number, completed: boolean): boolean {
  const d = getDatabase()
  const existing = d.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRecord | undefined
  d.prepare('UPDATE tasks SET completed = ? WHERE id = ?').run(completed ? 1 : 0, id)

  // Spawn next occurrence if completing a recurring task that wasn't already completed
  if (completed && existing && !existing.completed && existing.recurrence_rule) {
    const nextDate = computeNextRecurrenceDate(existing.due_date, existing.recurrence_rule)
    let resetSubtasks: string | null = existing.subtasks ?? null
    if (resetSubtasks) {
      try {
        const parsed = JSON.parse(resetSubtasks)
        if (Array.isArray(parsed)) {
          resetSubtasks = JSON.stringify(parsed.map(s => ({ ...s, completed: false })))
        }
      } catch {
        // leave as is
      }
    }
    // Check if an identical active occurrence for nextDate already exists to prevent duplicates
    const dup = d.prepare(
      'SELECT id FROM tasks WHERE title = ? AND due_date = ? AND completed = 0 AND recurrence_rule = ?'
    ).get(existing.title, nextDate, existing.recurrence_rule)

    if (!dup) {
      addTask({
        title: existing.title,
        description: existing.description || undefined,
        dueDate: nextDate,
        dueTime: existing.due_time || undefined,
        priority: existing.priority,
        category: existing.category || undefined,
        classId: existing.class_id || undefined,
        estimatedMinutes: existing.estimated_minutes,
        recurrenceRule: existing.recurrence_rule,
        subtasks: resetSubtasks
      })
    }
  }

  return true
}

export function rescheduleOverdueTasksToToday(todayKey: string): number {
  const d = getDatabase()
  const info = d.prepare(`
    UPDATE tasks
    SET due_date = ?
    WHERE completed = 0 AND due_date IS NOT NULL AND due_date < ?
  `).run(todayKey, todayKey)
  return info.changes
}

export function deleteTask(id: number): boolean {
  getDatabase().prepare('DELETE FROM tasks WHERE id = ?').run(id)
  return true
}

export function rolloverTasks(fromDueDate: string, toDueDate: string): number {
  const d = getDatabase()
  const result = d.prepare(`
    UPDATE tasks 
    SET due_date = ? 
    WHERE completed = 0 AND due_date = ?
  `).run(toDueDate, fromDueDate)
  return result.changes
}

// ----------------- Time Tracking & Task Focus Session Operations -----------------

export function getActiveTimer(): (ActiveTimerRecord & { elapsed_seconds: number }) | null {
  const d = getDatabase()
  const row = d.prepare(`
    SELECT at.*, t.title as task_title, t.total_time_spent_seconds
    FROM active_timer at
    JOIN tasks t ON at.task_id = t.id
    WHERE at.id = 1
  `).get() as ActiveTimerRecord | undefined

  if (!row || row.status === 'idle') return null

  let elapsedSeconds = row.accumulated_seconds
  if (row.status === 'running' && row.start_time) {
    const startMs = new Date(row.start_time).getTime()
    const nowMs = Date.now()
    if (!isNaN(startMs) && nowMs > startMs) {
      elapsedSeconds += Math.floor((nowMs - startMs) / 1000)
    }
  }

  try {
    d.prepare("UPDATE active_timer SET last_heartbeat = CURRENT_TIMESTAMP WHERE id = 1").run()
  } catch {}

  return {
    ...row,
    elapsed_seconds: elapsedSeconds
  }
}

export function startTimer(taskId: number, options?: {
  isPomodoro?: boolean
  workDuration?: number
  breakDuration?: number
}): ActiveTimerRecord & { elapsed_seconds: number } {
  const d = getDatabase()
  const nowIso = new Date().toISOString()
  const isPomo = options?.isPomodoro ? 1 : 0
  const workDur = options?.workDuration || 1500 // 25 min default
  const breakDur = options?.breakDuration || 300 // 5 min default

  // Stop any existing active timer first
  const existing = getActiveTimer()
  if (existing && existing.task_id !== taskId) {
    stopTimer()
  }

  d.prepare(`
    INSERT INTO active_timer (id, task_id, status, start_time, accumulated_seconds, is_pomodoro, pomodoro_phase, pomodoro_work_duration, pomodoro_break_duration, last_heartbeat)
    VALUES (1, ?, 'running', ?, 0, ?, 'work', ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      task_id = excluded.task_id,
      status = 'running',
      start_time = excluded.start_time,
      accumulated_seconds = 0,
      is_pomodoro = excluded.is_pomodoro,
      pomodoro_phase = 'work',
      pomodoro_work_duration = excluded.pomodoro_work_duration,
      pomodoro_break_duration = excluded.pomodoro_break_duration,
      last_heartbeat = CURRENT_TIMESTAMP
  `).run(taskId, nowIso, isPomo, workDur, breakDur)

  return getActiveTimer()!
}

export function pauseTimer(): (ActiveTimerRecord & { elapsed_seconds: number }) | null {
  const d = getDatabase()
  const active = getActiveTimer()
  if (!active || active.status !== 'running') return active

  d.prepare(`
    UPDATE active_timer
    SET status = 'paused',
        accumulated_seconds = ?,
        start_time = NULL,
        last_heartbeat = CURRENT_TIMESTAMP
    WHERE id = 1
  `).run(active.elapsed_seconds)

  return getActiveTimer()
}

export function resumeTimer(): (ActiveTimerRecord & { elapsed_seconds: number }) | null {
  const d = getDatabase()
  const active = getActiveTimer()
  if (!active || active.status !== 'paused') return active

  d.prepare(`
    UPDATE active_timer
    SET status = 'running',
        start_time = ?,
        last_heartbeat = CURRENT_TIMESTAMP
    WHERE id = 1
  `).run(new Date().toISOString())

  return getActiveTimer()
}

export function stopTimer(): { taskId: number; sessionDurationSeconds: number; totalSpentSeconds: number } | null {
  const d = getDatabase()
  const active = getActiveTimer()
  if (!active) return null

  const sessionDuration = active.elapsed_seconds
  const taskId = active.task_id
  const nowIso = new Date().toISOString()

  if (sessionDuration >= 5) {
    const startTimeIso = active.start_time || new Date(Date.now() - sessionDuration * 1000).toISOString()
    d.prepare(`
      INSERT INTO task_sessions (task_id, start_time, end_time, duration_seconds, is_pomodoro)
      VALUES (?, ?, ?, ?, ?)
    `).run(taskId, startTimeIso, nowIso, sessionDuration, active.is_pomodoro)

    d.prepare(`
      UPDATE tasks
      SET total_time_spent_seconds = COALESCE(total_time_spent_seconds, 0) + ?
      WHERE id = ?
    `).run(sessionDuration, taskId)
  }

  d.prepare(`DELETE FROM active_timer WHERE id = 1`).run()

  const updatedTask = d.prepare(`SELECT total_time_spent_seconds FROM tasks WHERE id = ?`).get(taskId) as { total_time_spent_seconds: number } | undefined
  return {
    taskId,
    sessionDurationSeconds: sessionDuration,
    totalSpentSeconds: updatedTask?.total_time_spent_seconds ?? 0
  }
}

export function markTaskDoneWithTimer(taskId: number): {
  task: TaskRecord
  timeSpentSeconds: number
} {
  const d = getDatabase()
  const active = getActiveTimer()
  if (active && active.task_id === taskId) {
    stopTimer()
  }
  toggleTask(taskId, true)
  const task = d.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as TaskRecord
  return {
    task,
    timeSpentSeconds: task.total_time_spent_seconds || 0
  }
}

export function undoMarkTaskDone(taskId: number): TaskRecord {
  const d = getDatabase()
  d.prepare('UPDATE tasks SET completed = 0 WHERE id = ?').run(taskId)
  return d.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as TaskRecord
}

export function listTaskSessions(taskId: number): TaskSessionRecord[] {
  return getDatabase().prepare(`
    SELECT * FROM task_sessions
    WHERE task_id = ?
    ORDER BY id DESC
  `).all(taskId) as TaskSessionRecord[]
}

export function scheduleTask(taskId: number, date: string, time?: string | null, durationMinutes?: number | null): TaskRecord {
  const d = getDatabase()
  d.prepare(`
    UPDATE tasks
    SET scheduled_date = ?,
        scheduled_time = ?,
        scheduled_duration_minutes = ?
    WHERE id = ?
  `).run(date, time || null, durationMinutes || 30, taskId)
  return d.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as TaskRecord
}

export function getWeeklyStudyStats(startDate: string, endDate: string): {
  dailyStudiedSeconds: Record<string, number>
  totalStudiedSeconds: number
  plannedMinutes: number
  actualMinutes: number
} {
  const d = getDatabase()
  
  const sessionRows = d.prepare(`
    SELECT substr(start_time, 1, 10) as day_date, SUM(duration_seconds) as total_seconds
    FROM task_sessions
    WHERE substr(start_time, 1, 10) >= ? AND substr(start_time, 1, 10) <= ?
    GROUP BY day_date
  `).all(startDate, endDate) as Array<{ day_date: string; total_seconds: number }>

  const dailyStudiedSeconds: Record<string, number> = {}
  let totalStudiedSeconds = 0
  for (const r of sessionRows) {
    dailyStudiedSeconds[r.day_date] = r.total_seconds
    totalStudiedSeconds += r.total_seconds
  }

  const plannedRow = d.prepare(`
    SELECT SUM(COALESCE(scheduled_duration_minutes, estimated_minutes, 30)) as planned_mins
    FROM tasks
    WHERE scheduled_date >= ? AND scheduled_date <= ?
  `).get(startDate, endDate) as { planned_mins: number | null } | undefined

  const plannedMinutes = plannedRow?.planned_mins || 0
  const actualMinutes = Math.round(totalStudiedSeconds / 60)

  return {
    dailyStudiedSeconds,
    totalStudiedSeconds,
    plannedMinutes,
    actualMinutes
  }
}

// Classes
export function listClasses(): ClassRecord[] {
  return getDatabase().prepare(`
    SELECT * FROM classes 
    ORDER BY weekday ASC, start_time ASC, id ASC
  `).all() as ClassRecord[]
}

export function addClass(payload: {
  title: string
  weekday: number
  startTime: string
  endTime?: string
  room?: string
  notes?: string
  color?: string
}): ClassRecord {
  const title = (payload.title || '').trim().slice(0, 160)
  if (!title) throw new Error('Class title is required')
  if (!Number.isInteger(payload.weekday) || payload.weekday < 0 || payload.weekday > 6) {
    throw new Error('Invalid weekday (must be 0-6)')
  }
  if (!/^\d{2}:\d{2}$/.test(payload.startTime)) {
    throw new Error('Invalid start time (must be HH:mm)')
  }

  const d = getDatabase()
  const info = d.prepare(`
    INSERT INTO classes (title, weekday, start_time, end_time, room, notes, color)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    title,
    payload.weekday,
    payload.startTime,
    payload.endTime || null,
    payload.room?.trim() || null,
    payload.notes?.trim() || null,
    payload.color || null
  )

  return d.prepare('SELECT * FROM classes WHERE id = ?').get(info.lastInsertRowid) as ClassRecord
}

export function updateClass(id: number, payload: Partial<{
  title: string
  weekday: number
  startTime: string
  endTime: string | null
  room: string | null
  notes: string | null
  color: string | null
}>): ClassRecord {
  const d = getDatabase()
  const existing = d.prepare('SELECT * FROM classes WHERE id = ?').get(id) as ClassRecord | undefined
  if (!existing) throw new Error(`Class ${id} not found`)

  const nextTitle = payload.title !== undefined ? payload.title.trim().slice(0, 160) : existing.title
  const nextWeekday = payload.weekday !== undefined ? payload.weekday : existing.weekday
  const nextStart = payload.startTime !== undefined ? payload.startTime : existing.start_time
  const nextEnd = payload.endTime !== undefined ? payload.endTime : existing.end_time
  const nextRoom = payload.room !== undefined ? payload.room : existing.room
  const nextNotes = payload.notes !== undefined ? payload.notes : existing.notes
  const nextColor = payload.color !== undefined ? payload.color : existing.color

  d.prepare(`
    UPDATE classes
    SET title = ?, weekday = ?, start_time = ?, end_time = ?, room = ?, notes = ?, color = ?
    WHERE id = ?
  `).run(nextTitle, nextWeekday, nextStart, nextEnd, nextRoom, nextNotes, nextColor, id)

  return d.prepare('SELECT * FROM classes WHERE id = ?').get(id) as ClassRecord
}

export function deleteClass(id: number): boolean {
  getDatabase().prepare('DELETE FROM classes WHERE id = ?').run(id)
  return true
}

export function replaceClasses(classes: Array<{
  title: string
  weekday: number
  startTime: string
  endTime?: string
  room?: string
  notes?: string
  color?: string
}>, sourceFileName?: string): ClassRecord[] {
  const d = getDatabase()
  const replaceTx = d.transaction((items) => {
    d.prepare('DELETE FROM classes').run()
    const insert = d.prepare(`
      INSERT INTO classes (title, weekday, start_time, end_time, room, notes, color)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    let count = 0
    for (const item of items) {
      if (!item.title?.trim() || !Number.isInteger(item.weekday) || item.weekday < 0 || item.weekday > 6) continue
      const startTime = /^\d{2}:\d{2}$/.test(item.startTime) ? item.startTime : '08:00'
      insert.run(
        item.title.trim().slice(0, 160),
        item.weekday,
        startTime,
        item.endTime || null,
        item.room?.trim() || null,
        item.notes?.trim() || null,
        item.color || null
      )
      count++
    }

    if (sourceFileName) {
      d.prepare('INSERT INTO import_history (file_name, file_type, imported_count) VALUES (?, ?, ?)').run(
        sourceFileName,
        sourceFileName.split('.').pop() || 'unknown',
        count
      )
    }
  })

  replaceTx(Array.isArray(classes) ? classes.slice(0, 500) : [])
  return listClasses()
}

export function appendClasses(classes: Array<{
  title: string
  weekday: number
  startTime: string
  endTime?: string
  room?: string
  notes?: string
  color?: string
}>, sourceFileName?: string): ClassRecord[] {
  const d = getDatabase()
  const appendTx = d.transaction((items) => {
    const insert = d.prepare(`
      INSERT INTO classes (title, weekday, start_time, end_time, room, notes, color)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    let count = 0
    for (const item of items) {
      if (!item.title?.trim() || !Number.isInteger(item.weekday) || item.weekday < 0 || item.weekday > 6) continue
      const startTime = /^\d{2}:\d{2}$/.test(item.startTime) ? item.startTime : '08:00'
      insert.run(
        item.title.trim().slice(0, 160),
        item.weekday,
        startTime,
        item.endTime || null,
        item.room?.trim() || null,
        item.notes?.trim() || null,
        item.color || null
      )
      count++
    }

    if (sourceFileName) {
      d.prepare('INSERT INTO import_history (file_name, file_type, imported_count) VALUES (?, ?, ?)').run(
        sourceFileName,
        sourceFileName.split('.').pop() || 'unknown',
        count
      )
    }
  })

  appendTx(Array.isArray(classes) ? classes.slice(0, 500) : [])
  return listClasses()
}

export const listSubjects = listClasses
export const addSubject = addClass
export const updateSubject = updateClass
export const deleteSubject = deleteClass
export const replaceSubjects = replaceClasses
export const appendSubjects = appendClasses

// Daily Plans
export function getDailyPlan(date: string): DailyPlanRecord | null {
  const row = getDatabase().prepare('SELECT * FROM daily_plans WHERE plan_date = ?').get(date) as DailyPlanRecord | undefined
  if (!row) return null
  return {
    ...row,
    notes: row.notes ? decryptAtRest(row.notes) : null
  }
}

export function saveDailyPlan(date: string, payload: { notes?: string; materialsChecked?: string[] }): DailyPlanRecord {
  const d = getDatabase()
  const existing = getDailyPlan(date)
  const rawNotes = payload.notes !== undefined ? payload.notes : (existing?.notes ?? '')
  const storedNotes = rawNotes ? encryptAtRest(rawNotes) : null
  const materialsJson = payload.materialsChecked !== undefined 
    ? JSON.stringify(payload.materialsChecked) 
    : (existing?.materials_checked ?? '[]')

  d.prepare(`
    INSERT INTO daily_plans (plan_date, notes, materials_checked, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(plan_date) DO UPDATE SET
      notes = excluded.notes,
      materials_checked = excluded.materials_checked,
      updated_at = CURRENT_TIMESTAMP
  `).run(date, storedNotes, materialsJson)

  return getDailyPlan(date)!
}

// Data Export & Backup
export function exportAllData(): {
  version: number
  exportedAt: string
  tasks: TaskRecord[]
  classes: ClassRecord[]
  scheduleEvents: ScheduleEventRecord[]
  dailyPlans: DailyPlanRecord[]
  momentsReflections: SelahReflectionRecord[]
  momentsReminders: SelahReminderRecord[]
  settings: Record<string, string>
  importHistory: ImportHistoryRecord[]
} {
  const d = getDatabase()
  return {
    version: 3,
    exportedAt: new Date().toISOString(),
    tasks: d.prepare('SELECT * FROM tasks').all() as TaskRecord[],
    classes: d.prepare('SELECT * FROM classes').all() as ClassRecord[],
    scheduleEvents: d.prepare('SELECT * FROM schedule_events').all() as ScheduleEventRecord[],
    dailyPlans: (d.prepare('SELECT * FROM daily_plans').all() as DailyPlanRecord[]).map(p => ({
      ...p,
      notes: p.notes ? decryptAtRest(p.notes) : null
    })),
    momentsReflections: d.prepare('SELECT * FROM selah_moments_reflections').all() as SelahReflectionRecord[],
    momentsReminders: d.prepare('SELECT * FROM selah_moments_reminders').all() as SelahReminderRecord[],
    settings: getAllSettings(),
    importHistory: d.prepare('SELECT * FROM import_history').all() as ImportHistoryRecord[]
  }
}

export function importAllData(
  data: {
    tasks?: TaskRecord[]
    classes?: ClassRecord[]
    scheduleEvents?: ScheduleEventRecord[]
    dailyPlans?: DailyPlanRecord[]
    momentsReflections?: SelahReflectionRecord[]
    momentsReminders?: SelahReminderRecord[]
    settings?: Record<string, string>
  },
  mode: 'replace' | 'merge' = 'replace'
): boolean {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid backup file: Root must be a valid JSON object')
  }

  // Preserve current user data state before applying backup
  createDatabaseBackup()

  const d = getDatabase()
  const restoreTx = d.transaction(() => {
    const isMerge = mode === 'merge'

    if (Array.isArray(data.tasks)) {
      if (!isMerge) d.prepare('DELETE FROM tasks').run()
      const insertTask = d.prepare(
        isMerge
          ? `INSERT INTO tasks (title, description, due_date, due_time, priority, completed, category, class_id, estimated_minutes, recurrence_rule, subtasks, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          : `INSERT INTO tasks (id, title, description, due_date, due_time, priority, completed, category, class_id, estimated_minutes, recurrence_rule, subtasks, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      for (const t of data.tasks) {
        if (!t || typeof t !== 'object' || !t.title || typeof t.title !== 'string') continue
        const safeId = typeof t.id === 'number' && Number.isInteger(t.id) ? t.id : null
        const safeTitle = t.title.trim().slice(0, 240)
        const safeDesc = typeof t.description === 'string' ? t.description.slice(0, 1000) : null
        const safeDueDate = typeof t.due_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.due_date) ? t.due_date : null
        const safeDueTime = typeof t.due_time === 'string' && /^\d{2}:\d{2}$/.test(t.due_time) ? t.due_time : null
        const safePriority = ['low', 'normal', 'high'].includes(t.priority) ? t.priority : 'normal'
        const safeCompleted = t.completed ? 1 : 0
        const safeCategory = typeof t.category === 'string' ? t.category.slice(0, 60) : null
        const safeClassId = typeof t.class_id === 'number' && Number.isInteger(t.class_id) ? t.class_id : null
        const safeEstMins = typeof t.estimated_minutes === 'number' && Number.isInteger(t.estimated_minutes) ? t.estimated_minutes : null
        const safeRec = typeof t.recurrence_rule === 'string' ? t.recurrence_rule : null
        const safeSub = typeof t.subtasks === 'string' ? t.subtasks : null
        const safeCreatedAt = typeof t.created_at === 'string' ? t.created_at : new Date().toISOString()
        if (isMerge) {
          insertTask.run(safeTitle, safeDesc, safeDueDate, safeDueTime, safePriority, safeCompleted, safeCategory, safeClassId, safeEstMins, safeRec, safeSub, safeCreatedAt)
        } else {
          insertTask.run(safeId, safeTitle, safeDesc, safeDueDate, safeDueTime, safePriority, safeCompleted, safeCategory, safeClassId, safeEstMins, safeRec, safeSub, safeCreatedAt)
        }
      }
    }

    if (Array.isArray(data.classes)) {
      if (!isMerge) d.prepare('DELETE FROM classes').run()
      const insertClass = d.prepare(
        isMerge
          ? `INSERT INTO classes (title, weekday, start_time, end_time, room, notes, color, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          : `INSERT INTO classes (id, title, weekday, start_time, end_time, room, notes, color, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      for (const c of data.classes) {
        if (!c || typeof c !== 'object' || !c.title || typeof c.title !== 'string') continue
        const safeId = typeof c.id === 'number' && Number.isInteger(c.id) ? c.id : null
        const safeTitle = c.title.trim().slice(0, 160)
        const safeWeekday = Number.isInteger(c.weekday) && c.weekday >= 0 && c.weekday <= 6 ? c.weekday : 1
        const safeStartTime = typeof c.start_time === 'string' && /^\d{2}:\d{2}$/.test(c.start_time) ? c.start_time : '08:00'
        const safeEndTime = typeof c.end_time === 'string' && /^\d{2}:\d{2}$/.test(c.end_time) ? c.end_time : null
        const safeRoom = typeof c.room === 'string' ? c.room.slice(0, 80) : null
        const safeNotes = typeof c.notes === 'string' ? c.notes.slice(0, 500) : null
        const safeColor = typeof c.color === 'string' ? c.color.slice(0, 40) : null
        const safeCreatedAt = typeof c.created_at === 'string' ? c.created_at : new Date().toISOString()
        if (isMerge) {
          insertClass.run(safeTitle, safeWeekday, safeStartTime, safeEndTime, safeRoom, safeNotes, safeColor, safeCreatedAt)
        } else {
          insertClass.run(safeId, safeTitle, safeWeekday, safeStartTime, safeEndTime, safeRoom, safeNotes, safeColor, safeCreatedAt)
        }
      }
    }

    if (Array.isArray(data.scheduleEvents)) {
      if (!isMerge) d.prepare('DELETE FROM schedule_events').run()
      const insertEvt = d.prepare(`
        INSERT INTO schedule_events (title, description, start_date, start_time, end_date, end_time, is_all_day, category, location, is_completed, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const ev of data.scheduleEvents) {
        if (!ev || typeof ev !== 'object' || !ev.title || !ev.start_date) continue
        insertEvt.run(
          String(ev.title).slice(0, 240),
          ev.description ? String(ev.description) : null,
          String(ev.start_date),
          ev.start_time ? String(ev.start_time) : null,
          ev.end_date ? String(ev.end_date) : String(ev.start_date),
          ev.end_time ? String(ev.end_time) : null,
          ev.is_all_day ? 1 : 0,
          ev.category ? String(ev.category) : 'Other',
          ev.location ? String(ev.location) : null,
          ev.is_completed ? 1 : 0,
          ev.created_at || new Date().toISOString(),
          ev.updated_at || new Date().toISOString()
        )
      }
    }

    if (Array.isArray(data.dailyPlans)) {
      if (!isMerge) d.prepare('DELETE FROM daily_plans').run()
      const insertPlan = d.prepare(`
        INSERT OR REPLACE INTO daily_plans (plan_date, notes, materials_checked, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `)
      for (const p of data.dailyPlans) {
        if (!p || typeof p !== 'object' || !p.plan_date || typeof p.plan_date !== 'string') continue
        const safePlanDate = /^\d{4}-\d{2}-\d{2}$/.test(p.plan_date) ? p.plan_date : null
        if (!safePlanDate) continue
        const safeNotes = typeof p.notes === 'string' ? p.notes.slice(0, 2000) : null
        const encryptedNotes = safeNotes ? encryptAtRest(safeNotes) : null
        const safeMaterials = typeof p.materials_checked === 'string' ? p.materials_checked : '[]'
        const safeCreatedAt = typeof p.created_at === 'string' ? p.created_at : new Date().toISOString()
        const safeUpdatedAt = typeof p.updated_at === 'string' ? p.updated_at : new Date().toISOString()
        insertPlan.run(safePlanDate, encryptedNotes, safeMaterials, safeCreatedAt, safeUpdatedAt)
      }
    }

    if (Array.isArray(data.momentsReflections)) {
      if (!isMerge) d.prepare('DELETE FROM selah_moments_reflections').run()
      const insertRefl = d.prepare(`
        INSERT INTO selah_moments_reflections (week_key, date_key, prompt_id, prompt_question, category, response_text, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const r of data.momentsReflections) {
        if (!r || !r.prompt_question || !r.response_text) continue
        insertRefl.run(
          r.week_key || '',
          r.date_key || '',
          r.prompt_id ?? null,
          String(r.prompt_question).slice(0, 500),
          String(r.category || 'General').slice(0, 100),
          String(r.response_text),
          r.created_at || new Date().toISOString(),
          r.updated_at || new Date().toISOString()
        )
      }
    }

    if (Array.isArray(data.momentsReminders)) {
      if (!isMerge) d.prepare('DELETE FROM selah_moments_reminders').run()
      const insertRem = d.prepare(`
        INSERT INTO selah_moments_reminders (title, content, category, is_pinned, is_favorite, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      for (const m of data.momentsReminders) {
        if (!m || !m.title || !m.content) continue
        insertRem.run(
          String(m.title).slice(0, 240),
          String(m.content),
          String(m.category || 'General').slice(0, 100),
          m.is_pinned ? 1 : 0,
          m.is_favorite ? 1 : 0,
          m.created_at || new Date().toISOString(),
          m.updated_at || new Date().toISOString()
        )
      }
    }

    if (data.settings && typeof data.settings === 'object') {
      const insertSetting = d.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
      for (const [k, v] of Object.entries(data.settings)) {
        if (typeof k === 'string' && k.length <= 80 && typeof v === 'string') {
          insertSetting.run(k, v.slice(0, 500))
        }
      }
    }
  })

  restoreTx()
  return true
}

export function clearAllData(options: { tasks?: boolean; classes?: boolean; plans?: boolean; schedules?: boolean; moments?: boolean }): void {
  const d = getDatabase()
  if (options.tasks) d.prepare('DELETE FROM tasks').run()
  if (options.classes) d.prepare('DELETE FROM classes').run()
  if (options.plans) d.prepare('DELETE FROM daily_plans').run()
  if (options.schedules) {
    d.prepare('DELETE FROM event_reminders').run()
    d.prepare('DELETE FROM schedule_events').run()
    d.prepare('DELETE FROM source_documents').run()
  }
  if (options.moments) {
    d.prepare('DELETE FROM selah_moments_reflections').run()
    d.prepare('DELETE FROM selah_moments_reminders').run()
  }
}

// ----------------- Schedule Events & Source Documents -----------------

export function getSourceDocumentByHash(fileHash: string): SourceDocumentRecord | null {
  const row = getDatabase()
    .prepare('SELECT * FROM source_documents WHERE file_hash = ?')
    .get(fileHash) as SourceDocumentRecord | undefined
  return row ?? null
}

export function getSourceDocumentById(id: number): SourceDocumentRecord | null {
  const row = getDatabase()
    .prepare('SELECT * FROM source_documents WHERE id = ?')
    .get(id) as SourceDocumentRecord | undefined
  return row ?? null
}

export function listSourceDocuments(): SourceDocumentRecord[] {
  return getDatabase()
    .prepare('SELECT * FROM source_documents ORDER BY imported_at DESC')
    .all() as SourceDocumentRecord[]
}

export function addSourceDocument(doc: {
  file_hash: string
  file_name: string
  file_type: string
  file_size: number
  event_count?: number
  raw_text?: string | null
}): SourceDocumentRecord {
  const d = getDatabase()
  const insert = d.prepare(`
    INSERT INTO source_documents (file_hash, file_name, file_type, file_size, event_count, raw_text)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(file_hash) DO UPDATE SET
      file_name = excluded.file_name,
      file_size = excluded.file_size,
      raw_text = excluded.raw_text,
      imported_at = CURRENT_TIMESTAMP
  `)
  const result = insert.run(
    doc.file_hash,
    doc.file_name,
    doc.file_type,
    doc.file_size,
    doc.event_count || 0,
    doc.raw_text || null
  )

  const insertedId = Number(result.lastInsertRowid) || getSourceDocumentByHash(doc.file_hash)?.id || 0
  return getSourceDocumentById(insertedId)!
}

export function updateSourceDocumentEventCount(docId: number): void {
  const d = getDatabase()
  const countRow = d
    .prepare('SELECT COUNT(*) as cnt FROM schedule_events WHERE source_doc_id = ?')
    .get(docId) as { cnt: number } | undefined
  const cnt = countRow?.cnt || 0
  d.prepare('UPDATE source_documents SET event_count = ? WHERE id = ?').run(cnt, docId)
}

export function deleteSourceDocument(id: number, deleteEvents: boolean = true): boolean {
  const d = getDatabase()
  const tx = d.transaction(() => {
    if (deleteEvents) {
      d.prepare('DELETE FROM schedule_events WHERE source_doc_id = ?').run(id)
    } else {
      d.prepare('UPDATE schedule_events SET source_doc_id = NULL WHERE source_doc_id = ?').run(id)
    }
    d.prepare('DELETE FROM source_documents WHERE id = ?').run(id)
  })
  tx()
  return true
}

export interface ListScheduleEventsFilters {
  category?: string
  startDate?: string
  endDate?: string
  sourceDocId?: number
  isCompleted?: boolean
  reviewStatus?: string
  search?: string
}

export function listScheduleEvents(filters: ListScheduleEventsFilters = {}): ScheduleEventRecord[] {
  const d = getDatabase()
  const conditions: string[] = []
  const params: unknown[] = []

  if (filters.category && filters.category !== 'All') {
    conditions.push('e.category = ?')
    params.push(filters.category)
  }

  if (filters.startDate) {
    conditions.push('e.start_date >= ?')
    params.push(filters.startDate)
  }

  if (filters.endDate) {
    conditions.push('e.start_date <= ?')
    params.push(filters.endDate)
  }

  if (typeof filters.sourceDocId === 'number') {
    conditions.push('e.source_doc_id = ?')
    params.push(filters.sourceDocId)
  }

  if (typeof filters.isCompleted === 'boolean') {
    conditions.push('e.is_completed = ?')
    params.push(filters.isCompleted ? 1 : 0)
  }

  if (filters.reviewStatus && filters.reviewStatus !== 'All') {
    conditions.push('e.review_status = ?')
    params.push(filters.reviewStatus)
  }

  if (filters.search && filters.search.trim().length > 0) {
    conditions.push('(e.title LIKE ? OR e.description LIKE ? OR e.location LIKE ?)')
    const pattern = `%${filters.search.trim()}%`
    params.push(pattern, pattern, pattern)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const query = `
    SELECT e.*, s.file_name as source_document_name
    FROM schedule_events e
    LEFT JOIN source_documents s ON e.source_doc_id = s.id
    ${whereClause}
    ORDER BY e.start_date ASC, CASE WHEN e.start_time IS NULL THEN '00:00' ELSE e.start_time END ASC, e.id ASC
  `

  const events = d.prepare(query).all(...params) as ScheduleEventRecord[]
  if (events.length === 0) return []

  // Load reminders
  const reminderStmt = d.prepare('SELECT * FROM event_reminders WHERE event_id = ? ORDER BY trigger_offset_minutes ASC')
  for (const ev of events) {
    ev.reminders = reminderStmt.all(ev.id) as EventReminderRecord[]
  }

  return events
}

export function getScheduleEvent(id: number): ScheduleEventRecord | null {
  const d = getDatabase()
  const event = d.prepare(`
    SELECT e.*, s.file_name as source_document_name
    FROM schedule_events e
    LEFT JOIN source_documents s ON e.source_doc_id = s.id
    WHERE e.id = ?
  `).get(id) as ScheduleEventRecord | undefined

  if (!event) return null
  event.reminders = d
    .prepare('SELECT * FROM event_reminders WHERE event_id = ? ORDER BY trigger_offset_minutes ASC')
    .all(id) as EventReminderRecord[]
  return event
}

export function addScheduleEvent(
  event: {
    source_doc_id?: number | null
    title: string
    description?: string | null
    category?: ScheduleCategory
    tags?: string | null
    start_date: string
    start_time?: string | null
    end_date?: string | null
    end_time?: string | null
    is_all_day?: number
    location?: string | null
    recurrence_rule?: string | null
    source_excerpt?: string | null
    source_page?: number | null
    confidence?: 'high' | 'medium' | 'low'
    review_status?: 'confirmed' | 'pending_review' | 'excluded'
    is_completed?: number
    user_edited?: number
  },
  reminders?: Array<{ trigger_offset_minutes: number; all_day_delivery_time?: string }>
): ScheduleEventRecord {
  const d = getDatabase()
  const insert = d.prepare(`
    INSERT INTO schedule_events (
      source_doc_id, title, description, category, tags,
      start_date, start_time, end_date, end_time, is_all_day,
      location, recurrence_rule, source_excerpt, source_page,
      confidence, review_status, is_completed, user_edited
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?
    )
  `)

  const isAllDay = event.is_all_day !== undefined ? event.is_all_day : (event.start_time ? 0 : 1)
  const result = insert.run(
    event.source_doc_id ?? null,
    event.title.trim().slice(0, 250),
    event.description ? event.description.slice(0, 3000) : null,
    event.category || 'Other',
    event.tags || null,
    event.start_date,
    event.start_time || null,
    event.end_date || null,
    event.end_time || null,
    isAllDay,
    event.location || null,
    event.recurrence_rule || null,
    event.source_excerpt || null,
    event.source_page ?? null,
    event.confidence || 'high',
    event.review_status || 'confirmed',
    event.is_completed ? 1 : 0,
    event.user_edited ? 1 : 0
  )

  const eventId = Number(result.lastInsertRowid)

  if (Array.isArray(reminders) && reminders.length > 0) {
    setEventReminders(eventId, reminders)
  }

  if (event.source_doc_id) {
    updateSourceDocumentEventCount(event.source_doc_id)
  }

  return getScheduleEvent(eventId)!
}

export function updateScheduleEvent(
  id: number,
  updates: Partial<Omit<ScheduleEventRecord, 'id' | 'created_at' | 'updated_at'>>,
  reminders?: Array<{ trigger_offset_minutes: number; all_day_delivery_time?: string }>
): ScheduleEventRecord | null {
  const d = getDatabase()
  const existing = getScheduleEvent(id)
  if (!existing) return null

  const fields: string[] = []
  const values: unknown[] = []

  const allowedFields: Array<keyof typeof updates> = [
    'source_doc_id', 'title', 'description', 'category', 'tags',
    'start_date', 'start_time', 'end_date', 'end_time', 'is_all_day',
    'location', 'recurrence_rule', 'source_excerpt', 'source_page',
    'confidence', 'review_status', 'is_completed', 'user_edited'
  ]

  for (const key of allowedFields) {
    if (key in updates) {
      fields.push(`${key} = ?`)
      values.push(updates[key] ?? null)
    }
  }

  fields.push('updated_at = CURRENT_TIMESTAMP')
  values.push(id)

  const query = `UPDATE schedule_events SET ${fields.join(', ')} WHERE id = ?`
  d.prepare(query).run(...values)

  if (Array.isArray(reminders)) {
    setEventReminders(id, reminders)
  }

  return getScheduleEvent(id)
}

export function deleteScheduleEvent(id: number): boolean {
  const d = getDatabase()
  const ev = getScheduleEvent(id)
  d.prepare('DELETE FROM schedule_events WHERE id = ?').run(id)
  if (ev?.source_doc_id) {
    updateSourceDocumentEventCount(ev.source_doc_id)
  }
  return true
}

export function toggleScheduleEventCompleted(id: number): boolean {
  const d = getDatabase()
  const ev = getScheduleEvent(id)
  if (!ev) return false
  const next = ev.is_completed ? 0 : 1
  d.prepare('UPDATE schedule_events SET is_completed = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(next, id)
  return true
}

export function batchCreateScheduleEvents(
  events: Array<{
    source_doc_id?: number | null
    title: string
    description?: string | null
    category?: ScheduleCategory
    tags?: string | null
    start_date: string
    start_time?: string | null
    end_date?: string | null
    end_time?: string | null
    is_all_day?: number
    location?: string | null
    recurrence_rule?: string | null
    source_excerpt?: string | null
    source_page?: number | null
    confidence?: 'high' | 'medium' | 'low'
    review_status?: 'confirmed' | 'pending_review' | 'excluded'
    is_completed?: number
    user_edited?: number
    reminders?: Array<{ trigger_offset_minutes: number; all_day_delivery_time?: string }>
  }>
): number {
  if (!events || events.length === 0) return 0
  const d = getDatabase()
  let inserted = 0
  const docIdsToUpdate = new Set<number>()

  const tx = d.transaction(() => {
    for (const ev of events) {
      if (!ev.title || !ev.start_date) continue
      addScheduleEvent(ev, ev.reminders)
      if (ev.source_doc_id) {
        docIdsToUpdate.add(ev.source_doc_id)
      }
      inserted++
    }

    for (const docId of docIdsToUpdate) {
      updateSourceDocumentEventCount(docId)
    }
  })

  tx()
  return inserted
}

// ----------------- Event Reminders -----------------

export function getEventReminders(eventId: number): EventReminderRecord[] {
  return getDatabase()
    .prepare('SELECT * FROM event_reminders WHERE event_id = ? ORDER BY trigger_offset_minutes ASC')
    .all(eventId) as EventReminderRecord[]
}

export function setEventReminders(
  eventId: number,
  reminders: Array<{ trigger_offset_minutes: number; all_day_delivery_time?: string }>
): void {
  const d = getDatabase()
  const tx = d.transaction(() => {
    d.prepare('DELETE FROM event_reminders WHERE event_id = ?').run(eventId)
    const insert = d.prepare(`
      INSERT INTO event_reminders (event_id, trigger_offset_minutes, all_day_delivery_time)
      VALUES (?, ?, ?)
    `)
    for (const r of reminders) {
      const offset = Number.isInteger(r.trigger_offset_minutes) ? r.trigger_offset_minutes : 10
      const delivery = r.all_day_delivery_time || '08:00'
      insert.run(eventId, offset, delivery)
    }
  })
  tx()
}

export interface PendingReminderToTrigger extends EventReminderRecord {
  event_title: string
  description: string | null
  category: ScheduleCategory
  start_date: string
  start_time: string | null
  is_all_day: number
  location: string | null
}

export function getPendingRemindersToTrigger(): PendingReminderToTrigger[] {
  const d = getDatabase()
  const query = `
    SELECT 
      r.*,
      e.title as event_title,
      e.description,
      e.category,
      e.start_date,
      e.start_time,
      e.is_all_day,
      e.location
    FROM event_reminders r
    JOIN schedule_events e ON r.event_id = e.id
    WHERE r.is_delivered = 0
      AND e.is_completed = 0
      AND e.review_status != 'excluded'
  `
  return d.prepare(query).all() as PendingReminderToTrigger[]
}

export function markReminderDelivered(reminderId: number): void {
  const d = getDatabase()
  d.prepare(`
    UPDATE event_reminders 
    SET is_delivered = 1, last_triggered_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `).run(reminderId)
}

export function resetDeliveredRemindersForEvent(eventId: number): void {
  const d = getDatabase()
  d.prepare('UPDATE event_reminders SET is_delivered = 0, last_triggered_at = NULL WHERE event_id = ?').run(eventId)
}

// ----------------- Journal & Check-Ins (Encrypted at Rest) -----------------

export interface JournalEntryRecord {
  entry_date: string
  check_in_type: 'morning' | 'evening'
  gratitude: string | null
  intention: string | null
  reflection: string | null
  mood: string | null
  created_at: string
  updated_at: string
}

export function getJournalEntry(date: string, checkInType: 'morning' | 'evening'): JournalEntryRecord | null {
  const d = getDatabase()
  const row = d.prepare('SELECT * FROM journal_entries WHERE entry_date = ? AND check_in_type = ?').get(date, checkInType) as any
  if (!row) return null
  return {
    ...row,
    gratitude: row.gratitude ? decryptAtRest(row.gratitude) : null,
    intention: row.intention ? decryptAtRest(row.intention) : null,
    reflection: row.reflection ? decryptAtRest(row.reflection) : null
  }
}

export function saveJournalEntry(
  date: string,
  checkInType: 'morning' | 'evening',
  payload: { gratitude?: string; intention?: string; reflection?: string; mood?: string }
): void {
  const d = getDatabase()
  const encGratitude = payload.gratitude ? encryptAtRest(payload.gratitude) : null
  const encIntention = payload.intention ? encryptAtRest(payload.intention) : null
  const encReflection = payload.reflection ? encryptAtRest(payload.reflection) : null
  const mood = payload.mood || null

  d.prepare(`
    INSERT INTO journal_entries (entry_date, check_in_type, gratitude, intention, reflection, mood, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(entry_date, check_in_type) DO UPDATE SET
      gratitude = excluded.gratitude,
      intention = excluded.intention,
      reflection = excluded.reflection,
      mood = excluded.mood,
      updated_at = CURRENT_TIMESTAMP
  `).run(date, checkInType, encGratitude, encIntention, encReflection, mood)
}

// ----------------- Weekly Reflection Report -----------------

export interface WeeklyReflectionReport {
  startDate: string
  endDate: string
  subjectHours: Array<{ subject: string; hours: number; minutes: number }>
  totalTasksDone: number
  totalStudyMinutes: number
  bestDay: { dayName: string; date: string; minutes: number } | null
  suggestion: string
}

export function getWeeklyReflectionReport(startDate: string, endDate: string): WeeklyReflectionReport {
  const d = getDatabase()

  const subjectRows = d.prepare(`
    SELECT 
      COALESCE(t.category, 'General Study') as subject,
      SUM(s.duration_seconds) as total_seconds
    FROM task_sessions s
    JOIN tasks t ON s.task_id = t.id
    WHERE substr(s.start_time, 1, 10) >= ? AND substr(s.start_time, 1, 10) <= ?
    GROUP BY subject
    ORDER BY total_seconds DESC
  `).all(startDate, endDate) as Array<{ subject: string; total_seconds: number }>

  let totalStudySeconds = 0
  const subjectHours = subjectRows.map(r => {
    totalStudySeconds += r.total_seconds
    const mins = Math.round(r.total_seconds / 60)
    return {
      subject: r.subject,
      hours: Math.floor(mins / 60),
      minutes: mins % 60
    }
  })

  const completedRow = d.prepare(`
    SELECT COUNT(*) as completed_count
    FROM tasks
    WHERE completed = 1
      AND (
        (due_date >= ? AND due_date <= ?)
        OR (scheduled_date >= ? AND scheduled_date <= ?)
      )
  `).get(startDate, endDate, startDate, endDate) as { completed_count: number } | undefined

  const totalTasksDone = completedRow?.completed_count || 0

  const dailyRows = d.prepare(`
    SELECT 
      substr(start_time, 1, 10) as day_date,
      SUM(duration_seconds) as day_seconds
    FROM task_sessions
    WHERE substr(start_time, 1, 10) >= ? AND substr(start_time, 1, 10) <= ?
    GROUP BY day_date
    ORDER BY day_seconds DESC
    LIMIT 1
  `).all(startDate, endDate) as Array<{ day_date: string; day_seconds: number }>

  let bestDay = null
  if (dailyRows[0] && dailyRows[0].day_seconds > 0) {
    const [y, m, day] = dailyRows[0].day_date.split('-').map(Number)
    const dt = new Date(y, m - 1, day)
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    bestDay = {
      date: dailyRows[0].day_date,
      dayName: dayNames[dt.getDay()],
      minutes: Math.round(dailyRows[0].day_seconds / 60)
    }
  }

  let suggestion = 'You stayed consistent this week. Keep taking small steps every day!'
  if (bestDay && bestDay.minutes > 60) {
    suggestion = `Your focus peaked on ${bestDay.dayName} with ${Math.floor(bestDay.minutes / 60)}h ${bestDay.minutes % 60}m studied. Try replicating that daily rhythm!`
  } else if (totalTasksDone > 5) {
    suggestion = `Great momentum completing ${totalTasksDone} tasks this week. Remember to take restful breaks between sessions.`
  }

  return {
    startDate,
    endDate,
    subjectHours,
    totalTasksDone,
    totalStudyMinutes: Math.round(totalStudySeconds / 60),
    bestDay,
    suggestion
  }
}

// ----------------- Streaks & Encouraging Badges -----------------

export interface UserStreakAndBadges {
  currentStreakDays: number
  totalCompletedTasks: number
  totalStudyHours: number
  badges: Array<{ id: string; title: string; description: string; icon: string; unlocked: boolean }>
}

export function getUserStreakAndBadges(): UserStreakAndBadges {
  const d = getDatabase()
  const tasksRow = d.prepare('SELECT COUNT(*) as c FROM tasks WHERE completed = 1').get() as { c: number }
  const totalCompletedTasks = tasksRow?.c || 0

  const timeRow = d.prepare('SELECT SUM(duration_seconds) as s FROM task_sessions').get() as { s: number | null }
  const totalStudyHours = Math.round((timeRow?.s || 0) / 3600)

  const activeDaysRows = d.prepare(`
    SELECT DISTINCT substr(start_time, 1, 10) as day_date FROM task_sessions
    UNION
    SELECT DISTINCT due_date as day_date FROM tasks WHERE completed = 1 AND due_date IS NOT NULL
  `).all() as Array<{ day_date: string }>

  const activeDaySet = new Set(activeDaysRows.map(r => r.day_date))
  const today = new Date()
  let streak = 0
  for (let i = 0; i < 60; i++) {
    const cur = new Date(today)
    cur.setDate(today.getDate() - i)
    const k = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`
    if (activeDaySet.has(k)) {
      streak++
    } else if (i > 0) {
      break
    }
  }

  const badges = [
    {
      id: 'fresh_start',
      title: 'First Step',
      description: 'Completed your first planning task or study session.',
      icon: 'sprout',
      unlocked: totalCompletedTasks > 0 || totalStudyHours > 0
    },
    {
      id: 'momentum',
      title: 'Building Momentum',
      description: 'Maintained 3 consecutive days of active learning.',
      icon: 'flame',
      unlocked: streak >= 3
    },
    {
      id: 'consistency',
      title: 'Consistency Champion',
      description: 'Focused for 7 days in a row.',
      icon: 'trophy',
      unlocked: streak >= 7
    },
    {
      id: 'focus_master',
      title: 'Focus Master',
      description: 'Logged 10+ hours of dedicated study time.',
      icon: 'clock',
      unlocked: totalStudyHours >= 10
    },
    {
      id: 'achiever',
      title: 'Goal Achiever',
      description: 'Successfully checked off 20+ completed tasks.',
      icon: 'star',
      unlocked: totalCompletedTasks >= 20
    }
  ]

  return {
    currentStreakDays: Math.max(1, streak),
    totalCompletedTasks,
    totalStudyHours,
    badges
  }
}

// ----------------- Selah Moments Data Access -----------------

export function listMomentsMessages(category?: string, onlyFavorites?: boolean): SelahMessageRecord[] {
  const d = getDatabase()
  let sql = 'SELECT * FROM selah_moments_messages WHERE 1=1'
  const params: any[] = []

  if (category && category !== 'All') {
    sql += ' AND category = ?'
    params.push(category)
  }
  if (onlyFavorites) {
    sql += ' AND is_favorite = 1'
  }

  sql += ' ORDER BY id ASC'
  return d.prepare(sql).all(...params) as SelahMessageRecord[]
}

export function toggleMomentsMessageFavorite(id: number): boolean {
  const d = getDatabase()
  d.prepare(`
    UPDATE selah_moments_messages
    SET is_favorite = CASE WHEN is_favorite = 1 THEN 0 ELSE 1 END
    WHERE id = ?
  `).run(id)
  const row = d.prepare('SELECT is_favorite FROM selah_moments_messages WHERE id = ?').get(id) as { is_favorite: number } | undefined
  return Boolean(row?.is_favorite)
}

export function getRandomMomentsMessage(category?: string): SelahMessageRecord | null {
  const d = getDatabase()
  if (category && category !== 'All') {
    return (d.prepare('SELECT * FROM selah_moments_messages WHERE category = ? ORDER BY RANDOM() LIMIT 1').get(category) as SelahMessageRecord) ?? null
  }
  return (d.prepare('SELECT * FROM selah_moments_messages ORDER BY RANDOM() LIMIT 1').get() as SelahMessageRecord) ?? null
}

export function getDailyMomentsMessage(): SelahMessageRecord | null {
  const d = getDatabase()
  const messages = d.prepare('SELECT * FROM selah_moments_messages ORDER BY id ASC').all() as SelahMessageRecord[]
  if (!messages || messages.length === 0) return null

  const now = new Date()
  const startOfYear = new Date(now.getFullYear(), 0, 0)
  const diff = (now.getTime() - startOfYear.getTime()) + ((startOfYear.getTimezoneOffset() - now.getTimezoneOffset()) * 60 * 1000)
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24))

  const index = Math.abs(dayOfYear) % messages.length
  return messages[index] || messages[0]
}

export function listMomentsPrompts(category?: string): SelahPromptRecord[] {
  const d = getDatabase()
  if (category && category !== 'All') {
    return d.prepare('SELECT * FROM selah_moments_prompts WHERE category = ? ORDER BY id ASC').all(category) as SelahPromptRecord[]
  }
  return d.prepare('SELECT * FROM selah_moments_prompts ORDER BY id ASC').all() as SelahPromptRecord[]
}

export function getWeeklyMomentsPrompt(weekKey?: string, dayOfWeek?: number): SelahPromptRecord | null {
  const d = getDatabase()
  const prompts = d.prepare('SELECT * FROM selah_moments_prompts ORDER BY id ASC').all() as SelahPromptRecord[]
  if (!prompts || prompts.length === 0) return null

  // If a specific day hint matches (1=Mon, 3=Wed, 5=Fri, 0=Sun)
  let hint: string | null = null
  if (dayOfWeek === 1) hint = 'monday'
  else if (dayOfWeek === 3) hint = 'wednesday'
  else if (dayOfWeek === 5) hint = 'friday'
  else if (dayOfWeek === 0) hint = 'sunday'

  if (hint) {
    const dayMatches = prompts.filter(p => p.day_hint === hint)
    if (dayMatches.length > 0) {
      // Pick based on week hash
      let seed = 0
      if (weekKey) {
        for (let i = 0; i < weekKey.length; i++) seed += weekKey.charCodeAt(i)
      }
      return dayMatches[seed % dayMatches.length]
    }
  }

  // Fallback to weekly cycle
  let weekNum = 1
  if (weekKey) {
    const match = weekKey.match(/W(\d+)/i)
    if (match) weekNum = parseInt(match[1], 10) || 1
  }
  return prompts[weekNum % prompts.length] || prompts[0]
}

export function listMomentsReflections(weekKey?: string): SelahReflectionRecord[] {
  const d = getDatabase()
  if (weekKey) {
    return d.prepare('SELECT * FROM selah_moments_reflections WHERE week_key = ? ORDER BY date_key DESC, created_at DESC').all(weekKey) as SelahReflectionRecord[]
  }
  return d.prepare('SELECT * FROM selah_moments_reflections ORDER BY date_key DESC, created_at DESC').all() as SelahReflectionRecord[]
}

export function saveMomentsReflection(payload: {
  id?: number
  weekKey: string
  dateKey: string
  promptId?: number | null
  promptQuestion: string
  category: string
  responseText: string
}): SelahReflectionRecord {
  const d = getDatabase()
  const now = new Date().toISOString()

  if (payload.id) {
    d.prepare(`
      UPDATE selah_moments_reflections
      SET prompt_question = ?, category = ?, response_text = ?, updated_at = ?
      WHERE id = ?
    `).run(
      payload.promptQuestion,
      payload.category,
      payload.responseText,
      now,
      payload.id
    )
    return d.prepare('SELECT * FROM selah_moments_reflections WHERE id = ?').get(payload.id) as SelahReflectionRecord
  }

  const result = d.prepare(`
    INSERT INTO selah_moments_reflections (week_key, date_key, prompt_id, prompt_question, category, response_text, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    payload.weekKey,
    payload.dateKey,
    payload.promptId ?? null,
    payload.promptQuestion,
    payload.category,
    payload.responseText,
    now,
    now
  )

  return d.prepare('SELECT * FROM selah_moments_reflections WHERE id = ?').get(result.lastInsertRowid) as SelahReflectionRecord
}

export function deleteMomentsReflection(id: number): boolean {
  const d = getDatabase()
  const res = d.prepare('DELETE FROM selah_moments_reflections WHERE id = ?').run(id)
  return res.changes > 0
}

export function listMomentsReminders(category?: string, search?: string): SelahReminderRecord[] {
  const d = getDatabase()
  let sql = 'SELECT * FROM selah_moments_reminders WHERE 1=1'
  const params: any[] = []

  if (category && category !== 'All') {
    sql += ' AND category = ?'
    params.push(category)
  }
  if (search && search.trim()) {
    sql += ' AND (title LIKE ? OR content LIKE ?)'
    const pattern = `%${search.trim()}%`
    params.push(pattern, pattern)
  }

  sql += ' ORDER BY is_pinned DESC, is_favorite DESC, updated_at DESC'
  return d.prepare(sql).all(...params) as SelahReminderRecord[]
}

export function saveMomentsReminder(payload: {
  id?: number
  title: string
  content: string
  category?: string
  isPinned?: boolean
  isFavorite?: boolean
}): SelahReminderRecord {
  const d = getDatabase()
  const now = new Date().toISOString()
  const cat = payload.category && payload.category.trim() ? payload.category.trim() : 'General'

  if (payload.id) {
    d.prepare(`
      UPDATE selah_moments_reminders
      SET title = ?, content = ?, category = ?,
          is_pinned = COALESCE(?, is_pinned),
          is_favorite = COALESCE(?, is_favorite),
          updated_at = ?
      WHERE id = ?
    `).run(
      payload.title.trim(),
      payload.content.trim(),
      cat,
      payload.isPinned !== undefined ? (payload.isPinned ? 1 : 0) : null,
      payload.isFavorite !== undefined ? (payload.isFavorite ? 1 : 0) : null,
      now,
      payload.id
    )
    return d.prepare('SELECT * FROM selah_moments_reminders WHERE id = ?').get(payload.id) as SelahReminderRecord
  }

  const result = d.prepare(`
    INSERT INTO selah_moments_reminders (title, content, category, is_pinned, is_favorite, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    payload.title.trim(),
    payload.content.trim(),
    cat,
    payload.isPinned ? 1 : 0,
    payload.isFavorite ? 1 : 0,
    now,
    now
  )

  return d.prepare('SELECT * FROM selah_moments_reminders WHERE id = ?').get(result.lastInsertRowid) as SelahReminderRecord
}

export function deleteMomentsReminder(id: number): boolean {
  const d = getDatabase()
  const res = d.prepare('DELETE FROM selah_moments_reminders WHERE id = ?').run(id)
  return res.changes > 0
}

export function toggleMomentsReminderPinned(id: number): boolean {
  const d = getDatabase()
  const now = new Date().toISOString()
  d.prepare(`
    UPDATE selah_moments_reminders
    SET is_pinned = CASE WHEN is_pinned = 1 THEN 0 ELSE 1 END, updated_at = ?
    WHERE id = ?
  `).run(now, id)
  const row = d.prepare('SELECT is_pinned FROM selah_moments_reminders WHERE id = ?').get(id) as { is_pinned: number } | undefined
  return Boolean(row?.is_pinned)
}

export function toggleMomentsReminderFavorite(id: number): boolean {
  const d = getDatabase()
  const now = new Date().toISOString()
  d.prepare(`
    UPDATE selah_moments_reminders
    SET is_favorite = CASE WHEN is_favorite = 1 THEN 0 ELSE 1 END, updated_at = ?
    WHERE id = ?
  `).run(now, id)
  const row = d.prepare('SELECT is_favorite FROM selah_moments_reminders WHERE id = ?').get(id) as { is_favorite: number } | undefined
  return Boolean(row?.is_favorite)
}
