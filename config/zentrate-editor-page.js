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
.pill.on { background: var(--accent); border-color: var(--accent); color: #fff; }
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
.btn.accent { background: var(--accent); color: #fff; }
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

/**
 * The page's UI. Runs in the WebView only.
 * @param {Object} initial - State from buildState()
 * @param {Object} sizes - { minSize, maxSize } of the active theme
 */
function editorApp(initial, sizes) {
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
    if (isOp && msg.op !== "undo") hideToast()
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
        renderMain()
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

  // Same posterLayout the widget draws with, scaled to the card's width
  function renderPreview(date) {
    const card = $("preview")
    card.textContent = ""
    const poster = previewPoster(S.config, S.stats, date, sizes.minSize, sizes.maxSize)
    const scale = card.clientWidth / poster.width
    card.style.height = poster.height * scale + "px"
    if (!poster.entries.length) {
      card.append(el("div", "empty", (S.config.items || []).length ? "Nada visible a esta hora" : "Sin elementos todavía"))
      return
    }
    const canvas = el("div", "poster")
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
        showToast(`«${doomed}» eliminado`)
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

  // ---------- toast ----------

  let toastTimer = null
  function showToast(text) {
    const toast = $("toast")
    toast.textContent = ""
    const undo = el("button", "link", "Deshacer")
    undo.addEventListener("click", () => {
      hideToast()
      send({ type: "op", op: "undo" })
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
  setInterval(() => {
    if (scrub.live) renderMain()
  }, 30000)
}

/**
 * @param {Object} parts - { tokens: themeTokens(), shared: injected helper source, state: state JSON safe for <script> }
 * @returns {string}
 */
function render({ tokens, shared, state }) {
  const sizes = JSON.stringify({ minSize: tokens.minSize, maxSize: tokens.maxSize })
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">
<title>ZenTweak</title>
<style>
:root {
  color-scheme: ${tokens.scheme};
  --bg: ${tokens.bg};
  --text: ${tokens.text};
  --text-rgb: ${tokens.textRgb};
  --accent: ${tokens.accent};
  --font: ${tokens.font};
  --weight: ${tokens.weight};
  --style: ${tokens.style};
}
${CSS}
</style>
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
const ITEM_SHEET = ${JSON.stringify(ITEM_SHEET)}
const ADD_SHEET = ${JSON.stringify(ADD_SHEET)}
;(${editorApp.toString()})(${state}, ${sizes})
</script>
</body>
</html>`
}

module.exports = { render }
