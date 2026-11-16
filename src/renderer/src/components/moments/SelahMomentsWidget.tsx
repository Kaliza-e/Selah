import { useEffect, useState, useCallback } from 'react'
import { Sparkles, ArrowRight, Heart, RefreshCw, Feather } from 'lucide-react'
import { SelahMessage, SelahPrompt, ActiveTab } from '../../types'

interface SelahMomentsWidgetProps {
  isCompact?: boolean
  onOpenMoments: (section?: 'words' | 'reflections' | 'reminders') => void
  onShowMessage?: (msg: string) => void
}

export function SelahMomentsWidget({
  isCompact = false,
  onOpenMoments,
  onShowMessage
}: SelahMomentsWidgetProps) {
  const [dailyMessage, setDailyMessage] = useState<SelahMessage | null>(null)
  const [weeklyPrompt, setWeeklyPrompt] = useState<SelahPrompt | null>(null)
  const [isFavorite, setIsFavorite] = useState(false)
  const [isRotating, setIsRotating] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const api = window.hello11824
      if (!api) return

      const [msg, prompt] = await Promise.all([
        api.getDailyMomentsMessage?.(),
        api.getWeeklyMomentsPrompt?.()
      ])

      if (msg) {
        setDailyMessage(msg)
        setIsFavorite(Boolean(msg.is_favorite))
      }
      if (prompt) {
        setWeeklyPrompt(prompt)
      }
    } catch (err) {
      console.error('Failed to load Selah Moments widget data:', err)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleNextMessage = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      setIsRotating(true)
      const next = await window.hello11824?.getRandomMomentsMessage?.()
      if (next) {
        setDailyMessage(next)
        setIsFavorite(Boolean(next.is_favorite))
      }
    } catch {
      // ignore
    } finally {
      setTimeout(() => setIsRotating(false), 300)
    }
  }

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!dailyMessage) return
    try {
      const nextFav = await window.hello11824?.toggleMomentsMessageFavorite?.(dailyMessage.id)
      setIsFavorite(Boolean(nextFav))
      onShowMessage?.(nextFav ? 'Saved to your favourite words.' : 'Removed from favourites.')
    } catch {
      // ignore
    }
  }

  // Fallbacks if database not loaded yet
  const messageText = dailyMessage?.message || "You don't have to have everything figured out to be making progress."
  const promptText = weeklyPrompt?.question || "What is one thing you've accomplished recently that you haven't given yourself enough credit for?"

  return (
    <div
      className={`moments-widget-card ${isCompact ? 'compact' : ''}`}
      onClick={() => onOpenMoments('words')}
      role="region"
      aria-label="Selah Moments - A little reminder"
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpenMoments('words')
        }
      }}
    >
      <div className="moments-widget-header">
        <div className="moments-widget-badge">
          <Sparkles size={11} className="moments-sparkle-icon" />
          <span>YOUR SPACE TO PAUSE</span>
        </div>
        <div className="moments-widget-actions" onClick={e => e.stopPropagation()}>
          <button
            type="button"
            className="moments-action-btn"
            title="Discover another word"
            onClick={handleNextMessage}
            aria-label="Discover another word"
          >
            <RefreshCw size={12} className={isRotating ? 'spin-anim' : ''} />
          </button>
          <button
            type="button"
            className={`moments-action-btn ${isFavorite ? 'active-fav' : ''}`}
            title={isFavorite ? 'Saved to favourites' : 'Save to favourites'}
            onClick={handleToggleFavorite}
            aria-label="Toggle favourite"
          >
            <Heart size={12} fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>

      <div className="moments-widget-body">
        <div className="moments-widget-title-row">
          <Feather size={14} className="moments-feather-icon" />
          <h4 className="moments-widget-title">A little reminder</h4>
          {dailyMessage?.source_type === 'scripture' && dailyMessage.scripture_ref && (
            <span className="moments-scripture-pill">{dailyMessage.scripture_ref}</span>
          )}
        </div>

        <p className="moments-widget-quote">
          &ldquo;{messageText}&rdquo;
        </p>

        {!isCompact && promptText && (
          <div className="moments-widget-prompt-box">
            <span className="moments-prompt-label">Take a moment to reflect:</span>
            <p className="moments-prompt-text">{promptText}</p>
          </div>
        )}
      </div>

      <div className="moments-widget-footer">
        <span className="moments-category-tag">
          {dailyMessage?.category || 'Encouragement'}
        </span>
        <button
          type="button"
          className="moments-take-moment-btn"
          onClick={e => {
            e.stopPropagation()
            onOpenMoments('reflections')
          }}
        >
          <span>Take a moment</span>
          <ArrowRight size={13} />
        </button>
      </div>
    </div>
  )
}
