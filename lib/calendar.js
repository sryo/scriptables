// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-gray; icon-glyph: calendar-alt;
/**
 * lib/calendar.js - Calendar + Reminders read helpers.
 *
 * Folds ZenLendar's "next N events" lookup and ZenDigest's "today" range
 * helpers into a single home, so future widgets don't fork these again.
 */

const datetime = importModule("lib/datetime")

function dayRange(offsetDays = 0) {
  const now = new Date()
  return {
    start: new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays, 0, 0, 0),
    end: new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays, 23, 59, 59)
  }
}

function getTodayRange() {
  return dayRange(0)
}

function getTomorrowRange() {
  return dayRange(1)
}

async function getEventsBetween(start, end) {
  try {
    const calendars = await Calendar.forEvents()
    return await CalendarEvent.between(start, end, calendars)
  } catch (e) {
    console.error(`lib/calendar: Events fetch error: ${e.message}`)
    return []
  }
}

async function getRemindersBetween(start, end, { includeCompleted = false } = {}) {
  try {
    const calendars = await Calendar.forReminders()
    const reminders = await Reminder.allDueBetween(start, end, calendars)
    return includeCompleted ? reminders : reminders.filter(r => !r.isCompleted)
  } catch (e) {
    console.error(`lib/calendar: Reminders fetch error: ${e.message}`)
    return []
  }
}

function isDeclined(event) {
  return (event.attendees || []).some(a => a.isCurrentUser && a.status === "declined")
}

// EventKit returns every event overlapping the range (so in-progress ones
// are included) in no guaranteed order.
async function getUpcomingEvents(maxEvents, daysAhead = 7) {
  const now = new Date()
  const futureDate = new Date(now.getTime() + datetime.MS_PER_DAY * daysAhead)
  const events = await getEventsBetween(now, futureDate)
  return events
    .filter(e => e.endDate > now && !isDeclined(e))
    .sort((a, b) => a.startDate - b.startDate || a.endDate - b.endDate)
    .slice(0, maxEvents)
}

function isOngoing(event, now = new Date()) {
  return event.startDate <= now && now < event.endDate
}

// The earliest moment after `now` at which any event starts or ends.
function nextBoundary(events, now = new Date()) {
  const times = events
    .flatMap(e => [e.startDate, e.endDate])
    .filter(d => d > now)
    .map(d => d.getTime())
  return times.length ? new Date(Math.min(...times)) : null
}

function getTodayEvents() {
  const { start, end } = dayRange(0)
  return getEventsBetween(start, end)
}

function getTomorrowEvents() {
  const { start, end } = dayRange(1)
  return getEventsBetween(start, end)
}

function getTodayReminders(opts) {
  const { start, end } = dayRange(0)
  return getRemindersBetween(start, end, opts)
}

module.exports = {
  getTodayRange,
  getTomorrowRange,
  getEventsBetween,
  getRemindersBetween,
  getUpcomingEvents,
  isOngoing,
  nextBoundary,
  getTodayEvents,
  getTomorrowEvents,
  getTodayReminders
}
