import { useState } from 'react'
import { Sparkles, Heart, PenTool, Bookmark, ArrowLeft } from 'lucide-react'
import { MomentsRhythmBanner } from './MomentsRhythmBanner'
import { WordsForSoulSection } from './WordsForSoulSection'
import { WeeklyReflectionsSection } from './WeeklyReflectionsSection'
import { LittleRemindersSection } from './LittleRemindersSection'
import { ActiveTab } from '../../types'

type MomentsTab = 'words' | 'reflections' | 'reminders'

interface SelahMomentsViewProps {
  initialSubTab?: MomentsTab
  onNavigateHome?: () => void
  onShowMessage?: (msg: string) => void
}

export function SelahMomentsView({
  initialSubTab = 'words',
  onNavigateHome,
  onShowMessage
}: SelahMomentsViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<MomentsTab>(initialSubTab)

  return (
    <div className="selah-moments-view-container">
      {/* Page Header */}
      <div className="moments-view-header">
        <div className="moments-view-title-group">
          <div className="moments-brand-pill">
            <Sparkles size={12} className="moments-sparkle-spin" />
            <span>SELAH MOMENTS</span>
          </div>
          <h2 className="moments-page-title">A Little Space to Pause</h2>
          <p className="moments-page-subtitle">
            Sometimes, the most productive thing you can do is pause, reflect, and reconnect with yourself.
          </p>
        </div>

        {onNavigateHome && (
          <button
            type="button"
            className="btn-secondary-pill moments-back-btn"
            onClick={onNavigateHome}
          >
            <ArrowLeft size={13} />
            <span>Back to Home</span>
          </button>
        )}
      </div>

      {/* Gentle Weekly Rhythm Banner */}
      <MomentsRhythmBanner onOpenSection={setActiveSubTab} />

      {/* Navigation Sub-Tabs */}
      <div className="moments-tab-bar" role="tablist" aria-label="Selah Moments Sections">
        <button
          type="button"
          role="tab"
          aria-selected={activeSubTab === 'words'}
          className={`moments-tab-item ${activeSubTab === 'words' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('words')}
        >
          <Heart size={14} />
          <span>Words for the Soul</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeSubTab === 'reflections'}
          className={`moments-tab-item ${activeSubTab === 'reflections' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('reflections')}
        >
          <PenTool size={14} />
          <span>Weekly Reflections</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeSubTab === 'reminders'}
          className={`moments-tab-item ${activeSubTab === 'reminders' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('reminders')}
        >
          <Bookmark size={14} />
          <span>My Little Reminders</span>
        </button>
      </div>

      {/* Active Tab View */}
      <div className="moments-tab-content">
        {activeSubTab === 'words' && (
          <WordsForSoulSection onShowMessage={onShowMessage} />
        )}
        {activeSubTab === 'reflections' && (
          <WeeklyReflectionsSection onShowMessage={onShowMessage} />
        )}
        {activeSubTab === 'reminders' && (
          <LittleRemindersSection onShowMessage={onShowMessage} />
        )}
      </div>
    </div>
  )
}
