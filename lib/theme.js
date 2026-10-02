// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-gray; icon-glyph: palette;
/**
 * lib/theme.js - Active theme persistence + font/color resolution.
 *
 * Memoizes the active theme at module scope. Scriptable spawns a fresh JS
 * context per widget render, so cross-script staleness isn't a concern.
 */

const fs = importModule("lib/fs")
const validate = importModule("lib/validate")

// The active theme is the only thing in lib/ that has a fixed on-disk
// filename — every other path lives in a config/ module or inline in
// the widget that owns it.
const THEME_PATH = fs.fm.joinPath(fs.baseDir, "zen_theme.json")
const LEGACY_THEME_PATH = fs.fm.joinPath(fs.baseDir, "zentrate_theme.json")
const THEMES_FOLDER = fs.fm.joinPath(fs.baseDir, "ZenThemes")

const DEFAULT_THEME = {
  name: "Noir",
  author: "sryo",
  bgColor: "000000",
  textColor: "FFFFFF",
  accentColor: "0A84FF",
  fontName: "system",
  fontWeight: "bold",
  fontItalic: false,
  minFontSize: 10,
  maxFontSize: 20
}

let _cachedTheme = null

function loadTheme() {
  if (_cachedTheme) return _cachedTheme

  // One-time rename: the active theme used to live under ZenTrate's
  // name from before the suite existed. Move it in place on first read.
  // The move fails while the legacy file is still evicted to iCloud; read
  // it from the old path then, and retry the move on a later run.
  let path = THEME_PATH
  if (!fs.fileExists(THEME_PATH) && fs.fileExists(LEGACY_THEME_PATH)) {
    try {
      fs.fm.move(LEGACY_THEME_PATH, THEME_PATH)
    } catch (e) {
      console.error(`lib/theme: Could not migrate legacy theme: ${e.message}`)
      path = LEGACY_THEME_PATH
    }
  }

  const stored = fs.loadJSON(path, null)
  _cachedTheme = { ...DEFAULT_THEME, ...(stored || {}) }
  return _cachedTheme
}

/**
 * Downloads evicted theme files from iCloud. loadTheme() is synchronous and
 * cannot wait, so scripts that can await should call this first.
 */
async function downloadThemes() {
  await fs.ensureDownloaded(THEME_PATH)
  await fs.ensureDownloaded(LEGACY_THEME_PATH)
  for (const file of fs.listDirectory(THEMES_FOLDER)) {
    await fs.ensureDownloaded(fs.fm.joinPath(THEMES_FOLDER, file))
  }
  _cachedTheme = null
}

function saveTheme(theme) {
  fs.saveJSON(THEME_PATH, theme, true)
  _cachedTheme = { ...DEFAULT_THEME, ...theme }
}

function loadAllThemes() {
  fs.ensureDirectory(THEMES_FOLDER)
  const files = fs.listDirectory(THEMES_FOLDER)
  const themes = []

  for (const file of files) {
    if (!file.endsWith('.json')) continue
    const themePath = fs.fm.joinPath(THEMES_FOLDER, file)
    try {
      const theme = fs.loadJSON(themePath, null)
      if (theme && typeof theme === 'object' && !Array.isArray(theme)) {
        if (!theme.name) theme.name = file.replace(/\.json$/, '')
        theme.filename = file
        themes.push(theme)
      }
    } catch (e) {
      console.error(`lib/theme: Error loading theme ${file}: ${e.message}`)
    }
  }

  return themes.sort((a, b) => String(a.name).localeCompare(String(b.name)))
}

function themeFilename(name) {
  const slug = String(name || '').trim().toLowerCase()
    .replace(/[\s/\\:]+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
  return `${slug || 'theme'}.json`
}

function saveThemeToFolder(theme, filename = null) {
  fs.ensureDirectory(THEMES_FOLDER)
  const fname = filename || themeFilename(theme.name)
  const path = fs.fm.joinPath(THEMES_FOLDER, fname)
  fs.saveJSON(path, theme, true)
}

// ============================================
// FONTS
// ============================================

function getFont(size, options = {}) {
  const theme = options.theme || loadTheme()
  const rawFontName = String(options.fontName || theme.fontName || 'system')
  const fontName = rawFontName.toLowerCase()
  const weight = validate.validateFontWeight(options.weight || theme.fontWeight)
  const isItalic = options.italic !== undefined ? options.italic : (theme.fontItalic || false)

  try {
    // Scriptable's only italic factory is Font.italicSystemFont() — there is
    // no built-in bold-italic or italic-serif. So italic + system uses the
    // italic factory; italic + a non-system family ignores the italic flag,
    // because falling back to italicSystemFont would mean the user's chosen
    // family silently disappears. To get a real italic from a serif/mono/
    // rounded family, set fontName to a PostScript name (e.g. "Georgia-Italic").
    if (isItalic && fontName === 'system') {
      return Font.italicSystemFont(size)
    }

    if (fontName === 'system') {
      const methodName = weight + 'SystemFont'
      if (typeof Font[methodName] === 'function') return Font[methodName](size)
      return Font.systemFont(size)
    }
    if (fontName === 'serif') return Font.serifSystemFont(size)
    if (fontName === 'monospaced' || fontName === 'mono') return Font.monospaceSystemFont(size)
    if (fontName === 'rounded') return Font.roundedSystemFont(size)
    return new Font(rawFontName, size)
  } catch (e) {
    console.error(`lib/theme: Font error, falling back to system: ${e.message}`)
    return Font.systemFont(size)
  }
}

function getBoldFont(size, theme = null) {
  return getFont(size, { weight: 'bold', theme })
}

function getMediumFont(size, theme = null) {
  return getFont(size, { weight: 'medium', theme })
}

function getRegularFont(size, theme = null) {
  return getFont(size, { weight: 'regular', theme })
}

// ============================================
// COLORS
// ============================================

function colorFromHex(hex) {
  const validated = validate.validateHexColor(hex)
  if (!validated) {
    console.error(`lib/theme: Invalid color "${hex}", using white`)
    return new Color("#FFFFFF")
  }
  return new Color("#" + validated)
}

function getBackgroundColor(theme = null) {
  return colorFromHex((theme || loadTheme()).bgColor)
}

function getTextColor(theme = null) {
  return colorFromHex((theme || loadTheme()).textColor)
}

function getAccentColor(theme = null) {
  return colorFromHex((theme || loadTheme()).accentColor || "0A84FF")
}

function getThemeColors(theme = null) {
  const t = theme || loadTheme()
  return {
    background: colorFromHex(t.bgColor),
    text: colorFromHex(t.textColor),
    accent: colorFromHex(t.accentColor || "0A84FF")
  }
}

module.exports = {
  DEFAULT_THEME,
  loadTheme,
  saveTheme,
  downloadThemes,
  loadAllThemes,
  themeFilename,
  saveThemeToFolder,
  getFont,
  getBoldFont,
  getMediumFont,
  getRegularFont,
  colorFromHex,
  getBackgroundColor,
  getTextColor,
  getAccentColor,
  getThemeColors
}
