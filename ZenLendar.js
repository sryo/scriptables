// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-gray; icon-glyph: calendar;
/**
 * ZenLendar.js - A Customizable Minimalist Calendar Widget
 *
 * Features:
 * - Displays upcoming calendar events
 * - Exponential font decay for event urgency
 * - Configurable event count and widget URL
 */

const Theme = importModule("lib/theme")
const Widget = importModule("lib/widget")
const Calendar_ = importModule("lib/calendar")
const ZenLendarConfig = importModule("config/zenlendar")

// ============================================
// CONFIGURATION
// ============================================

const themeConfig = Theme.loadTheme()
let userConfig = ZenLendarConfig.loadConfig()

// ============================================
// FONT SIZE CALCULATION
// ============================================

/**
 * Calculates font size based on event index using exponential decay.
 * Earlier events (lower index) get larger fonts to indicate urgency.
 *
 * @param {number} index - Event index (0 = first/most urgent)
 * @returns {number} Calculated font size
 */
function getFontSize(index) {
  const maxSize = themeConfig.maxFontSize
  const minSize = themeConfig.minFontSize
  const decayFactor = 0.5 // Controls steepness of decay

  const size = maxSize * Math.exp(-decayFactor * index)
  return Math.max(size, minSize)
}

// ============================================
// DATE FORMATTING
// ============================================

/**
 * Formats event time as a relative string (e.g., "2 hours", "Tomorrow").
 * Handles all-day events and near-future events specially.
 *
 * @param {CalendarEvent} event - Calendar event
 * @returns {string} Formatted relative time string
 */
function formatRelativeTime(event) {
  const now = new Date()
  const startDate = event.startDate
  const endDate = event.endDate

  const formatter = new RelativeDateTimeFormatter()
  formatter.useNamedDateTimeStyle()

  // Handle all-day events happening now
  if (event.isAllDay) {
    if (now >= startDate && now <= endDate) {
      return formatter.string(now, now)
    }
  }

  let relativeDate = formatter.string(startDate, now)

  // Handle empty string for very near times
  if (relativeDate === "") {
    const diff = startDate.getTime() - now.getTime()
    const minutes = Math.floor(diff / (1000 * 60))
    if (minutes <= 0) {
      return formatter.string(now, now)
    } else {
      formatter.useNumericDateTimeStyle()
      relativeDate = formatter.string(startDate, now)
    }
  }

  // Remove leading text before the number for cleaner display
  const match = relativeDate.match(/\d/)
  if (match) {
    relativeDate = relativeDate.slice(match.index)
  }

  // Capitalize first letter
  relativeDate = relativeDate.trim()
  return relativeDate.charAt(0).toUpperCase() + relativeDate.slice(1)
}

// ============================================
// CONFIGURATION UI
// ============================================

/**
 * Presents configuration alert for widget settings
 * @returns {Promise<Object|null>} Updated config or null if cancelled
 */
async function presentConfigAlert() {
  const alert = new Alert()
  alert.title = "Configure ZenLendar"
  alert.message = "Enter the number of events to display (1-10) and the widget URL:"
  alert.addTextField("Number of events", userConfig.eventCount.toString())
  alert.addTextField("Widget URL", userConfig.widgetUrl)
  alert.addAction("Save")
  alert.addCancelAction("Cancel")

  const response = await alert.present()
  if (response === -1) return null

  let count = parseInt(alert.textFieldValue(0))
  count = isNaN(count) ? 5 : Math.min(Math.max(count, 1), 10)

  let url = alert.textFieldValue(1).trim()
  if (!url) url = "calshow://"

  userConfig.eventCount = count
  userConfig.widgetUrl = url
  ZenLendarConfig.saveConfig(userConfig)

  return userConfig
}

// ============================================
// WIDGET CREATION
// ============================================

/**
 * Creates the calendar widget
 * @returns {Promise<ListWidget>}
 */
async function createWidget() {
  const widget = Widget.createWidget({
    url: userConfig.widgetUrl,
    refreshMinutes: 1,
    padding: [0, 16, 0, 16],
    theme: themeConfig
  })

  const events = await Calendar_.getUpcomingEvents(userConfig.eventCount, 365)

  if (events.length === 0) {
    const emptyText = widget.addText("No upcoming events")
    emptyText.textColor = Theme.getTextColor(themeConfig)
    emptyText.font = Theme.getFont(themeConfig.minFontSize, { theme: themeConfig })
    return widget
  }

  events.forEach((event, index) => {
    const eventStack = widget.addStack()
    eventStack.layoutHorizontally()

    const fontSize = getFontSize(index)

    const titleText = eventStack.addText(event.title)
    titleText.textColor = Theme.getTextColor(themeConfig)
    titleText.font = Theme.getFont(fontSize * 0.75, { theme: themeConfig })
    titleText.lineLimit = 1

    eventStack.addSpacer()

    const timeText = eventStack.addText(formatRelativeTime(event))
    timeText.textColor = Theme.getTextColor(themeConfig)
    timeText.font = Theme.getFont(fontSize * 0.75, { theme: themeConfig })
    timeText.lineLimit = 1

    if (index < events.length - 1) {
      widget.addSpacer(8)
    }
  })

  return widget
}

// ============================================
// MAIN EXECUTION
// ============================================

async function run() {
  if (Widget.isApp()) {
    await presentConfigAlert()
  } else if (Widget.isWidget()) {
    const widget = await createWidget()
    Script.setWidget(widget)
  }
}

await run()
Script.complete()
