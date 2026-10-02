// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-gray; icon-glyph: sliders-h;
/**
 * ZenTweak.js - Configuration Editor for ZenTrate
 *
 * Features:
 * - Fullscreen editor page with a live widget preview and time scrubber
 * - Add, edit, delete (with undo), and drag items between columns
 * - Find item URLs by catalog search, Claude, or shortcut name (also from Siri)
 * - Time and day constraints, sort method, usage training
 * - Every change is saved as soon as it's made
 */

const Theme = importModule("lib/theme")
const Widget = importModule("lib/widget")
const Validate = importModule("lib/validate")
const ZenTrateConfig = importModule("config/zentrate")
const Editor = importModule("config/zentrate-editor")
const Schemes = importModule("lib/schemes")

// ============================================
// CONFIGURATION
// ============================================

const loadConfig = ZenTrateConfig.loadConfigForEditor
const saveConfig = ZenTrateConfig.saveConfig

function saveStatsIfChanged(before, after) {
  if (JSON.stringify(before) !== JSON.stringify(after)) ZenTrateConfig.saveStats(after)
}

// ============================================
// EDITOR PAGE
// ============================================

// After this many failed ZT.next() calls in a row the page is assumed gone
const MAX_BRIDGE_FAILURES = 5
const CLOSED = Symbol("closed")

/**
 * Presents the editor and serves its messages until the user closes it.
 * Scriptable can't dismiss a WebView from code, so every change is saved
 * immediately and the closed page simply ends the loop.
 */
async function openEditor() {
  const session = { config: loadConfig(), stats: ZenTrateConfig.loadStats(), undo: null }

  const webView = new WebView()
  let open = true
  const closed = webView.present(true).then(() => {
    open = false
    return CLOSED
  })
  // Loaded only once on screen: a page loaded into an unpresented view can stay blank
  await webView.loadHTML(Editor.buildHTML({
    theme: Theme.loadTheme(),
    state: Editor.buildState(session.config, session.stats, new Date())
  }))

  let failures = 0
  while (open) {
    let raw
    try {
      raw = await Promise.race([webView.evaluateJavaScript("ZT.next()", true), closed])
      failures = 0
    } catch (error) {
      if (++failures >= MAX_BRIDGE_FAILURES) break
      continue
    }
    if (raw === CLOSED || !open) break

    const reply = await handleMessage(raw, session)
    if (reply && open) {
      await webView.evaluateJavaScript(`ZT.receive(${JSON.stringify(reply)})`).catch(error => {
        console.error(`ZenTweak: Could not reply to the page: ${error.message}`)
      })
    }
  }
}

/**
 * Applies one page message.
 * @param {*} raw - Message JSON from the page
 * @param {Object} session - { config, stats, undo }, updated in place on success
 * @returns {Promise<Object|null>} Reply for ZT.receive, or null for none
 */
async function handleMessage(raw, session) {
  const parsed = Editor.parseMessage(raw)
  if (!parsed.ok) return { type: "error", error: parsed.error }
  const msg = parsed.msg
  const id = msg.id

  switch (msg.type) {
    case "idle":
      return null

    case "op": {
      const now = new Date()
      const result = Editor.applyOp(session, msg, now)
      if (!result.ok) return { type: "error", id, error: result.error, field: result.field }
      saveConfig(result.state.config)
      saveStatsIfChanged(session.stats, result.state.stats)
      Object.assign(session, result.state)
      const reply = { type: "state", id, state: Editor.buildState(session.config, session.stats, now) }
      if (result.deleted) reply.deleted = result.deleted
      return reply
    }

    case "search-claude":
      return { type: "claude", id, ...await askClaude(msg.query) }

    case "set-key": {
      if (!Schemes.saveApiKey(msg.key)) return { type: "claude", id, needKey: true, error: "Pegá una clave primero" }
      const query = typeof msg.query === "string" ? msg.query.trim() : ""
      return query ? { type: "claude", id, ...await askClaude(query) } : { type: "claude", id, results: [] }
    }

    case "test": {
      const url = Validate.validateURL(msg.url)
      if (!url) return { type: "error", id, error: `«${msg.url}» no es una URL válida` }
      Safari.open(url)
      return { type: "tested", id }
    }
  }
  return { type: "error", id, error: "Mensaje no válido" }
}

/**
 * Asks Claude for URLs without any alert; the page asks for the key itself.
 * @param {string} query
 * @returns {Promise<Object>} { results } | { needKey, error? } | { error }
 */
async function askClaude(query) {
  const clean = typeof query === "string" ? query.trim() : ""
  if (!clean) return { error: "Escribí un nombre primero" }
  const apiKey = await Schemes.getApiKey()
  if (!apiKey) return { needKey: true }
  try {
    return { results: await Schemes.askClaude(clean, apiKey) }
  } catch (error) {
    if (error.keyError) return { needKey: true, error: `Claude rechazó la clave: ${error.message}` }
    return { error: `Error de Claude: ${error.message}` }
  }
}

// ============================================
// SIRI / SHORTCUTS
// ============================================

/**
 * Reads text passed in from a Shortcut ("Run Script" parameter)
 * @returns {string|null}
 */
function getShortcutQuery() {
  const param = args.shortcutParameter
  if (typeof param === "string" && param.trim()) return param.trim()
  const texts = args.plainTexts || []
  if (texts.length && texts[0].trim()) return texts[0].trim()
  return null
}

/**
 * Adds an item without any UI, for Siri. Replies through the Shortcut output.
 * Apps go to the left column, shortcuts to the right, matching the current layout.
 * @param {string} query - e.g. "Spotify" or "shortcut Leer QR"
 * @returns {Promise<string>} Message for Siri to speak
 */
async function addFromSiri(query) {
  const request = ZenTrateConfig.parseSiriQuery(query)
  let picked = null

  if (request.kind === "shortcut") {
    picked = Schemes.shortcutItem(request.name)
  } else {
    try {
      picked = await Schemes.resolve(request.query)
    } catch (error) {
      return `Claude error: ${error.message}`
    }
  }

  if (!picked) return `I couldn't find a URL for "${query}".`

  const config = loadConfig()
  if (config.items.some(i => i.name === picked.name)) {
    return `${picked.name} is already in ZenTrate.`
  }

  const result = ZenTrateConfig.addItem(config, { name: picked.name, scheme: picked.scheme, column: request.column })
  if (!result.ok) return `Couldn't add ${picked.name}: ${result.error}`

  const stats = ZenTrateConfig.loadStats()
  const trained = ZenTrateConfig.startTraining(result.config, stats, new Date())
  saveConfig(trained.config)
  saveStatsIfChanged(stats, trained.stats)

  return `Added ${picked.name} to ZenTrate.`
}

// ============================================
// WIDGET
// ============================================

function createLauncherWidget() {
  const themeConfig = Theme.loadTheme()
  const widget = Widget.createWidget({ theme: themeConfig, url: Widget.buildActionURL(Script.name()) })
  widget.addSpacer()
  const label = widget.addText("Editar ZenTrate")
  label.font = Theme.getFont(16, { theme: themeConfig })
  label.textColor = Theme.getTextColor(themeConfig)
  label.centerAlignText()
  widget.addSpacer()
  return widget
}

// ============================================
// MAIN
// ============================================

if (Widget.isWidget()) {
  Script.setWidget(createLauncherWidget())
} else {
  await ZenTrateConfig.downloadFiles()
  await Theme.downloadThemes()

  const shortcutQuery = getShortcutQuery()
  if (shortcutQuery) {
    Script.setShortcutOutput(await addFromSiri(shortcutQuery))
  } else {
    await openEditor()
  }
}

Script.complete()
