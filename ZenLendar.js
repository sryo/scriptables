// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-gray; icon-glyph: calendar;
// ZenLendar: A Customizable Minimalist Calendar Widget for Scriptable

// Get widget parameters or use defaults
let params = []
if (args.widgetParameter) {
  params = args.widgetParameter.split(",")
} else if (args.queryParameters && args.queryParameters.widgetParameter) {
  params = args.queryParameters.widgetParameter.split(",")
}

let bgColor = params.find(p => p.startsWith("bg:"))?.replace("bg:", "") || "000000"
let textColor = params.find(p => p.startsWith("text:"))?.replace("text:", "") || "FFFFFF"
let fontName = params.find(p => p.startsWith("font:"))?.replace("font:", "") || "systemFont"
let maxEvents = parseInt(params.find(p => p.startsWith("max:"))?.replace("max:", "")) || 7

// Function to get upcoming events
async function getUpcomingEvents() {
  let calendars = await Calendar.forEvents()
  let now = new Date()
  let futureDate = new Date(now.getTime() + 86400000 * 365) // One year from now
  
  let events = await CalendarEvent.between(now, futureDate, calendars)
  return events.slice(0, maxEvents) // Limit events based on maxEvents parameter
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
  const maxSize = 14
  const minSize = 6
  const decayFactor = 0.35 // Adjust this value to control the steepness of the decay
  
  const size = maxSize * Math.exp(-decayFactor * index)
  return Math.max(size, minSize)
}

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

// Main function to create the widget
async function createWidget() {
  let widget = new ListWidget()
  
  // Set background color
  widget.backgroundColor = new Color("#" + bgColor)
  
  // Set up the widget to open the Calendar app when tapped
  widget.url = "calshow://"
  
  let events = await getUpcomingEvents()
  let groupedEvents = groupEventsByStartTime(events)
  
  let stack = widget.addStack()
  stack.layoutVertically()
  
  groupedEvents.forEach((group, groupIndex) => {
    let fontSize = getFontSize(groupIndex)
    
    group.forEach((event, eventIndex) => {
      let eventStack = stack.addStack()
      eventStack.layoutHorizontally()
      
      let titleText = eventStack.addText(event.title)
      titleText.textColor = new Color("#" + textColor)
      titleText.font = getFont(fontSize)
      
      eventStack.addSpacer()
      
      let timeText = eventStack.addText(formatRelativeTime(event))
      timeText.textColor = new Color("#" + textColor)
      timeText.font = getFont(fontSize - 2)
      
      if (eventIndex < group.length - 1) {
        stack.addSpacer(4) // Smaller space between events in the same group
      }
    })
    
    if (groupIndex < groupedEvents.length - 1) {
      stack.addSpacer(12) // Larger space between different groups
    }
  })
  
  return widget
}

// Run the script
async function run() {
  let widget = await createWidget()
  // Set padding for the widget
  widget.setPadding(0, 8, 0, 8)
  if (config.runsInWidget) {
    Script.setWidget(widget)
  } else {
    widget.presentMedium()
  }
}

await run()
Script.complete()
