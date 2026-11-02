/** Departures are local wall-clock times at the origin: `YYYY-MM-DDTHH:MM`. */

export const MAX_DAYS_AHEAD = 13

const pad = (n: number) => String(n).padStart(2, '0')

export function toDeparture(date: Date, time: string): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${time}`
}

export function parseDeparture(value: string): { date: Date; time: string } {
  const [day, time] = value.split('T')
  const [year, month, dayOfMonth] = day.split('-').map(Number)
  return { date: new Date(year, month - 1, dayOfMonth), time }
}

export function defaultDeparture(now: Date = new Date()): string {
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return toDeparture(tomorrow, '08:00')
}

export function formatDeparture(value: string): string {
  const { date, time } = parseDeparture(value)
  const [hours, minutes] = time.split(':').map(Number)
  date.setHours(hours, minutes)
  return date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatClock(hours: number, minutes: number): string {
  const suffix = hours < 12 ? 'AM' : 'PM'
  return `${hours % 12 === 0 ? 12 : hours % 12}:${pad(minutes)} ${suffix}`
}

export const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const hours = Math.floor(i / 2)
  const minutes = i % 2 === 0 ? 0 : 30
  return { value: `${pad(hours)}:${pad(minutes)}`, label: formatClock(hours, minutes) }
})

/** First and last bookable days, matching the server's 13-day limit. */
export function bookableDays(now: Date = new Date()): { first: Date; last: Date } {
  const first = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const last = new Date(first.getFullYear(), first.getMonth(), first.getDate() + MAX_DAYS_AHEAD)
  return { first, last }
}

/** An arrival time shown in the origin's time zone, e.g. "Tue, 1:10 PM CST". */
export function formatEta(isoUtc: string, timeZone: string): string {
  return new Date(isoUtc).toLocaleString('en-US', {
    timeZone,
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}
