const test = require("node:test")
const assert = require("node:assert/strict")
const { createRuntime } = require("./harness")

const NOW = new Date(2026, 9, 2, 10, 0, 0)

test("buildActionURL percent-encodes the script name and values and skips null/undefined", () => {
  const Widget = createRuntime().require("lib/widget")
  const url = Widget.buildActionURL("Zen Trate", { shortcut: "Mail & Co", originalUrl: "shortcuts://run-shortcut?name=A%20B", x: null, y: undefined })
  assert.equal(url, "scriptable:///run?scriptName=Zen%20Trate&shortcut=Mail%20%26%20Co&originalUrl=shortcuts%3A%2F%2Frun-shortcut%3Fname%3DA%2520B")
})

test("createWidget refreshes after refreshMinutes, defaulting to 5", () => {
  const rt = createRuntime({ now: NOW })
  const Widget = rt.require("lib/widget")
  const theme = { bgColor: "123456" }
  assert.equal(Widget.createWidget({ theme }).refreshAfterDate.getTime(), NOW.getTime() + 5 * 60000)
  assert.equal(Widget.createWidget({ theme, refreshMinutes: 15 }).refreshAfterDate.getTime(), NOW.getTime() + 15 * 60000)
})

test("createWidget uses the given theme's background and padding", () => {
  const Widget = createRuntime().require("lib/widget")
  const w = Widget.createWidget({ theme: { bgColor: "#abcdef" }, padding: [1, 2, 3, 4], url: "x://" })
  assert.equal(w.backgroundColor.hex, "#ABCDEF")
  assert.deepEqual(w.padding, [1, 2, 3, 4])
  assert.equal(w.url, "x://")
})

// ---------- widgetSize ----------

test("widgetSize reads the known size for the device's portrait screen", () => {
  const Widget = createRuntime().require("lib/widget")
  const pro = { width: 393, height: 852 }
  assert.deepEqual(Widget.widgetSize("small", pro), { width: 158, height: 158 })
  assert.deepEqual(Widget.widgetSize("medium", pro), { width: 338, height: 158 })
  assert.deepEqual(Widget.widgetSize("large", pro), { width: 338, height: 354 })
  assert.deepEqual(Widget.widgetSize("medium", { width: 430, height: 932 }), { width: 364, height: 170 })
  assert.deepEqual(Widget.widgetSize("large", { width: 414, height: 736 }), { width: 348, height: 357 })
  assert.deepEqual(Widget.widgetSize("small", { width: 320, height: 568 }), { width: 141, height: 141 })
})

test("widgetSize treats a landscape screen like its portrait one", () => {
  const Widget = createRuntime().require("lib/widget")
  assert.deepEqual(Widget.widgetSize("medium", { width: 844, height: 390 }), { width: 338, height: 158 })
})

test("widgetSize scales unknown screens by width", () => {
  const Widget = createRuntime().require("lib/widget")
  const screen = { width: 400, height: 900 }
  assert.deepEqual(Widget.widgetSize("small", screen), { width: 162, height: 162 })
  assert.deepEqual(Widget.widgetSize("medium", screen), { width: 347, height: 162 })
  assert.deepEqual(Widget.widgetSize("large", screen), { width: 347, height: 362 })
})

test("widgetSize defaults to medium and to the current device's screen", () => {
  const Widget = createRuntime({ screenSize: { width: 375, height: 812 } }).require("lib/widget")
  assert.deepEqual(Widget.widgetSize(), { width: 329, height: 155 })
  assert.deepEqual(Widget.widgetSize(null), { width: 329, height: 155 })
})

test("widgetSize has no size for lock screen accessory families", () => {
  const Widget = createRuntime().require("lib/widget")
  assert.equal(Widget.widgetSize("accessoryRectangular", { width: 390, height: 844 }), null)
  assert.equal(Widget.widgetSize("accessoryInline", { width: 390, height: 844 }), null)
})
