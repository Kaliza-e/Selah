import { useState } from 'react'
import { Sparkles, Heart, PenTool, Bookmark, ArrowLeft } from 'lucide-react'
import { MomentsRhythmBanner } from './MomentsRhythmBanner'
import { WordsForSoulSection } from './WordsForSoulSection'
import { WeeklyReflectionsSection } from './WeeklyReflectionsSection'
import { LittleRemindersSection } from './LittleRemindersSection'

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
      {/* 1. Top Bar: small Selah Moments label and Back to Home button */}
      <div className="moments-view-top-bar">
        <div className="moments-brand-pill">
          <Sparkles size={12} className="moments-sparkle-spin" />
          <span>SELAH MOMENTS</span>
        </div>

        {onNavigateHome && (
          <button
            type="button"
            className="btn-secondary-pill moments-back-btn"
            onClick={onNavigateHome}
          >
            <ArrowLeft size={12} />
            <span>Back to Home</span>
          </button>
        )}
      </div>

      {/* 2. One short heading with no long subtitle */}
      <h1 className="moments-page-heading">Pause for a moment</h1>

      {/* 3. One short line for the day/mood banner with no extra description text */}
      <MomentsRhythmBanner onOpenSection={setActiveSubTab} />

      {/* Visually Lighter Tabs */}
      <div className="moments-tab-bar" role="tablist" aria-label="Selah Moments Sections">
        <button
          type="button"
          role="tab"
          aria-selected={activeSubTab === 'words'}
          className={`moments-tab-item ${activeSubTab === 'words' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('words')}
        >
          <Heart size={13} />
          <span>Words for the Soul</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeSubTab === 'reflections'}
          className={`moments-tab-item ${activeSubTab === 'reflections' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('reflections')}
        >
          <PenTool size={13} />
          <span>Weekly Reflections</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeSubTab === 'reminders'}
          className={`moments-tab-item ${activeSubTab === 'reminders' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('reminders')}
        >
          <Bookmark size={13} />
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
