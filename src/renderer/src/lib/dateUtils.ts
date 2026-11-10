/**
 * Unified Date and Relative Time Utilities for Selah
 * Ensures consistent date formatting across all views:
 * "Today 21:15", "Tomorrow", "Mon 9 Nov", "Yesterday"
 */

export function toDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatTaskDate(
  dueDate: string | null | undefined,
  dueTime: string | null | undefined,
  currentDate = new Date()
): string {
  if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    return dueTime ? `Today ${dueTime}` : ''
  }

  const todayKey = toDateKey(currentDate)

  // Yesterday
  const yest = new Date(currentDate)
  yest.setDate(yest.getDate() - 1)
  const yestKey = toDateKey(yest)

  // Tomorrow
  const tom = new Date(currentDate)
  tom.setDate(tom.getDate() + 1)
  const tomKey = toDateKey(tom)

  let datePart = ''
  if (dueDate === todayKey) {
    datePart = 'Today'
  } else if (dueDate === tomKey) {
    datePart = 'Tomorrow'
  } else if (dueDate === yestKey) {
    datePart = 'Yesterday'
  } else {
    const [y, m, d] = dueDate.split('-').map(Number)
    const taskDate = new Date(y, m - 1, d)
    const sameYear = taskDate.getFullYear() === currentDate.getFullYear()
    const weekday = taskDate.toLocaleDateString('en-US', { weekday: 'short' })
    const month = taskDate.toLocaleDateString('en-US', { month: 'short' })
    datePart = sameYear
      ? `${weekday} ${d} ${month}`
      : `${d} ${month} ${y}`
  }

  return dueTime ? `${datePart} ${dueTime}` : datePart
}

export function isTaskOverdue(
  dueDate: string | null | undefined,
  dueTime: string | null | undefined,
  completed: boolean | number,
  now = new Date()
): boolean {
  if (completed) return false
  if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return false

  const todayKey = toDateKey(now)
  if (dueDate < todayKey) return true

  if (dueDate === todayKey && dueTime && /^\d{2}:\d{2}$/.test(dueTime)) {
    const [h, m] = dueTime.split(':').map(Number)
    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    const dueMinutes = h * 60 + m
    return currentMinutes > dueMinutes
  }

  return false
}
