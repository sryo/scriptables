// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-gray; icon-glyph: calendar;
// ZenLendar.js: A Customizable Minimalist Calendar Widget for Scriptable

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
    maxFontSize: 20
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

// Function to calculate font size based on event index
function getFontSize(index) {
  const maxSize = themeConfig.maxFontSize
  const minSize = themeConfig.minFontSize
  const decayFactor = 0.5 // Adjust this value to control the steepness of the decay
  
  const size = maxSize * Math.exp(-decayFactor * index)
  return Math.max(size, minSize)
}

// Function to calculate the number of events that can fit
function calculateMaxEvents() {
  const height = 155 // Both small and medium widgets have the same height
  const availableHeight = height - 16 // Subtracting vertical padding

  let totalHeight = 0
  let eventCount = 0
  
  while (totalHeight < availableHeight && eventCount < 10) { // Set a reasonable upper limit
    const fontSize = getFontSize(eventCount)
    
    totalHeight += fontSize + 8 // Event height + padding
    
    if (totalHeight <= availableHeight) {
      eventCount++
    } else {
      break
    }
  }
  
  return eventCount
}

// Function to get upcoming events
async function getUpcomingEvents(maxEvents) {
  let calendars = await Calendar.forEvents()
  let now = new Date()
  let futureDate = new Date(now.getTime() + 86400000 * 365) // One year from now
  
  let events = await CalendarEvent.between(now, futureDate, calendars)
  return events.slice(0, maxEvents) // Limit events based on maxEvents
}

// Function to format relative time
function formatRelativeTime(event) {
  let now = new Date()
  let startDate = event.startDate
  let endDate = event.endDate
  
  // Check if it's an all-day event
  if (event.isAllDay) {
    // Check if the event is happening now
    if (now >= startDate && now <= endDate) {
      return "hoy"
    }
  }
  
  let diff = startDate.getTime() - now.getTime()
  let days = Math.floor(diff / (1000 * 60 * 60 * 24))
  let hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  let minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  
  if (days > 0) {
    return `${days}d`
  } else if (hours > 0) {
    return `${hours}h`
  } else if (minutes > 0) {
    return `${minutes}m`
  } else {
    return "hoy"
  }
}


// Function to create the widget
async function createWidget() {
  let widget = new ListWidget()
  widget.backgroundColor = new Color("#" + themeConfig.bgColor)

  // Set up the widget to open the Calendar app when tapped
  widget.url = "calshow://"

  const maxEvents = calculateMaxEvents()
  let events = await getUpcomingEvents(maxEvents)
  
  events.forEach((event, index) => {
    let eventStack = widget.addStack()
    eventStack.layoutHorizontally()
    
    let fontSize = getFontSize(index)
    
    let titleText = eventStack.addText(event.title)
    titleText.textColor = new Color("#" + themeConfig.textColor)
    titleText.font = getFont(fontSize)
    titleText.lineLimit = 1
    
    eventStack.addSpacer()
    
    let timeText = eventStack.addText(formatRelativeTime(event))
    timeText.textColor = new Color("#" + themeConfig.textColor)
    timeText.font = getFont(fontSize - 2)
    
    if (index < events.length - 1) {
      widget.addSpacer(8) // Space between events
    }
  })

  widget.setPadding(8, 12, 8, 12)
  return widget
}

// Create and present the widget
async function run() {
  let widget = await createWidget()
  if (config.runsInWidget) {
    Script.setWidget(widget)
  } else {
    if (config.runsInApp) {
      const options = ["Small", "Medium"]
      let selectedIndex = await presentAlert("Choose Widget Size", options)
      let sizes = [["small"], ["medium"]]
      config.widgetFamily = sizes[selectedIndex][0]
    }
    if (config.widgetFamily === "small") {
      await widget.presentSmall()
    } else {
      await widget.presentMedium()
    }
  }
}

async function presentAlert(prompt, items) {
  let alert = new Alert()
  alert.message = prompt
  
  for (const item of items) {
    alert.addAction(item)
  }
  
  let response = await alert.presentAlert()
  return response
}

await run()
Script.complete()