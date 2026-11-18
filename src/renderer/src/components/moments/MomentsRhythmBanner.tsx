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
          icon: Sunrise,
          actionText: 'Weekly Theme',
          target: 'reflections' as const
        }
      case 3:
        return {
          dayName: 'Wednesday',
          title: 'Pause and Reflect',
          icon: Compass,
          actionText: 'Midweek Check-in',
          target: 'reflections' as const
        }
      case 5:
        return {
          dayName: 'Friday',
          title: 'Gratitude and Wins',
          icon: Award,
          actionText: 'Celebrate Wins',
          target: 'reflections' as const
        }
      case 0:
        return {
          dayName: 'Sunday',
          title: 'A Moment with Yourself',
          icon: Moon,
          actionText: 'Reflect & Rest',
          target: 'reflections' as const
        }
      default:
        return {
          dayName: 'Today',
          title: 'A Gentle Check-in',
          icon: Sparkles,
          actionText: 'Take a Pause',
          target: 'words' as const
        }
    }
  }, [])

  const IconComponent = rhythm.icon

  return (
    <div className="moments-rhythm-banner">
      <div className="moments-rhythm-left">
        <IconComponent size={14} className="moments-rhythm-icon" />
        <span className="moments-rhythm-day">{rhythm.dayName}</span>
        <span className="moments-rhythm-bullet">•</span>
        <span className="moments-rhythm-title">{rhythm.title}</span>
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
