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

// Create example configuration
function createExampleConfig() {
  const exampleConfig = {
    items: [
      { name: "Settings", column: "left", scheme: "App-prefs://" },
      { name: "Weather", column: "left", scheme: "weather://" },
      { name: "Messages", column: "left", scheme: "messages://" },
      { name: "Calendar", column: "left", scheme: "calshow://" },
      { name: "Phone", column: "left", scheme: "tel://" },
      { name: "Maps", column: "left", scheme: "maps://" },
      { name: "Create Reminder", column: "right", scheme: "shortcuts://run-shortcut?name=Create%20Reminder" },
      { name: "Take Photo", column: "right", scheme: "shortcuts://run-shortcut?name=Take%20Photo" },
      { name: "QR Scanner", column: "right", scheme: "shortcuts://run-shortcut?name=QR%20Scanner" },
      { name: "Shazam", column: "right", scheme: "shortcuts://run-shortcut?name=Shazam" }
    ],
    sortMethod: "manual"
  }
  FileManager.iCloud().writeString(CONFIG_FILE, JSON.stringify(exampleConfig, null, 2))
  return exampleConfig
}

// Load configuration
function loadConfig() {
  if (FileManager.iCloud().fileExists(CONFIG_FILE)) {
    const configString = FileManager.iCloud().readString(CONFIG_FILE)
    return JSON.parse(configString)
  }
  return createExampleConfig()
}

// Load usage statistics
function loadStats() {
  if (FileManager.iCloud().fileExists(STATS_FILE)) {
    const statsString = FileManager.iCloud().readString(STATS_FILE)
    return JSON.parse(statsString)
  }
  return {}
}

// Save usage statistics
function saveStats(stats) {
  FileManager.iCloud().writeString(STATS_FILE, JSON.stringify(stats))
}

// Update usage count
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
let showLeft = true
let showCenter = true
let showRight = true
let sortMethod = config.sortMethod || "manual"

// Check if an item should be displayed based on time constraints
function shouldDisplayItem(item) {
  const now = new Date()
  const currentHour = now.getHours()
  const currentMinute = now.getMinutes()
  const currentDay = now.getDay()

  if (item.startTime) {
    const [startHour, startMinute] = item.startTime.split(':').map(Number)
    if (currentHour < startHour || (currentHour === startHour && currentMinute < startMinute)) {
      return false
    }
  }

  if (item.endTime) {
    const [endHour, endMinute] = item.endTime.split(':').map(Number)
    if (currentHour > endHour || (currentHour === endHour && currentMinute > endMinute)) {
      return false
    }
  }

  if (item.startDay !== undefined && item.endDay !== undefined) {
    if (currentDay < item.startDay || currentDay > item.endDay) {
      return false
    }
  }

  return true
}

// Filter items based on showLeft, showCenter, showRight, and time constraints
const filteredItems = config.items.filter(item => 
  ((showLeft && item.column === 'left') || 
   (showCenter && item.column === 'center') || 
   (showRight && item.column === 'right')) && 
  shouldDisplayItem(item)
)

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

// Calculate font size based on usage count
function getFontSize(usageCount) {
  const minSize = themeConfig.minFontSize
  const maxSize = themeConfig.maxFontSize
  const maxUsage = Math.max(...Object.values(usageStats), 1)
  const range = maxSize - minSize
  return Math.round(minSize + (usageCount / maxUsage) * range)
}

// Add an item to a row
function addItemToRow(rowStack, item, position) {
  let itemStack = rowStack.addStack()

  const usageCount = usageStats[item.name] || 0
  const fontSize = getFontSize(usageCount)
  const padding = calculatePadding(fontSize)

  let textStack = itemStack.addStack()
  textStack.setPadding(padding.top, padding.left, padding.bottom, padding.right)
  
  let itemText = textStack.addText(item.name)
  itemText.font = getFont(fontSize)
  itemText.textColor = new Color("#" + themeConfig.textColor)
  itemText.minimumScaleFactor = 0.5
  itemText.lineLimit = 1

  itemStack.url = `scriptable:///run?scriptName=${encodeURIComponent(Script.name())}&shortcut=${encodeURIComponent(item.name)}&originalUrl=${encodeURIComponent(item.scheme)}`
}

function calculatePadding(fontSize) {
  const maxFontSize = themeConfig.maxFontSize
  const basePadding = 0 // Adjust this value as needed
  const extraPadding = Math.max(0, (maxFontSize - fontSize) / 2)
  
  return {
    top: basePadding + extraPadding,
    bottom: basePadding + extraPadding,
    left: basePadding,
    right: basePadding
  }
}

function createWidget() {
  let widget = new ListWidget()
  widget.backgroundColor = new Color("#" + themeConfig.bgColor)

  // Create a single vertical stack for all items
  let mainStack = widget.addStack()
  mainStack.layoutVertically()

  // Group items by column
  let leftItems = sortedItems.filter(item => item.column === 'left')
  let centerItems = sortedItems.filter(item => item.column === 'center')
  let rightItems = sortedItems.filter(item => item.column === 'right')

  // Determine the maximum number of rows
  let maxRows = Math.max(leftItems.length, centerItems.length, rightItems.length)

  // Create rows
  for (let i = 0; i < maxRows; i++) {
    let rowStack = mainStack.addStack()
    rowStack.layoutHorizontally()
    rowStack.bottomAlignContent()

    // Left item
    if (i < leftItems.length) {
      addItemToRow(rowStack, leftItems[i], 'left')
    } else {
      rowStack.addSpacer()
    }

    rowStack.addSpacer()

    // Center item
    if (i < centerItems.length) {
      addItemToRow(rowStack, centerItems[i], 'center')
    } else {
      rowStack.addSpacer()
    }

    rowStack.addSpacer()

    // Right item
    if (i < rightItems.length) {
      addItemToRow(rowStack, rightItems[i], 'right')
    } else {
      rowStack.addSpacer()
    }

    // Add vertical spacing between rows
    if (i < maxRows - 1) {
      mainStack.addSpacer(2) // Adjust this value to change vertical spacing
    }
  }

  widget.setPadding(0, 8, 0, 8)
  return widget
}

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
