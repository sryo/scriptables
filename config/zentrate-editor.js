// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-gray; icon-glyph: sliders-h;
/**
 * config/zentrate-editor.js - Logic for ZenTweak's WebView editor.
 *
 * Two halves:
 *   - Page helpers (pillsToRange … createBridge) run inside the WebView. They
 *     are injected with fn.toString(), together with the lib/config functions
 *     they call, so they must only reference each other, those shared
 *     functions, DAY_LETTERS and CATALOG. Node tests cover the exact code the
 *     page runs.
 *   - Scriptable helpers (parseMessage, applyOp, buildState, buildHTML …)
 *     validate page messages and apply them with config/zentrate's pure model.
 *
 * Bridge: Scriptable keeps calling evaluateJavaScript("ZT.next()", true); the
 * page answers each call with its next queued message as JSON, and Scriptable
 * replies with evaluateJavaScript("ZT.receive(<json>)").
 */

const ZenTrateConfig = importModule("config/zentrate")
const DateTime = importModule("lib/datetime")
const Schemes = importModule("lib/schemes")
const Theme = importModule("lib/theme")
const Validate = importModule("lib/validate")
const Page = importModule("config/zentrate-editor-page")

// Bound under the names the page sees them by, so page helpers read the same
// in Node and in the WebView.
const { parseTime, toMinutes, toDay, isMinuteInWindow, isDayInRange, isScheduledAt } = DateTime
const { columnItems, describeConstraints, usageFontSize, sortItems, posterLayout, fitRows, DAY_LETTERS,
  COLUMNS, POSTER_PADDING, GLYPH_WIDTH, LINE_HEIGHT } = ZenTrateConfig
const { normalize, capitalize, search, shortcutItem, CATALOG } = Schemes

// ============================================
// PAGE HELPERS (injected into the WebView)
// ============================================

/**
 * Reads the L M X J V S D pills as a model day range (0 = domingo). The
 * selection must be one run of consecutive days, possibly wrapping past D.
 * @param {boolean[]} pills - 7 flags in L..D order
 * @returns {Object} { ok, days: { startDay, endDay } | null (every day) } or { ok: false, error }
 */
function pillsToRange(pills) {
  const order = [1, 2, 3, 4, 5, 6, 0]
  const on = order.map((_, i) => !!(pills && pills[i]))
  const count = on.filter(Boolean).length
  if (!count) return { ok: false, error: "Elegí al menos un día" }
  if (count === 7) return { ok: true, days: null }
  const starts = on.map((v, i) => v && !on[(i + 6) % 7] ? i : -1).filter(i => i >= 0)
  if (starts.length !== 1) return { ok: false, error: "Los días deben ser consecutivos" }
  const start = starts[0]
  return { ok: true, days: { startDay: order[start], endDay: order[(start + count - 1) % 7] } }
}

/**
 * @param {number} [startDay]
 * @param {number} [endDay]
 * @returns {boolean[]} 7 flags in L..D order; every day when the range is unset
 */
function rangeToPills(startDay, endDay) {
  return [1, 2, 3, 4, 5, 6, 0].map(day => isDayInRange(day, startDay, endDay))
}

function visibleAt(item, date) {
  return isScheduledAt(item || {}, date)
}

function isOvernight(startTime, endTime) {
  const start = toMinutes(startTime)
  const end = toMinutes(endTime)
  return start !== null && end !== null && start > end
}

// Medium widget on a 390/393pt-wide iPhone; the page scales it to fit
const PREVIEW_SIZE = { width: 338, height: 158 }

/**
 * What the widget would draw at `date`: the same posterLayout ZenTrate uses,
 * over the items visible then, sized against every item's usage.
 * @returns {Object} { width, height, entries } — entries in draw order
 */
function previewPoster(config, stats, date, minSize, maxSize) {
  const items = (config && config.items) || []
  const counts = stats || {}
  const maxUsage = Math.max(...items.map(item => counts[item.name] || 0), 1)
  const visible = sortItems(items.filter(item => isScheduledAt(item, date)), config.sortMethod || "manual", counts)
  const layout = posterLayout(visible, {
    width: PREVIEW_SIZE.width, height: PREVIEW_SIZE.height, padding: POSTER_PADDING,
    minSize, maxSize, stats: counts, maxUsage
  })
  return { width: PREVIEW_SIZE.width, height: PREVIEW_SIZE.height, entries: layout.entries }
}

/**
 * @param {Date} now
 * @param {number} day - 0 = domingo
 * @param {number} minute - Minutes after midnight
 * @returns {Date} That weekday and time in the week of `now`
 */
function scrubDate(now, day, minute) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + (day - now.getDay()),
    Math.floor(minute / 60), minute % 60, 0)
}

function scrubLabel(date) {
  const days = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"]
  const hh = String(date.getHours()).padStart(2, "0")
  const mm = String(date.getMinutes()).padStart(2, "0")
  return `Ver a las ${hh}:${mm} del ${days[date.getDay()]}`
}

/**
 * Converts a drop slot into the position moveItems expects.
 * @param {string[]} names - The target column's chips as shown, dragged one included
 * @param {string} dragged
 * @param {number} index - Slot the chip was dropped in (0 = before the first chip)
 * @returns {number} 1-based position among the column's other items
 */
function dropPosition(names, dragged, index) {
  return names.slice(0, index).filter(name => name !== dragged).length + 1
}

/**
 * @param {Object} config
 * @param {string} name
 * @param {number} delta - -1 up, 1 down
 * @returns {Object|null} { column, position } for a move, or null at the column's ends
 */
function moveStep(config, name, delta) {
  const item = (config.items || []).find(i => i.name === name)
  if (!item) return null
  const index = columnItems(config, item.column).indexOf(item)
  const target = index + delta
  if (target < 0 || target >= columnItems(config, item.column).length) return null
  return { column: item.column, position: target + 1 }
}

/**
 * The page's message queue. `complete` answers the pending ZT.next() call.
 * @param {Function} complete - Receives the message as a JSON string
 * @returns {Object} { post(msg) → id, next(), idle() }
 */
function createBridge(complete) {
  const queue = []
  let waiting = false
  let seq = 0
  function flush() {
    if (waiting && queue.length) {
      waiting = false
      complete(JSON.stringify(queue.shift()))
    }
  }
  return {
    post(msg) {
      seq += 1
      queue.push(Object.assign({}, msg, { id: seq }))
      flush()
      return seq
    },
    next() {
      waiting = true
      flush()
    },
    // Answers a long-pending ZT.next() so Scriptable's call never sits open indefinitely
    idle() {
      if (waiting && !queue.length) {
        waiting = false
        complete(JSON.stringify({ type: "idle" }))
      }
    }
  }
}

const PAGE_FUNCTIONS = [
  parseTime, toMinutes, toDay, isMinuteInWindow, isDayInRange, isScheduledAt,
  columnItems, describeConstraints, usageFontSize, sortItems, posterLayout, fitRows,
  normalize, capitalize, search, shortcutItem,
  pillsToRange, rangeToPills, visibleAt, isOvernight, previewPoster,
  scrubDate, scrubLabel, dropPosition, moveStep, createBridge
]

// ============================================
// SCRIPTABLE SIDE
// ============================================

const MESSAGE_TYPES = ["op", "search-claude", "set-key", "test", "idle"]
const OPS = ["add", "update", "delete", "move", "constraints", "sort", "train", "stopTrain", "undo"]
// Changes to items count as new habits worth learning
const EDIT_OPS = ["add", "update", "delete", "move", "constraints"]

function fail(error, field) {
  return field ? { ok: false, error, field } : { ok: false, error }
}

/**
 * @param {*} raw - JSON string from the page (or an already-parsed object)
 * @returns {Object} { ok, msg } or { ok: false, error }
 */
function parseMessage(raw) {
  let msg = raw
  if (typeof raw === "string") {
    try {
      msg = JSON.parse(raw)
    } catch (error) {
      return fail("Mensaje no válido")
    }
  }
  if (!msg || typeof msg !== "object" || Array.isArray(msg)) return fail("Mensaje no válido")
  if (!MESSAGE_TYPES.includes(msg.type)) return fail(`Mensaje desconocido «${msg.type}»`)
  if (msg.type === "op" && !OPS.includes(msg.op)) return fail(`Operación desconocida «${msg.op}»`)
  return { ok: true, msg }
}

function runEdit(config, stats, msg) {
  const M = ZenTrateConfig
  switch (msg.op) {
    case "add": {
      const item = msg.item || {}
      return M.addItem(config, { name: item.name, scheme: item.scheme, column: item.column }, msg.position)
    }
    case "update": return M.updateItem(config, stats, msg.name, msg.draft)
    case "delete": return M.deleteItem(config, stats, msg.name)
    case "move": return M.moveItems(config, [msg.name], msg.column, msg.position)
    case "constraints": return M.setConstraints(config, msg.name, msg.constraints)
    case "sort": return M.setSortMethod(config, msg.method)
  }
  return fail(`Operación desconocida «${msg.op}»`)
}

/**
 * Applies one page op. Item edits start (or extend) training; a delete can be
 * undone until the next op.
 * @param {Object} state - { config, stats, undo }
 * @param {Object} msg - A parsed "op" message
 * @param {Date} now
 * @returns {Object} { ok, state, deleted? } or { ok: false, error, field? }
 */
function applyOp(state, msg, now) {
  const { config, stats } = state
  const M = ZenTrateConfig

  if (msg.op === "undo") {
    if (!state.undo) return fail("Nada para deshacer")
    return { ok: true, state: { config: state.undo.config, stats: state.undo.stats, undo: null } }
  }
  if (msg.op === "train") {
    const trained = M.startTraining(config, stats, now)
    return { ok: true, state: { config: trained.config, stats: trained.stats, undo: null } }
  }
  if (msg.op === "stopTrain") {
    return { ok: true, state: { config: M.stopTraining(config), stats, undo: null } }
  }

  const result = runEdit(config, stats, msg)
  if (!result.ok) return result
  const next = { config: result.config, stats: result.stats || stats, undo: null }

  if (EDIT_OPS.includes(msg.op) && JSON.stringify(next.config.items) !== JSON.stringify(config.items)) {
    const trained = M.startTraining(next.config, next.stats, now)
    next.config = trained.config
    next.stats = trained.stats
  }
  if (msg.op === "delete") {
    next.undo = { config, stats }
    return { ok: true, state: next, deleted: msg.name }
  }
  return { ok: true, state: next }
}

/**
 * What the page needs to render.
 * @returns {Object} { config, stats, training: { active, text } }
 */
function buildState(config, stats, now) {
  return {
    config,
    stats,
    training: {
      active: ZenTrateConfig.isTraining(config, now),
      text: ZenTrateConfig.describeTraining(config, now)
    }
  }
}

const SYSTEM_FONT = "-apple-system, system-ui, sans-serif"
const FONT_WEIGHTS = {
  ultraLight: 200, thin: 100, light: 300, regular: 400, medium: 500,
  semibold: 600, bold: 700, heavy: 800, black: 900
}

function cssFont(fontName) {
  const name = String(fontName || "system")
  switch (name.toLowerCase()) {
    case "system": return SYSTEM_FONT
    case "serif": return `ui-serif, Georgia, serif`
    case "mono":
    case "monospaced": return `ui-monospace, Menlo, monospace`
    case "rounded": return `ui-rounded, ${SYSTEM_FONT}`
  }
  return `"${name.replace(/["\\<>;{}]/g, "")}", ${SYSTEM_FONT}`
}

/**
 * The active theme as CSS values.
 * @param {Object} theme
 * @returns {Object} { bg, text, textRgb, accent, scheme, font, weight, style, minSize, maxSize }
 */
function themeTokens(theme) {
  const t = { ...Theme.DEFAULT_THEME, ...(theme || {}) }
  const hex = (value, fallback) => "#" + (Validate.validateHexColor(value) || fallback)
  const bg = hex(t.bgColor, Theme.DEFAULT_THEME.bgColor)
  const text = hex(t.textColor, Theme.DEFAULT_THEME.textColor)
  const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))
  const [r, g, b] = rgb(bg)
  const isSystem = String(t.fontName || "system").toLowerCase() === "system"
  return {
    bg,
    text,
    textRgb: rgb(text).join(", "),
    accent: hex(t.accentColor, Theme.DEFAULT_THEME.accentColor),
    scheme: (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5 ? "dark" : "light",
    font: cssFont(t.fontName),
    weight: FONT_WEIGHTS[Validate.validateFontWeight(t.fontWeight)],
    style: t.fontItalic && isSystem ? "italic" : "normal",
    minSize: Number(t.minFontSize) || Theme.DEFAULT_THEME.minFontSize,
    maxSize: Number(t.maxFontSize) || Theme.DEFAULT_THEME.maxFontSize
  }
}

/** JSON that is safe inside an inline <script>. */
function scriptJSON(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")
}

function pageScript() {
  return [
    `const DAY_LETTERS = ${scriptJSON(DAY_LETTERS)}`,
    `const COLUMNS = ${scriptJSON(COLUMNS)}`,
    `const POSTER_PADDING = ${scriptJSON(POSTER_PADDING)}`,
    `const GLYPH_WIDTH = ${scriptJSON(GLYPH_WIDTH)}`,
    `const LINE_HEIGHT = ${scriptJSON(LINE_HEIGHT)}`,
    `const PREVIEW_SIZE = ${scriptJSON(PREVIEW_SIZE)}`,
    `const CATALOG = ${scriptJSON(CATALOG)}`,
    ...PAGE_FUNCTIONS.map(fn => fn.toString())
  ].join("\n")
}

/**
 * @param {Object} options - { theme, state }
 * @returns {string} The whole editor page
 */
function buildHTML({ theme, state }) {
  const tokens = themeTokens(theme)
  return Page.render({ tokens, shared: pageScript(), state: scriptJSON(state) })
}

module.exports = {
  pillsToRange,
  rangeToPills,
  visibleAt,
  isOvernight,
  previewPoster,
  scrubDate,
  scrubLabel,
  dropPosition,
  moveStep,
  createBridge,
  parseMessage,
  applyOp,
  buildState,
  themeTokens,
  pageScript,
  buildHTML,
}
