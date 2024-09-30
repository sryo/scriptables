// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-gray; icon-glyph: calendar;
// ZenLendar.js: A Customizable Minimalist Calendar Widget for Scriptable

// Theme configuration
const THEME_FILE = FileManager.iCloud().documentsDirectory() + "/zentrate_theme.json"
const CONFIG_FILE = FileManager.iCloud().documentsDirectory() + "/zenlendar_config.json"

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
    maxFontSize: 20
  }
}

function loadConfig() {
  if (FileManager.iCloud().fileExists(CONFIG_FILE)) {
    const configString = FileManager.iCloud().readString(CONFIG_FILE)
    return JSON.parse(configString)
  }
  return {
    eventCount: 5, // Default value
    widgetUrl: "calshow://" // Default value
  }
}

function saveConfig(config) {
  FileManager.iCloud().writeString(CONFIG_FILE, JSON.stringify(config))
}

const themeConfig = loadThemeConfig()
let userConfig = loadConfig()

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

// Calculate font size based on event index
function getFontSize(index) {
  const maxSize = themeConfig.maxFontSize
  const minSize = themeConfig.minFontSize
  const decayFactor = 0.5 // Adjust this value to control the steepness of the decay
  
  const size = maxSize * Math.exp(-decayFactor * index)
  return Math.max(size, minSize)
}

// Get upcoming events
async function getUpcomingEvents(maxEvents) {
  let calendars = await Calendar.forEvents()
  let now = new Date()
  let futureDate = new Date(now.getTime() + 86400000 * 365) // One year from now
  
  let events = await CalendarEvent.between(now, futureDate, calendars)
  return events.slice(0, maxEvents) // Limit events based on maxEvents
}

// Format relative time
function formatRelativeTime(event) {
  let now = new Date()
  let startDate = event.startDate
  let endDate = event.endDate
  
  const formatter = new RelativeDateTimeFormatter()
  formatter.useNamedDateTimeStyle()
  
  // Check if it's an all-day event
  if (event.isAllDay) {
    // Check if the event is happening now
    if (now >= startDate && now <= endDate) {
      // Use the formatter to get a representation of "now"
      return formatter.string(now, now)
    }
  }
  
  let relativeDate = formatter.string(startDate, now)
  
  // If the relative date is empty (which can happen for very near times), use a custom format
  if (relativeDate === "") {
    let diff = startDate.getTime() - now.getTime()
    let minutes = Math.floor(diff / (1000 * 60))
    if (minutes <= 0) {
      return formatter.string(now, now) // Should return the equivalent of "now" in the system's language
    } else {
      // For near future events, use the default numeric style
      formatter.useNumericDateTimeStyle()
      relativeDate = formatter.string(startDate, now)
    }
  }
  
  // Split the string at the first number
  const match = relativeDate.match(/\d/)
  if (match) {
    const index = match.index
    relativeDate = relativeDate.slice(index)
  }
  
  // Trim any leading whitespace and capitalize the first letter
  relativeDate = relativeDate.trim()
  return relativeDate.charAt(0).toUpperCase() + relativeDate.slice(1)
}

// Present an alert for configuration
async function presentConfigAlert() {
  let alert = new Alert()
  alert.title = "Configure ZenLendar"
  alert.message = "Enter the number of events to display (1-10) and the widget URL:"
  alert.addTextField("Number of events", userConfig.eventCount.toString())
  alert.addTextField("Widget URL", userConfig.widgetUrl)
  alert.addAction("Save")
  alert.addCancelAction("Cancel")
  
  let response = await alert.present()
  if (response === -1) {
    // User cancelled
    return null
  }
  
  let count = parseInt(alert.textFieldValue(0))
  count = isNaN(count) ? 5 : Math.min(Math.max(count, 1), 10)
  
  let url = alert.textFieldValue(1).trim()
  if (!url) {
    url = "calshow://" // Default to Calendar app if empty
  }
  
  userConfig.eventCount = count
  userConfig.widgetUrl = url
  saveConfig(userConfig)
  
  return userConfig
}

// Create and present the widget
async function createWidget() {
  let widget = new ListWidget()
  widget.backgroundColor = new Color("#" + themeConfig.bgColor)

  // Set up the widget URL
  widget.url = userConfig.widgetUrl

  // Set the refresh interval to 5 minutes
  widget.refreshAfterDate = new Date(Date.now() + 5 * 60 * 1000)

  let events = await getUpcomingEvents(userConfig.eventCount)
    
  events.forEach((event, index) => {
    let eventStack = widget.addStack()
    eventStack.layoutHorizontally()
    
    let fontSize = getFontSize(index)
    
    let titleText = eventStack.addText(event.title)
    titleText.textColor = new Color("#" + themeConfig.textColor)
    titleText.font = getFont(fontSize * .75)
    titleText.lineLimit = 1
    
    eventStack.addSpacer()
    
    let timeText = eventStack.addText(formatRelativeTime(event))
    timeText.textColor = new Color("#" + themeConfig.textColor)
    timeText.font = getFont(fontSize * .75)
    timeText.lineLimit = 1
    
    if (index < events.length - 1) {
      widget.addSpacer(12) // Space between events
    }
  })

  widget.setPadding(0, 8, 0, 8)
  return widget
}

async function run() {
  if (config.runsInApp) {
    const newConfig = await presentConfigAlert()
  } else if (config.runsInWidget) {
    let widget = await createWidget()
    Script.setWidget(widget)
  }
}

await run()
Script.complete()
