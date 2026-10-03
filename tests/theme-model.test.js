const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("fs")
const path = require("path")
const { createRuntime, ROOT } = require("./harness")

const T = createRuntime().require("lib/theme")

// ---------- normalizeTheme ----------

test("normalizeTheme coerces sizes to numbers and italic strings to booleans", () => {
  const { theme, warnings } = T.normalizeTheme({ name: "A", minFontSize: "12", maxFontSize: " 30 ", fontItalic: "false" })
  assert.equal(theme.minFontSize, 12)
  assert.equal(theme.maxFontSize, 30)
  assert.equal(theme.fontItalic, false)
  assert.deepEqual(warnings, [])
  assert.equal(T.normalizeTheme({ fontItalic: "true" }).theme.fontItalic, true)
  assert.equal(T.normalizeTheme({ fontItalic: true }).theme.fontItalic, true)
})

test("normalizeTheme uppercases hex and drops the #", () => {
  const { theme } = T.normalizeTheme({ bgColor: "#abcdef", textColor: "b3ec91", accentColor: "#0a84ff" })
  assert.deepEqual([theme.bgColor, theme.textColor, theme.accentColor], ["ABCDEF", "B3EC91", "0A84FF"])
})

test("normalizeTheme replaces invalid hex with the default and warns", () => {
  const { theme, warnings } = T.normalizeTheme({ bgColor: "zzz", textColor: "12345", accentColor: "nope" })
  assert.equal(theme.bgColor, T.DEFAULT_THEME.bgColor)
  assert.equal(theme.textColor, T.DEFAULT_THEME.textColor)
  assert.equal(theme.accentColor, T.DEFAULT_THEME.accentColor)
  assert.equal(warnings.length, 3)
})

test("normalizeTheme fills a missing or null accent with 0A84FF without warning", () => {
  assert.equal(T.normalizeTheme({}).theme.accentColor, "0A84FF")
  const { theme, warnings } = T.normalizeTheme({ accentColor: null })
  assert.equal(theme.accentColor, "0A84FF")
  assert.deepEqual(warnings, [])
})

test("normalizeTheme swaps min and max when reversed and warns", () => {
  const { theme, warnings } = T.normalizeTheme({ minFontSize: 30, maxFontSize: 12 })
  assert.deepEqual([theme.minFontSize, theme.maxFontSize], [12, 30])
  assert.equal(warnings.length, 1)
})

test("normalizeTheme clamps sizes to 8–72 and defaults garbage", () => {
  const { theme, warnings } = T.normalizeTheme({ minFontSize: 2, maxFontSize: "500" })
  assert.deepEqual([theme.minFontSize, theme.maxFontSize], [8, 72])
  assert.equal(warnings.length, 2)
  const junk = T.normalizeTheme({ minFontSize: "abc", maxFontSize: null }).theme
  assert.deepEqual([junk.minFontSize, junk.maxFontSize], [T.DEFAULT_THEME.minFontSize, T.DEFAULT_THEME.maxFontSize])
})

test("normalizeTheme maps unknown font weights to regular with a warning and keeps known ones case-insensitively", () => {
  const wide = T.normalizeTheme({ fontWeight: "wide" })
  assert.equal(wide.theme.fontWeight, "regular")
  assert.equal(wide.warnings.length, 1)
  assert.equal(T.normalizeTheme({ fontWeight: "SemiBold" }).theme.fontWeight, "semibold")
  assert.equal(T.normalizeTheme({ fontWeight: "ultralight" }).theme.fontWeight, "ultraLight")
})

test("normalizeTheme strips filename and keeps the active theme's source", () => {
  const { theme } = T.normalizeTheme({ name: "A", filename: "a.json", source: "a.json" })
  assert.ok(!("filename" in theme))
  assert.equal(theme.source, "a.json")
})

test("normalizeTheme defaults appearance to auto and normalizes variant blocks", () => {
  assert.equal(T.normalizeTheme({}).theme.appearance, "auto")
  assert.equal(T.normalizeTheme({ appearance: "Light" }).theme.appearance, "light")
  const bad = T.normalizeTheme({ appearance: "sepia" })
  assert.equal(bad.theme.appearance, "auto")
  assert.equal(bad.warnings.length, 1)

  const { theme, warnings } = T.normalizeTheme({ light: { bgColor: "#ffffff", textColor: "zzz" }, dark: {} })
  assert.deepEqual(theme.light, { bgColor: "FFFFFF" })
  assert.ok(!("dark" in theme), "an empty variant is dropped")
  assert.equal(warnings.length, 1)
})

test("normalizeTheme is idempotent", () => {
  const once = T.normalizeTheme({ name: "X", minFontSize: "40", maxFontSize: "10", bgColor: "#abc123", dark: { textColor: "eeeeee" } }).theme
  const twice = T.normalizeTheme(once)
  assert.deepEqual(twice.theme, once)
  assert.deepEqual(twice.warnings, [])
})

// ---------- validateTheme ----------

const valid = { name: "Mío", bgColor: "000000", textColor: "FFFFFF", accentColor: "0A84FF", fontName: "system", fontWeight: "bold", minFontSize: 10, maxFontSize: 20 }

test("validateTheme accepts a complete theme, including string input from a form", () => {
  assert.deepEqual(T.validateTheme(valid), { ok: true, errors: {} })
  assert.equal(T.validateTheme({ ...valid, bgColor: "#abcdef", minFontSize: "12", maxFontSize: "24" }).ok, true)
})

test("validateTheme reports each bad field with a Spanish message", () => {
  const { ok, errors } = T.validateTheme({
    name: "  ", bgColor: "zzz", textColor: "#12", accentColor: "x", fontName: "Comic Sans", fontWeight: "wide", minFontSize: "0", maxFontSize: "abc"
  })
  assert.equal(ok, false)
  for (const field of ["name", "bgColor", "textColor", "accentColor", "fontName", "fontWeight", "minFontSize", "maxFontSize"]) {
    assert.equal(typeof errors[field], "string", field)
  }
  assert.match(errors.name, /nombre/i)
  assert.match(errors.minFontSize, /8 y 72/)
})

test("validateTheme requires min ≤ max", () => {
  const { errors } = T.validateTheme({ ...valid, minFontSize: 30, maxFontSize: 20 })
  assert.match(errors.maxFontSize, /mínimo/)
})

test("validateTheme knows catalog families, legacy PostScript names and PostScript-ish names", () => {
  for (const fontName of ["Avenir Next", "AvenirNext-Bold", "Marker Felt", "HelveticaNeue-Regular", "rounded", "mono", "SomeFont-Bold"]) {
    assert.equal(T.validateTheme({ ...valid, fontName }).ok, true, fontName)
  }
  assert.equal(T.validateTheme({ ...valid, fontName: "" }).ok, false)
  assert.equal(T.validateTheme({ ...valid, fontName: "<script>" }).ok, false)
})

test("validateTheme checks variant colors and appearance", () => {
  const { errors } = T.validateTheme({ ...valid, appearance: "sepia", light: { bgColor: "nope" } })
  assert.ok(errors.appearance)
  assert.ok(errors["light.bgColor"])
})

// ---------- colors ----------

test("contrastRatio matches WCAG reference pairs", () => {
  assert.equal(T.contrastRatio("000000", "FFFFFF"), 21)
  assert.equal(T.contrastRatio("#FFFFFF", "#000000"), 21)
  assert.equal(T.contrastRatio("777777", "FFFFFF").toFixed(2), "4.48")
  assert.equal(T.contrastRatio("abcdef", "ABCDEF"), 1)
})

test("resolveColors uses the matching variant, falling back field by field to the flat colors", () => {
  const theme = { bgColor: "000000", textColor: "FFFFFF", accentColor: "0A84FF", light: { bgColor: "FFFFFF", textColor: "000000" } }
  assert.deepEqual(T.resolveColors(theme, "dark"), { bgColor: "000000", textColor: "FFFFFF", accentColor: "0A84FF" })
  assert.deepEqual(T.resolveColors(theme, "light"), { bgColor: "FFFFFF", textColor: "000000", accentColor: "0A84FF" })
})

test("a flat legacy theme resolves to the same colors in either appearance", () => {
  const theme = { bgColor: "FDF5E6", textColor: "8B4513" }
  assert.deepEqual(T.resolveColors(theme, "light"), T.resolveColors(theme, "dark"))
  assert.equal(T.resolveColors(theme, "light").bgColor, "FDF5E6")
})

test("effectiveAppearance honors a forced appearance over the system one", () => {
  assert.equal(T.effectiveAppearance({ appearance: "auto" }, "light"), "light")
  assert.equal(T.effectiveAppearance({}, "dark"), "dark")
  assert.equal(T.effectiveAppearance({ appearance: "dark" }, "light"), "dark")
  assert.equal(T.effectiveAppearance({ appearance: "light" }, "dark"), "light")
})

// ---------- fonts ----------

test("FONT_CATALOG lists the generic kinds and curated iOS families with real PostScript faces", () => {
  const byId = Object.fromEntries(T.FONT_CATALOG.map(f => [f.id, f]))
  for (const id of ["system", "rounded", "serif", "mono"]) assert.ok(byId[id], id)
  const faces = id => byId[id].faces.map(f => f.postScript)
  assert.deepEqual(faces("avenir-next").filter(p => !/Italic|UltraLight/.test(p)),
    ["AvenirNext-Regular", "AvenirNext-Medium", "AvenirNext-DemiBold", "AvenirNext-Bold", "AvenirNext-Heavy"])
  assert.ok(faces("helvetica-neue").includes("HelveticaNeue"))
  assert.ok(faces("didot").includes("Didot-Italic"))
  assert.ok(faces("marker-felt").includes("MarkerFelt-Wide"))
  assert.ok(faces("din-alternate").includes("DINAlternate-Bold"))
  for (const f of T.FONT_CATALOG) {
    assert.equal(typeof f.label, "string")
    assert.equal(typeof f.cssFamily, "string")
    for (const face of f.faces || []) {
      assert.match(face.postScript, /^[A-Za-z][A-Za-z0-9-]*$/)
      assert.equal(typeof face.weight, "number")
      assert.equal(typeof face.italic, "boolean")
    }
  }
})

test("fontSpec resolves families, catalog PostScript names and legacy names", () => {
  const spec = fontName => T.fontSpec({ fontName, fontWeight: "regular" }, 14)
  assert.equal(spec("Avenir Next").postScript, "AvenirNext-Regular")
  assert.equal(spec("Marker Felt").family, "marker-felt")
  assert.equal(spec("AvenirNext-Bold").family, "avenir-next")
  assert.equal(spec("GillSans-SemiBold").family, "gill-sans")
  assert.equal(spec("HelveticaNeue-Regular").postScript, "HelveticaNeue")
  assert.equal(spec("monospaced").kind, "mono")
  assert.equal(spec("System").kind, "system")
})

test("fontSpec picks the catalog face nearest to the requested weight and italic", () => {
  const avenir = (fontWeight, fontItalic = false) => T.fontSpec({ fontName: "Avenir Next", fontWeight, fontItalic }, 14).postScript
  assert.equal(avenir("bold"), "AvenirNext-Bold")
  assert.equal(avenir("semibold"), "AvenirNext-DemiBold")
  assert.equal(avenir("black"), "AvenirNext-Heavy")
  assert.equal(avenir("bold", true), "AvenirNext-BoldItalic")
  // Armonk: DIN Alternate has a single bold face
  assert.equal(T.fontSpec({ fontName: "DINAlternate-Bold", fontWeight: "regular" }, 14).postScript, "DINAlternate-Bold")
  // Nuremberg: thin Helvetica Neue
  assert.equal(T.fontSpec({ fontName: "HelveticaNeue-Regular", fontWeight: "thin" }, 14).postScript, "HelveticaNeue-Thin")
  // No italic face: falls back to the upright one and reports it
  const futura = T.fontSpec({ fontName: "Futura", fontWeight: "bold", fontItalic: true }, 14)
  assert.equal(futura.postScript, "Futura-MediumItalic")
  assert.equal(T.fontSpec({ fontName: "Marker Felt", fontWeight: "regular", fontItalic: true }, 14).italic, false)
})

test("fontSpec overrides weight, italic and family", () => {
  const theme = { fontName: "Avenir Next", fontWeight: "regular" }
  assert.equal(T.fontSpec(theme, 14, { weight: "bold" }).postScript, "AvenirNext-Bold")
  assert.equal(T.fontSpec(theme, 14, { italic: true }).postScript, "AvenirNext-Italic")
  assert.equal(T.fontSpec(theme, 14, { fontName: "system" }).kind, "system")
})

test("fontSpec sizes are numbers even from string themes", () => {
  assert.equal(T.fontSpec({ fontName: "system" }, "18").size, 18)
})

test("system italic renders the italic system font, so weight reads as regular in both Font and CSS", () => {
  const spec = T.fontSpec({ fontName: "system", fontWeight: "bold", fontItalic: true }, 12)
  assert.equal(spec.italic, true)
  assert.equal(spec.weight, "regular")
  assert.equal(T.toScriptableFont(spec).name, "italic")
  assert.equal(T.toCss(spec).fontStyle, "italic")
  assert.equal(T.toCss(spec).fontWeight, 400)
})

test("rounded and mono use Scriptable's weighted system factories and have no italic", () => {
  const rounded = T.fontSpec({ fontName: "rounded", fontWeight: "heavy", fontItalic: true }, 12)
  assert.equal(T.toScriptableFont(rounded).name, "heavyRounded")
  assert.equal(rounded.italic, false)
  assert.equal(T.toCss(rounded).fontStyle, "normal")
  assert.equal(T.toCss(rounded).fontWeight, 800)
  assert.equal(T.toScriptableFont(T.fontSpec({ fontName: "mono", fontWeight: "light" }, 12)).name, "lightMonospaced")
})

test("Font and CSS show the same face, weight and style for every catalog family and weight", () => {
  const weights = ["ultraLight", "thin", "light", "regular", "medium", "semibold", "bold", "heavy", "black"]
  const cssWeight = { ultraLight: 100, thin: 200, light: 300, regular: 400, medium: 500, semibold: 600, bold: 700, heavy: 800, black: 900 }
  const fontNames = [...T.FONT_CATALOG.map(f => f.label), "AvenirNext-Bold", "GillSans-SemiBold", "HelveticaNeue-Regular", "Menlo-Regular"]
  for (const fontName of fontNames) {
    for (const fontWeight of weights) {
      for (const fontItalic of [false, true]) {
        const spec = T.fontSpec({ fontName, fontWeight, fontItalic }, 16)
        const font = T.toScriptableFont(spec)
        const css = T.toCss(spec)
        const label = `${fontName} ${fontWeight} ${fontItalic}`
        assert.equal(font.size, 16, label)
        assert.equal(css.fontStyle, spec.italic ? "italic" : "normal", label)
        if (spec.postScript) {
          assert.equal(font.name, spec.postScript, label)
          assert.ok(css.fontFamily.startsWith(`"${spec.postScript}"`), label)
          const face = T.FONT_CATALOG.flatMap(f => f.faces || []).find(f => f.postScript === spec.postScript)
          assert.equal(css.fontWeight, face.weight, label)
          assert.equal(face.italic, spec.italic, label)
        } else {
          assert.equal(css.fontWeight, cssWeight[spec.weight], label)
        }
      }
    }
  }
})

test("an unknown PostScript name passes through as-is and the CSS asks for no synthetic weight", () => {
  const spec = T.fontSpec({ fontName: "SomeFont-Black", fontWeight: "bold", fontItalic: true }, 14)
  assert.equal(spec.kind, "custom")
  assert.equal(T.toScriptableFont(spec).name, "SomeFont-Black")
  const css = T.toCss(spec)
  assert.ok(css.fontFamily.startsWith('"SomeFont-Black"'))
  assert.equal(css.fontWeight, 400)
  assert.equal(css.fontStyle, "normal")
})

test("toCss strips characters that could break out of a style block", () => {
  const css = T.toCss(T.fontSpec({ fontName: 'Evil";}</style>' }, 14))
  assert.ok(!/[<>;{}]/.test(css.fontFamily.replace(/^"[^"]*"/, "")))
  assert.ok(!css.fontFamily.includes("</style>"))
})

// ---------- shipped themes ----------

const SHIPPED = fs.readdirSync(path.join(ROOT, "ZenThemes")).filter(f => f.endsWith(".json"))
  .map(f => [f, JSON.parse(fs.readFileSync(path.join(ROOT, "ZenThemes", f), "utf8"))])

test("every shipped theme is valid as stored: no warnings, an accent, a real size range", () => {
  for (const [file, raw] of SHIPPED) {
    const { warnings } = T.normalizeTheme(raw)
    assert.deepEqual(warnings, [], file)
    assert.equal(T.validateTheme(raw).ok, true, `${file} ${JSON.stringify(T.validateTheme(raw).errors)}`)
    assert.ok(raw.accentColor, `${file} has an accent`)
    assert.ok(raw.minFontSize < raw.maxFontSize, `${file} has a size range`)
  }
})

test("Noir and Terminal ship a light variant, Zen and Pastel a dark one, all readable", () => {
  const byFile = Object.fromEntries(SHIPPED)
  for (const [file, variant] of [["noir.json", "light"], ["terminal.json", "light"], ["zen.json", "dark"], ["pastel.json", "dark"]]) {
    const theme = byFile[file]
    assert.ok(theme[variant], `${file} has ${variant}`)
    const colors = T.resolveColors(theme, variant)
    assert.ok(T.contrastRatio(colors.bgColor, colors.textColor) >= 4.5, `${file} ${variant} text contrast`)
  }
})

test("shipped size ranges keep each theme's character", () => {
  const byFile = Object.fromEntries(SHIPPED)
  const range = f => [byFile[f].minFontSize, byFile[f].maxFontSize]
  assert.deepEqual(range("zen.json"), [14, 28])
  assert.deepEqual(range("terminal.json"), [12, 28])
  assert.deepEqual(range("cartoon.json"), [14, 30])
  assert.deepEqual(range("elegant.json"), [18, 32])
  assert.equal(byFile["cartoon.json"].fontWeight, "bold")
})

// ---------- page injection ----------

test("modelSource runs on its own and answers like the module", () => {
  const vm = require("node:vm")
  const ctx = vm.createContext({ Math, JSON })
  vm.runInContext(T.modelSource(), ctx)
  const inPage = js => JSON.parse(vm.runInContext(`JSON.stringify(${js})`, ctx))
  const theme = { fontName: "Avenir Next", fontWeight: "semibold", fontItalic: true, light: { bgColor: "fafafa" } }
  assert.deepEqual(inPage(`fontSpec(${JSON.stringify(theme)}, 20)`), T.fontSpec(theme, 20))
  assert.deepEqual(inPage(`toCss(fontSpec(${JSON.stringify(theme)}, 20))`), T.toCss(T.fontSpec(theme, 20)))
  assert.deepEqual(inPage(`resolveColors(${JSON.stringify(theme)}, "light")`), T.resolveColors(theme, "light"))
  assert.deepEqual(inPage(`validateTheme({ name: "", bgColor: "zz", textColor: "FFFFFF", minFontSize: 9, maxFontSize: 8 })`),
    T.validateTheme({ name: "", bgColor: "zz", textColor: "FFFFFF", minFontSize: 9, maxFontSize: 8 }))
  assert.equal(vm.runInContext(`contrastRatio("000000", "FFFFFF")`, ctx), 21)
  assert.ok(!T.modelSource().includes("</"))
})
