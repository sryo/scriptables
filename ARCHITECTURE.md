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

Per-widget config persistence — schema, defaults, load/save, paths. Today this directory holds only `config/zentrate.js`, which is shared between `ZenTrate` (the launcher widget) and `ZenTweak` (its editor). Widgets with no sharing inline their config at the top of the widget file instead — see `ZenLendar.js` or `ZenDigest.js` for the pattern.

A module ends up in `config/` when more than one consumer needs it. Solo configs stay inline.

### `ZenThemes/`

Theme JSON files. Shipped defaults (committed to git) plus any user-created themes (also committed — they're harmless to share). The *active* theme is a separate file at the root (`zen_theme.json`, gitignored) so picking a different theme on one device doesn't churn the repo.

## Conventions

- **Active theme is memoized.** `lib/theme.js` caches the parsed theme at module scope. Safe because Scriptable's per-render fresh context bounds cache lifetime to a single render.
- **No automated tests.** Verify on-device after every change: sync iCloud, tap *Run* in the Scriptable app, or place the widget on a home screen and wait for refresh.
- **One concern per commit.** Each commit should leave every widget working on device. The refactor history is split this way intentionally.
- **Personal runtime data is gitignored.** `*_config.json`, `*_stats.json`, `zen_theme.json` are user state. They don't belong in source control.

## Adding a new widget

1. Create `Zen<Name>.js` at the root with Scriptable's `// icon-color: ... ; icon-glyph: ... ;` header on line 3.
2. Import only the `lib/*` modules you actually need (`Theme`, `Widget`, `DateTime`, `Calendar_`, `Validate`, `UI`, `Fs`).
3. If the widget's config is shared with another widget (e.g. an editor), put it in `config/<name>.js`. Otherwise inline at the top — see `ZenDigest.js`.
4. If the widget reads the calendar or reminders, prefer the existing `lib/calendar.js` helpers over rolling your own.
5. Test on-device before committing.
