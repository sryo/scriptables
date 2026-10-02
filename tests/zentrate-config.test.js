const test = require("node:test")
const assert = require("node:assert/strict")
const { createRuntime } = require("./harness")

const NOW = new Date(2026, 9, 2, 10, 14, 0)
const CONFIG = "/docs/zentrate_config.json"
const STATS = "/docs/zentrate_stats.json"
const ITEMS = [{ name: "Mine", column: "left", scheme: "mine://", position: 1 }]

function runtime(evicted, extra = {}) {
  return createRuntime({
    now: NOW,
    files: { "zentrate_config.json": { items: ITEMS, sortMethod: "manual" }, "zentrate_stats.json": { Mine: 7 } },
    evicted,
    ...extra
  })
}

test("a widget render with the config still in iCloud does not overwrite it with the example", async () => {
  const rt = runtime(["zentrate_config.json"])
  await rt.runScript("ZenTrate.js", { runsInWidget: true })
  assert.deepEqual(JSON.parse(rt.files.get(CONFIG)).items, ITEMS)
})

test("a fresh install with no config still gets the example config", async () => {
  const rt = createRuntime({ now: NOW })
  await rt.runScript("ZenTrate.js", { runsInWidget: true })
  assert.ok(JSON.parse(rt.files.get(CONFIG)).items.length > 1)
})

test("tapping an item with stats still in iCloud counts on top of the real stats", async () => {
  const rt = runtime(["zentrate_stats.json", "zentrate_config.json"])
  await rt.runScript("ZenTrate.js", { runsInApp: true, args: { queryParameters: { shortcut: "Mine", originalUrl: "mine://" } } })
  assert.deepEqual(JSON.parse(rt.files.get(STATS)), { Mine: 8 })
})

test("the editor waits for an evicted config instead of saving an empty one", async () => {
  const rt = runtime(["zentrate_config.json"], { alertResponses: [3] })
  await rt.runScript("ZenTweak.js", { runsInApp: true, args: { queryParameters: { action: "editItem", itemName: "Mine" } } })
  // Deleting "Mine" proves the editor saw it; an empty editor would not find it
  assert.deepEqual(JSON.parse(rt.files.get(CONFIG)).items, [])
  assert.equal(rt.alerts[0].fields[0].value, "Mine")
})
