const test = require("node:test")
const assert = require("node:assert/strict")
const { createRuntime } = require("./harness")

// 2026-10-02 is a Friday (day 5)
function dt(hour, minute = 0, day = 2) {
  return new Date(2026, 9, day, hour, minute, 0)
}

function lib(now) {
  const rt = createRuntime({ now })
  return { rt, DateTime: rt.require("lib/datetime") }
}

test("overnight time range 22:00-06:00 includes late evening and early morning", () => {
  const { rt, DateTime } = lib(dt(23, 30))
  assert.equal(DateTime.isWithinTimeRange("22:00", "06:00"), true)
  rt.setNow(dt(2, 0))
  assert.equal(DateTime.isWithinTimeRange("22:00", "06:00"), true)
  rt.setNow(dt(12, 0))
  assert.equal(DateTime.isWithinTimeRange("22:00", "06:00"), false)
})

test("a time window closes at its end minute so back-to-back windows don't overlap", () => {
  const { rt, DateTime } = lib(dt(17, 0))
  assert.equal(DateTime.isWithinTimeRange("09:00", "17:00"), false)
  assert.equal(DateTime.isWithinTimeRange("17:00", "22:00"), true)
  rt.setNow(dt(16, 59))
  assert.equal(DateTime.isWithinTimeRange("09:00", "17:00"), true)
})

test("invalid times are ignored instead of hiding or crashing", () => {
  const { DateTime } = lib(dt(12, 0))
  assert.equal(DateTime.isWithinTimeRange("25:00", null), true)
  assert.equal(DateTime.isWithinTimeRange("09:00", "12:75"), true)
  assert.doesNotThrow(() => DateTime.isWithinTimeRange(9.5, null))
  assert.equal(DateTime.isWithinTimeRange(9, 17), true)
  assert.equal(DateTime.isWithinTimeRange(" 13:00 ", null), false)
})

test("day range that wraps the week (Fri-Mon) includes the weekend", () => {
  const { rt, DateTime } = lib(dt(12, 0, 3)) // Saturday
  assert.equal(DateTime.isWithinDayRange(5, 1), true)
  rt.setNow(dt(12, 0, 5)) // Monday
  assert.equal(DateTime.isWithinDayRange(5, 1), true)
  rt.setNow(dt(12, 0, 7)) // Wednesday
  assert.equal(DateTime.isWithinDayRange(5, 1), false)
})

test("day range still works for ordinary Mon-Fri", () => {
  const { rt, DateTime } = lib(dt(12, 0, 2)) // Friday
  assert.equal(DateTime.isWithinDayRange(1, 5), true)
  rt.setNow(dt(12, 0, 4)) // Sunday
  assert.equal(DateTime.isWithinDayRange(1, 5), false)
})

test("an overnight window on Friday stays open into Saturday's early hours", () => {
  const { DateTime } = lib(dt(12, 0))
  const item = { startTime: "22:00", endTime: "02:00", startDay: 5, endDay: 5 }
  assert.equal(DateTime.isScheduledAt(item, dt(23, 0, 2)), true)  // Fri 23:00
  assert.equal(DateTime.isScheduledAt(item, dt(1, 0, 3)), true)   // Sat 01:00
  assert.equal(DateTime.isScheduledAt(item, dt(1, 0, 2)), false)  // Fri 01:00 (Thursday's night)
  assert.equal(DateTime.isScheduledAt(item, dt(23, 0, 3)), false) // Sat 23:00
})

test("nextScheduleChange finds when an item appears or disappears", () => {
  const { DateTime } = lib(dt(12, 0))
  const items = [
    { name: "Night", startTime: "22:00", endTime: "06:00" },
    { name: "Always" }
  ]
  assert.equal(DateTime.nextScheduleChange(items, dt(21, 58)).getTime(), dt(22, 0).getTime())
  assert.equal(DateTime.nextScheduleChange(items, dt(23, 0)).getTime(), dt(6, 0, 3).getTime())
  assert.equal(DateTime.nextScheduleChange([{ name: "Always" }], dt(12, 0)), null)
})

test("nextScheduleChange accounts for day ranges at midnight", () => {
  const { DateTime } = lib(dt(12, 0))
  const items = [{ name: "Weekend", startDay: 6, endDay: 0 }]
  assert.equal(DateTime.nextScheduleChange(items, dt(23, 50, 2)).getTime(), dt(0, 0, 3).getTime())
})

test("getGreeting says good night in the small hours, not good morning", () => {

  const greet = h => createRuntime({ now: new Date(2026, 9, 2, h, 0) }).require("lib/datetime").getGreeting()
  assert.equal(greet(2), "Good night")
  assert.equal(greet(5), "Good morning")
  assert.equal(greet(13), "Good afternoon")
  assert.equal(greet(18), "Good evening")
  assert.equal(greet(22), "Good night")
})
