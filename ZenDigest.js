// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-gray; icon-glyph: bell;
/**
 * ZenDigest.js - Your Daily Briefing
 *
 * A warm, human-written summary of your day.
 * Like a thoughtful friend catching you up.
 */

const Theme = importModule("lib/theme")
const Widget = importModule("lib/widget")
const DateTime = importModule("lib/datetime")
const ZenDigestConfig = importModule("config/zendigest")

// ============================================
// CONFIGURATION
// ============================================

const themeConfig = Theme.loadTheme()
let userConfig = ZenDigestConfig.loadConfig()

// ============================================
// WEATHER
// ============================================

const WEATHER_CODES = {
  0: "clear skies",
  1: "mostly clear",
  2: "some clouds",
  3: "overcast",
  45: "foggy",
  48: "icy fog",
  51: "light drizzle",
  53: "drizzle",
  55: "heavy drizzle",
  61: "light rain",
  63: "rain",
  65: "heavy rain",
  71: "light snow",
  73: "snow",
  75: "heavy snow",
  80: "light showers",
  81: "showers",
  82: "heavy showers",
  95: "thunderstorms",
  96: "thunderstorms with hail",
  99: "severe storms"
}

function describeUV(uv) {
  if (uv <= 2) return { level: "low", advice: null }
  if (uv <= 5) return { level: "moderate", advice: "consider sunscreen" }
  if (uv <= 7) return { level: "high", advice: "wear sunscreen" }
  if (uv <= 10) return { level: "very high", advice: "protect yourself" }
  return { level: "extreme", advice: "avoid the sun" }
}

/**
 * Creates a promise that rejects after a timeout
 * @param {number} ms - Timeout in milliseconds
 * @returns {Promise} Promise that rejects after timeout
 */
function timeout(ms) {
  return new Promise((_, reject) =>
    Timer.schedule(ms / 1000, false, () => reject(new Error("Timeout")))
  )
}

function describeCondition(code) {
  return WEATHER_CODES[code] || "mixed conditions"
}

async function getWeather() {
  if (!userConfig.showWeather) return null

  try {
    const location = await Promise.race([
      Location.current(),
      timeout(10000)
    ])

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,uv_index_max,weather_code&timezone=auto`

    const req = new Request(url)
    req.timeoutInterval = 10

    const data = await req.loadJSON()

    if (!data.current) return null

    const uvIndex = Math.round(data.daily.uv_index_max[0])

    return {
      current: {
        temp: Math.round(data.current.temperature_2m),
        condition: describeCondition(data.current.weather_code)
      },
      today: {
        high: Math.round(data.daily.temperature_2m_max[0]),
        low: Math.round(data.daily.temperature_2m_min[0]),
        condition: describeCondition(data.daily.weather_code[0]),
        uv: uvIndex,
        uvLevel: describeUV(uvIndex).level
      },
      tomorrow: data.daily.temperature_2m_max.length > 1 ? {
        high: Math.round(data.daily.temperature_2m_max[1]),
        low: Math.round(data.daily.temperature_2m_min[1]),
        condition: describeCondition(data.daily.weather_code[1])
      } : null
    }
  } catch (e) {
    return null
  }
}

// ============================================
// DATA FETCHING
// ============================================

const ZenCalendar = importModule("lib/calendar")

// ============================================
// MODE PICKER
// ============================================

// Mode is driven by today's calendar shape, not raw clock time:
//   morning   — now is before the earliest timed event of the day
//   afternoon — at least one timed event has started but the day's
//               last timed event has not yet ended
//   evening   — the day's last timed event has ended (or empty calendar
//               and past 21:00)
// All-day events are ignored for mode selection (they don't define a
// "start" or "end" to the timed day) but still appear in the digest.
function pickMode(now, todayEvents) {
  const timed = todayEvents.filter(e => !e.isAllDay)

  if (timed.length === 0) {
    const hour = now.getHours()
    if (hour < 12) return 'morning'
    if (hour < 21) return 'afternoon'
    return 'evening'
  }

  const earliestStart = Math.min(...timed.map(e => e.startDate.getTime()))
  const latestEnd = Math.max(...timed.map(e => e.endDate.getTime()))
  const t = now.getTime()

  if (t < earliestStart) return 'morning'
  if (t < latestEnd) return 'afternoon'
  return 'evening'
}

// ============================================
// FORMATTING
// ============================================

const timeFormatter = new DateFormatter()
timeFormatter.useShortTimeStyle()

// Locale-aware time, with a trailing ":00" stripped so morning hours
// render as "9" instead of "9:00" (and "9 AM" instead of "9:00 AM").
function formatTime(date) {
  return timeFormatter.string(date).replace(/(\d):00(\s?[AP]M)?$/i, '$1$2')
}

function emptyDigestForMode(mode) {
  if (mode === 'morning') return "Your day is wide open."
  if (mode === 'afternoon') return "The rest of the day is yours."
  return "Nothing scheduled tomorrow."
}

function formatEventDigest(events, mode, { capItems = 4 } = {}) {
  if (events.length === 0) return emptyDigestForMode(mode)

  const allDay = events.filter(e => e.isAllDay)
  const timed = events.filter(e => !e.isAllDay)
                      .sort((a, b) => a.startDate - b.startDate)

  const parts = []
  if (allDay.length > 0) {
    parts.push(`All day: ${allDay.map(e => e.title).join(", ")}.`)
  }

  if (timed.length > 0) {
    const shown = timed.slice(0, capItems)
    const overflow = timed.length - shown.length
    let clause = shown.map(e => `${e.title} at ${formatTime(e.startDate)}`).join(", ")
    clause += overflow > 0 ? `, and ${overflow} more.` : "."
    parts.push(clause)
  }

  const built = parts.join(" ")
  return mode === 'evening' ? `Tomorrow: ${built}` : built
}

function formatWeatherLine(weather, mode) {
  if (!weather) return null

  if (mode === 'evening') {
    const t = weather.tomorrow
    if (!t) return null
    return `Tomorrow: ${t.condition} · ↑${t.high} ↓${t.low}`
  }

  if (mode === 'morning') {
    const c = weather.current
    const d = weather.today
    let line = `${c.temp}° ${c.condition} · ↑${d.high} ↓${d.low}`
    if (d.uv > 2) line += ` · UV ${d.uv}`
    return line
  }

  // afternoon
  return `${weather.current.temp}° ${weather.current.condition}`
}

function formatRemindersLine(reminders, mode) {
  if (mode === 'evening' || !reminders || reminders.length === 0) return null
  const n = reminders.length
  const noun = n === 1 ? "reminder" : "reminders"
  return mode === 'morning' ? `${n} ${noun} today.` : `${n} ${noun} pending.`
}

// ============================================
// WIDGET CREATION
// ============================================

function addLine(stack, text, font, url) {
  const row = stack.addStack()
  if (url) row.url = url
  const el = row.addText(text)
  el.textColor = Theme.getTextColor(themeConfig)
  el.font = font
  el.minimumScaleFactor = 0.7
  row.addSpacer()
}

async function createWidget() {
  const widget = Widget.createWidget({
    refreshMinutes: 15,
    padding: [12, 16, 12, 16],
    theme: themeConfig
  })

  const now = new Date()

  const [todayEvents, todayReminders, tomorrowEvents, weather] = await Promise.all([
    ZenCalendar.getTodayEvents(),
    ZenCalendar.getTodayReminders(),
    ZenCalendar.getTomorrowEvents(),
    getWeather()
  ])

  const mode = pickMode(now, todayEvents)

  let eventsForDigest
  let remindersForLine
  if (mode === 'morning') {
    eventsForDigest = todayEvents
    remindersForLine = todayReminders
  } else if (mode === 'afternoon') {
    eventsForDigest = todayEvents.filter(e => e.isAllDay || e.endDate > now)
    remindersForLine = todayReminders.filter(r => !r.dueDate || r.dueDate > now)
  } else {
    eventsForDigest = tomorrowEvents
    remindersForLine = []
  }

  const greeting = DateTime.getGreeting()
  const weatherLine = formatWeatherLine(weather, mode)
  const digestLine = formatEventDigest(eventsForDigest, mode)
  const remindersLine = formatRemindersLine(remindersForLine, mode)

  const mainStack = widget.addStack()
  mainStack.layoutVertically()

  addLine(mainStack, greeting, Theme.getBoldFont(themeConfig.maxFontSize - 2, themeConfig), "calshow://")
  mainStack.addSpacer(6)

  if (weatherLine) {
    addLine(mainStack, weatherLine, Theme.getMediumFont(themeConfig.minFontSize + 4, themeConfig), "weather://")
    mainStack.addSpacer(4)
  }

  addLine(mainStack, digestLine, Theme.getRegularFont(themeConfig.minFontSize + 2, themeConfig), "calshow://")

  if (remindersLine) {
    mainStack.addSpacer(2)
    addLine(mainStack, remindersLine, Theme.getRegularFont(themeConfig.minFontSize, themeConfig))
  }

  return widget
}

// ============================================
// CONFIGURATION UI
// ============================================

async function presentConfigAlert() {
  const alert = new Alert()
  alert.title = "Configure ZenDigest"
  alert.message = "Your daily briefing settings"

  alert.addTextField("Widget URL", userConfig.widgetUrl)
  alert.addTextField("Show weather (true/false)", userConfig.showWeather.toString())
  alert.addAction("Save")
  alert.addCancelAction("Cancel")

  const response = await alert.present()
  if (response === -1) return null

  userConfig.widgetUrl = alert.textFieldValue(0).trim() || "calshow://"
  userConfig.showWeather = alert.textFieldValue(1).toLowerCase() === 'true'
  ZenDigestConfig.saveConfig(userConfig)

  return userConfig
}

// ============================================
// MAIN
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
