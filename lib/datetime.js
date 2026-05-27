// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-gray; icon-glyph: clock;
/**
 * lib/datetime.js - Pure date and time helpers.
 *
 * No I/O. The single source of truth for time parsing and "is now in range"
 * predicates used by ZenTrate's time-constrained launcher items.
 */

const MS_PER_DAY = 86400000

function getCurrentHour() {
  return new Date().getHours()
}

function getCurrentDay() {
  return new Date().getDay()
}

function getTodayString() {
  return new Date().toDateString()
}

function isToday(date) {
  const today = new Date()
  return date.getDate() === today.getDate() &&
         date.getMonth() === today.getMonth() &&
         date.getFullYear() === today.getFullYear()
}

function getGreeting() {
  const hour = getCurrentHour()
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

function parseTime(timeStr) {
  if (!timeStr) return null

  if (/^\d{1,2}$/.test(timeStr)) {
    return { hour: parseInt(timeStr, 10), minute: 0 }
  }

  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/)
  if (match) {
    return { hour: parseInt(match[1], 10), minute: parseInt(match[2], 10) }
  }

  return null
}

function isWithinTimeRange(startTime, endTime) {
  const now = new Date()
  const currentHour = now.getHours()
  const currentMinute = now.getMinutes()

  if (startTime) {
    const start = parseTime(startTime)
    if (start && (currentHour < start.hour ||
        (currentHour === start.hour && currentMinute < start.minute))) {
      return false
    }
  }

  if (endTime) {
    const end = parseTime(endTime)
    if (end && (currentHour > end.hour ||
        (currentHour === end.hour && currentMinute > end.minute))) {
      return false
    }
  }

  return true
}

function isWithinDayRange(startDay, endDay) {
  if (startDay === undefined || endDay === undefined) return true
  const currentDay = getCurrentDay()
  return currentDay >= startDay && currentDay <= endDay
}

module.exports = {
  MS_PER_DAY,
  getCurrentHour,
  getCurrentDay,
  getTodayString,
  isToday,
  getGreeting,
  parseTime,
  isWithinTimeRange,
  isWithinDayRange
}
