import { useState, useEffect, useMemo } from 'react'
import { X, Calendar, Clock, Check, Repeat, Plus, Trash2, Wand2 } from 'lucide-react'
import { Task, SubtaskItem, toDateKey } from '../types'
import { parseNaturalLanguageTask, ParsedTaskInput } from '../../../shared/nlParser'
import { DurationPicker } from './DurationPicker'

interface TaskModalProps {
  isOpen: boolean
  onClose: () => void
  task?: Task | null
  defaultDate?: string
  onSave: (taskData: {
    title: string
    description?: string
    dueDate?: string
    dueTime?: string
    priority: 'low' | 'normal' | 'high'
    category?: string
    estimatedMinutes?: number | null
    recurrenceRule?: string | null
    subtasks?: string | null
  }) => Promise<void>
}

function parseSubtasksJson(raw?: string | null): SubtaskItem[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(item => item && typeof item.title === 'string')
      .map((item, idx) => ({
        id: typeof item.id === 'string' ? item.id : `sub-${idx}-${Date.now()}`,
        title: String(item.title),
        done: Boolean(item.done)
      }))
  } catch {
    return []
  }
}

export function TaskModal({ isOpen, onClose, task, defaultDate, onSave }: TaskModalProps) {
  const [nlInput, setNlInput] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [priority, setPriority] = useState<'low' | 'normal' | 'high'>('normal')
  const [category, setCategory] = useState('')
  const [estimatedMinutes, setEstimatedMinutes] = useState<number | ''>('')
  const [recurrenceRule, setRecurrenceRule] = useState<string>('')
  const [subtasks, setSubtasks] = useState<SubtaskItem[]>([])
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
  const [saving, setSaving] = useState(false)

  // Real-time parsed live preview of natural language entry
  const parsedNL = useMemo<ParsedTaskInput>(() => {
    return parseNaturalLanguageTask(nlInput)
  }, [nlInput])

  function applyParsedFields(parsed: ParsedTaskInput) {
    if (parsed.cleanTitle) setTitle(parsed.cleanTitle)
    if (parsed.dueDate) setDueDate(parsed.dueDate)
    if (parsed.dueTime) setDueTime(parsed.dueTime)
    if (parsed.priority) setPriority(parsed.priority)
    if (parsed.category) setCategory(parsed.category)
    if (parsed.estimatedMinutes) {
      setEstimatedMinutes(parsed.estimatedMinutes)
    }
  }

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  useEffect(() => {
    if (task) {
      setNlInput('')
      setTitle(task.title || '')
      setDescription(task.description || '')
      setDueDate(task.due_date || '')
      setDueTime(task.due_time || '')
      setPriority(task.priority || 'normal')
      setCategory(task.category || '')
      const est = task.estimated_minutes ?? ''
      setEstimatedMinutes(est)
      setRecurrenceRule(task.recurrence_rule || '')
      setSubtasks(parseSubtasksJson(task.subtasks))
      setNewSubtaskTitle('')
    } else {
      setNlInput('')
      setTitle('')
      setDescription('')
      setDueDate(defaultDate || toDateKey(new Date()))
      setDueTime('')
      setPriority('normal')
      setCategory('')
      setEstimatedMinutes('')
      setRecurrenceRule('')
      setSubtasks([])
      setNewSubtaskTitle('')
    }
  }, [task, defaultDate, isOpen])

  if (!isOpen) return null

  function handleAddSubtask() {
    const trimmed = newSubtaskTitle.trim()
    if (!trimmed) return
    setSubtasks(prev => [
      ...prev,
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, title: trimmed, done: false }
    ])
    setNewSubtaskTitle('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return

    setSaving(true)
    try {
      await onSave({
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate: dueDate || undefined,
        dueTime: dueTime || undefined,
        priority,
        category: category.trim() || undefined,
        estimatedMinutes: estimatedMinutes === '' ? null : Number(estimatedMinutes),
        recurrenceRule: recurrenceRule || null,
        subtasks: subtasks.length > 0 ? JSON.stringify(subtasks) : null
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label={task ? 'Edit Task' : 'New Task'}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{task ? 'Edit Task' : 'New Task'}</h3>
          <button type="button" className="win-btn" onClick={onClose} aria-label="Close modal">
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Natural Language Quick Entry with Live Preview */}
            {!task && (
              <div
                style={{
                  background: 'var(--accent-purple-bg)',
                  border: '1px solid var(--border-focus)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  marginBottom: 10
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label className="input-label" style={{ color: 'var(--accent-purple)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                    <Wand2 size={13} /> Natural-Language Quick Entry
                  </label>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    Type freely: title, date, time, priority
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="text"
                    className="input-field"
                    placeholder='e.g. "Submit docs tomorrow 5pm high ~45m #Project"'
                    value={nlInput}
                    onChange={e => {
                      setNlInput(e.target.value)
                      const parsed = parseNaturalLanguageTask(e.target.value)
                      if (parsed.cleanTitle) setTitle(parsed.cleanTitle)
                      if (parsed.dueDate) setDueDate(parsed.dueDate)
                      if (parsed.dueTime) setDueTime(parsed.dueTime)
                      if (parsed.priority) setPriority(parsed.priority)
                      if (parsed.category) setCategory(parsed.category)
                      if (parsed.estimatedMinutes) {
                        setEstimatedMinutes(parsed.estimatedMinutes)
                      }
                    }}
                    style={{ background: 'var(--bg-card)' }}
                  />
                  {nlInput.trim() && (
                    <button
                      type="button"
                      className="btn-primary-pill"
                      style={{ padding: '0 10px', fontSize: 11, background: 'var(--accent-purple-btn)', flexShrink: 0 }}
                      onClick={() => applyParsedFields(parsedNL)}
                      title="Apply parsed fields"
                    >
                      <Check size={12} />
                    </button>
                  )}
                </div>

                {/* Live Preview of Parsed Fields */}
                {nlInput.trim() && parsedNL.hasParsedFields && (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 10.5,
                      paddingTop: 4,
                      borderTop: '1px solid rgba(124, 58, 237, 0.2)'
                    }}
                  >
                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Parsed:</span>
                    {parsedNL.cleanTitle && (
                      <span className="priority-badge-pill" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                        Title: {parsedNL.cleanTitle}
                      </span>
                    )}
                    {parsedNL.dueDate && (
                      <span className="priority-badge-pill" style={{ background: 'var(--bg-card)', color: 'var(--accent-purple)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Calendar size={11} /> {parsedNL.dueDate}
                      </span>
                    )}
                    {parsedNL.dueTime && (
                      <span className="priority-badge-pill" style={{ background: 'var(--bg-card)', color: 'var(--accent-cyan)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={11} /> {parsedNL.dueTime}
                      </span>
                    )}
                    {parsedNL.priority && (
                      <span className={`priority-badge-pill ${parsedNL.priority}`}>
                        {parsedNL.priority === 'high' ? 'High Priority' : parsedNL.priority === 'low' ? 'Low Priority' : 'Normal'}
                      </span>
                    )}
                    {parsedNL.estimatedMinutes && (
                      <span className="priority-badge-pill" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={11} /> {parsedNL.estimatedMinutes}m
                      </span>
                    )}
                    {parsedNL.category && (
                      <span className="priority-badge-pill" style={{ background: 'var(--bg-card)', color: 'var(--dot-pink)' }}>
                        #{parsedNL.category}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="input-group">
              <label className="input-label">Task Title *</label>
              <input
                autoFocus={Boolean(task)}
                className="input-field"
                placeholder="What needs to get done?"
                value={title}
                onChange={e => setTitle(e.target.value)}
                maxLength={240}
                required
              />
            </div>

            <div className="input-group">
              <label className="input-label">Description / Notes</label>
              <textarea
                className="textarea-field"
                placeholder="Additional instructions, requirements, or links..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="form-grid-2">
              <div className="input-group">
                <label className="input-label">Due Date</label>
                <input
                  type="date"
                  className="input-field"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                />
              </div>

              <div className="input-group">
                <label className="input-label">Due Time</label>
                <input
                  type="time"
                  className="input-field"
                  value={dueTime}
                  onChange={e => setDueTime(e.target.value)}
                />
              </div>
            </div>

            <div className="form-grid-2">
              <div className="input-group">
                <label className="input-label">Priority</label>
                <select
                  className="select-field"
                  value={priority}
                  onChange={e => setPriority(e.target.value as 'low' | 'normal' | 'high')}
                >
                  <option value="low">Low Priority</option>
                  <option value="normal">Normal Priority</option>
                  <option value="high">High Priority</option>
                </select>
              </div>

              <div className="input-group">
                <label className="input-label">Category / Subject</label>
                <input
                  className="input-field"
                  placeholder="e.g. Math, Revision, Project"
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                />
              </div>
            </div>

            {/* Free Duration Input with Quick-Pick Chips and Validation */}
            <div className="input-group">
              <DurationPicker
                valueMinutes={estimatedMinutes === '' ? null : Number(estimatedMinutes)}
                onChange={mins => setEstimatedMinutes(mins === null ? '' : mins)}
                label="Duration"
                helperText="e.g. 1h 30m, 45m, or 90"
              />
            </div>

            {/* Recurrence */}
            <div className="input-group">
              <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Repeat size={12} /> Repeat
              </label>
              <select
                className="select-field"
                value={recurrenceRule}
                onChange={e => setRecurrenceRule(e.target.value)}
              >
                <option value="">Does not repeat</option>
                <option value="daily">Every day</option>
                <option value="weekdays">Every weekday (Mon-Fri)</option>
                <option value="weekly">Every week</option>
                <option value="monthly">Every month</option>
              </select>
            </div>

            {/* Subtasks Checklist */}
            <div className="input-group">
              <label className="input-label">Subtasks ({subtasks.filter(s => s.done).length}/{subtasks.length})</label>
              {subtasks.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                  {subtasks.map(item => (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '5px 8px',
                        borderRadius: 'var(--radius-xs)',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid var(--border-subtle)'
                      }}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setSubtasks(prev => prev.map(s => (s.id === item.id ? { ...s, done: !s.done } : s)))
                        }
                        aria-label={`Toggle subtask ${item.title}`}
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 4,
                          border: `1.5px solid ${item.done ? 'var(--accent-purple)' : 'var(--border-active)'}`,
                          background: item.done ? 'var(--accent-purple)' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          flexShrink: 0
                        }}
                      >
                        {item.done && <Check size={11} color="#fff" />}
                      </button>
                      <span
                        style={{
                          flex: 1,
                          fontSize: 12,
                          color: item.done ? 'var(--text-muted)' : 'var(--text-primary)',
                          textDecoration: item.done ? 'line-through' : 'none'
                        }}
                      >
                        {item.title}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSubtasks(prev => prev.filter(s => s.id !== item.id))}
                        aria-label={`Remove subtask ${item.title}`}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Add a step or subtask..."
                  value={newSubtaskTitle}
                  onChange={e => setNewSubtaskTitle(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddSubtask()
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleAddSubtask}
                  disabled={!newSubtaskTitle.trim()}
                  title="Add subtask"
                >
                  <Plus size={14} /> Add
                </button>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving || !title.trim()}>
              {saving ? 'Saving…' : task ? 'Update Task' : 'Add Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
