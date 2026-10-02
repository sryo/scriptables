// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-gray; icon-glyph: sliders-h;
/**
 * config/zentrate.js - Persistence for ZenTrate's launcher items + usage stats.
 *
 * Shared by ZenTrate (reader) and ZenTweak (editor). Each consumer picks the
 * loader that matches its first-run policy:
 *   - ZenTrate:   loadConfig()             — creates EXAMPLE_CONFIG if missing
 *   - ZenTweak:   loadConfigForEditor()    — returns EMPTY_CONFIG if missing,
 *                                            filters out malformed items.
 */

const fs = importModule("lib/fs")

const CONFIG_PATH = fs.fm.joinPath(fs.baseDir, "zentrate_config.json")
const STATS_PATH = fs.fm.joinPath(fs.baseDir, "zentrate_stats.json")

const EMPTY_CONFIG = { items: [], sortMethod: "manual" }

const EXAMPLE_CONFIG = {
  items: [
    { name: "Settings", column: "left", scheme: "App-prefs://", position: 1 },
    { name: "Weather", column: "left", scheme: "weather://", position: 2 },
    { name: "Messages", column: "left", scheme: "messages://", position: 3 },
    { name: "Calendar", column: "left", scheme: "calshow://", position: 4 },
    { name: "Phone", column: "left", scheme: "tel://", position: 5 },
    { name: "Maps", column: "left", scheme: "maps://", position: 6 },
    { name: "Create Reminder", column: "right", scheme: "shortcuts://run-shortcut?name=Create%20Reminder", position: 1 },
    { name: "Take Photo", column: "right", scheme: "shortcuts://run-shortcut?name=Take%20Photo", position: 2 },
    { name: "QR Scanner", column: "right", scheme: "shortcuts://run-shortcut?name=QR%20Scanner", position: 3 },
    { name: "Shazam", column: "right", scheme: "shortcuts://run-shortcut?name=Shazam", position: 4 }
  ],
  sortMethod: "manual"
}

function loadConfig() {
  const stored = fs.loadJSON(CONFIG_PATH, null)
  if (stored && typeof stored === 'object') {
    stored.items = (Array.isArray(stored.items) ? stored.items : []).filter(item =>
      item && typeof item === 'object' && item.name
    )
    return stored
  }
  // An evicted iCloud file reads as null too; seeding it would overwrite
  // the user's real config.
  if (fs.fileExists(CONFIG_PATH)) return { ...EMPTY_CONFIG, items: [] }
  fs.saveJSON(CONFIG_PATH, EXAMPLE_CONFIG)
  return EXAMPLE_CONFIG
}

// Interactive runs can wait for iCloud; widget renders can't.
async function downloadFiles() {
  await fs.ensureDownloaded(CONFIG_PATH)
  await fs.ensureDownloaded(STATS_PATH)
}

function loadConfigForEditor() {
  const config = fs.loadJSON(CONFIG_PATH, EMPTY_CONFIG)
  config.items = (config.items || []).filter(item =>
    item && typeof item === 'object' && item.name && item.scheme && item.column
  )
  return config
}

function saveConfig(config) {
  fs.saveJSON(CONFIG_PATH, config)
}

function loadStats() {
  return fs.loadJSON(STATS_PATH, {})
}

function saveStats(stats) {
  fs.saveJSON(STATS_PATH, stats, false)
}

function updateUsageCount(name) {
  const stats = loadStats()
  stats[name] = (stats[name] || 0) + 1
  saveStats(stats)
}

module.exports = {
  CONFIG_PATH,
  STATS_PATH,
  EMPTY_CONFIG,
  EXAMPLE_CONFIG,
  loadConfig,
  loadConfigForEditor,
  downloadFiles,
  saveConfig,
  loadStats,
  saveStats,
  updateUsageCount
}
