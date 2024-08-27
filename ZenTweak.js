// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-gray; icon-glyph: sliders-h;
// ZenTweak.js: Configuration editor for ZenTrate

const fm = FileManager.iCloud()
const CONFIG_FILE = fm.documentsDirectory() + "/zentrate_config.json"
const THEME_FILE = fm.documentsDirectory() + "/zentrate_theme.json"

// Load configuration
function loadConfig() {
  if (fm.fileExists(CONFIG_FILE)) {
    const configString = fm.readString(CONFIG_FILE)
    let config = JSON.parse(configString)
    config.items = config.items.filter(item => 
      item && typeof item === 'object' && item.name && item.scheme && item.column
    )
    return config
  }
  return { items: [], sortMethod: "manual" }
}

// Save configuration
function saveConfig(config) {
  fm.writeString(CONFIG_FILE, JSON.stringify(config, null, 2))
}

// Load theme configuration
function loadThemeConfig() {
  if (fm.fileExists(THEME_FILE)) {
    const configString = fm.readString(THEME_FILE)
    return JSON.parse(configString)
  }
  return {
    bgColor: "000000",
    textColor: "FFFFFF",
    fontName: "system",
    fontWeight: "bold",
    fontItalic: false,
    minFontSize: 10,
    maxFontSize: 30
  }
}

// Get font based on theme configuration
function getFont(size, config = loadThemeConfig()) {
  const fontName = config.fontName || "System";
  const weight = config.fontWeight || "regular";
  const isItalic = config.fontItalic || false;

  let font;
  if (fontName.toLowerCase() === "system") {
    font = Font[weight + "SystemFont"](size);
  } else {
    font = new Font(fontName, size);
  }

  if (isItalic) {
    font = Font.italicSystemFont(size);
  }

  return font;
}

// Validate and format time
function validateAndFormatTime(time) {
  if (!time) return undefined;
  
  // Support short time format
  if (/^\d{1,2}$/.test(time)) {
    time = time.padStart(2, '0') + ':00';
  }
  
  // Validate time format
  const timeRegex = /^([01]\d|2[0-3]):?([0-5]\d)$/;
  if (!timeRegex.test(time)) {
    throw new Error(`Invalid time format: ${time}. Please use HH:MM or just HH.`);
  }
  
  // Ensure consistent format (HH:MM)
  return time.length === 5 ? time : `${time}:00`;
}

// Validate day
function validateDay(day) {
  if (day === '') return undefined;
  const dayNum = parseInt(day);
  if (isNaN(dayNum) || dayNum < 0 || dayNum > 6) {
    throw new Error(`Invalid day: ${day}. Please use a number between 0 and 6.`);
  }
  return dayNum;
}

// WYSIWYG editor
async function createEditableWidget(config) {
  let widget = new ListWidget()
  const themeConfig = loadThemeConfig()
  widget.backgroundColor = new Color("#" + themeConfig.bgColor)

  let mainStack = widget.addStack()
  mainStack.layoutHorizontally()

  const columns = ['left', 'center', 'right']
  
  for (let column of columns) {
    let columnStack = mainStack.addStack()
    columnStack.layoutVertically()
    
    let columnItems = config.items.filter(item => item.column === column)
    
    for (let item of columnItems) {
      let itemStack = columnStack.addStack()
      let itemText = itemStack.addText(item.name)
      itemText.font = getFont(14)
      itemText.textColor = new Color("#" + themeConfig.textColor)
      itemText.lineLimit = 1
      
      itemStack.setPadding(5, 5, 5, 5)
      itemStack.backgroundColor = new Color("#444444")
      itemStack.cornerRadius = 5
      
      itemStack.url = `scriptable:///run?scriptName=${encodeURIComponent(Script.name())}&action=editItem&itemName=${encodeURIComponent(item.name)}`
    }
    
    if (columnItems.length > 0) {
      let moveAllStack = columnStack.addStack()
      let moveAllText = moveAllStack.addText("Move All")
      moveAllText.font = getFont(12)
      moveAllText.textColor = new Color("#" + themeConfig.textColor)
      moveAllStack.backgroundColor = new Color("#666666")
      moveAllStack.cornerRadius = 5
      moveAllStack.setPadding(5, 5, 5, 5)
      moveAllStack.url = `scriptable:///run?scriptName=${encodeURIComponent(Script.name())}&action=moveItems&fromColumn=${column}`
    }
    
    let addButton = columnStack.addText("+")
    addButton.font = getFont(20)
    addButton.textColor = new Color("#" + themeConfig.textColor)
    addButton.url = `scriptable:///run?scriptName=${encodeURIComponent(Script.name())}&action=addItem&column=${column}`
    
    if (column !== 'right') {
      mainStack.addSpacer()
    }
  }

  return widget
}

// Show editable widget
async function showEditableWidget() {
  let config = loadConfig()
  let widget = await createEditableWidget(config)
  await widget.presentLarge()
}

// Edit an item
async function editItem(itemName) {
  let config = loadConfig()
  const item = config.items.find(i => i.name === itemName)
  if (!item) {
    console.error("Item not found")
    return
  }

  const alert = new Alert()
  alert.title = "Edit Item"
  alert.message = `This item will show up from ${item.startDay !== undefined ? `day ${item.startDay}` : 'any day'} to ${item.endDay !== undefined ? `day ${item.endDay}` : 'any day'}, between ${item.startTime || 'any time'} and ${item.endTime || 'any time'}.`

  alert.addTextField("Name", item.name)
  alert.addTextField("Scheme URL", item.scheme)

  alert.addAction("Save")
  alert.addAction("Set Time Constraints")
  alert.addAction("Move")
  alert.addDestructiveAction("Delete")
  alert.addCancelAction("Cancel")

  const response = await alert.presentAlert()

  switch (response) {
    case 0: // Save
      item.name = alert.textFieldValue(0)
      item.scheme = alert.textFieldValue(1)
      saveConfig(config)
      break
    case 1: // Set Time Constraints
      await setTimeConstraints(item)
      saveConfig(config)
      break
    case 2: // Move
      await moveItems([item])
      saveConfig(config)
      break
    case 3: // Delete
      config.items = config.items.filter(i => i.name !== itemName)
      saveConfig(config)
      break
  }

  await showEditableWidget()
}

// Add a new item
async function addItem(column) {
  const config = loadConfig()
  const alert = new Alert()
  alert.title = "Add New Item"

  alert.addTextField("Name")
  alert.addTextField("Scheme URL")

  alert.addAction("Add")
  alert.addCancelAction("Cancel")

  const response = await alert.presentAlert()

  if (response === 0) {
    const newItem = {
      name: alert.textFieldValue(0),
      scheme: alert.textFieldValue(1),
      column: column
    }
    config.items.push(newItem)
    saveConfig(config)
  }

  await showEditableWidget()
}

// Set time constraints
async function setTimeConstraints(item) {
  const alert = new Alert()
  alert.title = "Set Time Constraints"
  alert.message = "Leave fields blank for no constraint."

  alert.addTextField("Start Time (HH:MM)", item.startTime || "")
  alert.addTextField("End Time (HH:MM)", item.endTime || "")
  alert.addTextField("Start Day (0-6, 0 is Sunday)", item.startDay !== undefined ? item.startDay.toString() : "")
  alert.addTextField("End Day (0-6, 0 is Sunday)", item.endDay !== undefined ? item.endDay.toString() : "")

  alert.addAction("Save")
  alert.addAction("Clear Constraints")
  alert.addCancelAction("Cancel")

  const response = await alert.presentAlert()

  if (response === 0) {
    try {
      item.startTime = validateAndFormatTime(alert.textFieldValue(0))
      item.endTime = validateAndFormatTime(alert.textFieldValue(1))
      item.startDay = validateDay(alert.textFieldValue(2))
      item.endDay = validateDay(alert.textFieldValue(3))
    } catch (error) {
      const errorAlert = new Alert()
      errorAlert.title = "Validation Error"
      errorAlert.message = error.message
      errorAlert.addAction("OK")
      await errorAlert.presentAlert()
      return await setTimeConstraints(item) // Try again
    }
  } else if (response === 1) {
    delete item.startTime
    delete item.endTime
    delete item.startDay
    delete item.endDay
  }
}

// Move items (single item or all items from a column)
async function moveItems(items) {
  const config = loadConfig()
  const alert = new Alert()
  alert.title = "Move Item(s)"
  alert.message = `Move ${items.length === 1 ? 'item' : 'all items'} to:`

  const currentColumn = items[0].column
  const columns = ['left', 'center', 'right'].filter(col => col !== currentColumn)
  columns.forEach(column => {
    alert.addAction(column)
  })

  alert.addCancelAction("Cancel")

  const response = await alert.presentAlert()

  if (response !== -1) {
    const toColumn = columns[response]
    items.forEach(item => {
      item.column = toColumn
    })
    saveConfig(config)
  }

  await showEditableWidget()
}

// Show the sort menu
async function showSortMenu() {
  const config = loadConfig()
  const alert = new Alert()
  alert.title = "Sort Items"
  alert.message = "Choose a sorting method"

  alert.addAction("Manual")
  alert.addAction("Alphabetical")
  alert.addAction("Usage")
  alert.addCancelAction("Cancel")

  const response = await alert.presentAlert()

  switch (response) {
    case 0:
      config.sortMethod = "manual"
      break
    case 1:
      config.sortMethod = "alphabetical"
      break
    case 2:
      config.sortMethod = "usage"
      break
    default:
      return
  }

  saveConfig(config)
  await showEditableWidget()
}

// Main function
async function run() {
  const params = args.queryParameters
  if (params && params.action) {
    switch (params.action) {
      case 'editItem':
        await editItem(decodeURIComponent(params.itemName))
        break
      case 'addItem':
        await addItem(decodeURIComponent(params.column))
        break
      case 'moveItems':
        const config = loadConfig()
        const fromColumn = decodeURIComponent(params.fromColumn)
        const itemsToMove = config.items.filter(item => item.column === fromColumn)
        await moveItems(itemsToMove)
        break
      default:
        await showEditableWidget()
    }
  } else {
    const menuAlert = new Alert()
    menuAlert.title = "ZenTweak"
    menuAlert.addAction("Edit Widget")
    menuAlert.addAction("Sort Items")
    menuAlert.addCancelAction("Exit")

    const menuChoice = await menuAlert.presentAlert()

    switch (menuChoice) {
      case 0:
        await showEditableWidget()
        break
      case 1:
        await showSortMenu()
        break
    }
  }
}

await run()
