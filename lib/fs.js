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

// Synchronous, so it cannot wait for iCloud: an evicted file reads as the
// default this run while the download is kicked off for the next one.
// Interactive scripts should prefer loadJSONAsync().
function loadJSON(path, defaultValue = {}) {
  try {
    if (fm.fileExists(path)) {
      if (!fm.isFileDownloaded(path)) {
        Promise.resolve(fm.downloadFileFromiCloud(path)).catch(e => {
          console.error(`lib/fs: Error downloading ${path}: ${e.message}`)
        })
      }
      return parseFile(path, defaultValue)
    }
  } catch (e) {
    console.error(`lib/fs: Error reading ${path}: ${e.message}`)
  }
  return defaultValue
}

async function loadJSONAsync(path, defaultValue = {}) {
  try {
    if (fm.fileExists(path)) {
      await ensureDownloaded(path)
      return parseFile(path, defaultValue)
    }
  } catch (e) {
    console.error(`lib/fs: Error reading ${path}: ${e.message}`)
  }
  return defaultValue
}

function parseFile(path, defaultValue) {
  const content = fm.readString(path)
  if (content && content.trim()) {
    return JSON.parse(content)
  }
  return defaultValue
}

/** Never rejects: a failed download leaves the file evicted. */
async function ensureDownloaded(path) {
  try {
    if (fm.fileExists(path) && !fm.isFileDownloaded(path)) {
      await fm.downloadFileFromiCloud(path)
    }
  } catch (e) {
    console.error(`lib/fs: Error downloading ${path}: ${e.message}`)
  }
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
  loadJSONAsync,
  ensureDownloaded,
  saveJSON,
  fileExists,
  ensureDirectory,
  listDirectory
}
