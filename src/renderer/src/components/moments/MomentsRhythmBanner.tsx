import { useMemo } from 'react'
import { Sunrise, Compass, Award, Moon, Sparkles } from 'lucide-react'

interface MomentsRhythmBannerProps {
  onOpenSection?: (section: 'words' | 'reflections' | 'reminders') => void
}

export function MomentsRhythmBanner({ onOpenSection }: MomentsRhythmBannerProps) {
  const rhythm = useMemo(() => {
    const day = new Date().getDay()
    switch (day) {
      case 1:
        return {
          dayName: 'Monday',
          title: 'A New Beginning',
          description: 'A clean canvas for your week. Anchor your mind in calm focus and gentle hope.',
          icon: Sunrise,
          actionText: 'View Week’s Theme',
          target: 'reflections' as const
        }
      case 3:
        return {
          dayName: 'Wednesday',
          title: 'Pause and Reflect',
          description: 'You are halfway through. Pause, take a deep breath, and check in with your heart.',
          icon: Compass,
          actionText: 'Midweek Check-in',
          target: 'reflections' as const
        }
      case 5:
        return {
          dayName: 'Friday',
          title: 'Gratitude and Wins',
          description: 'Acknowledge how far you have come. Celebrate the small victories and good people.',
          icon: Award,
          actionText: 'Celebrate Wins',
          target: 'reflections' as const
        }
      case 0:
        return {
          dayName: 'Sunday',
          title: 'A Moment with Yourself',
          description: 'Rest, restoration, and surrender. What lessons will you carry gently forward?',
          icon: Moon,
          actionText: 'Reflect & Rest',
          target: 'reflections' as const
        }
      default:
        return {
          dayName: 'Today',
          title: 'A Gentle Check-in',
          description: 'Whatever your day looks like, remember that productivity does not define your worth.',
          icon: Sparkles,
          actionText: 'Take a Pause',
          target: 'words' as const
        }
    }
  }, [])

  const IconComponent = rhythm.icon

  return (
    <div className="moments-rhythm-banner">
      <div className="moments-rhythm-icon-wrapper">
        <IconComponent size={20} className="moments-rhythm-icon" />
      </div>
      <div className="moments-rhythm-content">
        <div className="moments-rhythm-tagline">
          <span className="moments-rhythm-day">{rhythm.dayName}</span>
          <span className="moments-rhythm-bullet">•</span>
          <span className="moments-rhythm-title">{rhythm.title}</span>
        </div>
        <p className="moments-rhythm-desc">{rhythm.description}</p>
      </div>
      <button
        type="button"
        className="moments-rhythm-action-btn"
        onClick={() => onOpenSection?.(rhythm.target)}
      >
        <span>{rhythm.actionText}</span>
      </button>
    </div>
  )
}
