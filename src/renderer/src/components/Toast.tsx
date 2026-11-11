import { useState, useEffect, useRef } from 'react'
import { X, RotateCcw } from 'lucide-react'

export interface ToastData {
  id: string
  message: string
  action?: {
    label: string
    onAction: () => void
  }
  durationMs?: number
}

interface ToastProps {
  toast: ToastData | null
  onDismiss: () => void
}

export function Toast({ toast, onDismiss }: ToastProps) {
  const [isHovered, setIsHovered] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const remainingTimeRef = useRef<number>(4000)
  const startTimeRef = useRef<number>(Date.now())

  useEffect(() => {
    if (!toast) return

    remainingTimeRef.current = toast.durationMs || 4000
    startTimeRef.current = Date.now()

    const startTimer = (duration: number) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        onDismiss()
      }, duration)
    }

    startTimer(remainingTimeRef.current)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [toast?.id, onDismiss])

  const handleMouseEnter = () => {
    setIsHovered(true)
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
      const elapsed = Date.now() - startTimeRef.current
      remainingTimeRef.current = Math.max(1000, remainingTimeRef.current - elapsed)
    }
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
    startTimeRef.current = Date.now()
    timerRef.current = setTimeout(() => {
      onDismiss()
    }, remainingTimeRef.current)
  }

  if (!toast) return null

  return (
    <div
      role="status"
      aria-live="polite"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10000,
        background: 'var(--bg-card)',
        border: '1px solid var(--accent-purple)',
        boxShadow: 'var(--shadow-modal, 0 12px 36px rgba(0, 0, 0, 0.5))',
        borderRadius: 'var(--radius-md, 10px)',
        padding: '8px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        maxWidth: '90vw',
        animation: 'slideUp 0.18s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-primary)' }}>
        {toast.message}
      </span>

      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action?.onAction()
            onDismiss()
          }}
          className="btn-primary-pill"
          style={{
            padding: '3px 10px',
            fontSize: 11,
            background: 'var(--accent-purple-btn)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4
          }}
        >
          <RotateCcw size={11} />
          {toast.action.label}
        </button>
      )}

      <button
        type="button"
        onClick={onDismiss}
        title="Dismiss notification"
        aria-label="Dismiss notification"
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          padding: 2,
          display: 'flex',
          alignItems: 'center'
        }}
      >
        <X size={13} />
      </button>
    </div>
  )
}

