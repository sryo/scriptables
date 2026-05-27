// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-gray; icon-glyph: cog;
/**
 * ZenCore.js - Shared Utilities for Zen* Widget Suite
 *
 * Provides common functionality for ZenTrate, ZenLendar, ZenTheme, ZenTweak, and ZenDigest.
 * Import with: const ZenCore = importModule("ZenCore")
 *
 * @author sryo
 * @version 1.0.0
 */

// ============================================
// FILE MANAGEMENT (re-exported from lib/fs)
// ============================================

const fs = importModule("lib/fs")
const { fm, baseDir, getFilePath, loadJSON, saveJSON, fileExists, ensureDirectory, listDirectory } = fs

/**
 * Standard file paths used across Zen* widgets.
 * NOTE: This couples ZenCore to specific consumers and will be removed when
 * config/<script>.js modules are introduced (refactor step B.5).
 */
const PATHS = {
  theme: fm.joinPath(baseDir, "zentrate_theme.json"),
  zentrateConfig: fm.joinPath(baseDir, "zentrate_config.json"),
  zentrateStats: fm.joinPath(baseDir, "zentrate_stats.json"),
  zenlendarConfig: fm.joinPath(baseDir, "zenlendar_config.json"),
  zendigestConfig: fm.joinPath(baseDir, "zendigest_config.json"),
  themesFolder: fm.joinPath(baseDir, "ZenThemes")
}

// ============================================
// THEME + FONTS + COLORS (re-exported from lib/theme)
// ============================================

const theme = importModule("lib/theme")
const {
  DEFAULT_THEME, loadTheme, saveTheme, getDefaultTheme, loadAllThemes, saveThemeToFolder,
  getFont, getBoldFont, getMediumFont, getRegularFont,
  colorFromHex, getBackgroundColor, getTextColor, getAccentColor, getThemeColors
} = theme

// ============================================
// VALIDATION (re-exported from lib/validate)
// ============================================

const validate = importModule("lib/validate")
const {
  VALID_FONT_WEIGHTS, validateHexColor, validateFontWeight, validateFontSize,
  validateTime, validateDay, validateURLScheme
} = validate

// ============================================
// WIDGET UTILITIES
// ============================================

/**
 * Creates a new ListWidget with theme-based background
 * @param {Object} options - Widget options
 * @param {string} options.url - Optional tap URL for the widget
 * @param {number} options.refreshMinutes - Minutes until next refresh (default: 5)
 * @param {number[]} options.padding - Padding [top, left, bottom, right] (default: [0, 16, 0, 16])
 * @param {Object} options.theme - Theme config to use (default: current theme)
 * @returns {ListWidget}
 */
function createWidget(options = {}) {
  const widget = new ListWidget()
  const theme = options.theme || loadTheme()

  // Apply background color from theme
  widget.backgroundColor = getBackgroundColor(theme)

  // Set tap URL if provided
  if (options.url) {
    widget.url = options.url
  }

  // Set refresh interval
  const refreshMinutes = options.refreshMinutes || 5
  widget.refreshAfterDate = new Date(Date.now() + refreshMinutes * 60 * 1000)

  // Set padding
  const padding = options.padding || [0, 16, 0, 16]
  widget.setPadding(padding[0], padding[1], padding[2], padding[3])

  return widget
}

/**
 * Presents the widget appropriately based on context
 * @param {ListWidget} widget - The widget to present
 * @param {string} size - Widget size: "small", "medium", or "large" (default: "large")
 */
async function presentWidget(widget, size = "large") {
  if (config.runsInWidget) {
    Script.setWidget(widget)
  } else {
    switch (size) {
      case "small":
        await widget.presentSmall()
        break
      case "medium":
        await widget.presentMedium()
        break
      case "large":
      default:
        await widget.presentLarge()
    }
  }
  Script.complete()
}

/**
 * Checks if the script is running in a widget context
 * @returns {boolean}
 */
function isWidget() {
  return config.runsInWidget
}

/**
 * Checks if the script is running in the app
 * @returns {boolean}
 */
function isApp() {
  return config.runsInApp
}

/**
 * Builds a scriptable:///run URL for actions
 * @param {string} scriptName - Name of the script to run
 * @param {Object} params - Query parameters as key-value pairs
 * @returns {string} Full scriptable URL
 */
function buildActionURL(scriptName, params = {}) {
  let url = `scriptable:///run?scriptName=${encodeURIComponent(scriptName)}`

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url += `&${key}=${encodeURIComponent(value)}`
    }
  }

  return url
}

/**
 * Gets query parameters from the current script invocation
 * @returns {Object} Query parameters or empty object
 */
function getActionParams() {
  return args.queryParameters || {}
}

// ============================================
// DATE/TIME UTILITIES (re-exported from lib/datetime)
// ============================================

const datetime = importModule("lib/datetime")
const {
  MS_PER_DAY, getCurrentHour, getCurrentDay, getTodayString, isToday,
  getGreeting, parseTime, isWithinTimeRange, isWithinDayRange
} = datetime

/**
 * Gets upcoming calendar events
 * @param {number} maxEvents - Maximum events to return
 * @param {number} daysAhead - Days to look ahead (default: 7)
 * @returns {Promise<CalendarEvent[]>}
 */
async function getUpcomingEvents(maxEvents, daysAhead = 7) {
  try {
    const calendars = await Calendar.forEvents()
    const now = new Date()
    const futureDate = new Date(now.getTime() + MS_PER_DAY * daysAhead)

    const events = await CalendarEvent.between(now, futureDate, calendars)
    return events.slice(0, maxEvents)
  } catch (e) {
    console.error(`ZenCore: Calendar error: ${e.message}`)
    return []
  }
}

// ============================================
// UI UTILITIES
// ============================================

/**
 * Shows an error alert to the user
 * @param {string} title - Alert title
 * @param {string} message - Error message
 */
async function showError(title, message) {
  const alert = new Alert()
  alert.title = title
  alert.message = message
  alert.addAction("OK")
  await alert.presentAlert()
}

/**
 * Shows a success alert to the user
 * @param {string} title - Alert title
 * @param {string} message - Success message
 */
async function showSuccess(title, message) {
  const alert = new Alert()
  alert.title = title
  alert.message = message
  alert.addAction("OK")
  await alert.presentAlert()
}

// ============================================
// MODULE EXPORTS
// ============================================

module.exports = {
  // File Management
  fm,
  PATHS,
  getFilePath,
  loadJSON,
  saveJSON,
  fileExists,
  ensureDirectory,
  listDirectory,

  // Theme Management
  DEFAULT_THEME,
  loadTheme,
  saveTheme,
  getDefaultTheme,
  loadAllThemes,
  saveThemeToFolder,

  // Validation
  VALID_FONT_WEIGHTS,
  validateHexColor,
  validateFontWeight,
  validateFontSize,
  validateTime,
  validateDay,
  validateURLScheme,

  // Font Management
  getFont,
  getBoldFont,
  getRegularFont,
  getMediumFont,

  // Color Management
  colorFromHex,
  getBackgroundColor,
  getTextColor,
  getAccentColor,
  getThemeColors,

  // Widget Utilities
  createWidget,
  presentWidget,
  isWidget,
  isApp,
  buildActionURL,
  getActionParams,

  // Date/Time Utilities
  MS_PER_DAY,
  getCurrentHour,
  getCurrentDay,
  getTodayString,
  isToday,
  getGreeting,
  parseTime,
  isWithinTimeRange,
  isWithinDayRange,
  getUpcomingEvents,

  // UI Utilities
  showError,
  showSuccess
}
