import { useEffect, useRef, useState, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'

interface PortalMenuProps {
  isOpen: boolean
  anchorRect: DOMRect | null
  onClose: () => void
  children: React.ReactNode
  minWidth?: number
}

export function PortalMenu({
  isOpen,
  anchorRect,
  onClose,
  children,
  minWidth = 140
}: PortalMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 })

  useLayoutEffect(() => {
    if (!isOpen || !anchorRect) return

    const menuEl = menuRef.current
    const menuWidth = menuEl ? menuEl.offsetWidth : minWidth
    const menuHeight = menuEl ? menuEl.offsetHeight : 120

    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    // Vertical placement with auto-flip
    let top = anchorRect.bottom + 4
    if (top + menuHeight > viewportHeight - 10) {
      // Flip upwards if it collides with bottom edge
      top = Math.max(10, anchorRect.top - menuHeight - 4)
    }

    // Horizontal placement with boundary check
    let left = anchorRect.right - menuWidth
    if (left + menuWidth > viewportWidth - 10) {
      left = viewportWidth - menuWidth - 10
    }
    if (left < 10) {
      left = 10
    }

    setCoords({ top, left })
  }, [isOpen, anchorRect, minWidth])

  useEffect(() => {
    if (!isOpen) return

    function handleMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    function handleScroll() {
      onClose()
    }

    document.addEventListener('mousedown', handleMouseDown, true)
    document.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('scroll', handleScroll, true)

    return () => {
      document.removeEventListener('mousedown', handleMouseDown, true)
      document.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [isOpen, onClose])

  if (!isOpen || !anchorRect) return null

  return createPortal(
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: coords.top,
        left: coords.left,
        zIndex: 9999,
        background: 'var(--bg-card)',
        border: '1px solid var(--border-card)',
        borderRadius: 'var(--radius-md, 10px)',
        padding: 5,
        minWidth,
        boxShadow: 'var(--shadow-modal, 0 16px 40px rgba(0, 0, 0, 0.6))',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        animation: 'fadeIn 0.12s ease-out'
      }}
      role="menu"
      onClick={e => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body
  )
}
