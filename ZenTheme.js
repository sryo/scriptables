// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-gray; icon-glyph: paint-brush;
/**
 * ZenTheme.js - Theme Manager for Zen* Widget Suite
 *
 * Features:
 * - Browse and select saved themes
 * - Create new custom themes
 * - Edit theme properties (colors, fonts, sizes)
 */

const Theme = importModule("lib/theme")
const Widget = importModule("lib/widget")
const Validate = importModule("lib/validate")
const UI = importModule("lib/ui")

// ============================================
// INITIALIZATION
// ============================================

/**
 * Ensures themes folder exists with default theme
 */
function ensureThemesFolder() {
  const themes = Theme.loadAllThemes()
  if (themes.length === 0) {
    Theme.saveThemeToFolder(Theme.DEFAULT_THEME, "noir.json")
  }
}

// ============================================
// THEME PICKER UI
// ============================================

/**
 * Shows the main theme picker interface
 * @returns {Promise<boolean>} True if a theme was selected/created
 */
async function showThemePicker() {
  const themes = Theme.loadAllThemes()
  const alert = new Alert()
  alert.title = "ZenTheme"
  alert.message = "Pick or create a new theme"

  themes.forEach(theme => {
    alert.addAction(theme.name)
  })

  alert.addAction("New Theme")
  alert.addCancelAction("Cancel")

  const response = await alert.presentSheet()

  if (response === themes.length) {
    return showConfigurationUI()
  } else if (response !== -1) {
    Theme.saveTheme(themes[response])
    await UI.showSuccess("Theme Applied", `"${themes[response].name}" is now active.`)
    return true
  }

  return false
}

// ============================================
// THEME EDITOR UI
// ============================================

/**
 * Field definitions for theme editor
 */
const THEME_FIELDS = [
  { key: "name", label: "Theme Name" },
  { key: "author", label: "Author" },
  { key: "bgColor", label: "Background (hex)" },
  { key: "textColor", label: "Text (hex)" },
  { key: "fontName", label: "Font (system/serif/monospaced/rounded)" },
  { key: "fontWeight", label: "Weight (regular/bold/medium)" },
  { key: "fontItalic", label: "Italic (true/false)" },
  { key: "minFontSize", label: "Min Size (8-72)" },
  { key: "maxFontSize", label: "Max Size (8-72)" }
]

/**
 * Validates theme configuration
 * @param {Object} theme - Theme to validate
 * @returns {{valid: boolean, errors: string[]}}
 */
function validateTheme(theme) {
  const errors = []

  if (!theme.name || theme.name.trim() === "") {
    errors.push("Theme name is required")
  }

  if (!Validate.validateHexColor(theme.bgColor)) {
    errors.push("Invalid background color (use 6-digit hex, e.g., 000000)")
  }

  if (!Validate.validateHexColor(theme.textColor)) {
    errors.push("Invalid text color (use 6-digit hex, e.g., FFFFFF)")
  }

  const minSize = parseFontSize(theme.minFontSize)
  const maxSize = parseFontSize(theme.maxFontSize)

  if (isNaN(minSize) || minSize < 8 || minSize > 72) {
    errors.push("Min font size must be 8-72")
  }

  if (isNaN(maxSize) || maxSize < 8 || maxSize > 72) {
    errors.push("Max font size must be 8-72")
  }

  if (!isNaN(minSize) && !isNaN(maxSize) && minSize > maxSize) {
    errors.push("Min font size cannot be larger than max")
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Parses a whole-number font size typed by the user
 * @param {string|number} value
 * @returns {number} NaN unless the value is an integer
 */
function parseFontSize(value) {
  const text = String(value ?? "").trim()
  return /^\d+$/.test(text) ? Number(text) : NaN
}

/**
 * Shows the theme configuration/creation UI
 * @param {Object} [draft] - Previously entered values to prefill after a validation error
 * @returns {Promise<boolean>} True if theme was saved
 */
async function showConfigurationUI(draft = null) {
  const currentTheme = Theme.loadTheme()
  const prefill = draft || currentTheme
  const alert = new Alert()
  alert.title = "New Theme"

  THEME_FIELDS.forEach(field => {
    const value = String(prefill[field.key] ?? "")
    alert.addTextField(`${field.label}`, value)
  })

  alert.addAction("Save")
  alert.addCancelAction("Cancel")

  const response = await alert.presentAlert()

  if (response !== -1) {
    const entered = {}
    THEME_FIELDS.forEach((field, index) => {
      entered[field.key] = alert.textFieldValue(index)
    })

    const validation = validateTheme(entered)
    if (!validation.valid) {
      await UI.showError("Validation Error", validation.errors.join("\n"))
      return showConfigurationUI(entered)
    }

    // Fields the editor doesn't expose (e.g. accentColor) carry over from
    // the current theme; filename is picker bookkeeping, not theme data.
    const { filename: _, ...inherited } = currentTheme
    const newTheme = { ...inherited, ...entered }
    newTheme.name = entered.name.trim()
    newTheme.fontItalic = entered.fontItalic.trim().toLowerCase() === 'true'
    newTheme.minFontSize = parseFontSize(entered.minFontSize)
    newTheme.maxFontSize = parseFontSize(entered.maxFontSize)

    // Clean hex colors (remove # if present)
    newTheme.bgColor = Validate.validateHexColor(newTheme.bgColor)
    newTheme.textColor = Validate.validateHexColor(newTheme.textColor)

    // Generate filename
    const filename = Theme.themeFilename(newTheme.name)

    // Save as current theme and to folder
    Theme.saveTheme(newTheme)
    Theme.saveThemeToFolder(newTheme, filename)

    await UI.showSuccess(
      "Theme Saved",
      `Your theme "${newTheme.name}" has been saved and is available in the ZenThemes folder as "${filename}".`
    )

    return true
  }

  return false
}

// ============================================
// MAIN EXECUTION
// ============================================

async function run() {
  await Theme.downloadThemes()
  ensureThemesFolder()
  await showThemePicker()
  Script.complete()
}

if (Widget.isApp()) {
  await run()
}
