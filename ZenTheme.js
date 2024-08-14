// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-gray; icon-glyph: paint-brush;
// ZenTheme.js: Theme configuration for ZenTrate and ZenLendar

const fm = FileManager.iCloud()
const THEMES_FOLDER = fm.documentsDirectory() + "/ZenThemes"
const THEME_FILE = fm.documentsDirectory() + "/zentrate_theme.json"

// Default theme configuration
const DEFAULT_THEME = {
  name: "Noir",
  author: "sryo",
  bgColor: "000000",
  textColor: "FFFFFF",
  fontName: "system",
  fontWeight: "bold",
  fontItalic: false,
  minFontSize: 10,
  maxFontSize: 20
}

// Ensure themes folder exists
function ensureThemesFolder() {
  if (!fm.fileExists(THEMES_FOLDER)) {
    fm.createDirectory(THEMES_FOLDER)
    saveTheme(DEFAULT_THEME, "noir.json")
  }
}

// Function to load theme configuration
function loadThemeConfig() {
  if (fm.fileExists(THEME_FILE)) {
    const configString = fm.readString(THEME_FILE)
    return JSON.parse(configString)
  }
  return DEFAULT_THEME
}

// Function to save theme configuration
function saveThemeConfig(config) {
  fm.writeString(THEME_FILE, JSON.stringify(config, null, 2))
}

// Function to save a theme to the themes folder
function saveTheme(theme, filename) {
  const themePath = fm.joinPath(THEMES_FOLDER, filename)
  const themeString = `// ZenTrate Theme\n${JSON.stringify(theme, null, 2)}`
  fm.writeString(themePath, themeString)
}

// Function to load themes from the themes folder
function loadThemes() {
  const themes = []
  const files = fm.listContents(THEMES_FOLDER)
  for (const file of files) {
    if (file.endsWith('.json')) {
      const themePath = fm.joinPath(THEMES_FOLDER, file)
      const themeString = fm.readString(themePath)
      const theme = JSON.parse(themeString.split('\n').slice(1).join('\n'))
      theme.filename = file
      themes.push(theme)
    }
  }
  return themes
}

// Function to show theme picker UI
async function showThemePicker() {
  const themes = loadThemes()
  const alert = new Alert()
  alert.title = "ZenTheme Picker"
  alert.message = "Choose a theme or create a new one"
  
  themes.forEach(theme => {
    alert.addAction(theme.name)
  })
  
  alert.addAction("New Theme")
  alert.addCancelAction("Cancel")
  
  const response = await alert.presentAlert()
  
  if (response === themes.length) {
    return showConfigurationUI()
  } else if (response !== -1) {
    saveThemeConfig(themes[response])
    return true
  }
  
  return false
}

// Function to show configuration UI
async function showConfigurationUI(existingTheme = DEFAULT_THEME) {
  const alert = new Alert()
  alert.title = "ZenTheme Configuration"
  alert.message = "Create or edit a theme"
  
  const fields = [
    { key: "name", label: "Theme Name" },
    { key: "author", label: "Author" },
    { key: "bgColor", label: "Background Color (hex)" },
    { key: "textColor", label: "Text Color (hex)" },
    { key: "fontName", label: "Font (system/serif/monospaced/rounded)" },
    { key: "fontWeight", label: "Font Weight" },
    { key: "fontItalic", label: "Italic (true/false)" },
    { key: "minFontSize", label: "Min Font Size" },
    { key: "maxFontSize", label: "Max Font Size" }
  ]
  
  fields.forEach(field => {
    const value = existingTheme[field.key].toString()
    alert.addTextField(`${field.label} (Current: ${value})`, value)
  })
  
  alert.addAction("Save")
  alert.addCancelAction("Cancel")
  
  const response = await alert.presentAlert()
  
  if (response !== -1) {  // If not cancelled
    const newTheme = {}
    fields.forEach((field, index) => {
      newTheme[field.key] = alert.textFieldValue(index)
    })
    
    // Convert fontItalic to boolean
    newTheme.fontItalic = newTheme.fontItalic.toLowerCase() === 'true'
    
    // Convert font sizes to numbers
    newTheme.minFontSize = parseInt(newTheme.minFontSize)
    newTheme.maxFontSize = parseInt(newTheme.maxFontSize)
    
    const filename = `${newTheme.name.toLowerCase().replace(/\s+/g, '-')}.json`
    saveTheme(newTheme, filename)
    saveThemeConfig(newTheme)
    return true  // Configuration updated
  }
  
  return false  // Configuration not updated
}

// Main function to run when the script is executed
async function run() {
  ensureThemesFolder()
  await showThemePicker()
  Script.complete()
}

// Only run the configuration UI when this script is executed directly
if (config.runsInApp) {
  await run()
}