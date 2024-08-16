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
  return { items: [] }
}

// Function to save configuration
function saveConfig(config) {
  fm.writeString(CONFIG_FILE, JSON.stringify(config, null, 2))
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
  alert.addCancelAction("Cancel")

  const response = await alert.presentAlert()

  if (response === config.items.length) {
    await addItem()
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
  
  alert.addTextField("Name", item.name)
  alert.addTextField("List (app/shortcut)", item.type)
  alert.addTextField("Scheme URL", item.scheme)
  
  alert.addAction("Save")
  alert.addAction("Move Up")
  alert.addAction("Move Down")
  alert.addDestructiveAction("Delete")
  alert.addCancelAction("Cancel")

  const response = await alert.presentAlert()

  switch (response) {
    case 0: // Save
      item.name = alert.textFieldValue(0)
      item.type = alert.textFieldValue(1)
      item.scheme = alert.textFieldValue(2)
      saveConfig(config)
      break
    case 1: // Move Up
      if (index > 0) {
        const temp = config.items[index - 1]
        config.items[index - 1] = item
        config.items[index] = temp
        saveConfig(config)
      }
      break
    case 2: // Move Down
      if (index < config.items.length - 1) {
        const temp = config.items[index + 1]
        config.items[index + 1] = item
        config.items[index] = temp
        saveConfig(config)
      }
      break
    case 3: // Delete
      config.items.splice(index, 1)
      saveConfig(config)
      break
  }
}

// Function to add a new item
async function addItem() {
  const alert = new Alert()
  alert.title = "Add New Item"
  
  alert.addTextField("Name")
  alert.addTextField("Type (app/shortcut)")
  alert.addTextField("Scheme URL")
  
  alert.addAction("Save")
  alert.addCancelAction("Cancel")

  const response = await alert.presentAlert()

  if (response === 0) {
    const config = loadConfig()
    config.items.push({
      name: alert.textFieldValue(0),
      type: alert.textFieldValue(1),
      scheme: alert.textFieldValue(2)
    })
    saveConfig(config)
  }
}

// Main function to run when the script is executed
async function run() {
  await showMainMenu()
  Script.complete()
}

// Run the script
await run()