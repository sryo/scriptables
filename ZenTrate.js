// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-gray; icon-glyph: bars;
// ZenTrate.js: A Configurable Productivity Launcher Widget for Scriptable

// Theme configuration
const THEME_FILE = FileManager.iCloud().documentsDirectory() + "/zentrate_theme.json"

function loadThemeConfig() {
  if (FileManager.iCloud().fileExists(THEME_FILE)) {
    const configString = FileManager.iCloud().readString(THEME_FILE)
    return JSON.parse(configString)
  }
  return {
    bgColor: "000000",
    textColor: "FFFFFF",
    fontName: "system",
    fontWeight: "bold",
    fontItalic: false,
    minFontSize: 10,
    maxFontSize: 30
  }
}

const themeConfig = loadThemeConfig()

function getFont(size, config = themeConfig) {
  const fontName = config.fontName || "System";
  const weight = config.fontWeight || "regular";
  const isItalic = config.fontItalic || false;

  let font;
  if (fontName.toLowerCase() === "system") {
    font = Font[weight + "SystemFont"](size);
  } else {
    font = new Font(fontName, size);
  }

  if (isItalic) {
    font = Font.italicSystemFont(size);
  }

  return font;
}

// File paths
const CONFIG_FILE = FileManager.iCloud().documentsDirectory() + "/zentrate_config.json"
const STATS_FILE = FileManager.iCloud().documentsDirectory() + "/zentrate_stats.json"

// Function to create example configuration
function createExampleConfig() {
  const exampleConfig = {
    items: [
      { name: "Settings", type: "app", scheme: "App-prefs://" },
      { name: "Weather", type: "app", scheme: "weather://" },
      { name: "Messages", type: "app", scheme: "messages://" },
      { name: "Calendar", type: "app", scheme: "calshow://" },
      { name: "Phone", type: "app", scheme: "tel://" },
      { name: "Maps", type: "app", scheme: "maps://" },
      { name: "Create Reminder", type: "shortcut", scheme: "shortcuts://run-shortcut?name=Create%20Reminder" },
      { name: "Take Photo", type: "shortcut", scheme: "shortcuts://run-shortcut?name=Take%20Photo" },
      { name: "QR Scanner", type: "shortcut", scheme: "shortcuts://run-shortcut?name=QR%20Scanner" },
      { name: "Shazam", type: "shortcut", scheme: "shortcuts://run-shortcut?name=Shazam" }
    ],
    sortMethod: "manual"
  }
  FileManager.iCloud().writeString(CONFIG_FILE, JSON.stringify(exampleConfig, null, 2))
  return exampleConfig
}

// Function to load configuration
function loadConfig() {
  if (FileManager.iCloud().fileExists(CONFIG_FILE)) {
    const configString = FileManager.iCloud().readString(CONFIG_FILE)
    return JSON.parse(configString)
  }
  return createExampleConfig()
}

// Function to load usage statistics
function loadStats() {
  if (FileManager.iCloud().fileExists(STATS_FILE)) {
    const statsString = FileManager.iCloud().readString(STATS_FILE)
    return JSON.parse(statsString)
  }
  return {}
}

// Function to save usage statistics
function saveStats(stats) {
  FileManager.iCloud().writeString(STATS_FILE, JSON.stringify(stats))
}

// Function to update usage count
function updateUsageCount(name) {
  let stats = loadStats()
  if (!stats[name]) {
    stats[name] = 0
  }
  stats[name]++
  saveStats(stats)
}

// Load current configuration and usage statistics
let config = loadConfig()
let usageStats = loadStats()

// Set default values for widget configuration
let showApps = true
let showShortcuts = true
let sortMethod = config.sortMethod || "manual"

// Filter items based on showApps and showShortcuts
const filteredItems = config.items.filter(item => 
  (showApps && item.type === 'app') || (showShortcuts && item.type === 'shortcut')
)

// Sorting function
function sortItems(items) {
  switch(sortMethod) {
    case 'usage':
      return items.sort((a, b) => (usageStats[b.name] || 0) - (usageStats[a.name] || 0))
    case 'alphabetical':
      return items.sort((a, b) => a.name.localeCompare(b.name))
    case 'manual':
    default:
      return items // Return items in their original order
  }
}

const sortedItems = sortItems(filteredItems)

// Function to calculate font size based on usage count
function getFontSize(usageCount) {
  const minSize = themeConfig.minFontSize
  const maxSize = themeConfig.maxFontSize
  const maxUsage = Math.max(...Object.values(usageStats), 1)
  const range = maxSize - minSize
  return Math.round(minSize + (usageCount / maxUsage) * range)
}

// Function to create the widget
function createWidget() {
  let widget = new ListWidget()
  widget.backgroundColor = new Color("#" + themeConfig.bgColor)

  // Create a stack layout for two columns
  let rowStack = widget.addStack()
  rowStack.layoutHorizontally()

  // Left column for apps
  let appsStack = rowStack.addStack()
  let appColumn = appsStack.addStack()
  appColumn.layoutVertically()

  rowStack.addSpacer()

  // Right column for shortcuts
  let shortcutsStack = rowStack.addStack()
  let shortcutColumn = shortcutsStack.addStack()
  shortcutColumn.layoutVertically()

  sortedItems.forEach(item => {
    let itemStack
    if (item.type === 'shortcut') {
      itemStack = shortcutColumn.addStack()
    } else {
      itemStack = appColumn.addStack()
    }
    itemStack.setPadding(8, 8, 8, 8)
    
    const usageCount = usageStats[item.name] || 0
    let itemText = itemStack.addText(item.name)
    itemText.font = getFont(getFontSize(usageCount))
    itemText.textColor = new Color("#" + themeConfig.textColor)
    itemText.minimumScaleFactor = 0.5
    itemText.lineLimit = 1
    itemStack.url = `scriptable:///run?scriptName=${encodeURIComponent(Script.name())}&shortcut=${encodeURIComponent(item.name)}&originalUrl=${encodeURIComponent(item.scheme)}`
    
    if (item.type === 'shortcut') {
      shortcutColumn.addSpacer(2)
    } else {
      appColumn.addSpacer(2)
    }
  })
  widget.setPadding(0, 0, 0, 0)
  return widget
}

// Handle actions
if (args.queryParameters && args.queryParameters.shortcut) {
  const shortcutName = decodeURIComponent(args.queryParameters.shortcut)
  const originalUrl = decodeURIComponent(args.queryParameters.originalUrl)
  updateUsageCount(shortcutName)
  Safari.open(originalUrl)
  Script.complete()
} else {
  // Create and present the widget
  let widget = createWidget()
  if (config.runsInWidget) {
    Script.setWidget(widget)
  } else {
    widget.presentLarge()
  }
}