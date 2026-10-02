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
  assert.equal(Theme.getFont(10, { theme: { fontName: "Serif" } }).name, "serif")
  assert.equal(Theme.getFont(10, { theme: { fontName: "System", fontWeight: "Medium" } }).name, "medium")
  assert.equal(Theme.getFont(10, { theme: { fontName: "system", fontItalic: true } }).name, "italic")
})

// ---------- ZenTheme.js ----------

/** Fills the editor alert with `values` (by field key) and taps Save. */
function fill(values) {
  const KEYS = ["name", "author", "bgColor", "textColor", "fontName", "fontWeight", "fontItalic", "minFontSize", "maxFontSize"]
  return alert => {
    KEYS.forEach((k, i) => { if (k in values) alert.fields[i].value = String(values[k]) })
    return 0
  }
}

test("ZenTheme lists themes still downloading from iCloud and does not overwrite noir.json", async () => {
  const files = new Map([
    ["/docs/ZenThemes/noir.json", theme("Noir", { maxFontSize: 40 })],
    ["/docs/ZenThemes/zen.json", theme("Zen")]
  ])
  const fm = makeICloud(files, new Set(files.keys()))
  let listed
  const rt = createRuntime({
    globals: { FileManager: { iCloud: () => fm, local: () => fm } },
    alertResponses: [a => { listed = a.actions.slice(); return -1 }]
  })
  await rt.runScript("ZenTheme.js", { runsInApp: true })
  assert.deepEqual(listed, ["Noir", "Zen", "New Theme"])
  assert.equal(JSON.parse(files.get("/docs/ZenThemes/noir.json")).maxFontSize, 40)
})

test("ZenTheme rejects a min font size of 0 instead of silently using 10", async () => {
  const rt = createRuntime({
    files: { "ZenThemes/noir.json": theme("Noir") },
    alertResponses: [1, fill({ name: "Tiny", minFontSize: "0", maxFontSize: "20" }), 0, -1]
  })
  await rt.runScript("ZenTheme.js", { runsInApp: true })
  assert.equal(rt.alerts[2].title, "Validation Error")
  assert.match(rt.alerts[2].message, /Min font size/)
  assert.ok(!rt.files.has("/docs/ZenThemes/tiny.json"))
})

test("ZenTheme rejects non-numeric font sizes", async () => {
  const rt = createRuntime({
    files: { "ZenThemes/noir.json": theme("Noir") },
    alertResponses: [1, fill({ name: "Junk", minFontSize: "abc", maxFontSize: "20" }), 0, -1]
  })
  await rt.runScript("ZenTheme.js", { runsInApp: true })
  assert.equal(rt.alerts[2].title, "Validation Error")
})

test("ZenTheme keeps what the user typed when asking them to fix a validation error", async () => {
  const rt = createRuntime({
    files: { "ZenThemes/noir.json": theme("Noir") },
    alertResponses: [1, fill({ name: "Sunset", bgColor: "zzz" }), 0, -1]
  })
  await rt.runScript("ZenTheme.js", { runsInApp: true })
  const retry = rt.alerts[3]
  assert.equal(retry.fields[0].value, "Sunset")
  assert.equal(retry.fields[2].value, "zzz")
})

test("ZenTheme saves a new theme with numeric sizes, clean hex and a safe filename", async () => {
  const rt = createRuntime({
    files: { "ZenThemes/noir.json": theme("Noir") },
    alertResponses: [1, fill({ name: " AC/DC ", bgColor: "#abcdef", minFontSize: "12", maxFontSize: "24" }), 0]
  })
  await rt.runScript("ZenTheme.js", { runsInApp: true })
  const saved = JSON.parse(rt.files.get("/docs/ZenThemes/ac-dc.json"))
  assert.equal(saved.name, "AC/DC")
  assert.equal(saved.bgColor, "ABCDEF")
  assert.equal(saved.minFontSize, 12)
  assert.equal(saved.maxFontSize, 24)
  assert.equal(JSON.parse(rt.files.get(NEW)).name, "AC/DC")
})

test("ZenTheme keeps the current accent color on a new theme", async () => {
  const rt = createRuntime({
    files: { "ZenThemes/noir.json": theme("Noir"), "zen_theme.json": theme("Mine", { accentColor: "FF2D55" }) },
    alertResponses: [1, fill({ name: "Mine 2" }), 0]
  })
  await rt.runScript("ZenTheme.js", { runsInApp: true })
  assert.equal(JSON.parse(rt.files.get("/docs/ZenThemes/mine-2.json")).accentColor, "FF2D55")
  assert.equal(JSON.parse(rt.files.get(NEW)).accentColor, "FF2D55")
})

test("ZenTheme applies a picked theme", async () => {
  const rt = createRuntime({
    files: { "ZenThemes/a.json": theme("Alpha"), "ZenThemes/b.json": theme("Beta") },
    alertResponses: [1, 0]
  })
  await rt.runScript("ZenTheme.js", { runsInApp: true })
  assert.equal(JSON.parse(rt.files.get(NEW)).name, "Beta")
})
