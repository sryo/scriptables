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
