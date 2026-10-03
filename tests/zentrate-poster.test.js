const test = require("node:test")
const assert = require("node:assert/strict")
const { createRuntime } = require("./harness")

const M = createRuntime().require("config/zentrate")

const item = (name, column, scheme = "x://") => ({ name, column, scheme })
const MEDIUM = { width: 364, height: 170, padding: { h: 16, v: 8 }, minSize: 10, maxSize: 20 }

function layout(items, stats = {}, opts = {}) {
  return M.posterLayout(items, { ...MEDIUM, stats, ...opts })
}

const entry = (result, name) => result.entries.find(e => e.name === name)
const center = rect => rect.y + rect.h / 2
const close = (actual, expected, message) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, message || `${actual} ≈ ${expected}`)

// ---------- posterLayout ----------

test("rows pair columns by index; each row is as tall as its biggest name and the block is centered", () => {
  const items = [item("L1", "left"), item("L2", "left"), item("L3", "left"), item("R1", "right")]
  const big = layout(items, { L1: 1000, R1: 1 })
  assert.equal(big.rows, 3)
  // Each name gets breathing room that shrinks as it grows: (max - size) / 3
  assert.deepEqual(big.rowHeights, [20 * 1.2, 10 * 1.2 + 10 / 3, 10 * 1.2 + 10 / 3])
  const used = big.rowHeights.reduce((a, b) => a + b, 0)
  close(big.rowTops[0], (170 - used) / 2, "block is vertically centered")
  close(big.rowTops[1], big.rowTops[0] + big.rowHeights[0])
  assert.equal(entry(big, "L1").row, 0)
  assert.equal(entry(big, "R1").row, 0)
  assert.equal(entry(big, "L3").row, 2)
  for (const name of ["L1", "L2", "L3", "R1"]) {
    const e = entry(big, name)
    close(center(e.textRect), big.rowTops[e.row] + big.rowHeights[e.row] / 2, `${name} is centered on its row`)
  }
})

test("few small items stay close together instead of spreading over a large widget", () => {
  const result = layout([item("A", "left"), item("B", "left")], {}, { height: 382, maxSize: 40 })
  assert.deepEqual(result.rowHeights, [22, 22])
})

test("rows that don't fit are squeezed, big rows first, never below the smallest name", () => {
  const items = Array.from({ length: 8 }, (_, i) => item(`L${i}`, "left"))
  const result = layout(items, { L0: 1000, L1: 900 }, { maxSize: 40 })
  const total = result.rowHeights.reduce((a, b) => a + b, 0)
  close(total, 170 - 16)
  result.rowHeights.forEach(h => assert.ok(h >= 12 - 1e-9))
  assert.ok(result.rowHeights[0] > result.rowHeights[7])
})

test("without center items each row has two tap zones, with them three", () => {
  const two = layout([item("L", "left"), item("R", "right")])
  assert.deepEqual(two.columns, ["left", "right"])
  assert.deepEqual(entry(two, "L").tapRect, { x: 0, y: (170 - 12 - 10 / 3) / 2, w: 182, h: 12 + 10 / 3 })
  assert.deepEqual(entry(two, "R").tapRect, { x: 182, y: (170 - 12 - 10 / 3) / 2, w: 182, h: 12 + 10 / 3 })

  const three = layout([item("L", "left"), item("C", "center"), item("R", "right")], {}, { width: 360 })
  assert.deepEqual(three.columns, ["left", "center", "right"])
  assert.deepEqual([entry(three, "L"), entry(three, "C"), entry(three, "R")].map(e => [e.tapRect.x, e.tapRect.w]),
    [[0, 120], [120, 120], [240, 120]])
})

test("text spans the full content width, aligned like its column, so it never wraps or shrinks", () => {
  const result = layout([item("L", "left"), item("C", "center"), item("R", "right")], { C: 50 })
  for (const [name, align] of [["L", "left"], ["C", "center"], ["R", "right"]]) {
    const e = entry(result, name)
    assert.equal(e.align, align)
    assert.equal(e.textRect.x, 16)
    assert.equal(e.textRect.w, 364 - 32)
    assert.equal(e.textRect.h, e.fontSize * 1.25)
  }
})

test("font sizes follow usage, scaled to the highest count", () => {
  const result = layout([item("A", "left"), item("B", "left")], { A: 100, B: 0 })
  assert.equal(entry(result, "A").fontSize, 20)
  assert.equal(entry(result, "B").fontSize, 10)
  const capped = layout([item("A", "left")], { A: 100 }, { maxUsage: 10000 })
  assert.equal(entry(capped, "A").fontSize, M.usageFontSize(100, 10000, 10, 20))
})

test("the biggest item is drawn first, underneath the rest", () => {
  const result = layout([item("A", "left"), item("B", "left"), item("C", "right")], { A: 1, B: 1000, C: 300 })
  assert.equal(result.entries[0].name, "B")
  const sizes = result.entries.map(e => e.fontSize)
  assert.deepEqual(sizes, [...sizes].sort((a, b) => b - a))
})

test("no item paints a backdrop: names are drawn straight onto the widget", () => {
  const result = layout([item("Big", "left"), item("Mail", "left"), item("Go", "right")], { Big: 1000 })
  result.entries.forEach(e => assert.equal(e.knockoutRect, undefined))
})

test("a 40pt item overflows its row in an 8-row widget: overlap is allowed", () => {
  const items = Array.from({ length: 8 }, (_, i) => item(`L${i}`, "left"))
  const result = layout(items, { L0: 1000 }, { maxSize: 40 })
  const big = entry(result, "L0")
  assert.equal(big.fontSize, 40)
  assert.ok(big.textRect.h > result.rowHeights[0])
  assert.equal(big.textRect.w, 364 - 32)
})

test("items in an unknown column are left out", () => {
  const result = layout([item("L", "left"), item("X", "top")])
  assert.deepEqual(result.entries.map(e => e.name), ["L"])
})

test("no items lay out no rows", () => {
  const result = layout([])
  assert.equal(result.rows, 0)
  assert.deepEqual(result.entries, [])
})

// ---------- ZenTrate render ----------

async function render(items, opts = {}) {
  const files = { "zentrate_config.json": { items, sortMethod: opts.sortMethod || "manual", ...opts.config } }
  if (opts.stats) files["zentrate_stats.json"] = opts.stats
  const rt = createRuntime({ now: opts.now || new Date(2026, 9, 2, 12, 0), files, scriptName: "ZenTrate", screenSize: opts.screenSize })
  await rt.runScript("ZenTrate.js", { runsInWidget: !opts.inApp, runsInApp: !!opts.inApp, config: { widgetFamily: opts.family || "medium" } })
  return rt
}

/** Each drawn text with the font and alignment in effect when it was drawn. */
function drawn(rt) {
  const out = []
  let font = null, align = null
  for (const op of rt.widget.backgroundImage.ops) {
    if (op.op === "setFont") font = op.font
    if (op.op === "setTextAligned") align = op.align
    if (op.op === "drawTextInRect") out.push({ text: op.text, rect: op.rect, font, align })
  }
  return out
}

const overlay = rt => rt.widget.children[0]
const rowsOf = rt => overlay(rt).children.filter(c => c.type === "stack")
const cellUrls = rt => rowsOf(rt).map(row => row.children.map(cell => cell.url))

test("ZenTrate draws its text into the background image on a transparent canvas", async () => {
  const rt = await render([item("Mail", "left")])
  const image = rt.widget.backgroundImage
  assert.equal(image.type, "image")
  assert.deepEqual(image.size, { width: 338, height: 158 })
  assert.equal(image.respectScreenScale, true)
  assert.equal(image.opaque, false)
  assert.ok(rt.widget.backgroundColor, "the widget keeps its background color")
  assert.deepEqual(drawn(rt).map(d => d.text), ["Mail"])
  assert.ok(image.ops.some(op => op.op === "setTextColor"))
})

test("every visible item is drawn at its usage font size, not shrunk", async () => {
  const items = [item("Whatsapp", "left"), item("Mail", "left"), item("Buscar", "right")]
  const stats = { Whatsapp: 3000, Mail: 2, Buscar: 1 }
  const rt = await render(items, { stats })
  const byName = Object.fromEntries(drawn(rt).map(d => [d.text, d]))
  assert.deepEqual(Object.keys(byName).sort(), ["Buscar", "Mail", "Whatsapp"])
  for (const name of Object.keys(byName)) {
    assert.equal(byName[name].font.size, M.usageFontSize(stats[name], 3000, 10, 20))
  }
  assert.equal(drawn(rt)[0].text, "Whatsapp", "biggest drawn first")
  assert.equal(byName.Whatsapp.align, "left")
  assert.equal(byName.Buscar.align, "right")
  assert.equal(byName.Whatsapp.rect.width, 338 - 32)
})

// Any visible fill shows up as a box when iOS tints or clears the widget background
test("the drawn image paints no fills and tap cells only fully transparent ones", async () => {
  const rt = await render([item("Big", "left"), item("Small", "right")], { stats: { Big: 1000 } })
  assert.equal(rt.widget.backgroundImage.ops.filter(op => op.op === "fillRect").length, 0)
  for (const row of rowsOf(rt)) {
    for (const cell of row.children.filter(c => c.url)) {
      const image = cell.children.find(c => c.type === "image").image
      assert.ok(image, "the blank image exists")
      for (const op of image.ops.filter(op => op.op === "setFillColor")) assert.equal(op.color.alpha, 0)
      assert.equal(cell.backgroundColor ?? null, null)
    }
  }
})

test("tap cells tile the whole widget and hold each item's URL at its row and column", async () => {
  const rt = await render([
    item("L1", "left", "l1://"), item("L2", "left", "l2://"),
    item("C1", "center", "c1://"),
    item("R1", "right", "r1://"), item("R2", "right", "r2://")
  ])
  assert.deepEqual(rt.widget.padding, [0, 0, 0, 0])
  assert.equal(rt.widget.spacing, 0)
  assert.deepEqual(cellUrls(rt), [["l1://", "c1://", "r1://"], ["l2://", null, "r2://"]])

  const children = overlay(rt).children
  const heights = children.map(c => c.type === "spacer" ? c.length : c.size.height)
  close(heights.reduce((a, b) => a + b, 0), 158)
  for (const row of rowsOf(rt)) {
    close(row.children.reduce((sum, cell) => sum + cell.size.width, 0), 338)
  }
})

// iOS ignores taps on fully transparent, empty views and the tap falls
// through to the widget, which opens Scriptable
test("tap cells are hit-testable: each holds an image filling the whole cell", async () => {
  const rt = await render([item("L1", "left", "l1://"), item("R1", "right", "r1://")])
  for (const row of rowsOf(rt)) {
    for (const cell of row.children.filter(c => c.url)) {
      const image = cell.children.find(c => c.type === "image")
      assert.ok(image, "cell has an image")
      assert.deepEqual([image.imageSize.width, image.imageSize.height], [cell.size.width, cell.size.height])
    }
  }
})

test("without center items each row has two tap cells", async () => {
  const rt = await render([item("L", "left", "l://"), item("R1", "right", "r1://"), item("R2", "right", "r2://")])
  assert.deepEqual(cellUrls(rt), [["l://", "r1://"], [null, "r2://"]])
})

test("tap cells keep the URL rules: escaped spaces and script routing for missing URLs", async () => {
  const rt = await render([
    item("Water", "left", "shortcuts://run-shortcut?name=Log Water"),
    { name: "Weather", column: "right" }
  ])
  assert.deepEqual(cellUrls(rt), [[
    "shortcuts://run-shortcut?name=Log%20Water",
    "scriptable:///run?scriptName=ZenTrate&shortcut=Weather"
  ]])
})

test("while training every tap cell routes through the script", async () => {
  const until = new Date(2026, 9, 5).toISOString()
  const rt = await render([item("A", "left", "a://")], { config: { training: { until } } })
  assert.match(cellUrls(rt)[0][0], /^scriptable:\/\/\/run\?scriptName=ZenTrate&shortcut=A&originalUrl=a%3A%2F%2F$/)
})

test("scheduled-out items are neither drawn nor tappable", async () => {
  const rt = await render([
    item("Now", "left", "now://"),
    { ...item("Later", "right", "later://"), startTime: "20:00", endTime: "22:00" }
  ])
  assert.deepEqual(drawn(rt).map(d => d.text), ["Now"])
  assert.ok(!cellUrls(rt).flat().includes("later://"))
})

test("the widget is sized for the device and family", async () => {
  const rt = await render([item("A", "left")], { family: "large", screenSize: { width: 430, height: 932 } })
  assert.deepEqual(rt.widget.backgroundImage.size, { width: 364, height: 382 })
})

test("the in-app preview draws at large size", async () => {
  const files = { "zentrate_config.json": { items: [item("A", "left")], sortMethod: "manual" } }
  const rt = createRuntime({ now: new Date(2026, 9, 2, 12, 0), files, scriptName: "ZenTrate" })
  const images = []
  const Base = rt.globals.DrawContext
  rt.globals.DrawContext = class extends Base {
    getImage() { const image = super.getImage(); images.push(image); return image }
  }
  await rt.runScript("ZenTrate.js", { runsInApp: true })
  assert.deepEqual(images.filter(image => image.respectScreenScale).map(image => image.size), [{ width: 338, height: 354 }])
})

test("lock screen accessories keep the stacked text layout", async () => {
  const rt = await render([item("A", "left", "a://"), item("B", "right", "b://")], { family: "accessoryRectangular" })
  assert.equal(rt.widget.backgroundImage, null)
  assert.deepEqual(rt.leaves().map(l => l.text), ["A", "B"])
})

test("with nothing to show the widget draws nothing and has no tap cells", async () => {
  const rt = await render([{ ...item("Later", "left"), startTime: "20:00", endTime: "22:00" }])
  assert.ok(rt.widget)
  assert.equal(rt.widget.backgroundImage, null)
  assert.ok(!cellUrls(rt).flat().some(Boolean))
})

test("big text in the first or last row is pulled inside the widget instead of being clipped", () => {
  const items = Array.from({ length: 8 }, (_, i) => item(`L${i}`, "left"))
  const result = layout(items, { L0: 1000, L7: 1000 }, { maxSize: 40 })
  for (const name of ["L0", "L7"]) {
    const { textRect } = entry(result, name)
    assert.ok(textRect.y >= 0, `${name} top inside`)
    assert.ok(textRect.y + textRect.h <= 170, `${name} bottom inside`)
  }
})

// ---------- theme ----------

const ADAPTIVE = {
  bgColor: "000000", textColor: "FFFFFF", fontName: "Avenir Next", fontWeight: "bold", minFontSize: 10, maxFontSize: 20,
  light: { bgColor: "FFFFFF", textColor: "222222" }
}

async function renderThemed(theme, dark) {
  const files = { "zentrate_config.json": { items: [item("Mail", "left")], sortMethod: "manual" }, "zen_theme.json": theme }
  const rt = createRuntime({ now: new Date(2026, 9, 2, 12, 0), files, scriptName: "ZenTrate", dark })
  await rt.runScript("ZenTrate.js", { runsInWidget: true, config: { widgetFamily: "medium" } })
  return rt
}

const textColorOp = rt => rt.widget.backgroundImage.ops.find(op => op.op === "setTextColor").color

test("the poster bakes in the colors for the current appearance and pairs them with a static background", async () => {
  const light = await renderThemed(ADAPTIVE, false)
  assert.deepEqual(textColorOp(light), { hex: "#222222", alpha: 1 })
  assert.deepEqual(light.widget.backgroundColor, { hex: "#FFFFFF", alpha: 1 })
  const dark = await renderThemed(ADAPTIVE, true)
  assert.deepEqual(textColorOp(dark), { hex: "#FFFFFF", alpha: 1 })
  assert.deepEqual(dark.widget.backgroundColor, { hex: "#000000", alpha: 1 })
})

test("a forced appearance wins over the device's on the poster", async () => {
  const rt = await renderThemed({ ...ADAPTIVE, appearance: "dark" }, false)
  assert.deepEqual(textColorOp(rt), { hex: "#FFFFFF", alpha: 1 })
})

test("the poster draws with the theme's face for its weight", async () => {
  const rt = await renderThemed(ADAPTIVE, true)
  assert.equal(drawn(rt)[0].font.name, "AvenirNext-Bold")
})

test("string theme sizes still scale the poster by usage", async () => {
  const rt = await renderThemed({ minFontSize: "12", maxFontSize: "24" }, true)
  assert.equal(drawn(rt)[0].font.size, 12)
})
