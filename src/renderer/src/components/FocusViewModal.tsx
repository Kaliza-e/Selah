import { useState, useEffect, useRef } from 'react'
import {
  X,
  Play,
  Pause,
  Square,
  CheckCircle2,
  Clock,
  Coffee,
  Volume2,
  VolumeX,
  Timer as TimerIcon
} from 'lucide-react'
import { Task, ActiveTimer } from '../types'

interface FocusViewModalProps {
  isOpen: boolean
  onClose: () => void
  task: Task | null
  onTaskCompleted: (task: Task, timeSpentSeconds: number) => void
  onShowMessage: (msg: string) => void
  onTimerSync?: () => void
}

function playFocusChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const now = ctx.currentTime
    ;[523.25, 659.25].forEach((freq, idx) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now + idx * 0.16)
      gain.gain.setValueAtTime(0.001, now + idx * 0.16)
      gain.gain.exponentialRampToValueAtTime(0.14, now + idx * 0.16 + 0.04)
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.16 + 0.7)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + idx * 0.16)
      osc.stop(now + idx * 0.16 + 0.72)
    })
  } catch {
    // Ignore audio context autoplay restrictions
  }
}

export function FocusViewModal({
  isOpen,
  onClose,
  task,
  onTaskCompleted,
  onShowMessage,
  onTimerSync
}: FocusViewModalProps) {
  const [timerState, setTimerState] = useState<ActiveTimer | null>(null)
  const [secondsElapsed, setSecondsElapsed] = useState(0)
  const [phaseElapsed, setPhaseElapsed] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [isPomodoro, setIsPomodoro] = useState(false)
  const [pomodoroPhase, setPomodoroPhase] = useState<'work' | 'break'>('work')
  const [pomodoroWorkSeconds, setPomodoroWorkSeconds] = useState(25 * 60)
  const [pomodoroBreakSeconds, setPomodoroBreakSeconds] = useState(5 * 60)
  const [totalTimeSpent, setTotalTimeSpent] = useState(0)
  const [isMuted, setIsMuted] = useState(false)

  const tickerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    window.hello11824?.getSetting?.('focus_mute').then(v => {
      if (v === 'true') setIsMuted(true)
    })
  }, [])

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  // Load existing timer or initialize on modal open
  useEffect(() => {
    if (!isOpen || !task) return

    setTotalTimeSpent(task.total_time_spent_seconds || 0)

    window.hello11824.getActiveTimer().then(active => {
      if (active && active.task_id === task.id) {
        setTimerState(active)
        setSecondsElapsed(active.elapsed_seconds)
        setPhaseElapsed(active.elapsed_seconds)
        setIsRunning(active.status === 'running')
        setIsPomodoro(Boolean(active.is_pomodoro))
        setPomodoroPhase(active.pomodoro_phase)
        setPomodoroWorkSeconds(active.pomodoro_work_duration || 1500)
        setPomodoroBreakSeconds(active.pomodoro_break_duration || 300)
      } else {
        setSecondsElapsed(0)
        setPhaseElapsed(0)
        setIsRunning(false)
        setTimerState(null)
      }
    })
  }, [isOpen, task])

  // Ticker for running timer
  useEffect(() => {
    if (isRunning) {
      tickerRef.current = setInterval(() => {
        setSecondsElapsed(prev => prev + 1)
        setPhaseElapsed(prev => prev + 1)
      }, 1000)
    } else {
      if (tickerRef.current) clearInterval(tickerRef.current)
    }
    return () => {
      if (tickerRef.current) clearInterval(tickerRef.current)
    }
  }, [isRunning])

  // Pomodoro phase transition & chime
  useEffect(() => {
    if (!isPomodoro || !isRunning) return
    const target = pomodoroPhase === 'work' ? pomodoroWorkSeconds : pomodoroBreakSeconds
    if (phaseElapsed >= target && target > 0) {
      if (!isMuted) playFocusChime()
      if (pomodoroPhase === 'work') {
        setPomodoroPhase('break')
        setPhaseElapsed(0)
        onShowMessage('Focus block complete. Starting rest break.')
      } else {
        setPomodoroPhase('work')
        setPhaseElapsed(0)
        onShowMessage('Break finished. Back to focus session.')
      }
    }
  }, [isPomodoro, isRunning, phaseElapsed, pomodoroPhase, pomodoroWorkSeconds, pomodoroBreakSeconds, isMuted, onShowMessage])

  if (!isOpen || !task) return null

  async function toggleMute() {
    const next = !isMuted
    setIsMuted(next)
    await window.hello11824?.setSetting?.('focus_mute', String(next))
  }

  async function handleStart() {
    if (!task) return
    const active = await window.hello11824.startTimer(task.id, {
      isPomodoro,
      workDuration: pomodoroWorkSeconds,
      breakDuration: pomodoroBreakSeconds
    })
    setTimerState(active)
    setSecondsElapsed(active.elapsed_seconds)
    setPhaseElapsed(active.elapsed_seconds)
    setIsRunning(true)
    onTimerSync?.()
  }

  async function handlePause() {
    await window.hello11824.pauseTimer()
    setIsRunning(false)
    onTimerSync?.()
  }

  async function handleResume() {
    await window.hello11824.resumeTimer()
    setIsRunning(true)
    onTimerSync?.()
  }

  async function handleStop() {
    const res = await window.hello11824.stopTimer()
    setIsRunning(false)
    setTimerState(null)
    setPhaseElapsed(0)
    onTimerSync?.()
    if (res) {
      setTotalTimeSpent(res.totalSpentSeconds)
      onShowMessage(`Session recorded: ${formatSeconds(res.sessionDurationSeconds)}. Total spent: ${formatSeconds(res.totalSpentSeconds)}.`)
    }
  }

  async function handleMarkDone() {
    if (!task) return
    const res = await window.hello11824.markTaskDoneWithTimer(task.id)
    setIsRunning(false)
    setTimerState(null)
    onTimerSync?.()
    onTaskCompleted(res.task, res.timeSpentSeconds)
    onClose()
  }

  // Format seconds into MM:SS or HH:MM:SS
  function formatSeconds(totalSec: number): string {
    const hrs = Math.floor(totalSec / 3600)
    const mins = Math.floor((totalSec % 3600) / 60)
    const secs = totalSec % 60
    if (hrs > 0) {
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  // Pomodoro countdown calculation
  const targetSeconds = pomodoroPhase === 'work' ? pomodoroWorkSeconds : pomodoroBreakSeconds
  const remainingSeconds = Math.max(0, targetSeconds - (phaseElapsed % Math.max(1, targetSeconds)))
  const displayTimerText = isPomodoro ? formatSeconds(remainingSeconds) : formatSeconds(secondsElapsed)
  const workMins = Math.round(pomodoroWorkSeconds / 60)
  const breakMins = Math.round(pomodoroBreakSeconds / 60)

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Focus Mode">
      <div
        className="modal-content focus-view-container"
        style={{
          maxWidth: 420,
          background: 'linear-gradient(180deg, #18142c 0%, #0d0a1a 100%)',
          border: '1px solid rgba(139, 92, 246, 0.35)',
          boxShadow: '0 20px 45px rgba(0, 0, 0, 0.7), 0 0 40px rgba(124, 58, 237, 0.25)',
          borderRadius: 18,
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'relative'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Top Header */}
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <TimerIcon size={14} color="var(--accent-purple)" />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--accent-purple)' }}>
              Focus Mode
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              className="win-btn"
              style={{ width: 28, height: 28 }}
              onClick={toggleMute}
              title={isMuted ? 'Unmute Pomodoro chime' : 'Mute Pomodoro chime'}
              aria-label={isMuted ? 'Unmute Pomodoro chime' : 'Mute Pomodoro chime'}
            >
              {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
            <button
              type="button"
              className="win-btn"
              style={{ width: 28, height: 28 }}
              onClick={onClose}
              aria-label="Close"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Task Title & Meta */}
        <div style={{ textAlign: 'center', margin: '14px 0 10px 0', width: '100%' }}>
          <h2
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: 'var(--text-primary)',
              lineHeight: 1.3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical'
            }}
          >
            {task.title}
          </h2>

          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={11} /> Total studied: <strong style={{ color: 'var(--text-primary)' }}>{formatSeconds(totalTimeSpent + (isRunning ? secondsElapsed : 0))}</strong>
            </span>
            {task.due_time && (
              <>
                <span>•</span>
                <span>Due: {task.due_time}</span>
              </>
            )}
          </div>
        </div>

        {/* Mode Selector Pill */}
        <div
          style={{
            display: 'flex',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 999,
            padding: 3,
            gap: 4,
            marginBottom: 20
          }}
        >
          <button
            type="button"
            className={`mode-pill-btn ${!isPomodoro ? 'active' : ''}`}
            onClick={() => {
              if (!isRunning) setIsPomodoro(false)
            }}
            style={{
              padding: '4px 14px',
              borderRadius: 999,
              border: 'none',
              background: !isPomodoro ? 'var(--accent-purple-btn)' : 'transparent',
              color: !isPomodoro ? '#fff' : 'var(--text-secondary)',
              fontSize: 11.5,
              fontWeight: 600,
              cursor: isRunning ? 'default' : 'pointer'
            }}
          >
            <TimerIcon size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: '-1px' }} /> Stopwatch
          </button>

          <button
            type="button"
            className={`mode-pill-btn ${isPomodoro ? 'active' : ''}`}
            onClick={() => {
              if (!isRunning) setIsPomodoro(true)
            }}
            style={{
              padding: '4px 14px',
              borderRadius: 999,
              border: 'none',
              background: isPomodoro ? 'var(--accent-purple-btn)' : 'transparent',
              color: isPomodoro ? '#fff' : 'var(--text-secondary)',
              fontSize: 11.5,
              fontWeight: 600,
              cursor: isRunning ? 'default' : 'pointer'
            }}
          >
            <Coffee size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: '-1px' }} /> Pomodoro ({workMins}/{breakMins})
          </button>
        </div>

        {/* Customizable Pomodoro Intervals */}
        {isPomodoro && !isRunning && secondsElapsed === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
            {[
              { label: '25 / 5', work: 25 * 60, brk: 5 * 60 },
              { label: '50 / 10', work: 50 * 60, brk: 10 * 60 },
              { label: '15 / 3', work: 15 * 60, brk: 3 * 60 }
            ].map(preset => {
              const active = pomodoroWorkSeconds === preset.work && pomodoroBreakSeconds === preset.brk
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setPomodoroWorkSeconds(preset.work)
                    setPomodoroBreakSeconds(preset.brk)
                  }}
                  style={{
                    padding: '3px 10px',
                    borderRadius: 999,
                    border: active ? '1px solid var(--accent-purple)' : '1px solid var(--border-subtle)',
                    background: active ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                    color: active ? '#fff' : 'var(--text-secondary)',
                    fontSize: 11,
                    cursor: 'pointer'
                  }}
                >
                  {preset.label}
                </button>
              )
            })}
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-secondary)' }}>
              <span>W:</span>
              <input
                type="number"
                min={1}
                max={120}
                value={workMins}
                onChange={e => setPomodoroWorkSeconds(Math.max(1, Math.min(120, Number(e.target.value) || 25)) * 60)}
                style={{ width: 42, padding: '2px 4px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.06)', color: 'var(--text-primary)', fontSize: 11, textAlign: 'center' }}
                aria-label="Work minutes"
              />
            </label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-secondary)' }}>
              <span>B:</span>
              <input
                type="number"
                min={1}
                max={60}
                value={breakMins}
                onChange={e => setPomodoroBreakSeconds(Math.max(1, Math.min(60, Number(e.target.value) || 5)) * 60)}
                style={{ width: 38, padding: '2px 4px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.06)', color: 'var(--text-primary)', fontSize: 11, textAlign: 'center' }}
                aria-label="Break minutes"
              />
            </label>
          </div>
        )}

        {/* Big Glow Timer Display */}
        <div
          style={{
            position: 'relative',
            width: 200,
            height: 200,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(124, 58, 237, 0.18) 0%, rgba(13, 10, 26, 0.6) 70%)',
            border: `3px solid ${isRunning ? 'rgba(139, 92, 246, 0.85)' : 'rgba(255, 255, 255, 0.12)'}`,
            boxShadow: isRunning ? '0 0 35px rgba(139, 92, 246, 0.4), inset 0 0 20px rgba(124, 58, 237, 0.3)' : 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
            transition: 'border-color 0.3s, box-shadow 0.3s'
          }}
        >
          {isPomodoro && (
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-purple)', textTransform: 'uppercase', marginBottom: 4 }}>
              {pomodoroPhase === 'work' ? 'Focus Session' : 'Rest Break'}
            </span>
          )}

          <div
            style={{
              fontSize: 38,
              fontWeight: 800,
              fontFamily: 'monospace',
              letterSpacing: '1px',
              color: '#ffffff',
              textShadow: isRunning ? '0 0 15px rgba(139, 92, 246, 0.8)' : 'none'
            }}
          >
            {displayTimerText}
          </div>

          <span style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 4 }}>
            {isRunning ? 'Session running' : secondsElapsed > 0 ? 'Paused' : 'Ready to start'}
          </span>
        </div>

        {/* Controls Row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
          {!isRunning ? (
            <button
              type="button"
              className="btn-primary-pill"
              onClick={secondsElapsed > 0 ? handleResume : handleStart}
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                padding: 0,
                justifyContent: 'center',
                background: 'var(--accent-purple-btn)',
                boxShadow: '0 4px 15px rgba(124, 58, 237, 0.4)'
              }}
              title={secondsElapsed > 0 ? 'Resume Timer' : 'Start Focus Session'}
            >
              <Play size={22} style={{ marginLeft: 2 }} />
            </button>
          ) : (
            <button
              type="button"
              className="btn-secondary-pill"
              onClick={handlePause}
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                padding: 0,
                justifyContent: 'center',
                borderColor: 'var(--accent-purple)',
                background: 'rgba(124, 58, 237, 0.2)'
              }}
              title="Pause Timer"
            >
              <Pause size={20} color="#fff" />
            </button>
          )}

          {(isRunning || secondsElapsed > 0) && (
            <button
              type="button"
              className="btn-secondary-pill"
              onClick={handleStop}
              style={{ width: 42, height: 42, borderRadius: '50%', padding: 0, justifyContent: 'center' }}
              title="Stop and save session"
            >
              <Square size={16} />
            </button>
          )}
        </div>

        {/* Bottom Actions: Mark Done */}
        <div style={{ width: '100%', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: 14 }}>
          <button
            type="button"
            className="btn-primary-pill"
            style={{
              width: '100%',
              justifyContent: 'center',
              background: 'rgba(34, 197, 94, 0.2)',
              border: '1px solid rgba(34, 197, 94, 0.4)',
              color: '#4ade80',
              fontWeight: 700,
              padding: '10px 16px',
              fontSize: 12.5
            }}
            onClick={handleMarkDone}
          >
            <CheckCircle2 size={15} style={{ marginRight: 6 }} /> Mark Task as Done
          </button>
        </div>
      </div>
    </div>
  )
}

