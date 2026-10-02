// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-gray; icon-glyph: search;
/**
 * lib/schemes.js - Finds the URL that opens an app: bundled catalog, shortcut URLs, Claude fallback.
 *
 * Consumer-agnostic: returns { name, scheme } candidates and knows nothing about launcher configs.
 */

// ============================================
// CATALOG
// ============================================

// [name, scheme, ...aliases]. Aliases include Spanish names so "Fotos" finds Photos.
const CATALOG = [
  // Apple
  ["Settings", "App-prefs://", "ajustes", "configuracion", "preferences"],
  ["App Store", "itms-apps://"],
  ["Books", "ibooks://", "libros"],
  ["Calculator", "calc://", "calculadora"],
  ["Calendar", "calshow://", "calendario", "agenda"],
  ["Clock", "clock-alarm://", "reloj", "alarma", "alarm"],
  ["FaceTime", "facetime://"],
  ["Files", "shareddocuments://", "archivos"],
  ["Find My", "findmy://", "encontrar", "buscar mi iphone"],
  ["Health", "x-apple-health://", "salud"],
  ["Home", "com.apple.home://", "casa", "domotica"],
  ["Mail", "message://", "correo", "email"],
  ["Maps", "maps://", "mapas"],
  ["Messages", "sms://", "mensajes", "imessage", "sms"],
  ["Music", "music://", "musica", "apple music"],
  ["Notes", "mobilenotes://", "notas"],
  ["Phone", "mobilephone://", "telefono", "llamadas"],
  ["Photos", "photos-redirect://", "fotos", "galeria"],
  ["Podcasts", "podcasts://"],
  ["Reminders", "x-apple-reminderkit://", "recordatorios"],
  ["Safari", "x-web-search://", "navegador", "browser"],
  ["Scriptable", "scriptable://"],
  ["Shortcuts", "shortcuts://", "atajos"],
  ["Stocks", "stocks://", "bolsa", "acciones"],
  ["Voice Memos", "voicememos://", "notas de voz", "grabadora"],
  ["Wallet", "shoebox://", "cartera", "billetera"],
  ["Weather", "weather://", "clima", "tiempo"],

  // Messaging and social
  ["WhatsApp", "whatsapp://"],
  ["Telegram", "tg://"],
  ["Signal", "sgnl://"],
  ["Messenger", "fb-messenger://"],
  ["Instagram", "instagram://app"],
  ["Facebook", "fb://"],
  ["Threads", "barcelona://"],
  ["X", "twitter://", "twitter"],
  ["TikTok", "snssdk1233://"],
  ["Snapchat", "snapchat://"],
  ["Reddit", "reddit://"],
  ["Pinterest", "pinterest://"],
  ["LinkedIn", "linkedin://"],
  ["Discord", "discord://"],
  ["Slack", "slack://"],
  ["Microsoft Teams", "msteams://", "teams"],
  ["Zoom", "zoomus://"],

  // Google
  ["Google", "google://"],
  ["Gmail", "googlegmail://"],
  ["Google Maps", "comgooglemaps://"],
  ["Google Chrome", "googlechrome://", "chrome"],
  ["Google Photos", "googlephotos://"],
  ["Google Drive", "googledrive://", "drive"],
  ["Google Calendar", "googlecalendar://"],
  ["Google Authenticator", "googleauthenticator://", "authenticator", "doble factor", "2fa"],
  ["YouTube", "youtube://"],
  ["YouTube Music", "youtubemusic://"],

  // Media
  ["Spotify", "spotify://"],
  ["Shazam", "shazam://"],
  ["SoundCloud", "soundcloud://"],
  ["Deezer", "deezer://"],
  ["Overcast", "overcast://"],
  ["Pocket Casts", "pktc://"],
  ["Audible", "audible://"],
  ["Kindle", "kindle://"],
  ["Netflix", "nflx://"],
  ["Disney+", "disneyplus://", "disney plus"],
  ["Prime Video", "aiv://", "amazon prime video"],
  ["Twitch", "twitch://"],
  ["Feedly", "feedly://"],

  // Productivity
  ["Notion", "notion://"],
  ["Obsidian", "obsidian://"],
  ["Things", "things:///"],
  ["Todoist", "todoist://"],
  ["Trello", "trello://"],
  ["Evernote", "evernote://"],
  ["Bear", "bear://"],
  ["Drafts", "drafts://"],
  ["1Password", "onepassword://"],
  ["Outlook", "ms-outlook://"],
  ["GitHub", "github://"],
  ["Figma", "figma://"],

  // Browsers
  ["Firefox", "firefox://"],
  ["Microsoft Edge", "microsoft-edge://", "edge"],
  ["Brave", "brave://"],

  // Travel, shopping, money
  ["Waze", "waze://"],
  ["Uber", "uber://"],
  ["Lyft", "lyft://"],
  ["Cabify", "cabify://"],
  ["Airbnb", "airbnb://"],
  ["Booking.com", "booking://", "booking"],
  ["Amazon", "com.amazon.mobile.shopping://"],
  ["Mercado Libre", "meli://"],
  ["Mercado Pago", "mercadopago://"],
  ["PayPal", "paypal://"],
  ["Venmo", "venmo://"],

  // Other
  ["Duolingo", "duolingo://"],
  ["Strava", "strava://"]
]

/**
 * Lowercases and strips accents so "Música" matches "musica"
 * @param {string} str
 * @returns {string}
 */
function normalize(str) {
  return (str || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim()
}

/**
 * Searches the bundled catalog
 * @param {string} query - App name typed or spoken by the user
 * @param {number} limit - Max results
 * @returns {Object[]} Matches as { name, scheme, score, source }, best first
 */
function search(query, limit = 8) {
  const q = normalize(query)
  if (!q) return []
  const words = q.split(/\s+/)

  const results = []
  for (const [name, scheme, ...aliases] of CATALOG) {
    let best = 0
    // Keeps the user's word as the item name when it exactly matches an alias ("Fotos", not "Photos")
    let label = name
    for (const term of [name, ...aliases]) {
      const t = normalize(term)
      let score = 0
      if (t === q) score = 100
      else if (t.startsWith(q)) score = 80
      else if (t.includes(q)) score = 60
      else if (words.every(w => t.includes(w))) score = 40
      if (score > best) {
        best = score
        label = (score === 100 && term !== name) ? capitalize(query.trim()) : name
      }
    }
    if (best > 0) results.push({ name: label, scheme, score: best, source: "catalog" })
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit)
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

// ============================================
// SHORTCUTS
// ============================================

/**
 * Builds an item that runs a Shortcuts shortcut by name
 * @param {string} shortcutName
 * @returns {Object} { name, scheme, source }
 */
function shortcutItem(shortcutName) {
  const name = shortcutName.trim()
  return {
    name,
    scheme: `shortcuts://run-shortcut?name=${encodeURIComponent(name)}`,
    source: "shortcut"
  }
}

// ============================================
// CLAUDE LOOKUP
// ============================================

const KEYCHAIN_KEY = "zen.anthropicApiKey"
const CLAUDE_MODEL = "claude-opus-5"

/**
 * Reads the Anthropic API key from the Keychain
 * @returns {Promise<string|null>}
 */
async function getApiKey() {
  return Keychain.contains(KEYCHAIN_KEY) ? Keychain.get(KEYCHAIN_KEY) : null
}

/**
 * Stores an API key in the Keychain
 * @param {string} key
 * @returns {string|null} The trimmed key, or null when blank
 */
function saveApiKey(key) {
  const clean = typeof key === "string" ? key.trim() : ""
  if (!clean) return null
  Keychain.set(KEYCHAIN_KEY, clean)
  return clean
}

const RESULT_SCHEMA = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          scheme: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium", "low"] }
        },
        required: ["name", "scheme", "confidence"],
        additionalProperties: false
      }
    }
  },
  required: ["results"],
  additionalProperties: false
}

/**
 * Asks Claude for the URL that opens what the user described
 * @param {string} query - e.g. "Spotify", "new WhatsApp chat", "Google Maps directions home"
 * @param {string} apiKey
 * @returns {Promise<Object[]>} Up to 3 results as { name, scheme, confidence, source }
 */
async function askClaude(query, apiKey) {
  const prompt = `I'm adding a button to an iOS launcher widget. Tapping it opens a URL.
The user asked for: "${query}"

Give up to 3 iOS URLs that open this, best first. Rules:
- For a plain app, use its bare custom URL scheme (e.g. "spotify://").
- For a specific action inside an app, use the app's documented deep link.
- For a Shortcuts shortcut, use shortcuts://run-shortcut?name= with the name percent-encoded.
- Only give schemes you have seen documented or widely used. Mark guesses "low".
- "name" is a short button label (1-3 words), in the same language as the request.`

  const req = new Request("https://api.anthropic.com/v1/messages")
  req.method = "POST"
  req.headers = {
    "content-type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "anthropic-beta": "server-side-fallback-2026-07-01"
  }
  req.body = JSON.stringify({
    model: CLAUDE_MODEL,
    max_tokens: 4000,
    fallbacks: "default",
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: RESULT_SCHEMA }
    },
    messages: [{ role: "user", content: prompt }]
  })

  const res = await req.loadJSON()
  const status = req.response.statusCode

  if (status !== 200) {
    const msg = (res && res.error && res.error.message) || `HTTP ${status}`
    const error = new Error(msg)
    // 401/403 mean the stored key is invalid or lacks access
    error.keyError = status === 401 || status === 403
    throw error
  }
  if (res.stop_reason === "refusal") throw new Error("Claude declined this request.")

  const textBlock = (res.content || []).find(b => b.type === "text")
  if (!textBlock) throw new Error("Empty response from Claude.")

  const parsed = JSON.parse(textBlock.text)
  return (parsed.results || [])
    .filter(r => r.name && r.scheme)
    .map(r => ({ ...r, source: "claude" }))
}

// ============================================
// RESOLVE
// ============================================

/**
 * True when an item has no real URL yet (empty fields are saved as about:blank)
 * @param {string} scheme
 * @returns {boolean}
 */
function isMissing(scheme) {
  const s = (scheme || "").trim()
  return !s || s === "about:blank"
}

/**
 * Finds one URL with no UI: a strong catalog match, else Claude if a key is stored
 * @param {string} query - App name or description
 * @returns {Promise<Object|null>} { name, scheme, source } or null. Throws on Claude errors.
 */
async function resolve(query) {
  const best = search(query, 1)[0]
  // Only trust exact or prefix matches without a human to confirm
  if (best && best.score >= 80) return best

  const apiKey = await getApiKey()
  if (!apiKey) return null
  const results = await askClaude(query, apiKey)
  return results.find(r => r.confidence !== "low") || null
}

// ============================================
// MODULE EXPORTS
// ============================================

module.exports = {
  CATALOG,
  normalize,
  capitalize,
  search,
  shortcutItem,
  isMissing,
  resolve,
  getApiKey,
  saveApiKey,
  askClaude
}
