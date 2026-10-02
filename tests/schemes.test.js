const test = require("node:test")
const assert = require("node:assert/strict")
const { createRuntime } = require("./harness")

const schemes = () => createRuntime().require("lib/schemes")

test("search ignores case and accents and labels exact alias hits with the user's word", () => {
  const [best] = schemes().search("Música")
  assert.equal(best.scheme, "music://")
  assert.equal(best.score, 100)
  assert.equal(best.name, "Música")
})

test("search ranks exact over prefix over substring and returns nothing for blank queries", () => {
  const S = schemes()
  assert.deepEqual(S.search("   "), [])
  const results = S.search("google")
  assert.equal(results[0].name, "Google")
  assert.ok(results.every((r, i) => i === 0 || results[i - 1].score >= r.score))
})

test("shortcutItem percent-encodes the shortcut name", () => {
  assert.equal(schemes().shortcutItem(" Log & Go ").scheme, "shortcuts://run-shortcut?name=Log%20%26%20Go")
})

test("isMissing treats blank and about:blank as missing", () => {
  const S = schemes()
  assert.ok(S.isMissing("") && S.isMissing(" about:blank ") && S.isMissing(null))
  assert.ok(!S.isMissing("spotify://"))
})

test("resolve trusts strong catalog matches without asking Claude", async () => {
  assert.equal((await schemes().resolve("spoti")).scheme, "spotify://")
  assert.equal(await schemes().resolve("zzzz unknown"), null)
})
