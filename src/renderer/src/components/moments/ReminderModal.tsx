import { useState, useEffect } from 'react'
import { X, Save, Pin, Heart } from 'lucide-react'
import { SelahReminder } from '../../types'

const REMINDER_CATEGORIES = [
  'Personal Affirmation',
  'Bible Verse',
  'Lesson Learned',
  'Goal & Intention',
  'For Difficult Days',
  'Message to Future Self',
  'General'
]

interface ReminderModalProps {
  isOpen: boolean
  initialData?: SelahReminder | null
  onClose: () => void
  onSave: (payload: {
    id?: number
    title: string
    content: string
    category: string
    isPinned: boolean
    isFavorite: boolean
  }) => Promise<void>
}

export function ReminderModal({
  isOpen,
  initialData,
  onClose,
  onSave
}: ReminderModalProps) {
  // Always invoke hooks unconditionally at the top (Rules of Hooks)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('Personal Affirmation')
  const [isPinned, setIsPinned] = useState(false)
  const [isFavorite, setIsFavorite] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title)
      setContent(initialData.content)
      setCategory(initialData.category || 'Personal Affirmation')
      setIsPinned(Boolean(initialData.is_pinned))
      setIsFavorite(Boolean(initialData.is_favorite))
    } else {
      setTitle('')
      setContent('')
      setCategory('Personal Affirmation')
      setIsPinned(false)
      setIsFavorite(false)
    }
    setError(null)
  }, [initialData, isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setError('Please provide a title for your reminder.')
      return
    }
    if (!content.trim()) {
      setError('Please write what you want to remember.')
      return
    }

    try {
      setIsSaving(true)
      await onSave({
        id: initialData?.id,
        title: title.trim(),
        content: content.trim(),
        category,
        isPinned,
        isFavorite
      })
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Failed to save reminder')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content reminder-modal-content"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reminder-modal-title"
      >
        <div className="modal-header">
          <h3 id="reminder-modal-title" className="modal-title">
            {initialData ? 'Edit Reminder' : 'New Little Reminder'}
          </h3>
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            aria-label="Close dialog"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0 }}>
          <div className="modal-body">
            {error && <div className="form-error-banner" style={{ marginBottom: 10 }}>{error}</div>}

            <div className="input-group">
              <label className="input-label" htmlFor="reminder-title">
                Title or Anchor Phrase *
              </label>
              <input
                id="reminder-title"
                type="text"
                className="input-field"
                placeholder="e.g. My worth is not in my grades, Philippians 4:13..."
                value={title}
                onChange={e => setTitle(e.target.value)}
                autoFocus
                maxLength={200}
              />
            </div>

            <div className="input-group">
              <label className="input-label" htmlFor="reminder-category">
                Category
              </label>
              <select
                id="reminder-category"
                className="select-field"
                value={category}
                onChange={e => setCategory(e.target.value)}
              >
                {REMINDER_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="input-group">
              <label className="input-label" htmlFor="reminder-content">
                Words to Remember *
              </label>
              <textarea
                id="reminder-content"
                className="textarea-field"
                rows={4}
                placeholder="Write the words, scripture, or note you want to carry with you..."
                value={content}
                onChange={e => setContent(e.target.value)}
                maxLength={4000}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 4, padding: '4px 0' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={e => setIsPinned(e.target.checked)}
                  style={{ accentColor: 'var(--accent-purple)', width: 14, height: 14, cursor: 'pointer' }}
                />
                <Pin size={13} color="var(--accent-purple)" />
                <span>Pin to top</span>
              </label>

              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={isFavorite}
                  onChange={e => setIsFavorite(e.target.checked)}
                  style={{ accentColor: 'var(--accent-purple)', width: 14, height: 14, cursor: 'pointer' }}
                />
                <Heart size={13} color="#f43f5e" fill={isFavorite ? '#f43f5e' : 'none'} />
                <span>Mark as favourite</span>
              </label>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSaving || !title.trim() || !content.trim()}
            >
              <Save size={14} />
              <span>{isSaving ? 'Saving…' : initialData ? 'Update Reminder' : 'Save Reminder'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
