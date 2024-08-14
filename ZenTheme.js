// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-gray; icon-glyph: paint-brush;
// ZenTheme.js: Theme configuration for ZenTrate and ZenLendar

// Theme configuration
const THEME_FILE = FileManager.iCloud().documentsDirectory() + "/zentrate_theme.json"

// Function to load theme configuration
function loadThemeConfig() {
  if (FileManager.iCloud().fileExists(THEME_FILE)) {
    const configString = FileManager.iCloud().readString(THEME_FILE)
    return JSON.parse(configString)
  }
  return {
    bgColor: "000000",
    textColor: "FFFFFF",
    fontName: "system",
    fontWeight: "semibold",
    fontItalic: false
  }
}

// Function to save theme configuration
function saveThemeConfig(config) {
  FileManager.iCloud().writeString(THEME_FILE, JSON.stringify(config, null, 2))
}

// Function to show configuration UI
async function showConfigurationUI() {
  const currentConfig = loadThemeConfig()
  const alert = new Alert()
  alert.title = "ZenTheme Configuration"
  alert.message = "Customize your widget appearance"
  
  alert.addTextField("Background Color (hex)", currentConfig.bgColor)
  alert.addTextField("Text Color (hex)", currentConfig.textColor)
  alert.addTextField("Font (system/serif/monospaced/rounded)", currentConfig.fontName)
  alert.addTextField("Font Weight", currentConfig.fontWeight)
  
  alert.addAction("Save")
  alert.addCancelAction("Cancel")
  
  const response = await alert.presentAlert()
  
  if (response !== -1) {  // If not cancelled
    currentConfig.bgColor = alert.textFieldValue(0)
    currentConfig.textColor = alert.textFieldValue(1)
    currentConfig.fontName = alert.textFieldValue(2)
    currentConfig.fontWeight = alert.textFieldValue(3)
    
    saveThemeConfig(currentConfig)
    return true  // Configuration updated
  }
  
  return false  // Configuration not updated
}

// Main function to run when the script is executed
async function run() {
  await showConfigurationUI()
  Script.complete()
}

// Only run the configuration UI when this script is executed directly
if (config.runsInApp) {
  await run()
}