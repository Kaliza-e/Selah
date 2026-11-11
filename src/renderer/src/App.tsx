import { useEffect, useState, useCallback } from 'react'
import {
  CalendarDays,
  ListTodo,
  BarChart3,
  Settings as SettingsIcon,
  Home,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react'
import { Task, ClassItem, ActiveTab, toDateKey } from './types'
import { APP_CONFIG } from '../../shared/appConfig'
import { TitleBar } from './components/TitleBar'
import { TodayView } from './components/TodayView'
import { TimetableManager } from './components/TimetableManager'
import { SchedulesView } from './components/SchedulesView'
import { TasksView } from './components/TasksView'
import { TomorrowPlanner } from './components/TomorrowPlanner'
import { WeeklyOverview } from './components/WeeklyOverview'
import { SettingsView } from './components/SettingsView'
import { TaskModal } from './components/TaskModal'
import { SubjectModal } from './components/SubjectModal'
import { FocusViewModal } from './components/FocusViewModal'
import { ScheduleTaskModal } from './components/ScheduleTaskModal'
import { Toast, ToastData } from './components/Toast'
import { ScheduleCreatorModal } from './components/ScheduleCreatorModal'

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('today')
  const [tasks, setTasks] = useState<Task[]>([])
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [pinned, setPinned] = useState(false)
  const [widgetMode, setWidgetMode] = useState<'compact' | 'standard'>('compact')
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [uiScale, setUiScale] = useState<'90' | '100' | '115' | '130'>('100')
  const [userName, setUserName] = useState('')
  const [toast, setToast] = useState<ToastData | null>(null)
  const [today, setToday] = useState(new Date())

  // Apply UI scale cleanly across the root document
  useEffect(() => {
    const scaleFactor = Number(uiScale) / 100
    ;(document.documentElement.style as unknown as Record<string, string>).zoom = String(scaleFactor)
  }, [uiScale])

  const showToast = useCallback((
    msg: string,
    action?: { label: string; onAction: () => void },
    durationMs = 4000
  ) => {
    setToast({
      id: `${Date.now()}-${Math.random()}`,
      message: msg,
      action,
      durationMs
    })
  }, [])

  // Auto-dismiss toast when switching navigation screens
  useEffect(() => {
    setToast(null)
  }, [activeTab])

  // Modals & Active Focus
  const [showGlobalTaskModal, setShowGlobalTaskModal] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [showGlobalClassModal, setShowGlobalClassModal] = useState(false)
  const [focusTask, setFocusTask] = useState<Task | null>(null)
  const [schedulingTask, setSchedulingTask] = useState<Task | null>(null)
  const [scheduleCreatorParams, setScheduleCreatorParams] = useState<{
    isOpen: boolean
    template?: 'study_plan' | 'exam_prep' | 'weekly_plan' | 'custom'
    subject?: string
    date?: string
  }>({ isOpen: false })

  // Dynamic live clock ticker
  useEffect(() => {
    const clockTimer = setInterval(() => {
      setToday(new Date())
    }, 15_000)
    return () => clearInterval(clockTimer)
  }, [])

  // Initial data loading from SQLite
  const loadData = useCallback(async () => {
    try {
      const api = window.hello11824
      if (!api) return

      const [tList, cList, pinSetting, modeSetting, themeSetting, sidebarSetting, scaleSetting, nameSetting] = await Promise.all([
        api.listTasks(),
        api.listClasses(),
        api.getSetting('pinned'),
        api.getSetting('widget_mode'),
        api.getSetting('theme'),
        api.getSetting('sidebar_collapsed'),
        api.getSetting('ui_scale'),
        api.getSetting('user_name')
      ])

      setTasks(tList || [])
      setClasses(cList || [])

      if (pinSetting !== null && pinSetting !== undefined) {
        setPinned(pinSetting === 'true')
      }
      if (modeSetting === 'compact' || modeSetting === 'standard') {
        setWidgetMode(modeSetting)
      }
      if (sidebarSetting === 'true') {
        setSidebarCollapsed(true)
      }
      if (scaleSetting === '90' || scaleSetting === '100' || scaleSetting === '115' || scaleSetting === '130') {
        setUiScale(scaleSetting)
      }
      if (typeof nameSetting === 'string') {
        setUserName(nameSetting)
      }
      if (themeSetting === 'light' || themeSetting === 'dark') {
        setTheme(themeSetting)
        document.documentElement.setAttribute('data-theme', themeSetting)
      } else {
        document.documentElement.setAttribute('data-theme', 'dark')
      }
    } catch (err) {
      console.error('Failed to load data:', err)
      showToast(`Could not load saved data. Restart ${APP_CONFIG.name} and try again.`, undefined, 6000)
    }
  }, [])

  useEffect(() => {
    loadData()

    const unsubMode = window.hello11824?.onModeChanged?.((mode?: 'compact' | 'standard') => {
      if (mode) {
        setWidgetMode(mode)
      } else {
        setWidgetMode(prev => (prev === 'compact' ? 'standard' : 'compact'))
      }
    })

    const unsubPin = window.hello11824?.onPinnedChanged?.((next: boolean) => {
      setPinned(next)
    })

    return () => {
      unsubMode?.()
      unsubPin?.()
    }
  }, [loadData])

  const refreshTasks = useCallback(async () => {
    const updated = await window.hello11824.listTasks()
    setTasks(updated)
  }, [])

  const refreshClasses = useCallback(async () => {
    const updated = await window.hello11824.listClasses()
    setClasses(updated)
  }, [])

  const handleTogglePin = useCallback(async () => {
    const next = !pinned
    setPinned(next)
    await window.hello11824.togglePin(next)
  }, [pinned])

  const handleToggleMode = useCallback(async () => {
    const next = widgetMode === 'compact' ? 'standard' : 'compact'
    setWidgetMode(next)
    await window.hello11824.setMode(next)
  }, [widgetMode])

  const handleToggleTheme = useCallback(async () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    await window.hello11824.setSetting('theme', next)
  }, [theme])

  const handleSetTheme = useCallback(async (newTheme: 'dark' | 'light') => {
    setTheme(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
    await window.hello11824.setSetting('theme', newTheme)
  }, [])

  const handleToggleSidebar = useCallback(async () => {
    const next = !sidebarCollapsed
    setSidebarCollapsed(next)
    await window.hello11824.setSetting('sidebar_collapsed', String(next))
  }, [sidebarCollapsed])

  const handleSetUiScale = useCallback(async (newScale: '90' | '100' | '115' | '130') => {
    setUiScale(newScale)
    await window.hello11824.setSetting('ui_scale', newScale)
  }, [])

  const handleSetUserName = useCallback(async (name: string) => {
    setUserName(name)
    await window.hello11824.setSetting('user_name', name.trim())
  }, [])

  const handleToggleTask = useCallback(
    async (task: Task) => {
      const nextCompleted = !Boolean(task.completed)
      await window.hello11824.toggleTask(task.id, nextCompleted)
      await refreshTasks()
    },
    [refreshTasks]
  )

  const handleDeleteTask = useCallback(
    async (id: number) => {
      const taskToDelete = tasks.find(t => t.id === id)
      await window.hello11824.deleteTask(id)
      await refreshTasks()
      if (taskToDelete) {
        showToast(`Deleted "${taskToDelete.title}"`, {
          label: 'Undo',
          onAction: async () => {
            await window.hello11824.addTask({
              title: taskToDelete.title,
              description: taskToDelete.description || undefined,
              dueDate: taskToDelete.due_date || undefined,
              dueTime: taskToDelete.due_time || undefined,
              priority: taskToDelete.priority,
              category: taskToDelete.category || undefined,
              estimatedMinutes: taskToDelete.estimated_minutes
            })
            await refreshTasks()
          }
        }, 5000)
      } else {
        showToast('Task deleted.')
      }
    },
    [tasks, refreshTasks, showToast]
  )

  const handleOpenTaskForEdit = useCallback((task: Task) => {
    setEditingTask(task)
    setShowGlobalTaskModal(true)
  }, [])

  const handleSaveGlobalTask = useCallback(
    async (taskData: any) => {
      if (editingTask) {
        await window.hello11824.updateTask(editingTask.id, taskData)
        showToast(`Updated "${taskData.title}"`)
      } else {
        await window.hello11824.addTask(taskData)
        showToast(`Added "${taskData.title}"`)
      }
      setEditingTask(null)
      await refreshTasks()
    },
    [editingTask, refreshTasks, showToast]
  )

  const handleCreateClass = useCallback(
    async (classData: any) => {
      await window.hello11824.addClass(classData)
      await refreshClasses()
      showToast(`Added "${classData.title}" to timetable.`)
    },
    [refreshClasses, showToast]
  )

  const handleScheduleTaskSave = useCallback(
    async (taskId: number, date: string, time?: string, durationMinutes?: number) => {
      await window.hello11824.scheduleTask(taskId, date, time, durationMinutes)
      setSchedulingTask(null)
      await refreshTasks()
      showToast('Task scheduled into timetable slot.')
    },
    [refreshTasks, showToast]
  )

  const handleTaskCompleted = useCallback(
    async (task: Task, timeSpentSeconds: number) => {
      await window.hello11824.updateTask(task.id, { completed: true })
      await refreshTasks()
      const mins = Math.round(timeSpentSeconds / 60)
      showToast(`Completed "${task.title}" (${mins}m studied).`, {
        label: 'Undo',
        onAction: async () => {
          await window.hello11824.updateTask(task.id, { completed: false })
          await refreshTasks()
        }
      }, 5000)
    },
    [refreshTasks, showToast]
  )

  function handleOpenRevisionPlan(examSubject: string, examDate: string) {
    setScheduleCreatorParams({
      isOpen: true,
      template: 'exam_prep',
      subject: examSubject,
      date: examDate
    })
  }

  const isCompactMode = widgetMode === 'compact'

  return (
    <div className={`widget-window mode-${widgetMode}`} data-theme={theme}>
      {/* Titlebar with real brand icon and theme switcher */}
      <TitleBar
        pinned={pinned}
        onTogglePin={handleTogglePin}
        widgetMode={widgetMode}
        onToggleMode={handleToggleMode}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      {/* Main Container: Compact Floating Widget or Full Application Dashboard */}
      {isCompactMode ? (
        // ================= COMPACT FLOATING WIDGET VIEW =================
        <div className="widget-body-compact">
          <TodayView
            today={today}
            classes={classes}
            tasks={tasks}
            userName={userName}
            isCompact={true}
            onToggleTask={handleToggleTask}
            onNavigate={tab => {
              setActiveTab(tab)
              handleToggleMode()
            }}
            onOpenTaskModal={() => {
              setEditingTask(null)
              setShowGlobalTaskModal(true)
            }}
            onOpenClassModal={() => setShowGlobalClassModal(true)}
            onExpandApp={handleToggleMode}
            onOpenTaskDetails={handleOpenTaskForEdit}
            onRefreshTasks={refreshTasks}
            onShowMessage={showToast}
            onOpenFocusTimer={task => setFocusTask(task)}
            onScheduleTask={task => setSchedulingTask(task)}
            onOpenRevisionPlan={handleOpenRevisionPlan}
          />
        </div>
      ) : (
        // ================= FULL APPLICATION DASHBOARD VIEW =================
        <div className="dashboard-layout">
          {/* Left Responsive Sidebar / Rail / Bottom Nav */}
          <aside className={`dashboard-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
            {/* Consolidated 5-Item Navigation Links */}
            <nav className="sidebar-nav-list" aria-label="Primary Navigation" style={{ flex: 1 }}>
              <button
                type="button"
                className={`sidebar-nav-item ${activeTab === 'today' ? 'active' : ''}`}
                onClick={() => setActiveTab('today')}
                title="Home"
                aria-label="Home"
              >
                <Home size={16} /> <span className="sidebar-nav-label">Home</span>
              </button>

              <button
                type="button"
                className={`sidebar-nav-item ${activeTab === 'schedules' || activeTab === 'timetable' ? 'active' : ''}`}
                onClick={() => setActiveTab(activeTab === 'timetable' ? 'timetable' : 'schedules')}
                title="Schedule & Timetable"
                aria-label="Schedule"
              >
                <CalendarDays size={16} /> <span className="sidebar-nav-label">Schedule</span>
              </button>

              <button
                type="button"
                className={`sidebar-nav-item ${activeTab === 'tasks' || activeTab === 'plan' ? 'active' : ''}`}
                onClick={() => setActiveTab(activeTab === 'plan' ? 'plan' : 'tasks')}
                title="Tasks & Tomorrow Planner"
                aria-label="Tasks"
              >
                <ListTodo size={16} /> <span className="sidebar-nav-label">Tasks</span>
              </button>

              <button
                type="button"
                className={`sidebar-nav-item ${activeTab === 'weekly' ? 'active' : ''}`}
                onClick={() => setActiveTab('weekly')}
                title="Weekly Overview & Stats"
                aria-label="Weekly"
              >
                <BarChart3 size={16} /> <span className="sidebar-nav-label">Weekly</span>
              </button>

              <button
                type="button"
                className={`sidebar-nav-item ${activeTab === 'settings' ? 'active' : ''}`}
                onClick={() => setActiveTab('settings')}
                title="Settings"
                aria-label="Settings"
              >
                <SettingsIcon size={16} /> <span className="sidebar-nav-label">Settings</span>
              </button>
            </nav>

            <button
              type="button"
              className="sidebar-collapse-btn"
              onClick={handleToggleSidebar}
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
              <span className="sidebar-nav-label">{sidebarCollapsed ? 'Expand' : 'Collapse'}</span>
            </button>
          </aside>

          {/* Right Main Content */}
          <main className="dashboard-main-area">
            {activeTab === 'today' && (
              <TodayView
                today={today}
                classes={classes}
                tasks={tasks}
                userName={userName}
                isCompact={false}
                onToggleTask={handleToggleTask}
                onNavigate={setActiveTab}
                onOpenTaskModal={() => {
                  setEditingTask(null)
                  setShowGlobalTaskModal(true)
                }}
                onOpenClassModal={() => setShowGlobalClassModal(true)}
                onOpenTaskDetails={handleOpenTaskForEdit}
                onRefreshTasks={refreshTasks}
                onShowMessage={showToast}
                onOpenFocusTimer={task => setFocusTask(task)}
                onScheduleTask={task => setSchedulingTask(task)}
                onOpenRevisionPlan={handleOpenRevisionPlan}
              />
            )}

            {(activeTab === 'schedules' || activeTab === 'timetable') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', minHeight: 0 }}>
                <div className="subnav-bar">
                  <div className="day-pills-row">
                    <button
                      type="button"
                      className={`day-pill-btn ${activeTab === 'schedules' ? 'active' : ''}`}
                      onClick={() => setActiveTab('schedules')}
                    >
                      Events & Calendars
                    </button>
                    <button
                      type="button"
                      className={`day-pill-btn ${activeTab === 'timetable' ? 'active' : ''}`}
                      onClick={() => setActiveTab('timetable')}
                    >
                      Weekly Timetable
                    </button>
                  </div>
                </div>

                {activeTab === 'schedules' ? (
                  <SchedulesView onShowMessage={showToast} />
                ) : (
                  <TimetableManager
                    classes={classes}
                    onRefreshClasses={refreshClasses}
                    onShowMessage={showToast}
                  />
                )}
              </div>
            )}

            {(activeTab === 'tasks' || activeTab === 'plan') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', minHeight: 0 }}>
                <div className="subnav-bar">
                  <div className="day-pills-row">
                    <button
                      type="button"
                      className={`day-pill-btn ${activeTab === 'tasks' ? 'active' : ''}`}
                      onClick={() => setActiveTab('tasks')}
                    >
                      All Tasks
                    </button>
                    <button
                      type="button"
                      className={`day-pill-btn ${activeTab === 'plan' ? 'active' : ''}`}
                      onClick={() => setActiveTab('plan')}
                    >
                      Tomorrow Planner
                    </button>
                  </div>
                </div>

                {activeTab === 'tasks' ? (
                  <TasksView
                    tasks={tasks}
                    today={today}
                    onToggleTask={handleToggleTask}
                    onDeleteTask={handleDeleteTask}
                    onRefreshTasks={refreshTasks}
                    onShowMessage={showToast}
                    onOpenFocusTimer={task => setFocusTask(task)}
                    onScheduleTask={task => setSchedulingTask(task)}
                  />
                ) : (
                  <TomorrowPlanner
                    today={today}
                    classes={classes}
                    tasks={tasks}
                    onRefreshTasks={refreshTasks}
                    onToggleTask={handleToggleTask}
                    onDeleteTask={handleDeleteTask}
                    onShowMessage={showToast}
                    onOpenFocusTimer={task => setFocusTask(task)}
                    onScheduleTask={task => setSchedulingTask(task)}
                  />
                )}
              </div>
            )}

            {activeTab === 'weekly' && (
              <WeeklyOverview
                today={today}
                classes={classes}
                tasks={tasks}
                onNavigatePlan={() => setActiveTab('plan')}
                onOpenTaskModal={() => setShowGlobalTaskModal(true)}
                onOpenFocusTimer={task => setFocusTask(task)}
                onScheduleTask={task => setSchedulingTask(task)}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsView
                pinned={pinned}
                onTogglePin={handleTogglePin}
                widgetMode={widgetMode}
                onToggleMode={handleToggleMode}
                theme={theme}
                onThemeChange={handleSetTheme}
                uiScale={uiScale}
                onUiScaleChange={handleSetUiScale}
                userName={userName}
                onUserNameChange={handleSetUserName}
                onRefreshAll={async () => {
                  await Promise.all([refreshTasks(), refreshClasses()])
                }}
                onShowMessage={showToast}
              />
            )}
          </main>
        </div>
      )}

      {/* Global Add / Edit Task Modal */}
      <TaskModal
        isOpen={showGlobalTaskModal || editingTask !== null}
        onClose={() => {
          setShowGlobalTaskModal(false)
          setEditingTask(null)
        }}
        task={editingTask}
        defaultDate={toDateKey(today)}
        onSave={handleSaveGlobalTask}
      />

      {/* Global Add Subject Modal */}
      <SubjectModal
        isOpen={showGlobalClassModal}
        onClose={() => setShowGlobalClassModal(false)}
        defaultWeekday={today.getDay()}
        onSave={handleCreateClass}
      />

      {/* Phase 2: Focus View Timer Modal */}
      <FocusViewModal
        isOpen={focusTask !== null}
        onClose={() => setFocusTask(null)}
        task={focusTask}
        onTaskCompleted={handleTaskCompleted}
        onShowMessage={showToast}
      />

      {/* Phase 2: Schedule Task Slot Modal */}
      <ScheduleTaskModal
        isOpen={schedulingTask !== null}
        onClose={() => setSchedulingTask(null)}
        task={schedulingTask}
        classes={classes}
        today={today}
        onSaveSchedule={handleScheduleTaskSave}
      />

      {/* Phase 3 & 4: In-App Schedule Creator & Auto Revision Planner */}
      <ScheduleCreatorModal
        isOpen={scheduleCreatorParams.isOpen}
        onClose={() => setScheduleCreatorParams({ isOpen: false })}
        initialTemplate={scheduleCreatorParams.template}
        initialSubject={scheduleCreatorParams.subject}
        initialDate={scheduleCreatorParams.date}
        onSaveEvents={async (newEvents) => {
          try {
            const res = await window.hello11824.batchSaveScheduleEvents({ events: newEvents })
            showToast(`Created ${res.savedCount || newEvents.length} events for ${scheduleCreatorParams.subject || 'schedule'}!`)
            setScheduleCreatorParams({ isOpen: false })
            setActiveTab('schedules')
          } catch (err) {
            showToast(`Error saving schedule: ${err instanceof Error ? err.message : String(err)}`)
          }
        }}
        onShowMessage={showToast}
      />

      {/* Universal Auto-dismissing Toast with Undo action and Hover-pause */}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
