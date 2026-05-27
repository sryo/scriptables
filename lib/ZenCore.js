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
// WIDGET HELPERS (re-exported from lib/widget)
// ============================================

const widget = importModule("lib/widget")
const {
  createWidget, presentWidget, isWidget, isApp, buildActionURL, getActionParams
} = widget

// ============================================
// DATE/TIME UTILITIES (re-exported from lib/datetime)
// ============================================

const datetime = importModule("lib/datetime")
const {
  MS_PER_DAY, getCurrentHour, getCurrentDay, getTodayString, isToday,
  getGreeting, parseTime, isWithinTimeRange, isWithinDayRange
} = datetime

// ============================================
// CALENDAR (re-exported from lib/calendar)
// ============================================

const calendar = importModule("lib/calendar")
const { getUpcomingEvents } = calendar

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
