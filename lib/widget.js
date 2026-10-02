// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-gray; icon-glyph: th-large;
/**
 * lib/widget.js - Widget runtime helpers.
 *
 * Bootstraps a ListWidget with theme-aware background, decides whether to
 * setWidget() vs. presentLarge() based on invocation context, and builds
 * the scriptable:///run URLs used for tap targets, and looks up widget
 * sizes for scripts that draw their content as an image.
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

// Home screen widget sizes in points, keyed by portrait screen size:
// [small side, medium width, medium height, large width, large height].
// iPhone 16 Pro and Pro Max entries are approximations.
const SIZE_TABLE = {
  "430x932": [170, 364, 170, 364, 382],
  "428x926": [170, 364, 170, 364, 382],
  "440x956": [170, 364, 170, 364, 382],
  "414x896": [169, 360, 169, 360, 379],
  "402x874": [162, 345, 162, 345, 358],
  "393x852": [158, 338, 158, 338, 354],
  "390x844": [158, 338, 158, 338, 354],
  "375x812": [155, 329, 155, 329, 345],
  "414x736": [159, 348, 157, 348, 357],
  "375x667": [148, 321, 148, 321, 324],
  "320x568": [141, 292, 141, 292, 311]
}

/**
 * Size of a home screen widget on this device, for drawing it as an image.
 * Lock screen accessories have no fixed size, so they get null.
 * @param {string} [family] - config.widgetFamily; defaults to "medium"
 * @param {Object} [screenSize] - { width, height } in points; defaults to Device.screenSize()
 * @returns {Object|null} { width, height }
 */
function widgetSize(family, screenSize) {
  family = family || "medium"
  if (family.startsWith("accessory")) return null
  const screen = screenSize || Device.screenSize()
  const w = Math.min(screen.width, screen.height)
  const h = Math.max(screen.width, screen.height)
  const wide = Math.round(0.867 * w)
  const [small, mediumWidth, mediumHeight, largeWidth, largeHeight] = SIZE_TABLE[`${w}x${h}`] || [
    Math.round(0.405 * w), wide, Math.round(0.405 * w), wide, Math.round(0.906 * w)
  ]
  if (family === "small") return { width: small, height: small }
  if (family === "medium") return { width: mediumWidth, height: mediumHeight }
  return { width: largeWidth, height: largeHeight }
}

function getActionParams() {
  return args.queryParameters || {}
}

module.exports = {
  createWidget,
  isWidget,
  isApp,
  buildActionURL,
  getActionParams,
  widgetSize
}
