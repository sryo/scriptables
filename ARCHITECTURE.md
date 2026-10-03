# Architecture

The Zen suite is four Scriptable widgets (`ZenTrate`, `ZenLendar`, `ZenDigest`, `ZenTweak`) sharing utilities under `lib/` and a config module under `config/`. This document captures the rules the structure encodes, so future changes don't re-litigate them.

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

### `lib/theme.js`

The one source of truth for themes. Widgets and the ZenTweak page never patch theme values themselves; they read them through this module.

- **Pure model** (no Scriptable globals, no imports): `modelSource()` returns it as script source for WebView pages. `normalizeTheme` turns any stored or typed theme into the canonical shape (numeric sizes clamped to 8–72 and ordered, uppercase 6-digit hex, boolean italic, a known weight, `appearance`, cleaned variants) and lists what it fixed as warnings; invalid values fall back to `DEFAULT_THEME`, so every consumer shows the same default. `validateTheme` returns Spanish field errors for editor input. `resolveColors`, `effectiveAppearance`, `contrastRatio`, `fontSpec` and `toCss` complete it.
- **Appearance.** A theme's flat `bgColor`/`textColor`/`accentColor` are its base colors. Optional `light` and `dark` blocks override any of them for that appearance. `appearance` is `"auto"` (default: follow the device), `"dark"` or `"light"` (force that variant). A flat theme without variants looks the same in both, exactly like before variants existed. Live widget colors come from `getTextColor`/`getBackgroundColor`/`getAccentColor`, which return `Color.dynamic` only for an auto theme with variants. Anything baked into an image (ZenTrate's poster) uses `resolveForRender`, which reads `Device.isUsingDarkAppearance()` and pairs the text with a static background so the two can't drift apart before the next render.
- **Fonts.** `FONT_CATALOG` lists the system kinds (SF, rounded, mono via Scriptable's weighted factories) and curated iOS families with their real PostScript faces. Scriptable has no serif factory, so "serif" is Times New Roman. `fontSpec` resolves an id, label, legacy spelling or PostScript name to a family, then picks the face nearest the requested weight/italic. `toScriptableFont` is the only place that builds a `Font`, and `toCss` names the same face for the editor, so the page never shows synthetic bold. System italic exists only at regular weight; rounded and mono have no italic, and the spec says so.
- **Storage.** `ZenThemes/*.json` hold normalized themes without bookkeeping. `saveAsNew` never overwrites (`noir.json` → `noir-2.json`), `updateTheme(filename, …)` keeps the filename, `deleteTheme` refuses the active theme's source. The active copy in `zen_theme.json` records `source: "<filename>"`; `loadAllThemes` marks that theme `active` and attaches each `filename`, and neither field is persisted in a theme file.

### `config/`

Per-widget config persistence — schema, defaults, load/save, paths. `config/zentrate.js` is shared between `ZenTrate` (the launcher widget) and `ZenTweak` (its editor). Widgets with no sharing inline their config at the top of the widget file instead — see `ZenLendar.js` or `ZenDigest.js` for the pattern.

ZenTweak's editor is a `WebView` page split in two modules: `config/zentrate-editor.js` (page helpers plus message validation and ops, all pure) and `config/zentrate-editor-page.js` (HTML, CSS and the page's UI script). Its theme tokens come from `lib/theme.js`: both appearances' colors, plus a `prefers-color-scheme` block when the theme is adaptive. Page helpers are injected with `fn.toString()` alongside the `lib/` and `config/` functions they call, so the page runs the same code the Node tests cover. The page can't load local files, so everything it needs — theme tokens, state, the scheme catalog — is inlined.

The bridge: while `present()` is pending, Scriptable loops on `evaluateJavaScript("ZT.next()", true)`; the page answers each call with its next queued message (JSON) via `completion()`. Scriptable applies it, saves, and replies with `evaluateJavaScript("ZT.receive(<json>)")`. Scriptable can't dismiss a WebView, so every change autosaves; no Alerts are shown while the page is up.

Themes are managed in the same page (section Tema, right under the preview): a strip of theme chips (tap applies, long-press or Editar opens the edit sheet, + Nuevo duplicates the active theme), the active theme's appearance, and a sheet for name, variant colors, font, weight, italic and sizes. Theme ops (`theme.apply`, `theme.appearance`, `theme.update`, `theme.duplicate`, `theme.delete`, `theme.undoDelete`) are decided by `applyThemeOp` in `config/zentrate-editor.js`, which returns one effect without touching files; `ZenTweak.handleThemeOp` carries it out with `lib/theme` (`applyTheme`, `updateTheme`, `saveAsNew`, `deleteTheme`, `saveTheme`) and replies with fresh state, including the new page tokens, so the page re-themes itself by rewriting its `<style id="theme-vars">`. Drafts are validated with `validateTheme` on the page and again in `applyThemeOp`; nothing invalid is saved. A deleted theme's file goes immediately and `theme.undoDelete` writes it back under the same filename (or a new one if that name was taken since), until the next op. Running `scriptable:///run?scriptName=ZenTweak&focus=tema` (e.g. from a Shortcut) opens the editor scrolled to Tema.

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
