const test = require("node:test")
const assert = require("node:assert/strict")
const { createRuntime, DOCS } = require("./harness")

// 2026-10-02 is a Friday
function dt(hour, minute = 0, day = 2) {
  return new Date(2026, 9, day, hour, minute, 0)
}

async function render(items, opts = {}) {
  const files = { "zentrate_config.json": { items, sortMethod: opts.sortMethod || "manual" } }
  if (opts.stats) files["zentrate_stats.json"] = opts.stats
  const rt = createRuntime({ now: opts.now || dt(12, 0), files, scriptName: "ZenTrate" })
  await rt.runScript("ZenTrate.js", { runsInWidget: true })
  return rt
}

async function tap(params, opts = {}) {
  const rt = createRuntime({ now: dt(12, 0), files: opts.files || {}, scriptName: "ZenTrate" })
  await rt.runScript("ZenTrate.js", { args: { queryParameters: params } })
  return rt
}

/** Drawn texts with their font, in reading order: by row, then left to right. */
function drawn(rt) {
  const image = rt.widget.backgroundImage
  if (!image) return []
  const out = []
  let font = null, align = null
  for (const op of image.ops) {
    if (op.op === "setFont") font = op.font
    if (op.op === "setTextAligned") align = op.align
    if (op.op === "drawTextInRect") out.push({ text: op.text, rect: op.rect, font, align, y: op.rect.y + op.rect.height / 2 })
  }
  const order = { left: 0, center: 1, right: 2 }
  return out.sort((a, b) => a.y - b.y || order[a.align] - order[b.align])
}

const names = rt => drawn(rt).map(d => d.text)

test("an overnight item is shown after midnight", async () => {
  const items = [{ name: "Sleep", column: "left", scheme: "x://", startTime: "22:00", endTime: "06:00" }]
  assert.deepEqual(names(await render(items, { now: dt(1, 30) })), ["Sleep"])
  assert.deepEqual(names(await render(items, { now: dt(23, 0) })), ["Sleep"])
  assert.deepEqual(names(await render(items, { now: dt(12, 0) })), [])
})

test("a Friday-night item stays visible in Saturday's early hours", async () => {
  const items = [{ name: "Party", column: "left", scheme: "x://", startTime: "22:00", endTime: "02:00", startDay: 5, endDay: 5 }]
  assert.deepEqual(names(await render(items, { now: dt(1, 0, 3) })), ["Party"])
})

test("a Fri-Mon item shows on the weekend", async () => {
  const items = [{ name: "Weekend", column: "left", scheme: "x://", startDay: 5, endDay: 1 }]
  assert.deepEqual(names(await render(items, { now: dt(12, 0, 4) })), ["Weekend"])
})

test("widget refreshes when the next item's window opens", async () => {
  const items = [
    { name: "Always", column: "left", scheme: "x://" },
    { name: "Night", column: "left", scheme: "x://", startTime: "22:00", endTime: "06:00" }
  ]
  const rt = await render(items, { now: dt(21, 58) })
  assert.equal(rt.widget.refreshAfterDate.getTime(), dt(22, 0).getTime())
})

test("widget refreshes when a visible item's window closes", async () => {
  const items = [{ name: "Work", column: "left", scheme: "x://", startTime: "09:00", endTime: "17:00" }]
  const rt = await render(items, { now: dt(16, 57) })
  assert.equal(rt.widget.refreshAfterDate.getTime(), dt(17, 0).getTime())
})

test("refresh is not pushed later than the default interval", async () => {
  const items = [{ name: "Work", column: "left", scheme: "x://", startTime: "09:00", endTime: "17:00" }]
  const rt = await render(items, { now: dt(12, 0) })
  assert.ok(rt.widget.refreshAfterDate <= dt(12, 5))
})

test("usage sort orders by tap count, ties keep config order", async () => {
  const items = ["A", "B", "C"].map(name => ({ name, column: "left", scheme: "x://" }))
  const rt = await render(items, { sortMethod: "usage", stats: { C: 5, A: 1, B: 1 } })
  assert.deepEqual(names(rt), ["C", "A", "B"])
})

test("font scale ignores stats of items no longer in the config", async () => {
  const items = [{ name: "Mail", column: "left", scheme: "x://" }]
  const rt = await render(items, { stats: { Mail: 10, Deleted: 500 } })
  const font = drawn(rt)[0].font
  assert.equal(font.size, 20, "the most-used remaining item gets the max font size")
})

test("a config without items renders an empty widget instead of crashing", async () => {
  const rt = createRuntime({ now: dt(12, 0), files: { "zentrate_config.json": { sortMethod: "alphabetical" } } })
  await rt.runScript("ZenTrate.js", { runsInWidget: true })
  assert.ok(rt.widget)
})

test("malformed items are skipped instead of crashing alphabetical sort", async () => {
  const rt = await render([null, { column: "left", scheme: "x://" }, { name: "B", column: "left", scheme: "x://" }], { sortMethod: "alphabetical" })
  assert.deepEqual(names(rt), ["B"])
})

// Scriptable hands args.queryParameters over already percent-decoded.
test("tap opens a URL that contains percent-escapes unchanged", async () => {
  const url = "shortcuts://run-shortcut?name=Create%20Reminder"
  const rt = await tap({ shortcut: "Create Reminder", originalUrl: url })
  assert.deepEqual(rt.openedUrls, [url])
})

test("tap on an item whose name contains % does not crash", async () => {
  const rt = await tap({ shortcut: "100% Focus", originalUrl: "focus://" })
  assert.deepEqual(rt.openedUrls, ["focus://"])
  const stats = JSON.parse(rt.files.get(`${DOCS}/zentrate_stats.json`))
  assert.equal(stats["100% Focus"], 1)
})

test("tap on an item with no URL looks one up instead of opening 'undefined'", async () => {
  const files = { "zentrate_config.json": { items: [{ name: "Weather", column: "left" }], sortMethod: "manual" } }
  const rt = await tap({ shortcut: "Weather" }, { files })
  assert.deepEqual(rt.openedUrls, ["weather://"])
})

const item = (name, column, scheme = "x://") => ({ name, column, scheme })

// ---------- Tap URLs ----------

/** The URL of the tap cell under a drawn item: the row containing its center, the column its alignment names. */
function tapUrl(rt, name) {
  const text = drawn(rt).find(d => d.text === name)
  let top = 0
  for (const child of rt.widget.children[0].children) {
    const height = child.type === "spacer" ? child.length : child.size.height
    if (child.type === "stack" && text.y >= top && text.y < top + height) {
      const cells = child.children
      const index = text.align === "left" ? 0 : text.align === "right" ? cells.length - 1 : 1
      return cells[index].url
    }
    top += height
  }
}

test("tapping an item opens its app directly", async () => {
  const rt = await render([item("Mail", "center", "message://")])
  assert.equal(tapUrl(rt, "Mail"), "message://")
})

test("percent-escapes are kept and raw spaces are escaped so the tap URL is valid", async () => {
  const escaped = "shortcuts://run-shortcut?name=Create%20Reminder"
  const spaced = "shortcuts://run-shortcut?name=Log Water"
  const rt = await render([item("Remind", "left", escaped), item("Water", "right", spaced)])
  assert.equal(tapUrl(rt, "Remind"), escaped)
  assert.equal(tapUrl(rt, "Water"), "shortcuts://run-shortcut?name=Log%20Water")
})

test("items without a URL still route through the script for the first-tap lookup", async () => {
  const rt = await render([
    { name: "Weather", column: "left" },
    item("Blank", "center", "about:blank"),
    item("Empty", "right", "  ")
  ])
  assert.equal(tapUrl(rt, "Weather"), "scriptable:///run?scriptName=ZenTrate&shortcut=Weather")
  assert.ok(tapUrl(rt, "Blank").startsWith("scriptable:///run?scriptName=ZenTrate&shortcut=Blank"))
  assert.ok(tapUrl(rt, "Empty").startsWith("scriptable:///run?scriptName=ZenTrate&shortcut=Empty"))
})

test("a first tap on a URL-less item saves the found URL so the next render opens it directly", async () => {
  const files = { "zentrate_config.json": { items: [{ name: "Weather", column: "left" }], sortMethod: "manual" } }
  const rt = await tap({ shortcut: "Weather" }, { files })
  assert.deepEqual(rt.openedUrls, ["weather://"])
  const saved = JSON.parse(rt.files.get(`${DOCS}/zentrate_config.json`))
  const next = await render(saved.items)
  assert.equal(tapUrl(next, "Weather"), "weather://")
})
