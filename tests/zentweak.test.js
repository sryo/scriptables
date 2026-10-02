const test = require("node:test")
const assert = require("node:assert/strict")
const { createRuntime } = require("./harness")

const NOW = new Date(2026, 9, 2, 10, 14, 0)
const CONFIG = "/docs/zentrate_config.json"
const STATS = "/docs/zentrate_stats.json"

const item = (name, column, position, extra = {}) =>
  ({ name, scheme: `${name.toLowerCase().replace(/\W/g, "")}://`, column, position, ...extra })

const ITEMS = [
  item("A", "left", 1), item("B", "left", 2), item("C", "left", 3),
  item("X", "right", 1)
]

/** Alert response that fills text fields (by index) before tapping `index`. */
const fill = (index, values = {}) => alert => {
  for (const [i, v] of Object.entries(values)) alert.fields[i].value = v
  return index
}

async function tweak(query, responses, opts = {}) {
  const rt = createRuntime({
    now: NOW,
    files: { "zentrate_config.json": { items: opts.items || ITEMS, sortMethod: "manual" }, ...(opts.files || {}) },
    alertResponses: responses
  })
  await rt.runScript("ZenTweak.js", { runsInApp: true, args: { queryParameters: query } })
  return rt
}

const saved = rt => JSON.parse(rt.files.get(CONFIG))
const column = (rt, col) => saved(rt).items.filter(i => i.column === col)
const names = (rt, col) => column(rt, col).map(i => i.name)
const titles = rt => rt.alerts.map(a => a.title)

// ---------- editItem: Save ----------

test("renaming an item to another item's name is rejected", async () => {
  const rt = await tweak({ action: "editItem", itemName: "A" }, [fill(0, { 0: "B" })])
  assert.deepEqual(names(rt, "left"), ["A", "B", "C"])
  assert.ok(titles(rt).includes("Error"))
})

test("renaming carries the usage count over to the new name", async () => {
  const rt = await tweak({ action: "editItem", itemName: "A" }, [fill(0, { 0: "Alpha" })],
    { files: { "zentrate_stats.json": { A: 7, B: 2 } } })
  assert.deepEqual(names(rt, "left"), ["Alpha", "B", "C"])
  assert.deepEqual(JSON.parse(rt.files.get(STATS)), { Alpha: 7, B: 2 })
})

test("saving without renaming does not trip the duplicate check", async () => {
  const rt = await tweak({ action: "editItem", itemName: "A" }, [fill(0, { 1: "alpha://open" })])
  assert.equal(column(rt, "left")[0].scheme, "alpha://open")
  assert.ok(!titles(rt).includes("Error"))
})

test("clearing the name does not silently drop the item", async () => {
  const rt = await tweak({ action: "editItem", itemName: "A" }, [fill(0, { 0: "   " })])
  assert.deepEqual(names(rt, "left"), ["A", "B", "C"])
  assert.ok(titles(rt).includes("Error"))
})

test("clearing the URL keeps the item and marks it for lookup on tap", async () => {
  const rt = await tweak({ action: "editItem", itemName: "A" }, [fill(0, { 1: "" })])
  assert.deepEqual(names(rt, "left"), ["A", "B", "C"])
  assert.equal(column(rt, "left")[0].scheme, "about:blank")
})

test("an unopenable URL is rejected on edit", async () => {
  const rt = await tweak({ action: "editItem", itemName: "A" }, [fill(0, { 1: "spotify" })])
  assert.equal(column(rt, "left")[0].scheme, "a://")
  assert.ok(titles(rt).includes("Error"))
})

test("names are trimmed on edit", async () => {
  const rt = await tweak({ action: "editItem", itemName: "A" }, [fill(0, { 0: "  Alpha " })])
  assert.deepEqual(names(rt, "left"), ["Alpha", "B", "C"])
})

test("an item name containing % can be opened for editing", async () => {
  const items = [item("50% Off", "left", 1, { scheme: "deals://" })]
  const rt = await tweak({ action: "editItem", itemName: "50% Off" }, [fill(0, { 0: "Half Off" })], { items })
  assert.deepEqual(names(rt, "left"), ["Half Off"])
})

test("cancelling the edit alert changes nothing", async () => {
  const rt = await tweak({ action: "editItem", itemName: "A" }, [-1], { files: {} })
  assert.deepEqual(saved(rt).items, ITEMS)
})

// ---------- editItem: time constraints ----------

test("valid time constraints are saved", async () => {
  const rt = await tweak({ action: "editItem", itemName: "A" }, [
    1, fill(0, { 0: "9", 1: "17:30", 2: "1", 3: "5" })
  ])
  const a = column(rt, "left")[0]
  assert.deepEqual([a.startTime, a.endTime, a.startDay, a.endDay], ["09:00", "17:30", 1, 5])
})

test("a partially invalid constraint form saves nothing when the retry is cancelled", async () => {
  const items = [item("A", "left", 1, { startTime: "08:00", endTime: "12:00" })]
  const rt = await tweak({ action: "editItem", itemName: "A" }, [
    1, fill(0, { 0: "09:00", 1: "25:00" }), 0, -1
  ], { items })
  const a = column(rt, "left")[0]
  assert.equal(a.startTime, "08:00")
  assert.equal(a.endTime, "12:00")
  assert.ok(titles(rt).includes("Validation Error"))
})

test("a day range with only one end set is rejected, since the widget would ignore it", async () => {
  for (const days of [{ 2: "1" }, { 3: "5" }]) {
    const rt = await tweak({ action: "editItem", itemName: "A" }, [1, fill(0, days), 0, -1])
    const a = column(rt, "left")[0]
    assert.deepEqual([a.startDay, a.endDay], [undefined, undefined])
    assert.ok(titles(rt).includes("Validation Error"))
  }
})

test("overnight time windows and wrapping day ranges are accepted", async () => {
  const rt = await tweak({ action: "editItem", itemName: "A" }, [
    1, fill(0, { 0: "22:00", 1: "06:00", 2: "5", 3: "1" })
  ])
  const a = column(rt, "left")[0]
  assert.deepEqual([a.startTime, a.endTime, a.startDay, a.endDay], ["22:00", "06:00", 5, 1])
  assert.ok(!titles(rt).includes("Validation Error"))
})

test("cancelling the constraint form keeps existing constraints", async () => {
  const items = [item("A", "left", 1, { startTime: "08:00", startDay: 1, endDay: 5 })]
  const rt = await tweak({ action: "editItem", itemName: "A" }, [1, -1], { items })
  const a = column(rt, "left")[0]
  assert.deepEqual([a.startTime, a.startDay, a.endDay], ["08:00", 1, 5])
})

// ---------- moving ----------

test("moving an item to another column from the edit menu sticks", async () => {
  const rt = await tweak({ action: "editItem", itemName: "B" }, [2, fill(0, { 0: "1" })])
  assert.deepEqual(names(rt, "left"), ["A", "C"])
  assert.deepEqual(names(rt, "center"), ["B"])
  assert.equal(saved(rt).items.length, 4)
})

test("moving an item up within its column lands at the requested position", async () => {
  const rt = await tweak({ action: "editItem", itemName: "C" }, [2, fill(2, { 0: "1" })])
  assert.deepEqual(names(rt, "left"), ["C", "A", "B"])
  assert.deepEqual(column(rt, "left").map(i => i.position), [1, 2, 3])
})

test("moving an item down within its column lands at the requested position", async () => {
  const rt = await tweak({ action: "editItem", itemName: "A" }, [2, fill(2, { 0: "2" })])
  assert.deepEqual(names(rt, "left"), ["B", "A", "C"])
})

test("moving to a position past the end puts the item last", async () => {
  const rt = await tweak({ action: "editItem", itemName: "A" }, [2, fill(1, { 0: "9" })])
  assert.deepEqual(names(rt, "right"), ["X", "A"])
  assert.deepEqual(column(rt, "right").map(i => i.position), [1, 2])
})

test("Move All moves every item of the column without duplicating", async () => {
  const rt = await tweak({ action: "moveItems", fromColumn: "left" }, [fill(1, { 0: "1" })])
  assert.deepEqual(names(rt, "left"), [])
  assert.deepEqual(names(rt, "right"), ["A", "B", "C", "X"])
  assert.equal(saved(rt).items.length, 4)
})

test("cancelling a move changes nothing", async () => {
  const rt = await tweak({ action: "editItem", itemName: "B" }, [2, -1])
  assert.deepEqual(names(rt, "left"), ["A", "B", "C"])
  assert.equal(saved(rt).items.length, 4)
})

// ---------- delete ----------

test("deleting removes only that item", async () => {
  const rt = await tweak({ action: "editItem", itemName: "B" }, [3])
  assert.deepEqual(names(rt, "left"), ["A", "C"])
  assert.deepEqual(names(rt, "right"), ["X"])
})

test("deleting an item drops its usage count so a new item with that name starts fresh", async () => {
  const rt = await tweak({ action: "editItem", itemName: "B" }, [3], {
    files: { "zentrate_stats.json": { A: 2, B: 40 } }
  })
  assert.deepEqual(JSON.parse(rt.files.get(STATS)), { A: 2 })
})

// ---------- addItem ----------

test("a new item added at position 1 goes first in its column", async () => {
  const rt = await tweak({ action: "addItem", column: "left" }, [
    fill(3, { 0: "New" }), fill(0, { 1: "new://", 2: "1" })
  ])
  assert.deepEqual(names(rt, "left"), ["New", "A", "B", "C"])
  assert.deepEqual(column(rt, "left").map(i => i.position), [1, 2, 3, 4])
})

test("adding at an occupied position shifts the rest instead of duplicating positions", async () => {
  const rt = await tweak({ action: "addItem", column: "left" }, [
    fill(3, { 0: "New" }), fill(0, { 1: "new://", 2: "2" })
  ])
  assert.deepEqual(names(rt, "left"), ["A", "New", "B", "C"])
  assert.deepEqual(column(rt, "left").map(i => i.position), [1, 2, 3, 4])
})

test("a new item added with the default position goes last", async () => {
  const rt = await tweak({ action: "addItem", column: "left" }, [
    fill(3, { 0: "New" }), fill(0, { 1: "new://" })
  ])
  assert.deepEqual(names(rt, "left"), ["A", "B", "C", "New"])
})

test("an unopenable URL is rejected when adding", async () => {
  const rt = await tweak({ action: "addItem", column: "left" }, [
    fill(3, { 0: "New" }), fill(0, { 1: "not a url" })
  ])
  assert.deepEqual(names(rt, "left"), ["A", "B", "C"])
  assert.ok(titles(rt).includes("Error"))
})

test("cancelling the add alert changes nothing", async () => {
  const rt = await tweak({ action: "addItem", column: "left" }, [-1])
  assert.deepEqual(saved(rt).items, ITEMS)
})

test("renaming keeps a stored URL the validator would reject if typed fresh", async () => {
  const legacy = { name: "Old", column: "left", position: 1, scheme: "shortcuts://run-shortcut?name=My Shortcut" }
  const rt = await tweak({ action: "editItem", itemName: "Old" }, [fill(0, { 0: "New" })], { items: [legacy] })
  assert.deepEqual(saved(rt).items.map(i => [i.name, i.scheme]), [["New", legacy.scheme]])
})
