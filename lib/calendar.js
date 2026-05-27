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

function getTodayRange() {
  const now = new Date()
  return {
    start: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0),
    end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
  }
}

async function getUpcomingEvents(maxEvents, daysAhead = 7) {
  try {
    const calendars = await Calendar.forEvents()
    const now = new Date()
    const futureDate = new Date(now.getTime() + datetime.MS_PER_DAY * daysAhead)
    const events = await CalendarEvent.between(now, futureDate, calendars)
    return events.slice(0, maxEvents)
  } catch (e) {
    console.error(`lib/calendar: Calendar error: ${e.message}`)
    return []
  }
}

async function getTodayEvents() {
  try {
    const calendars = await Calendar.forEvents()
    const { start, end } = getTodayRange()
    return await CalendarEvent.between(start, end, calendars)
  } catch (e) {
    console.error(`lib/calendar: Today events error: ${e.message}`)
    return []
  }
}

async function getTodayReminders({ includeCompleted = false } = {}) {
  try {
    const calendars = await Calendar.forReminders()
    const { start, end } = getTodayRange()
    const reminders = await Reminder.allDueBetween(start, end, calendars)
    return includeCompleted ? reminders : reminders.filter(r => !r.isCompleted)
  } catch (e) {
    console.error(`lib/calendar: Today reminders error: ${e.message}`)
    return []
  }
}

module.exports = {
  getTodayRange,
  getUpcomingEvents,
  getTodayEvents,
  getTodayReminders
}
