// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-gray; icon-glyph: sliders-h;
/**
 * ZenTweak.js - Configuration Editor for ZenTrate
 *
 * Features:
 * - Visual WYSIWYG widget editor
 * - Add, edit, delete, and move items
 * - Find item URLs by search, Claude, or shortcut name (also from Siri)
 * - Time and day constraints
 * - Sort method selection
 */

const Theme = importModule("lib/theme")
const Widget = importModule("lib/widget")
const Validate = importModule("lib/validate")
const UI = importModule("lib/ui")
const ZenTrateConfig = importModule("config/zentrate")
const Schemes = importModule("lib/schemes")

// ============================================
// CONFIGURATION
// ============================================

const loadConfig = ZenTrateConfig.loadConfigForEditor
const saveConfig = ZenTrateConfig.saveConfig

const COLUMNS = ['left', 'center', 'right']

// ============================================
// WYSIWYG EDITOR WIDGET
// ============================================

/**
 * Creates the visual editor widget showing all items
 * @param {Object} config - Current configuration
 * @returns {ListWidget}
 */
function createEditableWidget(config) {
  const themeConfig = Theme.loadTheme()
  const widget = Widget.createWidget({ theme: themeConfig })

  const mainStack = widget.addStack()
  mainStack.layoutHorizontally()

  for (const column of COLUMNS) {
    const columnStack = mainStack.addStack()
    columnStack.layoutVertically()

    const columnItems = config.items.filter(item => item.column === column)

    // Item buttons
    for (const item of columnItems) {
      const itemStack = columnStack.addStack()
      const itemText = itemStack.addText(item.name)
      itemText.font = Theme.getFont(14, { theme: themeConfig })
      itemText.textColor = Theme.getTextColor(themeConfig)
      itemText.lineLimit = 1

      itemStack.setPadding(5, 5, 5, 5)
      itemStack.backgroundColor = new Color("#444444")
      itemStack.cornerRadius = 5
      itemStack.url = Widget.buildActionURL(Script.name(), {
        action: 'editItem',
        itemName: item.name
      })
    }

    // Move All button (if column has items)
    if (columnItems.length > 0) {
      const moveAllStack = columnStack.addStack()
      const moveAllText = moveAllStack.addText("Move All")
      moveAllText.font = Theme.getFont(12, { theme: themeConfig })
      moveAllText.textColor = Theme.getTextColor(themeConfig)
      moveAllStack.backgroundColor = new Color("#666666")
      moveAllStack.cornerRadius = 5
      moveAllStack.setPadding(5, 5, 5, 5)
      moveAllStack.url = Widget.buildActionURL(Script.name(), {
        action: 'moveItems',
        fromColumn: column
      })
    }

    // Add button
    const addButton = columnStack.addText("+")
    addButton.font = Theme.getFont(20, { theme: themeConfig })
    addButton.textColor = Theme.getTextColor(themeConfig)
    addButton.url = Widget.buildActionURL(Script.name(), {
      action: 'addItem',
      column: column
    })

    if (column !== 'right') {
      mainStack.addSpacer()
    }
  }

  return widget
}

/**
 * Shows the editable widget
 */
async function showEditableWidget() {
  const config = loadConfig()
  const widget = createEditableWidget(config)
  await widget.presentLarge()
}

// ============================================
// ITEM MANAGEMENT
// ============================================

/**
 * Edits an existing item
 * @param {string} itemName - Name of item to edit
 * @param {Object} [draft] - { name, scheme } to prefill after a rejected save
 */
async function editItem(itemName, draft = null) {
  const config = loadConfig()
  const item = config.items.find(i => i.name === itemName)

  if (!item) {
    await UI.showError("Error", "Item not found")
    return
  }

  const alert = new Alert()
  alert.title = "Edit Item"

  // Show current constraints in message
  const startDay = item.startDay !== undefined ? `day ${item.startDay}` : 'any day'
  const endDay = item.endDay !== undefined ? `day ${item.endDay}` : 'any day'
  const startTime = item.startTime || 'any time'
  const endTime = item.endTime || 'any time'
  alert.message = `Shows from ${startDay} to ${endDay}, between ${startTime} and ${endTime}.`

  alert.addTextField("Name", draft ? draft.name : item.name)
  alert.addTextField("Scheme URL", draft ? draft.scheme : item.scheme)

  alert.addAction("Save")
  alert.addAction("Set Time Constraints")
  alert.addAction("Move/Reposition")
  alert.addDestructiveAction("Delete")
  alert.addCancelAction("Cancel")

  const response = await alert.presentAlert()

  switch (response) {
    case 0: { // Save
      const name = alert.textFieldValue(0).trim()
      const typedScheme = alert.textFieldValue(1).trim()
      // Blank URLs are looked up by name on first tap, like new items
      const scheme = !typedScheme ? "about:blank"
        : typedScheme === item.scheme ? item.scheme
        : Validate.validateURL(typedScheme)

      let error = null
      if (!name) error = "Name is required"
      else if (name !== itemName && config.items.some(i => i.name === name)) error = `"${name}" already exists`
      else if (!scheme) error = `"${typedScheme}" is not a valid URL`
      if (error) {
        await UI.showError("Error", error)
        return editItem(itemName, { name, scheme: typedScheme })
      }

      if (name !== itemName) renameUsageStats(itemName, name)
      item.name = name
      item.scheme = scheme
      saveConfig(config)
      break
    }
    case 1: // Time Constraints
      await setTimeConstraints(item)
      saveConfig(config)
      break
    case 2: // Move
      // moveItems saves and re-presents the editor itself
      await moveItems([item])
      return
    case 3: // Delete
      config.items = config.items.filter(i => i.name !== itemName)
      saveConfig(config)
      removeUsageStats(itemName)
      break
  }

  await showEditableWidget()
}

function removeUsageStats(name) {
  const stats = ZenTrateConfig.loadStats()
  if (stats[name] === undefined) return
  delete stats[name]
  ZenTrateConfig.saveStats(stats)
}

/**
 * Moves an item's usage count to its new name (stats are keyed by name)
 * @param {string} oldName
 * @param {string} newName
 */
function renameUsageStats(oldName, newName) {
  const stats = ZenTrateConfig.loadStats()
  if (stats[oldName] === undefined) return
  stats[newName] = stats[oldName]
  delete stats[oldName]
  ZenTrateConfig.saveStats(stats)
}

/**
 * Inserts items into their shared column at a 1-based position, then rebuilds
 * config.items grouped by column with positions renumbered. ZenTrate's manual
 * sort shows items in array order, so array order and position must agree.
 * @param {Object} config
 * @param {Object[]} items - Items to place, all with the same column
 * @param {number} position - Clamped to the column's bounds
 */
function placeInColumn(config, items, position) {
  const column = items[0].column
  const rest = config.items.filter(item => !items.includes(item))
  const target = rest.filter(item => item.column === column)
  const index = Math.min(Math.max(position - 1, 0), target.length)
  target.splice(index, 0, ...items)

  const extraColumns = [...new Set(rest.map(item => item.column))].filter(col => !COLUMNS.includes(col))
  config.items = [...COLUMNS, ...extraColumns].flatMap(col => {
    const colItems = col === column ? target : rest.filter(item => item.column === col)
    colItems.forEach((item, i) => { item.position = i + 1 })
    return colItems
  })
}

/**
 * Adds a new item to a column. Finds the URL by catalog search, Claude, or shortcut name.
 * @param {string} column - Column to add to (left/center/right)
 */
async function addItem(column) {
  const alert = new Alert()
  alert.title = "Add Item"
  alert.message = "Type an app, an action, or a shortcut name."
  alert.addTextField("e.g. Spotify")

  alert.addAction("Search")
  alert.addAction("Ask Claude")
  alert.addAction("Shortcut")
  alert.addAction("Enter URL")
  alert.addCancelAction("Cancel")

  const response = await alert.presentAlert()
  const query = alert.textFieldValue(0).trim()

  if (response >= 0 && response <= 2 && !query) {
    await UI.showError("Error", "Type a name first")
    return addItem(column)
  }

  let picked = null
  switch (response) {
    case 0:
      picked = await pickFromCatalog(query)
      break
    case 1:
      picked = await pickFromClaude(query)
      break
    case 2:
      picked = Schemes.shortcutItem(query)
      break
    case 3:
      picked = { name: query, scheme: "" }
      break
  }

  if (picked) {
    const saved = await confirmNewItem(column, picked)
    // Testing opens another app, so skip re-presenting the editor
    if (saved && saved.test) {
      Safari.open(saved.item.scheme)
      return
    }
  }

  await showEditableWidget()
}

/**
 * Shows catalog matches as a sheet
 * @param {string} query
 * @returns {Promise<Object|null>} Picked { name, scheme } or null
 */
async function pickFromCatalog(query) {
  const matches = Schemes.search(query)

  const sheet = new Alert()
  sheet.title = matches.length ? "Pick an app" : `No match for "${query}"`
  for (const m of matches) sheet.addAction(`${m.name}  ·  ${m.scheme}`)
  sheet.addAction("Ask Claude")
  sheet.addAction("Enter URL")
  sheet.addCancelAction("Cancel")

  const response = await sheet.presentSheet()
  if (response < 0) return null
  if (response < matches.length) return matches[response]
  if (response === matches.length) return pickFromClaude(query)
  return { name: query, scheme: "" }
}

/**
 * Asks Claude and shows its suggestions as a sheet
 * @param {string} query
 * @returns {Promise<Object|null>} Picked { name, scheme } or null
 */
async function pickFromClaude(query) {
  const apiKey = await Schemes.getApiKey(true)
  if (!apiKey) return null

  let results
  try {
    results = await Schemes.askClaude(query, apiKey)
  } catch (error) {
    if (!error.keyError) {
      await UI.showError("Claude Error", error.message)
      return null
    }
    const alert = new Alert()
    alert.title = "API Key Rejected"
    alert.message = error.message
    alert.addAction("Change Key")
    alert.addCancelAction("Cancel")
    if (await alert.presentAlert() !== 0) return null
    return (await Schemes.promptApiKey()) ? pickFromClaude(query) : null
  }

  const sheet = new Alert()
  sheet.title = results.length ? "Claude suggests" : "Claude found nothing"
  sheet.message = "Guesses. Use Save & Test to check."
  for (const r of results) {
    const flag = r.confidence === "high" ? "" : ` (${r.confidence})`
    sheet.addAction(`${r.name}  ·  ${r.scheme}${flag}`)
  }
  sheet.addAction("Enter URL")
  sheet.addAction("Change API Key")
  sheet.addCancelAction("Cancel")

  const response = await sheet.presentSheet()
  if (response === results.length + 1) {
    return (await Schemes.promptApiKey()) ? pickFromClaude(query) : null
  }
  if (response < 0) return null
  if (response < results.length) return results[response]
  return { name: query, scheme: "" }
}

/**
 * Lets the user review name, URL, and position before saving
 * @param {string} column
 * @param {Object} picked - { name, scheme }
 * @returns {Promise<Object|null>} { item, test } when saved, null when cancelled
 */
async function confirmNewItem(column, picked) {
  const config = loadConfig()
  const columnItems = config.items.filter(item => item.column === column)

  const alert = new Alert()
  alert.title = "Add Item"
  alert.addTextField("Name", picked.name)
  alert.addTextField("Scheme URL", picked.scheme)
  alert.addTextField("Position", (columnItems.length + 1).toString())

  alert.addAction("Save")
  alert.addAction("Save & Test")
  alert.addCancelAction("Cancel")

  const response = await alert.presentAlert()
  if (response < 0) return null

  const name = alert.textFieldValue(0).trim()
  let scheme = alert.textFieldValue(1).trim()

  if (!name) {
    await UI.showError("Error", "Name is required")
    return confirmNewItem(column, { name, scheme })
  }
  // Items are looked up by name, so names must be unique
  if (config.items.some(i => i.name === name)) {
    await UI.showError("Error", `"${name}" already exists`)
    return confirmNewItem(column, { name, scheme })
  }
  if (scheme && !Validate.validateURL(scheme)) {
    await UI.showError("Error", `"${scheme}" is not a valid URL`)
    return confirmNewItem(column, { name, scheme })
  }

  if (!scheme) {
    const found = await Schemes.resolve(name).catch(() => null)
    if (found) scheme = found.scheme
    else await UI.showError("No URL found", `Saved "${name}" without a URL. It will look again when tapped.`)
  }

  const newItem = {
    name: name,
    scheme: scheme || "about:blank",
    column: column
  }

  placeInColumn(config, [newItem], parseInt(alert.textFieldValue(2)) || (columnItems.length + 1))
  saveConfig(config)

  return { item: newItem, test: response === 1 }
}

// ============================================
// SIRI / SHORTCUTS
// ============================================

/**
 * Reads text passed in from a Shortcut ("Run Script" parameter)
 * @returns {string|null}
 */
function getShortcutQuery() {
  const param = args.shortcutParameter
  if (typeof param === "string" && param.trim()) return param.trim()
  const texts = args.plainTexts || []
  if (texts.length && texts[0].trim()) return texts[0].trim()
  return null
}

/**
 * Adds an item without any UI, for Siri. Replies through the Shortcut output.
 * Apps go to the left column, shortcuts to the right, matching the current layout.
 * @param {string} query - e.g. "Spotify" or "shortcut Leer QR"
 * @returns {Promise<string>} Message for Siri to speak
 */
async function addFromSiri(query) {
  let picked = null
  let column = "left"

  const shortcutMatch = query.match(/^(shortcut|atajo)\s+(.+)$/i)
  if (shortcutMatch) {
    picked = Schemes.shortcutItem(shortcutMatch[2])
    column = "right"
  } else {
    try {
      picked = await Schemes.resolve(query)
    } catch (error) {
      return `Claude error: ${error.message}`
    }
  }

  if (!picked) return `I couldn't find a URL for "${query}".`

  const config = loadConfig()
  if (config.items.some(i => i.name === picked.name)) {
    return `${picked.name} is already in ZenTrate.`
  }

  const columnItems = config.items.filter(item => item.column === column)
  config.items.push({
    name: picked.name,
    scheme: picked.scheme,
    column: column,
    position: columnItems.length + 1
  })
  saveConfig(config)

  return `Added ${picked.name} to ZenTrate.`
}

/**
 * Moves or repositions items
 * @param {Object[]} items - Items to move
 */
async function moveItems(items) {
  const config = loadConfig()
  // Callers may pass items from another loadConfig(), so match by name
  const movingNames = items.map(item => item.name)
  const alert = new Alert()
  alert.title = "Move/Reposition Item(s)"

  const currentColumn = items[0].column
  const columnItems = config.items.filter(item => item.column === currentColumn)
  const currentPosition = columnItems.findIndex(item => item.name === items[0].name) + 1

  alert.message = `Current position: ${currentPosition} in ${currentColumn} column`
  alert.addTextField("New Position", currentPosition.toString())

  const otherColumns = COLUMNS.filter(col => col !== currentColumn)

  otherColumns.forEach(col => {
    alert.addAction(`Move to ${col.charAt(0).toUpperCase() + col.slice(1)}`)
  })

  alert.addAction("Keep Current Column")
  alert.addCancelAction("Cancel")

  const response = await alert.presentAlert()

  if (response >= 0 && response <= otherColumns.length) {
    const newPosition = parseInt(alert.textFieldValue(0)) || currentPosition
    const newColumn = response < otherColumns.length ? otherColumns[response] : currentColumn

    const moving = config.items.filter(item => movingNames.includes(item.name))
    moving.forEach(item => { item.column = newColumn })
    placeInColumn(config, moving, newPosition)

    saveConfig(config)
  }

  await showEditableWidget()
}

/**
 * Sets time and day constraints for an item
 * @param {Object} item - Item to configure
 */
async function setTimeConstraints(item) {
  const alert = new Alert()
  alert.title = "Set Time Constraints"
  alert.message = "Leave fields blank for no constraint."

  alert.addTextField("Start Time (HH:MM)", item.startTime || "")
  alert.addTextField("End Time (HH:MM)", item.endTime || "")
  alert.addTextField("Start Day (0-6, 0=Sunday)", item.startDay !== undefined ? item.startDay.toString() : "")
  alert.addTextField("End Day (0-6, 0=Sunday)", item.endDay !== undefined ? item.endDay.toString() : "")

  alert.addAction("Save")
  alert.addAction("Clear Constraints")
  alert.addCancelAction("Cancel")

  const response = await alert.presentAlert()

  if (response === 0) {
    // Validate every field before touching the item, so a rejected form saves nothing
    let constraints
    try {
      constraints = {
        startTime: Validate.validateTime(alert.textFieldValue(0)),
        endTime: Validate.validateTime(alert.textFieldValue(1)),
        startDay: Validate.validateDay(alert.textFieldValue(2)),
        endDay: Validate.validateDay(alert.textFieldValue(3))
      }
      // The widget ignores a day range unless both ends are set
      if ((constraints.startDay === undefined) !== (constraints.endDay === undefined)) {
        throw new Error("Set both Start Day and End Day, or leave both blank.")
      }
    } catch (error) {
      await UI.showError("Validation Error", error.message)
      return setTimeConstraints(item) // Retry
    }
    Object.assign(item, constraints)
  } else if (response === 1) {
    delete item.startTime
    delete item.endTime
    delete item.startDay
    delete item.endDay
  }
}

// ============================================
// SORT MENU
// ============================================

/**
 * Shows sort method selection menu
 */
async function showSortMenu() {
  const config = loadConfig()
  const alert = new Alert()
  alert.title = "Sort Items"
  alert.message = `Current: ${config.sortMethod || 'manual'}`

  alert.addAction("Manual")
  alert.addAction("Alphabetical")
  alert.addAction("Usage")
  alert.addCancelAction("Cancel")

  const response = await alert.presentAlert()

  const methods = ["manual", "alphabetical", "usage"]
  if (response >= 0 && response < methods.length) {
    config.sortMethod = methods[response]
    saveConfig(config)
  }

  await showEditableWidget()
}

// ============================================
// MAIN MENU & EXECUTION
// ============================================

/**
 * Shows the main menu
 */
async function showMainMenu() {
  const alert = new Alert()
  alert.title = "ZenTweak"
  alert.addAction("Edit Widget")
  alert.addAction("Sort Items")
  alert.addCancelAction("Exit")

  const response = await alert.presentAlert()

  switch (response) {
    case 0:
      await showEditableWidget()
      break
    case 1:
      await showSortMenu()
      break
  }
}

/**
 * Decodes a query parameter, tolerating values that arrive already decoded
 * (decoding a name with a bare "%" again would throw)
 * @param {string} value
 * @returns {string}
 */
function decodeParam(value) {
  try {
    return decodeURIComponent(value)
  } catch (error) {
    return value
  }
}

/**
 * Main execution handler
 */
async function run() {
  await ZenTrateConfig.downloadFiles()

  const shortcutQuery = getShortcutQuery()
  if (shortcutQuery) {
    Script.setShortcutOutput(await addFromSiri(shortcutQuery))
    return
  }

  const params = Widget.getActionParams()

  if (params.action) {
    switch (params.action) {
      case 'editItem':
        await editItem(decodeParam(params.itemName))
        break
      case 'addItem':
        await addItem(decodeParam(params.column))
        break
      case 'moveItems':
        const config = loadConfig()
        const fromColumn = decodeParam(params.fromColumn)
        const itemsToMove = config.items.filter(item => item.column === fromColumn)
        if (itemsToMove.length > 0) {
          await moveItems(itemsToMove)
        }
        break
      default:
        await showEditableWidget()
    }
  } else {
    await showMainMenu()
  }
}

// ============================================
// WIDGET MODE
// ============================================

if (Widget.isWidget()) {
  const config = loadConfig()
  const widget = createEditableWidget(config)
  Script.setWidget(widget)
} else {
  await run()
}

Script.complete()
