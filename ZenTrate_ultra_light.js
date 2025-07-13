// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-gray; icon-glyph: bars;
// ZenTrate Minimal: Clean Productivity Launcher

const items = [
  { name: "Spotify", scheme: "spotify://" },
  { name: "Maps", scheme: "comgooglemaps://" },
  { name: "Whatsapp", scheme: "whatsapp://" },
  { name: "Meditation", scheme: "shortcuts://run-shortcut?name=Meditation" }
]

const bgColor = new Color("#242424")
const textColor = new Color("#f8f8f8")
const font = new Font("AvenirNext-Bold", 24)

const widget = new ListWidget()
widget.backgroundColor = bgColor
widget.setPadding(0, 8, 0, 8)

const mainStack = widget.addStack()
mainStack.layoutVertically()

for (let i = 0; i < items.length; i++) {
  const item = items[i]

  const row = mainStack.addStack()
  row.layoutHorizontally()
  row.bottomAlignContent()
  row.addSpacer(23)

  const stack = row.addStack()
  stack.setPadding(4, 4, 4, 4)
  stack.url = item.scheme

  const text = stack.addText(item.name)
  text.font = font
  text.textColor = textColor
  text.minimumScaleFactor = 0.5

  // ✅ Pushes the content to the left
  row.addSpacer()

  if (i < items.length - 1) mainStack.addSpacer(10)
}

if (config.runsInWidget) {
  Script.setWidget(widget)
} else {
  widget.presentLarge()
}
Script.complete()
