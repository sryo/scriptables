const test = require("node:test")
const assert = require("node:assert/strict")
const vm = require("node:vm")
const { createRuntime } = require("./harness")

const NOW = new Date(2026, 9, 2, 10, 14, 0) // Friday
const DAY = 86400000
const rt = createRuntime({ now: NOW })
const E = rt.require("config/zentrate-editor")
const M = rt.require("config/zentrate")

const item = (name, column, position, extra = {}) =>
  ({ name, scheme: `${name.toLowerCase().replace(/\W/g, "")}://`, column, position, ...extra })
const config = (items = [
  item("A", "left", 1), item("B", "left", 2), item("C", "left", 3),
  item("X", "right", 1)
]) => ({ items, sortMethod: "manual" })
const state = (cfg = config(), stats = {}) => ({ config: cfg, stats, undo: null })
const names = (cfg, col) => M.columnItems(cfg, col).map(i => i.name)

// Pills run L M X J V S D; the model numbers days 0 = domingo.
const pills = letters => "LMXJVSD".split("").map(l => letters.includes(l))

// ---------- day pills ----------

test("L–V pills map to startDay 1 / endDay 5 and back", () => {
  assert.deepEqual(E.pillsToRange(pills("LMXJV")), { ok: true, days: { startDay: 1, endDay: 5 } })
  assert.deepEqual(E.rangeToPills(1, 5), pills("LMXJV"))
})

test("V–L wraps past the weekend", () => {
  assert.deepEqual(E.pillsToRange(pills("VSDL")), { ok: true, days: { startDay: 5, endDay: 1 } })
  assert.deepEqual(E.rangeToPills(5, 1), pills("VSDL"))
  assert.deepEqual(E.pillsToRange(pills("SD")), { ok: true, days: { startDay: 6, endDay: 0 } })
})

test("a single day maps to the same start and end", () => {
  assert.deepEqual(E.pillsToRange(pills("X")), { ok: true, days: { startDay: 3, endDay: 3 } })
  assert.deepEqual(E.rangeToPills(0, 0), pills("D"))
})

test("non-consecutive days are rejected", () => {
  for (const sel of ["LX", "LMV", "DM", "LXV", "MJSD"]) {
    assert.deepEqual(E.pillsToRange(pills(sel)), { ok: false, error: "Los días deben ser consecutivos" }, sel)
  }
})

test("every day means no day constraint and no day is an error", () => {
  assert.deepEqual(E.pillsToRange(pills("LMXJVSD")), { ok: true, days: null })
  assert.equal(E.pillsToRange(pills("")).ok, false)
  assert.deepEqual(E.rangeToPills(undefined, undefined), pills("LMXJVSD"))
  assert.deepEqual(E.rangeToPills(1, undefined), pills("LMXJVSD"))
})

test("every consecutive range round-trips through the pills", () => {
  for (let s = 0; s < 7; s++) for (let e = 0; e < 7; e++) {
    const r = E.pillsToRange(E.rangeToPills(s, e))
    const all = (e + 1) % 7 === s
    assert.deepEqual(r.days, all ? null : { startDay: s, endDay: e }, `${s}-${e}`)
  }
})

// ---------- visibility ----------

test("an overnight L–V item is visible Saturday 01:00, as the tail of Friday night", () => {
  const night = { startTime: "22:00", endTime: "06:00", startDay: 1, endDay: 5 }
  assert.equal(E.visibleAt(night, new Date(2026, 9, 3, 1, 0)), true)   // Sat 01:00
  assert.equal(E.visibleAt(night, new Date(2026, 9, 3, 23, 0)), false) // Sat 23:00
  assert.equal(E.visibleAt(night, new Date(2026, 9, 5, 1, 0)), false)  // Mon 01:00 (Sunday night)
  assert.equal(E.visibleAt(night, new Date(2026, 9, 5, 22, 30)), true) // Mon 22:30
})

test("isOvernight flags windows that end the next day", () => {
  assert.equal(E.isOvernight("22:00", "06:00"), true)
  assert.equal(E.isOvernight("09:00", "17:00"), false)
  assert.equal(E.isOvernight("22:00", ""), false)
})

// ---------- preview ----------

test("previewPoster lays out only the items visible at that time, exactly like the widget", () => {
  const cfg = config([item("A", "left", 1), item("B", "left", 2, { startTime: "20:00", endTime: "22:00" }), item("R", "right", 1)])
  const stats = { A: 1, B: 10, R: 5 }
  const poster = E.previewPoster(cfg, stats, NOW, 10, 40)
  assert.deepEqual([poster.width, poster.height], [338, 158])
  assert.deepEqual(poster.entries.map(e => e.name).sort(), ["A", "R"])
  // Hidden items still count toward the biggest size, as in ZenTrate
  const expected = M.posterLayout([cfg.items[0], cfg.items[2]], {
    width: 338, height: 158, padding: M.POSTER_PADDING, minSize: 10, maxSize: 40, stats, maxUsage: 10
  })
  assert.deepEqual(poster.entries.map(e => [e.name, e.fontSize, e.textRect]),
    expected.entries.map(e => [e.name, e.fontSize, e.textRect]))
})

test("usageFontSize keeps ZenTrate's curve", () => {
  assert.equal(M.usageFontSize(10, 10, 10, 20), 20)
  assert.equal(M.usageFontSize(0, 10, 10, 20), 10)
  assert.ok(M.usageFontSize(5, 10, 10, 20) < 15)
})

test("sortItems sorts a copy alphabetically or by usage and keeps manual order", () => {
  const items = [item("b", "left"), item("A", "left"), item("c", "left")]
  assert.deepEqual(M.sortItems(items, "alphabetical", {}).map(i => i.name), ["A", "b", "c"])
  assert.deepEqual(M.sortItems(items, "usage", { c: 3 }).map(i => i.name), ["c", "b", "A"])
  assert.deepEqual(M.sortItems(items, "manual", {}).map(i => i.name), ["b", "A", "c"])
  assert.equal(items[0].name, "b")
})

// ---------- scrubber ----------

test("the scrubber picks a weekday and a quarter hour and reads in Spanish", () => {
  const sat = E.scrubDate(NOW, 6, 23 * 60)
  assert.deepEqual([sat.getDay(), sat.getHours(), sat.getMinutes()], [6, 23, 0])
  assert.equal(E.scrubLabel(sat), "Ver a las 23:00 del sábado")
  assert.equal(E.scrubLabel(E.scrubDate(NOW, 3, 9 * 60 + 45)), "Ver a las 09:45 del miércoles")
  assert.equal(E.scrubLabel(E.scrubDate(NOW, 0, 0)), "Ver a las 00:00 del domingo")
})

// ---------- ordering ----------

test("dropPosition turns a visual drop slot into a 1-based position among the other chips", () => {
  assert.equal(E.dropPosition(["A", "B", "C"], "A", 2), 2)
  assert.equal(E.dropPosition(["A", "B", "C"], "C", 0), 1)
  assert.equal(E.dropPosition(["X"], "A", 1), 2)
  assert.equal(E.dropPosition([], "A", 0), 1)
})

test("moveStep moves up and down within the column and stops at the ends", () => {
  assert.deepEqual(E.moveStep(config(), "B", -1), { column: "left", position: 1 })
  assert.deepEqual(E.moveStep(config(), "B", 1), { column: "left", position: 3 })
  assert.equal(E.moveStep(config(), "A", -1), null)
  assert.equal(E.moveStep(config(), "C", 1), null)
  assert.equal(E.moveStep(config(), "Nope", 1), null)
})

// ---------- page bridge ----------

test("the page bridge hands queued messages to the next ZT.next(), in order", () => {
  const sent = []
  const bridge = E.createBridge(v => sent.push(JSON.parse(v)))
  const a = bridge.post({ type: "op", op: "sort", method: "usage" })
  const b = bridge.post({ type: "op", op: "train" })
  assert.equal(sent.length, 0)
  bridge.next()
  bridge.next()
  bridge.next()
  assert.deepEqual(sent.map(m => m.id), [a, b])
  assert.notEqual(a, b)
  bridge.post({ type: "op", op: "stopTrain" })
  assert.equal(sent[2].op, "stopTrain")
})

test("an idle ping answers a waiting ZT.next() only once", () => {
  const sent = []
  const bridge = E.createBridge(v => sent.push(JSON.parse(v)))
  bridge.idle()
  assert.equal(sent.length, 0)
  bridge.next()
  bridge.idle()
  bridge.idle()
  assert.deepEqual(sent, [{ type: "idle" }])
})

test("parseMessage accepts known messages and rejects unknown or malformed ones", () => {
  assert.equal(E.parseMessage('{"type":"op","op":"sort","method":"usage"}').ok, true)
  assert.equal(E.parseMessage({ type: "test", url: "a://" }).ok, true)
  for (const raw of ['{"type":"navigate"}', '{"type":"op","op":"wipe"}', "not json", "null", "[]", '"op"', null]) {
    const r = E.parseMessage(raw)
    assert.equal(r.ok, false, String(raw))
    assert.ok(r.error)
  }
})

// ---------- ops ----------

const op = (s, msg, now = NOW) => E.applyOp(s, { type: "op", ...msg }, now)

test("add places a new item and starts training", () => {
  const r = op(state(config(), { A: 4 }), { op: "add", item: { name: " New ", scheme: "new://", column: "left" }, position: 2 })
  assert.equal(r.ok, true)
  assert.deepEqual(names(r.state.config, "left"), ["A", "New", "B", "C"])
  assert.equal(M.isTraining(r.state.config, NOW), true)
  assert.deepEqual(r.state.stats, { A: 2 })
})

test("update, move, constraints and delete apply through the model", () => {
  let s = state(config(), { A: 3, B: 8 })
  s = op(s, { op: "update", name: "A", draft: { name: "Alpha", scheme: "alpha://" } }).state
  assert.equal(s.config.items[0].name, "Alpha")
  assert.equal(s.stats.Alpha, 1.5)
  s = op(s, { op: "move", name: "Alpha", column: "right", position: 1 }).state
  assert.deepEqual(names(s.config, "right"), ["Alpha", "X"])
  s = op(s, { op: "constraints", name: "Alpha", constraints: { startTime: "22:00", endTime: "06:00", startDay: 5, endDay: 1 } }).state
  assert.equal(M.describeConstraints(s.config.items.find(i => i.name === "Alpha")), "22:00–06:00 · V–L")
  s = op(s, { op: "constraints", name: "Alpha", constraints: null }).state
  assert.equal(M.describeConstraints(s.config.items.find(i => i.name === "Alpha")), "Siempre")
  const del = op(s, { op: "delete", name: "B" })
  assert.equal(del.deleted, "B")
  assert.deepEqual(names(del.state.config, "left"), ["C"])
  assert.equal(del.state.stats.B, undefined)
})

test("sort, train and stopTrain change settings without counting as edits", () => {
  const sorted = op(state(), { op: "sort", method: "alphabetical" })
  assert.equal(sorted.state.config.sortMethod, "alphabetical")
  assert.equal(M.isTraining(sorted.state.config, NOW), false)
  const trained = op(state(config(), { A: 10 }), { op: "train" })
  assert.equal(M.isTraining(trained.state.config, NOW), true)
  assert.deepEqual(trained.state.stats, { A: 5 })
  const stopped = op(trained.state, { op: "stopTrain" })
  assert.equal(M.isTraining(stopped.state.config, NOW), false)
  assert.deepEqual(stopped.state.stats, { A: 5 })
})

test("edits during a running training period extend it without halving again", () => {
  const trained = op(state(config(), { A: 10 }), { op: "train" }).state
  const later = new Date(NOW.getTime() + 3 * DAY)
  const r = op(trained, { op: "move", name: "A", column: "center" }, later)
  assert.deepEqual(r.state.stats, { A: 5 })
  assert.equal(new Date(r.state.config.training.until).getTime(), later.getTime() + 14 * DAY)
})

test("a move that changes nothing does not start training", () => {
  const r = op(state(), { op: "move", name: "B", column: "left", position: 2 })
  assert.equal(r.ok, true)
  assert.equal(M.isTraining(r.state.config, NOW), false)
})

test("invalid ops return an error and leave the state untouched", () => {
  const s = state(config(), { A: 1 })
  const before = JSON.stringify(s)
  for (const msg of [
    { op: "add", item: { name: "A", scheme: "a://", column: "left" } },
    { op: "add", item: { name: "N", scheme: "not a url", column: "left" } },
    { op: "add" },
    { op: "update", name: "A", draft: { name: "B", scheme: "a://" } },
    { op: "update", name: "A", draft: { name: "  ", scheme: "a://" } },
    { op: "delete", name: "Nope" },
    { op: "move", name: "A", column: "middle" },
    { op: "constraints", name: "A", constraints: { startDay: 1 } },
    { op: "constraints", name: "A", constraints: { startTime: "25:00" } },
    { op: "sort", method: "random" },
    { op: "undo" }
  ]) {
    const r = op(s, msg)
    assert.equal(r.ok, false, JSON.stringify(msg))
    assert.ok(r.error)
  }
  assert.equal(JSON.stringify(s), before)
})

test("model errors read in Spanish", () => {
  assert.match(op(state(), { op: "update", name: "A", draft: { name: "B", scheme: "a://" } }).error, /ya existe/)
  assert.match(op(state(), { op: "update", name: "A", draft: { name: "", scheme: "a://" } }).error, /nombre/i)
  assert.match(op(state(), { op: "update", name: "A", draft: { name: "A", scheme: "nope" } }).error, /URL/)
  assert.match(op(state(), { op: "constraints", name: "A", constraints: { startTime: "25:00" } }).error, /hora/i)
})

test("undo right after a delete restores the item, its place and its usage count", () => {
  const s = state(config(), { A: 1, B: 9 })
  const del = op(s, { op: "delete", name: "B" })
  const back = op(del.state, { op: "undo" })
  assert.equal(back.ok, true)
  assert.deepEqual(back.state.config, s.config)
  assert.deepEqual(back.state.stats, s.stats)
  assert.equal(op(back.state, { op: "undo" }).ok, false)
})

test("undo is only offered until the next change", () => {
  const del = op(state(), { op: "delete", name: "B" })
  const next = op(del.state, { op: "sort", method: "usage" })
  assert.equal(op(next.state, { op: "undo" }).ok, false)
})

test("buildState carries the training summary", () => {
  const s = E.buildState(config(), { A: 1 }, NOW)
  assert.deepEqual(s.training, { active: false, text: "Tamaños fijos" })
  assert.deepEqual(s.stats, { A: 1 })
  const t = op(state(), { op: "train" }).state
  assert.equal(E.buildState(t.config, t.stats, NOW).training.text, "Aprendiendo hasta el 16/10")
})

// ---------- page ----------

test("page errors are shown on screen instead of leaving a blank editor", () => {
  const html = E.buildHTML({ theme: {}, state: E.buildState(config([]), {}, NOW) })
  assert.match(html, /window\.onerror/)
  assert.match(html, /id="fatal"/)
})

test("themeTokens turns the active theme into CSS values", () => {
  const t = E.themeTokens({ bgColor: "112233", textColor: "#ffeedd", accentColor: "zzz", fontName: "DINAlternate-Bold", fontWeight: "semibold", minFontSize: 12, maxFontSize: 30 })
  assert.equal(t.bg, "#112233")
  assert.equal(t.text, "#FFEEDD")
  assert.equal(t.textRgb, "255, 238, 221")
  assert.equal(t.accent, "#0A84FF")
  assert.match(t.font, /^"DINAlternate-Bold", /)
  // DIN Alternate only has a bold face: the CSS shows that face, not a synthetic semibold
  assert.equal(t.weight, 700)
  assert.deepEqual([t.minSize, t.maxSize], [12, 30])
  assert.match(E.themeTokens({ fontName: "system" }).font, /-apple-system/)
})

test("the HTML injects theme tokens, state, catalog and the module's own functions", () => {
  const theme = { bgColor: "101010", textColor: "EEEEEE", accentColor: "FF9500", fontName: "system", fontWeight: "bold", minFontSize: 10, maxFontSize: 20 }
  const cfg = config([item("</script><b>", "left", 1)])
  const html = E.buildHTML({ theme, state: E.buildState(cfg, {}, NOW) })
  assert.match(html, /--bg: #101010/)
  assert.match(html, /--text: #EEEEEE/)
  assert.match(html, /--accent: #FF9500/)
  for (const fn of ["pillsToRange", "rangeToPills", "isScheduledAt", "usageFontSize", "sortItems", "describeConstraints", "search", "shortcutItem", "createBridge", "previewPoster", "posterLayout"]) {
    assert.ok(html.includes(`function ${fn}(`), fn)
  }
  assert.ok(html.includes("spotify://"))
  assert.ok(!html.includes("</script><b>"))
  assert.ok(!/<script[^>]+src=/.test(html))
  assert.ok(!/<link[^>]+href=/.test(html))
  assert.match(html, /lang="es"/)
})

test("the injected page script runs on its own and behaves like the module", () => {
  const ctx = vm.createContext({ Date, Math, JSON })
  vm.runInContext(E.pageScript(), ctx)
  const inPage = js => JSON.parse(vm.runInContext(`JSON.stringify(${js})`, ctx))
  assert.deepEqual(inPage(`pillsToRange(${JSON.stringify(pills("VSDL"))})`), E.pillsToRange(pills("VSDL")))
  assert.equal(vm.runInContext(`isScheduledAt({ startTime: "22:00", endTime: "06:00", startDay: 1, endDay: 5 }, new Date(2026, 9, 3, 1, 0))`, ctx), true)
  assert.equal(vm.runInContext(`describeConstraints({ startTime: "08:00", startDay: 1, endDay: 5 })`, ctx), "desde 08:00 · L–V")
  assert.equal(vm.runInContext(`search("fotos")[0].scheme`, ctx), "photos-redirect://")
  const cfg = config([item("A", "left", 1), item("R", "right", 1)])
  assert.deepEqual(inPage(`previewPoster(${JSON.stringify(cfg)}, { A: 3 }, new Date(${NOW.getTime()}), 10, 40)`),
    JSON.parse(JSON.stringify(E.previewPoster(cfg, { A: 3 }, NOW, 10, 40))))
  assert.equal(vm.runInContext(`scrubLabel(scrubDate(new Date(2026, 9, 2), 6, 1380))`, ctx), "Ver a las 23:00 del sábado")
})

test("the page app script parses", () => {
  const html = E.buildHTML({ theme: {}, state: E.buildState(config(), {}, NOW) })
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1])
  assert.ok(scripts.length > 0)
  for (const src of scripts) assert.doesNotThrow(() => new vm.Script(src))
})

test("themeTokens emits light and dark values and the HTML switches with prefers-color-scheme for an adaptive theme", () => {
  const theme = { bgColor: "000000", textColor: "FFFFFF", accentColor: "0A84FF", light: { bgColor: "FFFFFF", textColor: "111111" } }
  const t = E.themeTokens(theme)
  assert.equal(t.adaptive, true)
  assert.equal(t.light.bg, "#FFFFFF")
  assert.equal(t.dark.bg, "#000000")
  assert.equal(t.light.scheme, "light")
  assert.equal(t.dark.scheme, "dark")
  const html = E.buildHTML({ theme, state: E.buildState(config([]), {}, NOW) })
  assert.match(html, /@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{[^}]*--bg: #000000/)
  assert.match(html, /--bg: #FFFFFF/)
})

test("a forced appearance or a flat theme renders a single color set", () => {
  const theme = { bgColor: "000000", textColor: "FFFFFF", light: { bgColor: "FFFFFF", textColor: "111111" }, appearance: "light" }
  const t = E.themeTokens(theme)
  assert.equal(t.adaptive, false)
  assert.equal(t.bg, "#FFFFFF")
  const html = E.buildHTML({ theme, state: E.buildState(config([]), {}, NOW) })
  const vars = html.match(/<style id="theme-vars">([\s\S]*?)<\/style>/)[1]
  assert.ok(!vars.includes("prefers-color-scheme"))
  assert.equal(E.themeTokens({ bgColor: "FDF5E6" }).adaptive, false)
})

test("themeTokens picks readable text on the accent by contrast", () => {
  assert.equal(E.themeTokens({ accentColor: "FFE600" }).onAccent, "#000000")
  assert.equal(E.themeTokens({ accentColor: "0043CE" }).onAccent, "#FFFFFF")
})

test("themeTokens takes the font from fontSpec, so CSS shows the face the widget draws", () => {
  const t = E.themeTokens({ fontName: "Avenir Next", fontWeight: "semibold", fontItalic: true })
  assert.match(t.font, /^"AvenirNext-DemiBoldItalic"/)
  assert.equal(t.weight, 600)
  assert.equal(t.style, "italic")
  assert.deepEqual(E.themeTokens({ minFontSize: "30", maxFontSize: "12" }).minSize, 12)
})

// ---------- themes ----------

const T = rt.require("lib/theme")
const stored = (filename, raw, active = false) => ({ ...T.normalizeTheme(raw).theme, filename, active })
const NOIR = { name: "Noir", bgColor: "000000", textColor: "FFFFFF", accentColor: "0A84FF", light: { bgColor: "FFFFFF", textColor: "000000" } }
const ZEN = { name: "Zen", bgColor: "FDF5E6", textColor: "333333", accentColor: "B07D48", fontName: "Georgia" }
const themeState = (undo = null) => ({
  themes: [stored("noir.json", NOIR, true), stored("zen.json", ZEN)],
  active: { ...T.normalizeTheme(NOIR).theme, source: "noir.json" },
  undo
})
const themeOp = (s, msg) => E.applyThemeOp(s, { type: "op", ...msg })

test("parseMessage accepts every theme op", () => {
  for (const name of ["theme.apply", "theme.appearance", "theme.update", "theme.duplicate", "theme.delete", "theme.undoDelete"]) {
    assert.equal(E.parseMessage({ type: "op", op: name }).ok, true, name)
  }
  assert.equal(E.parseMessage({ type: "op", op: "theme.wipe" }).ok, false)
})

test("theme.apply activates a known theme file and refuses an unknown one", () => {
  assert.deepEqual(themeOp(themeState(), { op: "theme.apply", filename: "zen.json" }),
    { ok: true, effect: { kind: "apply", filename: "zen.json" }, undo: null })
  const missing = themeOp(themeState(), { op: "theme.apply", filename: "gone.json" })
  assert.equal(missing.ok, false)
  assert.match(missing.error, /ya no existe/)
})

test("theme.appearance rewrites the active theme's file with the new appearance", () => {
  const r = themeOp(themeState(), { op: "theme.appearance", appearance: "light" })
  assert.equal(r.ok, true)
  assert.equal(r.effect.kind, "update")
  assert.equal(r.effect.filename, "noir.json")
  assert.equal(r.effect.theme.appearance, "light")
  assert.deepEqual(r.effect.theme.light, NOIR.light)
  assert.ok(!("filename" in r.effect.theme) && !("active" in r.effect.theme) && !("source" in r.effect.theme))
  assert.equal(themeOp(themeState(), { op: "theme.appearance", appearance: "sepia" }).ok, false)
})

test("theme.appearance without an active file saves the active copy only", () => {
  const s = { themes: [], active: T.normalizeTheme(ZEN).theme, undo: null }
  const r = themeOp(s, { op: "theme.appearance", appearance: "dark" })
  assert.equal(r.effect.kind, "saveActive")
  assert.equal(r.effect.theme.appearance, "dark")
})

test("theme.update saves a valid draft normalized under the same file", () => {
  const draft = { ...ZEN, name: " Zen claro ", bgColor: "#ffffff", minFontSize: 12, maxFontSize: 30 }
  const r = themeOp(themeState(), { op: "theme.update", filename: "zen.json", theme: draft })
  assert.equal(r.ok, true)
  assert.equal(r.effect.kind, "update")
  assert.equal(r.effect.filename, "zen.json")
  assert.equal(r.effect.theme.name, "Zen claro")
  assert.equal(r.effect.theme.bgColor, "FFFFFF")
})

test("theme.update rejects an invalid draft with every field error and saves nothing", () => {
  const draft = { ...ZEN, name: "", light: { textColor: "nope" }, minFontSize: 40, maxFontSize: 20 }
  const r = themeOp(themeState(), { op: "theme.update", filename: "zen.json", theme: draft })
  assert.equal(r.ok, false)
  assert.equal(r.effect, undefined)
  assert.deepEqual(Object.keys(r.errors).sort(), ["light.textColor", "maxFontSize", "name"])
  assert.equal(r.field, "name")
  assert.equal(r.error, r.errors.name)
  assert.equal(themeOp(themeState(), { op: "theme.update", filename: "gone.json", theme: ZEN }).ok, false)
})

test("theme.duplicate copies a theme as «<Nombre> copia», numbering repeats", () => {
  const r = themeOp(themeState(), { op: "theme.duplicate", filename: "zen.json" })
  assert.equal(r.effect.kind, "create")
  assert.equal(r.effect.theme.name, "Zen copia")
  assert.equal(r.effect.theme.fontName, "Georgia")
  const s = themeState()
  s.themes.push(stored("zen-copia.json", { ...ZEN, name: "Zen copia" }))
  assert.equal(themeOp(s, { op: "theme.duplicate", filename: "zen.json" }).effect.theme.name, "Zen copia 2")
  assert.equal(E.copyName("Zen", ["Zen", "Zen copia", "zen COPIA 2"]), "Zen copia 3")
})

test("theme.duplicate without a filename copies the active theme", () => {
  const r = themeOp(themeState(), { op: "theme.duplicate" })
  assert.equal(r.effect.theme.name, "Noir copia")
  assert.deepEqual(r.effect.theme.light, NOIR.light)
})

test("theme.delete refuses the active theme", () => {
  const r = themeOp(themeState(), { op: "theme.delete", filename: "noir.json" })
  assert.equal(r.ok, false)
  assert.match(r.error, /activo/)
})

test("theme.delete removes another theme and theme.undoDelete restores it under its filename", () => {
  const del = themeOp(themeState(), { op: "theme.delete", filename: "zen.json" })
  assert.deepEqual(del.effect, { kind: "remove", filename: "zen.json" })
  assert.equal(del.deleted, "Zen")
  assert.equal(del.undo.filename, "zen.json")
  const s = themeState(del.undo)
  s.themes = s.themes.filter(t => t.filename !== "zen.json")
  const back = themeOp(s, { op: "theme.undoDelete" })
  assert.equal(back.ok, true)
  assert.equal(back.effect.kind, "update")
  assert.equal(back.effect.filename, "zen.json")
  assert.equal(back.effect.theme.name, "Zen")
  assert.equal(back.undo, null)
  assert.equal(themeOp(themeState(), { op: "theme.undoDelete" }).ok, false)
})

test("undoing a delete never overwrites a theme saved under the same filename since", () => {
  const del = themeOp(themeState(), { op: "theme.delete", filename: "zen.json" })
  const back = themeOp(themeState(del.undo), { op: "theme.undoDelete" })
  assert.equal(back.effect.kind, "create")
  assert.equal(back.effect.theme.name, "Zen")
})

test("buildState lists themes with swatches, the active theme and its page tokens", () => {
  const s = themeState()
  const out = E.buildState(config(), {}, NOW, { themes: s.themes, active: s.active })
  assert.deepEqual(out.themes.map(t => [t.filename, t.name, t.active]), [["noir.json", "Noir", true], ["zen.json", "Zen", false]])
  assert.ok(!("filename" in out.themes[0].theme))
  // Auto appearance: a theme with variants splits its swatch, a flat one doesn't
  assert.deepEqual(out.themes[0].swatch.split.light.bg, "#FFFFFF")
  assert.equal(out.themes[1].swatch.split, null)
  assert.equal(out.themes[1].swatch.bg, "#FDF5E6")
  assert.equal(out.activeTheme.source, "noir.json")
  assert.deepEqual(out.tokens, E.themeTokens(s.active))
  const plain = E.buildState(config(), {}, NOW)
  assert.deepEqual(plain.themes, [])
})

test("in a forced appearance every swatch shows that variant", () => {
  const s = themeState()
  s.active = { ...s.active, appearance: "light" }
  const out = E.buildState(config(), {}, NOW, { themes: s.themes, active: s.active })
  assert.equal(out.themes[0].swatch.split, null)
  assert.equal(out.themes[0].swatch.bg, "#FFFFFF")
  assert.equal(out.themes[0].swatch.text, "#000000")
})

// ---------- theme page helpers ----------

test("contrastBadge reads the ratio in Spanish and flags hard-to-read text", () => {
  assert.deepEqual(E.contrastBadge({ bgColor: "000000", textColor: "FFFFFF" }), { ratio: 21, ok: true, text: "Contraste 21:1" })
  const low = E.contrastBadge({ bgColor: "777777", textColor: "999999" })
  assert.equal(low.ok, false)
  assert.match(low.text, /^Contraste 1,\d:1 · Cuesta leerlo$/)
  assert.equal(E.contrastBadge({ bgColor: "FFFFFF", textColor: "767676" }).text, "Contraste 4,5:1")
})

test("fontOptions disables weights and italic a family lacks", () => {
  const din = E.fontOptions({ fontName: "din-alternate", fontWeight: "bold" })
  assert.deepEqual(din.weights.map(w => w.label), ["Fina", "Normal", "Media", "Negrita", "Black"])
  assert.deepEqual(din.weights.map(w => w.available), [false, false, false, true, false])
  assert.equal(din.weights[3].on, true)
  assert.equal(din.italic.available, false)

  const avenir = E.fontOptions({ fontName: "avenir-next", fontWeight: "regular" })
  assert.deepEqual(avenir.weights.map(w => w.available), [true, true, true, true, true])
  // Avenir's lightest face is UltraLight (200): Fina saves that weight
  assert.equal(avenir.weights[0].id, "thin")
  assert.equal(avenir.italic.available, true)

  const system = E.fontOptions({ fontName: "system", fontWeight: "bold" })
  assert.ok(system.weights.every(w => w.available))
  assert.equal(system.italic.available, true)
  // System italic only exists at regular weight
  const systemItalic = E.fontOptions({ fontName: "system", fontWeight: "bold", fontItalic: true })
  assert.deepEqual(systemItalic.weights.map(w => w.available), [false, true, false, false, false])
  assert.equal(systemItalic.italic.on, true)
  assert.equal(E.fontOptions({ fontName: "rounded" }).italic.available, false)
})

test("themeSwatch uses the theme's font and its colors for the appearance shown", () => {
  const sw = E.themeSwatch(ZEN, "auto")
  assert.deepEqual([sw.bg, sw.text, sw.accent], ["#FDF5E6", "#333333", "#B07D48"])
  assert.match(sw.font, /Georgia/)
  assert.equal(sw.split, null)
  const split = E.themeSwatch(NOIR, "auto").split
  assert.deepEqual([split.dark.bg, split.light.bg, split.light.text], ["#000000", "#FFFFFF", "#000000"])
  assert.equal(E.themeSwatch(NOIR, "dark").bg, "#000000")
})

test("sizeLabel names both sizes, or a fixed one when equal", () => {
  assert.equal(E.sizeLabel(10, 40), "Chico 10 ↔ Grande 40")
  assert.equal(E.sizeLabel(20, 20), "Tamaño fijo: 20")
})

test("setVariants adds light and dark blocks, starting the new one inverted, and removes them", () => {
  const on = E.setVariants(ZEN, true)
  assert.deepEqual(on.dark, { bgColor: "FDF5E6", textColor: "333333", accentColor: "B07D48" })
  assert.deepEqual(on.light, { bgColor: "333333", textColor: "FDF5E6", accentColor: "B07D48" })
  assert.equal(ZEN.light, undefined)
  const off = E.setVariants(NOIR, false, "light")
  assert.equal(off.light, undefined)
  assert.equal(off.dark, undefined)
  assert.deepEqual([off.bgColor, off.textColor], ["FFFFFF", "000000"])
})

test("setThemeColor edits the variant being shown, or the flat colors without variants", () => {
  const flat = E.setThemeColor(ZEN, "light", "bgColor", "#123456")
  assert.equal(flat.bgColor, "#123456")
  assert.equal(flat.light, undefined)
  const v = E.setThemeColor(NOIR, "light", "accentColor", "FF0000")
  assert.deepEqual(v.light, { bgColor: "FFFFFF", textColor: "000000", accentColor: "FF0000" })
  assert.equal(v.accentColor, "0A84FF")
  assert.equal(NOIR.light.accentColor, undefined)
})

test("the injected theme helpers behave like the module", () => {
  const ctx = vm.createContext({ Date, Math, JSON })
  vm.runInContext(E.pageScript(), ctx)
  const inPage = js => JSON.parse(vm.runInContext(`JSON.stringify(${js})`, ctx))
  assert.deepEqual(inPage(`contrastBadge({ bgColor: "FDF5E6", textColor: "333333" })`), E.contrastBadge({ bgColor: "FDF5E6", textColor: "333333" }))
  assert.deepEqual(inPage(`fontOptions({ fontName: "marker-felt", fontWeight: "bold" })`), E.fontOptions({ fontName: "marker-felt", fontWeight: "bold" }))
  assert.deepEqual(inPage(`themeSwatch(${JSON.stringify(NOIR)}, "auto")`), E.themeSwatch(NOIR, "auto"))
  assert.deepEqual(inPage(`setVariants(${JSON.stringify(ZEN)}, true)`), E.setVariants(ZEN, true))
  assert.equal(vm.runInContext(`sizeLabel(12, 12)`, ctx), "Tamaño fijo: 12")
  assert.deepEqual(inPage(`validateTheme({ name: "x", bgColor: "000000", textColor: "FFFFFF", minFontSize: 10, maxFontSize: 20, fontName: "system" })`), { ok: true, errors: {} })
})

test("the HTML has a Tema section between the preview and Orden, with the theme sheet", () => {
  const html = E.buildHTML({ theme: NOIR, state: E.buildState(config(), {}, NOW, { themes: themeState().themes, active: themeState().active }) })
  const body = html.slice(html.indexOf("<body>"))
  const tema = body.indexOf('id="tema"')
  assert.ok(tema > body.indexOf('id="scrub-time"'))
  assert.ok(tema < body.indexOf(">Orden<"))
  assert.match(html, /Tocá para aplicar\. Mantené presionado para editar\. Se aplica a ZenTrate, ZenLendar y ZenDigest\./)
  assert.ok(html.includes('id="theme-strip"'))
  assert.ok(html.includes('id="appearance"'))
  for (const copy of ["Editar tema", "Distinto en modo claro/oscuro", "Cursiva", "Duplicar", "Eliminar tema",
    "Lo que más usás se ve Grande; lo demás, Chico. Si los igualás, todo queda del mismo tamaño."]) {
    assert.ok(html.includes(copy), copy)
  }
  assert.ok(html.includes('<style id="theme-vars">'))
})

test("the page opens scrolled to Tema when asked", () => {
  const state = E.buildState(config(), {}, NOW)
  assert.match(E.buildHTML({ theme: {}, state, focus: "tema" }), /\{"focus":"tema"\}\)/)
  assert.match(E.buildHTML({ theme: {}, state }), /\{"focus":null\}\)/)
})
