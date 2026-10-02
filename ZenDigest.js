// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-gray; icon-glyph: bell;
/**
 * ZenDigest.js - Your Daily Briefing
 *
 * A warm, human-written summary of your day.
 * Like a thoughtful friend catching you up.
 */

const Fs = importModule("lib/fs")
const Theme = importModule("lib/theme")
const Widget = importModule("lib/widget")
const DateTime = importModule("lib/datetime")

// ============================================
// CONFIGURATION
// ============================================

const CONFIG_PATH = Fs.fm.joinPath(Fs.baseDir, "zendigest_config.json")
const DEFAULTS = { widgetUrl: "calshow://", showWeather: true }

function loadConfig() {
  return { ...DEFAULTS, ...Fs.loadJSON(CONFIG_PATH, {}) }
}

function saveConfig(config) {
  Fs.saveJSON(CONFIG_PATH, config)
}

const themeConfig = Theme.loadTheme()
let userConfig = loadConfig()

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
  56: "freezing drizzle",
  57: "freezing drizzle",
  61: "light rain",
  63: "rain",
  65: "heavy rain",
  66: "freezing rain",
  67: "freezing rain",
  71: "light snow",
  73: "snow",
  75: "heavy snow",
  77: "snow grains",
  80: "light showers",
  81: "showers",
  82: "heavy showers",
  85: "snow showers",
  86: "heavy snow showers",
  95: "thunderstorms",
  96: "thunderstorms with hail",
  99: "severe storms"
}

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

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,uv_index_max,weather_code&temperature_unit=celsius&timezone=auto`

    const req = new Request(url)
    req.timeoutInterval = 10

    const data = await req.loadJSON()

    if (!data.current) return null

    return {
      current: {
        temp: Math.round(data.current.temperature_2m),
        condition: describeCondition(data.current.weather_code)
      },
      today: {
        high: Math.round(data.daily.temperature_2m_max[0]),
        low: Math.round(data.daily.temperature_2m_min[0]),
        condition: describeCondition(data.daily.weather_code[0]),
        uv: Math.round(data.daily.uv_index_max[0])
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
// So are timed events carried over from yesterday: an overnight event
// that ended at 01:00 must not make 08:00 look like the day is over.
function pickMode(now, todayEvents) {
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let earliestStart = Infinity
  let latestEnd = -Infinity
  for (const e of todayEvents) {
    if (e.isAllDay || e.startDate < dayStart) continue
    const start = e.startDate.getTime()
    const end = e.endDate.getTime()
    if (start < earliestStart) earliestStart = start
    if (end > latestEnd) latestEnd = end
  }

  if (!isFinite(earliestStart)) {
    const hour = now.getHours()
    if (hour < 12) return 'morning'
    if (hour < 21) return 'afternoon'
    return 'evening'
  }

  const t = now.getTime()
  if (t < earliestStart) return 'morning'
  if (t < latestEnd) return 'afternoon'
  return 'evening'
}

// ============================================
// MODES
// ============================================

const CAP_ITEMS = 4

const MODES = {
  morning: {
    selectEvents: ({ todayEvents, now }) =>
      todayEvents.filter(e => e.isAllDay || e.endDate > now),
    selectReminders: ({ todayReminders }) => todayReminders,
    formatWeather: ({ current, today }) => {
      let line = `${current.temp}° ${current.condition} · ↑${today.high} ↓${today.low}`
      if (today.uv > 2) line += ` · UV ${today.uv}`
      return line
    },
    formatReminders: (n) => `${n} ${n === 1 ? 'reminder' : 'reminders'} today.`,
    emptyDigest: "Your day is wide open.",
    digestPrefix: ""
  },
  afternoon: {
    selectEvents: ({ todayEvents, now }) =>
      todayEvents.filter(e => e.isAllDay || e.endDate > now),
    selectReminders: ({ todayReminders, now }) =>
      todayReminders.filter(r => !r.dueDate || r.dueDateIncludesTime === false || r.dueDate > now),
    formatWeather: ({ current }) => `${current.temp}° ${current.condition}`,
    formatReminders: (n) => `${n} ${n === 1 ? 'reminder' : 'reminders'} pending.`,
    emptyDigest: "The rest of the day is yours.",
    digestPrefix: ""
  },
  evening: {
    selectEvents: ({ tomorrowEvents }) => tomorrowEvents,
    selectReminders: () => [],
    formatWeather: ({ tomorrow }) =>
      tomorrow ? `Tomorrow: ${tomorrow.condition} · ↑${tomorrow.high} ↓${tomorrow.low}` : null,
    formatReminders: () => null,
    emptyDigest: "Nothing scheduled tomorrow.",
    digestPrefix: "Tomorrow: "
  }
}

// ============================================
// FORMATTING
// ============================================

const timeFormatter = new DateFormatter()
timeFormatter.useShortTimeStyle()

// Locale-aware time. Strip a trailing ":00" so hour-only times read as
// "9" / "9 AM" rather than "9:00" / "9:00 AM". The lookahead ensures we
// only target the minutes slot (after the hour colon), not other digits.
function formatTime(date) {
  return timeFormatter.string(date).replace(/:00(?=\D|$)/, '')
}

function formatEventDigest(events, modeConfig, now) {
  if (events.length === 0) return modeConfig.emptyDigest

  const allDay = []
  const timed = []
  for (const e of events) {
    (e.isAllDay ? allDay : timed).push(e)
  }
  timed.sort((a, b) => a.startDate - b.startDate)

  const parts = []
  if (allDay.length > 0) {
    parts.push(`All day: ${allDay.map(e => e.title).join(", ")}.`)
  }

  if (timed.length > 0) {
    const shown = timed.slice(0, CAP_ITEMS)
    const overflow = timed.length - shown.length
    let clause = shown.map(e => e.startDate <= now
      ? `${e.title} until ${formatTime(e.endDate)}`
      : `${e.title} at ${formatTime(e.startDate)}`).join(", ")
    clause += overflow > 0 ? `, and ${overflow} more.` : "."
    parts.push(clause)
  }

  return modeConfig.digestPrefix + parts.join(" ")
}

// ============================================
// WIDGET CREATION
// ============================================

// The digest changes when an event starts or ends, a timed reminder
// falls due, or the day rolls over ("Tomorrow" becomes today).
function nextChange(now, events, reminders, fallback) {
  let next = fallback.getTime()
  const consider = (d) => {
    const t = d && d.getTime()
    if (t > now.getTime() && t < next) next = t
  }
  for (const e of events) {
    if (e.isAllDay) continue
    consider(e.startDate)
    consider(e.endDate)
  }
  for (const r of reminders) {
    if (r.dueDateIncludesTime !== false) consider(r.dueDate)
  }
  consider(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1))
  return new Date(next)
}

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

  // Today's events drive mode selection, and weather is independent —
  // fetch both up front. Tomorrow's events and today's reminders are
  // mode-gated to avoid two-thirds-of-the-day waste.
  const [todayEvents, weather] = await Promise.all([
    ZenCalendar.getTodayEvents(),
    getWeather()
  ])

  const mode = pickMode(now, todayEvents)
  const modeConfig = MODES[mode]

  const [todayReminders, tomorrowEvents] = mode === 'evening'
    ? [[], await ZenCalendar.getTomorrowEvents()]
    : [await ZenCalendar.getTodayReminders(), []]

  const inputs = { now, todayEvents, todayReminders, tomorrowEvents }
  const eventsForDigest = modeConfig.selectEvents(inputs)
  const remindersForLine = modeConfig.selectReminders(inputs)

  const digestLine = formatEventDigest(eventsForDigest, modeConfig, now)
  const weatherLine = weather ? modeConfig.formatWeather(weather) : null
  widget.refreshAfterDate = nextChange(now, todayEvents, todayReminders, widget.refreshAfterDate)

  const remindersLine = remindersForLine.length > 0
    ? modeConfig.formatReminders(remindersForLine.length)
    : null

  const mainStack = widget.addStack()
  mainStack.layoutVertically()

  addLine(mainStack, DateTime.getGreeting(), Theme.getBoldFont(themeConfig.maxFontSize - 2, themeConfig), userConfig.widgetUrl)
  mainStack.addSpacer(6)

  if (weatherLine) {
    addLine(mainStack, weatherLine, Theme.getMediumFont(themeConfig.minFontSize + 4, themeConfig), "weather://")
    mainStack.addSpacer(4)
  }

  addLine(mainStack, digestLine, Theme.getRegularFont(themeConfig.minFontSize + 2, themeConfig), userConfig.widgetUrl)

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
  saveConfig(userConfig)

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
