// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-gray; icon-glyph: bars;
// ZenTrate: A Configurable Productivity Launcher Widget for Scriptable

let widget = new ListWidget()

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
    ]
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

// Get widget parameters or use defaults
let params = []
if (args.widgetParameter) {
  params = args.widgetParameter.split(",")
} else if (args.queryParameters && args.queryParameters.widgetParameter) {
  params = args.queryParameters.widgetParameter.split(",")
}

let showApps = params.includes("apps")
let showShortcuts = params.includes("shortcuts")
if (!showApps && !showShortcuts) {
  showApps = true
  showShortcuts = true
}
let bgColor = params.find(p => p.startsWith("bg:"))?.replace("bg:", "") || "000000"
let textColor = params.find(p => p.startsWith("text:"))?.replace("text:", "") || "FFFFFF"
let fontName = params.find(p => p.startsWith("font:"))?.replace("font:", "") || "systemFont"
let sortMethod = params.find(p => p.startsWith("sort:"))?.replace("sort:", "") || "alphabetical"

widget.backgroundColor = new Color("#" + bgColor)

// Filter items based on showApps and showShortcuts parameters
const filteredItems = config.items.filter(item => 
  (showApps && item.type === 'app') || (showShortcuts && item.type === 'shortcut')
)

// Sorting function
function sortItems(items) {
  switch(sortMethod) {
    case 'usage':
      return items.sort((a, b) => (usageStats[b.name] || 0) - (usageStats[a.name] || 0))
    case 'alphabetical':
    default:
      return items.sort((a, b) => a.name.localeCompare(b.name))
  }
}

const sortedItems = sortItems(filteredItems)

// Function to get the appropriate font
function getFont(size, isBold = false) {
  switch (fontName.toLowerCase()) {
    case "serif":
      return isBold ? Font.heavySerifFont(size) : Font.serifFont(size)
    case "monospaced":
      return isBold ? Font.heavyMonospacedSystemFont(size) : Font.monospaceSystemFont(size)
    case "rounded":
      return isBold ? Font.heavyRoundedSystemFont(size) : Font.roundedSystemFont(size)
    default:
      return isBold ? Font.boldSystemFont(size) : Font.systemFont(size)
  }
}

// Function to calculate font size based on usage count
function getFontSize(usageCount) {
  const minSize = 8
  const maxSize = 36
  const maxUsage = Math.max(...Object.values(usageStats), 1)
  const range = maxSize - minSize
  return Math.round(minSize + (usageCount / maxUsage) * range)
}

// Function to display empty state with instructions
function showEmptyState() {
  let stack = widget.addStack()
  stack.layoutVertically()
  stack.centerAlignContent()
  
  stack.addSpacer(8)
  
  let instructions = stack.addText("To get started, edit the 'zentrate_config.json' file in your Scriptable iCloud folder. Add your shortcuts and apps, then refresh the widget.")
  instructions.font = Font.systemFont(12)
  instructions.textColor = new Color("#" + textColor)
  instructions.textAlignment = Text.Alignment.Center
  instructions.minimumScaleFactor = 0.5
}

// Create widget content
if (sortedItems.length === 0) {
  showEmptyState()
} else {
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
    let itemText
    const usageCount = usageStats[item.name] || 0
    if (item.type === 'shortcut') {
      itemText = shortcutColumn.addText(item.name)
      itemText.font = getFont(getFontSize(usageCount))
    } else {
      itemText = appColumn.addText(item.name)
      itemText.font = getFont(getFontSize(usageCount), true)
    }
    itemText.textColor = new Color("#" + textColor)
    itemText.minimumScaleFactor = 0.5
    itemText.lineLimit = 1
    itemText.url = `scriptable:///run?scriptName=${encodeURIComponent(Script.name())}&shortcut=${encodeURIComponent(item.name)}&originalUrl=${encodeURIComponent(item.scheme)}`
    
    if (item.type === 'shortcut') {
      shortcutColumn.addSpacer(12)
    } else {
      appColumn.addSpacer(12)
    }
  })
}

// Set padding for the widget
widget.setPadding(0, 8, 0, 8)

// Handle shortcut/app opening and usage count update
if (args.queryParameters && args.queryParameters.shortcut) {
  const shortcutName = decodeURIComponent(args.queryParameters.shortcut)
  const originalUrl = decodeURIComponent(args.queryParameters.originalUrl)
  updateUsageCount(shortcutName)
  Safari.open(originalUrl)
  Script.complete()
} else {
  // Present the widget
  if (config.runsInWidget) {
    Script.setWidget(widget)
  } else {
    widget.presentLarge()
  }
}
