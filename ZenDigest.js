// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-gray; icon-glyph: bell;
/**
 * ZenDigest.js - Your Daily Briefing
 *
 * A warm, human-written summary of your day.
 * Like a thoughtful friend catching you up.
 */

const ZenCore = importModule("lib/ZenCore")

// ============================================
// CONFIGURATION
// ============================================

const themeConfig = ZenCore.loadTheme()

const DEFAULT_CONFIG = {
  widgetUrl: "calshow://",
  showWeather: true
}

function loadConfig() {
  return { ...DEFAULT_CONFIG, ...ZenCore.loadJSON(ZenCore.PATHS.zendigestConfig, DEFAULT_CONFIG) }
}

function saveConfig(config) {
  ZenCore.saveJSON(ZenCore.PATHS.zendigestConfig, config)
}

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

async function getWeather() {
  if (!userConfig.showWeather) return null

  try {
    // Get location with 10 second timeout (widgets need more time)
    const location = await Promise.race([
      Location.current(),
      timeout(10000)
    ])

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,uv_index_max&timezone=auto`

    const req = new Request(url)
    req.timeoutInterval = 10 // 10 second timeout for API

    const data = await req.loadJSON()

    if (!data.current) return null

    const uvIndex = Math.round(data.daily.uv_index_max[0])
    const uvInfo = describeUV(uvIndex)

    return {
      temp: Math.round(data.current.temperature_2m),
      high: Math.round(data.daily.temperature_2m_max[0]),
      low: Math.round(data.daily.temperature_2m_min[0]),
      condition: WEATHER_CODES[data.current.weather_code] || "mixed conditions",
      uv: uvIndex,
      uvLevel: uvInfo.level,
      uvAdvice: uvInfo.advice
    }
  } catch (e) {
    // Silently fail - weather is optional
    return null
  }
}

// ============================================
// DATA FETCHING
// ============================================

const ZenCalendar = importModule("lib/calendar")

// ============================================
// CATEGORIZATION
// ============================================

function categorizeEvents(events) {
  const now = new Date()

  const birthdays = []
  const regular = []

  for (const event of events) {
    const isBirthday = event.title.toLowerCase().includes("birthday") ||
                       event.title.toLowerCase().includes("cumpleaños")

    const item = {
      title: event.title,
      startDate: event.startDate,
      endDate: event.endDate,
      isAllDay: event.isAllDay,
      isPast: event.endDate < now,
      isNow: now >= event.startDate && now <= event.endDate,
      isBirthday: isBirthday
    }

    if (isBirthday) {
      birthdays.push(item)
    } else {
      regular.push(item)
    }
  }

  return { birthdays, events: regular }
}

function getNextUpcoming(events, reminders) {
  const now = new Date()

  // Get upcoming events (not all-day, not past)
  const upcomingEvents = events
    .filter(e => !e.isAllDay && !e.isPast && !e.isNow)
    .map(e => ({ ...e, type: 'event' }))

  // Get upcoming reminders with time
  const upcomingReminders = reminders
    .filter(r => r.dueDate && r.dueDateIncludesTime && r.dueDate > now)
    .map(r => ({ title: r.title, startDate: r.dueDate, type: 'reminder' }))

  // Combine and sort
  const all = [...upcomingEvents, ...upcomingReminders]
  all.sort((a, b) => a.startDate - b.startDate)

  return all.length > 0 ? all[0] : null
}

// ============================================
// NATURAL LANGUAGE GENERATION
// ============================================

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  if (hour < 21) return "Good evening"
  return "Good night"
}

function describeWeather(weather) {
  if (!weather) return null

  // Condensed format: "72° clear skies · UV 7"
  let text = `${weather.temp}° ${weather.condition}`

  if (weather.uv > 2) {
    text += ` · UV ${weather.uv}`
  }

  return text
}

function formatTimeUntil(date) {
  const now = new Date()
  const diff = date.getTime() - now.getTime()
  const minutes = Math.floor(diff / (1000 * 60))

  if (minutes <= 0) return "now"
  if (minutes === 1) return "in 1 minute"
  if (minutes < 60) return `in ${minutes} minutes`

  const hours = Math.floor(minutes / 60)
  const remainingMins = minutes % 60

  if (hours === 1) {
    if (remainingMins === 0) return "in 1 hour"
    return `in 1 hour and ${remainingMins} minutes`
  }

  if (remainingMins === 0) return `in ${hours} hours`
  return `in ${hours} hours and ${remainingMins} minutes`
}

function pluralize(count, singular, plural) {
  return count === 1 ? `${count} ${singular}` : `${count} ${plural}`
}

function describeGreeting(nextItem) {
  const greeting = getGreeting()

  if (nextItem) {
    const timeUntil = formatTimeUntil(nextItem.startDate)
    return `${greeting} — ${timeUntil}`
  }

  return `${greeting}!`
}

function describeSummary(birthdays, events, reminders) {
  const now = new Date()

  // Filter to non-past items for counting
  const upcomingEvents = events.filter(e => !e.isPast)
  const currentEvents = events.filter(e => e.isNow)

  const parts = []

  // Currently happening
  if (currentEvents.length > 0) {
    if (currentEvents.length === 1) {
      parts.push(`In "${currentEvents[0].title}" now.`)
    } else {
      parts.push(`${currentEvents.length} things happening now.`)
    }
  }

  // Build condensed counts: "2 events · 1 reminder"
  const counts = []

  if (birthdays.length > 0) {
    counts.push(pluralize(birthdays.length, "birthday", "birthdays"))
  }

  if (upcomingEvents.length > 0) {
    counts.push(pluralize(upcomingEvents.length, "event", "events"))
  }

  if (reminders.length > 0) {
    counts.push(pluralize(reminders.length, "reminder", "reminders"))
  }

  if (counts.length > 0) {
    parts.push(counts.join(" · ") + " today.")
  }

  // Empty day
  if (counts.length === 0 && currentEvents.length === 0) {
    const hour = now.getHours()
    let emptyMessages

    if (hour < 12) {
      emptyMessages = [
        "Your day is wide open.",
        "Nothing scheduled.",
        "A clear day ahead.",
        "No plans today."
      ]
    } else if (hour < 17) {
      emptyMessages = [
        "Nothing else scheduled.",
        "The rest of the day is yours.",
        "No more plans today.",
        "Your afternoon is free."
      ]
    } else {
      emptyMessages = [
        "Nothing left for today.",
        "Your evening is free.",
        "No more plans tonight.",
        "The rest of the night is yours."
      ]
    }
    parts.push(emptyMessages[Math.floor(Math.random() * emptyMessages.length)])
  }

  return parts.join(" ")
}

function describeBirthdays(birthdays) {
  if (birthdays.length === 0) return null

  // Extract names
  const names = birthdays.map(b => {
    return b.title
      .replace(/('s)?\s*(birthday|cumpleaños)/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
  }).filter(n => n.length > 0)

  if (names.length === 0) return null

  if (names.length === 1) {
    return `It's ${names[0]}'s birthday!`
  }

  if (names.length === 2) {
    return `${names[0]} and ${names[1]} have birthdays today!`
  }

  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]} have birthdays!`
}

// ============================================
// WIDGET CREATION
// ============================================

async function createWidget() {
  const widget = ZenCore.createWidget({
    refreshMinutes: 15,
    padding: [12, 16, 12, 16],
    theme: themeConfig
  })

  // Fetch data
  const [rawEvents, reminders, weather] = await Promise.all([
    ZenCalendar.getTodayEvents(),
    ZenCalendar.getTodayReminders(),
    getWeather()
  ])

  // Categorize
  const { birthdays, events } = categorizeEvents(rawEvents)
  const nextItem = getNextUpcoming(events, reminders)

  // Build content parts
  const greetingText = describeGreeting(nextItem)
  const weatherLine = describeWeather(weather)

  const calendarParts = []
  const birthdayLine = describeBirthdays(birthdays)
  if (birthdayLine) calendarParts.push(birthdayLine)
  const summaryLine = describeSummary(birthdays, events, reminders)
  if (summaryLine) calendarParts.push(summaryLine)

  const mainStack = widget.addStack()
  mainStack.layoutVertically()
  mainStack.centerAlignContent()

  // Greeting + next up (opens calendar) - Large, bold, primary anchor
  const greetingStack = mainStack.addStack()
  greetingStack.url = "calshow://"
  const greetingEl = greetingStack.addText(greetingText)
  greetingEl.textColor = ZenCore.getTextColor(themeConfig)
  greetingEl.font = ZenCore.getBoldFont(themeConfig.maxFontSize - 2, themeConfig)
  greetingEl.minimumScaleFactor = 0.8
  greetingStack.addSpacer()

  mainStack.addSpacer(6)

  // Weather section (opens weather app) - Medium size and weight
  if (weatherLine) {
    const weatherStack = mainStack.addStack()
    weatherStack.url = "weather://"
    const weatherEl = weatherStack.addText(weatherLine)
    weatherEl.textColor = ZenCore.getTextColor(themeConfig)
    weatherEl.font = ZenCore.getMediumFont(themeConfig.minFontSize + 4, themeConfig)
    weatherEl.minimumScaleFactor = 0.8
    weatherStack.addSpacer()

    mainStack.addSpacer(4)
  }

  // Calendar section (opens calendar app) - Regular weight, detail content
  if (calendarParts.length > 0) {
    const calStack = mainStack.addStack()
    calStack.url = "calshow://"
    const calEl = calStack.addText(calendarParts.join(" "))
    calEl.textColor = ZenCore.getTextColor(themeConfig)
    calEl.font = ZenCore.getRegularFont(themeConfig.minFontSize + 2, themeConfig)
    calEl.minimumScaleFactor = 0.7
    calStack.addSpacer()
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
  if (ZenCore.isApp()) {
    await presentConfigAlert()
  } else if (ZenCore.isWidget()) {
    const widget = await createWidget()
    Script.setWidget(widget)
  }
}

await run()
Script.complete()
