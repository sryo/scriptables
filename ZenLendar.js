// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-gray; icon-glyph: calendar;
// ZenLendar: A Minimalist Calendar Widget for Scriptable

// Function to get upcoming events
async function getUpcomingEvents() {
  let calendars = await Calendar.forEvents()
  let now = new Date()
  let futureDate = new Date(now.getTime() + 86400000 * 365) // One year from now
  
  let events = await CalendarEvent.between(now, futureDate, calendars)
  return events.slice(0, 7) // Limit events
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

// Function to calculate font size based on event index with exponential decay
function getFontSize(index) {
  const maxSize = 16
  const minSize = 8
  const decayFactor = 0.35 // Adjust this value to control the steepness of the decay
  
  const size = maxSize * Math.exp(-decayFactor * index)
  return Math.max(size, minSize)
}

// Main function to create the widget
async function createWidget() {
  let widget = new ListWidget()
  widget.backgroundColor = new Color("#000000")
  // Set up the widget to open the Calendar app when tapped
  widget.url = "calshow://"
  let events = await getUpcomingEvents()
  
  let stack = widget.addStack()
  stack.layoutVertically()
  
  events.forEach((event, index) => {
    let eventStack = stack.addStack()
    eventStack.layoutHorizontally()
    
    let titleText = eventStack.addText(event.title)
    titleText.textColor = Color.white()
    titleText.font = Font.systemFont(getFontSize(index))
    
    eventStack.addSpacer()
    
    let timeText = eventStack.addText(formatRelativeTime(event))
    timeText.textColor = Color.white()
    timeText.font = Font.systemFont(getFontSize(index) - 2)
    
    stack.addSpacer(12)
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
