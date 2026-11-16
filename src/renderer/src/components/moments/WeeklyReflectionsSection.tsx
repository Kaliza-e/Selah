import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  PenTool,
  Save,
  CheckCircle2,
  Trash2,
  Calendar,
  BookOpen,
  Sparkles,
  ChevronRight,
  Edit3,
  Clock
} from 'lucide-react'
import { SelahPrompt, SelahReflection, toDateKey } from '../../types'

const REFLECTION_CATEGORIES = [
  'All',
  'Personal growth',
  'Gratitude',
  'Emotional well-being',
  'Faith',
  'Relationships',
  'Future and purpose'
]

function getIsoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

interface WeeklyReflectionsSectionProps {
  onShowMessage?: (msg: string) => void
}

export function WeeklyReflectionsSection({ onShowMessage }: WeeklyReflectionsSectionProps) {
  const now = useMemo(() => new Date(), [])
  const currentWeekKey = useMemo(() => getIsoWeekKey(now), [now])
  const currentDateKey = useMemo(() => toDateKey(now), [now])

  const [prompts, setPrompts] = useState<SelahPrompt[]>([])
  const [selectedPromptCategory, setSelectedPromptCategory] = useState('All')
  const [activePrompt, setActivePrompt] = useState<SelahPrompt | null>(null)
  const [responseText, setResponseText] = useState('')
  const [editingReflectionId, setEditingReflectionId] = useState<number | null>(null)
  const [customQuestion, setCustomQuestion] = useState('')

  const [reflections, setReflections] = useState<SelahReflection[]>([])
  const [selectedWeekFilter, setSelectedWeekFilter] = useState<'current' | 'all'>('all')
  const [savedSuccessMessage, setSavedSuccessMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const api = window.hello11824
      if (!api) return

      const [pList, currentPrompt, rList] = await Promise.all([
        api.listMomentsPrompts(),
        api.getWeeklyMomentsPrompt(currentWeekKey, now.getDay()),
        api.listMomentsReflections()
      ])

      setPrompts(pList || [])
      if (currentPrompt) {
        setActivePrompt(currentPrompt)
      } else if (pList && pList.length > 0) {
        setActivePrompt(pList[0])
      }
      setReflections(rList || [])
    } catch (err) {
      console.error('Failed to load reflections data:', err)
    }
  }, [currentWeekKey, now])

  useEffect(() => {
    loadData()
  }, [loadData])

  const filteredPrompts = useMemo(() => {
    if (selectedPromptCategory === 'All') return prompts
    return prompts.filter(p => p.category === selectedPromptCategory)
  }, [prompts, selectedPromptCategory])

  const effectivePromptQuestion = customQuestion || activePrompt?.question || 'What is one thing you are grateful for today?'
  const effectiveCategory = activePrompt?.category || 'Personal growth'

  const handleSelectPrompt = (prompt: SelahPrompt) => {
    setActivePrompt(prompt)
    setCustomQuestion('')
    setEditingReflectionId(null)
    setSavedSuccessMessage(null)
  }

  const handleSaveReflection = async () => {
    if (!responseText.trim()) {
      onShowMessage?.('Please write a few words before saving your reflection.')
      return
    }

    try {
      setIsSaving(true)
      const saved = await window.hello11824.saveMomentsReflection({
        id: editingReflectionId || undefined,
        weekKey: currentWeekKey,
        dateKey: currentDateKey,
        promptId: activePrompt?.id || null,
        promptQuestion: effectivePromptQuestion,
        category: effectiveCategory,
        responseText: responseText.trim()
      })

      // Update reflections list
      setReflections(prev => {
        const existingIdx = prev.findIndex(r => r.id === saved.id)
        if (existingIdx !== -1) {
          const updated = [...prev]
          updated[existingIdx] = saved
          return updated
        }
        return [saved, ...prev]
      })

      setSavedSuccessMessage('Saved gently. Thank yourself for pausing today.')
      onShowMessage?.('Reflection saved gently.')
      setResponseText('')
      setEditingReflectionId(null)
      setTimeout(() => setSavedSuccessMessage(null), 5000)
    } catch (err) {
      console.error('Failed to save reflection:', err)
      onShowMessage?.('Could not save reflection. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleEditReflection = (refl: SelahReflection) => {
    setEditingReflectionId(refl.id)
    setResponseText(refl.response_text)
    setCustomQuestion(refl.prompt_question)
    setSavedSuccessMessage(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDeleteReflection = async (id: number) => {
    if (!window.confirm('Delete this reflection entry?')) return
    try {
      await window.hello11824.deleteMomentsReflection(id)
      setReflections(prev => prev.filter(r => r.id !== id))
      if (editingReflectionId === id) {
        setEditingReflectionId(null)
        setResponseText('')
      }
      onShowMessage?.('Reflection deleted.')
    } catch (err) {
      console.error('Failed to delete reflection:', err)
    }
  }

  const displayedReflections = useMemo(() => {
    if (selectedWeekFilter === 'current') {
      return reflections.filter(r => r.week_key === currentWeekKey)
    }
    return reflections
  }, [reflections, selectedWeekFilter, currentWeekKey])

  // Group reflections by week_key
  const groupedReflections = useMemo(() => {
    const groups: Record<string, SelahReflection[]> = {}
    for (const r of displayedReflections) {
      if (!groups[r.week_key]) groups[r.week_key] = []
      groups[r.week_key].push(r)
    }
    return groups
  }, [displayedReflections])

  return (
    <div className="weekly-reflections-container">
      {/* Featured Writing Box */}
      <div className="moments-writing-hero-card">
        <div className="moments-writing-header">
          <div className="moments-writing-badge">
            <PenTool size={13} />
            <span>{editingReflectionId ? 'EDITING REFLECTION' : 'WEEKLY REFLECTION SPACE'}</span>
          </div>
          {activePrompt?.theme && (
            <span className="moments-theme-pill">{activePrompt.theme}</span>
          )}
        </div>

        {/* Prompt Question Showcase */}
        <div className="moments-prompt-display">
          <span className="moments-prompt-category-label">{effectiveCategory}</span>
          <h3 className="moments-prompt-question">&ldquo;{effectivePromptQuestion}&rdquo;</h3>
        </div>

        {/* Categories selector for prompts */}
        <div className="moments-prompt-category-filter">
          <span className="moments-filter-caption">Choose another prompt theme:</span>
          <div className="moments-prompt-pills">
            {filteredPrompts.slice(0, 6).map(p => (
              <button
                key={p.id}
                type="button"
                className={`moments-small-pill ${activePrompt?.id === p.id && !customQuestion ? 'active' : ''}`}
                onClick={() => handleSelectPrompt(p)}
              >
                {p.category}
              </button>
            ))}
          </div>
        </div>

        {/* Writing Area */}
        <div className="moments-textarea-wrapper">
          <textarea
            className="moments-reflection-textarea"
            rows={5}
            placeholder="Write your thoughts freely. There is no right or wrong answer, no streak to keep, and no expectations to meet..."
            value={responseText}
            onChange={e => setResponseText(e.target.value)}
          />
        </div>

        {/* Footer & Actions */}
        <div className="moments-writing-footer">
          <div className="moments-char-counter">
            {responseText.trim().split(/\s+/).filter(Boolean).length} words
          </div>

          <div className="moments-save-actions">
            {editingReflectionId && (
              <button
                type="button"
                className="btn-secondary-pill"
                onClick={() => {
                  setEditingReflectionId(null)
                  setResponseText('')
                  setCustomQuestion('')
                }}
              >
                Cancel Edit
              </button>
            )}

            <button
              type="button"
              className="btn-primary-pill moments-save-btn"
              onClick={handleSaveReflection}
              disabled={isSaving || !responseText.trim()}
            >
              <Save size={13} />
              <span>{editingReflectionId ? 'Update Reflection' : 'Save Reflection'}</span>
            </button>
          </div>
        </div>

        {savedSuccessMessage && (
          <div className="moments-gentle-success">
            <CheckCircle2 size={16} />
            <span>{savedSuccessMessage}</span>
          </div>
        )}
      </div>

      {/* History & Timeline Section */}
      <div className="moments-history-section">
        <div className="moments-history-header">
          <div className="moments-history-title-row">
            <Calendar size={16} className="moments-calendar-icon" />
            <h4 className="moments-history-title">Reflection History</h4>
            <span className="moments-count-badge">{reflections.length}</span>
          </div>

          <div className="moments-history-filters">
            <button
              type="button"
              className={`moments-small-pill ${selectedWeekFilter === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedWeekFilter('all')}
            >
              All Weeks
            </button>
            <button
              type="button"
              className={`moments-small-pill ${selectedWeekFilter === 'current' ? 'active' : ''}`}
              onClick={() => setSelectedWeekFilter('current')}
            >
              This Week
            </button>
          </div>
        </div>

        {reflections.length === 0 ? (
          <div className="moments-empty-card">
            <PenTool size={28} className="moments-empty-icon" />
            <h4 className="moments-empty-title">No reflections yet</h4>
            <p className="moments-empty-desc">
              Your thoughts deserve a place to live. Start with a little reflection above.
            </p>
          </div>
        ) : (
          <div className="moments-timeline-list">
            {Object.entries(groupedReflections).map(([week, list]) => (
              <div key={week} className="moments-week-group">
                <div className="moments-week-header">
                  <span className="moments-week-tag">{week}</span>
                  <span className="moments-week-count">
                    {list.length} reflection{list.length === 1 ? '' : 's'}
                  </span>
                </div>

                <div className="moments-reflections-cards">
                  {list.map(refl => (
                    <div key={refl.id} className="moments-reflection-card">
                      <div className="moments-card-top">
                        <div className="moments-meta-left">
                          <span className="moments-card-category">{refl.category}</span>
                          <span className="moments-date-text">
                            <Clock size={11} />
                            <span>{refl.date_key}</span>
                          </span>
                        </div>

                        <div className="moments-card-actions">
                          <button
                            type="button"
                            className="moments-mini-action-btn"
                            title="Edit reflection"
                            onClick={() => handleEditReflection(refl)}
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            type="button"
                            className="moments-mini-action-btn delete-btn"
                            title="Delete reflection"
                            onClick={() => handleDeleteReflection(refl.id)}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      <h5 className="moments-refl-question">&ldquo;{refl.prompt_question}&rdquo;</h5>
                      <p className="moments-refl-body">{refl.response_text}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
