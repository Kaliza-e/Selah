import { useState, useEffect } from 'react'
import { Clock, X } from 'lucide-react'
import { parseDurationString, formatDurationDisplay, MAX_DURATION_MINUTES } from '../lib/durationUtils'

interface DurationPickerProps {
  valueMinutes: number | null | undefined
  onChange: (minutes: number | null) => void
  label?: string
  helperText?: string
}

const PRESET_CHIPS = [
  { label: '15m', minutes: 15 },
  { label: '30m', minutes: 30 },
  { label: '45m', minutes: 45 },
  { label: '1h', minutes: 60 },
  { label: '1h 30m', minutes: 90 },
  { label: '2h', minutes: 120 },
  { label: '3h', minutes: 180 }
]

export function DurationPicker({
  valueMinutes,
  onChange,
  label = 'Duration',
  helperText = 'e.g. 1h 30m, 45m, or 90 (max 24h)'
}: DurationPickerProps) {
  const [inputText, setInputText] = useState(() => formatDurationDisplay(valueMinutes))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setInputText(formatDurationDisplay(valueMinutes))
    setError(null)
  }, [valueMinutes])

  function handleInputChange(text: string) {
    setInputText(text)
    if (!text.trim()) {
      setError(null)
      onChange(null)
      return
    }

    const parsed = parseDurationString(text)
    if (parsed === null) {
      setError('Enter valid duration up to 24h (e.g. 1h 30m, 45m)')
      // Keep parent informed of null
      onChange(null)
    } else {
      setError(null)
      onChange(parsed)
    }
  }

  function handleSelectChip(mins: number) {
    setError(null)
    setInputText(formatDurationDisplay(mins))
    onChange(mins)
  }

  function handleClear() {
    setError(null)
    setInputText('')
    onChange(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: 5, margin: 0 }}>
            <Clock size={12} style={{ color: 'var(--text-muted)' }} />
            <span>{label}</span>
          </label>
          {valueMinutes ? (
            <span style={{ fontSize: 11, color: 'var(--accent-purple)', fontWeight: 600 }}>
              {formatDurationDisplay(valueMinutes)} ({valueMinutes} min)
            </span>
          ) : (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{helperText}</span>
          )}
        </div>
      )}

      {/* Free Input Field */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          type="text"
          className="input-field"
          placeholder="e.g. 1h 30m, 45m, 2h"
          value={inputText}
          onChange={e => handleInputChange(e.target.value)}
          style={{
            paddingRight: inputText ? 28 : 10,
            borderColor: error ? '#f43f5e' : undefined
          }}
          aria-label={label}
        />
        {inputText && (
          <button
            type="button"
            className="win-btn"
            onClick={handleClear}
            title="Clear duration"
            aria-label="Clear duration"
            style={{
              position: 'absolute',
              right: 4,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 22,
              height: 22,
              padding: 0
            }}
          >
            <X size={12} />
          </button>
        )}
      </div>

      {error && (
        <div style={{ fontSize: 11, color: '#f43f5e', marginTop: -2 }}>
          {error}
        </div>
      )}

      {/* Quick-Pick Shortcut Chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
        {PRESET_CHIPS.map(chip => {
          const isSelected = valueMinutes === chip.minutes
          return (
            <button
              key={chip.minutes}
              type="button"
              onClick={() => handleSelectChip(chip.minutes)}
              className={`day-pill-btn ${isSelected ? 'active' : ''}`}
              style={{
                fontSize: 11,
                padding: '3px 8px',
                height: 24,
                borderRadius: 4
              }}
            >
              {chip.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

