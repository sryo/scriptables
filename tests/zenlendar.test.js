const test = require("node:test")
const assert = require("node:assert/strict")
const { createRuntime, at } = require("./harness")

const NOW = new Date(2026, 9, 2, 10, 14, 0)

async function render(events, opts = {}) {
  const rt = createRuntime({ now: NOW, events, locale: opts.locale || "es", ...opts })
  await rt.runScript("ZenLendar.js", { runsInWidget: true })
  return rt
}

function rows(rt) {
  return rt.widget.children.filter(c => c.type === "stack").map(s => s.children.filter(c => c.type !== "spacer"))
}

test("an event that started 14 minutes ago is not shown as upcoming", async () => {
  const rt = await render([{ title: "Standup", startDate: at(NOW, -14), endDate: at(NOW, 16) }])
  const [[title, time]] = rows(rt)
  assert.equal(title.text, "Standup")
  assert.notEqual(time.type === "text" ? time.text : null, "14 minutos")
  assert.ok(!(time.type === "date" && time.date > NOW), "must not count down to a past start")
})

test("ongoing events read as now / count down to their end", async () => {
  const rt = await render([{ title: "Standup", startDate: at(NOW, -14), endDate: at(NOW, 16) }])
  const [[, time]] = rows(rt)
  // Either a static "now" label or a live date pointing at the event end.
  if (time.type === "date") assert.equal(time.date.getTime(), at(NOW, 16).getTime())
  else assert.match(time.text, /^(ahora|now)$/i)
})

test("events starting soon use a live signed countdown so the label never goes stale", async () => {
  const rt = await render([{ title: "Lunch", startDate: at(NOW, 46), endDate: at(NOW, 106) }])
  const [[, time]] = rows(rt)
  assert.equal(time.type, "date")
  assert.equal(time.style, "offset")
  assert.equal(time.date.getTime(), at(NOW, 46).getTime())
})

test("later events keep a relative string without the leading preposition", async () => {
  const rt = await render([{ title: "Dentist", startDate: at(NOW, 180), endDate: at(NOW, 240) }])
  const [[, time]] = rows(rt)
  assert.equal(time.text, "3 horas")
})

test("refresh is scheduled when the next event enters the live window", async () => {
  const rt = await render([{ title: "Dentist", startDate: at(NOW, 70), endDate: at(NOW, 130) }])
  assert.equal(rt.widget.refreshAfterDate.getTime(), at(NOW, 10).getTime())
})

test("refresh never waits longer than 15 minutes", async () => {
  const rt = await render([{ title: "Trip", startDate: at(NOW, 600), endDate: at(NOW, 900) }])
  assert.equal(rt.widget.refreshAfterDate.getTime(), at(NOW, 15).getTime())
})

test("events are ordered by start date even if EventKit returns them unsorted", async () => {
  const rt = await render([
    { title: "Later", startDate: at(NOW, 120), endDate: at(NOW, 180) },
    { title: "Sooner", startDate: at(NOW, 30), endDate: at(NOW, 60) }
  ])
  assert.deepEqual(rows(rt).map(r => r[0].text), ["Sooner", "Later"])
})

test("ongoing events sort before upcoming ones", async () => {
  const rt = await render([
    { title: "Next", startDate: at(NOW, 5), endDate: at(NOW, 35) },
    { title: "Current", startDate: at(NOW, -14), endDate: at(NOW, 16) }
  ])
  assert.deepEqual(rows(rt).map(r => r[0].text), ["Current", "Next"])
})

test("widget refreshes at the next start or end boundary", async () => {
  const rt = await render([
    { title: "Current", startDate: at(NOW, -14), endDate: at(NOW, 16) },
    { title: "Next", startDate: at(NOW, 5), endDate: at(NOW, 35) }
  ])
  assert.equal(rt.widget.refreshAfterDate.getTime(), at(NOW, 5).getTime())
})

test("eventCount is respected after sorting", async () => {
  const events = Array.from({ length: 8 }, (_, i) => ({
    title: `E${7 - i}`, startDate: at(NOW, (7 - i) * 60 + 10), endDate: at(NOW, (7 - i) * 60 + 40)
  }))
  const rt = await render(events, { files: { "zenlendar_config.json": { eventCount: 3, widgetUrl: "calshow://" } } })
  assert.deepEqual(rows(rt).map(r => r[0].text), ["E0", "E1", "E2"])
})

test("an all-day event today reads as today, not as a past time", async () => {
  const start = new Date(2026, 9, 2, 0, 0, 0)
  const end = new Date(2026, 9, 2, 23, 59, 59)
  const rt = await render([{ title: "Holiday", startDate: start, endDate: end, isAllDay: true }])
  const [[, time]] = rows(rt)
  assert.equal(time.type, "text")
  assert.match(time.text, /^(hoy|today)$/i)
})

test("empty calendar shows a placeholder", async () => {
  const rt = await render([])
  assert.equal(rt.leaves()[0].text, "No upcoming events")
})
