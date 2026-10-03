// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-gray; icon-glyph: sliders-h;
/**
 * config/zentrate-editor-page.js - HTML, CSS and UI script of ZenTweak's editor page.
 *
 * render() returns a self-contained page: no network, no local file loads.
 * editorApp() runs inside the WebView and relies on the helpers that
 * config/zentrate-editor injects before it (createBridge, previewPoster, …)
 * and on Scriptable's global completion().
 */

const CSS = `
* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
:root {
  --muted: rgba(var(--text-rgb), .55);
  --line: rgba(var(--text-rgb), .16);
  --fill: rgba(var(--text-rgb), .08);
  --fill-strong: rgba(var(--text-rgb), .18);
  --danger: #FF453A;
}
html, body { margin: 0; background: var(--bg); color: var(--text); }
body {
  font: 16px/1.35 -apple-system, system-ui, sans-serif;
  padding: max(16px, env(safe-area-inset-top)) 16px calc(40px + env(safe-area-inset-bottom));
  -webkit-text-size-adjust: 100%;
}
body.is-dragging { overflow: hidden; }
button { font: inherit; color: inherit; cursor: pointer; }
input { font: inherit; }
h1 { font-size: 22px; margin: 0; }
h2 { font-size: 18px; margin: 0; }
h3, .section-title {
  font-size: 12px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase;
  color: var(--muted); margin: 24px 0 8px;
}
header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 14px; }
#status { font-size: 13px; color: var(--muted); }
#status.failed { color: var(--danger); }

.preview {
  position: relative; overflow: hidden; border-radius: 22px;
  border: 1px solid var(--line); background: var(--bg);
}
.poster {
  position: absolute; left: 0; top: 0; transform-origin: 0 0;
  font-family: var(--font); font-weight: var(--weight); font-style: var(--style);
}
.poster .ptext { position: absolute; white-space: nowrap; line-height: 1.2; }
.preview .empty { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
.empty { grid-column: 1 / -1; align-self: center; text-align: center; color: var(--muted); font: 14px -apple-system, system-ui, sans-serif; }

.scrubber { margin-top: 12px; }
#scrub-label { font-size: 14px; color: var(--muted); margin-bottom: 8px; }
.pills { display: flex; gap: 6px; flex-wrap: wrap; }
.pill {
  min-width: 36px; height: 32px; padding: 0 10px; border-radius: 16px;
  border: 1px solid var(--line); background: transparent; font-size: 14px;
}
.pill.on { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
.scrub-row { display: flex; align-items: center; gap: 10px; margin-top: 10px; }
input[type=range] { flex: 1; accent-color: var(--accent); }

.segmented { display: flex; background: var(--fill); border-radius: 10px; padding: 2px; }
.segmented button { flex: 1; border: 0; background: transparent; padding: 7px 4px; border-radius: 8px; font-size: 14px; }
.segmented button.on { background: var(--fill-strong); font-weight: 600; }

.columns { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.col-title { font-size: 11px; font-weight: 600; letter-spacing: .06em; color: var(--muted); margin-bottom: 6px; }
.chips { min-height: 8px; }
.chip {
  background: var(--fill); border-radius: 10px; padding: 8px; margin-bottom: 6px;
  -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; touch-action: manipulation;
  transition: opacity .2s;
}
.chip-name { font-weight: 600; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.chip-sched { font-size: 11px; color: var(--muted); }
.chip.faded { opacity: .25; }
.chip.dragging { opacity: .3; }
.ghost {
  position: fixed; z-index: 50; margin: 0; pointer-events: none; opacity: .95;
  transform: scale(1.05); box-shadow: 0 8px 24px rgba(0, 0, 0, .45);
  background-color: var(--bg); background-image: linear-gradient(var(--fill-strong), var(--fill-strong));
}
.drop-marker { height: 2px; margin: -1px 0 5px; background: var(--accent); border-radius: 1px; }
.add {
  width: 100%; border: 1px dashed var(--line); background: transparent; color: var(--muted);
  border-radius: 10px; padding: 8px 4px; font-size: 13px;
}

.training p { margin: 0 0 10px; }
.hint { font-size: 13px; color: var(--muted); }
.row { display: flex; gap: 8px; align-items: center; }
.row > .field, .row > input { flex: 1; min-width: 0; }
.wrap { flex-wrap: wrap; }
.btn { background: var(--fill); border: 0; border-radius: 10px; padding: 10px 14px; font-size: 15px; white-space: nowrap; }
.btn.accent { background: var(--accent); color: var(--on-accent); }
.btn.danger { color: var(--danger); width: 100%; margin-top: 24px; }
.btn:disabled { opacity: .35; }
.link { background: none; border: 0; color: var(--accent); font-size: 16px; padding: 4px 0; }
.error { color: var(--danger); font-size: 13px; margin: 6px 0 0; }
.error:empty { display: none; }
.badge { display: inline-block; margin: 10px 0 0; font-size: 12px; color: var(--accent); border: 1px solid var(--accent); border-radius: 8px; padding: 3px 8px; }
[hidden] { display: none !important; }

.field { display: block; margin-top: 14px; }
.field > span { display: block; font-size: 13px; color: var(--muted); margin-bottom: 6px; }
input[type=text], input[type=password], input[type=url], input[type=time], input:not([type]) {
  width: 100%; background: var(--fill); color: var(--text); border: 1px solid var(--line);
  border-radius: 10px; padding: 10px 12px; font-size: 16px; -webkit-appearance: none; appearance: none;
}
input[type=time] { min-height: 44px; }
.switch-row { display: flex; align-items: center; justify-content: space-between; }
.switch { -webkit-appearance: none; appearance: none; width: 51px; height: 31px; border-radius: 16px; background: var(--fill-strong); position: relative; transition: background .2s; margin: 0; }
.switch::before { content: ""; position: absolute; top: 2px; left: 2px; width: 27px; height: 27px; border-radius: 50%; background: #fff; transition: transform .2s; }
.switch:checked { background: var(--accent); }
.switch:checked::before { transform: translateX(20px); }

.backdrop { position: fixed; inset: 0; z-index: 20; background: rgba(0, 0, 0, .5); opacity: 0; pointer-events: none; transition: opacity .2s; }
.backdrop.open { opacity: 1; pointer-events: auto; }
.sheet {
  position: absolute; left: 0; right: 0; bottom: 0; max-height: 88vh; overflow-y: auto;
  border-radius: 18px 18px 0 0; padding: 16px 16px calc(24px + env(safe-area-inset-bottom));
  background-color: var(--bg); background-image: linear-gradient(var(--fill), var(--fill));
  transform: translateY(100%); transition: transform .25s;
}
.backdrop.open .sheet { transform: none; }
.sheet-head { display: flex; align-items: center; justify-content: space-between; }
.results { margin-top: 8px; }
.result {
  display: flex; justify-content: space-between; gap: 12px; width: 100%; text-align: left;
  background: none; border: 0; border-bottom: 1px solid var(--line); padding: 12px 2px;
}
.result small { color: var(--muted); font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.toast {
  position: fixed; z-index: 30; left: 16px; right: 16px; bottom: calc(16px + env(safe-area-inset-bottom));
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 12px 14px; border-radius: 12px; border: 1px solid var(--line);
  background-color: var(--bg); background-image: linear-gradient(var(--fill-strong), var(--fill-strong));
  transform: translateY(160%); transition: transform .25s;
}
.toast.show { transform: none; }
.section-head { display: flex; align-items: baseline; justify-content: space-between; }
.link.small { font-size: 14px; }
.theme-strip {
  display: flex; gap: 12px; overflow-x: auto; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch;
  margin: 10px -16px 0; padding: 6px 16px 4px; scroll-padding: 0 16px; scrollbar-width: none;
}
.theme-strip::-webkit-scrollbar { display: none; }
.tchip {
  flex: 0 0 72px; width: 72px; height: 88px; padding: 0; border: 0; background: none; scroll-snap-align: start;
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  -webkit-user-select: none; user-select: none; -webkit-touch-callout: none;
}
.tswatch { position: relative; flex: 0 0 56px; width: 72px; height: 56px; border-radius: 12px; overflow: hidden; border: 1px solid var(--line); }
.tchip[aria-pressed="true"] .tswatch { outline: 2px solid var(--accent); outline-offset: 2px; }
.tlayer { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
.tlayer.half-light { clip-path: polygon(0 0, 100% 0, 0 100%); }
.tlayer.half-dark { clip-path: polygon(100% 0, 100% 100%, 0 100%); }
.taa { font-size: 22px; line-height: 1; }
.tdot { position: absolute; right: 7px; bottom: 7px; width: 8px; height: 8px; border-radius: 50%; }
.tname { font-size: 12px; max-width: 72px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tnew .tswatch { border-style: dashed; display: flex; align-items: center; justify-content: center; color: var(--muted); font-size: 24px; }

.preview.mini { margin-top: 12px; }
.color-row { margin-top: 14px; }
.color-row > span { display: block; font-size: 13px; color: var(--muted); margin-bottom: 6px; }
.swatches { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.swatch { width: 30px; height: 30px; border-radius: 50%; border: 1px solid var(--line); padding: 0; }
.swatch.on { outline: 2px solid var(--accent); outline-offset: 2px; }
.cpick {
  position: relative; width: 30px; height: 30px; border-radius: 50%; border: 1px dashed var(--line);
  display: inline-flex; align-items: center; justify-content: center; color: var(--muted); overflow: hidden;
}
.cpick input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; border: 0; padding: 0; }
input.hex { flex: 0 0 92px; width: 92px; padding: 6px 8px; font: 14px ui-monospace, Menlo, monospace; text-transform: uppercase; }
.contrast { display: inline-block; margin: 14px 0 0; font-size: 12px; border: 1px solid; border-radius: 8px; padding: 3px 8px; }
.contrast.good { color: #30D158; }
.contrast.warn { color: #FF9F0A; }
.font-cards { display: flex; gap: 8px; overflow-x: auto; scroll-snap-type: x proximity; margin: 0 -16px; padding: 0 16px 4px; scrollbar-width: none; }
.font-cards::-webkit-scrollbar { display: none; }
.fcard {
  flex: 0 0 auto; min-width: 104px; border: 1px solid var(--line); background: var(--fill);
  border-radius: 12px; padding: 10px 12px; text-align: left; scroll-snap-align: start;
}
.fcard.on { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }
.fcard .sample { display: block; font-size: 20px; line-height: 1.3; white-space: nowrap; }
.fcard small { display: block; font-size: 11px; color: var(--muted); margin-top: 4px; white-space: nowrap; }
.pill:disabled { opacity: .3; }
#t-weights { margin-top: 10px; }
.size-label { font-size: 15px; font-weight: 600; }
.slider-row { display: flex; align-items: center; gap: 10px; margin-top: 10px; }
.slider-row > span { flex: 0 0 52px; font-size: 13px; color: var(--muted); }
`

const BODY = `
<header><h1>ZenTrate</h1><span id="status">Guardado</span></header>
<section class="preview" id="preview" aria-label="Vista previa"></section>
<div class="scrubber">
  <div id="scrub-label"></div>
  <div class="pills" id="scrub-days"></div>
  <div class="scrub-row">
    <input type="range" id="scrub-time" min="0" max="95" step="1" aria-label="Hora">
    <button class="pill" id="scrub-now">Ahora</button>
  </div>
</div>
<section id="tema" aria-label="Tema">
  <div class="section-head"><div class="section-title">Tema</div><button class="link small" id="theme-edit">Editar</button></div>
  <div class="segmented" id="appearance"></div>
  <div class="theme-strip" id="theme-strip" role="group" aria-label="Temas"></div>
  <p class="hint">Tocá para aplicar. Mantené presionado para editar. Se aplica a ZenTrate, ZenLendar y ZenDigest.</p>
</section>
<div class="section-title">Orden</div>
<div class="segmented" id="sort"></div>
<div class="section-title">Elementos</div>
<p class="hint">Tocá un elemento para editarlo. Mantenelo presionado para moverlo.</p>
<div class="columns" id="columns"></div>
<section class="training">
  <div class="section-title">Entrenamiento</div>
  <p id="training-text"></p>
  <div class="row">
    <button class="btn" id="train">Entrenar 14 días</button>
    <button class="btn" id="stop-train">Detener</button>
  </div>
  <p class="hint">Mientras aprende, cada toque pasa por Scriptable para contarlo y ajustar los tamaños.</p>
</section>
<div class="backdrop" id="backdrop"><div class="sheet" id="sheet" role="dialog"></div></div>
<div class="toast" id="toast" role="status"></div>
`

const ITEM_SHEET = `
<div class="sheet-head"><h2>Editar elemento</h2><button class="link" id="s-close">Listo</button></div>
<label class="field"><span>Nombre</span><input type="text" id="f-name" autocomplete="off"></label>
<div class="field"><span>URL</span>
  <div class="row">
    <input type="url" id="f-url" placeholder="Vacía: se busca al tocarlo" autocapitalize="off" autocorrect="off" spellcheck="false">
    <button class="btn" id="f-test">Probar</button>
  </div>
</div>
<p class="error" id="f-error"></p>
<div class="field"><span>Columna</span><div class="segmented" id="f-col"></div></div>
<div class="row" style="margin-top:8px">
  <button class="btn" id="f-up">Subir</button><button class="btn" id="f-down">Bajar</button>
</div>
<h3>Horario</h3>
<label class="switch-row"><span>Siempre visible</span><input type="checkbox" class="switch" id="f-always"></label>
<div id="f-sched">
  <div class="row">
    <label class="field"><span>Desde</span><input type="time" id="f-start"></label>
    <label class="field"><span>Hasta</span><input type="time" id="f-end"></label>
  </div>
  <p class="badge" id="f-overnight">Cruza medianoche · termina el día siguiente</p>
  <div class="field"><span>Días</span><div class="pills" id="f-days"></div></div>
</div>
<p class="error" id="f-sched-error"></p>
<button class="btn danger" id="f-delete">Eliminar elemento</button>
`

const ADD_SHEET = `
<div class="sheet-head"><h2 id="a-title"></h2><button class="link" id="s-close">Cerrar</button></div>
<label class="field"><span>Nombre</span><input type="text" id="a-name" placeholder="App, acción o atajo" autocomplete="off"></label>
<div class="results" id="a-results"></div>
<div class="row wrap" style="margin-top:12px">
  <button class="btn" id="a-claude">Preguntar a Claude</button>
  <button class="btn" id="a-shortcut">Atajo</button>
  <button class="btn" id="a-manual">URL manual</button>
</div>
<p class="hint" id="a-claude-status" hidden></p>
<div class="results" id="a-claude-results"></div>
<div id="a-key-box" hidden>
  <p class="hint">Pegá tu clave de API de Anthropic (console.anthropic.com). Se guarda en el llavero de iOS.</p>
  <div class="row">
    <input type="password" id="a-key" placeholder="sk-ant-…" autocapitalize="off" autocorrect="off" spellcheck="false">
    <button class="btn accent" id="a-save-key">Guardar</button>
  </div>
</div>
<div id="a-manual-box" hidden>
  <div class="row" style="margin-top:12px">
    <input type="url" id="a-url" placeholder="app://" autocapitalize="off" autocorrect="off" spellcheck="false">
    <button class="btn accent" id="a-add-url">Añadir</button>
  </div>
</div>
<p class="error" id="a-error"></p>
`

const THEME_SHEET = `
<div class="sheet-head"><h2>Editar tema</h2><button class="link" id="s-close">Listo</button></div>
<p class="error" id="t-error"></p>
<section class="preview mini" id="t-preview" aria-label="Vista previa del tema"></section>
<label class="field"><span>Nombre</span><input type="text" id="t-name" autocomplete="off"></label>
<p class="error" id="te-name"></p>
<label class="switch-row field"><span>Distinto en modo claro/oscuro</span><input type="checkbox" class="switch" id="t-variants"></label>
<div class="field" id="t-variant-box"><span>Variante</span><div class="segmented" id="t-variant"></div></div>
<div id="t-colors"></div>
<p class="contrast" id="t-contrast"></p>
<h3>Letra</h3>
<div class="font-cards" id="t-fonts"></div>
<div class="pills" id="t-weights"></div>
<label class="switch-row field"><span>Cursiva</span><input type="checkbox" class="switch" id="t-italic"></label>
<p class="error" id="te-font"></p>
<h3>Tamaño</h3>
<div class="size-label" id="t-size-label"></div>
<label class="slider-row"><span>Chico</span><input type="range" id="t-min" min="8" max="72" step="1"></label>
<label class="slider-row"><span>Grande</span><input type="range" id="t-max" min="8" max="72" step="1"></label>
<p class="hint">Lo que más usás se ve Grande; lo demás, Chico. Si los igualás, todo queda del mismo tamaño.</p>
<p class="error" id="te-size"></p>
<div class="row" style="margin-top:24px"><button class="btn" id="t-duplicate">Duplicar</button></div>
<button class="btn danger" id="t-delete">Eliminar tema</button>
<p class="error" id="t-delete-error"></p>
`

/**
 * The page's UI. Runs in the WebView only.
 * @param {Object} initial - State from buildState()
 * @param {Object} options - { focus: "tema" | null }
 */
function editorApp(initial, options) {
  let S = initial
  const COLS = [["left", "Izquierda", "Izq"], ["center", "Centro", "Centro"], ["right", "Derecha", "Der"]]
  const ADD_TITLES = { left: "Añadir a la izquierda", center: "Añadir al centro", right: "Añadir a la derecha" }
  const SORTS = [["manual", "Manual"], ["alphabetical", "A–Z"], ["usage", "Uso"]]
  const DAYS = ["L", "M", "X", "J", "V", "S", "D"]
  const PILL_DAYS = [1, 2, 3, 4, 5, 6, 0]
  const CONFIDENCE = { medium: "probable", low: "dudosa" }

  const $ = id => document.getElementById(id)
  function el(tag, cls, text) {
    const node = document.createElement(tag)
    if (cls) node.className = cls
    if (text !== undefined) node.textContent = text
    return node
  }
  const findItem = name => S.config.items.find(item => item.name === name)

  // ---------- bridge ----------

  const handlers = {}
  let pending = 0
  let failed = false
  let idleTimer = null
  const bridge = createBridge(value => completion(value))

  function send(msg, onReply) {
    const isOp = msg.type === "op"
    if (isOp && msg.op !== "undo" && msg.op !== "theme.undoDelete") hideToast()
    if (isOp) {
      pending += 1
      renderStatus()
    }
    const id = bridge.post(msg)
    handlers[id] = reply => {
      if (isOp) {
        pending -= 1
        failed = reply.type === "error"
        renderStatus()
      }
      if (onReply) onReply(reply)
    }
    return id
  }

  window.ZT = {
    next() {
      clearTimeout(idleTimer)
      bridge.next()
      idleTimer = setTimeout(() => bridge.idle(), 20000)
    },
    receive(reply) {
      if (reply.state) {
        S = reply.state
        applyTokens()
        renderMain()
        renderThemes()
        refreshSheet()
      }
      const handler = handlers[reply.id]
      if (handler) {
        delete handlers[reply.id]
        handler(reply)
      }
    }
  }

  function renderStatus() {
    const status = $("status")
    status.textContent = pending > 0 ? "Guardando…" : failed ? "No se guardó" : "Guardado"
    status.classList.toggle("failed", pending === 0 && failed)
  }

  // ---------- time scrubber ----------

  const scrub = { live: true, day: 0, minute: 0 }
  function scrubAt() {
    return scrub.live ? new Date() : scrubDate(new Date(), scrub.day, scrub.minute)
  }
  function leaveLive() {
    if (!scrub.live) return
    const now = new Date()
    scrub.live = false
    scrub.day = now.getDay()
    scrub.minute = Math.floor((now.getHours() * 60 + now.getMinutes()) / 15) * 15
  }

  DAYS.forEach((letter, i) => {
    const pill = el("button", "pill", letter)
    pill.addEventListener("click", () => {
      leaveLive()
      scrub.day = PILL_DAYS[i]
      renderMain()
    })
    $("scrub-days").append(pill)
  })
  $("scrub-time").addEventListener("input", event => {
    leaveLive()
    scrub.minute = Number(event.target.value) * 15
    renderMain()
  })
  $("scrub-now").addEventListener("click", () => {
    scrub.live = true
    renderMain()
  })

  function renderScrubber(date) {
    $("scrub-label").textContent = scrubLabel(date)
    const pills = $("scrub-days").children
    PILL_DAYS.forEach((day, i) => pills[i].classList.toggle("on", day === date.getDay()))
    $("scrub-time").value = String(Math.floor((date.getHours() * 60 + date.getMinutes()) / 15))
    $("scrub-now").classList.toggle("on", scrub.live)
  }

  // ---------- main view ----------

  let deferRender = false

  function renderMain() {
    if (drag) {
      deferRender = true
      return
    }
    const date = scrubAt()
    renderStatus()
    renderPreview(date)
    renderScrubber(date)
    renderSort()
    renderColumns(date)
    renderTraining()
  }

  function renderPreview(date) {
    renderPoster($("preview"), date, { minSize: S.tokens.minSize, maxSize: S.tokens.maxSize })
  }

  /**
   * Same posterLayout the widget draws with, scaled to the card's width.
   * `look` overrides the page's theme with a draft's colors and font.
   */
  function renderPoster(card, date, look) {
    card.textContent = ""
    card.style.background = look.bg || ""
    card.style.color = look.text || ""
    const poster = previewPoster(S.config, S.stats, date, look.minSize, look.maxSize)
    const scale = card.clientWidth / poster.width
    card.style.height = poster.height * scale + "px"
    if (!poster.entries.length) {
      card.append(el("div", "empty", (S.config.items || []).length ? "Nada visible a esta hora" : "Sin elementos todavía"))
      return
    }
    const canvas = el("div", "poster")
    if (look.font) {
      canvas.style.fontFamily = look.font
      canvas.style.fontWeight = look.weight
      canvas.style.fontStyle = look.style
    }
    canvas.style.width = poster.width + "px"
    canvas.style.height = poster.height + "px"
    canvas.style.transform = "scale(" + scale + ")"
    const place = (node, rect) => {
      node.style.left = rect.x + "px"
      node.style.top = rect.y + "px"
      node.style.width = rect.w + "px"
      node.style.height = rect.h + "px"
    }
    for (const entry of poster.entries) {
      const text = el("div", "ptext", entry.name)
      place(text, entry.textRect)
      text.style.fontSize = entry.fontSize + "px"
      text.style.textAlign = entry.align
      canvas.append(text)
    }
    card.append(canvas)
  }

  function renderSort() {
    const box = $("sort")
    box.textContent = ""
    const current = S.config.sortMethod || "manual"
    for (const [method, label] of SORTS) {
      const button = el("button", method === current ? "on" : "", label)
      button.addEventListener("click", () => {
        if (method !== (S.config.sortMethod || "manual")) send({ type: "op", op: "sort", method })
      })
      box.append(button)
    }
  }

  function renderColumns(date) {
    const box = $("columns")
    box.textContent = ""
    for (const [key, title] of COLS) {
      const col = el("div", "col")
      col.dataset.column = key
      col.append(el("div", "col-title", title.toUpperCase()))
      const list = el("div", "chips")
      for (const item of columnItems(S.config, key)) {
        const chip = el("div", "chip" + (visibleAt(item, date) ? "" : " faded"))
        chip.dataset.name = item.name
        chip.append(el("div", "chip-name", item.name), el("div", "chip-sched", describeConstraints(item)))
        attachChip(chip, item.name)
        list.append(chip)
      }
      col.append(list)
      const add = el("button", "add", "+ Añadir")
      add.addEventListener("click", () => openAdd(key))
      col.append(add)
      box.append(col)
    }
  }

  function renderTraining() {
    $("training-text").textContent = S.training.text
    $("stop-train").hidden = !S.training.active
  }
  $("train").addEventListener("click", () => send({ type: "op", op: "train" }))
  $("stop-train").addEventListener("click", () => send({ type: "op", op: "stopTrain" }))

  // ---------- drag ----------

  let press = null
  let drag = null
  let suppressClick = false

  function attachChip(chip, name) {
    chip.addEventListener("touchstart", event => {
      if (event.touches.length !== 1) return
      const touch = event.touches[0]
      cancelPress()
      press = { name, chip, x: touch.clientX, y: touch.clientY }
      press.timer = setTimeout(startDrag, 300)
    }, { passive: true })
    chip.addEventListener("click", () => {
      if (!suppressClick) openItem(name)
    })
    chip.addEventListener("contextmenu", event => event.preventDefault())
  }

  function cancelPress() {
    if (press) clearTimeout(press.timer)
    press = null
  }

  function startDrag() {
    const { name, chip, x, y } = press
    press = null
    const rect = chip.getBoundingClientRect()
    const ghost = chip.cloneNode(true)
    ghost.classList.add("ghost")
    ghost.style.width = rect.width + "px"
    document.body.append(ghost)
    chip.classList.add("dragging")
    document.body.classList.add("is-dragging")
    drag = { name, chip, ghost, marker: el("div", "drop-marker"), dx: x - rect.left, dy: y - rect.top, target: null }
    moveDrag(x, y)
  }

  function moveDrag(x, y) {
    drag.ghost.style.left = (x - drag.dx) + "px"
    drag.ghost.style.top = (y - drag.dy) + "px"
    const under = document.elementFromPoint(x, y)
    const col = under && under.closest(".col")
    if (!col) {
      drag.marker.remove()
      drag.target = null
      return
    }
    const list = col.querySelector(".chips")
    const chips = Array.from(list.querySelectorAll(".chip"))
    let index = chips.length
    for (let i = 0; i < chips.length; i++) {
      const rect = chips[i].getBoundingClientRect()
      if (y < rect.top + rect.height / 2) {
        index = i
        break
      }
    }
    list.insertBefore(drag.marker, chips[index] || null)
    drag.target = { column: col.dataset.column, names: chips.map(chip => chip.dataset.name), index }
  }

  function endDrag(commit) {
    const finished = drag
    drag = null
    finished.ghost.remove()
    finished.marker.remove()
    finished.chip.classList.remove("dragging")
    document.body.classList.remove("is-dragging")
    suppressClick = true
    setTimeout(() => { suppressClick = false }, 400)

    const target = finished.target
    const item = findItem(finished.name)
    if (commit && target && item) {
      const position = dropPosition(target.names, finished.name, target.index)
      const current = columnItems(S.config, item.column).indexOf(item) + 1
      if (item.column !== target.column || current !== position) {
        send({ type: "op", op: "move", name: finished.name, column: target.column, position })
      }
    }
    if (deferRender) {
      deferRender = false
      renderMain()
    }
  }

  document.addEventListener("touchmove", event => {
    const touch = event.touches[0]
    if (drag) {
      event.preventDefault()
      moveDrag(touch.clientX, touch.clientY)
    } else if (press && (Math.abs(touch.clientX - press.x) > 8 || Math.abs(touch.clientY - press.y) > 8)) {
      cancelPress()
    }
  }, { passive: false })
  document.addEventListener("touchend", event => {
    cancelPress()
    if (drag) {
      event.preventDefault()
      endDrag(true)
    }
  }, { passive: false })
  document.addEventListener("touchcancel", () => {
    cancelPress()
    if (drag) endDrag(false)
  })

  // ---------- sheets ----------

  let sheet = null

  function showSheet(markup, state) {
    sheet = state
    const box = $("sheet")
    box.innerHTML = markup
    box.scrollTop = 0
    $("backdrop").classList.add("open")
    $("s-close").addEventListener("click", closeSheet)
  }

  function closeSheet() {
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur()
    sheet = null
    $("backdrop").classList.remove("open")
  }
  $("backdrop").addEventListener("click", event => {
    if (event.target === $("backdrop")) closeSheet()
  })

  function blurOnEnter(input) {
    input.addEventListener("keydown", event => {
      if (event.key === "Enter") input.blur()
    })
  }

  // ---------- item sheet ----------

  const hasSchedule = item => ["startTime", "endTime", "startDay", "endDay"]
    .some(key => item[key] !== undefined && item[key] !== "")

  function openItem(name) {
    const item = findItem(name)
    if (!item) return
    showSheet(ITEM_SHEET, { kind: "item", name, days: rangeToPills(item.startDay, item.endDay) })

    $("f-name").value = item.name
    $("f-url").value = item.scheme === "about:blank" ? "" : item.scheme
    for (const id of ["f-name", "f-url"]) {
      blurOnEnter($(id))
      $(id).addEventListener("change", commitText)
    }
    $("f-test").addEventListener("click", () => {
      const url = $("f-url").value.trim()
      if (!url) {
        $("f-error").textContent = "Escribí una URL para probarla"
        return
      }
      send({ type: "test", url }, reply => {
        $("f-error").textContent = reply.type === "error" ? reply.error : ""
      })
    })

    for (const [key, , short] of COLS) {
      const button = el("button", "", short)
      button.dataset.column = key
      button.addEventListener("click", () => {
        const current = findItem(sheet.name)
        if (current && current.column !== key) send({ type: "op", op: "move", name: sheet.name, column: key }, showItemError)
      })
      $("f-col").append(button)
    }
    $("f-up").addEventListener("click", () => step(-1))
    $("f-down").addEventListener("click", () => step(1))

    $("f-always").checked = !hasSchedule(item)
    $("f-start").value = item.startTime || ""
    $("f-end").value = item.endTime || ""
    $("f-always").addEventListener("change", () => {
      if ($("f-always").checked) {
        updateScheduleView()
        send({ type: "op", op: "constraints", name: sheet.name, constraints: null }, showScheduleError)
        return
      }
      if (!$("f-start").value) $("f-start").value = "09:00"
      if (!$("f-end").value) $("f-end").value = "18:00"
      commitSchedule()
    })
    for (const id of ["f-start", "f-end"]) $(id).addEventListener("change", commitSchedule)

    DAYS.forEach((letter, i) => {
      const pill = el("button", "pill", letter)
      pill.addEventListener("click", () => {
        sheet.days[i] = !sheet.days[i]
        commitSchedule()
      })
      $("f-days").append(pill)
    })

    $("f-delete").addEventListener("click", () => {
      const doomed = sheet.name
      send({ type: "op", op: "delete", name: doomed }, reply => {
        if (reply.type === "error") return showItemError(reply)
        closeSheet()
        showToast(`«${doomed}» eliminado`, () => send({ type: "op", op: "undo" }))
      })
    })

    updateScheduleView()
    refreshSheet()
  }

  function showItemError(reply) {
    if (sheet && sheet.kind === "item") $("f-error").textContent = reply.type === "error" ? reply.error : ""
  }
  function showScheduleError(reply) {
    if (sheet && sheet.kind === "item") $("f-sched-error").textContent = reply.type === "error" ? reply.error : ""
  }

  function commitText() {
    const current = findItem(sheet.name)
    if (!current) return
    const draft = { name: $("f-name").value, scheme: $("f-url").value }
    const currentUrl = current.scheme === "about:blank" ? "" : current.scheme
    if (draft.name.trim() === current.name && draft.scheme.trim() === currentUrl) return
    // Ops queued after this one must already use the new name
    const previous = sheet.name
    const target = sheet
    target.name = draft.name.trim()
    send({ type: "op", op: "update", name: previous, draft }, reply => {
      if (reply.type === "error") target.name = previous
      showItemError(reply)
    })
  }

  function step(delta) {
    const move = moveStep(S.config, sheet.name, delta)
    if (move) send({ type: "op", op: "move", name: sheet.name, column: move.column, position: move.position }, showItemError)
  }

  function updateScheduleView() {
    const always = $("f-always").checked
    $("f-sched").hidden = always
    $("f-overnight").hidden = !isOvernight($("f-start").value, $("f-end").value)
    const pills = $("f-days").children
    sheet.days.forEach((on, i) => pills[i].classList.toggle("on", on))
  }

  function commitSchedule() {
    updateScheduleView()
    const range = pillsToRange(sheet.days)
    if (!range.ok) {
      $("f-sched-error").textContent = range.error
      return
    }
    $("f-sched-error").textContent = ""
    const constraints = Object.assign({ startTime: $("f-start").value, endTime: $("f-end").value }, range.days || {})
    send({ type: "op", op: "constraints", name: sheet.name, constraints }, showScheduleError)
  }

  // Keeps the open sheet in step with saved state without touching what the user is typing
  function refreshSheet() {
    if (sheet && sheet.kind === "theme") return refreshThemeSheet()
    if (!sheet || sheet.kind !== "item") return
    const item = findItem(sheet.name)
    if (!item) return
    for (const button of $("f-col").children) button.classList.toggle("on", button.dataset.column === item.column)
    $("f-up").disabled = !moveStep(S.config, item.name, -1)
    $("f-down").disabled = !moveStep(S.config, item.name, 1)
  }

  // ---------- add sheet ----------

  function openAdd(column) {
    showSheet(ADD_SHEET, { kind: "add", column })
    $("a-title").textContent = ADD_TITLES[column]
    const name = $("a-name")
    name.addEventListener("input", () => {
      $("a-error").textContent = ""
      renderResults($("a-results"), search(name.value))
    })
    $("a-claude").addEventListener("click", () => {
      const query = requireName()
      if (!query) return
      claudeStatus("Preguntando a Claude…")
      send({ type: "search-claude", query }, showClaude)
    })
    $("a-shortcut").addEventListener("click", () => {
      const query = requireName()
      if (query) addPicked(shortcutItem(query))
    })
    $("a-manual").addEventListener("click", () => {
      $("a-manual-box").hidden = false
      $("a-url").focus()
    })
    $("a-add-url").addEventListener("click", () => {
      const query = requireName()
      if (query) addPicked({ name: query, scheme: $("a-url").value })
    })
    $("a-save-key").addEventListener("click", () => {
      const key = $("a-key").value.trim()
      if (!key) {
        $("a-error").textContent = "Pegá una clave primero"
        return
      }
      $("a-key").value = ""
      claudeStatus("Guardando la clave y preguntando a Claude…")
      send({ type: "set-key", key, query: name.value.trim() }, showClaude)
    })
    setTimeout(() => name.focus(), 50)
  }

  function requireName() {
    const query = $("a-name").value.trim()
    $("a-error").textContent = query ? "" : "Escribí un nombre primero"
    return query
  }

  function claudeStatus(text) {
    $("a-claude-status").hidden = !text
    $("a-claude-status").textContent = text || ""
  }

  function renderResults(box, results, withConfidence) {
    box.textContent = ""
    for (const result of results) {
      const row = el("button", "result")
      const flag = withConfidence && CONFIDENCE[result.confidence] ? ` · ${CONFIDENCE[result.confidence]}` : ""
      row.append(el("span", "", result.name), el("small", "", result.scheme + flag))
      row.addEventListener("click", () => addPicked(result))
      box.append(row)
    }
  }

  function showClaude(reply) {
    if (!sheet || sheet.kind !== "add") return
    $("a-key-box").hidden = !reply.needKey
    if (reply.needKey) {
      claudeStatus("")
      $("a-error").textContent = reply.error || ""
      $("a-key").focus()
      return
    }
    if (reply.error) {
      claudeStatus("")
      $("a-error").textContent = reply.error
      return
    }
    const results = reply.results || []
    claudeStatus(results.length ? "Sugerencias de Claude (probalas antes de confiar):" : "Claude no encontró nada")
    renderResults($("a-claude-results"), results, true)
  }

  function addPicked(picked) {
    const column = sheet.column
    const item = { name: picked.name, scheme: picked.scheme || "", column }
    send({ type: "op", op: "add", item }, reply => {
      if (reply.type === "error") {
        if (sheet && sheet.kind === "add") $("a-error").textContent = reply.error
        return
      }
      closeSheet()
    })
  }

  // ---------- themes ----------

  const APPEARANCE_LABELS = [["auto", "Automático"], ["dark", "Oscuro"], ["light", "Claro"]]
  const VARIANT_LABELS = [["dark", "Oscuro"], ["light", "Claro"]]
  const COLOR_ROWS = [
    ["bgColor", "Fondo", ["000000", "1C1C1E", "0B1F3A", "1E3A2F", "FDF5E6", "F2F2F7", "FFFFFF", "FFE4E1"]],
    ["textColor", "Texto", ["FFFFFF", "F2F2F7", "EAEAEA", "FDF5E6", "000000", "1C1C1E", "333333", "0B1F3A"]],
    ["accentColor", "Acento", ["0A84FF", "30D158", "FF9F0A", "FF375F", "BF5AF2", "64D2FF", "FFD60A", "B07D48"]]
  ]
  const LONG_PRESS_MS = 400
  const copy = value => JSON.parse(JSON.stringify(value))
  const findTheme = filename => (S.themes || []).find(t => t.filename === filename)
  const activeFilename = () => (S.activeTheme && S.activeTheme.source && findTheme(S.activeTheme.source)) ? S.activeTheme.source : null

  let tokensKey = JSON.stringify(S.tokens)
  function applyTokens() {
    const key = JSON.stringify(S.tokens)
    if (key === tokensKey) return
    tokensKey = key
    $("theme-vars").textContent = themeCss(S.tokens)
  }

  function systemAppearance() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"
  }

  function renderThemes() {
    const box = $("appearance")
    box.textContent = ""
    const current = (S.activeTheme && S.activeTheme.appearance) || "auto"
    for (const [value, label] of APPEARANCE_LABELS) {
      const button = el("button", value === current ? "on" : "", label)
      button.setAttribute("aria-pressed", value === current ? "true" : "false")
      button.addEventListener("click", () => {
        if (value !== ((S.activeTheme && S.activeTheme.appearance) || "auto")) send({ type: "op", op: "theme.appearance", appearance: value })
      })
      box.append(button)
    }

    const strip = $("theme-strip")
    const scroll = strip.scrollLeft
    strip.textContent = ""
    for (const t of S.themes || []) strip.append(themeChip(t))
    const add = el("button", "tchip tnew")
    add.append(el("span", "tswatch", "+"), el("span", "tname", "Nuevo"))
    add.setAttribute("aria-label", "Nuevo tema")
    add.addEventListener("click", () => duplicateTheme(activeFilename()))
    strip.append(add)
    strip.scrollLeft = scroll
    $("theme-edit").hidden = !activeFilename()
  }

  function themeChip(t) {
    const chip = el("button", "tchip")
    chip.setAttribute("aria-pressed", t.active ? "true" : "false")
    chip.setAttribute("aria-label", t.name)
    const swatch = el("span", "tswatch")
    const layer = (look, cls) => {
      const node = el("span", "tlayer" + (cls ? " " + cls : ""))
      node.style.background = look.bg
      node.style.color = look.text
      const aa = el("span", "taa", "Aa")
      aa.style.fontFamily = t.swatch.font
      aa.style.fontWeight = t.swatch.weight
      aa.style.fontStyle = t.swatch.style
      const dot = el("span", "tdot")
      dot.style.background = look.accent
      node.append(aa, dot)
      return node
    }
    if (t.swatch.split) swatch.append(layer(t.swatch.split.light, "half-light"), layer(t.swatch.split.dark, "half-dark"))
    else swatch.append(layer(t.swatch))
    chip.append(swatch, el("span", "tname", t.name))
    attachThemeChip(chip, t.filename)
    return chip
  }

  // Long-press opens the editor; its own timer, so the item drag code never sees it
  let themePress = null
  let suppressThemeClick = false
  function cancelThemePress() {
    if (themePress) clearTimeout(themePress.timer)
    themePress = null
  }
  function attachThemeChip(chip, filename) {
    chip.addEventListener("touchstart", event => {
      if (event.touches.length !== 1) return
      const touch = event.touches[0]
      cancelThemePress()
      themePress = {
        x: touch.clientX,
        y: touch.clientY,
        timer: setTimeout(() => {
          themePress = null
          suppressThemeClick = true
          setTimeout(() => { suppressThemeClick = false }, 600)
          openTheme(filename)
        }, LONG_PRESS_MS)
      }
    }, { passive: true })
    chip.addEventListener("touchmove", event => {
      const touch = event.touches[0]
      if (themePress && (Math.abs(touch.clientX - themePress.x) > 8 || Math.abs(touch.clientY - themePress.y) > 8)) cancelThemePress()
    }, { passive: true })
    chip.addEventListener("touchend", cancelThemePress)
    chip.addEventListener("touchcancel", cancelThemePress)
    chip.addEventListener("contextmenu", event => event.preventDefault())
    chip.addEventListener("click", () => {
      if (suppressThemeClick) return
      const t = findTheme(filename)
      if (t && !t.active) send({ type: "op", op: "theme.apply", filename })
    })
  }
  $("theme-edit").addEventListener("click", () => {
    const filename = activeFilename()
    if (filename) openTheme(filename)
  })

  function duplicateTheme(filename) {
    const msg = { type: "op", op: "theme.duplicate" }
    if (filename) msg.filename = filename
    send(msg, reply => {
      if (reply.type === "error") {
        if (sheet && sheet.kind === "theme") $("t-error").textContent = reply.error
        return
      }
      if (reply.created) openTheme(reply.created)
    })
  }

  // ---------- theme sheet ----------

  function openTheme(filename) {
    const t = findTheme(filename)
    if (!t) return
    const draft = copy(t.theme)
    const shown = effectiveAppearance(S.activeTheme || draft, systemAppearance())
    showSheet(THEME_SHEET, { kind: "theme", filename, draft, valid: copy(draft), variant: shown })

    const name = $("t-name")
    name.value = draft.name
    blurOnEnter(name)
    name.addEventListener("input", () => {
      sheet.draft.name = name.value
      showThemeErrors(validateTheme(sheet.draft).errors)
    })
    name.addEventListener("change", commitTheme)

    $("t-variants").addEventListener("change", () => {
      sheet.draft = setVariants(sheet.draft, $("t-variants").checked, sheet.variant)
      commitTheme()
    })
    for (const [value, label] of VARIANT_LABELS) {
      const button = el("button", "", label)
      button.dataset.variant = value
      button.addEventListener("click", () => {
        sheet.variant = value
        renderThemeSheet()
      })
      $("t-variant").append(button)
    }

    for (const [key, label, presets] of COLOR_ROWS) {
      const row = el("div", "color-row")
      row.append(el("span", "", label))
      const swatches = el("div", "swatches")
      for (const hex of presets) {
        const button = el("button", "swatch")
        button.style.background = "#" + hex
        button.dataset.hex = hex
        button.setAttribute("aria-label", label + " #" + hex)
        button.addEventListener("click", () => setColor(key, hex))
        swatches.append(button)
      }
      const pick = el("label", "cpick", "+")
      pick.setAttribute("aria-label", "Otro color")
      const input = document.createElement("input")
      input.type = "color"
      input.id = "t-pick-" + key
      input.addEventListener("input", () => {
        sheet.draft = setThemeColor(sheet.draft, sheet.variant, key, input.value.slice(1).toUpperCase())
        if (validateTheme(sheet.draft).ok) sheet.valid = copy(sheet.draft)
        renderThemeSheet()
      })
      input.addEventListener("change", () => setColor(key, input.value.slice(1).toUpperCase()))
      pick.append(input)
      const hexInput = el("input", "hex")
      hexInput.type = "text"
      hexInput.id = "t-hex-" + key
      hexInput.setAttribute("aria-label", label + " en hex")
      hexInput.autocapitalize = "characters"
      hexInput.spellcheck = false
      blurOnEnter(hexInput)
      hexInput.addEventListener("change", () => setColor(key, hexInput.value.trim().replace(/^#/, "")))
      swatches.append(pick, hexInput)
      row.append(swatches, el("p", "error", ""))
      row.lastChild.id = "te-" + key
      $("t-colors").append(row)
    }

    for (const family of FONT_CATALOG) {
      const card = el("button", "fcard")
      card.dataset.family = family.id
      card.append(el("span", "sample", "Whatsapp"), el("small", "", family.label))
      card.addEventListener("click", () => {
        sheet.draft.fontName = family.id
        commitTheme()
      })
      $("t-fonts").append(card)
    }
    $("t-italic").addEventListener("change", () => {
      sheet.draft.fontItalic = $("t-italic").checked
      commitTheme()
    })

    const sliders = { min: $("t-min"), max: $("t-max") }
    sliders.min.value = draft.minFontSize
    sliders.max.value = draft.maxFontSize
    const slide = moved => {
      let min = Number(sliders.min.value)
      let max = Number(sliders.max.value)
      if (min > max) {
        if (moved === "min") max = min
        else min = max
        sliders.min.value = min
        sliders.max.value = max
      }
      sheet.draft.minFontSize = min
      sheet.draft.maxFontSize = max
      if (validateTheme(sheet.draft).ok) sheet.valid = copy(sheet.draft)
      renderThemeSheet()
    }
    for (const which of ["min", "max"]) {
      sliders[which].addEventListener("input", () => slide(which))
      sliders[which].addEventListener("change", commitTheme)
    }

    $("t-duplicate").addEventListener("click", () => duplicateTheme(sheet.filename))
    $("t-delete").addEventListener("click", () => {
      send({ type: "op", op: "theme.delete", filename: sheet.filename }, reply => {
        if (reply.type === "error") {
          if (sheet && sheet.kind === "theme") $("t-delete-error").textContent = reply.error
          return
        }
        closeSheet()
        showToast(`«${reply.deleted}» eliminado`, () => send({ type: "op", op: "theme.undoDelete" }))
      })
    })

    renderThemeSheet()
  }

  function editedColor(key) {
    const d = sheet.draft
    if (d.light || d.dark) {
      const block = d[sheet.variant] || {}
      return block[key] !== undefined && block[key] !== "" ? block[key] : d[key]
    }
    return d[key]
  }

  function setColor(key, value) {
    sheet.draft = setThemeColor(sheet.draft, sheet.variant, key, value)
    commitTheme()
  }

  function commitTheme() {
    const check = validateTheme(sheet.draft)
    showThemeErrors(check.errors)
    renderThemeSheet()
    if (!check.ok) return
    sheet.valid = copy(sheet.draft)
    renderThemeSheet()
    const target = sheet
    send({ type: "op", op: "theme.update", filename: sheet.filename, theme: copy(sheet.draft) }, reply => {
      if (reply.type !== "error" || sheet !== target) return
      if (reply.errors) showThemeErrors(reply.errors)
      else $("t-error").textContent = reply.error
    })
  }

  function showThemeErrors(errors) {
    if (!sheet || sheet.kind !== "theme") return
    const other = sheet.variant === "light" ? "dark" : "light"
    $("te-name").textContent = errors.name || ""
    for (const [key] of COLOR_ROWS) {
      $("te-" + key).textContent = errors[`${sheet.variant}.${key}`] || errors[key] || errors[`${other}.${key}`] || errors[sheet.variant] || ""
    }
    $("te-font").textContent = errors.fontName || errors.fontWeight || errors.fontItalic || ""
    $("te-size").textContent = errors.minFontSize || errors.maxFontSize || ""
    $("t-error").textContent = ""
  }

  // Redraws the controls from the draft, leaving whatever field has focus alone
  function renderThemeSheet() {
    if (!sheet || sheet.kind !== "theme") return
    const d = sheet.draft
    const variants = !!(d.light || d.dark)
    $("t-variants").checked = variants
    $("t-variant-box").hidden = !variants
    for (const button of $("t-variant").children) button.classList.toggle("on", button.dataset.variant === sheet.variant)

    for (const [key] of COLOR_ROWS) {
      const value = editedColor(key)
      const hex = parseHex(value)
      for (const swatch of $("te-" + key).previousSibling.querySelectorAll(".swatch")) swatch.classList.toggle("on", swatch.dataset.hex === hex)
      const field = $("t-hex-" + key)
      if (document.activeElement !== field) field.value = value || ""
      if (hex) $("t-pick-" + key).value = "#" + hex.toLowerCase()
    }

    const badge = contrastBadge(resolveColors(sheet.valid, sheet.variant))
    $("t-contrast").textContent = badge.text
    $("t-contrast").className = "contrast " + (badge.ok ? "good" : "warn")

    const family = findFontFamily(d.fontName)
    for (const card of $("t-fonts").children) {
      card.classList.toggle("on", !!family && family.id === card.dataset.family)
      const css = toCss(fontSpec(Object.assign({}, sheet.valid, { fontName: card.dataset.family }), 20))
      const sample = card.firstChild
      sample.style.fontFamily = css.fontFamily
      sample.style.fontWeight = css.fontWeight
      sample.style.fontStyle = css.fontStyle
    }
    const fonts = fontOptions(sheet.valid)
    const weights = $("t-weights")
    weights.textContent = ""
    for (const option of fonts.weights) {
      const pill = el("button", "pill" + (option.on ? " on" : ""), option.label)
      pill.disabled = !option.available
      pill.setAttribute("aria-pressed", option.on ? "true" : "false")
      pill.addEventListener("click", () => {
        sheet.draft.fontWeight = option.id
        commitTheme()
      })
      weights.append(pill)
    }
    $("t-italic").checked = fonts.italic.on
    $("t-italic").disabled = !fonts.italic.available

    $("t-size-label").textContent = sizeLabel(d.minFontSize, d.maxFontSize)
    renderSheetPreview()
  }

  function renderSheetPreview() {
    const t = normalizeTheme(sheet.valid).theme
    const colors = resolveColors(t, sheet.variant)
    const css = toCss(fontSpec(t, t.maxFontSize))
    renderPoster($("t-preview"), scrubAt(), {
      bg: "#" + colors.bgColor, text: "#" + colors.textColor,
      font: css.fontFamily, weight: css.fontWeight, style: css.fontStyle,
      minSize: t.minFontSize, maxSize: t.maxFontSize
    })
  }

  function refreshThemeSheet() {
    if (!findTheme(sheet.filename)) return closeSheet()
    renderSheetPreview()
  }

  // ---------- toast ----------

  let toastTimer = null
  function showToast(text, onUndo) {
    const toast = $("toast")
    toast.textContent = ""
    const undo = el("button", "link", "Deshacer")
    undo.addEventListener("click", () => {
      hideToast()
      onUndo()
    })
    toast.append(el("span", "", text + " ·"), undo)
    toast.classList.add("show")
    clearTimeout(toastTimer)
    toastTimer = setTimeout(hideToast, 5000)
  }
  function hideToast() {
    clearTimeout(toastTimer)
    $("toast").classList.remove("show")
  }

  renderMain()
  renderThemes()
  setInterval(() => {
    if (scrub.live) renderMain()
  }, 30000)
  if (options && options.focus === "tema") setTimeout(() => $("tema").scrollIntoView({ block: "start" }), 50)
}

function colorVars(colors) {
  return [
    `  color-scheme: ${colors.scheme};`,
    `  --bg: ${colors.bg};`,
    `  --text: ${colors.text};`,
    `  --text-rgb: ${colors.textRgb};`,
    `  --accent: ${colors.accent};`,
    `  --on-accent: ${colors.onAccent};`
  ].join("\n")
}

/**
 * The theme's CSS variables; adaptive themes switch to `dark` under
 * prefers-color-scheme. The page rewrites them when the theme changes.
 * @param {Object} tokens - from themeTokens()
 * @returns {string}
 */
function themeCss(tokens) {
  const root = `:root {
${colorVars(tokens)}
  --font: ${tokens.font};
  --weight: ${tokens.weight};
  --style: ${tokens.style};
}
`
  if (!tokens.adaptive) return root
  return root + `@media (prefers-color-scheme: dark) {
  :root {
${colorVars(tokens.dark)}
  }
}
`
}

/**
 * @param {Object} parts - { tokens: themeTokens(), shared: injected helper source,
 *   state: state JSON safe for <script>, options: editorApp options JSON }
 * @returns {string}
 */
function render({ tokens, shared, state, options }) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">
<title>ZenTweak</title>
<style id="theme-vars">${themeCss(tokens)}</style>
<style>${CSS}</style>
</head>
<body>
<pre id="fatal" style="display:none;white-space:pre-wrap;color:#FF453A;font:13px ui-monospace,monospace;padding:12px;border:1px solid #FF453A;border-radius:12px"></pre>
${BODY}
<script>
window.onerror = function (message, source, line, column, error) {
  var box = document.getElementById("fatal")
  box.style.display = "block"
  box.textContent += "Error del editor: " + message + " (línea " + line + ")\\n" + ((error && error.stack) || "") + "\\n"
}
</script>
<script>
${shared}
${colorVars.toString()}
${themeCss.toString()}
const ITEM_SHEET = ${JSON.stringify(ITEM_SHEET)}
const ADD_SHEET = ${JSON.stringify(ADD_SHEET)}
const THEME_SHEET = ${JSON.stringify(THEME_SHEET)}
;(${editorApp.toString()})(${state}, ${options || "{}"})
</script>
</body>
</html>`
}

module.exports = { render }
