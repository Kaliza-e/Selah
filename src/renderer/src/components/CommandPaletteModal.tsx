import { useState, useEffect, useMemo, useRef } from 'react'
import {
  Search,
  Home,
  CalendarDays,
  CheckSquare,
  Settings,
  Plus,
  Play,
  Sun,
  Calendar,
  CornerDownLeft
} from 'lucide-react'
import type { ActiveTab, Task } from '../types'

interface CommandPaletteModalProps {
  isOpen: boolean
  onClose: () => void
  tasks: Task[]
  onNavigate: (tab: ActiveTab) => void
  onOpenNewTask: () => void
  onToggleTheme: () => void
  onOpenFocusTimer: (task: Task) => void
}

interface CommandItem {
  id: string
  label: string
  category: string
  hint?: string
  icon: typeof Home
  action: () => void
}

export function CommandPaletteModal({
  isOpen,
  onClose,
  tasks,
  onNavigate,
  onOpenNewTask,
  onToggleTheme,
  onOpenFocusTimer
}: CommandPaletteModalProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 20)
    }
  }, [isOpen])

  const pendingTasks = useMemo(() => tasks.filter(t => !t.completed), [tasks])

  const allItems = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [
      {
        id: 'act-new-task',
        label: 'New Task',
        category: 'Quick Action',
        hint: 'Ctrl+Shift+Space',
        icon: Plus,
        action: () => {
          onClose()
          onOpenNewTask()
        }
      },
      {
        id: 'nav-today',
        label: 'Go to Home',
        category: 'Navigation',
        icon: Home,
        action: () => {
          onNavigate('today')
          onClose()
        }
      },
      {
        id: 'nav-timetable',
        label: 'Go to Timetable',
        category: 'Navigation',
        icon: Calendar,
        action: () => {
          onNavigate('timetable')
          onClose()
        }
      },
      {
        id: 'nav-schedules',
        label: 'Go to Schedules',
        category: 'Navigation',
        icon: CalendarDays,
        action: () => {
          onNavigate('schedules')
          onClose()
        }
      },
      {
        id: 'nav-tasks',
        label: 'Go to Tasks',
        category: 'Navigation',
        icon: CheckSquare,
        action: () => {
          onNavigate('tasks')
          onClose()
        }
      },
      {
        id: 'nav-settings',
        label: 'Go to Settings',
        category: 'Navigation',
        icon: Settings,
        action: () => {
          onNavigate('settings')
          onClose()
        }
      },
      {
        id: 'act-theme',
        label: 'Toggle Dark / Light Theme',
        category: 'Appearance',
        icon: Sun,
        action: () => {
          onToggleTheme()
          onClose()
        }
      }
    ]

    pendingTasks.slice(0, 8).forEach(t => {
      items.push({
        id: `focus-task-${t.id}`,
        label: `Focus: ${t.title}`,
        category: 'Tasks',
        hint: t.due_date || 'No date',
        icon: Play,
        action: () => {
          onClose()
          onOpenFocusTimer(t)
        }
      })
    })

    return items
  }, [pendingTasks, onClose, onOpenNewTask, onNavigate, onToggleTheme, onOpenFocusTimer])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allItems
    return allItems.filter(
      item =>
        item.label.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    )
  }, [allItems, query])

  useEffect(() => {
    if (selectedIndex >= filtered.length) {
      setSelectedIndex(Math.max(0, filtered.length - 1))
    }
  }, [filtered.length, selectedIndex])

  if (!isOpen) return null

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (filtered.length ? (prev + 1) % filtered.length : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (filtered.length ? (prev - 1 + filtered.length) % filtered.length : 0))
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      e.preventDefault()
      filtered[selectedIndex].action()
    }
  }

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
      style={{ alignItems: 'flex-start', paddingTop: '12vh' }}
    >
      <div
        className="modal-content"
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        style={{
          maxWidth: 480,
          width: '92vw',
          padding: 0,
          overflow: 'hidden',
          boxShadow: '0 22px 50px rgba(0, 0, 0, 0.65)'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 14px',
            borderBottom: '1px solid var(--border-subtle)'
          }}
        >
          <Search size={15} color="var(--accent-purple)" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            placeholder="Type a command, screen, or task..."
            aria-label="Search commands and tasks"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: 13
            }}
          />
          <span
            style={{
              fontSize: 10,
              color: 'var(--text-muted)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 4,
              padding: '2px 5px'
            }}
          >
            Esc
          </span>
        </div>

        <div style={{ maxHeight: 320, overflowY: 'auto', padding: 6 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '24px 12px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
              No matching commands or tasks.
            </div>
          ) : (
            filtered.map((item, idx) => {
              const Icon = item.icon
              const active = idx === selectedIndex
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-xs)',
                    border: 'none',
                    background: active ? 'var(--accent-purple-bg)' : 'transparent',
                    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                    <Icon size={14} color={active ? 'var(--accent-purple)' : 'var(--text-muted)'} />
                    <span style={{ fontSize: 12.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.label}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                      {item.hint || item.category}
                    </span>
                    {active && <CornerDownLeft size={11} color="var(--accent-purple)" />}
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

