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

test("loadJSON parses an existing file", () => {
  const rt = createRuntime({ files: { "a.json": { x: 1 } } })
  const Fs = rt.require("lib/fs")
  assert.deepEqual(Fs.loadJSON("/docs/a.json"), { x: 1 })
})

test("loadJSON returns the default for missing, empty or corrupt files", () => {
  const rt = createRuntime({ files: { "empty.json": "  ", "bad.json": "{nope" } })
  const Fs = rt.require("lib/fs")
  assert.deepEqual(Fs.loadJSON("/docs/missing.json", { d: 1 }), { d: 1 })
  assert.deepEqual(Fs.loadJSON("/docs/empty.json", { d: 2 }), { d: 2 })
  assert.deepEqual(Fs.loadJSON("/docs/bad.json", { d: 3 }), { d: 3 })
})

test("loadJSONAsync waits for an evicted iCloud file to download", async () => {
  const files = new Map([["/docs/a.json", '{"x":1}']])
  const rt = runtimeWith(makeICloud(files, new Set(["/docs/a.json"])))
  const Fs = rt.require("lib/fs")
  assert.deepEqual(await Fs.loadJSONAsync("/docs/a.json", null), { x: 1 })
  assert.equal(await Fs.loadJSONAsync("/docs/missing.json", "dflt"), "dflt")
})

test("ensureDownloaded resolves even when the download fails", async () => {
  const files = new Map([["/docs/a.json", '{"x":1}']])
  const fm = makeICloud(files, new Set(["/docs/a.json"]), { download: async () => { throw new Error("offline") } })
  const rt = runtimeWith(fm)
  const Fs = rt.require("lib/fs")
  await Fs.ensureDownloaded("/docs/a.json")
  assert.deepEqual(await Fs.loadJSONAsync("/docs/a.json", "dflt"), "dflt")
})

test("sync loadJSON on an evicted file does not leak an unhandled rejection", async () => {
  const files = new Map([["/docs/a.json", '{"x":1}']])
  const fm = makeICloud(files, new Set(["/docs/a.json"]), { download: () => Promise.reject(new Error("offline")) })
  const rt = runtimeWith(fm)
  const Fs = rt.require("lib/fs")
  const unhandled = []
  const onUnhandled = e => unhandled.push(e)
  process.on("unhandledRejection", onUnhandled)
  try {
    assert.equal(Fs.loadJSON("/docs/a.json", "dflt"), "dflt")
    await new Promise(r => setTimeout(r, 10))
  } finally {
    process.off("unhandledRejection", onUnhandled)
  }
  assert.deepEqual(unhandled, [])
})
