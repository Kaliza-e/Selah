import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Heart,
  Copy,
  Check,
  RefreshCw,
  BookOpen,
  Filter,
  Sparkles,
  Quote
} from 'lucide-react'
import { SelahMessage, SelahCategory } from '../../types'

const CATEGORIES: Array<'All' | SelahCategory> = [
  'All',
  'Self-worth and confidence',
  'Faith and spirituality',
  'Patience and personal growth',
  'Resilience and overcoming difficulties',
  'Rest and self-compassion',
  'Discipline and consistency',
  'Gratitude and appreciation',
  'Hope and new beginnings',
  'Relationships and kindness'
]

interface WordsForSoulSectionProps {
  onShowMessage?: (msg: string) => void
}

export function WordsForSoulSection({ onShowMessage }: WordsForSoulSectionProps) {
  const [messages, setMessages] = useState<SelahMessage[]>([])
  const [selectedCategory, setSelectedCategory] = useState<'All' | SelahCategory>('All')
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [featuredIndex, setFeaturedIndex] = useState(0)
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [isRotating, setIsRotating] = useState(false)

  const loadMessages = useCallback(async () => {
    try {
      const api = window.hello11824
      if (!api) return
      const list = await api.listMomentsMessages(
        selectedCategory === 'All' ? undefined : selectedCategory,
        showFavoritesOnly
      )
      setMessages(list || [])
      setFeaturedIndex(0)
    } catch (err) {
      console.error('Failed to load words for soul:', err)
    }
  }, [selectedCategory, showFavoritesOnly])

  useEffect(() => {
    loadMessages()
  }, [loadMessages])

  const featuredMessage = useMemo(() => {
    if (messages.length === 0) return null
    return messages[featuredIndex % messages.length]
  }, [messages, featuredIndex])

  const handleNextWord = () => {
    if (messages.length <= 1) return
    setIsRotating(true)
    setFeaturedIndex(prev => (prev + 1) % messages.length)
    setTimeout(() => setIsRotating(false), 300)
  }

  const handleToggleFavorite = async (id: number) => {
    try {
      const isFav = await window.hello11824?.toggleMomentsMessageFavorite(id)
      setMessages(prev =>
        prev.map(m => (m.id === id ? { ...m, is_favorite: isFav ? 1 : 0 } : m))
      )
      onShowMessage?.(isFav ? 'Added to favourites.' : 'Removed from favourites.')
    } catch {
      // ignore
    }
  }

  const handleCopy = async (msg: SelahMessage) => {
    try {
      const textToCopy = msg.source_type === 'scripture' && msg.scripture_ref
        ? `"${msg.message}" — ${msg.scripture_ref}`
        : `"${msg.message}"`
      await navigator.clipboard.writeText(textToCopy)
      setCopiedId(msg.id)
      onShowMessage?.('Copied to clipboard.')
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      onShowMessage?.('Could not copy to clipboard.')
    }
  }

  return (
    <div className="words-for-soul-container">
      {/* Category Filter Pills & Favourites Toggle */}
      <div className="moments-filter-bar">
        <div className="moments-category-scroll">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              type="button"
              className={`moments-category-pill ${selectedCategory === cat && !showFavoritesOnly ? 'active' : ''}`}
              onClick={() => {
                setShowFavoritesOnly(false)
                setSelectedCategory(cat)
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        <button
          type="button"
          className={`moments-fav-toggle-btn ${showFavoritesOnly ? 'active' : ''}`}
          onClick={() => setShowFavoritesOnly(prev => !prev)}
          title="View saved favourite words"
        >
          <Heart size={14} fill={showFavoritesOnly ? 'currentColor' : 'none'} />
          <span>Favourites</span>
        </button>
      </div>

      {/* Featured Quote Hero Showcase */}
      {featuredMessage ? (
        <div className="moments-featured-hero-card">
          <div className="moments-hero-quote-mark">
            <Quote size={32} />
          </div>

          <div className="moments-hero-top-row">
            <span className="moments-hero-badge">
              <Sparkles size={12} />
              <span>FEATURED WORD</span>
            </span>

            <div className="moments-hero-meta">
              <span className="moments-hero-category">{featuredMessage.category}</span>
              {featuredMessage.source_type === 'scripture' && featuredMessage.scripture_ref && (
                <span className="moments-hero-scripture-ref">
                  <BookOpen size={11} />
                  <span>{featuredMessage.scripture_ref}</span>
                </span>
              )}
            </div>
          </div>

          <div className="moments-hero-body">
            <p className="moments-hero-quote-text">
              &ldquo;{featuredMessage.message}&rdquo;
            </p>
          </div>

          <div className="moments-hero-footer">
            <div className="moments-hero-actions-left">
              <button
                type="button"
                className="btn-secondary-pill moments-hero-btn"
                onClick={handleNextWord}
                title="Discover another word"
              >
                <RefreshCw size={13} className={isRotating ? 'spin-anim' : ''} />
                <span>Discover Another</span>
              </button>
            </div>

            <div className="moments-hero-actions-right">
              <button
                type="button"
                className="btn-secondary-pill moments-hero-btn"
                onClick={() => handleCopy(featuredMessage)}
                title="Copy to clipboard"
              >
                {copiedId === featuredMessage.id ? <Check size={13} color="var(--accent-green, #10b981)" /> : <Copy size={13} />}
                <span>{copiedId === featuredMessage.id ? 'Copied' : 'Copy'}</span>
              </button>

              <button
                type="button"
                className={`btn-secondary-pill moments-hero-btn ${featuredMessage.is_favorite ? 'fav-active' : ''}`}
                onClick={() => handleToggleFavorite(featuredMessage.id)}
                title={featuredMessage.is_favorite ? 'Remove from favourites' : 'Save to favourites'}
              >
                <Heart size={13} fill={featuredMessage.is_favorite ? 'currentColor' : 'none'} />
                <span>{featuredMessage.is_favorite ? 'Saved' : 'Save'}</span>
              </button>
            </div>
          </div>
        </div>
      ) : showFavoritesOnly ? (
        <div className="moments-empty-card">
          <Heart size={28} className="moments-empty-icon" />
          <h4 className="moments-empty-title">No favourites yet</h4>
          <p className="moments-empty-desc">
            Save the words that speak to you. They'll be waiting here whenever you need them.
          </p>
          <button
            type="button"
            className="btn-secondary-pill"
            onClick={() => setShowFavoritesOnly(false)}
          >
            Browse all encouraging words
          </button>
        </div>
      ) : (
        <div className="moments-empty-card">
          <Sparkles size={28} className="moments-empty-icon" />
          <h4 className="moments-empty-title">No words found in this category</h4>
          <p className="moments-empty-desc">
            Explore other categories or switch back to All.
          </p>
          <button
            type="button"
            className="btn-secondary-pill"
            onClick={() => setSelectedCategory('All')}
          >
            Show All Words
          </button>
        </div>
      )}

      {/* Grid of Browsable Cards */}
      {messages.length > 1 && (
        <div className="moments-words-grid-section">
          <div className="moments-section-subhead">
            <span className="moments-subhead-title">
              {showFavoritesOnly ? 'Your Favourite Words' : `All Words in ${selectedCategory}`}
            </span>
            <span className="moments-count-badge">{messages.length}</span>
          </div>

          <div className="moments-words-grid">
            {messages.map((item, idx) => (
              <div
                key={item.id}
                className={`moments-word-card ${item.id === featuredMessage?.id ? 'active-featured' : ''}`}
                onClick={() => setFeaturedIndex(idx)}
              >
                <div className="moments-card-header">
                  <span className="moments-card-category">{item.category}</span>
                  <div className="moments-card-actions" onClick={e => e.stopPropagation()}>
                    <button
                      type="button"
                      className="moments-mini-action-btn"
                      onClick={() => handleCopy(item)}
                      title="Copy"
                    >
                      {copiedId === item.id ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                    </button>
                    <button
                      type="button"
                      className={`moments-mini-action-btn ${item.is_favorite ? 'fav-active' : ''}`}
                      onClick={() => handleToggleFavorite(item.id)}
                      title="Toggle favourite"
                    >
                      <Heart size={12} fill={item.is_favorite ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                </div>

                <p className="moments-card-quote">
                  &ldquo;{item.message}&rdquo;
                </p>

                {item.source_type === 'scripture' && item.scripture_ref && (
                  <div className="moments-card-footer">
                    <span className="moments-scripture-ref-pill">
                      <BookOpen size={10} />
                      <span>{item.scripture_ref}</span>
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
