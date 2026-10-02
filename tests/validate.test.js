const test = require("node:test")
const assert = require("node:assert/strict")
const { createRuntime } = require("./harness")

const V = createRuntime().require("lib/validate")

test("validateTime normalizes valid times", () => {
  assert.equal(V.validateTime("7"), "07:00")
  assert.equal(V.validateTime(" 9:30 "), "09:30")
  assert.equal(V.validateTime("23:59"), "23:59")
  assert.equal(V.validateTime("00:00"), "00:00")
})

test("validateTime treats blank input as no constraint", () => {
  assert.equal(V.validateTime(""), undefined)
  assert.equal(V.validateTime("   "), undefined)
})

test("validateTime rejects out-of-range and malformed times", () => {
  for (const t of ["24", "24:00", "12:60", "9:5", "9.30", "-1", "12:00pm"]) {
    assert.throws(() => V.validateTime(t), undefined, t)
  }
})

test("validateDay accepts 0-6 and blank", () => {
  assert.equal(V.validateDay("0"), 0)
  assert.equal(V.validateDay("6"), 6)
  assert.equal(V.validateDay(" 3 "), 3)
  assert.equal(V.validateDay(""), undefined)
})

test("validateDay treats whitespace-only input as blank, like validateTime", () => {
  assert.equal(V.validateDay("   "), undefined)
})

test("validateDay rejects trailing junk instead of truncating it", () => {
  for (const d of ["3abc", "1.5", "2-4", "7", "-1"]) {
    assert.throws(() => V.validateDay(d), undefined, d)
  }
})

test("validateURL accepts scheme URLs", () => {
  assert.equal(V.validateURL("spotify://"), "spotify://")
  assert.equal(V.validateURL(" https://example.com/a?b=c "), "https://example.com/a?b=c")
  assert.equal(V.validateURL("shortcuts://run-shortcut?name=Leer%20QR"), "shortcuts://run-shortcut?name=Leer%20QR")
  assert.equal(V.validateURL("tel:123"), "tel:123")
  assert.equal(V.validateURL("App-prefs://"), "App-prefs://")
})

test("validateURL rejects text that cannot be opened", () => {
  for (const u of ["", "   ", "spotify", "my app://", "://x", "1password://x y", null, undefined]) {
    assert.equal(V.validateURL(u), null, String(u))
  }
})

test("validateFontWeight keeps camelCase weights like ultraLight", () => {
  assert.equal(V.validateFontWeight("ultraLight"), "ultraLight")
  assert.equal(V.validateFontWeight("ULTRALIGHT"), "ultraLight")
  assert.equal(V.validateFontWeight("Bold"), "bold")
  assert.equal(V.validateFontWeight("nope"), "regular")
})
