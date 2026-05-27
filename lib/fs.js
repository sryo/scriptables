// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-gray; icon-glyph: folder;
/**
 * lib/fs.js - File system helpers for the Zen suite.
 *
 * Consumer-agnostic: this module knows nothing about specific Zen scripts.
 * It only wraps Scriptable's FileManager.iCloud() with JSON convenience.
 */

const fm = FileManager.iCloud()
const baseDir = fm.documentsDirectory()

function getFilePath(filename) {
  return fm.joinPath(baseDir, filename)
}

function loadJSON(path, defaultValue = {}) {
  try {
    if (fm.fileExists(path)) {
      if (!fm.isFileDownloaded(path)) {
        fm.downloadFileFromiCloud(path)
      }
      const content = fm.readString(path)
      if (content && content.trim()) {
        return JSON.parse(content)
      }
    }
  } catch (e) {
    console.error(`lib/fs: Error reading ${path}: ${e.message}`)
  }
  return defaultValue
}

function saveJSON(path, data, prettyPrint = true) {
  try {
    const content = prettyPrint
      ? JSON.stringify(data, null, 2)
      : JSON.stringify(data)
    fm.writeString(path, content)
  } catch (e) {
    console.error(`lib/fs: Error writing ${path}: ${e.message}`)
  }
}

function fileExists(path) {
  return fm.fileExists(path)
}

function ensureDirectory(path) {
  if (!fm.fileExists(path)) {
    fm.createDirectory(path)
  }
}

function listDirectory(path) {
  if (fm.fileExists(path)) {
    return fm.listContents(path)
  }
  return []
}

module.exports = {
  fm,
  baseDir,
  getFilePath,
  loadJSON,
  saveJSON,
  fileExists,
  ensureDirectory,
  listDirectory
}
