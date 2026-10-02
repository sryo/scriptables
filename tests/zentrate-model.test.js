const test = require("node:test")
const assert = require("node:assert/strict")
const { createRuntime } = require("./harness")

const M = createRuntime().require("config/zentrate")

const item = (name, column, position, extra = {}) =>
  ({ name, scheme: `${name.toLowerCase().replace(/\W/g, "")}://`, column, position, ...extra })

const config = (items = [
  item("A", "left", 1), item("B", "left", 2), item("C", "left", 3),
  item("X", "right", 1)
]) => ({ items, sortMethod: "manual" })

const names = (cfg, col) => M.columnItems(cfg, col).map(i => i.name)
const positions = (cfg, col) => M.columnItems(cfg, col).map(i => i.position)
const frozen = cfg => JSON.parse(JSON.stringify(cfg))

// ---------- columns ----------

test("COLUMNS lists the three widget columns in order", () => {
  assert.deepEqual([...M.COLUMNS], ["left", "center", "right"])
})

test("columnItems returns a column's items in array order", () => {
  assert.deepEqual(names(config(), "left"), ["A", "B", "C"])
  assert.deepEqual(names(config(), "center"), [])
})

test("placeInColumn inserts at a position, renumbers, and keeps array order matching positions", () => {
  const cfg = M.placeInColumn(config(), [item("N", "left")], 2)
  assert.deepEqual(names(cfg, "left"), ["A", "N", "B", "C"])
  assert.deepEqual(positions(cfg, "left"), [1, 2, 3, 4])
  assert.deepEqual(cfg.items.map(i => i.name), ["A", "N", "B", "C", "X"])
})

test("placeInColumn appends when no position is given and clamps out-of-range positions", () => {
  assert.deepEqual(names(M.placeInColumn(config(), [item("N", "left")]), "left"), ["A", "B", "C", "N"])
  assert.deepEqual(names(M.placeInColumn(config(), [item("N", "left")], 99), "left"), ["A", "B", "C", "N"])
  assert.deepEqual(names(M.placeInColumn(config(), [item("N", "left")], -3), "left"), ["N", "A", "B", "C"])
})

test("placeInColumn does not mutate its input", () => {
  const before = config()
  const copy = frozen(before)
  M.placeInColumn(before, [item("N", "left")], 1)
  assert.deepEqual(before, copy)
})

// ---------- validateItemDraft ----------

test("validateItemDraft trims, defaults a blank URL to about:blank, and validates new URLs", () => {
  assert.deepEqual(M.validateItemDraft(config(), { name: " N ", scheme: " n://x " }).item, { name: "N", scheme: "n://x" })
  assert.equal(M.validateItemDraft(config(), { name: "N", scheme: "" }).item.scheme, "about:blank")
  const bad = M.validateItemDraft(config(), { name: "N", scheme: "not a url" })
  assert.equal(bad.ok, false)
  assert.equal(bad.field, "scheme")
})

test("validateItemDraft requires a unique non-blank name", () => {
  const blank = M.validateItemDraft(config(), { name: "  ", scheme: "" })
  assert.deepEqual([blank.ok, blank.field], [false, "name"])
  const dup = M.validateItemDraft(config(), { name: "B", scheme: "" })
  assert.deepEqual([dup.ok, dup.field], [false, "name"])
  assert.equal(M.validateItemDraft(config(), { name: "A", scheme: "" }, { originalName: "A" }).ok, true)
})

test("validateItemDraft keeps an unchanged stored URL even if it would fail validation", () => {
  const legacy = "shortcuts://run-shortcut?name=My Shortcut"
  const r = M.validateItemDraft(config(), { name: "N", scheme: legacy }, { originalScheme: legacy })
  assert.equal(r.ok, true)
  assert.equal(r.item.scheme, legacy)
})

test("validateItemDraft never throws on junk input", () => {
  assert.equal(M.validateItemDraft(config(), {}).ok, false)
  assert.equal(M.validateItemDraft(config(), { name: 5, scheme: null }).ok, false)
})

// ---------- addItem ----------

test("addItem appends by default and inserts at a given position", () => {
  const end = M.addItem(config(), { name: "N", scheme: "n://", column: "left" })
  assert.equal(end.ok, true)
  assert.deepEqual(names(end.config, "left"), ["A", "B", "C", "N"])
  const first = M.addItem(config(), { name: "N", scheme: "n://", column: "left" }, 1)
  assert.deepEqual(names(first.config, "left"), ["N", "A", "B", "C"])
  assert.deepEqual(positions(first.config, "left"), [1, 2, 3, 4])
})

test("addItem rejects duplicates, bad URLs and unknown columns without changing the config", () => {
  const before = config()
  for (const draft of [
    { name: "A", scheme: "a://", column: "left" },
    { name: "N", scheme: "nope", column: "left" },
    { name: "N", scheme: "n://", column: "middle" }
  ]) {
    const r = M.addItem(before, draft)
    assert.equal(r.ok, false)
    assert.ok(r.error)
  }
  assert.deepEqual(before, config())
})

// ---------- updateItem ----------

test("updateItem renames, moves the usage count, and keeps other fields", () => {
  const cfg = config([item("A", "left", 1, { startTime: "08:00" })])
  const r = M.updateItem(cfg, { A: 4, Z: 1 }, "A", { name: "Alpha", scheme: "alpha://" })
  assert.equal(r.ok, true)
  assert.deepEqual(r.config.items, [{ name: "Alpha", scheme: "alpha://", column: "left", position: 1, startTime: "08:00" }])
  assert.deepEqual(r.stats, { Alpha: 4, Z: 1 })
  assert.equal(cfg.items[0].name, "A")
})

test("updateItem reports a missing item and rejects a rename onto another item", () => {
  assert.equal(M.updateItem(config(), {}, "Nope", { name: "N", scheme: "" }).ok, false)
  const r = M.updateItem(config(), {}, "A", { name: "B", scheme: "a://" })
  assert.deepEqual([r.ok, r.field], [false, "name"])
})

test("updateItem does not re-validate an unchanged stored URL", () => {
  const legacy = "shortcuts://run-shortcut?name=My Shortcut"
  const r = M.updateItem(config([item("Old", "left", 1, { scheme: legacy })]), {}, "Old", { name: "New", scheme: legacy })
  assert.equal(r.ok, true)
  assert.equal(r.config.items[0].scheme, legacy)
})

// ---------- deleteItem ----------

test("deleteItem removes the item and its usage count and renumbers the column", () => {
  const r = M.deleteItem(config(), { A: 1, B: 9 }, "B")
  assert.equal(r.ok, true)
  assert.deepEqual(names(r.config, "left"), ["A", "C"])
  assert.deepEqual(positions(r.config, "left"), [1, 2])
  assert.deepEqual(r.stats, { A: 1 })
  assert.equal(M.deleteItem(config(), {}, "Nope").ok, false)
})

// ---------- moveItems ----------

test("moving to another column without a position appends to the end", () => {
  const r = M.moveItems(config(), ["C"], "right")
  assert.equal(r.ok, true)
  assert.deepEqual(names(r.config, "right"), ["X", "C"])
  assert.deepEqual(positions(r.config, "right"), [1, 2])
  assert.deepEqual(positions(r.config, "left"), [1, 2])
})

test("moving to another column at a position inserts there", () => {
  const r = M.moveItems(config(), ["C"], "right", 1)
  assert.deepEqual(names(r.config, "right"), ["C", "X"])
})

test("repositioning within a column lands at the requested position", () => {
  assert.deepEqual(names(M.moveItems(config(), ["C"], "left", 1).config, "left"), ["C", "A", "B"])
  assert.deepEqual(names(M.moveItems(config(), ["A"], "left", 2).config, "left"), ["B", "A", "C"])
  assert.deepEqual(names(M.moveItems(config(), ["B"], "left").config, "left"), ["A", "B", "C"])
})

test("moving several items keeps their relative order", () => {
  const r = M.moveItems(config(), ["A", "C"], "right")
  assert.deepEqual(names(r.config, "right"), ["X", "A", "C"])
  assert.deepEqual(names(r.config, "left"), ["B"])
})

test("moveItems rejects unknown columns and missing items", () => {
  assert.equal(M.moveItems(config(), ["A"], "middle").ok, false)
  assert.equal(M.moveItems(config(), ["Nope"], "right").ok, false)
  assert.equal(M.moveItems(config(), [], "right").ok, false)
})

test("items in an unknown or missing column survive moves of other items", () => {
  const cfg = config([item("A", "left", 1), item("Odd", "top", 1), { name: "Loose", scheme: "l://" }])
  const r = M.moveItems(cfg, ["A"], "right")
  const odd = r.config.items.find(i => i.name === "Odd")
  const loose = r.config.items.find(i => i.name === "Loose")
  assert.equal(odd.column, "top")
  assert.ok(loose)
  assert.equal(loose.column, undefined)
  assert.equal(r.config.items.length, 3)
})

// ---------- constraints ----------

test("parseConstraints normalizes times and days and treats blanks as unset", () => {
  const r = M.parseConstraints({ startTime: "9", endTime: "17:30", startDay: "1", endDay: 5 })
  assert.deepEqual(r, { ok: true, constraints: { startTime: "09:00", endTime: "17:30", startDay: 1, endDay: 5 } })
  assert.deepEqual(M.parseConstraints({ startTime: "", endTime: " " }).constraints, {})
  assert.deepEqual(M.parseConstraints({}).constraints, {})
})

test("parseConstraints accepts overnight windows and wrapping day ranges", () => {
  const r = M.parseConstraints({ startTime: "22:00", endTime: "06:00", startDay: "5", endDay: "1" })
  assert.equal(r.ok, true)
  assert.deepEqual(r.constraints, { startTime: "22:00", endTime: "06:00", startDay: 5, endDay: 1 })
})

test("parseConstraints reports the offending field instead of throwing", () => {
  assert.deepEqual(pick(M.parseConstraints({ endTime: "25:00" })), [false, "endTime"])
  assert.deepEqual(pick(M.parseConstraints({ startDay: "9", endDay: "1" })), [false, "startDay"])
  assert.deepEqual(pick(M.parseConstraints({ startTime: 7 })), [true, undefined])
})

test("parseConstraints requires both days or neither", () => {
  assert.equal(M.parseConstraints({ startDay: "1" }).ok, false)
  assert.equal(M.parseConstraints({ endDay: "5" }).ok, false)
})

function pick(r) { return [r.ok, r.field] }

test("setConstraints replaces constraints and null clears them", () => {
  const cfg = config([item("A", "left", 1, { startTime: "08:00", startDay: 1, endDay: 5 })])
  const set = M.setConstraints(cfg, "A", { endTime: "12" })
  assert.equal(set.ok, true)
  assert.deepEqual(set.config.items[0], { ...item("A", "left", 1), endTime: "12:00" })
  const cleared = M.setConstraints(cfg, "A", null)
  assert.deepEqual(cleared.config.items[0], item("A", "left", 1))
  assert.equal(cfg.items[0].startTime, "08:00")
})

test("setConstraints rejects invalid constraints and missing items", () => {
  assert.equal(M.setConstraints(config(), "A", { startTime: "nope" }).ok, false)
  assert.equal(M.setConstraints(config(), "Nope", null).ok, false)
})

test("describeConstraints summarizes a schedule in Spanish", () => {
  assert.equal(M.describeConstraints({ startTime: "22:00", endTime: "06:00", startDay: 1, endDay: 5 }), "22:00–06:00 · L–V")
  assert.equal(M.describeConstraints({ startTime: "08:00" }), "desde 08:00")
  assert.equal(M.describeConstraints({ endTime: "12:00" }), "hasta 12:00")
  assert.equal(M.describeConstraints({ startDay: 6, endDay: 0 }), "S–D")
  assert.equal(M.describeConstraints({ startDay: 3, endDay: 3 }), "X")
  assert.equal(M.describeConstraints({}), "Siempre")
  assert.equal(M.describeConstraints({ startDay: 1 }), "Siempre")
})

// ---------- sort ----------

test("setSortMethod accepts known methods only", () => {
  const r = M.setSortMethod(config(), "usage")
  assert.deepEqual([r.ok, r.config.sortMethod], [true, "usage"])
  assert.equal(M.setSortMethod(config(), "random").ok, false)
  assert.deepEqual([...M.SORT_METHODS], ["manual", "alphabetical", "usage"])
})

// ---------- Siri ----------

test("parseSiriQuery routes shortcuts right and apps left", () => {
  assert.deepEqual(M.parseSiriQuery("shortcut Leer QR"), { kind: "shortcut", name: "Leer QR", column: "right" })
  assert.deepEqual(M.parseSiriQuery("Atajo  Foo"), { kind: "shortcut", name: "Foo", column: "right" })
  assert.deepEqual(M.parseSiriQuery(" Spotify "), { kind: "app", query: "Spotify", column: "left" })
  assert.equal(M.parseSiriQuery("  "), null)
  assert.equal(M.parseSiriQuery(null), null)
})
