const test = require("node:test")
const assert = require("node:assert/strict")
const { createRuntime } = require("./harness")

const M = createRuntime().require("config/zentrate")
const NOW = new Date(2026, 9, 2, 10, 0, 0)
const DAY = 86400000
const items = [{ name: "A", scheme: "a://", column: "left", position: 1 }]

test("a config without a training period is frozen", () => {
  assert.equal(M.isTraining({ items }, NOW), false)
})

test("startTraining runs for 14 days by default and halves existing counts once", () => {
  const r = M.startTraining({ items }, { A: 10, B: 3 }, NOW)
  assert.equal(new Date(r.config.training.until).getTime(), NOW.getTime() + 14 * DAY)
  assert.deepEqual(r.stats, { A: 5, B: 1.5 })
  assert.equal(M.isTraining(r.config, new Date(NOW.getTime() + 13 * DAY)), true)
  assert.equal(M.isTraining(r.config, new Date(NOW.getTime() + 14 * DAY)), false)
})

test("restarting while already training extends it without decaying again", () => {
  const first = M.startTraining({ items }, { A: 10 }, NOW)
  const later = new Date(NOW.getTime() + 3 * DAY)
  const again = M.startTraining(first.config, first.stats, later, 14)
  assert.deepEqual(again.stats, { A: 5 })
  assert.equal(new Date(again.config.training.until).getTime(), later.getTime() + 14 * DAY)
})

test("restarting never shortens a running training period", () => {
  const first = M.startTraining({ items }, {}, NOW, 14)
  const again = M.startTraining(first.config, {}, new Date(NOW.getTime() + DAY), 3)
  assert.equal(again.config.training.until, first.config.training.until)
})

test("stopTraining freezes sizes immediately and keeps counts", () => {
  const started = M.startTraining({ items }, { A: 8 }, NOW)
  const stopped = M.stopTraining(started.config)
  assert.equal(M.isTraining(stopped, NOW), false)
  assert.equal(stopped.training, undefined)
})

test("startTraining does not mutate its inputs", () => {
  const config = { items }, stats = { A: 4 }
  M.startTraining(config, stats, NOW)
  assert.deepEqual(stats, { A: 4 })
  assert.equal(config.training, undefined)
})

test("describeTraining reads in Spanish", () => {
  assert.equal(M.describeTraining({ items }, NOW), "Tamaños fijos")
  const r = M.startTraining({ items }, {}, NOW)
  assert.equal(M.describeTraining(r.config, NOW), "Aprendiendo hasta el 16/10")
})

// ---------- ZenTrate ----------

async function render(config, stats = {}) {
  const rt = createRuntime({ now: NOW, files: { "zentrate_config.json": config, "zentrate_stats.json": stats } })
  await rt.runScript("ZenTrate.js", { runsInWidget: true })
  return rt
}
// "A" is the only item: the first tap cell of the first row
const urls = rt => [rt.widget.children[0].children.find(c => c.type === "stack").children[0].url]

test("while training, taps route through Scriptable so they are counted", async () => {
  const until = new Date(NOW.getTime() + 5 * DAY).toISOString()
  const rt = await render({ items, sortMethod: "manual", training: { until } })
  assert.match(urls(rt)[0], /^scriptable:\/\/\/run\?/)
})

test("after training ends, taps open the app directly", async () => {
  const until = new Date(NOW.getTime() - DAY).toISOString()
  const rt = await render({ items, sortMethod: "manual", training: { until } })
  assert.equal(urls(rt)[0], "a://")
})

test("the widget refreshes when training ends", async () => {
  const until = new Date(NOW.getTime() + 2 * 60000)
  const rt = await render({ items, sortMethod: "manual", training: { until: until.toISOString() } })
  assert.ok(rt.widget.refreshAfterDate.getTime() <= until.getTime())
})

test("a counted tap during training increments that item's usage", async () => {
  const until = new Date(NOW.getTime() + 5 * DAY).toISOString()
  const rt = createRuntime({ now: NOW, files: { "zentrate_config.json": { items, training: { until } }, "zentrate_stats.json": { A: 2 } } })
  await rt.runScript("ZenTrate.js", { runsInApp: true, args: { queryParameters: { shortcut: "A", originalUrl: "a://" } } })
  assert.deepEqual(JSON.parse(rt.files.get("/docs/zentrate_stats.json")), { A: 3 })
})
