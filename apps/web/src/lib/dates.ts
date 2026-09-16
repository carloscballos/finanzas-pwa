function toDateInputValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toDateTimeInputValue(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${toDateInputValue(date)}T${hours}:${minutes}`
}

// <input type="datetime-local"> helpers. The value ("YYYY-MM-DDTHH:mm") has no
// timezone by design: it is the wall-clock time where the user IS right now
// (Bogotá, Ciudad de México, wherever), so it's parsed with the local-time
// Date constructor and stored as the UTC instant. Displaying it back with
// Intl (no explicit timeZone) renders it in the viewer's own zone, so the
// same movement shows Bogotá time in Bogotá and CDMX time in CDMX. Parsed by
// hand instead of `new Date(value)` because the bare-string parsing rules
// differ between engines (Safari historically treated it as UTC).
export function dateTimeInputToIso(value: string): string {
  const [datePart, timePart = '00:00'] = value.split('T')
  const [year, month, day] = datePart.split('-').map(Number)
  const [hours, minutes] = timePart.split(':').map(Number)
  return new Date(year, month - 1, day, hours, minutes, 0, 0).toISOString()
}

export function isoToDateTimeInput(iso: string): string {
  return toDateTimeInputValue(new Date(iso))
}

// "Right now" as a <input type="datetime-local"> value, in local time — the
// default for every form that registers a movement.
export function nowDateTimeInput(): string {
  return toDateTimeInputValue(new Date())
}

// Turns a date-only value ("YYYY-MM-DD", e.g. what a receipt or statement
// extraction gives back) into a datetime-local value. Anchored at noon for
// the same reason as dateInputToIso: the source only knows the day.
export function dateInputToDateTimeInput(value: string): string {
  return `${value}T12:00`
}

// Formats a stored ISO timestamp as day + time in the viewer's local zone.
export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  )
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
