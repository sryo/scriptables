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
  assert.equal(t.weight, 600)
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
