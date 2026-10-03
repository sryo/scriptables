# Architecture

The Zen suite is five Scriptable widgets (`ZenTrate`, `ZenLendar`, `ZenDigest`, `ZenTheme`, `ZenTweak`) sharing utilities under `lib/` and a config module under `config/`. This document captures the rules the structure encodes, so future changes don't re-litigate them.

## Hard Scriptable constraints

These are not preferences — Scriptable will not run code that breaks them.

- **Widget scripts must live at the documents-directory root.** Scriptable's script list only shows files at the top level; anything under a subdirectory is unreachable from the app.
- **`importModule()` paths resolve from the documents directory.** `importModule("lib/theme")` works from anywhere because it's anchored at the root, not the caller's location.
- **Each script run gets a fresh JS context.** Module-level state survives within a single render but never across runs. Don't rely on cross-script in-memory caches.
- **The whole directory iCloud-syncs to every device.** There is no per-device or per-environment scoping.
- **No bundler, no npm, no TypeScript.** What's on disk is what runs. Single-file widgets, plain JS.

## Directory layout

```
.                       Widget scripts live here (must)
├── Zen<Name>.js        One file per widget, root-only
├── *_config.json       Personal runtime data (gitignored)
├── zen_theme.json      Active theme (gitignored)
├── lib/                Shared utilities — consumer-agnostic
├── config/             Per-widget config modules shared across consumers
└── ZenThemes/          Shipped + user-created theme JSONs
```

### `lib/`

Each module owns one concern. Current contents: `fs`, `theme`, `widget`, `datetime`, `validate`, `calendar`, `ui`.

**The rule that defines `lib/`: a module here must not know any specific widget's filename, schema, or behavior.** If a constant or function is widget-specific, it doesn't belong here.

### `config/`

Per-widget config persistence — schema, defaults, load/save, paths. `config/zentrate.js` is shared between `ZenTrate` (the launcher widget) and `ZenTweak` (its editor). Widgets with no sharing inline their config at the top of the widget file instead — see `ZenLendar.js` or `ZenDigest.js` for the pattern.

ZenTweak's editor is a `WebView` page split in two modules: `config/zentrate-editor.js` (page helpers plus message validation and ops, all pure) and `config/zentrate-editor-page.js` (HTML, CSS and the page's UI script). Page helpers are injected with `fn.toString()` alongside the `lib/` and `config/` functions they call, so the page runs the same code the Node tests cover. The page can't load local files, so everything it needs — theme tokens, state, the scheme catalog — is inlined.

The bridge: while `present()` is pending, Scriptable loops on `evaluateJavaScript("ZT.next()", true)`; the page answers each call with its next queued message (JSON) via `completion()`. Scriptable applies it, saves, and replies with `evaluateJavaScript("ZT.receive(<json>)")`. Scriptable can't dismiss a WebView, so every change autosaves; no Alerts are shown while the page is up.

ZenTrate draws its text instead of stacking it: WidgetStacks can't overlap, and a heavily used item should stay big even over its neighbours. `posterLayout()` in `config/zentrate.js` is the pure geometry (rows sized to their biggest name and squeezed only when they don't fit, full-width text boxes, draw order, tap cells), so the editor preview can reuse it. ZenTrate draws that into `widget.backgroundImage` at the size `lib/widget.js` `widgetSize()` looks up for the device, then overlays a grid of exactly sized stacks that carry the tap URLs; each holds a blank image, since iOS ignores taps on clear, empty views. Nothing is filled, so no boxes appear when iOS tints or clears the widget background. Lock screen accessories and the empty state keep the stacked text layout.

A module ends up in `config/` when more than one consumer needs it. Solo configs stay inline.

### `ZenThemes/`

Theme JSON files. Shipped defaults (committed to git) plus any user-created themes (also committed — they're harmless to share). The *active* theme is a separate file at the root (`zen_theme.json`, gitignored) so picking a different theme on one device doesn't churn the repo.

## Conventions

- **Active theme is memoized.** `lib/theme.js` caches the parsed theme at module scope. Safe because Scriptable's per-render fresh context bounds cache lifetime to a single render.
- **Tests run under Node with mocked Scriptable globals.** `node --test tests/`. `tests/harness.js` evaluates scripts and `lib/` modules with a fake clock, calendar, file system and alerts; `rt.widget` is the rendered tree. Write the failing test first. The harness can't prove on-device rendering, so still verify on-device after every change.
- **One concern per commit.** Each commit should leave every widget working on device. The refactor history is split this way intentionally.
- **Personal runtime data is gitignored.** `*_config.json`, `*_stats.json`, `zen_theme.json` are user state. They don't belong in source control.

## Adding a new widget

1. Create `Zen<Name>.js` at the root with Scriptable's `// icon-color: ... ; icon-glyph: ... ;` header on line 3.
2. Import only the `lib/*` modules you actually need (`Theme`, `Widget`, `DateTime`, `Calendar_`, `Validate`, `UI`, `Fs`).
3. If the widget's config is shared with another widget (e.g. an editor), put it in `config/<name>.js`. Otherwise inline at the top — see `ZenDigest.js`.
4. If the widget reads the calendar or reminders, prefer the existing `lib/calendar.js` helpers over rolling your own.
5. Add `tests/<name>.test.js`, then test on-device before committing.
