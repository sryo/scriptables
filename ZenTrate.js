// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-gray; icon-glyph: bars;
/**
 * ZenTrate.js - A Configurable Productivity Launcher Widget
 *
 * Features:
 * - 3-column layout (left, center, right)
 * - Usage-based font scaling
 * - Time and day constraints for items
 * - Multiple sort modes (manual, alphabetical, usage)
 */

const Theme = importModule("lib/theme")
const Widget = importModule("lib/widget")
const DateTime = importModule("lib/datetime")
const ZenTrateConfig = importModule("config/zentrate")

// ============================================
// CONFIGURATION
// ============================================

const themeConfig = Theme.loadTheme()
const appConfig = ZenTrateConfig.loadConfig()
const usageStats = ZenTrateConfig.loadStats()
const sortMethod = appConfig.sortMethod || "manual"

// ============================================
// ITEM FILTERING & SORTING
// ============================================

/**
 * Checks if an item should be displayed based on time/day constraints
 * @param {Object} item - Item to check
 * @returns {boolean} True if item should be shown
 */
function shouldDisplayItem(item) {
  return DateTime.isWithinTimeRange(item.startTime, item.endTime) &&
         DateTime.isWithinDayRange(item.startDay, item.endDay)
}

/**
 * Sorts items based on current sort method
 * @param {Object[]} items - Items to sort
 * @returns {Object[]} Sorted items
 */
function sortItems(items) {
  switch (sortMethod) {
    case 'usage':
      return items.sort((a, b) => (usageStats[b.name] || 0) - (usageStats[a.name] || 0))
    case 'alphabetical':
      return items.sort((a, b) => a.name.localeCompare(b.name))
    case 'manual':
    default:
      return items
  }
}

// Filter and sort items
const filteredItems = appConfig.items.filter(item => shouldDisplayItem(item))
const sortedItems = sortItems(filteredItems)

// ============================================
// FONT SIZE CALCULATION
// ============================================

/**
 * Calculates font size based on usage count using hybrid logarithmic-accelerated scaling.
 * Items with higher usage get progressively larger fonts.
 *
 * @param {number} usageCount - Number of times item has been used
 * @returns {number} Calculated font size
 */
function getFontSize(usageCount) {
  const minSize = themeConfig.minFontSize
  const maxSize = themeConfig.maxFontSize
  const maxUsage = Math.max(...Object.values(usageStats), 1)

  // Prevent zero division
  const safeCount = Math.max(usageCount, 0.001)
  const safeMax = Math.max(maxUsage, 1)

  // Hybrid logarithmic-accelerated scaling
  // Power of 10 creates aggressive curve emphasizing top items
  const logScale = Math.log(safeCount + 1) / Math.log(safeMax + 1)
  const acceleratedScale = Math.pow(logScale, 10)

  return Math.min(
    Math.round(minSize + acceleratedScale * (maxSize - minSize)),
    maxSize
  )
}

/**
 * Calculates padding based on font size for vertical alignment
 * @param {number} fontSize - Current font size
 * @returns {Object} Padding values
 */
function calculatePadding(fontSize) {
  const maxFontSize = themeConfig.maxFontSize
  const basePadding = 0
  const extraPadding = Math.max(0, (maxFontSize - fontSize) / 3)

  return {
    top: basePadding + extraPadding,
    bottom: basePadding + extraPadding,
    left: basePadding,
    right: basePadding
  }
}

// ============================================
// WIDGET CREATION
// ============================================

/**
 * Adds an item to a row stack
 * @param {WidgetStack} rowStack - Row to add item to
 * @param {Object} item - Item data
 */
function addItemToRow(rowStack, item) {
  const itemStack = rowStack.addStack()
  const usageCount = usageStats[item.name] || 0
  const fontSize = getFontSize(usageCount)
  const padding = calculatePadding(fontSize)

  const textStack = itemStack.addStack()
  textStack.setPadding(padding.top, padding.left, padding.bottom, padding.right)

  const itemText = textStack.addText(item.name)
  itemText.font = Theme.getFont(fontSize, { theme: themeConfig })
  itemText.textColor = Theme.getTextColor(themeConfig)
  itemText.minimumScaleFactor = 0.5
  itemText.lineLimit = 1

  // URL for tracking usage and launching
  itemStack.url = Widget.buildActionURL(Script.name(), {
    shortcut: item.name,
    originalUrl: item.scheme
  })
}

/**
 * Creates the main widget
 * @returns {ListWidget}
 */
function createWidget() {
  const widget = Widget.createWidget({
    padding: [0, 16, 0, 16],
    theme: themeConfig
  })

  const mainStack = widget.addStack()
  mainStack.layoutVertically()

  // Group items by column
  const leftItems = sortedItems.filter(item => item.column === 'left')
  const centerItems = sortedItems.filter(item => item.column === 'center')
  const rightItems = sortedItems.filter(item => item.column === 'right')

  const maxRows = Math.max(leftItems.length, centerItems.length, rightItems.length)

  // Create rows
  for (let i = 0; i < maxRows; i++) {
    const rowStack = mainStack.addStack()
    rowStack.layoutHorizontally()
    rowStack.bottomAlignContent()

    // Left column
    if (i < leftItems.length) {
      addItemToRow(rowStack, leftItems[i])
    } else {
      rowStack.addSpacer()
    }

    rowStack.addSpacer()

    // Center column
    if (i < centerItems.length) {
      addItemToRow(rowStack, centerItems[i])
    } else {
      rowStack.addSpacer()
    }

    rowStack.addSpacer()

    // Right column
    if (i < rightItems.length) {
      addItemToRow(rowStack, rightItems[i])
    } else {
      rowStack.addSpacer()
    }

    // Vertical spacing between rows
    if (i < maxRows - 1) {
      mainStack.addSpacer(0)
    }
  }

  return widget
}

// ============================================
// MAIN EXECUTION
// ============================================

const params = Widget.getActionParams()

if (params.shortcut) {
  // Handle item tap - update stats and open URL
  const shortcutName = decodeURIComponent(params.shortcut)
  const originalUrl = decodeURIComponent(params.originalUrl)
  ZenTrateConfig.updateUsageCount(shortcutName)
  Safari.open(originalUrl)
  Script.complete()
} else {
  // Display widget
  const widget = createWidget()
  if (Widget.isWidget()) {
    Script.setWidget(widget)
  } else {
    widget.presentLarge()
  }
}
