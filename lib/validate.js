// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-gray; icon-glyph: check-circle;
/**
 * lib/validate.js - Pure validators for theme/config editor UIs.
 *
 * Consumer-agnostic. No I/O, no module-level side effects.
 */

const VALID_FONT_WEIGHTS = [
  'regular', 'medium', 'semibold', 'bold', 'heavy', 'black', 'light', 'ultraLight', 'thin'
]

function validateHexColor(hex) {
  if (!hex || typeof hex !== 'string') return null
  const clean = hex.replace(/^#/, '').toUpperCase()
  return /^[0-9A-F]{6}$/.test(clean) ? clean : null
}

function validateFontWeight(weight) {
  if (!weight || typeof weight !== 'string') return 'regular'
  const lower = weight.toLowerCase()
  return VALID_FONT_WEIGHTS.includes(lower) ? lower : 'regular'
}

function validateTime(time) {
  if (!time || time.trim() === '') return undefined

  time = time.trim()

  if (/^\d{1,2}$/.test(time)) {
    const hour = parseInt(time, 10)
    if (hour < 0 || hour > 23) {
      throw new Error(`Invalid hour: ${time}. Must be 0-23.`)
    }
    return time.padStart(2, '0') + ':00'
  }

  const match = time.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) {
    throw new Error(`Invalid time format: ${time}. Use HH:MM or HH.`)
  }

  const hour = parseInt(match[1], 10)
  const minute = parseInt(match[2], 10)

  if (hour < 0 || hour > 23) {
    throw new Error(`Invalid hour: ${hour}. Must be 0-23.`)
  }
  if (minute < 0 || minute > 59) {
    throw new Error(`Invalid minute: ${minute}. Must be 0-59.`)
  }

  return match[1].padStart(2, '0') + ':' + match[2]
}

function validateDay(day) {
  if (day === '' || day === undefined || day === null) return undefined
  const dayNum = parseInt(day, 10)
  if (isNaN(dayNum) || dayNum < 0 || dayNum > 6) {
    throw new Error(`Invalid day: ${day}. Must be 0-6 (0 is Sunday).`)
  }
  return dayNum
}

module.exports = {
  validateHexColor,
  validateFontWeight,
  validateTime,
  validateDay
}
