const test = require("node:test")
const assert = require("node:assert/strict")
const path = require("path")
const { createRuntime, DOCS } = require("./harness")

/**
 * An iCloud FileManager where paths in `pending` are evicted placeholders:
 * they exist, but read as null until downloadFileFromiCloud() resolves.
 */
function makeICloud(files, pending = new Set(), opts = {}) {
  const under = p => [...files.keys()].some(k => k.startsWith(p + "/"))
  return {
    documentsDirectory: () => DOCS,
    joinPath: (a, b) => path.posix.join(a, b),
    fileExists: p => files.has(p) || under(p),
    isFileDownloaded: p => !pending.has(p),
    downloadFileFromiCloud: opts.download || (async p => {
      await new Promise(r => setTimeout(r, 1))
      pending.delete(p)
    }),
    readString: p => pending.has(p) ? null : (files.has(p) ? files.get(p) : null),
    writeString: (p, s) => { pending.delete(p); files.set(p, s) },
    remove: p => { files.delete(p); pending.delete(p) },
    move: (a, b) => {
      if (opts.moveThrows || pending.has(a)) throw new Error(`The file "${path.posix.basename(a)}" couldn't be moved.`)
      if (files.has(b)) throw new Error("destination exists")
      files.set(b, files.get(a)); files.delete(a)
    },
    createDirectory: () => {},
    isDirectory: under,
    listContents: p => [...new Set([...files.keys()]
      .filter(k => k.startsWith(p + "/"))
      .map(k => k.slice(p.length + 1).split("/")[0]))]
  }
}

function runtimeWith(fm) {
  return createRuntime({ globals: { FileManager: { iCloud: () => fm, local: () => fm } } })
}

const OLD = "/docs/zentrate_theme.json"
const NEW = "/docs/zen_theme.json"
const theme = (name, extra = {}) => JSON.stringify({ name, bgColor: "111111", textColor: "EEEEEE", minFontSize: 12, maxFontSize: 30, ...extra })

// ---------- lib/theme ----------

test("legacy zentrate_theme.json is moved to zen_theme.json on first read", () => {
  const rt = createRuntime({ files: { "zentrate_theme.json": theme("Old") } })
  assert.equal(rt.require("lib/theme").loadTheme().name, "Old")
  assert.ok(rt.files.has(NEW))
  assert.ok(!rt.files.has(OLD))
})

test("when both theme files exist, zen_theme.json wins and nothing is overwritten", () => {
  const rt = createRuntime({ files: { "zentrate_theme.json": theme("Old"), "zen_theme.json": theme("New") } })
  assert.equal(rt.require("lib/theme").loadTheme().name, "New")
  assert.equal(JSON.parse(rt.files.get(NEW)).name, "New")
})

test("a failed legacy move (evicted iCloud file) does not crash and still reads the legacy theme", () => {
  const files = new Map([[OLD, theme("Old")]])
  const rt = runtimeWith(makeICloud(files, new Set(), { moveThrows: true }))
  const Theme = rt.require("lib/theme")
  assert.equal(Theme.loadTheme().name, "Old")
})

test("downloadThemes fetches the evicted active theme so loadTheme sees it", async () => {
  const files = new Map([[NEW, theme("Cloud")]])
  const rt = runtimeWith(makeICloud(files, new Set([NEW])))
  const Theme = rt.require("lib/theme")
  await Theme.downloadThemes()
  assert.equal(Theme.loadTheme().name, "Cloud")
})

test("downloadThemes migrates an evicted legacy theme instead of dropping it", async () => {
  const files = new Map([[OLD, theme("Old")]])
  const rt = runtimeWith(makeICloud(files, new Set([OLD])))
  const Theme = rt.require("lib/theme")
  await Theme.downloadThemes()
  assert.equal(Theme.loadTheme().name, "Old")
  assert.ok(files.has(NEW))
})

test("loadAllThemes tolerates theme files without a name or that are not objects", () => {
  const rt = createRuntime({ files: {
    "ZenThemes/b.json": theme("Beta"),
    "ZenThemes/noname.json": { bgColor: "000000" },
    "ZenThemes/list.json": "[1,2]",
    "ZenThemes/a.json": theme("Alpha")
  } })
  const names = rt.require("lib/theme").loadAllThemes().map(t => t.name)
  assert.deepEqual(names.slice(0, 2), ["Alpha", "Beta"])
  assert.equal(names.length, 3)
})

test("themeFilename never produces a path separator or an empty name", () => {
  const Theme = createRuntime().require("lib/theme")
  assert.equal(Theme.themeFilename("My Theme"), "my-theme.json")
  assert.equal(Theme.themeFilename("  AC/DC  "), "ac-dc.json")
  assert.equal(Theme.themeFilename("a\\b:c"), "a-b-c.json")
  assert.equal(Theme.themeFilename("///"), "theme.json")
  assert.equal(Theme.themeFilename(".."), "theme.json")
})

test("saveThemeToFolder keeps names with a slash inside ZenThemes/", () => {
  const rt = createRuntime()
  rt.require("lib/theme").saveThemeToFolder({ name: "AC/DC" })
  assert.ok(rt.files.has("/docs/ZenThemes/ac-dc.json"), [...rt.files.keys()].join(","))
})

test("getFont passes PostScript names through with their original case", () => {
  const Theme = createRuntime().require("lib/theme")
  assert.deepEqual(Theme.getFont(14, { theme: { fontName: "AvenirNext-Bold" } }), { name: "AvenirNext-Bold", size: 14 })
})

test("getFont maps the generic families case-insensitively", () => {
  const Theme = createRuntime().require("lib/theme")
  // Scriptable has no serif system factory, so serif draws Times New Roman faces
  assert.equal(Theme.getFont(10, { theme: { fontName: "Serif", fontWeight: "regular" } }).name, "TimesNewRomanPSMT")
  assert.equal(Theme.getFont(10, { theme: { fontName: "System", fontWeight: "Medium" } }).name, "medium")
  assert.equal(Theme.getFont(10, { theme: { fontName: "system", fontItalic: true } }).name, "italic")
})

// ---------- storage ----------

const stored = (rt, p) => JSON.parse(rt.files.get(p))

test("loadTheme returns a normalized theme", () => {
  const rt = createRuntime({ files: { "zen_theme.json": { name: "S", minFontSize: "30", maxFontSize: "12", bgColor: "#abcdef", fontItalic: "false" } } })
  const t = rt.require("lib/theme").loadTheme()
  assert.deepEqual([t.minFontSize, t.maxFontSize, t.bgColor, t.fontItalic, t.appearance], [12, 30, "ABCDEF", false, "auto"])
})

test("saveAsNew never overwrites an existing theme: it picks a unique filename", () => {
  const rt = createRuntime({ files: { "ZenThemes/noir.json": theme("Noir") } })
  const Theme = rt.require("lib/theme")
  assert.equal(Theme.saveAsNew({ name: "Noir", bgColor: "222222" }), "noir-2.json")
  assert.equal(Theme.saveAsNew({ name: "Noir", bgColor: "333333" }), "noir-3.json")
  assert.equal(stored(rt, "/docs/ZenThemes/noir.json").bgColor, "111111")
  assert.equal(stored(rt, "/docs/ZenThemes/noir-2.json").bgColor, "222222")
})

test("saved themes never persist filename or source", () => {
  const rt = createRuntime({ files: { "ZenThemes/a.json": theme("Alpha") } })
  const Theme = rt.require("lib/theme")
  const [alpha] = Theme.loadAllThemes()
  assert.equal(alpha.filename, "a.json")
  Theme.updateTheme("a.json", { ...alpha, source: "a.json", bgColor: "444444" })
  const fname = Theme.saveAsNew({ ...alpha, name: "Copy" })
  for (const p of ["/docs/ZenThemes/a.json", `/docs/ZenThemes/${fname}`]) {
    const json = stored(rt, p)
    assert.ok(!("filename" in json), p)
    assert.ok(!("source" in json), p)
  }
  assert.equal(stored(rt, "/docs/ZenThemes/a.json").bgColor, "444444")
})

test("updateTheme keeps the filename even when the name changes, and refreshes the active copy", () => {
  const rt = createRuntime({ files: { "ZenThemes/a.json": theme("Alpha"), "zen_theme.json": theme("Alpha", { source: "a.json" }) } })
  const Theme = rt.require("lib/theme")
  assert.equal(Theme.updateTheme("a.json", { name: "Renamed", bgColor: "555555" }), "a.json")
  assert.equal(stored(rt, "/docs/ZenThemes/a.json").name, "Renamed")
  assert.ok(!rt.files.has("/docs/ZenThemes/renamed.json"))
  assert.equal(stored(rt, NEW).bgColor, "555555")
  assert.equal(stored(rt, NEW).source, "a.json")
})

test("updateTheme refuses filenames outside ZenThemes/", () => {
  const Theme = createRuntime().require("lib/theme")
  assert.throws(() => Theme.updateTheme("../zen_theme.json", { name: "X" }))
})

test("picking a theme records its source in the active theme instead of copying filename", () => {
  const rt = createRuntime({ files: { "ZenThemes/a.json": theme("Alpha") } })
  const Theme = rt.require("lib/theme")
  Theme.saveTheme(Theme.loadAllThemes()[0])
  const active = stored(rt, NEW)
  assert.equal(active.source, "a.json")
  assert.ok(!("filename" in active))
  assert.equal(Theme.loadAllThemes()[0].active, true)
})

test("applyTheme activates a theme by filename", () => {
  const rt = createRuntime({ files: { "ZenThemes/a.json": theme("Alpha"), "ZenThemes/b.json": theme("Beta") } })
  const Theme = rt.require("lib/theme")
  Theme.applyTheme("b.json")
  assert.equal(Theme.loadTheme().name, "Beta")
  assert.equal(stored(rt, NEW).source, "b.json")
})

test("deleteTheme refuses the active theme's source and deletes others", () => {
  const rt = createRuntime({ files: { "ZenThemes/a.json": theme("Alpha"), "ZenThemes/b.json": theme("Beta"), "zen_theme.json": theme("Alpha", { source: "a.json" }) } })
  const Theme = rt.require("lib/theme")
  const refused = Theme.deleteTheme("a.json")
  assert.equal(refused.ok, false)
  assert.match(refused.error, /activo/)
  assert.ok(rt.files.has("/docs/ZenThemes/a.json"))
  assert.equal(Theme.deleteTheme("b.json").ok, true)
  assert.ok(!rt.files.has("/docs/ZenThemes/b.json"))
})

test("saveThemeToFolder never overwrites a different theme stored under the same filename", () => {
  const rt = createRuntime({ files: { "ZenThemes/noir.json": theme("Noir") } })
  const Theme = rt.require("lib/theme")
  assert.equal(Theme.saveThemeToFolder({ name: "Other" }, "noir.json"), "other.json")
  assert.equal(stored(rt, "/docs/ZenThemes/noir.json").name, "Noir")
  assert.equal(Theme.saveThemeToFolder({ name: "Noir", bgColor: "777777" }, "noir.json"), "noir.json")
  assert.equal(stored(rt, "/docs/ZenThemes/noir.json").bgColor, "777777")
})

// ---------- Scriptable colors and fonts ----------

const VARIANT = { name: "V", bgColor: "000000", textColor: "FFFFFF", accentColor: "0A84FF", light: { bgColor: "FFFFFF", textColor: "111111", accentColor: "007AFF" } }

test("colors are dynamic only for an auto theme with variants", () => {
  const Theme = createRuntime().require("lib/theme")
  assert.deepEqual(Theme.getBackgroundColor(VARIANT), { light: { hex: "#FFFFFF", alpha: 1 }, dark: { hex: "#000000", alpha: 1 } })
  assert.deepEqual(Theme.getTextColor(VARIANT), { light: { hex: "#111111", alpha: 1 }, dark: { hex: "#FFFFFF", alpha: 1 } })
  assert.deepEqual(Theme.getAccentColor(VARIANT), { light: { hex: "#007AFF", alpha: 1 }, dark: { hex: "#0A84FF", alpha: 1 } })
  assert.deepEqual(Theme.getTextColor({ ...VARIANT, appearance: "light" }), { hex: "#111111", alpha: 1 })
  assert.deepEqual(Theme.getTextColor({ ...VARIANT, appearance: "dark" }), { hex: "#FFFFFF", alpha: 1 })
  assert.deepEqual(Theme.getBackgroundColor({ bgColor: "123456" }), { hex: "#123456", alpha: 1 })
})

test("an invalid color falls back to the same default in the widget and the editor", () => {
  const rt = createRuntime()
  const Theme = rt.require("lib/theme")
  const E = rt.require("config/zentrate-editor")
  const bad = { bgColor: "zzz", textColor: "nope" }
  assert.equal(Theme.getBackgroundColor(bad).hex, "#" + Theme.DEFAULT_THEME.bgColor)
  assert.equal(Theme.getTextColor(bad).hex, "#" + Theme.DEFAULT_THEME.textColor)
  const tokens = E.themeTokens(bad)
  assert.equal(tokens.bg, "#" + Theme.DEFAULT_THEME.bgColor)
  assert.equal(tokens.text, "#" + Theme.DEFAULT_THEME.textColor)
})

test("resolveForRender follows the device appearance unless the theme forces one", () => {
  const dark = createRuntime({ dark: true }).require("lib/theme")
  const light = createRuntime({ dark: false }).require("lib/theme")
  assert.equal(dark.resolveForRender(VARIANT).bgColor, "000000")
  assert.equal(light.resolveForRender(VARIANT).bgColor, "FFFFFF")
  assert.equal(light.resolveForRender({ ...VARIANT, appearance: "dark" }).bgColor, "000000")
  assert.equal(dark.resolveForRender({ ...VARIANT, appearance: "light" }).textColor, "111111")
})

test("getFont applies the theme weight to custom families", () => {
  const Theme = createRuntime().require("lib/theme")
  assert.equal(Theme.getFont(14, { theme: { fontName: "Avenir Next", fontWeight: "bold" } }).name, "AvenirNext-Bold")
  assert.equal(Theme.getBoldFont(14, { fontName: "Georgia", fontWeight: "regular" }).name, "Georgia-Bold")
  assert.equal(Theme.getRegularFont(14, { fontName: "Georgia", fontWeight: "bold" }).name, "Georgia")
})

test("getFont builds rounded and mono from Scriptable's weighted factories", () => {
  const Theme = createRuntime().require("lib/theme")
  assert.equal(Theme.getFont(10, { theme: { fontName: "rounded", fontWeight: "bold" } }).name, "boldRounded")
  assert.equal(Theme.getFont(10, { theme: { fontName: "monospaced", fontWeight: "regular" } }).name, "regularMonospaced")
})
