// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-gray; icon-glyph: th-large;
/**
 * lib/widget.js - Widget runtime helpers.
 *
 * Bootstraps a ListWidget with theme-aware background, decides whether to
 * setWidget() vs. presentLarge() based on invocation context, and builds
 * the scriptable:///run URLs used for tap targets.
 */

const theme = importModule("lib/theme")

function createWidget(options = {}) {
  const widget = new ListWidget()
  const activeTheme = options.theme || theme.loadTheme()

  widget.backgroundColor = theme.getBackgroundColor(activeTheme)

  if (options.url) widget.url = options.url

  const refreshMinutes = options.refreshMinutes || 5
  widget.refreshAfterDate = new Date(Date.now() + refreshMinutes * 60 * 1000)

  const padding = options.padding || [0, 16, 0, 16]
  widget.setPadding(padding[0], padding[1], padding[2], padding[3])

  return widget
}

function isWidget() {
  return config.runsInWidget
}

function isApp() {
  return config.runsInApp
}

function buildActionURL(scriptName, params = {}) {
  let url = `scriptable:///run?scriptName=${encodeURIComponent(scriptName)}`
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url += `&${key}=${encodeURIComponent(value)}`
    }
  }
  return url
}

function getActionParams() {
  return args.queryParameters || {}
}

module.exports = {
  createWidget,
  isWidget,
  isApp,
  buildActionURL,
  getActionParams
}
