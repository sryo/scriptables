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
const Page = importModule("config/zentrate-editor-page")

// Bound under the names the page sees them by, so page helpers read the same
// in Node and in the WebView.
const { parseTime, toMinutes, toDay, isMinuteInWindow, isDayInRange, isScheduledAt } = DateTime
const { columnItems, describeConstraints, usageFontSize, sortItems, posterLayout, fitRows, DAY_LETTERS,
  COLUMNS, POSTER_PADDING, LINE_HEIGHT } = ZenTrateConfig
const { normalize, capitalize, search, shortcutItem, CATALOG } = Schemes
const { normalizeTheme, hasVariants, resolveColors, contrastRatio, findFontFamily, fontSpec, toCss, FONT_WEIGHTS } = Theme

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

/**
 * The contrast of a variant's text on its background, as the sheet shows it.
 * @param {Object} colors - { bgColor, textColor }
 * @returns {Object} { ratio, ok (≥ 4.5), text }
 */
function contrastBadge(colors) {
  const ratio = contrastRatio(colors.bgColor, colors.textColor) || 1
  const ok = ratio >= 4.5
  const shown = ratio.toFixed(1).replace(/\.0$/, "").replace(".", ",")
  return { ratio, ok, text: `Contraste ${shown}:1` + (ok ? "" : " · Cuesta leerlo") }
}

// Each pill covers a band of CSS weights; `nominal` is what it asks for
const WEIGHT_PILLS = [
  { label: "Fina", nominal: "light", band: [100, 200, 300] },
  { label: "Normal", nominal: "regular", band: [400] },
  { label: "Media", nominal: "medium", band: [500, 600] },
  { label: "Negrita", nominal: "bold", band: [700] },
  { label: "Black", nominal: "black", band: [800, 900] }
]

/**
 * Which weight pills and italic switch the theme's font family can honor.
 * A pill is available when the family has a face in its band, and `id` is
 * the weight to save so fontSpec picks that face.
 * @param {Object} theme
 * @returns {Object} { weights: [{ id, label, available, on }], italic: { available, on } }
 */
function fontOptions(theme) {
  const spec = fontSpec(theme, 20)
  const family = findFontFamily(normalizeTheme(theme).theme.fontName)
  const faces = family && family.faces
  const italicFaces = faces ? faces.filter(f => f.italic) : []
  const pool = !faces ? null : spec.italic && italicFaces.length ? italicFaces : faces.filter(f => !f.italic)
  const weightOf = w => Object.keys(FONT_WEIGHTS).find(name => FONT_WEIGHTS[name] === w)

  const weights = WEIGHT_PILLS.map(pill => {
    let id = pill.nominal
    let available = !!family
    if (pool) {
      const inBand = pool.filter(f => pill.band.includes(f.weight))
      available = inBand.length > 0
      if (available) {
        const target = FONT_WEIGHTS[pill.nominal]
        id = weightOf(inBand.reduce((a, b) => Math.abs(b.weight - target) < Math.abs(a.weight - target) ? b : a).weight)
      }
    } else if (family && family.kind === "system" && spec.italic) {
      available = pill.nominal === "regular"
    }
    return { id, label: pill.label, available, on: !!family && pill.band.includes(spec.cssWeight) }
  })
  const italicAvailable = !!family && (faces ? italicFaces.length > 0 : family.kind === "system")
  return { weights, italic: { available: italicAvailable, on: spec.italic } }
}

/**
 * What a theme chip shows: its font, and its colors for `mode`. In "auto" a
 * theme with variants splits into its light and dark halves.
 * @param {Object} theme
 * @param {string} mode - "auto" | "dark" | "light"
 * @returns {Object} { bg, text, accent, font, weight, style, split: { light, dark } | null }
 */
function themeSwatch(theme, mode) {
  const css = toCss(fontSpec(theme, 20))
  const look = appearance => {
    const c = resolveColors(theme, appearance)
    return { bg: "#" + c.bgColor, text: "#" + c.textColor, accent: "#" + c.accentColor }
  }
  const base = look(mode === "light" ? "light" : "dark")
  const split = mode !== "light" && mode !== "dark" && hasVariants(normalizeTheme(theme).theme)
    ? { light: look("light"), dark: look("dark") }
    : null
  return { ...base, font: css.fontFamily, weight: css.fontWeight, style: css.fontStyle, split }
}

function sizeLabel(minSize, maxSize) {
  return Number(minSize) === Number(maxSize) ? `Tamaño fijo: ${minSize}` : `Chico ${minSize} ↔ Grande ${maxSize}`
}

/**
 * Turns separate light/dark colors on or off. On, both blocks are written
 * out; a variant the theme didn't have starts with text and background
 * swapped so the difference is visible. Off, the colors of `keep` stay.
 * @returns {Object} a new theme
 */
function setVariants(theme, on, keep) {
  const next = Object.assign({}, theme)
  if (on) {
    const dark = resolveColors(theme, "dark")
    const light = resolveColors(theme, "light")
    const same = ["bgColor", "textColor", "accentColor"].every(key => light[key] === dark[key])
    next.dark = dark
    next.light = same ? { bgColor: dark.textColor, textColor: dark.bgColor, accentColor: dark.accentColor } : light
    return next
  }
  Object.assign(next, resolveColors(theme, keep === "light" ? "light" : "dark"))
  delete next.light
  delete next.dark
  return next
}

/**
 * Sets one color as typed: in the variant's block when the theme has
 * variants, in the flat colors otherwise.
 * @returns {Object} a new theme
 */
function setThemeColor(theme, variant, key, value) {
  const next = Object.assign({}, theme)
  if (theme.light || theme.dark) {
    const block = variant === "light" ? "light" : "dark"
    next[block] = Object.assign({}, theme[block], { [key]: value })
  } else {
    next[key] = value
  }
  return next
}

const PAGE_FUNCTIONS = [
  parseTime, toMinutes, toDay, isMinuteInWindow, isDayInRange, isScheduledAt,
  columnItems, describeConstraints, usageFontSize, sortItems, posterLayout, fitRows,
  normalize, capitalize, search, shortcutItem,
  pillsToRange, rangeToPills, visibleAt, isOvernight, previewPoster,
  scrubDate, scrubLabel, dropPosition, moveStep, createBridge,
  contrastBadge, fontOptions, themeSwatch, sizeLabel, setVariants, setThemeColor
]

// ============================================
// SCRIPTABLE SIDE
// ============================================

const MESSAGE_TYPES = ["op", "search-claude", "set-key", "test", "idle"]
const OPS = ["add", "update", "delete", "move", "constraints", "sort", "train", "stopTrain", "undo"]
const THEME_OPS = ["theme.apply", "theme.appearance", "theme.update", "theme.duplicate", "theme.delete", "theme.undoDelete"]
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
  if (msg.type === "op" && !OPS.includes(msg.op) && !THEME_OPS.includes(msg.op)) return fail(`Operación desconocida «${msg.op}»`)
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

function isThemeOp(msg) {
  return THEME_OPS.includes(msg && msg.op)
}

/** A theme as a ZenThemes file stores it: normalized, no bookkeeping. */
function storedTheme(theme) {
  const { source: _s, ...data } = normalizeTheme(theme).theme
  return data
}

/**
 * «Zen copia», or «Zen copia 2»… when that name is taken (case ignored).
 * @param {string} name
 * @param {string[]} names - names already in use
 */
function copyName(name, names) {
  const taken = new Set(names.map(n => String(n).trim().toLowerCase()))
  const base = `${name} copia`
  let candidate = base
  for (let n = 2; taken.has(candidate.toLowerCase()); n++) candidate = `${base} ${n}`
  return candidate
}

/**
 * Decides what one theme op writes, without touching files: ZenTweak carries
 * out the returned effect with lib/theme. A delete can be undone until the
 * next op.
 * @param {Object} state - { themes (from loadAllThemes), active (loadTheme), undo }
 * @param {Object} msg - A parsed "op" message
 * @returns {Object} { ok, effect: { kind: "apply"|"update"|"create"|"remove"|"saveActive", filename?, theme? },
 *   undo, deleted? } or { ok: false, error, field?, errors? }
 */
function applyThemeOp(state, msg) {
  const themes = state.themes || []
  const find = filename => themes.find(t => t.filename === filename)
  const GONE = "Ese tema ya no existe."

  switch (msg.op) {
    case "theme.apply": {
      if (!find(msg.filename)) return fail(GONE)
      return { ok: true, effect: { kind: "apply", filename: msg.filename }, undo: null }
    }
    case "theme.appearance": {
      if (!Theme.APPEARANCES.includes(msg.appearance)) return fail("Elegí automático, oscuro o claro", "appearance")
      const file = state.active && find(state.active.source)
      if (file) return { ok: true, effect: { kind: "update", filename: file.filename, theme: storedTheme({ ...file, appearance: msg.appearance }) }, undo: null }
      return { ok: true, effect: { kind: "saveActive", theme: storedTheme({ ...state.active, appearance: msg.appearance }) }, undo: null }
    }
    case "theme.update": {
      if (!find(msg.filename)) return fail(GONE)
      const draft = msg.theme && typeof msg.theme === "object" ? msg.theme : {}
      const check = Theme.validateTheme(draft)
      if (!check.ok) {
        const field = Object.keys(check.errors)[0]
        return { ok: false, error: check.errors[field], field, errors: check.errors }
      }
      return { ok: true, effect: { kind: "update", filename: msg.filename, theme: storedTheme(draft) }, undo: null }
    }
    case "theme.duplicate": {
      const from = msg.filename ? find(msg.filename) : state.active
      if (!from) return fail(GONE)
      const name = copyName(normalizeTheme(from).theme.name, themes.map(t => t.name))
      return { ok: true, effect: { kind: "create", theme: storedTheme({ ...from, name }) }, undo: null }
    }
    case "theme.delete": {
      const doomed = find(msg.filename)
      if (!doomed) return fail(GONE)
      if (doomed.active || (state.active && state.active.source === doomed.filename)) {
        return fail("No podés borrar el tema activo. Elegí otro primero.")
      }
      return {
        ok: true,
        effect: { kind: "remove", filename: doomed.filename },
        undo: { filename: doomed.filename, theme: storedTheme(doomed) },
        deleted: doomed.name
      }
    }
    case "theme.undoDelete": {
      if (!state.undo) return fail("Nada para deshacer")
      const { filename, theme } = state.undo
      // Something saved under that filename since: restore beside it instead
      const effect = find(filename) ? { kind: "create", theme } : { kind: "update", filename, theme }
      return { ok: true, effect, undo: null }
    }
  }
  return fail(`Operación desconocida «${msg.op}»`)
}

/**
 * What the page needs to render.
 * @param {Object} [themeInfo] - { themes (from loadAllThemes), active (loadTheme) }
 * @returns {Object} { config, stats, training: { active, text }, themes: [{ filename, name, active, theme, swatch }],
 *   activeTheme, tokens }
 */
function buildState(config, stats, now, themeInfo = {}) {
  const active = normalizeTheme(themeInfo.active || {}).theme
  return {
    config,
    stats,
    training: {
      active: ZenTrateConfig.isTraining(config, now),
      text: ZenTrateConfig.describeTraining(config, now)
    },
    themes: (themeInfo.themes || []).map(t => ({
      filename: t.filename,
      name: t.name,
      active: !!t.active,
      theme: storedTheme(t),
      swatch: themeSwatch(t, active.appearance)
    })),
    activeTheme: active,
    tokens: themeTokens(active)
  }
}

/**
 * One appearance's colors as CSS values; `scheme` and `onAccent` pick
 * whichever of white or black contrasts more.
 */
function colorTokens(colors) {
  const rgb = h => [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16))
  const darker = (hex) => Theme.contrastRatio(hex, "FFFFFF") >= Theme.contrastRatio(hex, "000000")
  return {
    bg: "#" + colors.bgColor,
    text: "#" + colors.textColor,
    textRgb: rgb(colors.textColor).join(", "),
    accent: "#" + colors.accentColor,
    onAccent: darker(colors.accentColor) ? "#FFFFFF" : "#000000",
    scheme: darker(colors.bgColor) ? "dark" : "light"
  }
}

/**
 * The active theme as CSS values. The top-level colors are the ones to show
 * by default; when `adaptive` (appearance auto with variants) the page swaps
 * to `dark` under prefers-color-scheme.
 * @param {Object} theme
 * @returns {Object} { bg, text, textRgb, accent, onAccent, scheme, light, dark, adaptive,
 *   font, weight, style, minSize, maxSize }
 */
function themeTokens(theme) {
  const t = Theme.normalizeTheme(theme).theme
  const light = colorTokens(Theme.resolveColors(t, "light"))
  const dark = colorTokens(Theme.resolveColors(t, "dark"))
  const adaptive = t.appearance === "auto" && Theme.hasVariants(t)
  const base = adaptive || t.appearance === "light" ? light : dark
  const css = Theme.toCss(Theme.fontSpec(t, t.maxFontSize))
  return {
    ...base,
    light,
    dark,
    adaptive,
    font: css.fontFamily,
    weight: css.fontWeight,
    style: css.fontStyle,
    minSize: t.minFontSize,
    maxSize: t.maxFontSize
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
    `const LINE_HEIGHT = ${scriptJSON(LINE_HEIGHT)}`,
    `const PREVIEW_SIZE = ${scriptJSON(PREVIEW_SIZE)}`,
    `const CATALOG = ${scriptJSON(CATALOG)}`,
    `const WEIGHT_PILLS = ${scriptJSON(WEIGHT_PILLS)}`,
    Theme.modelSource(),
    ...PAGE_FUNCTIONS.map(fn => fn.toString())
  ].join("\n")
}

/**
 * @param {Object} options - { theme, state, focus? ("tema" opens scrolled to that section) }
 * @returns {string} The whole editor page
 */
function buildHTML({ theme, state, focus }) {
  const tokens = themeTokens(theme)
  const options = scriptJSON({ focus: focus === "tema" ? "tema" : null })
  return Page.render({ tokens, shared: pageScript(), state: scriptJSON(state), options })
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
  contrastBadge,
  fontOptions,
  themeSwatch,
  sizeLabel,
  setVariants,
  setThemeColor,
  parseMessage,
  isThemeOp,
  applyOp,
  copyName,
  applyThemeOp,
  buildState,
  themeTokens,
  pageScript,
  buildHTML,
}
