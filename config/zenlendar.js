// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-gray; icon-glyph: sliders-h;
/**
 * config/zenlendar.js - Persistence for ZenLendar's user config.
 */

const fs = importModule("lib/fs")

const CONFIG_PATH = fs.fm.joinPath(fs.baseDir, "zenlendar_config.json")

const DEFAULTS = {
  eventCount: 5,
  widgetUrl: "calshow://"
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
