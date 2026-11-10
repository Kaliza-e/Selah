/**
 * Duration Parsing and Formatting Utilities
 * Supports free string input (e.g., "1h 30m", "90m", "2h", "45"),
 * validation (must be positive, max 24 hours / 1440 minutes),
 * and standard concise display formatting.
 */

export const MAX_DURATION_MINUTES = 24 * 60 // 1440 minutes = 24 hours

/**
 * Parses user input string into positive minutes.
 * Handles:
 * - "1h 30m", "1h30m", "1 hr 30 mins"
 * - "90m", "90 min", "90mins"
 * - "1.5h", "2 hours", "2h"
 * - "45" (assumed minutes if no unit specified)
 * Returns null if invalid, <= 0, or exceeds 24h (1440m).
 */
export function parseDurationString(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null
  if (typeof input === 'number') {
    if (isNaN(input) || input <= 0) return null
    const clamped = Math.round(input)
    return clamped <= MAX_DURATION_MINUTES ? clamped : null
  }

  const trimmed = input.trim().toLowerCase()
  if (!trimmed) return null

  // Decimal hours: "1.5h" or "1.5 hours"
  const decimalHoursMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)$/)
  if (decimalHoursMatch) {
    const hours = parseFloat(decimalHoursMatch[1])
    if (isNaN(hours) || hours <= 0) return null
    const mins = Math.round(hours * 60)
    return mins <= MAX_DURATION_MINUTES ? mins : null
  }

  // Mixed format: "1h 30m" or "1h30"
  const hoursMinutesMatch = trimmed.match(/^(\d+)\s*(?:h|hr|hrs|hour|hours)(?:\s*(\d+)\s*(?:m|min|mins|minute|minutes)?)?$/)
  if (hoursMinutesMatch) {
    const hours = parseInt(hoursMinutesMatch[1], 10)
    const mins = hoursMinutesMatch[2] ? parseInt(hoursMinutesMatch[2], 10) : 0
    if (isNaN(hours) || (hours === 0 && mins === 0)) return null
    const total = hours * 60 + mins
    return total <= MAX_DURATION_MINUTES ? total : null
  }

  // Minutes only: "45m", "45 mins", "45"
  const minutesMatch = trimmed.match(/^(\d+)\s*(?:m|min|mins|minute|minutes)?$/)
  if (minutesMatch) {
    const mins = parseInt(minutesMatch[1], 10)
    if (isNaN(mins) || mins <= 0) return null
    return mins <= MAX_DURATION_MINUTES ? mins : null
  }

  return null
}

/**
 * Formats minutes into concise human readable string:
 * 45 -> "45m"
 * 60 -> "1h"
 * 90 -> "1h 30m"
 * 120 -> "2h"
 */
export function formatDurationDisplay(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return ''
  const clamped = Math.min(minutes, MAX_DURATION_MINUTES)
  const hrs = Math.floor(clamped / 60)
  const mins = clamped % 60

  if (hrs > 0 && mins > 0) {
    return `${hrs}h ${mins}m`
  }
  if (hrs > 0) {
    return `${hrs}h`
  }
  return `${mins}m`
}

/**
 * Calculates end time string "HH:MM" given a start time "HH:MM" and duration in minutes
 */
export function addMinutesToTime(startTime: string, durationMinutes: number): string {
  const parts = startTime.split(':')
  if (parts.length < 2) return ''
  const h = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10)
  if (isNaN(h) || isNaN(m)) return ''

  const totalMins = (h * 60 + m + durationMinutes) % (24 * 60)
  const endH = Math.floor(totalMins / 60)
  const endM = totalMins % 60
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
}

/**
 * Calculates duration in minutes between start time and end time "HH:MM"
 */
export function calculateMinutesBetween(startTime: string, endTime: string): number | null {
  const startParts = startTime.split(':')
  const endParts = endTime.split(':')
  if (startParts.length < 2 || endParts.length < 2) return null

  const sh = parseInt(startParts[0], 10)
  const sm = parseInt(startParts[1], 10)
  const eh = parseInt(endParts[0], 10)
  const em = parseInt(endParts[1], 10)
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return null

  let diff = (eh * 60 + em) - (sh * 60 + sm)
  if (diff < 0) diff += 24 * 60 // cross midnight
  return diff > 0 && diff <= MAX_DURATION_MINUTES ? diff : null
}
