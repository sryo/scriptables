// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-gray; icon-glyph: sliders-h;
// ZenTweak.js: Configuration editor for ZenTrate

const fm = FileManager.iCloud()
const CONFIG_FILE = fm.documentsDirectory() + "/zentrate_config.json"

// Load configuration
function loadConfig() {
  if (fm.fileExists(CONFIG_FILE)) {
    const configString = fm.readString(CONFIG_FILE)
    let config = JSON.parse(configString)
    
    // Validate and filter out invalid items
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

// Get items grouped by column
function getItemsByColumn(items) {
  return items.reduce((acc, item) => {
    if (!acc[item.column]) {
      acc[item.column] = [];
    }
    acc[item.column].push(item);
    return acc;
  }, {left: [], center: [], right: []});
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

// Show the main menu
async function showMainMenu() {
  while (true) {
    let config = loadConfig()
    let itemsByColumn = getItemsByColumn(config.items)
    
    const columnAlert = new Alert()
    columnAlert.title = "ZenTweak"
    columnAlert.message = "Select a column or action"

    const columns = ['left', 'center', 'right']
    let nonEmptyColumns = []
    columns.forEach(column => {
      if (itemsByColumn[column].length > 0) {
        columnAlert.addAction(`${column.charAt(0).toUpperCase() + column.slice(1)} Column (${itemsByColumn[column].length})`)
        nonEmptyColumns.push(column)
      }
    })

    const addNewItemIndex = nonEmptyColumns.length
    const sortItemsIndex = addNewItemIndex + 1
    const exitIndex = sortItemsIndex + 1

    columnAlert.addAction("Add New Item")
    columnAlert.addAction("Sort Items")
    columnAlert.addCancelAction("Exit")

    const columnResponse = await columnAlert.presentSheet()

    if (columnResponse === -1 || columnResponse === exitIndex) {
      // Exit immediately
      return
    } else if (columnResponse === sortItemsIndex) {
      // Sort Items
      await showSortMenu()
    } else if (columnResponse === addNewItemIndex) {
      // Add New Item
      await addItem()
    } else if (columnResponse >= 0 && columnResponse < nonEmptyColumns.length) {
      // Column selected, show items in that column
      const selectedColumn = nonEmptyColumns[columnResponse]
      await showColumnItems(itemsByColumn[selectedColumn], selectedColumn)
    }
  }
}



// Show items in a specific column
async function showColumnItems(items, column) {
  const itemAlert = new Alert()
  itemAlert.title = `${column.charAt(0).toUpperCase() + column.slice(1)} Column`
  itemAlert.message = "Select an item to edit or choose an action"

  // Check if items is undefined or empty
  if (!items || items.length === 0) {
    console.log(`No items found in ${column} column`)
    itemAlert.message = `No items found in ${column} column`
    itemAlert.addAction("Add New Item")
    itemAlert.addCancelAction("Back to Columns")
    
    const response = await itemAlert.presentSheet()
    if (response === 0) {
      await addItem()
    }
    return
  }

  items.forEach(item => {
    if (item && item.name) {
      itemAlert.addAction(item.name)
    } else {
      console.log("Found an invalid item:", item)
    }
  })

  const otherColumns = ['left', 'center', 'right'].filter(col => col !== column)
  otherColumns.forEach(col => {
    itemAlert.addAction(`Move All to ${col.charAt(0).toUpperCase() + col.slice(1)}`)
  })

  itemAlert.addCancelAction("Back")

  const itemResponse = await itemAlert.presentSheet()

  if (itemResponse < items.length) {
    // An item was selected, edit it
    if (items[itemResponse] && items[itemResponse].name) {
      await editItem(items[itemResponse])
    } else {
      console.log("Attempted to edit an invalid item:", items[itemResponse])
    }
  } else if (itemResponse >= items.length && itemResponse < items.length + 2) {
    // Move all items to another column
    const targetColumn = otherColumns[itemResponse - items.length]
    await moveAllItems(column, targetColumn)
  }
  // If "Back to Columns" is selected or sheet is dismissed, the function will naturally end,
  // returning to the main menu
}

// Move all items from one column to another
async function moveAllItems(sourceColumn, targetColumn) {
  let config = loadConfig()
  config.items = config.items.map(item => {
    if (item.column === sourceColumn) {
      item.column = targetColumn
    }
    return item
  })
  saveConfig(config)
  console.log(`Moved all items from ${sourceColumn} to ${targetColumn}`)
}

// Edit an item
async function editItem(item) {
  let config = loadConfig()
  const itemIndex = config.items.findIndex(i => i.name === item.name && i.scheme === item.scheme)
  if (itemIndex === -1) {
    console.error("Item not found in config")
    return
  }
  
  const alert = new Alert()
  alert.title = "Edit Item"
  alert.message = `This item will show up from ${item.startDay !== undefined ? `day ${item.startDay}` : 'any day'} to ${item.endDay !== undefined ? `day ${item.endDay}` : 'any day'}, between ${item.startTime || 'any time'} and ${item.endTime || 'any time'}.`

  
  alert.addTextField("Name", item.name)
  alert.addTextField("Scheme URL", item.scheme)
  
  alert.addAction("Save")
  alert.addAction("Set Time Constraints")
  
  // Add move buttons based on current column
  if (item.column !== 'left') alert.addAction("Move to Left")
  if (item.column !== 'center') alert.addAction("Move to Center")
  if (item.column !== 'right') alert.addAction("Move to Right")
  
  alert.addDestructiveAction("Delete")
  alert.addCancelAction("Cancel")

  const response = await alert.presentAlert()

  switch (response) {
    case 0: // Save
      config.items[itemIndex].name = alert.textFieldValue(0)
      config.items[itemIndex].scheme = alert.textFieldValue(1)
      break
    case 1: // Set Time Constraints
      await setTimeConstraints(config.items[itemIndex])
      break
    case 2: // Move to another column
    case 3:
    case 4:
      const columns = ['left', 'center', 'right'].filter(col => col !== item.column)
      const newColumn = columns[response - 2]
      config.items[itemIndex].column = newColumn
      break
    case 5: // Delete
      config.items.splice(itemIndex, 1)
      break
  }
  
  if (response !== -1) { // If not cancelled
    saveConfig(config)
  }
  
  // Return to the columns modal instead of the top-level menu
  let itemsByColumn = getItemsByColumn(config.items)
  await showColumnItems(itemsByColumn[item.column], item.column)
}

// Set time constraints
async function setTimeConstraints(item) {
  const timeAlert = new Alert()
  timeAlert.title = "Set Time Constraints"
  timeAlert.message = "Leave fields blank for no constraint."
  
  timeAlert.addTextField("Start Time", item.startTime || "")
  timeAlert.addTextField("End Time", item.endTime || "")
  timeAlert.addTextField("Start Day (0-6, 0 is Sunday)", item.startDay !== undefined ? item.startDay.toString() : "")
  timeAlert.addTextField("End Day (0-6, 0 is Sunday)", item.endDay !== undefined ? item.endDay.toString() : "")
  
  timeAlert.addAction("Save")
  timeAlert.addAction("Clear Constraints")
  timeAlert.addCancelAction("Cancel")
  
  const response = await timeAlert.presentAlert()
  
  if (response === 0) { // Save
    try {
      item.startTime = validateAndFormatTime(timeAlert.textFieldValue(0));
      item.endTime = validateAndFormatTime(timeAlert.textFieldValue(1));
      item.startDay = validateDay(timeAlert.textFieldValue(2));
      item.endDay = validateDay(timeAlert.textFieldValue(3));
    } catch (error) {
      const errorAlert = new Alert();
      errorAlert.title = "Validation Error";
      errorAlert.message = error.message;
      errorAlert.addAction("OK");
      await errorAlert.presentAlert();
      return await setTimeConstraints(item); // Recursive call to try again
    }
  } else if (response === 1) { // Clear Constraints
    delete item.startTime;
    delete item.endTime;
    delete item.startDay;
    delete item.endDay;
  }
}

// Add a new item
async function addItem() {
  const config = loadConfig()
  const alert = new Alert()
  alert.title = "Add New Item"
  
  alert.addTextField("Name")
  alert.addTextField("Scheme URL")
  
  alert.addAction("Add to Left")
  alert.addAction("Add to Center")
  alert.addAction("Add to Right")
  alert.addCancelAction("Cancel")

  const response = await alert.presentAlert()

  if (response >= 0 && response <= 2) {
    const columns = ['left', 'center', 'right']
    const newItem = {
      name: alert.textFieldValue(0),
      scheme: alert.textFieldValue(1),
      column: columns[response]
    }
    config.items.push(newItem)
    saveConfig(config)
  }
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
}

async function run() {
  await showMainMenu()
}

await run()