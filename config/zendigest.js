// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-gray; icon-glyph: sliders-h;
/**
 * config/zendigest.js - Persistence for ZenDigest's user config.
 */

const fs = importModule("lib/fs")

const CONFIG_PATH = fs.fm.joinPath(fs.baseDir, "zendigest_config.json")

const DEFAULTS = {
  widgetUrl: "calshow://",
  showWeather: true
}

function loadConfig() {
  return { ...DEFAULTS, ...fs.loadJSON(CONFIG_PATH, {}) }
}

function saveConfig(config) {
  fs.saveJSON(CONFIG_PATH, config)
}

module.exports = {
  CONFIG_PATH,
  DEFAULTS,
  loadConfig,
  saveConfig
}
