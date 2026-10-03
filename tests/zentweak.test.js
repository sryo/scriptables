const test = require("node:test")
const assert = require("node:assert/strict")
const { createRuntime } = require("./harness")

const NOW = new Date(2026, 9, 2, 10, 14, 0)
const DAY = 86400000
const CONFIG = "/docs/zentrate_config.json"
const STATS = "/docs/zentrate_stats.json"
const KEYCHAIN_KEY = "zen.anthropicApiKey"

const item = (name, column, position, extra = {}) =>
  ({ name, scheme: `${name.toLowerCase().replace(/\W/g, "")}://`, column, position, ...extra })

const ITEMS = [
  item("A", "left", 1), item("B", "left", 2), item("C", "left", 3),
  item("X", "right", 1)
]

const op = (name, fields = {}) => ({ type: "op", op: name, ...fields })

/** Runs ZenTweak in the app; the page sends `messages`, then the user closes it. */
async function edit(messages, opts = {}) {
  const rt = createRuntime({
    now: NOW,
    files: { "zentrate_config.json": { items: opts.items || ITEMS, sortMethod: "manual" }, ...(opts.files || {}) },
    webViewMessages: messages,
    keychain: opts.keychain,
    Request: opts.Request
  })
  await rt.runScript("ZenTweak.js", { runsInApp: true, args: opts.args || {} })
  return rt
}

const saved = rt => JSON.parse(rt.files.get(CONFIG))
const stats = rt => JSON.parse(rt.files.get(STATS))
const column = (rt, col) => saved(rt).items.filter(i => i.column === col)
const names = (rt, col) => column(rt, col).map(i => i.name)
const view = rt => rt.webViews[0]
const replies = rt => view(rt).received
const last = rt => replies(rt)[replies(rt).length - 1]

// ---------- page setup ----------

test("the editor opens a fullscreen web view with no alerts", async () => {
  const rt = await edit([])
  assert.equal(rt.webViews.length, 1)
  assert.equal(view(rt).presented, true)
  assert.equal(view(rt).fullscreen, true)
  assert.equal(rt.alerts.length, 0)
  assert.ok(rt.completed)
})

test("the page uses the active theme's colors and carries the current items", async () => {
  const rt = await edit([], { files: { "zen_theme.json": { bgColor: "1A2B3C", textColor: "F0F0F0", accentColor: "FF9500", fontName: "Menlo-Regular" } } })
  const html = view(rt).html
  assert.match(html, /--bg: #1A2B3C/)
  assert.match(html, /--text: #F0F0F0/)
  assert.match(html, /--accent: #FF9500/)
  // Menlo-Regular names the family; the default bold weight picks its bold face
  assert.match(html, /"Menlo-Bold"/)
  assert.ok(html.includes('"name":"A"'))
  assert.ok(html.includes("function pillsToRange("))
})

// Loading into a view that isn't on screen yet can leave it blank on device
test("the page is loaded after the web view is on screen", async () => {
  const rt = await edit([])
  assert.equal(view(rt).loadedWhilePresented, true)
})

test("the web view loads the page without a request filter that could block it", async () => {
  const rt = await edit([])
  assert.equal(view(rt).shouldAllowRequest, null)
  assert.ok(view(rt).html.includes("<h1>ZenTrate</h1>"))
})

test("opening and closing without changes saves nothing", async () => {
  const before = JSON.stringify({ items: ITEMS, sortMethod: "manual" })
  const rt = await edit([{ type: "idle" }])
  assert.equal(rt.files.get(CONFIG), before)
  assert.equal(rt.files.has(STATS), false)
  assert.equal(replies(rt).length, 0)
})

// ---------- ops ----------

test("each op is applied, saved, and answered with the new state", async () => {
  const rt = await edit([
    op("add", { id: 1, item: { name: "New", scheme: "new://", column: "center" } }),
    op("update", { id: 2, name: "A", draft: { name: "Alpha", scheme: "alpha://" } }),
    op("move", { id: 3, name: "C", column: "right", position: 1 }),
    op("constraints", { id: 4, name: "B", constraints: { startTime: "22:00", endTime: "06:00", startDay: 5, endDay: 1 } }),
    op("sort", { id: 5, method: "usage" }),
    op("delete", { id: 6, name: "X" })
  ])
  assert.deepEqual(replies(rt).map(r => [r.type, r.id]), [1, 2, 3, 4, 5, 6].map(id => ["state", id]))
  assert.deepEqual(names(rt, "left"), ["Alpha", "B"])
  assert.deepEqual(names(rt, "center"), ["New"])
  assert.deepEqual(names(rt, "right"), ["C"])
  const b = column(rt, "left")[1]
  assert.deepEqual([b.startTime, b.endTime, b.startDay, b.endDay], ["22:00", "06:00", 5, 1])
  assert.equal(saved(rt).sortMethod, "usage")
  assert.deepEqual(last(rt).state.config, saved(rt))
  assert.equal(last(rt).deleted, "X")
})

test("an invalid op replies with the error and saves nothing", async () => {
  const before = JSON.stringify({ items: ITEMS, sortMethod: "manual" })
  const rt = await edit([op("update", { id: 7, name: "A", draft: { name: "B", scheme: "a://" } })],
    { files: { "zentrate_stats.json": { A: 3 } } })
  assert.equal(rt.files.get(CONFIG), before)
  assert.deepEqual(stats(rt), { A: 3 })
  assert.equal(last(rt).type, "error")
  assert.equal(last(rt).id, 7)
  assert.equal(last(rt).field, "name")
  assert.match(last(rt).error, /ya existe/)
})

test("an unknown message is rejected and saves nothing", async () => {
  const before = JSON.stringify({ items: ITEMS, sortMethod: "manual" })
  const rt = await edit([{ type: "navigate", url: "https://example.com" }, op("wipe"), "garbage"])
  assert.equal(rt.files.get(CONFIG), before)
  assert.deepEqual(replies(rt).map(r => r.type), ["error", "error", "error"])
  assert.deepEqual(rt.openedUrls, [])
})

// ---------- item invariants ----------

test("renaming carries the usage count over to the new name", async () => {
  const rt = await edit([op("update", { name: "A", draft: { name: "Alpha", scheme: "a://" } })],
    { files: { "zentrate_stats.json": { A: 8, B: 2 } } })
  assert.deepEqual(names(rt, "left"), ["Alpha", "B", "C"])
  assert.deepEqual(stats(rt), { Alpha: 4, B: 1 })
})

test("clearing the name is rejected and does not drop the item", async () => {
  const rt = await edit([op("update", { name: "A", draft: { name: "   ", scheme: "a://" } })])
  assert.deepEqual(names(rt, "left"), ["A", "B", "C"])
  assert.equal(last(rt).field, "name")
})

test("clearing the URL keeps the item and marks it for lookup on tap", async () => {
  const rt = await edit([op("update", { name: "A", draft: { name: "A", scheme: "" } })])
  assert.equal(column(rt, "left")[0].scheme, "about:blank")
})

test("an unopenable URL is rejected on edit and on add", async () => {
  const rt = await edit([
    op("update", { name: "A", draft: { name: "A", scheme: "spotify" } }),
    op("add", { item: { name: "New", scheme: "not a url", column: "left" } })
  ])
  assert.equal(column(rt, "left")[0].scheme, "a://")
  assert.deepEqual(names(rt, "left"), ["A", "B", "C"])
  assert.deepEqual(replies(rt).map(r => [r.type, r.field]), [["error", "scheme"], ["error", "scheme"]])
})

test("names are trimmed and may contain %", async () => {
  const rt = await edit([op("update", { name: "50% Off", draft: { name: "  Half Off ", scheme: "deals://" } })],
    { items: [item("50% Off", "left", 1, { scheme: "deals://" })] })
  assert.deepEqual(names(rt, "left"), ["Half Off"])
})

test("renaming keeps a stored URL the validator would reject if typed fresh", async () => {
  const legacy = { name: "Old", column: "left", position: 1, scheme: "shortcuts://run-shortcut?name=My Shortcut" }
  const rt = await edit([op("update", { name: "Old", draft: { name: "New", scheme: legacy.scheme } })], { items: [legacy] })
  assert.deepEqual(saved(rt).items.map(i => [i.name, i.scheme]), [["New", legacy.scheme]])
})

test("a new item goes where it was dropped, or last by default", async () => {
  const rt = await edit([
    op("add", { item: { name: "First", scheme: "first://", column: "left" }, position: 1 }),
    op("add", { item: { name: "Last", scheme: "", column: "left" } })
  ])
  assert.deepEqual(names(rt, "left"), ["First", "A", "B", "C", "Last"])
  assert.deepEqual(column(rt, "left").map(i => i.position), [1, 2, 3, 4, 5])
  assert.equal(column(rt, "left")[4].scheme, "about:blank")
})

test("a day range with only one end is rejected, since the widget would ignore it", async () => {
  const items = [item("A", "left", 1, { startTime: "08:00", endTime: "12:00" })]
  const rt = await edit([op("constraints", { name: "A", constraints: { startTime: "09:00", startDay: 1 } })], { items })
  const a = column(rt, "left")[0]
  assert.deepEqual([a.startTime, a.endTime, a.startDay], ["08:00", "12:00", undefined])
  assert.equal(last(rt).type, "error")
})

test("Siempre visible clears every constraint", async () => {
  const items = [item("A", "left", 1, { startTime: "08:00", endTime: "12:00", startDay: 1, endDay: 5 })]
  const rt = await edit([op("constraints", { name: "A", constraints: null })], { items })
  assert.deepEqual(column(rt, "left")[0], item("A", "left", 1))
})

test("moving within a column and past the end renumbers positions", async () => {
  const rt = await edit([
    op("move", { name: "C", column: "left", position: 1 }),
    op("move", { name: "A", column: "right", position: 9 })
  ])
  assert.deepEqual(names(rt, "left"), ["C", "B"])
  assert.deepEqual(names(rt, "right"), ["X", "A"])
  assert.deepEqual(column(rt, "right").map(i => i.position), [1, 2])
  assert.equal(saved(rt).items.length, 4)
})

// ---------- delete and undo ----------

test("deleting drops the usage count, and undo brings item and count back", async () => {
  const files = { "zentrate_stats.json": { A: 2, B: 40 } }
  const deleted = await edit([op("delete", { name: "B" })], { files })
  assert.deepEqual(names(deleted, "left"), ["A", "C"])
  assert.equal(stats(deleted).B, undefined)

  const undone = await edit([op("delete", { name: "B" }), op("undo")], { files })
  assert.deepEqual(saved(undone).items, ITEMS)
  assert.deepEqual(stats(undone), { A: 2, B: 40 })
  assert.equal(saved(undone).training, undefined)
})

// ---------- training ----------

test("an edit starts training, halving counts once", async () => {
  const rt = await edit([
    op("move", { name: "A", column: "center" }),
    op("move", { name: "B", column: "center" })
  ], { files: { "zentrate_stats.json": { A: 8 } } })
  assert.equal(new Date(saved(rt).training.until).getTime(), NOW.getTime() + 14 * DAY)
  assert.deepEqual(stats(rt), { A: 4 })
  assert.equal(last(rt).state.training.text, "Aprendiendo hasta el 16/10")
})

test("sorting does not start training; Entrenar and Detener do what they say", async () => {
  const sorted = await edit([op("sort", { method: "alphabetical" })])
  assert.equal(saved(sorted).training, undefined)
  const stopped = await edit([op("train"), op("stopTrain")])
  assert.equal(saved(stopped).training, undefined)
  assert.equal(last(stopped).state.training.text, "Tamaños fijos")
})

// ---------- Claude, API key, test ----------

function claudeRequest(results, status = 200) {
  return class {
    constructor(url) { this.url = url; this.response = { statusCode: status } }
    async loadJSON() {
      if (status !== 200) return { error: { message: "invalid x-api-key" } }
      return { stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ results }) }] }
    }
  }
}

test("asking Claude without a key asks the page for one instead of showing an alert", async () => {
  const rt = await edit([{ type: "search-claude", id: 3, query: "Spotify" }])
  assert.deepEqual(last(rt), { type: "claude", id: 3, needKey: true })
  assert.equal(rt.alerts.length, 0)
})

test("a key sent from the page is stored in the Keychain and the search runs", async () => {
  const Request = claudeRequest([{ name: "Spotify", scheme: "spotify://", confidence: "high" }])
  const rt = await edit([{ type: "set-key", id: 4, key: "  sk-ant-test  ", query: "Spotify" }], { Request })
  assert.equal(rt.keychain.get(KEYCHAIN_KEY), "sk-ant-test")
  assert.equal(last(rt).type, "claude")
  assert.equal(last(rt).id, 4)
  assert.deepEqual(last(rt).results.map(r => r.scheme), ["spotify://"])
})

test("a rejected key asks the page for a new one", async () => {
  const rt = await edit([{ type: "search-claude", query: "Spotify" }],
    { keychain: { [KEYCHAIN_KEY]: "old" }, Request: claudeRequest([], 401) })
  assert.equal(last(rt).needKey, true)
  assert.match(last(rt).error, /invalid x-api-key/)
})

test("a blank key is not stored", async () => {
  const rt = await edit([{ type: "set-key", key: "   " }])
  assert.equal(rt.keychain.has(KEYCHAIN_KEY), false)
  assert.equal(last(rt).needKey, true)
})

test("Probar opens a valid URL and refuses an invalid one", async () => {
  const rt = await edit([{ type: "test", url: "spotify://" }, { type: "test", url: "not a url" }])
  assert.deepEqual(rt.openedUrls, ["spotify://"])
  assert.equal(last(rt).type, "error")
})

// ---------- whole session ----------

test("a scripted editing session ends with the expected config", async () => {
  const rt = await edit([
    { type: "idle" },
    op("add", { item: { name: "Spotify", scheme: "spotify://", column: "center" } }),
    op("constraints", { name: "Spotify", constraints: { startTime: "18:00", endTime: "", startDay: 1, endDay: 5 } }),
    op("update", { name: "X", draft: { name: "Leer QR", scheme: "shortcuts://run-shortcut?name=Leer%20QR" } }),
    op("move", { name: "B", column: "right", position: 1 }),
    op("delete", { name: "C" }),
    op("undo"),
    op("delete", { name: "A" }),
    op("sort", { method: "alphabetical" }),
    { type: "test", url: "spotify://" }
  ], { files: { "zentrate_stats.json": { A: 6, B: 4, X: 2 } } })

  const config = saved(rt)
  assert.deepEqual(config.items.map(i => [i.name, i.column, i.position]), [
    ["C", "left", 1],
    ["Spotify", "center", 1],
    ["B", "right", 1], ["Leer QR", "right", 2]
  ])
  assert.equal(config.items[1].startTime, "18:00")
  assert.equal(config.items[1].endTime, undefined)
  assert.equal(config.sortMethod, "alphabetical")
  assert.ok(config.training)
  assert.deepEqual(stats(rt), { B: 2, "Leer QR": 1 })
  assert.deepEqual(rt.openedUrls, ["spotify://"])
  assert.ok(replies(rt).every(r => r.type !== "error"))
})

// ---------- widget ----------

test("as a widget, ZenTweak shows a button that opens the editor", async () => {
  const rt = createRuntime({ now: NOW, files: { "zentrate_config.json": { items: ITEMS } }, scriptName: "ZenTweak" })
  await rt.runScript("ZenTweak.js", { runsInWidget: true })
  assert.deepEqual(rt.leaves().map(l => l.text), ["Editar ZenTrate"])
  assert.equal(rt.widget.url, "scriptable:///run?scriptName=ZenTweak")
  assert.equal(rt.webViews.length, 0)
})

// ---------- Siri ----------

async function siri(query, items = ITEMS, files = {}) {
  const rt = createRuntime({
    now: NOW,
    files: { "zentrate_config.json": { items, sortMethod: "manual" }, ...files }
  })
  await rt.runScript("ZenTweak.js", { runsInApp: true, args: { shortcutParameter: query } })
  return rt
}

test("Siri adds a shortcut to the end of the right column and starts training", async () => {
  const rt = await siri("shortcut Leer QR", ITEMS, { "zentrate_stats.json": { A: 6 } })
  assert.deepEqual(names(rt, "right"), ["X", "Leer QR"])
  assert.deepEqual(column(rt, "right").map(i => i.position), [1, 2])
  assert.match(rt.shortcutOutput, /Added Leer QR/)
  assert.ok(saved(rt).training)
  assert.deepEqual(stats(rt), { A: 3 })
  assert.equal(rt.webViews.length, 0)
})

test("Siri refuses a duplicate name", async () => {
  const rt = await siri("atajo Leer QR", [...ITEMS, item("Leer QR", "right", 2)])
  assert.equal(saved(rt).items.length, 5)
  assert.equal(saved(rt).training, undefined)
  assert.match(rt.shortcutOutput, /already/)
})

// ---------- themes ----------

const ACTIVE = "/docs/zen_theme.json"
const NOIR_T = { name: "Noir", bgColor: "000000", textColor: "FFFFFF", accentColor: "0A84FF", fontName: "system", fontWeight: "bold", minFontSize: 10, maxFontSize: 40 }
const ZEN_T = { name: "Zen", bgColor: "FDF5E6", textColor: "333333", accentColor: "B07D48", fontName: "Georgia", fontWeight: "regular", minFontSize: 12, maxFontSize: 30 }
const THEME_FILES = {
  "ZenThemes/noir.json": NOIR_T,
  "ZenThemes/zen.json": ZEN_T,
  "zen_theme.json": { ...NOIR_T, source: "noir.json" }
}
const file = (rt, p) => JSON.parse(rt.files.get(p))
const themeFile = (rt, name) => file(rt, `/docs/ZenThemes/${name}`)

test("the page state lists the themes and marks the active one", async () => {
  const rt = await edit([], { files: THEME_FILES })
  const html = view(rt).html
  assert.ok(html.includes('"filename":"zen.json"'))
  assert.ok(html.includes('id="tema"'))
})

test("applying a theme makes it active for every widget and re-themes the page", async () => {
  const rt = await edit([op("theme.apply", { id: 1, filename: "zen.json" })], { files: THEME_FILES })
  assert.equal(file(rt, ACTIVE).source, "zen.json")
  assert.equal(file(rt, ACTIVE).bgColor, "FDF5E6")
  assert.equal(last(rt).type, "state")
  assert.equal(last(rt).state.tokens.bg, "#FDF5E6")
  assert.deepEqual(last(rt).state.themes.filter(t => t.active).map(t => t.filename), ["zen.json"])
})

test("changing the appearance rewrites the active theme's file and copy", async () => {
  const rt = await edit([op("theme.appearance", { appearance: "light" })], { files: THEME_FILES })
  assert.equal(themeFile(rt, "noir.json").appearance, "light")
  assert.equal(file(rt, ACTIVE).appearance, "light")
  assert.equal(file(rt, ACTIVE).source, "noir.json")
})

test("a valid theme edit autosaves its file, and the active copy when it's the active theme", async () => {
  const rt = await edit([
    op("theme.update", { filename: "zen.json", theme: { ...ZEN_T, accentColor: "ff2d55" } }),
    op("theme.update", { filename: "noir.json", theme: { ...NOIR_T, name: "Noche", maxFontSize: 50 } })
  ], { files: THEME_FILES })
  assert.equal(themeFile(rt, "zen.json").accentColor, "FF2D55")
  assert.equal(themeFile(rt, "noir.json").name, "Noche")
  assert.equal(file(rt, ACTIVE).name, "Noche")
  assert.equal(file(rt, ACTIVE).maxFontSize, 50)
  assert.equal(last(rt).state.tokens.maxSize, 50)
})

test("an invalid theme edit replies with field errors and saves nothing", async () => {
  const rt = await edit([op("theme.update", { id: 9, filename: "zen.json", theme: { ...ZEN_T, bgColor: "zz", minFontSize: 99 } })],
    { files: THEME_FILES })
  assert.equal(last(rt).type, "error")
  assert.equal(last(rt).id, 9)
  assert.deepEqual(Object.keys(last(rt).errors).sort(), ["bgColor", "minFontSize"])
  assert.deepEqual(themeFile(rt, "zen.json"), ZEN_T)
  assert.equal(file(rt, ACTIVE).source, "noir.json")
})

test("duplicating saves «<Nombre> copia» under a new file and tells the page which", async () => {
  const rt = await edit([op("theme.duplicate", { filename: "zen.json" })], { files: THEME_FILES })
  assert.equal(last(rt).created, "zen-copia.json")
  assert.equal(themeFile(rt, "zen-copia.json").name, "Zen copia")
  assert.equal(file(rt, ACTIVE).source, "noir.json")
  assert.ok(last(rt).state.themes.some(t => t.filename === "zen-copia.json"))
})

test("the active theme can't be deleted; another one can, and undo brings its file back", async () => {
  const refused = await edit([op("theme.delete", { filename: "noir.json" })], { files: THEME_FILES })
  assert.equal(last(refused).type, "error")
  assert.match(last(refused).error, /activo/)
  assert.ok(refused.files.has("/docs/ZenThemes/noir.json"))

  const deleted = await edit([op("theme.delete", { filename: "zen.json" })], { files: THEME_FILES })
  assert.equal(deleted.files.has("/docs/ZenThemes/zen.json"), false)
  assert.equal(last(deleted).deleted, "Zen")

  const undone = await edit([op("theme.delete", { filename: "zen.json" }), op("theme.undoDelete")], { files: THEME_FILES })
  assert.deepEqual(themeFile(undone, "zen.json"), { ...ZEN_T, author: "", fontItalic: false, appearance: "auto" })
  assert.equal(file(undone, ACTIVE).source, "noir.json")
})

test("an item edit between a theme delete and its undo ends the undo", async () => {
  const rt = await edit([op("theme.delete", { filename: "zen.json" }), op("sort", { method: "usage" }), op("theme.undoDelete")],
    { files: THEME_FILES })
  assert.equal(rt.files.has("/docs/ZenThemes/zen.json"), false)
  assert.equal(last(rt).type, "error")
})

test("a scripted theme session ends with the chosen theme active", async () => {
  const rt = await edit([
    op("theme.duplicate", { filename: "noir.json" }),
    op("theme.update", { filename: "noir-copia.json", theme: { ...NOIR_T, name: "Noir copia", bgColor: "101820", light: { bgColor: "F2F2F7", textColor: "101820" } } }),
    op("theme.apply", { filename: "zen.json" }),
    op("theme.apply", { filename: "noir-copia.json" }),
    op("theme.appearance", { appearance: "auto" }),
    op("theme.delete", { filename: "zen.json" })
  ], { files: THEME_FILES })
  assert.ok(replies(rt).every(r => r.type !== "error"), JSON.stringify(replies(rt).filter(r => r.type === "error")))
  const active = file(rt, ACTIVE)
  assert.equal(active.source, "noir-copia.json")
  assert.equal(active.bgColor, "101820")
  assert.deepEqual(active.light, { bgColor: "F2F2F7", textColor: "101820" })
  assert.equal(rt.files.has("/docs/ZenThemes/zen.json"), false)
  assert.equal(last(rt).state.tokens.adaptive, true)
})

test("opened with focus=tema, the page scrolls to the Tema section", async () => {
  const rt = await edit([], { args: { queryParameters: { focus: "tema" } } })
  assert.match(view(rt).html, /\{"focus":"tema"\}\)/)
})

test("with no theme files the editor ships Noir so the strip is never empty", async () => {
  const rt = await edit([])
  assert.ok(rt.files.has("/docs/ZenThemes/noir.json"))
})
