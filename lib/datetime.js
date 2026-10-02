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

function getGreeting() {
  const hour = getCurrentHour()
  if (hour < 5) return "Good night"
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  if (hour < 21) return "Good evening"
  return "Good night"
}

/**
 * Parses "H", "HH", "H:MM" or "HH:MM" (or a whole-hour number).
 * @returns {{hour: number, minute: number}|null} null when missing or out of range
 */
function parseTime(timeStr) {
  if (timeStr === undefined || timeStr === null) return null
  const str = String(timeStr).trim()

  const match = str.match(/^(\d{1,2})(?::(\d{2}))?$/)
  if (!match) return null

  const hour = parseInt(match[1], 10)
  const minute = match[2] ? parseInt(match[2], 10) : 0
  if (hour > 23 || minute > 59) return null
  return { hour, minute }
}

function toMinutes(timeStr) {
  const t = parseTime(timeStr)
  return t ? t.hour * 60 + t.minute : null
}

function toDay(day) {
  if (day === undefined || day === null || day === "") return null
  const n = Number(day)
  return Number.isInteger(n) && n >= 0 && n <= 6 ? n : null
}

// Windows are [start, end): open at the start minute, closed from the end minute.
// start > end wraps past midnight; start === end means all day.
function isMinuteInWindow(minute, start, end) {
  if (start === null && end === null) return true
  if (start === null) return minute < end
  if (end === null) return minute >= start
  if (start === end) return true
  if (start < end) return minute >= start && minute < end
  return minute >= start || minute < end
}

// Inclusive on both ends; start > end wraps past Saturday (e.g. 5..1 = Fri-Mon).
function isDayInRange(day, startDay, endDay) {
  const start = toDay(startDay)
  const end = toDay(endDay)
  if (start === null || end === null) return true
  if (start <= end) return day >= start && day <= end
  return day >= start || day <= end
}

function isWithinTimeRange(startTime, endTime) {
  const now = new Date()
  const minute = now.getHours() * 60 + now.getMinutes()
  return isMinuteInWindow(minute, toMinutes(startTime), toMinutes(endTime))
}

function isWithinDayRange(startDay, endDay) {
  return isDayInRange(getCurrentDay(), startDay, endDay)
}

/**
 * Whether an item with optional startTime/endTime/startDay/endDay is active at a moment.
 * The after-midnight part of an overnight window belongs to the day it started on.
 * @param {Object} item
 * @param {Date} [date]
 * @returns {boolean}
 */
function isScheduledAt(item, date = new Date()) {
  const minute = date.getHours() * 60 + date.getMinutes()
  const start = toMinutes(item.startTime)
  const end = toMinutes(item.endTime)
  if (!isMinuteInWindow(minute, start, end)) return false

  const overnight = start !== null && end !== null && start > end
  const day = overnight && minute < end ? (date.getDay() + 6) % 7 : date.getDay()
  return isDayInRange(day, item.startDay, item.endDay)
}

/**
 * Earliest moment after `date` at which any item appears or disappears.
 * @param {Object[]} items
 * @param {Date} [date]
 * @returns {Date|null} null when no item ever changes
 */
function nextScheduleChange(items, date = new Date()) {
  let next = null
  for (const item of items) {
    const marks = [0, toMinutes(item.startTime), toMinutes(item.endTime)].filter(m => m !== null)
    const activeNow = isScheduledAt(item, date)
    const candidates = []
    for (let d = 0; d <= 7; d++) {
      for (const m of marks) {
        candidates.push(new Date(date.getFullYear(), date.getMonth(), date.getDate() + d,
          Math.floor(m / 60), m % 60, 0))
      }
    }
    candidates.sort((a, b) => a - b)
    const change = candidates.find(c => c > date && isScheduledAt(item, c) !== activeNow)
    if (change && (!next || change < next)) next = change
  }
  return next
}

module.exports = {
  MS_PER_DAY,
  getGreeting,
  parseTime,
  isWithinTimeRange,
  isWithinDayRange,
  isScheduledAt,
  nextScheduleChange
}
