// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-gray; icon-glyph: sliders-h;
// ZenTweak.js: Configuration editor for ZenTrate

const fm = FileManager.iCloud()
const CONFIG_FILE = fm.documentsDirectory() + "/zentrate_config.json"

// Function to load configuration
function loadConfig() {
  if (fm.fileExists(CONFIG_FILE)) {
    const configString = fm.readString(CONFIG_FILE)
    return JSON.parse(configString)
  }
  return { items: [], sortMethod: "manual" }
}

// Function to save configuration
function saveConfig(config) {
  fm.writeString(CONFIG_FILE, JSON.stringify(config, null, 2))
}

// Function to get the position within the specific list
function getPositionInList(items, index) {
  const item = items[index]
  return items.filter((i, idx) => i.type === item.type && idx <= index).length
}

// Function to get the number of items in a specific list
function getListLength(items, type) {
  return items.filter(item => item.type === type).length
}

// Function to validate and format time
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

// Function to validate day
function validateDay(day) {
  if (day === '') return undefined;
  const dayNum = parseInt(day);
  if (isNaN(dayNum) || dayNum < 0 || dayNum > 6) {
    throw new Error(`Invalid day: ${day}. Please use a number between 0 and 6.`);
  }
  return dayNum;
}

// Function to show the main menu
async function showMainMenu() {
  const config = loadConfig()
  const alert = new Alert()
  alert.title = "ZenTweak"
  alert.message = "Edit ZenTrate menu items"

  config.items.forEach(item => {
    alert.addAction(item.name)
  })

  alert.addAction("Add New Item")
  alert.addAction("Sort Items")
  alert.addCancelAction("Cancel")

  const response = await alert.presentSheet()

  if (response === config.items.length) {
    await addItem()
  } else if (response === config.items.length + 1) {
    await showSortMenu()
  } else if (response !== -1) {
    await editItem(response)
  }
}

// Function to edit an item
async function editItem(index) {
  const config = loadConfig()
  const item = config.items[index]
  const alert = new Alert()
  alert.title = "Edit Item"
  
  const currentPosition = getPositionInList(config.items, index)
  const listLength = getListLength(config.items, item.type)
  
  alert.addTextField("Name", item.name)
  alert.addTextField("Scheme URL", item.scheme)
  alert.addTextField(`Position in ${item.type} list (1-${listLength})`, currentPosition.toString())
  
  alert.addAction("Save")
  alert.addAction("Set Time Constraints")
  alert.addAction(item.type === 'app' ? "Move to Shortcuts" : "Move to Apps")
  alert.addDestructiveAction("Delete")
  alert.addCancelAction("Cancel")

  const response = await alert.presentAlert()

  switch (response) {
    case 0: // Save
      item.name = alert.textFieldValue(0)
      item.scheme = alert.textFieldValue(1)
      const newPosition = parseInt(alert.textFieldValue(2)) - 1
      if (!isNaN(newPosition) && newPosition >= 0 && newPosition < listLength) {
        const sameTypeItems = config.items.filter(i => i.type === item.type)
        sameTypeItems.splice(currentPosition - 1, 1)
        sameTypeItems.splice(newPosition, 0, item)
        config.items = [
          ...config.items.filter(i => i.type !== item.type),
          ...sameTypeItems
        ]
      }
      saveConfig(config)
      break
    case 1: // Set Time Constraints
      await setTimeConstraints(item)
      saveConfig(config)
      break
    case 2: // Move to Apps/Shortcuts
      item.type = item.type === 'app' ? 'shortcut' : 'app'
      saveConfig(config)
      break
    case 3: // Delete
      config.items.splice(index, 1)
      saveConfig(config)
      break
  }
}

// Function to set time constraints
async function setTimeConstraints(item) {
  const timeAlert = new Alert()
  timeAlert.title = "Set Time Constraints"
  timeAlert.message = "Leave fields blank for no constraint."
  
  timeAlert.addTextField("Start Time (HH:MM)", item.startTime || "")
  timeAlert.addTextField("End Time (HH:MM)", item.endTime || "")
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

// Function to add a new item
async function addItem() {
  const config = loadConfig()
  const alert = new Alert()
  alert.title = "Add New Item"
  
  alert.addTextField("Name")
  alert.addTextField("Scheme URL")
  
  alert.addAction("Add as App")
  alert.addAction("Add as Shortcut")
  alert.addCancelAction("Cancel")

  const response = await alert.presentAlert()

  if (response === 0 || response === 1) {
    const newItem = {
      name: alert.textFieldValue(0),
      scheme: alert.textFieldValue(1),
      type: response === 0 ? 'app' : 'shortcut'
    }
    
    const listLength = getListLength(config.items, newItem.type)
    
    const positionAlert = new Alert()
    positionAlert.title = `Position in ${newItem.type} list`
    positionAlert.message = `Enter a position (1-${listLength + 1})`
    positionAlert.addTextField("Position", (listLength + 1).toString())
    positionAlert.addAction("Add")
    positionAlert.addCancelAction("Cancel")
    
    const positionResponse = await positionAlert.presentAlert()
    
    if (positionResponse === 0) {
      const position = parseInt(positionAlert.textFieldValue(0)) - 1
      const sameTypeItems = config.items.filter(i => i.type === newItem.type)
      if (!isNaN(position) && position >= 0 && position <= sameTypeItems.length) {
        sameTypeItems.splice(position, 0, newItem)
        config.items = [
          ...config.items.filter(i => i.type !== newItem.type),
          ...sameTypeItems
        ]
      } else {
        config.items.push(newItem)
      }
      saveConfig(config)
    }
  }
}

// Function to show the sort menu
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

// Main function to run when the script is executed
async function run() {
  await showMainMenu()
  Script.complete()
}

// Run the script
await run()
