import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Heart,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  BookOpen
} from 'lucide-react'
import { SelahMessage } from '../../types'

const FIVE_DEFAULT_VERSES: SelahMessage[] = [
  {
    id: 1,
    category: 'Self-worth and confidence',
    message: 'Your worth is not determined by how much you accomplish.',
    source_type: 'original',
    scripture_ref: null,
    is_favorite: 0,
    created_at: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 2,
    category: 'Rest and self-compassion',
    message: 'Come to me, all who labor and are heavy laden, and I will give you rest.',
    source_type: 'scripture',
    scripture_ref: 'Matthew 11:28',
    is_favorite: 0,
    created_at: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 3,
    category: 'Resilience and overcoming difficulties',
    message: 'My grace is sufficient for you, for my power is made perfect in weakness.',
    source_type: 'scripture',
    scripture_ref: '2 Corinthians 12:9',
    is_favorite: 0,
    created_at: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 4,
    category: 'Faith and spirituality',
    message: 'Be still, and know that I am God.',
    source_type: 'scripture',
    scripture_ref: 'Psalm 46:10',
    is_favorite: 0,
    created_at: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 5,
    category: 'Hope and new beginnings',
    message: 'For I know the plans I have for you, plans to give you hope and a future.',
    source_type: 'scripture',
    scripture_ref: 'Jeremiah 29:11',
    is_favorite: 0,
    created_at: '2026-01-01T00:00:00.000Z'
  }
]

interface WordsForSoulSectionProps {
  onShowMessage?: (msg: string) => void
}

export function WordsForSoulSection({ onShowMessage }: WordsForSoulSectionProps) {
  const [messages, setMessages] = useState<SelahMessage[]>(FIVE_DEFAULT_VERSES)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [copied, setCopied] = useState(false)

  const loadMessages = useCallback(async () => {
    try {
      const api = window.hello11824
      if (!api?.listMomentsMessages) return
      const list = await api.listMomentsMessages()
      if (list && list.length > 0) {
        // Keep exactly 5 verses
        setMessages(list.slice(0, 5))
      }
    } catch (err) {
      console.error('Failed to load words for soul:', err)
    }
  }, [])

  useEffect(() => {
    loadMessages()
  }, [loadMessages])

  const currentVerse = useMemo(() => {
    if (messages.length === 0) return FIVE_DEFAULT_VERSES[0]
    return messages[currentIndex % messages.length]
  }, [messages, currentIndex])

  const handlePrev = () => {
    setCurrentIndex(prev => (prev - 1 + messages.length) % messages.length)
  }

  const handleNext = () => {
    setCurrentIndex(prev => (prev + 1) % messages.length)
  }

  const handleToggleFavorite = async () => {
    const id = currentVerse.id
    try {
      let isFav = false
      if (window.hello11824?.toggleMomentsMessageFavorite) {
        isFav = await window.hello11824.toggleMomentsMessageFavorite(id)
      } else {
        isFav = !currentVerse.is_favorite
      }
      setMessages(prev =>
        prev.map(m => (m.id === id ? { ...m, is_favorite: isFav ? 1 : 0 } : m))
      )
      onShowMessage?.(isFav ? 'Saved to favourites.' : 'Removed from favourites.')
    } catch {
      // ignore
    }
  }

  const handleCopy = async () => {
    try {
      const textToCopy =
        currentVerse.source_type === 'scripture' && currentVerse.scripture_ref
          ? `"${currentVerse.message}" — ${currentVerse.scripture_ref}`
          : `"${currentVerse.message}"`
      await navigator.clipboard.writeText(textToCopy)
      setCopied(true)
      onShowMessage?.('Copied to clipboard.')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      onShowMessage?.('Could not copy to clipboard.')
    }
  }

  return (
    <div className="words-single-card-wrapper">
      <div className="moments-single-verse-card">
        {/* Card Header: Category & Optional Scripture Reference */}
        <div className="moments-single-card-header">
          <span className="moments-category-label">{currentVerse.category}</span>
          {currentVerse.source_type === 'scripture' && currentVerse.scripture_ref && (
            <span className="moments-scripture-pill">
              <BookOpen size={11} />
              <span>{currentVerse.scripture_ref}</span>
            </span>
          )}
        </div>

        {/* Centered Verse Text */}
        <div className="moments-single-verse-body">
          <p className="moments-single-verse-text">
            &ldquo;{currentVerse.message}&rdquo;
          </p>
        </div>

        {/* Bottom Controls Row: Prev/Next, 5 Dots, Copy, Save */}
        <div className="moments-single-card-controls">
          <div className="moments-nav-controls">
            <button
              type="button"
              className="moments-card-btn nav-btn"
              onClick={handlePrev}
              aria-label="Previous verse"
            >
              <ChevronLeft size={14} />
              <span>Previous</span>
            </button>

            {/* 5 Progress Dots */}
            <div className="moments-dot-indicators" role="tablist" aria-label="Verse pagination">
              {messages.map((item, idx) => (
                <button
                  key={item.id || idx}
                  type="button"
                  role="tab"
                  aria-selected={idx === currentIndex}
                  aria-label={`Go to verse ${idx + 1}`}
                  className={`moments-page-dot ${idx === currentIndex ? 'active' : ''}`}
                  onClick={() => setCurrentIndex(idx)}
                />
              ))}
            </div>

            <button
              type="button"
              className="moments-card-btn nav-btn"
              onClick={handleNext}
              aria-label="Next verse"
            >
              <span>Next</span>
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="moments-action-controls">
            <button
              type="button"
              className="moments-card-btn"
              onClick={handleCopy}
              title="Copy verse to clipboard"
            >
              {copied ? (
                <Check size={12} color="var(--accent-green, #10b981)" />
              ) : (
                <Copy size={12} />
              )}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              type="button"
              className={`moments-card-btn ${currentVerse.is_favorite ? 'saved-active' : ''}`}
              onClick={handleToggleFavorite}
              title={currentVerse.is_favorite ? 'Remove from saved' : 'Save to favourites'}
            >
              <Heart
                size={12}
                fill={currentVerse.is_favorite ? 'currentColor' : 'none'}
              />
              <span>{currentVerse.is_favorite ? 'Saved' : 'Save'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
