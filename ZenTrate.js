// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-gray; icon-glyph: bars;
/**
 * ZenTrate.js - A Configurable Productivity Launcher Widget
 *
 * Features:
 * - 3-column layout (left, center, right)
 * - Usage-based font scaling, drawn as one image so a big item can overlap
 *   its neighbours instead of shrinking; invisible stacks on top take the taps
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

if (!Widget.isWidget()) await ZenTrateConfig.downloadFiles()

const themeConfig = Theme.loadTheme()
const appConfig = ZenTrateConfig.loadConfig()
const usageStats = ZenTrateConfig.loadStats()
const sortMethod = appConfig.sortMethod || "manual"
const training = ZenTrateConfig.isTraining(appConfig, new Date())

// ============================================
// ITEM FILTERING & SORTING
// ============================================

/**
 * Checks if an item should be displayed based on time/day constraints
 * @param {Object} item - Item to check
 * @returns {boolean} True if item should be shown
 */
function shouldDisplayItem(item) {
  return DateTime.isScheduledAt(item, new Date())
}

// Filter and sort items
const filteredItems = appConfig.items.filter(item => shouldDisplayItem(item))
const sortedItems = ZenTrateConfig.sortItems(filteredItems, sortMethod, usageStats)

// ============================================
// FONT SIZE CALCULATION
// ============================================

const maxUsage = Math.max(...appConfig.items.map(item => usageStats[item.name] || 0), 1)

function getFontSize(usageCount) {
  return ZenTrateConfig.usageFontSize(usageCount, maxUsage, themeConfig.minFontSize, themeConfig.maxFontSize)
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
 * Adds an item to a column as its own row, aligned within the column
 * @param {WidgetStack} columnStack - Column to add item to
 * @param {Object} item - Item data
 * @param {string} align - "left", "center" or "right"
 */
function addItemToColumn(columnStack, item, align) {
  const rowStack = columnStack.addStack()
  rowStack.layoutHorizontally()
  if (align !== 'left') rowStack.addSpacer()
  addItemStack(rowStack, item)
  if (align !== 'right') rowStack.addSpacer()
}

/**
 * Adds a tappable, usage-sized item to a row
 * @param {WidgetStack} rowStack
 * @param {Object} item
 */
function addItemStack(rowStack, item) {
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

  itemStack.url = tapURL(item)
}

// URL-less items go through this script so the first tap can look one up
// and save it; while training, every tap does so it can be counted
function tapURL(item) {
  return training || isMissingScheme(item.scheme)
    ? Widget.buildActionURL(Script.name(), { shortcut: item.name, originalUrl: item.scheme })
    : item.scheme.trim().replace(/ /g, "%20")
}

// Mirrors lib/schemes isMissing: a widget can't import a not-yet-downloaded iCloud file
function isMissingScheme(scheme) {
  const s = (scheme || "").trim()
  return !s || s === "about:blank"
}

/**
 * Creates the main widget: drawn as a poster on the home screen (and in the
 * in-app preview, at large size), stacked text on the lock screen or when
 * nothing is visible
 * @returns {ListWidget}
 */
function createWidget() {
  const size = Widget.widgetSize(Widget.isWidget() ? config.widgetFamily : "large")
  const layout = size && ZenTrateConfig.posterLayout(sortedItems, {
    width: size.width,
    height: size.height,
    padding: ZenTrateConfig.POSTER_PADDING,
    minSize: themeConfig.minFontSize,
    maxSize: themeConfig.maxFontSize,
    stats: usageStats,
    maxUsage
  })
  const widget = layout && layout.entries.length
    ? createPosterWidget(layout, size)
    : createStackWidget()

  if (training) {
    const until = new Date(appConfig.training.until)
    if (until < widget.refreshAfterDate) widget.refreshAfterDate = until
  }

  const nextChange = DateTime.nextScheduleChange(appConfig.items, new Date())
  if (nextChange && nextChange < widget.refreshAfterDate) {
    widget.refreshAfterDate = nextChange
  }

  return widget
}

/**
 * WidgetStacks can't overlap, so the text is drawn into the background image
 * and a grid of empty, exactly sized stacks on top carries the tap URLs
 * @param {Object} layout - From ZenTrateConfig.posterLayout
 * @param {Object} size - { width, height } of the widget
 * @returns {ListWidget}
 */
function createPosterWidget(layout, size) {
  const widget = Widget.createWidget({ padding: [0, 0, 0, 0], theme: themeConfig })
  widget.spacing = 0
  widget.backgroundImage = drawPoster(layout, size)
  addTapCells(widget, layout, size)
  return widget
}

/**
 * Draws biggest first, so smaller names land on top; each clears a backdrop
 * in the background color to stay readable over a big one
 */
function drawPoster(layout, size) {
  const ctx = new DrawContext()
  ctx.size = new Size(size.width, size.height)
  ctx.respectScreenScale = true
  ctx.opaque = false

  const textColor = Theme.getTextColor(themeConfig)
  const backgroundColor = Theme.getBackgroundColor(themeConfig)
  const toRect = r => new Rect(r.x, r.y, r.w, r.h)

  for (const entry of layout.entries) {
    if (entry.knockoutRect) {
      ctx.setFillColor(backgroundColor)
      ctx.fillRect(toRect(entry.knockoutRect))
    }
    ctx.setFont(Theme.getFont(entry.fontSize, { theme: themeConfig }))
    ctx.setTextColor(textColor)
    if (entry.align === 'center') ctx.setTextAlignedCenter()
    else if (entry.align === 'right') ctx.setTextAlignedRight()
    else ctx.setTextAlignedLeft()
    ctx.drawTextInRect(entry.name, toRect(entry.textRect))
  }
  return ctx.getImage()
}

function blankImage(width, height) {
  const ctx = new DrawContext()
  ctx.size = new Size(Math.max(1, Math.round(width)), Math.max(1, Math.round(height)))
  ctx.opaque = false
  ctx.respectScreenScale = false
  ctx.setFillColor(new Color(themeConfig.bgColor, 0.02))
  ctx.fillRect(new Rect(0, 0, ctx.size.width, ctx.size.height))
  return ctx.getImage()
}

function addTapCells(widget, layout, size) {
  const padding = ZenTrateConfig.POSTER_PADDING
  const cellWidth = size.width / layout.columns.length

  const grid = widget.addStack()
  grid.layoutVertically()
  grid.spacing = 0
  const top = layout.rowTops.length ? layout.rowTops[0] : padding.v
  grid.addSpacer(top)
  for (let row = 0; row < layout.rows; row++) {
    const rowStack = grid.addStack()
    rowStack.layoutHorizontally()
    rowStack.spacing = 0
    rowStack.size = new Size(size.width, layout.rowHeights[row])
    for (const column of layout.columns) {
      const cell = rowStack.addStack()
      cell.size = new Size(cellWidth, layout.rowHeights[row])
      const entry = layout.entries.find(e => e.row === row && e.column === column)
      if (entry) {
        cell.url = tapURL(entry.item)
        // iOS ignores taps on clear, empty views; an image is hit-tested
        // across its whole frame, so a blank one makes the cell tappable
        const image = cell.addImage(blankImage(cellWidth, layout.rowHeights[row]))
        image.imageSize = new Size(cellWidth, layout.rowHeights[row])
      }
    }
  }
  const used = layout.rowHeights.reduce((sum, h) => sum + h, 0)
  grid.addSpacer(size.height - top - used)
}

/**
 * Stacked text layout for lock screen accessories and the empty state
 * @returns {ListWidget}
 */
function createStackWidget() {
  const widget = Widget.createWidget({
    padding: [0, 16, 0, 16],
    theme: themeConfig
  })

  // Group items by column
  const leftItems = sortedItems.filter(item => item.column === 'left')
  const centerItems = sortedItems.filter(item => item.column === 'center')
  const rightItems = sortedItems.filter(item => item.column === 'right')

  if (centerItems.length === 0) {
    addSideRows(widget, leftItems, rightItems)
    return widget
  }

  // Every row inside a column has a flexible spacer, so the three columns are
  // equally flexible and split the width in thirds: the center column sits on
  // the widget's axis no matter how wide or empty the side columns are
  const columnsStack = widget.addStack()
  columnsStack.layoutHorizontally()
  columnsStack.topAlignContent()

  const columns = [['left', leftItems], ['center', centerItems], ['right', rightItems]]
  for (const [align, items] of columns) {
    const columnStack = columnsStack.addStack()
    columnStack.layoutVertically()
    items.forEach(item => addItemToColumn(columnStack, item, align))
    if (items.length === 0) {
      const filler = columnStack.addStack()
      filler.layoutHorizontally()
      filler.addSpacer()
    }
  }

  return widget
}

/**
 * With no center column there is no axis to protect, so left and right items
 * share rows and a heavily used item can take whatever width the row has free.
 */
function addSideRows(widget, leftItems, rightItems) {
  const rowsStack = widget.addStack()
  rowsStack.layoutVertically()

  const rowCount = Math.max(leftItems.length, rightItems.length)
  for (let i = 0; i < rowCount; i++) {
    const rowStack = rowsStack.addStack()
    rowStack.layoutHorizontally()
    rowStack.bottomAlignContent()
    if (leftItems[i]) addItemStack(rowStack, leftItems[i])
    rowStack.addSpacer()
    if (rightItems[i]) addItemStack(rowStack, rightItems[i])
  }
}

// ============================================
// MAIN EXECUTION
// ============================================

const params = Widget.getActionParams()

if (params.shortcut) {
  // Handle item tap - update stats and open URL.
  // Scriptable already percent-decodes queryParameters; decoding again breaks
  // URLs with escapes (name=Create%20Reminder) and names containing "%"
  const shortcutName = params.shortcut
  let url = params.originalUrl
  ZenTrateConfig.updateUsageCount(shortcutName)

  // Imported here, not at the top: the widget render never needs it, and a
  // widget can't pull a not-yet-downloaded iCloud file, so a top-level import breaks rendering
  const Schemes = importModule("lib/schemes")

  // Items saved without a URL look one up by name on first tap, then keep it
  if (Schemes.isMissing(url)) {
    const found = await Schemes.resolve(shortcutName).catch(() => null)
    if (found) {
      url = found.scheme
      const config = ZenTrateConfig.loadConfig()
      const item = config.items.find(i => i.name === shortcutName)
      if (item) {
        item.scheme = url
        ZenTrateConfig.saveConfig(config)
      }
    }
  }

  if (Schemes.isMissing(url)) {
    const alert = new Alert()
    alert.title = "No URL"
    alert.message = `Couldn't find a URL for "${shortcutName}". Set one in ZenTweak.`
    alert.addAction("OK")
    await alert.presentAlert()
  } else {
    Safari.open(url)
  }
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
