import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Plus,
  Search,
  Pin,
  Heart,
  Edit2,
  Trash2,
  Sparkles,
  Tag,
  Clock
} from 'lucide-react'
import { SelahReminder } from '../../types'
import { ReminderModal } from './ReminderModal'

const CATEGORIES = [
  'All',
  'Personal Affirmation',
  'Bible Verse',
  'Lesson Learned',
  'Goal & Intention',
  'For Difficult Days',
  'Message to Future Self',
  'General'
]

interface LittleRemindersSectionProps {
  onShowMessage?: (msg: string) => void
}

export function LittleRemindersSection({ onShowMessage }: LittleRemindersSectionProps) {
  const [reminders, setReminders] = useState<SelahReminder[]>([])
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingReminder, setEditingReminder] = useState<SelahReminder | null>(null)

  const loadReminders = useCallback(async () => {
    try {
      const api = window.hello11824
      if (!api) return
      const list = await api.listMomentsReminders(
        selectedCategory === 'All' ? undefined : selectedCategory,
        searchQuery
      )
      setReminders(list || [])
    } catch (err) {
      console.error('Failed to load reminders:', err)
    }
  }, [selectedCategory, searchQuery])

  useEffect(() => {
    loadReminders()
  }, [loadReminders])

  const handleOpenAddModal = () => {
    setEditingReminder(null)
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (rem: SelahReminder) => {
    setEditingReminder(rem)
    setIsModalOpen(true)
  }

  const handleSaveReminder = async (payload: {
    id?: number
    title: string
    content: string
    category: string
    isPinned: boolean
    isFavorite: boolean
  }) => {
    try {
      const saved = await window.hello11824.saveMomentsReminder(payload)
      setReminders(prev => {
        const idx = prev.findIndex(r => r.id === saved.id)
        if (idx !== -1) {
          const updated = [...prev]
          updated[idx] = saved
          return updated.sort((a, b) => (b.is_pinned || 0) - (a.is_pinned || 0))
        }
        return [saved, ...prev].sort((a, b) => (b.is_pinned || 0) - (a.is_pinned || 0))
      })
      onShowMessage?.(payload.id ? 'Reminder updated.' : 'Reminder saved.')
    } catch (err) {
      console.error('Failed to save reminder:', err)
      onShowMessage?.('Could not save reminder.')
      throw err
    }
  }

  const handleDeleteReminder = async (id: number) => {
    if (!window.confirm('Delete this reminder?')) return
    try {
      await window.hello11824.deleteMomentsReminder(id)
      setReminders(prev => prev.filter(r => r.id !== id))
      onShowMessage?.('Reminder deleted.')
    } catch (err) {
      console.error('Failed to delete reminder:', err)
    }
  }

  const handleTogglePin = async (id: number) => {
    try {
      const nextPin = await window.hello11824.toggleMomentsReminderPinned(id)
      setReminders(prev => {
        const updated = prev.map(r => (r.id === id ? { ...r, is_pinned: nextPin ? 1 : 0 } : r))
        return updated.sort((a, b) => (b.is_pinned || 0) - (a.is_pinned || 0))
      })
      onShowMessage?.(nextPin ? 'Reminder pinned to top.' : 'Reminder unpinned.')
    } catch {
      // ignore
    }
  }

  const handleToggleFavorite = async (id: number) => {
    try {
      const nextFav = await window.hello11824.toggleMomentsReminderFavorite(id)
      setReminders(prev =>
        prev.map(r => (r.id === id ? { ...r, is_favorite: nextFav ? 1 : 0 } : r))
      )
      onShowMessage?.(nextFav ? 'Saved to favourites.' : 'Removed from favourites.')
    } catch {
      // ignore
    }
  }

  const pinnedReminders = useMemo(() => reminders.filter(r => r.is_pinned === 1), [reminders])
  const unpinnedReminders = useMemo(() => reminders.filter(r => r.is_pinned !== 1), [reminders])

  return (
    <div className="little-reminders-container">
      {/* Top Action Bar with Search & Add */}
      <div className="reminders-top-bar">
        <div className="reminders-search-wrapper">
          <Search size={14} className="reminders-search-icon" />
          <input
            type="text"
            className="reminders-search-input"
            placeholder="Search your personal reminders..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <button
          type="button"
          className="btn-primary-pill reminders-add-btn"
          onClick={handleOpenAddModal}
        >
          <Plus size={14} />
          <span>New Reminder</span>
        </button>
      </div>

      {/* Category Pills */}
      <div className="moments-category-scroll" style={{ marginBottom: 16 }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            type="button"
            className={`moments-category-pill ${selectedCategory === cat ? 'active' : ''}`}
            onClick={() => setSelectedCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Empty State */}
      {reminders.length === 0 ? (
        <div className="moments-empty-card">
          <Sparkles size={28} className="moments-empty-icon" />
          <h4 className="moments-empty-title">No personal reminders yet</h4>
          <p className="moments-empty-desc">
            Some words are worth keeping. Write something you want to remember.
          </p>
          <button
            type="button"
            className="btn-primary-pill"
            onClick={handleOpenAddModal}
          >
            <Plus size={14} />
            <span>Write your first reminder</span>
          </button>
        </div>
      ) : (
        <div className="reminders-cards-layout">
          {/* Pinned Reminders Section */}
          {pinnedReminders.length > 0 && (
            <div className="reminders-group-section">
              <div className="reminders-group-header">
                <Pin size={13} className="pin-icon-header" />
                <span>Pinned Reminders</span>
                <span className="moments-count-badge">{pinnedReminders.length}</span>
              </div>

              <div className="reminders-grid">
                {pinnedReminders.map(rem => (
                  <ReminderCardItem
                    key={rem.id}
                    reminder={rem}
                    onEdit={() => handleOpenEditModal(rem)}
                    onDelete={() => handleDeleteReminder(rem.id)}
                    onTogglePin={() => handleTogglePin(rem.id)}
                    onToggleFavorite={() => handleToggleFavorite(rem.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Other Reminders Section */}
          {unpinnedReminders.length > 0 && (
            <div className="reminders-group-section">
              {pinnedReminders.length > 0 && (
                <div className="reminders-group-header">
                  <Tag size={13} />
                  <span>Other Reminders</span>
                  <span className="moments-count-badge">{unpinnedReminders.length}</span>
                </div>
              )}

              <div className="reminders-grid">
                {unpinnedReminders.map(rem => (
                  <ReminderCardItem
                    key={rem.id}
                    reminder={rem}
                    onEdit={() => handleOpenEditModal(rem)}
                    onDelete={() => handleDeleteReminder(rem.id)}
                    onTogglePin={() => handleTogglePin(rem.id)}
                    onToggleFavorite={() => handleToggleFavorite(rem.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal for create/edit */}
      <ReminderModal
        isOpen={isModalOpen}
        initialData={editingReminder}
        onClose={() => {
          setIsModalOpen(false)
          setEditingReminder(null)
        }}
        onSave={handleSaveReminder}
      />
    </div>
  )
}

function ReminderCardItem({
  reminder,
  onEdit,
  onDelete,
  onTogglePin,
  onToggleFavorite
}: {
  reminder: SelahReminder
  onEdit: () => void
  onDelete: () => void
  onTogglePin: () => void
  onToggleFavorite: () => void
}) {
  const formattedDate = useMemo(() => {
    try {
      const d = new Date(reminder.created_at)
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric'
      })
    } catch {
      return ''
    }
  }, [reminder.created_at])

  return (
    <div className={`reminder-card ${reminder.is_pinned ? 'is-pinned' : ''}`}>
      <div className="reminder-card-header">
        <span className="reminder-category-pill">{reminder.category}</span>
        <div className="reminder-card-actions">
          <button
            type="button"
            className={`moments-mini-action-btn ${reminder.is_pinned ? 'pin-active' : ''}`}
            title={reminder.is_pinned ? 'Unpin' : 'Pin to top'}
            onClick={onTogglePin}
          >
            <Pin size={12} fill={reminder.is_pinned ? 'currentColor' : 'none'} />
          </button>
          <button
            type="button"
            className={`moments-mini-action-btn ${reminder.is_favorite ? 'fav-active' : ''}`}
            title="Toggle favourite"
            onClick={onToggleFavorite}
          >
            <Heart size={12} fill={reminder.is_favorite ? 'currentColor' : 'none'} />
          </button>
          <button
            type="button"
            className="moments-mini-action-btn"
            title="Edit"
            onClick={onEdit}
          >
            <Edit2 size={12} />
          </button>
          <button
            type="button"
            className="moments-mini-action-btn delete-btn"
            title="Delete"
            onClick={onDelete}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      <h5 className="reminder-card-title">{reminder.title}</h5>
      <p className="reminder-card-content">{reminder.content}</p>

      {formattedDate && (
        <div className="reminder-card-footer">
          <span className="reminder-date">
            <Clock size={10} />
            <span>Saved {formattedDate}</span>
          </span>
        </div>
      )}
    </div>
  )
}
