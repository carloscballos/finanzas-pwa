function toDateInputValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Converts a <input type="date"> value ("YYYY-MM-DD") to an ISO timestamp
// for the API. Anchored at local NOON rather than local midnight (or, worse,
// `new Date(value).toISOString()`'s UTC midnight) so the round trip through
// UTC storage and back to a local-timezone display can't land on the wrong
// calendar day — noon leaves several hours of buffer on both sides for any
// realistic timezone offset, and sidesteps DST edge cases where local
// midnight doesn't exist for one day a year in some timezones.
export function dateInputToIso(value: string): string {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day, 12, 0, 0, 0).toISOString()
}

// Inverse of dateInputToIso: extracts a <input type="date"> value from a
// stored ISO timestamp, using the viewer's local calendar day.
export function isoToDateInput(iso: string): string {
  return toDateInputValue(new Date(iso))
}

// Today's date as a <input type="date"> value, in the viewer's local
// timezone — NOT `new Date().toISOString().slice(0, 10)`, which gives
// tomorrow's date for anyone east of UTC once it's already tomorrow in UTC
// (e.g. after 7pm in Bogotá, UTC-5).
export function todayDateInput(): string {
  return toDateInputValue(new Date())
}

// Formats a stored ISO timestamp as a calendar day only (no time-of-day) —
// consistent with how dateInputToIso anchors date-only values, so the day
// shown always matches the day the user picked.
export function formatDateOnly(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(iso))
}
