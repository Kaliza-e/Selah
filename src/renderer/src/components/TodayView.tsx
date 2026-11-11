import { useMemo, useState, useEffect } from 'react'
import {
  BookOpen,
  ChevronRight,
  Check,
  Plus,
  ExternalLink,
  Play,
  Timer,
  Clock,
  CalendarDays,
  AlertCircle
} from 'lucide-react'
import { Task, ClassItem, ScheduleEvent, ActiveTab, toDateKey } from '../types'
import { FreeTimeBanner } from './FreeTimeBanner'
import { FaithJournalCard } from './FaithJournalCard'
import { ExamCountdownCard } from './ExamCountdownCard'
import { formatTaskDate, isTaskOverdue } from '../lib/dateUtils'
import { formatDurationDisplay } from '../lib/durationUtils'

interface TodayViewProps {
  today: Date
  classes: ClassItem[]
  tasks: Task[]
  userName?: string
  isCompact?: boolean
  onToggleTask: (task: Task) => void
  onNavigate: (tab: ActiveTab) => void
  onOpenTaskModal: () => void
  onOpenClassModal: () => void
  onExpandApp?: () => void
  onOpenTaskDetails?: (task: Task) => void
  onRefreshTasks?: () => Promise<void>
  onShowMessage?: (msg: string) => void
  onOpenFocusTimer?: (task: Task) => void
  onScheduleTask?: (task: Task) => void
  onOpenRevisionPlan?: (examSubject: string, examDate: string) => void
}

const DOT_COLORS = [
  'var(--dot-blue)',
  'var(--dot-purple)',
  'var(--dot-orange)',
  'var(--dot-green)',
  'var(--dot-cyan)',
  'var(--dot-pink)'
]

export function TodayView({
  today,
  classes,
  tasks,
  userName: propUserName,
  isCompact = false,
  onToggleTask,
  onNavigate,
  onOpenTaskModal,
  onOpenClassModal,
  onExpandApp,
  onOpenTaskDetails,
  onRefreshTasks,
  onShowMessage,
  onOpenFocusTimer,
  onScheduleTask,
  onOpenRevisionPlan
}: TodayViewProps) {
  const todayKey = toDateKey(today)
  const todayWeekday = today.getDay()
  const [localUserName, setLocalUserName] = useState<string>('')
  const [todaysEvents, setTodaysEvents] = useState<ScheduleEvent[]>([])

  useEffect(() => {
    if (propUserName === undefined) {
      window.hello11824?.getSetting?.('user_name').then(val => {
        if (val && typeof val === 'string') setLocalUserName(val.trim())
      })
    }
  }, [propUserName])

  useEffect(() => {
    window.hello11824?.listScheduleEvents?.({
      startDate: todayKey,
      endDate: todayKey
    }).then(evts => {
      if (Array.isArray(evts)) setTodaysEvents(evts)
    }).catch(() => {})
  }, [todayKey])

  const effectiveUserName = (propUserName !== undefined ? propUserName : localUserName).trim()

  const overdueCount = useMemo(() => {
    return tasks.filter(t => isTaskOverdue(t.due_date, t.due_time, t.completed, today)).length
  }, [tasks, today])

  // Format date: "Mon, Oct 26, 2026"
  const formattedDate = useMemo(() => {
    return today.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }, [today])

  // Current time: "10:24"
  const currentTimeString = useMemo(() => {
    const hours = String(today.getHours()).padStart(2, '0')
    const minutes = String(today.getMinutes()).padStart(2, '0')
    return `${hours}:${minutes}`
  }, [today])

  // Week number in year (ISO 8601 standard)
  const weekNumber = useMemo(() => {
    const d = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))
    const dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  }, [today])

  // Greeting by time of day
  const greeting = useMemo(() => {
    const hour = today.getHours()
    const prefix = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
    return effectiveUserName ? `${prefix}, ${effectiveUserName}` : prefix
  }, [today, effectiveUserName])

  // Today's classes
  const todaysSubjects = useMemo(() => {
    return classes
      .filter(c => c.weekday === todayWeekday)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
  }, [classes, todayWeekday])

  // Determine Next Subject
  const nextSubject = useMemo(() => {
    const nowMinutes = today.getHours() * 60 + today.getMinutes()
    for (const c of todaysSubjects) {
      if (!c.start_time) continue
      const [sH, sM] = c.start_time.split(':').map(Number)
      const startMinutes = sH * 60 + sM
      let endMinutes = startMinutes + 50
      if (c.end_time && /^\d{2}:\d{2}$/.test(c.end_time)) {
        const [eH, eM] = c.end_time.split(':').map(Number)
        endMinutes = eH * 60 + eM
      }
      if (nowMinutes < endMinutes) {
        return c
      }
    }
    return todaysSubjects[0] || null
  }, [todaysSubjects, today])

  // Today's tasks (due today, scheduled today, or unassigned date)
  const todaysTasks = useMemo(() => {
    return tasks.filter(t => t.due_date === todayKey || t.scheduled_date === todayKey || t.due_date === null)
  }, [tasks, todayKey])

  const completedCount = todaysTasks.filter(t => Boolean(t.completed)).length
  const progressPercent = todaysTasks.length > 0 ? (completedCount / todaysTasks.length) * 100 : 0

  // ================= COMPACT FLOATING WIDGET LAYOUT =================
  if (isCompact) {
    return (
      <div className="compact-widget-container">
        {/* Big Clock Header */}
        <div className="compact-clock-card">
          <div className="compact-time-display">{currentTimeString}</div>
          <div className="compact-date-sublabel">{formattedDate}</div>
        </div>

        {/* Smart Free-Time Suggestion Banner */}
        <FreeTimeBanner
          today={today}
          isCompact={true}
          onOpenTask={onOpenTaskDetails}
          onOpenCreateTask={onOpenTaskModal}
          onRefreshTasks={onRefreshTasks || (async () => {})}
          onShowMessage={onShowMessage || (() => {})}
          onOpenFocusTimer={onOpenFocusTimer}
        />

        {/* Next Class Box */}
        <div className="compact-section-box">
          <span className="section-sublabel">Next Class</span>
          {nextSubject ? (
            <div
              className="next-class-card"
              style={{ padding: '8px 12px' }}
              onClick={() => onNavigate('timetable')}
            >
              <div className="next-class-icon" style={{ width: 28, height: 28 }}>
                <BookOpen size={14} />
              </div>
              <div className="next-class-info" style={{ flex: 1, minWidth: 0 }}>
                <span className="next-class-title" title={nextSubject.title}>{nextSubject.title}</span>
                <span className="next-class-time">
                  {nextSubject.start_time} {nextSubject.end_time ? `– ${nextSubject.end_time}` : ''}
                  {nextSubject.room ? ` • ${nextSubject.room}` : ''}
                </span>
              </div>
              <ChevronRight size={14} color="var(--text-muted)" />
            </div>
          ) : (
            <div
              className="next-class-card empty"
              onClick={onOpenClassModal}
              style={{ cursor: 'pointer', padding: '8px 12px', fontSize: 11.5 }}
            >
              No more classes today • Add Subject
            </div>
          )}
        </div>

        {/* Today's Tasks Preview */}
        <div className="compact-section-box" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span className="section-sublabel">Today's Tasks</span>
            <span style={{ fontSize: 11, color: 'var(--accent-purple)', fontWeight: 600 }}>
              {completedCount}/{todaysTasks.length}
            </span>
          </div>

          <div className="tasks-mini-list" style={{ flex: 1, maxHeight: 150, overflowY: 'auto' }}>
            {todaysTasks.length === 0 ? (
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontStyle: 'italic', padding: '8px 0', textAlign: 'center' }}>
                All clear! No tasks for today.
              </div>
            ) : (
              todaysTasks.slice(0, 4).map(t => (
                <div key={t.id} className="task-mini-item" style={{ padding: '4px 0' }}>
                  <button
                    type="button"
                    className={`task-checkbox-btn ${t.completed ? 'checked' : ''}`}
                    onClick={() => onToggleTask(t)}
                    aria-label={t.completed ? 'Mark incomplete' : 'Mark complete'}
                  >
                    {t.completed ? <Check size={11} strokeWidth={3} /> : null}
                  </button>

                  <div className="task-item-content">
                    <span className={`task-item-title ${t.completed ? 'strikethrough' : ''}`}>
                      {t.title}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Open App Action Button */}
        <button
          type="button"
          className="btn-primary-pill"
          style={{
            width: '100%',
            justifyContent: 'center',
            background: 'var(--accent-purple-btn)',
            color: 'var(--text-on-accent)',
            fontWeight: 700,
            padding: '8px 16px',
            fontSize: 12.5,
            marginTop: 4
          }}
          onClick={onExpandApp}
        >
          <ExternalLink size={13} /> Open App
        </button>
      </div>
    )
  }

  // ================= FULL APPLICATION DASHBOARD LAYOUT =================
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top Banner Row: Greeting, Summary & Quick Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        {/* Left: Greeting & Date */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.3px', margin: 0 }}>
            {greeting}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--text-secondary)' }}>
            <span>{formattedDate} • Week {weekNumber}</span>
            {overdueCount > 0 && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 8px',
                  borderRadius: 9999,
                  background: 'rgba(244, 63, 94, 0.14)',
                  color: '#f43f5e',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
                onClick={() => onNavigate('tasks')}
                title="View overdue tasks"
              >
                <AlertCircle size={11} /> {overdueCount} overdue
              </span>
            )}
          </div>
        </div>

        {/* Right: Quick Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-primary-pill"
            style={{ background: 'var(--accent-purple-btn)', fontSize: 12, padding: '7px 14px' }}
            onClick={onOpenTaskModal}
          >
            <Plus size={14} /> New Task
          </button>
          <button
            type="button"
            className="btn-secondary-pill"
            style={{ fontSize: 12, padding: '7px 12px' }}
            onClick={() => onNavigate('schedules')}
          >
            <CalendarDays size={13} /> Schedules
          </button>
        </div>
      </div>

      {/* Faith & Encouragement Daily Scripture & Private Journal */}
      <FaithJournalCard today={today} onShowMessage={onShowMessage || (() => {})} />

      {/* Exam Countdown & Workload Cluster Warning */}
      <ExamCountdownCard
        today={today}
        tasks={tasks}
        onNavigateSchedules={() => onNavigate('schedules')}
        onOpenRevisionPlan={onOpenRevisionPlan}
      />

      {/* Smart Free-Time Suggestion Banner */}
      <FreeTimeBanner
        today={today}
        isCompact={false}
        onOpenTask={onOpenTaskDetails}
        onOpenCreateTask={onOpenTaskModal}
        onRefreshTasks={onRefreshTasks || (async () => {})}
        onShowMessage={onShowMessage || (() => {})}
        onOpenFocusTimer={onOpenFocusTimer}
      />

      {/* Next Class Hero Card */}
      <div className="app-card" style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span className="section-sublabel">Next Class</span>
          <button
            type="button"
            className="link-action"
            onClick={() => onNavigate('timetable')}
            style={{ fontSize: 11 }}
          >
            Full Timetable &gt;
          </button>
        </div>

        {nextSubject ? (
          <div
            className="next-class-card"
            style={{ padding: '10px 14px' }}
            onClick={() => onNavigate('timetable')}
          >
            <div className="next-class-icon" style={{ width: 34, height: 34 }}>
              <BookOpen size={16} />
            </div>

            <div className="next-class-info" style={{ flex: 1, minWidth: 0 }}>
              <span className="next-class-title" style={{ fontSize: 14 }} title={nextSubject.title}>{nextSubject.title}</span>
              <span className="next-class-time" style={{ fontSize: 12 }}>
                {nextSubject.start_time} {nextSubject.end_time ? `– ${nextSubject.end_time}` : ''}
                {nextSubject.room ? ` • ${nextSubject.room}` : ''}
              </span>
            </div>

            <button
              type="button"
              className="btn-secondary-pill"
              style={{ padding: '4px 12px', fontSize: 11.5 }}
              onClick={e => {
                e.stopPropagation()
                onNavigate('timetable')
              }}
            >
              View
            </button>
          </div>
        ) : (
          <div
            className="next-class-card empty"
            style={{ cursor: 'pointer', padding: '14px', fontSize: 12 }}
            onClick={onOpenClassModal}
          >
            No upcoming classes scheduled for today • Click to add a subject
          </div>
        )}
      </div>

      {/* 2-Column Grid: Today's Schedule + Today's Tasks */}
      <div className="responsive-grid-2">
        {/* ================= LEFT COLUMN: TODAY'S SCHEDULE ================= */}
        <div className="app-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="section-sublabel" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
              Today's Schedule
            </span>
            <button
              type="button"
              className="link-action"
              onClick={() => onNavigate('timetable')}
            >
              View All
            </button>
          </div>

          {todaysSubjects.length === 0 && todaysEvents.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', padding: '24px 0', textAlign: 'center' }}>
              No classes or events scheduled for today.
            </div>
          ) : (
            <div className="classes-mini-list" style={{ gap: 6 }}>
              {todaysSubjects.map((c, i) => (
                <div
                  key={`class-${c.id || i}`}
                  className="class-mini-row"
                  style={{
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-card-inner)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    minWidth: 0,
                    cursor: 'pointer'
                  }}
                  title={`${c.title}${c.room ? ` (Room: ${c.room})` : ''} • ${c.start_time}${c.end_time ? ` – ${c.end_time}` : ''}`}
                  onClick={() => onNavigate('timetable')}
                >
                  <span className="class-mini-time" style={{ minWidth: 80, fontSize: 11.5, flexShrink: 0 }}>
                    {c.start_time} {c.end_time ? `– ${c.end_time}` : ''}
                  </span>
                  <span
                    className="class-dot"
                    style={{ background: DOT_COLORS[i % DOT_COLORS.length], flexShrink: 0 }}
                  />
                  <span
                    className="class-mini-subject"
                    style={{
                      fontSize: 12.5,
                      fontWeight: 600,
                      flex: 1,
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                    title={c.title}
                  >
                    {c.title}
                  </span>
                  {c.room && (
                    <span
                      className="class-mini-room"
                      style={{
                        fontSize: 10.5,
                        fontWeight: 600,
                        padding: '2px 7px',
                        borderRadius: 4,
                        background: 'rgba(124, 58, 237, 0.15)',
                        color: 'var(--accent-purple)',
                        border: '1px solid rgba(124, 58, 237, 0.25)',
                        flexShrink: 0,
                        maxWidth: 90,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                      title={`Room: ${c.room}`}
                    >
                      {c.room}
                    </span>
                  )}
                  <ChevronRight size={13} color="var(--text-muted)" style={{ marginLeft: 4, flexShrink: 0 }} />
                </div>
              ))}
              {todaysEvents.map((ev, i) => (
                <div
                  key={`event-${ev.id || i}`}
                  className="class-mini-row"
                  style={{
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-card-inner)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    minWidth: 0,
                    cursor: 'pointer'
                  }}
                  title={`${ev.title}${ev.location ? ` (${ev.location})` : ''}`}
                  onClick={() => onNavigate('schedules')}
                >
                  <span className="class-mini-time" style={{ minWidth: 80, fontSize: 11.5, flexShrink: 0 }}>
                    {ev.is_all_day ? 'All Day' : `${ev.start_time || ''}${ev.end_time ? ` – ${ev.end_time}` : ''}`}
                  </span>
                  <span
                    className="class-dot"
                    style={{ background: 'var(--accent-cyan)', flexShrink: 0 }}
                  />
                  <span
                    className="class-mini-subject"
                    style={{
                      fontSize: 12.5,
                      fontWeight: 600,
                      flex: 1,
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                    title={ev.title}
                  >
                    {ev.title}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: 'rgba(56, 189, 248, 0.14)',
                      color: 'var(--accent-cyan)',
                      fontWeight: 600,
                      flexShrink: 0
                    }}
                  >
                    {ev.category}
                  </span>
                  <ChevronRight size={13} color="var(--text-muted)" style={{ marginLeft: 4, flexShrink: 0 }} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ================= RIGHT COLUMN: TODAY'S TASKS ================= */}
        <div className="app-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="section-sublabel" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
              Today's Tasks
            </span>
            <span className="tasks-count-text">
              {completedCount}/{todaysTasks.length} completed
            </span>
          </div>

          {/* Progress bar */}
          <div className="tasks-progress-bar">
            <div className="tasks-progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>

          {/* Tasks List */}
          {todaysTasks.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', padding: '24px 0', textAlign: 'center' }}>
              No tasks due today. Click "+ Add Task" to schedule something!
            </div>
          ) : (
            <div className="tasks-mini-list" style={{ gap: 6 }}>
              {todaysTasks.slice(0, 5).map(t => {
                const timeText = formatTaskDate(t.due_date, t.due_time, today)
                const isOverdue = isTaskOverdue(t.due_date, t.due_time, t.completed, today)

                return (
                  <div
                    key={t.id}
                    className="task-mini-item"
                    style={{ padding: '6px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-card-inner)', display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <button
                      type="button"
                      className={`task-checkbox-btn ${t.completed ? 'checked' : ''}`}
                      onClick={() => onToggleTask(t)}
                      aria-label={t.completed ? 'Mark incomplete' : 'Mark complete'}
                    >
                      {t.completed ? <Check size={11} strokeWidth={3} /> : null}
                    </button>

                    <div className="task-item-content" style={{ flex: 1, minWidth: 0 }}>
                      <span className={`task-item-title ${t.completed ? 'strikethrough' : ''}`} style={{ fontSize: 12 }}>
                        {t.title}
                      </span>
                      <div className="task-item-submeta" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {isOverdue && (
                          <span style={{ color: '#f43f5e', fontWeight: 700, fontSize: 10 }}>Overdue</span>
                        )}
                        <span>{timeText}</span>

                        {t.priority === 'high' ? (
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#f43f5e', display: 'inline-block' }} title="High Priority" />
                        ) : t.priority === 'low' ? (
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} title="Low Priority" />
                        ) : null}

                        {t.estimated_minutes ? (
                          <span
                            className="duration-badge-pill"
                            title={`Estimated time: ${t.estimated_minutes} minutes`}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}
                          >
                            <Clock size={10} /> {formatDurationDisplay(t.estimated_minutes)}
                          </span>
                        ) : null}

                        {t.total_time_spent_seconds && t.total_time_spent_seconds > 0 ? (
                          <span style={{ color: 'var(--accent-cyan)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <Clock size={10} /> {Math.round(t.total_time_spent_seconds / 60)}m
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {!t.completed && (
                      <button
                        type="button"
                        className="btn-secondary-pill"
                        style={{ padding: '3px 8px', fontSize: 10.5, flexShrink: 0, height: 24, gap: 4 }}
                        onClick={() => onOpenFocusTimer?.(t)}
                        title="Start Focus Timer for this task"
                      >
                        <Play size={10} style={{ fill: 'currentColor' }} /> Focus
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Bottom Actions */}
          <div className="tasks-bottom-row" style={{ marginTop: 'auto', paddingTop: 6 }}>
            <button type="button" className="btn-pill-action" onClick={onOpenTaskModal}>
              <Plus size={13} /> Add Task
            </button>
            <button
              type="button"
              className="link-action"
              onClick={() => onNavigate('tasks')}
            >
              View All
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
