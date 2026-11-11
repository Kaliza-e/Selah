import { useState, useMemo } from 'react'
import {
  Plus,
  Check,
  MoreHorizontal,
  Edit2,
  Trash2,
  Clock,
  Play,
  Calendar,
  AlertCircle,
  Repeat,
  CheckSquare,
  ArrowRight
} from 'lucide-react'
import { Task, SubtaskItem, toDateKey } from '../types'
import { TaskModal } from './TaskModal'
import { PortalMenu } from './PortalMenu'
import { formatTaskDate, isTaskOverdue } from '../lib/dateUtils'
import { formatDurationDisplay } from '../lib/durationUtils'

interface TasksViewProps {
  tasks: Task[]
  today: Date
  onToggleTask: (task: Task) => void
  onDeleteTask: (id: number) => void
  onRefreshTasks: () => Promise<void>
  onShowMessage: (msg: string) => void
  onOpenFocusTimer?: (task: Task) => void
  onScheduleTask?: (task: Task) => void
}

type FilterTab = 'all' | 'today' | 'tomorrow' | 'upcoming' | 'completed'

export function TasksView({
  tasks,
  today,
  onToggleTask,
  onDeleteTask,
  onRefreshTasks,
  onShowMessage,
  onOpenFocusTimer,
  onScheduleTask
}: TasksViewProps) {
  const [filter, setFilter] = useState<FilterTab>('today')
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [menuAnchor, setMenuAnchor] = useState<{ rect: DOMRect; task: Task } | null>(null)

  const todayKey = toDateKey(today)
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const tomorrowKey = toDateKey(tomorrow)

  const in7Days = new Date(today)
  in7Days.setDate(today.getDate() + 7)
  const in7DaysKey = toDateKey(in7Days)

  const overdueCount = useMemo(() => {
    return tasks.filter(t => isTaskOverdue(t.due_date, t.due_time, t.completed, today)).length
  }, [tasks, today])

  async function handleRolloverOverdue() {
    const moved = await window.hello11824.rescheduleOverdueTasks(todayKey)
    await onRefreshTasks()
    onShowMessage(`Moved ${moved} overdue task${moved === 1 ? '' : 's'} to today.`)
  }

  // Filter tasks with completed sorted to bottom and overdue prioritization
  const filteredTasks = useMemo(() => {
    const list = tasks.filter(t => {
      if (filter === 'completed') return t.completed === 1
      if (filter === 'today') return t.due_date === todayKey || t.due_date === null
      if (filter === 'tomorrow') return t.due_date === tomorrowKey
      if (filter === 'upcoming') {
        return !t.completed && t.due_date && t.due_date >= todayKey && t.due_date <= in7DaysKey
      }
      return true
    })

    return list.sort((a, b) => {
      // Completed tasks always sorted to the bottom
      const aDone = a.completed ? 1 : 0
      const bDone = b.completed ? 1 : 0
      if (aDone !== bDone) return aDone - bDone

      // Overdue uncompleted tasks sorted higher
      const aOverdue = isTaskOverdue(a.due_date, a.due_time, a.completed, today)
      const bOverdue = isTaskOverdue(b.due_date, b.due_time, b.completed, today)
      if (aOverdue && !bOverdue) return -1
      if (!aOverdue && bOverdue) return 1

      // Then sort chronologically by date and time
      const aDate = a.due_date || '9999-99-99'
      const bDate = b.due_date || '9999-99-99'
      if (aDate !== bDate) return aDate.localeCompare(bDate)
      return (a.due_time || '').localeCompare(b.due_time || '')
    })
  }, [tasks, filter, todayKey, tomorrowKey, in7DaysKey, today])

  async function handleSaveTask(data: any) {
    if (editingTask) {
      await window.hello11824.updateTask(editingTask.id, data)
      onShowMessage(`Updated "${data.title}"`)
    } else {
      await window.hello11824.addTask(data)
      onShowMessage(`Added "${data.title}"`)
    }
    await onRefreshTasks()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Top Header */}
      <div className="view-top-header">
        <h2 className="view-page-title">Tasks</h2>
        <button
          className="btn-primary-pill"
          onClick={() => {
            setEditingTask(null)
            setShowTaskModal(true)
          }}
        >
          <Plus size={13} /> Add Task
        </button>
      </div>

      {/* Filter Pills */}
      <div className="day-pills-row">
        {(
          [
            { id: 'all', label: 'All' },
            { id: 'today', label: 'Today' },
            { id: 'tomorrow', label: 'Tomorrow' },
            { id: 'upcoming', label: 'Upcoming' },
            { id: 'completed', label: 'Completed' }
          ] as const
        ).map(tab => (
          <button
            key={tab.id}
            className={`day-pill-btn ${filter === tab.id ? 'active' : ''}`}
            onClick={() => setFilter(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overdue Rollover Banner */}
      {overdueCount > 0 && filter !== 'completed' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(244, 63, 94, 0.1)',
            border: '1px solid rgba(244, 63, 94, 0.28)'
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#fda4af', fontWeight: 600 }}>
            <AlertCircle size={14} color="#f43f5e" />
            {overdueCount} overdue task{overdueCount === 1 ? '' : 's'} from earlier dates
          </span>
          <button
            type="button"
            className="btn-secondary-pill"
            onClick={handleRolloverOverdue}
            style={{ fontSize: 11.5, padding: '4px 10px', borderColor: 'rgba(244, 63, 94, 0.4)', color: '#fda4af' }}
          >
            Move all to today <ArrowRight size={12} />
          </button>
        </div>
      )}

      {/* Tasks Table */}
      <div className="data-table-container">
        {filteredTasks.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            No tasks found in this view. Click "Add Task" to create one!
          </div>
        ) : (
          filteredTasks.map(t => {
            const timeText = formatTaskDate(t.due_date, t.due_time, today)
            const isOverdue = isTaskOverdue(t.due_date, t.due_time, t.completed, today)
            let parsedSubtasks: SubtaskItem[] = []
            if (t.subtasks) {
              try {
                const arr = JSON.parse(t.subtasks)
                if (Array.isArray(arr)) parsedSubtasks = arr
              } catch {
                parsedSubtasks = []
              }
            }
            const doneSubtasks = parsedSubtasks.filter(s => s.done).length

            return (
              <div
                key={t.id}
                className="table-row"
                style={{
                  gridTemplateColumns: 'auto 1fr auto auto auto 36px',
                  gap: 12,
                  position: 'relative',
                  alignItems: 'center'
                }}
              >
                {/* Checkbox */}
                <button
                  className={`task-checkbox-btn ${t.completed ? 'checked' : ''}`}
                  onClick={() => onToggleTask(t)}
                  aria-label={t.completed ? 'Mark incomplete' : 'Mark complete'}
                >
                  {t.completed ? <Check size={12} strokeWidth={3} /> : null}
                </button>

                {/* Title and metadata */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' }}>
                  <span
                    style={{
                      color: t.completed ? 'var(--text-muted)' : 'var(--text-primary)',
                      textDecoration: t.completed ? 'line-through' : 'none',
                      fontWeight: 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {t.title}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10.5, flexWrap: 'wrap' }}>
                    {t.scheduled_date && (
                      <span style={{ color: 'var(--accent-purple)', fontWeight: 600 }}>
                        {t.scheduled_date === todayKey ? 'Today' : t.scheduled_date} {t.scheduled_time || ''}
                      </span>
                    )}
                    {t.recurrence_rule && (
                      <span
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--accent-purple)' }}
                        title={`Repeats ${t.recurrence_rule}`}
                      >
                        <Repeat size={10} /> {t.recurrence_rule}
                      </span>
                    )}
                    {parsedSubtasks.length > 0 && (
                      <span
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--text-secondary)' }}
                        title="Subtasks completed"
                      >
                        <CheckSquare size={10} /> {doneSubtasks}/{parsedSubtasks.length}
                      </span>
                    )}
                    {t.total_time_spent_seconds && t.total_time_spent_seconds > 0 ? (
                      <span style={{ color: 'var(--accent-cyan)' }}>
                        {Math.round(t.total_time_spent_seconds / 60)}m studied
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Priority Dot & Duration Badges */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifySelf: 'end' }}>
                  {t.estimated_minutes ? (
                    <span
                      className="duration-badge-pill"
                      title={`Estimated time: ${t.estimated_minutes} minutes`}
                    >
                      <Clock size={10} /> {formatDurationDisplay(t.estimated_minutes)}
                    </span>
                  ) : null}

                  {/* Priority as a clean dot for High or Low only, hidden for default Medium */}
                  {t.priority === 'high' ? (
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: '#f43f5e',
                        display: 'inline-block'
                      }}
                      title="High Priority"
                    />
                  ) : t.priority === 'low' ? (
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: '#10b981',
                        display: 'inline-block'
                      }}
                      title="Low Priority"
                    />
                  ) : null}
                </div>

                {/* Due Time & Overdue Badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifySelf: 'end' }}>
                  {isOverdue && (
                    <span
                      style={{
                        background: 'rgba(244, 63, 94, 0.15)',
                        color: '#f43f5e',
                        border: '1px solid rgba(244, 63, 94, 0.3)',
                        padding: '1px 6px',
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 700
                      }}
                    >
                      Overdue
                    </span>
                  )}
                  <span style={{ fontSize: 11, color: isOverdue ? '#f43f5e' : 'var(--text-secondary)', minWidth: 70, textAlign: 'right' }}>
                    {timeText}
                  </span>
                </div>

                {/* Quick Action Buttons (Focus & Schedule) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifySelf: 'end' }}>
                  {!t.completed && (
                    <>
                      <button
                        className="win-btn"
                        style={{ width: 24, height: 24, color: 'var(--accent-purple)' }}
                        onClick={() => onOpenFocusTimer?.(t)}
                        title="Start Focus Timer"
                        aria-label="Start Focus Timer"
                      >
                        <Play size={12} style={{ fill: 'currentColor' }} />
                      </button>
                      <button
                        className="win-btn"
                        style={{ width: 24, height: 24 }}
                        onClick={() => onScheduleTask?.(t)}
                        title="Schedule into Slot"
                        aria-label="Schedule into Slot"
                      >
                        <Calendar size={12} />
                      </button>
                    </>
                  )}
                </div>

                {/* 3-dots Menu Button */}
                <div style={{ justifySelf: 'end' }}>
                  <button
                    className="win-btn"
                    style={{ width: 24, height: 24 }}
                    onClick={(e) => {
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                      setMenuAnchor(menuAnchor?.task.id === t.id ? null : { rect, task: t })
                    }}
                    title="Task options"
                    aria-label="Task options"
                  >
                    <MoreHorizontal size={14} color="var(--text-muted)" />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Task Dropdown Portal Menu with collision detection */}
      <PortalMenu
        isOpen={Boolean(menuAnchor)}
        anchorRect={menuAnchor?.rect || null}
        onClose={() => setMenuAnchor(null)}
        minWidth={130}
      >
        {menuAnchor && (
          <>
            {!menuAnchor.task.completed && (
              <>
                <button
                  className="sidebar-nav-item"
                  style={{ padding: '6px 10px', fontSize: 11.5 }}
                  onClick={() => {
                    const task = menuAnchor.task
                    setMenuAnchor(null)
                    onOpenFocusTimer?.(task)
                  }}
                >
                  <Play size={11} /> Focus Timer
                </button>
                <button
                  className="sidebar-nav-item"
                  style={{ padding: '6px 10px', fontSize: 11.5 }}
                  onClick={() => {
                    const task = menuAnchor.task
                    setMenuAnchor(null)
                    onScheduleTask?.(task)
                  }}
                >
                  <Calendar size={11} /> Schedule
                </button>
              </>
            )}
            <button
              className="sidebar-nav-item"
              style={{ padding: '6px 10px', fontSize: 11.5 }}
              onClick={() => {
                const task = menuAnchor.task
                setMenuAnchor(null)
                setEditingTask(task)
                setShowTaskModal(true)
              }}
            >
              <Edit2 size={11} /> Edit
            </button>
            <button
              className="sidebar-nav-item"
              style={{ padding: '6px 10px', fontSize: 11.5, color: 'var(--priority-high-text)' }}
              onClick={() => {
                const taskId = menuAnchor.task.id
                setMenuAnchor(null)
                onDeleteTask(taskId)
              }}
            >
              <Trash2 size={11} /> Delete
            </button>
          </>
        )}
      </PortalMenu>

      {/* Task Modal */}
      <TaskModal
        isOpen={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        task={editingTask}
        defaultDate={todayKey}
        onSave={handleSaveTask}
      />
    </div>
  )
}
