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
// FILE MANAGEMENT
// ============================================

const fm = FileManager.iCloud()
const baseDir = fm.documentsDirectory()

/**
 * Standard file paths used across Zen* widgets
 */
const PATHS = {
  theme: fm.joinPath(baseDir, "zentrate_theme.json"),
  zentrateConfig: fm.joinPath(baseDir, "zentrate_config.json"),
  zentrateStats: fm.joinPath(baseDir, "zentrate_stats.json"),
  zenlendarConfig: fm.joinPath(baseDir, "zenlendar_config.json"),
  zendigestConfig: fm.joinPath(baseDir, "zendigest_config.json"),
  themesFolder: fm.joinPath(baseDir, "ZenThemes")
}

/**
 * Builds a full path in the Scriptable documents directory
 * @param {string} filename - The filename (e.g., "config.json")
 * @returns {string} Full path
 */
function getFilePath(filename) {
  return fm.joinPath(baseDir, filename)
}

/**
 * Loads JSON data from a file with error handling and fallback
 * @param {string} path - Full path to the file
 * @param {Object} defaultValue - Default value if file doesn't exist or is invalid
 * @returns {Object} Parsed JSON or default value
 */
function loadJSON(path, defaultValue = {}) {
  try {
    if (fm.fileExists(path)) {
      // Check if file is downloaded from iCloud
      if (!fm.isFileDownloaded(path)) {
        fm.downloadFileFromiCloud(path)
      }
      const content = fm.readString(path)
      if (content && content.trim()) {
        return JSON.parse(content)
      }
    }
  } catch (e) {
    console.error(`ZenCore: Error reading ${path}: ${e.message}`)
  }
  return defaultValue
}

/**
 * Saves data as JSON to a file
 * @param {string} path - Full path to the file
 * @param {Object} data - Data to save
 * @param {boolean} prettyPrint - Whether to format with indentation (default: true)
 */
function saveJSON(path, data, prettyPrint = true) {
  try {
    const content = prettyPrint
      ? JSON.stringify(data, null, 2)
      : JSON.stringify(data)
    fm.writeString(path, content)
  } catch (e) {
    console.error(`ZenCore: Error writing ${path}: ${e.message}`)
  }
}

/**
 * Checks if a file exists in the documents directory
 * @param {string} path - Full path to check
 * @returns {boolean}
 */
function fileExists(path) {
  return fm.fileExists(path)
}

/**
 * Creates a directory if it doesn't exist
 * @param {string} path - Full path to directory
 */
function ensureDirectory(path) {
  if (!fm.fileExists(path)) {
    fm.createDirectory(path)
  }
}

/**
 * Lists files in a directory
 * @param {string} path - Full path to directory
 * @returns {string[]} Array of filenames
 */
function listDirectory(path) {
  if (fm.fileExists(path)) {
    return fm.listContents(path)
  }
  return []
}

// ============================================
// THEME MANAGEMENT
// ============================================

/**
 * Default theme configuration - single source of truth
 */
const DEFAULT_THEME = {
  name: "Noir",
  author: "sryo",
  bgColor: "000000",
  textColor: "FFFFFF",
  accentColor: "0A84FF",
  fontName: "system",
  fontWeight: "bold",
  fontItalic: false,
  minFontSize: 10,
  maxFontSize: 20
}

/**
 * Loads the current theme configuration
 * @returns {Object} Theme configuration with defaults applied
 */
function loadTheme() {
  const theme = loadJSON(PATHS.theme, DEFAULT_THEME)
  // Merge with defaults to ensure all fields exist
  return { ...DEFAULT_THEME, ...theme }
}

/**
 * Saves the current theme configuration
 * @param {Object} theme - Theme configuration to save
 */
function saveTheme(theme) {
  saveJSON(PATHS.theme, theme, true)
}

/**
 * Gets a copy of the default theme
 * @returns {Object} Default theme configuration
 */
function getDefaultTheme() {
  return { ...DEFAULT_THEME }
}

/**
 * Loads all saved themes from the themes folder
 * @returns {Object[]} Array of theme objects sorted alphabetically
 */
function loadAllThemes() {
  ensureDirectory(PATHS.themesFolder)
  const files = listDirectory(PATHS.themesFolder)
  const themes = []

  for (const file of files) {
    if (file.endsWith('.json')) {
      const themePath = fm.joinPath(PATHS.themesFolder, file)
      try {
        const theme = loadJSON(themePath, null)
        if (theme) {
          theme.filename = file
          themes.push(theme)
        }
      } catch (e) {
        console.error(`ZenCore: Error loading theme ${file}: ${e.message}`)
      }
    }
  }

  return themes.sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Saves a theme to the themes folder
 * @param {Object} theme - Theme configuration
 * @param {string} filename - Filename (auto-generated from name if not provided)
 */
function saveThemeToFolder(theme, filename = null) {
  ensureDirectory(PATHS.themesFolder)
  const fname = filename || `${theme.name.toLowerCase().replace(/\s+/g, '-')}.json`
  const path = fm.joinPath(PATHS.themesFolder, fname)
  saveJSON(path, theme, true)
}

// ============================================
// VALIDATION
// ============================================

/**
 * Valid font weights for Scriptable
 */
const VALID_FONT_WEIGHTS = ['regular', 'medium', 'semibold', 'bold', 'heavy', 'black', 'light', 'ultraLight', 'thin']

/**
 * Validates a hex color string
 * @param {string} hex - Hex color (with or without #)
 * @returns {string|null} Clean hex string without # or null if invalid
 */
function validateHexColor(hex) {
  if (!hex || typeof hex !== 'string') return null
  const clean = hex.replace(/^#/, '').toUpperCase()
  return /^[0-9A-F]{6}$/.test(clean) ? clean : null
}

/**
 * Validates a font weight
 * @param {string} weight - Font weight to validate
 * @returns {string} Valid font weight or 'regular' as fallback
 */
function validateFontWeight(weight) {
  if (!weight || typeof weight !== 'string') return 'regular'
  const lower = weight.toLowerCase()
  // Handle common variations
  if (lower === 'semibold') return 'semibold'
  return VALID_FONT_WEIGHTS.includes(lower) ? lower : 'regular'
}

/**
 * Validates a font size
 * @param {number} size - Font size to validate
 * @param {number} min - Minimum allowed (default: 8)
 * @param {number} max - Maximum allowed (default: 72)
 * @returns {number} Valid font size within bounds
 */
function validateFontSize(size, min = 8, max = 72) {
  const num = parseInt(size)
  if (isNaN(num)) return 14 // sensible default
  return Math.min(Math.max(num, min), max)
}

/**
 * Validates and formats a time string
 * @param {string} time - Time string (HH:MM or HH)
 * @returns {string|undefined} Formatted time (HH:MM) or undefined if empty/invalid
 * @throws {Error} If format is invalid
 */
function validateTime(time) {
  if (!time || time.trim() === '') return undefined

  time = time.trim()

  // Support short time format (just hour)
  if (/^\d{1,2}$/.test(time)) {
    const hour = parseInt(time)
    if (hour < 0 || hour > 23) {
      throw new Error(`Invalid hour: ${time}. Must be 0-23.`)
    }
    return time.padStart(2, '0') + ':00'
  }

  // Validate full time format
  const match = time.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) {
    throw new Error(`Invalid time format: ${time}. Use HH:MM or HH.`)
  }

  const hour = parseInt(match[1])
  const minute = parseInt(match[2])

  if (hour < 0 || hour > 23) {
    throw new Error(`Invalid hour: ${hour}. Must be 0-23.`)
  }
  if (minute < 0 || minute > 59) {
    throw new Error(`Invalid minute: ${minute}. Must be 0-59.`)
  }

  return match[1].padStart(2, '0') + ':' + match[2]
}

/**
 * Validates a day number
 * @param {string|number} day - Day to validate (0-6, 0 is Sunday)
 * @returns {number|undefined} Valid day number or undefined if empty
 * @throws {Error} If day is invalid
 */
function validateDay(day) {
  if (day === '' || day === undefined || day === null) return undefined
  const dayNum = parseInt(day)
  if (isNaN(dayNum) || dayNum < 0 || dayNum > 6) {
    throw new Error(`Invalid day: ${day}. Must be 0-6 (0 is Sunday).`)
  }
  return dayNum
}

/**
 * Validates a URL scheme
 * @param {string} url - URL to validate
 * @returns {boolean} True if URL appears valid
 */
function validateURLScheme(url) {
  if (!url || typeof url !== 'string') return false
  return url.includes('://') || url.startsWith('/')
}

// ============================================
// FONT MANAGEMENT
// ============================================

/**
 * Creates a font based on theme configuration
 * @param {number} size - Font size in points
 * @param {Object} options - Optional overrides
 * @param {string} options.fontName - Font name (default: from theme)
 * @param {string} options.weight - Font weight (default: from theme)
 * @param {boolean} options.italic - Whether to use italic (default: from theme)
 * @param {Object} options.theme - Theme config to use (default: current theme)
 * @returns {Font} Scriptable Font object
 */
function getFont(size, options = {}) {
  const theme = options.theme || loadTheme()

  const fontName = (options.fontName || theme.fontName || 'system').toLowerCase()
  const weight = validateFontWeight(options.weight || theme.fontWeight)
  const isItalic = options.italic !== undefined ? options.italic : (theme.fontItalic || false)

  let font

  try {
    if (fontName === 'system') {
      const methodName = weight + 'SystemFont'
      if (typeof Font[methodName] === 'function') {
        font = Font[methodName](size)
      } else {
        font = Font.systemFont(size)
      }
    } else if (fontName === 'serif') {
      font = Font.serifSystemFont(size)
    } else if (fontName === 'monospaced' || fontName === 'mono') {
      font = Font.monospaceSystemFont(size)
    } else if (fontName === 'rounded') {
      font = Font.roundedSystemFont(size)
    } else {
      // Custom font name
      font = new Font(fontName, size)
    }

    // Italic overrides weight in Scriptable
    if (isItalic) {
      font = Font.italicSystemFont(size)
    }
  } catch (e) {
    console.error(`ZenCore: Font error, falling back to system: ${e.message}`)
    font = Font.systemFont(size)
  }

  return font
}

/**
 * Creates a bold font at the specified size
 * @param {number} size - Font size
 * @returns {Font}
 */
function getBoldFont(size) {
  return getFont(size, { weight: 'bold' })
}

/**
 * Creates a regular font at the specified size
 * @param {number} size - Font size
 * @returns {Font}
 */
function getRegularFont(size) {
  return getFont(size, { weight: 'regular' })
}

/**
 * Creates a medium weight font at the specified size
 * @param {number} size - Font size
 * @returns {Font}
 */
function getMediumFont(size) {
  return getFont(size, { weight: 'medium' })
}

// ============================================
// COLOR MANAGEMENT
// ============================================

/**
 * Creates a Color from a hex string (with or without #)
 * @param {string} hex - Hex color string (e.g., "FFFFFF" or "#FFFFFF")
 * @returns {Color} Scriptable Color object
 */
function colorFromHex(hex) {
  const validated = validateHexColor(hex)
  if (!validated) {
    console.error(`ZenCore: Invalid color "${hex}", using white`)
    return new Color("#FFFFFF")
  }
  return new Color("#" + validated)
}

/**
 * Gets the background color from the current theme
 * @param {Object} theme - Optional theme config (default: current theme)
 * @returns {Color}
 */
function getBackgroundColor(theme = null) {
  const t = theme || loadTheme()
  return colorFromHex(t.bgColor)
}

/**
 * Gets the primary text color from the current theme
 * @param {Object} theme - Optional theme config (default: current theme)
 * @returns {Color}
 */
function getTextColor(theme = null) {
  const t = theme || loadTheme()
  return colorFromHex(t.textColor)
}

/**
 * Gets the accent color from the current theme
 * @param {Object} theme - Optional theme config (default: current theme)
 * @returns {Color}
 */
function getAccentColor(theme = null) {
  const t = theme || loadTheme()
  return colorFromHex(t.accentColor || "0A84FF")
}

/**
 * Gets all theme colors as an object
 * @param {Object} theme - Optional theme config (default: current theme)
 * @returns {Object} Object with background, text, accent Color objects
 */
function getThemeColors(theme = null) {
  const t = theme || loadTheme()
  return {
    background: colorFromHex(t.bgColor),
    text: colorFromHex(t.textColor),
    accent: colorFromHex(t.accentColor || "0A84FF")
  }
}

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
// DATE/TIME UTILITIES
// ============================================

/** Milliseconds in a day */
const MS_PER_DAY = 86400000

/**
 * Gets the current hour (0-23)
 * @returns {number}
 */
function getCurrentHour() {
  return new Date().getHours()
}

/**
 * Gets the current day of week (0 = Sunday, 6 = Saturday)
 * @returns {number}
 */
function getCurrentDay() {
  return new Date().getDay()
}

/**
 * Gets today's date string (for comparison/caching)
 * @returns {string} e.g., "Fri Jan 02 2026"
 */
function getTodayString() {
  return new Date().toDateString()
}

/**
 * Checks if a date is today
 * @param {Date} date - Date to check
 * @returns {boolean}
 */
function isToday(date) {
  const today = new Date()
  return date.getDate() === today.getDate() &&
         date.getMonth() === today.getMonth() &&
         date.getFullYear() === today.getFullYear()
}

/**
 * Gets time-of-day greeting
 * @returns {string} "Good morning", "Good afternoon", or "Good evening"
 */
function getGreeting() {
  const hour = getCurrentHour()
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

/**
 * Parses a time string (HH:MM or HH) into hours and minutes
 * @param {string} timeStr - Time string
 * @returns {{hour: number, minute: number} | null}
 */
function parseTime(timeStr) {
  if (!timeStr) return null

  // Support short format (just hour)
  if (/^\d{1,2}$/.test(timeStr)) {
    return { hour: parseInt(timeStr), minute: 0 }
  }

  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/)
  if (match) {
    return { hour: parseInt(match[1]), minute: parseInt(match[2]) }
  }

  return null
}

/**
 * Checks if current time is within a time range
 * @param {string} startTime - Start time (HH:MM)
 * @param {string} endTime - End time (HH:MM)
 * @returns {boolean}
 */
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

/**
 * Checks if current day is within a day range
 * @param {number} startDay - Start day (0-6)
 * @param {number} endDay - End day (0-6)
 * @returns {boolean}
 */
function isWithinDayRange(startDay, endDay) {
  if (startDay === undefined || endDay === undefined) return true
  const currentDay = getCurrentDay()
  return currentDay >= startDay && currentDay <= endDay
}

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
