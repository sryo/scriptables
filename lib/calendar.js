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

async function getUpcomingEvents(maxEvents, daysAhead = 7) {
  const now = new Date()
  const futureDate = new Date(now.getTime() + datetime.MS_PER_DAY * daysAhead)
  const events = await getEventsBetween(now, futureDate)
  return events.slice(0, maxEvents)
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
  getTodayEvents,
  getTomorrowEvents,
  getTodayReminders
}
