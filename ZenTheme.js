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

const ZenCore = importModule("lib/ZenCore")

// ============================================
// INITIALIZATION
// ============================================

/**
 * Ensures themes folder exists with default theme
 */
function ensureThemesFolder() {
  const themes = ZenCore.loadAllThemes()
  if (themes.length === 0) {
    ZenCore.saveThemeToFolder(ZenCore.DEFAULT_THEME, "noir.json")
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
  const themes = ZenCore.loadAllThemes()
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
    ZenCore.saveTheme(themes[response])
    await ZenCore.showSuccess("Theme Applied", `"${themes[response].name}" is now active.`)
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

  if (!ZenCore.validateHexColor(theme.bgColor)) {
    errors.push("Invalid background color (use 6-digit hex, e.g., 000000)")
  }

  if (!ZenCore.validateHexColor(theme.textColor)) {
    errors.push("Invalid text color (use 6-digit hex, e.g., FFFFFF)")
  }

  const minSize = parseInt(theme.minFontSize)
  const maxSize = parseInt(theme.maxFontSize)

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
 * Shows the theme configuration/creation UI
 * @returns {Promise<boolean>} True if theme was saved
 */
async function showConfigurationUI() {
  const currentTheme = ZenCore.loadTheme()
  const alert = new Alert()
  alert.title = "New Theme"

  THEME_FIELDS.forEach(field => {
    const value = String(currentTheme[field.key] || "")
    alert.addTextField(`${field.label}`, value)
  })

  alert.addAction("Save")
  alert.addCancelAction("Cancel")

  const response = await alert.presentAlert()

  if (response !== -1) {
    const newTheme = {}
    THEME_FIELDS.forEach((field, index) => {
      newTheme[field.key] = alert.textFieldValue(index)
    })

    // Convert fontItalic to boolean
    newTheme.fontItalic = newTheme.fontItalic.toLowerCase() === 'true'

    // Convert font sizes to numbers
    newTheme.minFontSize = parseInt(newTheme.minFontSize) || 10
    newTheme.maxFontSize = parseInt(newTheme.maxFontSize) || 20

    // Validate theme
    const validation = validateTheme(newTheme)
    if (!validation.valid) {
      await ZenCore.showError("Validation Error", validation.errors.join("\n"))
      return showConfigurationUI() // Retry
    }

    // Clean hex colors (remove # if present)
    newTheme.bgColor = ZenCore.validateHexColor(newTheme.bgColor)
    newTheme.textColor = ZenCore.validateHexColor(newTheme.textColor)

    // Generate filename
    const filename = `${newTheme.name.toLowerCase().replace(/\s+/g, '-')}.json`

    // Save as current theme and to folder
    ZenCore.saveTheme(newTheme)
    ZenCore.saveThemeToFolder(newTheme, filename)

    await ZenCore.showSuccess(
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
  ensureThemesFolder()
  await showThemePicker()
  Script.complete()
}

if (ZenCore.isApp()) {
  await run()
}
