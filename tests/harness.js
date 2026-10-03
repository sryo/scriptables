/**
 * tests/harness.js - Runs Scriptable scripts and lib modules under Node.
 *
 * Each call to createRuntime() builds a fresh set of Scriptable globals
 * (mirroring Scriptable's fresh-context-per-run model). Scripts are evaluated
 * as async function bodies so top-level `await` works like on-device.
 *
 * Usage:
 *   const rt = createRuntime({ now: new Date(...), events: [...], files: {...} })
 *   await rt.runScript("ZenLendar.js", { runsInWidget: true })
 *   rt.widget  // the ListWidget passed to Script.setWidget
 */

const fs = require("fs")
const path = require("path")

const ROOT = path.resolve(__dirname, "..")
const DOCS = "/docs"
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor

const SCRIPTABLE_HEADER_GLOBALS = [
  "FileManager", "Calendar", "CalendarEvent", "Reminder", "RelativeDateTimeFormatter",
  "DateFormatter", "ListWidget", "Font", "Color", "Alert", "Script", "Device", "Request",
  "Location", "Safari", "Keychain", "Timer", "Size", "Photos", "config", "args",
  "importModule", "console", "Date", "Promise", "Math", "JSON", "Object", "Array",
  "String", "Number", "Error", "Intl", "setTimeout", "WebView", "DrawContext", "Rect", "Point"
]

// ---------- Fake clock ----------

function makeDateClass(nowMs) {
  const RealDate = Date
  class FakeDate extends RealDate {
    constructor(...a) {
      if (a.length === 0) super(nowMs.value)
      else super(...a)
    }
    static now() { return nowMs.value }
  }
  FakeDate.UTC = RealDate.UTC
  FakeDate.parse = RealDate.parse
  return FakeDate
}

// ---------- Widget tree ----------

class WidgetText {
  constructor(text) { this.type = "text"; this.text = text; this.font = null; this.textColor = null; this.lineLimit = 0; this.url = null }
  leftAlignText() { this.align = "left" }
  centerAlignText() { this.align = "center" }
  rightAlignText() { this.align = "right" }
}

class WidgetDate {
  constructor(date) { this.type = "date"; this.date = date; this.style = "date"; this.font = null; this.textColor = null; this.lineLimit = 0 }
  applyTimeStyle() { this.style = "time" }
  applyDateStyle() { this.style = "date" }
  applyRelativeStyle() { this.style = "relative" }
  applyOffsetStyle() { this.style = "offset" }
  applyTimerStyle() { this.style = "timer" }
  leftAlignText() { this.align = "left" }
  centerAlignText() { this.align = "center" }
  rightAlignText() { this.align = "right" }
}

class WidgetSpacer {
  constructor(length) { this.type = "spacer"; this.length = length ?? null }
}

class WidgetImage {
  constructor(image) { this.type = "image"; this.image = image }
}

class Container {
  constructor(type) { this.type = type; this.children = []; this.url = null }
  addText(t) { const n = new WidgetText(t); this.children.push(n); return n }
  addDate(d) { const n = new WidgetDate(d); this.children.push(n); return n }
  addSpacer(l) { const n = new WidgetSpacer(l); this.children.push(n); return n }
  addImage(i) { const n = new WidgetImage(i); this.children.push(n); return n }
  addStack() { const n = new WidgetStack(); this.children.push(n); return n }
  setPadding(...p) { this.padding = p }
  useDefaultPadding() { this.padding = "default" }
}

class WidgetStack extends Container {
  constructor() { super("stack"); this.layout = "horizontal"; this.size = null }
  layoutHorizontally() { this.layout = "horizontal" }
  layoutVertically() { this.layout = "vertical" }
  topAlignContent() {}
  centerAlignContent() {}
  bottomAlignContent() {}
}

class ListWidget extends Container {
  constructor() { super("widget"); this.refreshAfterDate = null; this.backgroundColor = null; this.backgroundImage = null }
  async presentSmall() {}
  async presentMedium() {}
  async presentLarge() {}
}

// ---------- Drawing ----------

class Rect {
  constructor(x, y, width, height) { this.x = x; this.y = y; this.width = width; this.height = height }
}

class Point {
  constructor(x, y) { this.x = x; this.y = y }
}

/** Records every call as { op, ...args }; getImage() snapshots the list. */
class DrawContext {
  constructor() { this.size = null; this.respectScreenScale = false; this.opaque = true; this.ops = [] }
  setFont(font) { this.ops.push({ op: "setFont", font }) }
  setTextColor(color) { this.ops.push({ op: "setTextColor", color }) }
  setTextAlignedLeft() { this.ops.push({ op: "setTextAligned", align: "left" }) }
  setTextAlignedCenter() { this.ops.push({ op: "setTextAligned", align: "center" }) }
  setTextAlignedRight() { this.ops.push({ op: "setTextAligned", align: "right" }) }
  drawTextInRect(text, rect) { this.ops.push({ op: "drawTextInRect", text, rect }) }
  setFillColor(color) { this.ops.push({ op: "setFillColor", color }) }
  fillRect(rect) { this.ops.push({ op: "fillRect", rect }) }
  getImage() {
    // On device a context nothing was drawn into yields no image
    if (!this.ops.some(op => op.op === "fillRect" || op.op === "drawTextInRect")) return null
    return { type: "image", ops: this.ops.slice(), size: this.size, respectScreenScale: this.respectScreenScale, opaque: this.opaque }
  }
}

/** Flattens a widget tree into the ordered list of text/date leaves. */
function leaves(node) {
  if (!node) return []
  if (node.type === "text" || node.type === "date") return [node]
  return (node.children || []).flatMap(leaves)
}

// ---------- Runtime ----------

function createRuntime(opts = {}) {
  const nowMs = { value: (opts.now ? opts.now.getTime() : Date.now()) }
  const FakeDate = makeDateClass(nowMs)
  const files = new Map(Object.entries(opts.files || {}).map(([k, v]) =>
    [path.posix.join(DOCS, k), typeof v === "string" ? v : JSON.stringify(v)]))
  // Paths listed in opts.evicted exist in iCloud but aren't downloaded yet:
  // they read as null until downloadFileFromiCloud() resolves.
  const evicted = new Set((opts.evicted || []).map(k => path.posix.join(DOCS, k)))
  const logs = []
  const rt = {
    files, logs, widget: null, alerts: [], openedUrls: [], shortcutOutput: undefined,
    alertResponses: opts.alertResponses ? [...opts.alertResponses] : [],
    webViews: [],
    webViewMessages: opts.webViewMessages ? [...opts.webViewMessages] : [],
    keychain: new Map(Object.entries(opts.keychain || {})),
    setNow(d) { nowMs.value = d.getTime() },
    get now() { return new FakeDate() }
  }

  const fileManager = {
    documentsDirectory: () => DOCS,
    joinPath: (a, b) => path.posix.join(a, b),
    fileExists: p => files.has(p) || [...files.keys()].some(k => k.startsWith(p + "/")),
    isFileDownloaded: p => !evicted.has(p),
    downloadFileFromiCloud: async p => { await new Promise(r => setTimeout(r, 1)); evicted.delete(p) },
    readString: p => evicted.has(p) ? null : (files.has(p) ? files.get(p) : null),
    writeString: (p, s) => { evicted.delete(p); files.set(p, s) },
    remove: p => { files.delete(p) },
    move: (a, b) => { files.set(b, files.get(a)); files.delete(a) },
    copy: (a, b) => { files.set(b, files.get(a)) },
    createDirectory: () => {},
    isDirectory: p => [...files.keys()].some(k => k.startsWith(p + "/")),
    listContents: p => [...new Set([...files.keys()]
      .filter(k => k.startsWith(p + "/"))
      .map(k => k.slice(p.length + 1).split("/")[0]))],
    fileName: (p, ext) => { const b = path.posix.basename(p); return ext ? b : b.replace(/\.[^.]*$/, "") }
  }

  const calendarEvents = (opts.events || []).map(e => ({
    isAllDay: false, location: null, notes: null, calendar: { title: "Cal" }, ...e
  }))
  const reminders = (opts.reminders || []).map(r => ({ isCompleted: false, ...r }))

  class Alert {
    constructor() { this.title = ""; this.message = ""; this.fields = []; this.actions = []; rt.alerts.push(this) }
    addTextField(placeholder, value) { this.fields.push({ placeholder, value: value ?? "" }) }
    addSecureTextField(placeholder, value) { this.addTextField(placeholder, value) }
    addAction(t) { this.actions.push(t) }
    addDestructiveAction(t) { this.actions.push(t) }
    addCancelAction(t) { this.cancel = t }
    textFieldValue(i) { return this.fields[i].value }
    async present() { const r = rt.alertResponses.shift(); if (typeof r === "function") return r(this); return r ?? -1 }
    async presentAlert() { return this.present() }
    async presentSheet() { return this.present() }
  }

  // The page's side of the editor bridge: each `ZT.next()` callback hands
  // Scriptable the next queued message (objects are JSON-encoded like the
  // page does, strings pass through raw). Once the queue is empty the user
  // "dismisses" the view: present() resolves and ZT.next() never answers.
  class WebView {
    constructor() {
      this.html = null; this.received = []; this.evaluated = []
      this.shouldAllowRequest = null; this.presented = false; this.initialAllowed = null
      this._closed = new Promise(r => { this._close = r })
      rt.webViews.push(this)
    }
    async loadHTML(html, baseURL) {
      this.html = html
      this.loadedWhilePresented = this.presented
      if (this.shouldAllowRequest) this.initialAllowed = this.shouldAllowRequest({ url: baseURL || "about:blank" })
    }
    async present(fullscreen) {
      this.presented = true
      this.fullscreen = !!fullscreen
      return this._closed
    }
    async evaluateJavaScript(js, useCallback) {
      this.evaluated.push(js)
      const receive = js.match(/^ZT\.receive\(([\s\S]*)\)$/)
      if (receive) { this.received.push(JSON.parse(receive[1])); return null }
      if (js === "ZT.next()" && useCallback) {
        if (!rt.webViewMessages.length) { this._close(); return new Promise(() => {}) }
        const next = rt.webViewMessages.shift()
        return typeof next === "string" ? next : JSON.stringify(next)
      }
      return null
    }
  }

  class RelativeDateTimeFormatter {
    constructor() { this.style = "named"; this.locale = opts.locale || "en" }
    useNamedDateTimeStyle() { this.style = "named" }
    useNumericDateTimeStyle() { this.style = "numeric" }
    string(date, ref) {
      const rtf = new Intl.RelativeTimeFormat(this.locale, { numeric: this.style === "named" ? "auto" : "always" })
      const diff = (date.getTime() - ref.getTime()) / 1000
      const abs = Math.abs(diff)
      const units = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60], ["second", 1]]
      for (const [u, s] of units) {
        if (abs >= s || u === "second") return rtf.format(Math.trunc(diff / s), u)
      }
    }
  }

  class DateFormatter {
    constructor() { this.dateFormat = ""; this.locale = opts.locale || "en" }
    useNoDateStyle() {} useShortDateStyle() {} useMediumDateStyle() {}
    useNoTimeStyle() {} useShortTimeStyle() {} useMediumTimeStyle() {}
    string(d) {
      if (this.dateFormat === "h:mm a" || this.dateFormat === "" ) {
        return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
      }
      return d.toISOString()
    }
  }

  const fontFactory = name => (size) => ({ name, size })
  const Font = function (name, size) { return { name, size } }
  Object.assign(Font, {
    systemFont: fontFactory("system"), boldSystemFont: fontFactory("bold"),
    italicSystemFont: fontFactory("italic"), mediumSystemFont: fontFactory("medium"),
    lightSystemFont: fontFactory("light"), semiboldSystemFont: fontFactory("semibold"),
    serifSystemFont: fontFactory("serif"), roundedSystemFont: fontFactory("rounded"),
    monospaceSystemFont: fontFactory("mono"),
    regularSystemFont: fontFactory("regular")
  })
  // Scriptable's weighted factories: <weight>SystemFont, <weight>RoundedSystemFont
  // and <weight>MonospacedSystemFont, named e.g. "heavy", "boldRounded", "lightMonospaced"
  for (const weight of ["ultraLight", "thin", "light", "regular", "medium", "semibold", "bold", "heavy", "black"]) {
    if (!Font[`${weight}SystemFont`]) Font[`${weight}SystemFont`] = fontFactory(weight)
    Font[`${weight}RoundedSystemFont`] = fontFactory(`${weight}Rounded`)
    Font[`${weight}MonospacedSystemFont`] = fontFactory(`${weight}Monospaced`)
  }
  function Color(hex, alpha) { return { hex, alpha: alpha ?? 1 } }
  Color.dynamic = (light, dark) => ({ light, dark })
  Color.white = () => Color("#FFFFFF"); Color.black = () => Color("#000000"); Color.clear = () => Color("#000000", 0)

  const g = {
    FileManager: { iCloud: () => fileManager, local: () => fileManager },
    Calendar: {
      forEvents: async () => [{ title: "Cal" }],
      forReminders: async () => [{ title: "Reminders" }]
    },
    CalendarEvent: {
      // Mirrors EventKit: returns every event that overlaps [start, end),
      // including ones already in progress. Order is NOT guaranteed by
      // EventKit, so the mock deliberately returns them in insertion order.
      between: async (start, end) => calendarEvents.filter(e => e.startDate < end && e.endDate > start)
    },
    Reminder: {
      allDueBetween: async (start, end) => reminders.filter(r => r.dueDate && r.dueDate >= start && r.dueDate <= end)
    },
    RelativeDateTimeFormatter, DateFormatter, ListWidget, Font, Color, Alert, WebView,
    Script: {
      name: () => opts.scriptName || "Script",
      setWidget: w => { rt.widget = w },
      complete: () => { rt.completed = true },
      setShortcutOutput: v => { rt.shortcutOutput = v }
    },
    Device: {
      isUsingDarkAppearance: () => !!opts.dark, locale: () => opts.locale || "en_US", language: () => "en",
      screenSize: () => opts.screenSize || { width: 390, height: 844 }
    },
    Request: opts.Request || class { constructor(url) { this.url = url } async loadJSON() { throw new Error("offline") } async loadString() { throw new Error("offline") } },
    Location: { current: opts.location || (async () => { throw new Error("no location") }), setAccuracyToThreeKilometers() {} },
    Safari: { open: u => rt.openedUrls.push(u), openInApp: async u => rt.openedUrls.push(u) },
    Keychain: {
      contains: k => rt.keychain.has(k), get: k => rt.keychain.get(k) ?? null,
      set: (k, v) => { rt.keychain.set(k, v) }, remove: k => { rt.keychain.delete(k) }
    },
    Timer: { schedule: () => ({ invalidate() {} }) },
    Size: function (w, h) { return { width: w, height: h } },
    DrawContext, Rect, Point,
    Photos: {},
    config: { runsInWidget: false, runsInApp: false, runsInActionExtension: false, runsWithSiri: false, widgetFamily: "medium" },
    args: { queryParameters: {}, widgetParameter: null, plainTexts: [], shortcutParameter: null },
    console: {
      log: (...a) => logs.push(["log", a.join(" ")]),
      warn: (...a) => logs.push(["warn", a.join(" ")]),
      error: (...a) => logs.push(["error", a.join(" ")])
    },
    Date: FakeDate,
    Promise, Math, JSON, Object, Array, String, Number, Error, Intl, setTimeout
  }
  Object.assign(g, opts.globals || {})
  rt.globals = g

  const moduleCache = new Map()
  function evaluate(relPath, extraModule) {
    const abs = path.join(ROOT, relPath)
    const src = fs.readFileSync(abs, "utf8")
    const module = extraModule || { exports: {} }
    const names = [...SCRIPTABLE_HEADER_GLOBALS, "module", "exports"]
    const fn = new AsyncFunction(...names, src)
    return { fn, module, args: [...SCRIPTABLE_HEADER_GLOBALS.map(n => g[n]), module, module.exports] }
  }

  g.importModule = (name) => {
    const rel = name.endsWith(".js") ? name : name + ".js"
    if (moduleCache.has(rel)) return moduleCache.get(rel).exports
    // Library modules are synchronous in practice; run the body and take
    // its exports once the synchronous portion has completed.
    const { fn, module, args: a } = evaluate(rel)
    moduleCache.set(rel, module)
    const p = fn(...a)
    p.catch(e => { throw e })
    return module.exports
  }

  rt.require = (name) => g.importModule(name)

  rt.runScript = async (relPath, ctx = {}) => {
    Object.assign(g.config, ctx.config || {}, {
      runsInWidget: !!ctx.runsInWidget, runsInApp: !!ctx.runsInApp
    })
    if (ctx.config && ctx.config.widgetFamily) g.config.widgetFamily = ctx.config.widgetFamily
    Object.assign(g.args, ctx.args || {})
    const { fn, args: a } = evaluate(relPath)
    await fn(...a)
    return rt
  }

  rt.leaves = () => leaves(rt.widget)
  return rt
}

/** Convenience: minutes offset from a base date. */
function at(base, minutes) { return new Date(base.getTime() + minutes * 60000) }

module.exports = { createRuntime, leaves, at, DOCS, ROOT }
