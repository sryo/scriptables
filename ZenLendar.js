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
    fontWeight: "regular",
    fontItalic: false
  }
}

function getFont(size, config = loadThemeConfig()) {
  const fontType = (config.fontName || "system").toLowerCase();
  const weight = config.fontWeight || "semibold";
  const isItalic = config.fontItalic || false;
  
  const weightFunctions = {
    ultralight: "ultraLight",
    thin: "thin",
    light: "light",
    regular: "regular",
    medium: "medium",
    semibold: "semibold",
    bold: "bold",
    heavy: "heavy",
    black: "black"
  };

  let fontFunction = `${weightFunctions[weight] || "regular"}`;
  if (fontType === "monospaced") fontFunction += "Monospaced";
  if (fontType === "rounded") fontFunction += "Rounded";
  fontFunction += "SystemFont";

  if (isItalic && weight === "regular") {
    return Font.italicSystemFont(size);
  }

  return Font[fontFunction](size);
}

const themeConfig = loadThemeConfig()

// Set a default value for maxEvents
const maxEvents = 7

// Function to get upcoming events
async function getUpcomingEvents() {
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

// Function to group events by start time
function groupEventsByStartTime(events) {
  let groupedEvents = {}
  events.forEach(event => {
    let startTime = event.startDate.getTime()
    if (!groupedEvents[startTime]) {
      groupedEvents[startTime] = []
    }
    groupedEvents[startTime].push(event)
  })
  return Object.values(groupedEvents)
}

// Function to calculate font size based on group index
function getFontSize(index) {
  const maxSize = 18
  const minSize = 8
  const decayFactor = 0.5 // Adjust this value to control the steepness of the decay
  
  const size = maxSize * Math.exp(-decayFactor * index)
  return Math.max(size, minSize)
}

// Function to create the widget
async function createWidget() {
  let widget = new ListWidget()
  widget.backgroundColor = new Color("#" + themeConfig.bgColor)

  let events = await getUpcomingEvents()
  let groupedEvents = groupEventsByStartTime(events)
  
  groupedEvents.forEach((group, groupIndex) => {
    let fontSize = getFontSize(groupIndex)
    
    group.forEach((event, eventIndex) => {
      let eventStack = widget.addStack()
      eventStack.layoutHorizontally()
      
      let titleText = eventStack.addText(event.title)
      titleText.textColor = new Color("#" + themeConfig.textColor)
      titleText.font = getFont(fontSize)
      
      eventStack.addSpacer()
      
      let timeText = eventStack.addText(formatRelativeTime(event))
      timeText.textColor = new Color("#" + themeConfig.textColor)
      timeText.font = getFont(fontSize - 2)
      
      if (eventIndex < group.length - 1) {
        widget.addSpacer(10) // Space between events in the same group
      }
    })
    
    if (groupIndex < groupedEvents.length - 1) {
      widget.addSpacer(10) // Space between different groups
    }
  })

  widget.setPadding(0, 12, 0, 12)
  return widget
}

// Create and present the widget
async function run() {
  let widget = await createWidget()
  if (config.runsInWidget) {
    Script.setWidget(widget)
  } else {
    widget.presentMedium()
  }
}

await run()
Script.complete()