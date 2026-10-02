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

const Fs = importModule("lib/fs")
const Theme = importModule("lib/theme")
const Widget = importModule("lib/widget")
const Calendar_ = importModule("lib/calendar")

// ============================================
// CONFIGURATION
// ============================================

const CONFIG_PATH = Fs.fm.joinPath(Fs.baseDir, "zenlendar_config.json")
const DEFAULTS = { eventCount: 5, widgetUrl: "calshow://" }

function loadConfig() {
  return { ...DEFAULTS, ...Fs.loadJSON(CONFIG_PATH, {}) }
}

function saveConfig(config) {
  Fs.saveJSON(CONFIG_PATH, config)
}

const themeConfig = Theme.loadTheme()
let userConfig = loadConfig()

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

// Events starting within this window get a live, self-updating label
// instead of text frozen at render time.
const LIVE_WINDOW_MS = 60 * 60 * 1000

function deviceLocale() {
  return Device.locale().replace(/_/g, "-")
}

/**
 * Localized "today", falling back to the formatter's "now" when Intl
 * isn't available.
 */
function todayLabel(formatter, now) {
  try {
    return capitalize(new Intl.RelativeTimeFormat(deviceLocale(), { numeric: "auto" }).format(0, "day"))
  } catch (e) {
    return capitalize(formatter.string(now, now))
  }
}

function capitalize(text) {
  text = text.trim()
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * Formats a future start date as a relative string (e.g. "2 hours",
 * "Tomorrow"). Only valid for future dates: the leading "in"/"dentro de"
 * is dropped, which for a past date would also drop "ago"/"hace".
 */
function formatUpcoming(startDate, now) {
  const formatter = new RelativeDateTimeFormatter()
  formatter.useNamedDateTimeStyle()
  let relativeDate = formatter.string(startDate, now)

  if (relativeDate === "") {
    formatter.useNumericDateTimeStyle()
    relativeDate = formatter.string(startDate, now)
  }

  const match = relativeDate.match(/\d/)
  if (match) {
    relativeDate = relativeDate.slice(match.index)
  }

  return capitalize(relativeDate)
}

/**
 * Adds the time label for an event: "Now"/"Today" while it is happening,
 * a live signed countdown ("+14 min") when it starts soon, and a relative
 * string otherwise.
 */
function addTimeLabel(stack, event, now) {
  if (Calendar_.isOngoing(event, now)) {
    const formatter = new RelativeDateTimeFormatter()
    formatter.useNamedDateTimeStyle()
    const label = event.isAllDay ? todayLabel(formatter, now) : capitalize(formatter.string(now, now))
    return stack.addText(label)
  }

  if (event.startDate - now <= LIVE_WINDOW_MS) {
    const date = stack.addDate(event.startDate)
    date.applyOffsetStyle()
    return date
  }

  return stack.addText(formatUpcoming(event.startDate, now))
}

/**
 * The widget's content changes when an event starts or ends, and when an
 * event enters the live window.
 */
function nextRefreshDate(events, now) {
  const liveWindows = events.map(e => ({
    startDate: new Date(e.startDate.getTime() - LIVE_WINDOW_MS),
    endDate: e.startDate
  }))
  const boundary = Calendar_.nextBoundary([...events, ...liveWindows], now)
  const fallback = new Date(now.getTime() + 15 * 60 * 1000)
  return boundary && boundary < fallback ? boundary : fallback
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
  saveConfig(userConfig)

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
    padding: [0, 16, 0, 16],
    theme: themeConfig
  })

  const now = new Date()
  const events = await Calendar_.getUpcomingEvents(userConfig.eventCount, 365)
  widget.refreshAfterDate = nextRefreshDate(events, now)

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

    const timeText = addTimeLabel(eventStack, event, now)
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
