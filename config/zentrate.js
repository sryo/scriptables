// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-gray; icon-glyph: sliders-h;
/**
 * config/zentrate.js - Persistence for ZenTrate's launcher items + usage stats.
 *
 * Shared by ZenTrate (reader) and ZenTweak (editor). Each consumer picks the
 * loader that matches its first-run policy:
 *   - ZenTrate:   loadConfig()             — creates EXAMPLE_CONFIG if missing
 *   - ZenTweak:   loadConfigForEditor()    — returns a fresh empty config if
 *                                            missing, normalizes items.
 *
 * The editing model below the loaders is pure: each function takes a config
 * (and stats where names matter) and returns { ok, config, stats?, error }
 * without mutating its input or touching disk. Callers save the result.
 * Invariants kept by every edit: names are unique, a blank URL is stored as
 * "about:blank", and within each column array order matches `position`
 * (1..n), since ZenTrate's manual sort shows items in array order.
 */

const fs = importModule("lib/fs")
const Validate = importModule("lib/validate")

const CONFIG_PATH = fs.fm.joinPath(fs.baseDir, "zentrate_config.json")
const STATS_PATH = fs.fm.joinPath(fs.baseDir, "zentrate_stats.json")

const EMPTY_CONFIG = { items: [], sortMethod: "manual" }

const COLUMNS = ['left', 'center', 'right']
const SORT_METHODS = ['manual', 'alphabetical', 'usage']
// Stored for items without a URL; ZenTrate looks one up by name on first tap
const BLANK_SCHEME = "about:blank"
const DAY_LETTERS = ['D', 'L', 'M', 'X', 'J', 'V', 'S']

const EXAMPLE_CONFIG = {
  items: [
    { name: "Settings", column: "left", scheme: "App-prefs://", position: 1 },
    { name: "Weather", column: "left", scheme: "weather://", position: 2 },
    { name: "Messages", column: "left", scheme: "messages://", position: 3 },
    { name: "Calendar", column: "left", scheme: "calshow://", position: 4 },
    { name: "Phone", column: "left", scheme: "tel://", position: 5 },
    { name: "Maps", column: "left", scheme: "maps://", position: 6 },
    { name: "Create Reminder", column: "right", scheme: "shortcuts://run-shortcut?name=Create%20Reminder", position: 1 },
    { name: "Take Photo", column: "right", scheme: "shortcuts://run-shortcut?name=Take%20Photo", position: 2 },
    { name: "QR Scanner", column: "right", scheme: "shortcuts://run-shortcut?name=QR%20Scanner", position: 3 },
    { name: "Shazam", column: "right", scheme: "shortcuts://run-shortcut?name=Shazam", position: 4 }
  ],
  sortMethod: "manual"
}

function loadConfig() {
  const stored = fs.loadJSON(CONFIG_PATH, null)
  if (stored && typeof stored === 'object') {
    stored.items = (Array.isArray(stored.items) ? stored.items : []).filter(item =>
      item && typeof item === 'object' && item.name
    )
    return stored
  }
  // An evicted iCloud file reads as null too; seeding it would overwrite
  // the user's real config.
  if (fs.fileExists(CONFIG_PATH)) return { ...EMPTY_CONFIG, items: [] }
  fs.saveJSON(CONFIG_PATH, EXAMPLE_CONFIG)
  return EXAMPLE_CONFIG
}

// Interactive runs can wait for iCloud; widget renders can't.
async function downloadFiles() {
  await fs.ensureDownloaded(CONFIG_PATH)
  await fs.ensureDownloaded(STATS_PATH)
}

function loadConfigForEditor() {
  return normalizeConfig(fs.loadJSON(CONFIG_PATH, null))
}

/**
 * Drops entries ZenTrate can't show (no name), but keeps items with a missing
 * URL or an unknown column, since ZenTrate keeps them too and an editor save
 * would otherwise delete them for good.
 * @param {Object|null} raw
 * @returns {Object} A new config
 */
function normalizeConfig(raw) {
  const source = raw && typeof raw === 'object' ? raw : EMPTY_CONFIG
  const items = (Array.isArray(source.items) ? source.items : [])
    .filter(item => item && typeof item === 'object' && item.name)
    .map(item => ({ ...item, scheme: item.scheme || BLANK_SCHEME }))
  return { ...source, items, sortMethod: source.sortMethod || "manual" }
}

function saveConfig(config) {
  fs.saveJSON(CONFIG_PATH, config)
}

function loadStats() {
  return fs.loadJSON(STATS_PATH, {})
}

function saveStats(stats) {
  fs.saveJSON(STATS_PATH, stats, false)
}

function updateUsageCount(name) {
  const stats = loadStats()
  stats[name] = (stats[name] || 0) + 1
  saveStats(stats)
}

// ============================================
// EDITING MODEL (pure)
// ============================================

function copyConfig(config) {
  return { ...config, items: (config.items || []).map(item => ({ ...item })) }
}

function fail(error, field) {
  return field ? { ok: false, error, field } : { ok: false, error }
}

function toPosition(value) {
  const n = parseInt(value, 10)
  return Number.isFinite(n) ? n : undefined
}

function findItem(config, name) {
  return (config.items || []).find(item => item.name === name)
}

/**
 * @param {Object} config
 * @param {string} column
 * @returns {Object[]} The column's items in display order
 */
function columnItems(config, column) {
  return (config.items || []).filter(item => item.column === column)
}

/**
 * Inserts items (replacing any with the same names) into the column of
 * items[0] at a 1-based position, then regroups config.items by column with
 * positions renumbered. Columns outside COLUMNS, including a missing one, are
 * kept after the known ones.
 * @param {Object} config
 * @param {Object[]} items - All with the same column
 * @param {number} [position] - Clamped to the column; omitted appends
 * @returns {Object} A new config
 */
function placeInColumn(config, items, position) {
  const column = items[0].column
  const placing = items.map(item => ({ ...item }))
  const placingNames = placing.map(item => item.name)
  const rest = copyConfig(config).items.filter(item => !placingNames.includes(item.name))
  const target = rest.filter(item => item.column === column)
  const wanted = toPosition(position)
  const index = wanted === undefined ? target.length : Math.min(Math.max(wanted - 1, 0), target.length)
  target.splice(index, 0, ...placing)

  const columns = [...new Set([...COLUMNS, column, ...rest.map(item => item.column)])]
  const ordered = columns.flatMap(col => {
    const colItems = col === column ? target : rest.filter(item => item.column === col)
    colItems.forEach((item, i) => { item.position = i + 1 })
    return colItems
  })
  return { ...config, items: ordered }
}

/**
 * Checks a typed name and URL.
 * @param {Object} config
 * @param {Object} draft - { name, scheme } as typed
 * @param {Object} [original] - { originalName, originalScheme } when editing:
 *   keeping the original name is not a duplicate, and an unchanged stored URL
 *   is kept even if it predates the validator
 * @returns {Object} { ok, item: { name, scheme } } or { ok: false, error, field }
 */
function validateItemDraft(config, draft, original = {}) {
  draft = draft || {}
  const name = typeof draft.name === 'string' ? draft.name.trim() : ''
  const typed = typeof draft.scheme === 'string' ? draft.scheme.trim() : ''

  if (!name) return fail("El nombre es obligatorio", "name")
  // Items are looked up by name, so names must be unique
  if (name !== original.originalName && findItem(config, name)) {
    return fail(`«${name}» ya existe`, "name")
  }

  const scheme = !typed ? BLANK_SCHEME
    : typed === original.originalScheme ? original.originalScheme
    : Validate.validateURL(typed)
  if (!scheme) return fail(`«${typed}» no es una URL válida`, "scheme")

  return { ok: true, item: { name, scheme } }
}

/**
 * @param {Object} config
 * @param {Object} draft - { name, scheme, column }
 * @param {number} [position] - Omitted appends to the column
 * @returns {Object} { ok, config, item } or { ok: false, error, field }
 */
function addItem(config, draft, position) {
  draft = draft || {}
  if (!COLUMNS.includes(draft.column)) return fail(`Columna desconocida «${draft.column}»`, "column")
  const checked = validateItemDraft(config, draft)
  if (!checked.ok) return checked
  const item = { ...checked.item, column: draft.column }
  const next = placeInColumn(config, [item], position)
  return { ok: true, config: next, item: findItem(next, item.name) }
}

/**
 * Changes an item's name and URL, keeping its place and constraints. Usage
 * stats are keyed by name, so a rename carries the count over.
 * @param {Object} config
 * @param {Object} stats - { [name]: count }
 * @param {string} oldName
 * @param {Object} draft - { name, scheme } as typed
 * @returns {Object} { ok, config, stats, item } or { ok: false, error, field }
 */
function updateItem(config, stats, oldName, draft) {
  const existing = findItem(config, oldName)
  if (!existing) return fail(`No se encontró «${oldName}»`)
  const checked = validateItemDraft(config, draft, { originalName: oldName, originalScheme: existing.scheme })
  if (!checked.ok) return checked

  const next = copyConfig(config)
  const item = findItem(next, oldName)
  Object.assign(item, checked.item)

  const nextStats = { ...(stats || {}) }
  if (item.name !== oldName && nextStats[oldName] !== undefined) {
    nextStats[item.name] = nextStats[oldName]
    delete nextStats[oldName]
  }
  return { ok: true, config: next, stats: nextStats, item }
}

/**
 * Removes an item and its usage count, so a new item with that name starts fresh.
 * @returns {Object} { ok, config, stats } or { ok: false, error }
 */
function deleteItem(config, stats, name) {
  const existing = findItem(config, name)
  if (!existing) return fail(`No se encontró «${name}»`)
  const remaining = copyConfig(config).items.filter(item => item.name !== name)
  const sameColumn = remaining.filter(item => item.column === existing.column)
  sameColumn.forEach((item, i) => { item.position = i + 1 })

  const nextStats = { ...(stats || {}) }
  delete nextStats[name]
  return { ok: true, config: { ...config, items: remaining }, stats: nextStats }
}

/**
 * Moves items, in their current order, to a column. Without a position a
 * move to another column appends, and a move within the column keeps the
 * first item's place.
 * @param {Object} config
 * @param {string[]} names
 * @param {string} column
 * @param {number} [position] - 1-based, clamped
 * @returns {Object} { ok, config } or { ok: false, error }
 */
function moveItems(config, names, column, position) {
  if (!COLUMNS.includes(column)) return fail(`Columna desconocida «${column}»`, "column")
  const moving = (config.items || []).filter(item => (names || []).includes(item.name))
  if (!moving.length || moving.length !== new Set(names).size) return fail("No se encontró el elemento")

  let wanted = toPosition(position)
  if (wanted === undefined && moving[0].column === column) {
    wanted = columnItems(config, column).indexOf(moving[0]) + 1
  }
  const placed = moving.map(item => ({ ...item, column }))
  return { ok: true, config: placeInColumn(config, placed, wanted) }
}

/**
 * Validates a constraint form. Blank fields mean no constraint. Overnight
 * windows (22:00–06:00) and wrapping day ranges (5–1) are allowed; a day
 * range needs both ends because the widget ignores half of one.
 * @param {Object} form - { startTime, endTime, startDay, endDay }, strings or numbers
 * @returns {Object} { ok, constraints } or { ok: false, error, field }
 */
function parseConstraints(form) {
  form = form || {}
  const constraints = {}
  const parsers = {
    startTime: Validate.validateTime, endTime: Validate.validateTime,
    startDay: Validate.validateDay, endDay: Validate.validateDay
  }
  for (const [field, parse] of Object.entries(parsers)) {
    const raw = form[field]
    try {
      const value = parse(raw === undefined || raw === null ? undefined : String(raw))
      if (value !== undefined) constraints[field] = value
    } catch (error) {
      return fail(field.endsWith("Time") ? `Hora no válida: ${raw}` : `Día no válido: ${raw}`, field)
    }
  }
  if (('startDay' in constraints) !== ('endDay' in constraints)) {
    return fail("Elegí el día de inicio y el de fin, o ninguno.",
      'startDay' in constraints ? "endDay" : "startDay")
  }
  return { ok: true, constraints }
}

/**
 * Replaces an item's constraints; null clears them.
 * @returns {Object} { ok, config } or { ok: false, error, field }
 */
function setConstraints(config, name, constraints) {
  if (!findItem(config, name)) return fail(`No se encontró «${name}»`)
  const parsed = parseConstraints(constraints || {})
  if (!parsed.ok) return parsed

  const next = copyConfig(config)
  const item = findItem(next, name)
  for (const field of ['startTime', 'endTime', 'startDay', 'endDay']) delete item[field]
  Object.assign(item, parsed.constraints)
  return { ok: true, config: next }
}

/**
 * @param {Object} config
 * @param {string} method - One of SORT_METHODS
 * @returns {Object} { ok, config } or { ok: false, error }
 */
function setSortMethod(config, method) {
  if (!SORT_METHODS.includes(method)) return fail(`Orden desconocido «${method}»`)
  return { ok: true, config: { ...copyConfig(config), sortMethod: method } }
}

/**
 * Short Spanish summary of when an item shows, e.g. "22:00–06:00 · L–V".
 * A half-set day range is ignored, as the widget ignores it.
 * @param {Object} item
 * @returns {string}
 */
function describeConstraints(item) {
  const parts = []
  item = item || {}
  const { startTime, endTime } = item
  if (startTime && endTime) parts.push(`${startTime}–${endTime}`)
  else if (startTime) parts.push(`desde ${startTime}`)
  else if (endTime) parts.push(`hasta ${endTime}`)

  const start = DAY_LETTERS[item.startDay]
  const end = DAY_LETTERS[item.endDay]
  if (start && end) parts.push(start === end ? start : `${start}–${end}`)

  return parts.length ? parts.join(" · ") : "Siempre"
}

// ---------- widget rendering ----------

/**
 * Font size for an item by tap count: a logarithmic scale raised to the 10th
 * power, so only the most-used items grow noticeably.
 * @param {number} usageCount
 * @param {number} maxUsage - Highest count among the config's items
 * @param {number} minSize
 * @param {number} maxSize
 * @returns {number}
 */
function usageFontSize(usageCount, maxUsage, minSize, maxSize) {
  // Prevent zero division
  const safeCount = Math.max(usageCount, 0.001)
  const safeMax = Math.max(maxUsage, 1)
  const logScale = Math.log(safeCount + 1) / Math.log(safeMax + 1)
  const acceleratedScale = Math.pow(logScale, 10)
  return Math.min(Math.round(minSize + acceleratedScale * (maxSize - minSize)), maxSize)
}

const POSTER_PADDING = { h: 16, v: 8 }
const LINE_HEIGHT = 1.2

/**
 * Lays the widget out as one drawn "poster": text is free to overlap its
 * neighbours, so a heavily used item stays big. Row i holds the i-th item of
 * each column and is as tall as its biggest name; the rows are centered as a
 * block, and only squeezed (letting big names overlap) when they don't fit.
 * Each text box spans the full content width, aligned like its column, so it
 * never wraps; taps land on the item's cell (a half or third of its row).
 * @param {Object[]} items - Visible items in display order
 * @param {Object} options - { width, height, padding: { h, v }, minSize, maxSize,
 *   stats, maxUsage }; maxUsage defaults to the highest count among items
 * @returns {Object} { rows, rowHeights, rowTops, columns, entries }, entries ordered
 *   biggest first (draw order), each { name, item, column, row, fontSize,
 *   align, textRect, tapRect } with rects as { x, y, w, h }
 */
function posterLayout(items, options) {
  const { width, height, minSize, maxSize } = options
  const padding = options.padding || POSTER_PADDING
  const stats = options.stats || {}
  const maxUsage = options.maxUsage ?? Math.max(...items.map(item => stats[item.name] || 0), 1)

  const byColumn = Object.fromEntries(COLUMNS.map(column => [column, items.filter(item => item.column === column)]))
  const columns = byColumn.center.length ? COLUMNS : ['left', 'right']
  const rows = Math.max(...COLUMNS.map(column => byColumn[column].length))
  const sizeOf = item => usageFontSize(stats[item.name] || 0, maxUsage, minSize, maxSize)
  const natural = Array.from({ length: rows }, (_, row) =>
    Math.max(...COLUMNS.map(column => {
      const size = byColumn[column][row] ? sizeOf(byColumn[column][row]) : minSize
      // Smaller names get more room around them, like the stacked layout's padding
      return LINE_HEIGHT * size + (maxSize - size) / 3
    })))
  const rowHeights = fitRows(natural, height - 2 * padding.v, LINE_HEIGHT * minSize)
  const used = rowHeights.reduce((sum, h) => sum + h, 0)
  const rowTops = []
  rowHeights.reduce((top, h) => { rowTops.push(top); return top + h }, (height - used) / 2)
  const cellWidth = width / columns.length
  const contentWidth = width - 2 * padding.h

  const entries = []
  for (let row = 0; row < rows; row++) {
    const rowCenter = rowTops[row] + rowHeights[row] / 2
    columns.forEach((column, index) => {
      const item = byColumn[column][row]
      if (!item) return
      const fontSize = sizeOf(item)
      const textHeight = fontSize * 1.25
      // Big text in an edge row is nudged inward so the widget edge doesn't clip it
      const textCenter = Math.min(Math.max(rowCenter, textHeight / 2), height - textHeight / 2)
      entries.push({
        name: item.name, item, column, row, fontSize, align: column,
        textRect: { x: padding.h, y: textCenter - textHeight / 2, w: contentWidth, h: textHeight },
        tapRect: { x: index * cellWidth, y: rowTops[row], w: cellWidth, h: rowHeights[row] }
      })
    })
  }

  entries.sort((a, b) => b.fontSize - a.fontSize)
  return { rows, rowHeights, rowTops, columns, entries }
}

/**
 * Natural row heights when they fit; otherwise each row keeps `floor` and the
 * space left is shared in proportion to how much taller than that it wanted.
 */
function fitRows(natural, available, floor) {
  const total = natural.reduce((sum, h) => sum + h, 0)
  if (total <= available) return natural
  if (natural.length * floor >= available) return natural.map(() => available / natural.length)
  const extra = natural.reduce((sum, h) => sum + (h - floor), 0)
  const k = (available - natural.length * floor) / extra
  return natural.map(h => floor + (h - floor) * k)
}

/**
 * Orders items for display without mutating the input. Usage ties and the
 * manual method keep config order.
 * @param {Object[]} items
 * @param {string} method - One of SORT_METHODS
 * @param {Object} stats - { [name]: count }
 * @returns {Object[]}
 */
function sortItems(items, method, stats) {
  const copy = items.slice()
  if (method === 'usage') return copy.sort((a, b) => (stats[b.name] || 0) - (stats[a.name] || 0))
  if (method === 'alphabetical') return copy.sort((a, b) => a.name.localeCompare(b.name))
  return copy
}

/**
 * Reads a Siri request. "shortcut X" / "atajo X" adds a shortcut to the right
 * column; anything else is an app looked up by name for the left column.
 * @param {string} query
 * @returns {Object|null} { kind: "shortcut", name, column } | { kind: "app", query, column }
 */
function parseSiriQuery(query) {
  if (typeof query !== 'string' || !query.trim()) return null
  const clean = query.trim()
  const shortcut = clean.match(/^(shortcut|atajo)\s+(.+)$/i)
  if (shortcut) return { kind: "shortcut", name: shortcut[2].trim(), column: "right" }
  return { kind: "app", query: clean, column: "left" }
}

// ---------- usage training ----------
// Taps are only counted while training (they route through Scriptable, which
// flashes); otherwise they open the app directly and sizes stay frozen.

const TRAINING_DAYS = 14
const MS_PER_DAY = 86400000

function isTraining(config, now = new Date()) {
  const until = config.training && new Date(config.training.until)
  return !!until && !isNaN(until) && now < until
}

// Starting fresh halves existing counts so new habits outweigh old ones;
// extending a running period leaves counts alone and never shortens it.
function startTraining(config, stats, now = new Date(), days = TRAINING_DAYS) {
  const running = isTraining(config, now)
  const requested = now.getTime() + days * MS_PER_DAY
  const until = running ? Math.max(requested, new Date(config.training.until).getTime()) : requested
  const nextStats = running
    ? { ...stats }
    : Object.fromEntries(Object.entries(stats).map(([name, count]) => [name, count / 2]))
  return {
    config: { ...copyConfig(config), training: { until: new Date(until).toISOString() } },
    stats: nextStats
  }
}

function stopTraining(config) {
  const next = copyConfig(config)
  delete next.training
  return next
}

function describeTraining(config, now = new Date()) {
  if (!isTraining(config, now)) return "Tamaños fijos"
  const until = new Date(config.training.until)
  const dd = String(until.getDate()).padStart(2, "0")
  const mm = String(until.getMonth() + 1).padStart(2, "0")
  return `Aprendiendo hasta el ${dd}/${mm}`
}

module.exports = {
  TRAINING_DAYS,
  isTraining,
  startTraining,
  stopTraining,
  describeTraining,
  CONFIG_PATH,
  STATS_PATH,
  EMPTY_CONFIG,
  EXAMPLE_CONFIG,
  loadConfig,
  loadConfigForEditor,
  downloadFiles,
  saveConfig,
  loadStats,
  saveStats,
  updateUsageCount,
  COLUMNS,
  SORT_METHODS,
  BLANK_SCHEME,
  normalizeConfig,
  columnItems,
  placeInColumn,
  validateItemDraft,
  addItem,
  updateItem,
  deleteItem,
  moveItems,
  parseConstraints,
  setConstraints,
  setSortMethod,
  describeConstraints,
  DAY_LETTERS,
  usageFontSize,
  POSTER_PADDING,
  LINE_HEIGHT,
  fitRows,
  posterLayout,
  sortItems,
  parseSiriQuery
}
