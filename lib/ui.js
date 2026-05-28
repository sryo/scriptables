// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-gray; icon-glyph: bullhorn;
/**
 * lib/ui.js - User-facing alert helpers.
 *
 * Interactive only. Do NOT import this from widget render paths — widgets
 * cannot present alerts.
 */

async function showError(title, message) {
  const alert = new Alert()
  alert.title = title
  alert.message = message
  alert.addAction("OK")
  await alert.presentAlert()
}

async function showSuccess(title, message) {
  const alert = new Alert()
  alert.title = title
  alert.message = message
  alert.addAction("OK")
  await alert.presentAlert()
}

module.exports = {
  showError,
  showSuccess
}
