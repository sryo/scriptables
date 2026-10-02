const test = require("node:test")
const assert = require("node:assert/strict")
const { createRuntime, at } = require("./harness")

const day = (h, m = 0, d = 2) => new Date(2026, 9, d, h, m, 0)

async function render(now, opts = {}) {
  const rt = createRuntime({ now, ...opts })
  await rt.runScript("ZenDigest.js", { runsInWidget: true })
  return rt
}

function texts(rt) {
  return rt.leaves().map(l => l.text)
}

function digestRow(rt) {
  return rt.widget.children[0].children.filter(c => c.type === "stack")
}

function weatherRequest(payload) {
  return class {
    constructor(url) { this.url = url }
    async loadJSON() { return payload }
  }
}

const here = async () => ({ latitude: 1, longitude: 2 })

test("a finished overnight event from yesterday does not flip the morning to evening", async () => {
  const rt = await render(day(8), {
    events: [{ title: "Party", startDate: day(23, 0, 1), endDate: day(1) }]
  })
  const t = texts(rt)
  assert.ok(!t.some(s => s.startsWith("Tomorrow") || s === "Nothing scheduled tomorrow."), t.join(" | "))
  assert.ok(t.includes("Your day is wide open."), t.join(" | "))
})

test("a finished overnight event does not hide the morning or appear in the digest", async () => {
  const rt = await render(day(8), {
    events: [
      { title: "Party", startDate: day(23, 0, 1), endDate: day(1) },
      { title: "Meeting", startDate: day(10), endDate: day(11) }
    ]
  })
  assert.ok(texts(rt).includes("Meeting at 10 AM."), texts(rt).join(" | "))
})

test("an ongoing overnight event is not shown as starting at its past start time", async () => {
  const rt = await render(day(0, 30), {
    events: [{ title: "Party", startDate: day(23, 0, 1), endDate: day(1) }]
  })
  assert.ok(texts(rt).includes("Party until 1 AM."), texts(rt).join(" | "))
})

test("an ongoing event reads as running until its end, not at its start", async () => {
  const rt = await render(day(10, 14), {
    events: [
      { title: "Standup", startDate: day(10), endDate: day(10, 30) },
      { title: "Lunch", startDate: day(13), endDate: day(14) }
    ]
  })
  assert.ok(texts(rt).includes("Standup until 10:30 AM, Lunch at 1 PM."), texts(rt).join(" | "))
})

test("date-only reminders due today still count as pending in the afternoon", async () => {
  const rt = await render(day(15), {
    events: [{ title: "Focus", startDate: day(14), endDate: day(16) }],
    reminders: [{ title: "Pay rent", dueDate: day(0), dueDateIncludesTime: false }]
  })
  assert.ok(texts(rt).includes("1 reminder pending."), texts(rt).join(" | "))
})

test("timed reminders already past due are not counted as pending", async () => {
  const rt = await render(day(15), {
    events: [{ title: "Focus", startDate: day(14), endDate: day(16) }],
    reminders: [
      { title: "Call", dueDate: day(9), dueDateIncludesTime: true },
      { title: "Email", dueDate: day(17), dueDateIncludesTime: true }
    ]
  })
  assert.ok(texts(rt).includes("1 reminder pending."), texts(rt).join(" | "))
})

test("widget refreshes when the next event starts", async () => {
  const rt = await render(day(10, 14), {
    events: [{ title: "Sync", startDate: day(10, 20), endDate: day(10, 50) }]
  })
  assert.equal(rt.widget.refreshAfterDate.getTime(), day(10, 20).getTime())
})

test("widget refreshes when an ongoing event ends", async () => {
  const rt = await render(day(10, 25), {
    events: [{ title: "Standup", startDate: day(10), endDate: day(10, 30) }]
  })
  assert.equal(rt.widget.refreshAfterDate.getTime(), day(10, 30).getTime())
})

test("evening digest refreshes at midnight so 'Tomorrow' never shows for today", async () => {
  const rt = await render(day(23, 55), {
    events: [{ title: "Dinner", startDate: day(19), endDate: day(20) }]
  })
  assert.ok(rt.widget.refreshAfterDate.getTime() <= day(0, 0, 3).getTime())
})

test("refresh falls back to 15 minutes when nothing changes sooner", async () => {
  const rt = await render(day(10))
  assert.equal(rt.widget.refreshAfterDate.getTime(), at(day(10), 15).getTime())
})

test("the configured widgetUrl is used as the tap target", async () => {
  const rt = await render(day(10), {
    files: { "zendigest_config.json": { widgetUrl: "x-fantastical3://", showWeather: false } }
  })
  const rows = digestRow(rt)
  assert.equal(rows[0].url, "x-fantastical3://")
  assert.equal(rows[rows.length - 1].url, "x-fantastical3://")
})

test("snow showers are described, not reported as mixed conditions", async () => {
  const rt = await render(day(8), {
    location: here,
    Request: weatherRequest({
      current: { temperature_2m: -2.4, weather_code: 85 },
      daily: { temperature_2m_max: [0], temperature_2m_min: [-5], uv_index_max: [1], weather_code: [86] }
    })
  })
  assert.ok(texts(rt).includes("-2° snow showers · ↑0 ↓-5"), texts(rt).join(" | "))
})

test("weather renders without tomorrow data", async () => {
  const rt = await render(day(8), {
    location: here,
    Request: weatherRequest({
      current: { temperature_2m: 18.6, weather_code: 0 },
      daily: { temperature_2m_max: [22], temperature_2m_min: [12], uv_index_max: [5.4], weather_code: [1] }
    })
  })
  assert.ok(texts(rt).includes("19° clear skies · ↑22 ↓12 · UV 5"), texts(rt).join(" | "))
})

test("no events, before noon: open day", async () => {
  const rt = await render(day(9))
  assert.deepEqual(texts(rt), ["Good morning", "Your day is wide open."])
})
