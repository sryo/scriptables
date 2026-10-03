// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-gray; icon-glyph: palette;
/**
 * lib/theme.js - The one source of truth for themes.
 *
 * Two halves:
 *   - A pure model (normalizeTheme … toCss) that touches no Scriptable global
 *     and no other module, so Node tests, widgets and editor pages all run
 *     the same code. toScriptableFont is the only place that builds a Font.
 *   - Persistence and Scriptable adapters (loadTheme … getAccentColor) built
 *     on top of it.
 *
 * Memoizes the active theme at module scope. Scriptable spawns a fresh JS
 * context per widget render, so cross-script staleness isn't a concern.
 */

const fs = importModule("lib/fs")

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
  maxFontSize: 20,
  appearance: "auto"
}

const MIN_FONT_SIZE = 8
const MAX_FONT_SIZE = 72
const COLOR_FIELDS = ["bgColor", "textColor", "accentColor"]
const APPEARANCES = ["auto", "dark", "light"]
const VARIANTS = ["light", "dark"]

// CSS numeric weights; Apple's ultraLight is lighter than thin
const FONT_WEIGHTS = {
  ultraLight: 100, thin: 200, light: 300, regular: 400, medium: 500,
  semibold: 600, bold: 700, heavy: 800, black: 900
}

// ============================================
// FONT CATALOG
// ============================================

const SYSTEM_CSS = "-apple-system, system-ui, sans-serif"

function face(postScript, weight, italic = false) {
  return { postScript, weight, italic }
}

/**
 * Curated iOS fonts. `kind` system/rounded/mono draw with Scriptable's system
 * font factories (SF, SF Rounded, SF Mono); everything else is a list of real
 * PostScript faces. Scriptable has no serif factory, so "serif" is Times New
 * Roman. `names` are extra spellings older themes stored.
 */
const FONT_CATALOG = [
  { id: "system", label: "Sistema", kind: "system", cssFamily: SYSTEM_CSS, names: ["system", "sf", "san francisco"] },
  { id: "rounded", label: "Redondeada", kind: "rounded", cssFamily: `ui-rounded, ${SYSTEM_CSS}`, names: ["rounded"] },
  { id: "mono", label: "Monoespaciada", kind: "mono", cssFamily: "ui-monospace, Menlo, monospace", names: ["mono", "monospaced", "monospace"] },
  {
    id: "serif", label: "Serif", kind: "serif", cssFamily: '"Times New Roman", serif', names: ["serif", "Times New Roman"],
    faces: [face("TimesNewRomanPSMT", 400), face("TimesNewRomanPS-ItalicMT", 400, true),
      face("TimesNewRomanPS-BoldMT", 700), face("TimesNewRomanPS-BoldItalicMT", 700, true)]
  },
  {
    id: "american-typewriter", label: "American Typewriter", kind: "custom", cssFamily: '"American Typewriter", serif',
    faces: [face("AmericanTypewriter-Light", 300), face("AmericanTypewriter", 400),
      face("AmericanTypewriter-Semibold", 600), face("AmericanTypewriter-Bold", 700)]
  },
  {
    id: "avenir-next", label: "Avenir Next", kind: "custom", cssFamily: `"Avenir Next", ${SYSTEM_CSS}`,
    faces: [face("AvenirNext-UltraLight", 200), face("AvenirNext-Regular", 400), face("AvenirNext-Medium", 500),
      face("AvenirNext-DemiBold", 600), face("AvenirNext-Bold", 700), face("AvenirNext-Heavy", 800),
      face("AvenirNext-UltraLightItalic", 200, true), face("AvenirNext-Italic", 400, true),
      face("AvenirNext-MediumItalic", 500, true), face("AvenirNext-DemiBoldItalic", 600, true),
      face("AvenirNext-BoldItalic", 700, true), face("AvenirNext-HeavyItalic", 800, true)]
  },
  {
    id: "baskerville", label: "Baskerville", kind: "custom", cssFamily: "Baskerville, serif",
    faces: [face("Baskerville", 400), face("Baskerville-SemiBold", 600), face("Baskerville-Bold", 700),
      face("Baskerville-Italic", 400, true), face("Baskerville-SemiBoldItalic", 600, true), face("Baskerville-BoldItalic", 700, true)]
  },
  {
    id: "courier", label: "Courier", kind: "custom", cssFamily: "Courier, monospace",
    faces: [face("Courier", 400), face("Courier-Bold", 700), face("Courier-Oblique", 400, true), face("Courier-BoldOblique", 700, true)]
  },
  {
    id: "didot", label: "Didot", kind: "custom", cssFamily: "Didot, serif",
    faces: [face("Didot", 400), face("Didot-Bold", 700), face("Didot-Italic", 400, true)]
  },
  {
    id: "din-alternate", label: "DIN Alternate", kind: "custom", cssFamily: `"DIN Alternate", ${SYSTEM_CSS}`,
    faces: [face("DINAlternate-Bold", 700)]
  },
  {
    id: "din-condensed", label: "DIN Condensed", kind: "custom", cssFamily: `"DIN Condensed", ${SYSTEM_CSS}`,
    faces: [face("DINCondensed-Bold", 700)]
  },
  {
    id: "futura", label: "Futura", kind: "custom", cssFamily: `Futura, ${SYSTEM_CSS}`,
    faces: [face("Futura-Medium", 500), face("Futura-Bold", 700), face("Futura-MediumItalic", 500, true)]
  },
  {
    id: "georgia", label: "Georgia", kind: "custom", cssFamily: "Georgia, serif",
    faces: [face("Georgia", 400), face("Georgia-Bold", 700), face("Georgia-Italic", 400, true), face("Georgia-BoldItalic", 700, true)]
  },
  {
    id: "gill-sans", label: "Gill Sans", kind: "custom", cssFamily: `"Gill Sans", ${SYSTEM_CSS}`,
    faces: [face("GillSans-Light", 300), face("GillSans", 400), face("GillSans-SemiBold", 600), face("GillSans-Bold", 700),
      face("GillSans-UltraBold", 800), face("GillSans-LightItalic", 300, true), face("GillSans-Italic", 400, true),
      face("GillSans-SemiBoldItalic", 600, true), face("GillSans-BoldItalic", 700, true)]
  },
  {
    id: "helvetica-neue", label: "Helvetica Neue", kind: "custom", cssFamily: `"Helvetica Neue", ${SYSTEM_CSS}`,
    // HelveticaNeue-Regular isn't a real face; older themes stored it
    names: ["HelveticaNeue-Regular"],
    faces: [face("HelveticaNeue-UltraLight", 100), face("HelveticaNeue-Thin", 200), face("HelveticaNeue-Light", 300),
      face("HelveticaNeue", 400), face("HelveticaNeue-Medium", 500), face("HelveticaNeue-Bold", 700),
      face("HelveticaNeue-UltraLightItalic", 100, true), face("HelveticaNeue-ThinItalic", 200, true),
      face("HelveticaNeue-LightItalic", 300, true), face("HelveticaNeue-Italic", 400, true),
      face("HelveticaNeue-MediumItalic", 500, true), face("HelveticaNeue-BoldItalic", 700, true)]
  },
  {
    id: "marker-felt", label: "Marker Felt", kind: "custom", cssFamily: `"Marker Felt", ${SYSTEM_CSS}`,
    faces: [face("MarkerFelt-Thin", 300), face("MarkerFelt-Wide", 700)]
  },
  {
    id: "menlo", label: "Menlo", kind: "custom", cssFamily: "Menlo, monospace",
    faces: [face("Menlo-Regular", 400), face("Menlo-Bold", 700), face("Menlo-Italic", 400, true), face("Menlo-BoldItalic", 700, true)]
  },
  {
    id: "verdana", label: "Verdana", kind: "custom", cssFamily: `Verdana, ${SYSTEM_CSS}`,
    faces: [face("Verdana", 400), face("Verdana-Bold", 700), face("Verdana-Italic", 400, true), face("Verdana-BoldItalic", 700, true)]
  },
  {
    id: "zapfino", label: "Zapfino", kind: "custom", cssFamily: "Zapfino, cursive",
    faces: [face("Zapfino", 400)]
  }
]

// ============================================
// PURE MODEL
// ============================================

function parseHex(value) {
  if (typeof value !== "string") return null
  const clean = value.trim().replace(/^#/, "").toUpperCase()
  return /^[0-9A-F]{6}$/.test(clean) ? clean : null
}

function parseWeight(value) {
  if (typeof value !== "string") return null
  const lower = value.trim().toLowerCase()
  return Object.keys(FONT_WEIGHTS).find(w => w.toLowerCase() === lower) || null
}

/** true, false, or null when the value isn't a recognizable boolean. */
function parseBoolean(value) {
  if (value === true || value === false) return value
  if (value === undefined || value === null || value === 0 || value === 1) return value === 1
  const text = String(value).trim().toLowerCase()
  if (text === "true" || text === "1") return true
  if (text === "false" || text === "0" || text === "") return false
  return null
}

function parseSize(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value !== "string" || !value.trim()) return null
  const n = Number(value.trim())
  return Number.isFinite(n) ? n : null
}

function fontKey(name) {
  return String(name || "").toLowerCase().replace(/[\s_-]+/g, "")
}

/**
 * The catalog family a stored fontName refers to: an id, a label, a legacy
 * spelling, or any of its PostScript face names (case and spacing ignored).
 * @param {string} fontName
 * @returns {Object|null} FONT_CATALOG entry
 */
function findFontFamily(fontName) {
  const key = fontKey(fontName)
  if (!key) return null
  return FONT_CATALOG.find(f =>
    [f.id, f.label, ...(f.names || []), ...(f.faces || []).map(x => x.postScript)].some(n => fontKey(n) === key)
  ) || null
}

/**
 * Cleans any stored or typed theme into the canonical shape every consumer
 * reads. Missing fields take DEFAULT_THEME's value silently; present but
 * invalid ones do too, with a warning. Unknown fields are kept, `filename`
 * and `active` (picker bookkeeping) are dropped.
 *
 * Appearance: `light` / `dark` hold optional per-appearance colors; any color
 * they leave out comes from the flat fields. `appearance` "auto" follows the
 * device, "dark"/"light" force a variant. A flat theme without variants looks
 * the same whatever the appearance, exactly as before variants existed.
 *
 * @param {Object} raw
 * @returns {Object} { theme, warnings: [{ field, message }] }
 */
function normalizeTheme(raw) {
  const input = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}
  const warnings = []
  const warn = (field, message) => warnings.push({ field, message })
  const present = key => input[key] !== undefined && input[key] !== null && input[key] !== ""

  const colors = {}
  for (const key of COLOR_FIELDS) {
    const hex = parseHex(input[key])
    if (!hex && present(key)) warn(key, `"${input[key]}" no es un color hex válido; se usa ${DEFAULT_THEME[key]}`)
    colors[key] = hex || DEFAULT_THEME[key]
  }

  const sizes = {}
  for (const key of ["minFontSize", "maxFontSize"]) {
    let size = parseSize(input[key])
    if (size === null) {
      if (present(key)) warn(key, `"${input[key]}" no es un tamaño; se usa ${DEFAULT_THEME[key]}`)
      size = DEFAULT_THEME[key]
    } else if (size < MIN_FONT_SIZE || size > MAX_FONT_SIZE) {
      warn(key, `${size} queda fuera de ${MIN_FONT_SIZE}–${MAX_FONT_SIZE}`)
      size = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, size))
    }
    sizes[key] = size
  }
  if (sizes.minFontSize > sizes.maxFontSize) {
    warn("minFontSize", "El mínimo era mayor que el máximo; se invirtieron")
    ;[sizes.minFontSize, sizes.maxFontSize] = [sizes.maxFontSize, sizes.minFontSize]
  }

  let fontWeight = parseWeight(input.fontWeight)
  if (!fontWeight) {
    if (present("fontWeight")) {
      warn("fontWeight", `Peso "${input.fontWeight}" desconocido; se usa regular`)
      fontWeight = "regular"
    } else {
      fontWeight = DEFAULT_THEME.fontWeight
    }
  }

  let fontItalic = parseBoolean(input.fontItalic)
  if (fontItalic === null) {
    warn("fontItalic", `"${input.fontItalic}" no es sí ni no; se usa no`)
    fontItalic = false
  }

  let fontName = typeof input.fontName === "string" && input.fontName.trim() ? input.fontName.trim() : DEFAULT_THEME.fontName
  const family = findFontFamily(fontName)
  if (family && family.kind !== "custom" && family.kind !== "serif") fontName = family.id
  if (family && family.id === "serif" && fontKey(fontName) === "serif") fontName = "serif"

  let appearance = typeof input.appearance === "string" ? input.appearance.trim().toLowerCase() : ""
  if (!APPEARANCES.includes(appearance)) {
    if (present("appearance")) warn("appearance", `Apariencia "${input.appearance}" desconocida; se usa auto`)
    appearance = DEFAULT_THEME.appearance
  }

  const variants = {}
  for (const variant of VARIANTS) {
    const block = input[variant]
    if (!block || typeof block !== "object") continue
    const clean = {}
    for (const key of COLOR_FIELDS) {
      if (block[key] === undefined || block[key] === null || block[key] === "") continue
      const hex = parseHex(block[key])
      if (hex) clean[key] = hex
      else warn(`${variant}.${key}`, `"${block[key]}" no es un color hex válido; se usa el color base`)
    }
    if (Object.keys(clean).length) variants[variant] = clean
  }

  const { filename: _f, active: _a, source, ...rest } = input
  const theme = {
    ...rest,
    name: typeof input.name === "string" && input.name.trim() ? input.name.trim() : DEFAULT_THEME.name,
    author: typeof input.author === "string" ? input.author.trim() : "",
    ...colors,
    fontName,
    fontWeight,
    fontItalic,
    ...sizes,
    appearance
  }
  delete theme.light
  delete theme.dark
  Object.assign(theme, variants)
  if (typeof source === "string" && source) theme.source = source
  return { theme, warnings }
}

function hasVariants(theme) {
  return !!(theme && (theme.light || theme.dark))
}

/**
 * Field errors for editor input (strings straight from a form are fine).
 * @param {Object} theme
 * @returns {Object} { ok, errors: { field: "mensaje" } }
 */
function validateTheme(theme) {
  const t = theme || {}
  const errors = {}
  const blank = v => v === undefined || v === null || String(v).trim() === ""
  const HEX_ERROR = "Usá un color hex de 6 dígitos, por ejemplo 1A2B3C"

  if (blank(t.name)) errors.name = "Poné un nombre para el tema"
  for (const key of ["bgColor", "textColor"]) {
    if (!parseHex(t[key])) errors[key] = HEX_ERROR
  }
  if (!blank(t.accentColor) && !parseHex(t.accentColor)) errors.accentColor = HEX_ERROR

  const sizeOf = v => /^\d+$/.test(String(v ?? "").trim()) ? Number(String(v).trim()) : NaN
  const inRange = n => n >= MIN_FONT_SIZE && n <= MAX_FONT_SIZE
  const min = sizeOf(t.minFontSize)
  const max = sizeOf(t.maxFontSize)
  if (!inRange(min)) errors.minFontSize = `El tamaño mínimo debe ser un número entero entre ${MIN_FONT_SIZE} y ${MAX_FONT_SIZE}`
  if (!inRange(max)) errors.maxFontSize = `El tamaño máximo debe ser un número entero entre ${MIN_FONT_SIZE} y ${MAX_FONT_SIZE}`
  if (inRange(min) && inRange(max) && min > max) errors.maxFontSize = "El máximo no puede ser menor que el mínimo"

  if (!blank(t.fontWeight) && !parseWeight(String(t.fontWeight))) {
    errors.fontWeight = `Elegí un peso: ${Object.keys(FONT_WEIGHTS).join(", ")}`
  }
  const fontName = blank(t.fontName) ? "" : String(t.fontName).trim()
  if (!fontName) {
    errors.fontName = "Elegí una fuente"
  } else if (!findFontFamily(fontName) && !/^[A-Za-z][A-Za-z0-9]*(?:[-_][A-Za-z0-9]+)*$/.test(fontName)) {
    errors.fontName = "Elegí una fuente del catálogo o un nombre PostScript, por ejemplo AvenirNext-Bold"
  }
  if (parseBoolean(t.fontItalic) === null) errors.fontItalic = "Usá true o false"
  if (!blank(t.appearance) && !APPEARANCES.includes(String(t.appearance).trim().toLowerCase())) {
    errors.appearance = "Elegí automático, oscuro o claro"
  }
  for (const variant of VARIANTS) {
    const block = t[variant]
    if (block === undefined || block === null) continue
    if (typeof block !== "object") { errors[variant] = "Los colores de la variante no son válidos"; continue }
    for (const key of COLOR_FIELDS) {
      if (!blank(block[key]) && !parseHex(block[key])) errors[`${variant}.${key}`] = HEX_ERROR
    }
  }
  return { ok: Object.keys(errors).length === 0, errors }
}

/**
 * Which variant a theme shows when the device is in `systemAppearance`.
 * @param {Object} theme
 * @param {string} systemAppearance - "dark" | "light"
 * @returns {string} "dark" | "light"
 */
function effectiveAppearance(theme, systemAppearance) {
  const forced = theme && typeof theme.appearance === "string" ? theme.appearance.toLowerCase() : "auto"
  if (forced === "dark" || forced === "light") return forced
  return systemAppearance === "light" ? "light" : "dark"
}

/**
 * @param {Object} theme
 * @param {string} appearance - "dark" | "light"
 * @returns {Object} { bgColor, textColor, accentColor } as 6-digit hex without '#'
 */
function resolveColors(theme, appearance) {
  const t = normalizeTheme(theme).theme
  const variant = t[appearance === "light" ? "light" : "dark"] || {}
  const out = {}
  for (const key of COLOR_FIELDS) out[key] = variant[key] || t[key]
  return out
}

function relativeLuminance(hex) {
  const clean = parseHex(hex)
  if (!clean) return null
  const [r, g, b] = [0, 2, 4].map(i => {
    const c = parseInt(clean.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * WCAG 2.x contrast ratio, rounded to two decimals.
 * @returns {number|null} 1–21, or null for an invalid color
 */
function contrastRatio(hexA, hexB) {
  const a = relativeLuminance(hexA)
  const b = relativeLuminance(hexB)
  if (a === null || b === null) return null
  const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
  return Math.round(ratio * 100) / 100
}

function nearestFace(faces, weight, italic) {
  const pool = faces.some(f => f.italic === italic) ? faces.filter(f => f.italic === italic) : faces
  const target = FONT_WEIGHTS[weight]
  // Ties go heavier for bold-ish requests and lighter otherwise, like CSS
  return pool.reduce((best, f) => {
    const d = Math.abs(f.weight - target)
    const bestD = Math.abs(best.weight - target)
    if (d < bestD) return f
    if (d === bestD && (target >= 500 ? f.weight > best.weight : f.weight < best.weight)) return f
    return best
  })
}

function weightName(cssWeight) {
  return Object.keys(FONT_WEIGHTS).find(w => FONT_WEIGHTS[w] === cssWeight) || "regular"
}

function cssName(name) {
  return String(name).replace(/["'\\<>;{}()\n\r]/g, "")
}

/**
 * What a theme's text looks like at `size`: the same answer for the widget
 * (toScriptableFont) and the editor (toCss). For catalog families the face
 * nearest to the requested weight/italic is picked, so the CSS names that
 * exact face instead of synthesizing bold or italic.
 *
 * @param {Object} theme
 * @param {number|string} size
 * @param {Object} [overrides] - { weight, italic, fontName }
 * @returns {Object} { kind: "system"|"rounded"|"serif"|"mono"|"custom", family, postScript,
 *   weight, italic, size, cssFamily, cssWeight, cssStyle }
 */
function fontSpec(theme, size, overrides = {}) {
  const t = normalizeTheme(theme).theme
  const o = overrides || {}
  const fontName = typeof o.fontName === "string" && o.fontName.trim() ? o.fontName.trim() : t.fontName
  const weight = parseWeight(o.weight) || t.fontWeight
  const italic = o.italic !== undefined && o.italic !== null ? parseBoolean(o.italic) === true : t.fontItalic
  const px = parseSize(size) ?? t.minFontSize
  const family = findFontFamily(fontName)

  if (!family) {
    // Unknown names pass through; iOS draws that one face, so CSS asks for no weight or style
    const safe = cssName(fontName)
    return {
      kind: "custom", family: null, postScript: fontName, weight: "regular", italic: false, size: px,
      cssFamily: `"${safe}", ${SYSTEM_CSS}`, cssWeight: 400, cssStyle: "normal"
    }
  }

  if (!family.faces) {
    // Scriptable's only italic system factory is the regular-weight one; rounded and mono have none
    const isItalic = family.kind === "system" && italic
    const w = isItalic ? "regular" : weight
    return {
      kind: family.kind, family: family.id, postScript: null, weight: w, italic: isItalic, size: px,
      cssFamily: family.cssFamily, cssWeight: FONT_WEIGHTS[w], cssStyle: isItalic ? "italic" : "normal"
    }
  }

  const chosen = nearestFace(family.faces, weight, italic)
  return {
    kind: family.kind, family: family.id, postScript: chosen.postScript, weight: weightName(chosen.weight),
    italic: chosen.italic, size: px,
    cssFamily: `"${chosen.postScript}", ${family.cssFamily}`, cssWeight: chosen.weight,
    cssStyle: chosen.italic ? "italic" : "normal"
  }
}

/**
 * @param {Object} spec - from fontSpec
 * @returns {Object} { fontFamily, fontWeight, fontStyle, fontSize, declaration }
 */
function toCss(spec) {
  const fontSize = `${spec.size}px`
  return {
    fontFamily: spec.cssFamily,
    fontWeight: spec.cssWeight,
    fontStyle: spec.cssStyle,
    fontSize,
    declaration: `font-family: ${spec.cssFamily}; font-weight: ${spec.cssWeight}; font-style: ${spec.cssStyle}; font-size: ${fontSize}`
  }
}

const MODEL_FUNCTIONS = [
  parseHex, parseWeight, parseBoolean, parseSize, fontKey, findFontFamily, normalizeTheme, hasVariants,
  validateTheme, effectiveAppearance, resolveColors, relativeLuminance, contrastRatio,
  nearestFace, weightName, cssName, fontSpec, toCss
]

/**
 * The pure model as script source, for WebView pages that need the same
 * answers as the widgets. Safe inside an inline <script>.
 * @returns {string}
 */
function modelSource() {
  const constants = {
    DEFAULT_THEME, MIN_FONT_SIZE, MAX_FONT_SIZE, COLOR_FIELDS, APPEARANCES, VARIANTS, FONT_WEIGHTS, SYSTEM_CSS, FONT_CATALOG
  }
  const json = value => JSON.stringify(value).replace(/</g, "\\u003c")
  return [
    ...Object.entries(constants).map(([name, value]) => `const ${name} = ${json(value)}`),
    ...MODEL_FUNCTIONS.map(fn => fn.toString())
  ].join("\n")
}

// ============================================
// SCRIPTABLE ADAPTERS
// ============================================

/**
 * The only place that builds a Scriptable Font.
 * @param {Object} spec - from fontSpec
 * @returns {Font}
 */
function toScriptableFont(spec) {
  const factory = name => typeof Font[name] === "function" ? Font[name](spec.size) : Font.systemFont(spec.size)
  try {
    switch (spec.kind) {
      case "system": return spec.italic ? Font.italicSystemFont(spec.size) : factory(`${spec.weight}SystemFont`)
      case "rounded": return factory(`${spec.weight}RoundedSystemFont`)
      case "mono": return factory(`${spec.weight}MonospacedSystemFont`)
      default: return new Font(spec.postScript, spec.size)
    }
  } catch (e) {
    console.error(`lib/theme: Font error, falling back to system: ${e.message}`)
    return Font.systemFont(spec.size)
  }
}

let _cachedTheme = null

function logWarnings(warnings, where) {
  for (const w of warnings) console.warn(`lib/theme: ${where} ${w.field}: ${w.message}`)
}

/** The active theme, normalized; `source` names the ZenThemes file it came from. */
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
  const { theme, warnings } = normalizeTheme({ ...DEFAULT_THEME, ...(stored || {}) })
  logWarnings(warnings, "active theme")
  _cachedTheme = theme
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

/** What a ZenThemes file stores: normalized, without bookkeeping. */
function themeData(theme) {
  const { source: _, ...data } = normalizeTheme(theme).theme
  return data
}

/**
 * Makes `theme` the active one.
 * @param {Object} theme
 * @param {string} [source] - its ZenThemes filename; defaults to theme.filename or theme.source
 */
function saveTheme(theme, source) {
  const src = source !== undefined ? source : (theme && (theme.filename || theme.source))
  const data = themeData(theme)
  if (src) data.source = src
  fs.saveJSON(THEME_PATH, data, true)
  _cachedTheme = normalizeTheme(data).theme
}

/** Normalized themes from ZenThemes/, sorted by name, each with `filename` and `active`. */
function loadAllThemes() {
  fs.ensureDirectory(THEMES_FOLDER)
  const files = fs.listDirectory(THEMES_FOLDER)
  const activeSource = loadTheme().source
  const themes = []

  for (const file of files) {
    if (!file.endsWith('.json')) continue
    const themePath = fs.fm.joinPath(THEMES_FOLDER, file)
    try {
      const raw = fs.loadJSON(themePath, null)
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        const { theme, warnings } = normalizeTheme({ ...raw, name: raw.name || file.replace(/\.json$/, '') })
        logWarnings(warnings, file)
        theme.filename = file
        theme.active = file === activeSource
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

function themePath(filename) {
  if (typeof filename !== "string" || !/^[^/\\.][^/\\]*\.json$/.test(filename)) {
    throw new Error(`lib/theme: Invalid theme filename "${filename}"`)
  }
  return fs.fm.joinPath(THEMES_FOLDER, filename)
}

/**
 * Saves `theme` under a filename no other theme uses (noir.json, noir-2.json…).
 * @returns {string} the filename
 */
function saveAsNew(theme) {
  fs.ensureDirectory(THEMES_FOLDER)
  const base = themeFilename(normalizeTheme(theme).theme.name).replace(/\.json$/, "")
  let filename = `${base}.json`
  for (let n = 2; fs.fileExists(fs.fm.joinPath(THEMES_FOLDER, filename)); n++) filename = `${base}-${n}.json`
  fs.saveJSON(themePath(filename), themeData(theme), true)
  return filename
}

/**
 * Overwrites the theme stored in `filename`, keeping the filename even if the
 * name changed. If it's the active theme's source, the active copy follows.
 * @returns {string} the filename
 */
function updateTheme(filename, theme) {
  const path = themePath(filename)
  fs.ensureDirectory(THEMES_FOLDER)
  fs.saveJSON(path, themeData(theme), true)
  if (loadTheme().source === filename) saveTheme(theme, filename)
  return filename
}

/**
 * Activates the theme stored in ZenThemes/<filename>.
 * @returns {Object|null} the active theme, or null if the file can't be read
 */
function applyTheme(filename) {
  const raw = fs.loadJSON(themePath(filename), null)
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  saveTheme(raw, filename)
  return loadTheme()
}

/**
 * Deletes a stored theme. The active theme's source can't be deleted.
 * @returns {Object} { ok, error? }
 */
function deleteTheme(filename) {
  const path = themePath(filename)
  if (loadTheme().source === filename) return { ok: false, error: "No podés borrar el tema activo. Elegí otro primero." }
  if (!fs.fileExists(path)) return { ok: false, error: "Ese tema ya no existe." }
  fs.fm.remove(path)
  return { ok: true }
}

/**
 * Updates `filename` only when it holds the same theme (same name) or nothing;
 * otherwise saves a new file, so a different theme is never overwritten.
 * @returns {string} the filename written
 */
function saveThemeToFolder(theme, filename = null) {
  if (filename) {
    const path = themePath(filename)
    if (!fs.fileExists(path)) {
      fs.ensureDirectory(THEMES_FOLDER)
      fs.saveJSON(path, themeData(theme), true)
      return filename
    }
    const existing = fs.loadJSON(path, null)
    if (existing && existing.name === normalizeTheme(theme).theme.name) return updateTheme(filename, theme)
  }
  return saveAsNew(theme)
}

// ============================================
// FONTS
// ============================================

function getFont(size, options = {}) {
  const theme = options.theme || loadTheme()
  return toScriptableFont(fontSpec(theme, size, {
    fontName: options.fontName, weight: options.weight, italic: options.italic
  }))
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
  const validated = parseHex(hex)
  if (!validated) {
    console.error(`lib/theme: Invalid color "${hex}", using white`)
    return new Color("#FFFFFF")
  }
  return new Color("#" + validated)
}

/** Color.dynamic for an auto theme with variants, a static Color otherwise. */
function themeColor(theme, key) {
  const t = normalizeTheme(theme || loadTheme()).theme
  if (t.appearance === "auto" && hasVariants(t)) {
    return Color.dynamic(
      new Color("#" + resolveColors(t, "light")[key]),
      new Color("#" + resolveColors(t, "dark")[key])
    )
  }
  return new Color("#" + resolveColors(t, t.appearance === "light" ? "light" : "dark")[key])
}

function getBackgroundColor(theme = null) {
  return themeColor(theme, "bgColor")
}

function getTextColor(theme = null) {
  return themeColor(theme, "textColor")
}

function getAccentColor(theme = null) {
  return themeColor(theme, "accentColor")
}

function getThemeColors(theme = null) {
  return {
    background: getBackgroundColor(theme),
    text: getTextColor(theme),
    accent: getAccentColor(theme)
  }
}

/**
 * Hex colors for the appearance the device shows right now, for consumers
 * that bake colors into an image (Color.dynamic can't survive that).
 * @returns {Object} { bgColor, textColor, accentColor }
 */
function resolveForRender(theme = null) {
  const t = normalizeTheme(theme || loadTheme()).theme
  let system = "dark"
  try {
    system = Device.isUsingDarkAppearance() ? "dark" : "light"
  } catch (e) {
    console.error(`lib/theme: Could not read the appearance: ${e.message}`)
  }
  return resolveColors(t, effectiveAppearance(t, system))
}

module.exports = {
  DEFAULT_THEME,
  FONT_CATALOG,
  FONT_WEIGHTS,
  APPEARANCES,
  MIN_FONT_SIZE,
  MAX_FONT_SIZE,
  normalizeTheme,
  validateTheme,
  parseHex,
  hasVariants,
  effectiveAppearance,
  resolveColors,
  contrastRatio,
  findFontFamily,
  fontSpec,
  toCss,
  modelSource,
  toScriptableFont,
  loadTheme,
  saveTheme,
  downloadThemes,
  loadAllThemes,
  themeFilename,
  saveAsNew,
  updateTheme,
  applyTheme,
  deleteTheme,
  saveThemeToFolder,
  getFont,
  getBoldFont,
  getMediumFont,
  getRegularFont,
  colorFromHex,
  getBackgroundColor,
  getTextColor,
  getAccentColor,
  getThemeColors,
  resolveForRender
}
