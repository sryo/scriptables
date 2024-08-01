// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-gray; icon-glyph: bars;
// ZenTrate: A Minimalist Productivity Launcher Widget for Scriptable

let widget = new ListWidget()
widget.backgroundColor = new Color("#000000")

// File path for storing usage statistics
const STATS_FILE = FileManager.local().documentsDirectory() + "widget_usage_stats.json"

// Function to load usage statistics
function loadStats() {
  if (FileManager.local().fileExists(STATS_FILE)) {
    const statsString = FileManager.local().readString(STATS_FILE)
    return JSON.parse(statsString)
  }
  return {}
}

// Function to save usage statistics
function saveStats(stats) {
  FileManager.local().writeString(STATS_FILE, JSON.stringify(stats))
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

// Load current usage statistics
let usageStats = loadStats()

// Define your shortcuts and apps with their corresponding scheme links
const items = [
  { name: "Avisarme en...", type: "shortcut", scheme: "shortcuts://run-shortcut?name=Avisarme%20en" },
  { name: "Buscar", type: "shortcut", scheme: "shortcuts://run-shortcut?name=Buscar" },
  { name: "Crear audio", type: "shortcut", scheme: "shortcuts://run-shortcut?name=Crear%20audio" },
  { name: "Crear foto", type: "shortcut", scheme: "shortcuts://run-shortcut?name=Crear%20foto" },
  { name: "Crear nota", type: "shortcut", scheme: "shortcuts://run-shortcut?name=Crear%20nota" },
  { name: "Crear video", type: "shortcut", scheme: "shortcuts://run-shortcut?name=Crear%20video" },
  { name: "Leer QR", type: "shortcut", scheme: "shortcuts://run-shortcut?name=Leer%20QR" },
  { name: "Pagar con QR", type: "shortcut", scheme: "shortcuts://run-shortcut?name=Pagar%20con%20QR" },
  { name: "Reconocer tema", type: "shortcut", scheme: "shortcuts://run-shortcut?name=Reconocer%20tema" },
  { name: "Ver dirección", type: "shortcut", scheme: "shortcuts://run-shortcut?name=Ver%20dirección" },
  { name: "Ajustes", type: "app", scheme: "App-prefs://" },
  { name: "Clima", type: "app", scheme: "weather://" },
  { name: "Doble factor", type: "app", scheme: "googleauthenticator://" },
  { name: "Feedly", type: "app", scheme: "feedly://" },
  { name: "Fotos", type: "app", scheme: "googlephotos://" },
  { name: "Instagram", type: "app", scheme: "instagram://" },
  { name: "Mail", type: "app", scheme: "message://" },
  { name: "Navegador", type: "app", scheme: "arc://" },
  { name: "Spotify", type: "app", scheme: "spotify://" },
  { name: "Whatsapp", type: "app", scheme: "whatsapp://" }
]

// Function to calculate font size based on usage count
function getFontSize(usageCount) {
  const minSize = 10
  const maxSize = 32
  const maxUsage = Math.max(...Object.values(usageStats))
  const range = maxSize - minSize
  return Math.round(minSize + (usageCount / maxUsage) * range)
}

// Create a stack layout for two columns
let rowStack = widget.addStack()
rowStack.layoutHorizontally()

// Left column for apps
let appsStack = rowStack.addStack()
appColumn = appsStack.addStack()
appColumn.layoutVertically()

rowStack.addSpacer(48)

// Right column for shortcuts
let shortcutsStack = rowStack.addStack()
shortcutColumn = shortcutsStack.addStack()
shortcutColumn.layoutVertically()

items.forEach(item => {
  let itemText
  const usageCount = usageStats[item.name] || 0
  if (item.type === 'shortcut') {
    itemText = shortcutColumn.addText(item.name)
    itemText.font = Font.systemFont(getFontSize(usageCount))
  } else {
    itemText = appColumn.addText(item.name)
    itemText.font = Font.boldSystemFont(getFontSize(usageCount))
  }
  itemText.textColor = Color.white()
  itemText.minimumScaleFactor = 0.5
  itemText.lineLimit = 1
  itemText.url = item.scheme
  
  // Update usage count when item is tapped
  itemText.url = `scriptable:///run?scriptName=${encodeURIComponent(Script.name())}&shortcut=${encodeURIComponent(item.name)}&originalUrl=${encodeURIComponent(item.scheme)}`
  
  if (item.type === 'shortcut') {
    shortcutColumn.addSpacer(12)
  } else {
    appColumn.addSpacer(12)
  }
})

// Set padding for the widget
widget.setPadding(0, 0, 0, 0)

// Handle shortcut/app opening and usage count update
if (args.queryParameters.shortcut) {
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
