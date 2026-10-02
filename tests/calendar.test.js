const test = require("node:test")
const assert = require("node:assert/strict")
const { createRuntime, at } = require("./harness")

const NOW = new Date(2026, 9, 2, 10, 0, 0)

test("getUpcomingEvents sorts by start and drops events that already ended", async () => {
  const rt = createRuntime({ now: NOW, events: [
    { title: "B", startDate: at(NOW, 60), endDate: at(NOW, 90) },
    { title: "A", startDate: at(NOW, -10), endDate: at(NOW, 20) },
    { title: "Ended", startDate: at(NOW, -60), endDate: NOW }
  ] })
  const Cal = rt.require("lib/calendar")
  const events = await Cal.getUpcomingEvents(5)
  assert.deepEqual(events.map(e => e.title), ["A", "B"])
})

test("isOngoing is true from start up to (not including) end", () => {
  const rt = createRuntime({ now: NOW })
  const Cal = rt.require("lib/calendar")
  const e = { startDate: NOW, endDate: at(NOW, 30) }
  assert.equal(Cal.isOngoing(e, NOW), true)
  assert.equal(Cal.isOngoing(e, at(NOW, -1)), false)
  assert.equal(Cal.isOngoing(e, at(NOW, 30)), false)
})

test("nextBoundary picks the earliest future start or end", () => {
  const rt = createRuntime({ now: NOW })
  const Cal = rt.require("lib/calendar")
  const events = [
    { startDate: at(NOW, -5), endDate: at(NOW, 40) },
    { startDate: at(NOW, 25), endDate: at(NOW, 50) }
  ]
  assert.equal(Cal.nextBoundary(events, NOW).getTime(), at(NOW, 25).getTime())
  assert.equal(Cal.nextBoundary([], NOW), null)
})

test("getUpcomingEvents hides events the user declined", async () => {
  const rt = createRuntime({ now: NOW, events: [
    { title: "Declined", startDate: at(NOW, 10), endDate: at(NOW, 40),
      attendees: [{ isCurrentUser: true, status: "declined" }, { isCurrentUser: false, status: "accepted" }] },
    { title: "Kept", startDate: at(NOW, 20), endDate: at(NOW, 50),
      attendees: [{ isCurrentUser: false, status: "declined" }] }
  ] })
  const Cal = rt.require("lib/calendar")
  assert.deepEqual((await Cal.getUpcomingEvents(5)).map(e => e.title), ["Kept"])
})
