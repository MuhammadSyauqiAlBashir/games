// Wok & Roll — one day at the counter (2.5D, Cooking-Fever style): the simulation + the 3D scene + the HUD.
// Used by the career and the duel. Tap bins / cookers / toppings / plates / customers; drag plates & cups.
import * as T from "./three.js?v=__VERSION__"
import { el, rp } from "../lib.js?v=__VERSION__"
import { L } from "../i18n.js?v=__VERSION__"
import { sfx } from "../sound.js?v=__VERSION__"
import { Gfx, qualityPref, setQualityPref } from "./gfx.js?v=__VERSION__"
import { Actor, catModel, dishModel, loadPacks, prop, steakLook, steakMesh } from "./models.js?v=__VERSION__"
import { World } from "./world.js?v=__VERSION__"
import { Kitchen, sameTops } from "./sim.js?v=__VERSION__"
import { CUSTOMERS, DISHES, HINTS, LAYOUTS, TOPS } from "./levels.js?v=__VERSION__"

export const ITEM_ICONS = { kopi: "☕", bel: "🔔", sambal: "🌶️", ikan: "🐟", senter: "🔦", payung: "☂️" }
const CUST_H = 2.2   // customers' height (the counter top is at 0.62); a little larger than life, like the reference
const STEP = 0
const money = (rb) => rp(rb * 1000)

export function ensureCss() {
  if (document.getElementById("ck-css")) return
  document.head.append(el("link", { id: "ck-css", rel: "stylesheet", href: "/cook.css?v=__VERSION__" }))
}

// ---- dish pictures for the order cards, rendered once from the real 3D dishes ------------------------------
const thumbs = new Map()
export const dishKey = (dish, tops = []) => [dish, ...[...tops].sort()].join("+")
function renderThumbs(gfx) {
  if (thumbs.size) return
  const scene = new T.Scene()
  scene.environment = gfx.envTex
  scene.add(new T.HemisphereLight(0xffffff, 0x886644, 1.7))
  const d = new T.DirectionalLight(0xffffff, 2.4); d.position.set(1, 3, 2); scene.add(d)
  const cam = new T.PerspectiveCamera(30, 1, 0.05, 10)
  const rt = new T.WebGLRenderTarget(128, 128, { samples: 4 })
  rt.texture.colorSpace = T.SRGBColorSpace
  const buf = new Uint8Array(128 * 128 * 4)
  const cv = document.createElement("canvas"); cv.width = cv.height = 128
  const g2 = cv.getContext("2d")
  const r = gfx.renderer
  for (const [dish, d0] of Object.entries(DISHES)) {
    for (let mask = 0; mask < 1 << d0.tops.length; mask++) {
      const tops = d0.tops.filter((_, i) => mask & (1 << i))
      const m = dishModel(dish, tops)
      scene.add(m)
      const bb = new T.Box3().setFromObject(m), c = bb.getCenter(new T.Vector3()), s = bb.getSize(new T.Vector3()).length()
      cam.position.set(c.x, c.y + s * 0.95, c.z + s * 1.4); cam.lookAt(c)
      r.setRenderTarget(rt); r.setClearColor(0x000000, 0); r.clear(); r.render(scene, cam); r.setRenderTarget(null)
      r.readRenderTargetPixels(rt, 0, 0, 128, 128, buf)
      const img = g2.createImageData(128, 128)
      for (let y = 0; y < 128; y++) img.data.set(buf.subarray((127 - y) * 512, (128 - y) * 512), y * 512)
      g2.clearRect(0, 0, 128, 128); g2.putImageData(img, 0, 0)
      thumbs.set(dishKey(dish, tops), cv.toDataURL("image/png"))
      scene.remove(m)
    }
  }
  rt.dispose()
}
export const thumb = (dish, tops) => thumbs.get(dishKey(dish, tops)) || ""
const dishName = (l) => L(DISHES[l.dish].id, DISHES[l.dish].en) + l.tops.map((t) => ` + ${L(TOPS[t].id, TOPS[t].en)}`).join("")

// ---- the day ------------------------------------------------------------------------------------------------
// opts: { level, kit, seed, duel, onEnd(result), onItem(k), onPrank(kind), onScore(coins, done), story(stage), quit(), tick(dt) }
export async function playDay(host, opts) {
  const { level, kit } = opts
  ensureCss()
  const box = el("div", { class: "ck-play" + (opts.duel ? " duel" : "") })
  host.append(box)
  const loading = el("div", { class: "ck-loading" }, el("div", { class: "ck-load-wok", text: "🍳" }), el("b", { text: L("Menyiapkan dapur…", "Setting up the kitchen…") }),
    el("div", { class: "ck-bar" }, el("i")))
  box.append(loading)
  await loadPacks((p) => { loading.querySelector("i").style.width = `${Math.round(p * 100)}%` })
  const L0 = LAYOUTS[level.layout]
  const gfx = new Gfx(box)
  renderThumbs(gfx)
  const world = new World(gfx, L0, { cart: kit.cart })
  const sim = new Kitchen(level, kit, opts.seed)
  window.__ck = { sim, gfx, world }   // for automated browser tests
  loading.remove()
  const upgraded = (kit.seats || 0) > 0

  // ---- which pieces are in today's kitchen ----------------------------------------------------------------
  const active = new Set(sim.pieces.map((p) => p.id))
  for (const [id, r] of Object.entries(world.pieces)) {
    r.group.visible = active.has(id)
    if (active.has(id)) gfx.addPick(r.hit, { type: "piece", id }, r.hit, r.group)
  }
  world.decorate(active)
  world.plateSpots.forEach((s, i) => {
    s.group.visible = i < sim.plates.length
    if (i < sim.plates.length) gfx.addPick(s.hit, { type: "plate", i }, s.hit, s.group)
  })

  // ---- camera: fit the counter + the customers to the screen, whatever its shape ----------------------------
  const camGoal = new T.Vector3(), camLook = new T.Vector3()
  let hudEl = null
  function fitCamera() {
    const cam = gfx.camera
    cam.fov = 38
    cam.updateProjectionMatrix()
    const C = L0.counter, y = L0.y
    // frame today's equipment (like the reference, the counter itself may run off the screen edges)
    const used = [...sim.pieces.map((p) => p.at), ...sim.plates.map((p, i) => L0.plates[i])]
    const x0 = Math.min(...used.map((a) => a[0])) - 0.5, x1 = Math.max(...used.map((a) => a[0])) + 0.5
    const zf = Math.max(...used.map((a) => a[1])) + 0.3
    const pts = [[x0, y, zf], [x1, y, zf], [x0, y - 0.05, zf + 0.05], [x1, y - 0.05, zf + 0.05], [x0, y, C.z0], [x1, y, C.z0]]
    const xs = upgraded ? L0.slots4 : L0.slots
    for (const x of [xs[0], xs[xs.length - 1]]) pts.push([x, CUST_H + 0.12, L0.custZ])   // the customers' heads
    const look = new T.Vector3((x0 + x1) / 2, y, (C.z0 + C.z1) / 2)
    const el_ = 0.5
    const dir = new T.Vector3(0, Math.sin(el_), Math.cos(el_))
    const v = new T.Vector3()
    // keep everything below the HUD bar (measured, so it works for any screen)
    const hudB = hudEl ? hudEl.getBoundingClientRect().bottom - box.getBoundingClientRect().top + 6 : 70
    const yTop = Math.min(0.86, 1 - (2 * hudB) / Math.max(1, gfx.h)), yBot = -0.99
    const port = false
    const bounds = () => {
      cam.lookAt(look); cam.updateMatrixWorld()
      let x = 0, y0 = 9, y1 = -9
      for (const p of pts) { v.set(...p).project(cam); x = Math.max(x, Math.abs(v.x)); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y) }
      return { x, y0, y1 }
    }
    let lo = 1.5, hi = 40
    for (let i = 0; i < 26; i++) {
      const m = (lo + hi) / 2
      cam.position.copy(look).addScaledVector(dir, m)
      const b = bounds()
      if (b.x < 0.97 && b.y1 - b.y0 < yTop - yBot) hi = m; else lo = m
    }
    cam.position.copy(look).addScaledVector(dir, hi)
    // pin the counter's front edge to the bottom of the screen; spare room goes to the street at the top
    for (let i = 0; i < 4; i++) {
      const b = bounds()
      const shift = (b.y0 - yBot) * hi * Math.tan((cam.fov * Math.PI) / 360)
      const up = new T.Vector3(0, 1, 0).applyQuaternion(cam.quaternion)
      cam.position.addScaledVector(up, shift); look.addScaledVector(up, shift)
    }
    camGoal.copy(cam.position)
    camLook.copy(look)
  }
  // Landscape only (like the reference game): an upright phone gets a "turn me" screen.
  const rotate = el("div", { class: "ck-rotate", hidden: true }, el("div", { class: "ck-rotate-phone", text: "📱" }),
    el("b", { text: L("Putar HP-mu ke samping", "Turn your phone sideways") }), el("small", { text: L("Matikan kunci rotasi kalau layarnya tidak ikut berputar.", "Switch off rotation lock if the screen doesn't turn.") }))
  box.append(rotate)
  const upright = () => gfx.h > gfx.w * 1.05
  gfx.onCamera = () => { rotate.hidden = !upright(); fitCamera() }
  fitCamera()
  gfx.camera.position.copy(camGoal).add(new T.Vector3(0, 2.5, 3))
  const lookNow = camLook.clone()
  let camMode = "intro"
  const focus = { pos: null, look: null }

  // ---- customers & cats ---------------------------------------------------------------------------------------
  const custUi = new Map()
  const custPos = (c) => {
    const xs = upgraded ? L0.slots4 : L0.slots
    const slot = c.slot ?? c.lastSlot ?? 0
    const sx = xs[slot] ?? 0
    const edge = (c.side || 1) * (L0.counter.w / 2 + 1.8)
    return new T.Vector3(edge + (sx - edge) * c.p, STEP, L0.custZ)
  }
  function addCustomer(c) {
    const def = CUSTOMERS[c.type]
    const a = new Actor(c.model, { hat: def.hat || null, height: CUST_H })
    world.root.add(a.root)
    const bar = el("i")
    const hearts = el("div", { class: "ck-patience" }, bar)
    const lines = el("div", { class: "ck-lines" })
    const card = el("div", { class: "ck-card-order" }, lines, hearts)   // patience bar sits on the side (CSS)
    const tag = def.critic || def.influencer || def.fussy || def.takeaway ? el("div", { class: "ck-tag", text: L(def.id, def.en) }) : null
    const wrap = el("div", { class: "ck-bwrap side ck-tap", "data-cust": c.id }, tag, card)
    // the card is the customer: tap it to hand over whatever matches (or drop a dragged plate on it)
    wrap.addEventListener("pointerdown", (e) => { e.stopPropagation(); if (live()) act({ type: "cust", id: c.id }) })
    const head = new T.Vector3()
    // the order card sits beside the customer at shoulder height, like the reference game
    const unpin = gfx.pin(wrap, () => {
      if (!["wait", "read"].includes(c.state) || c.moving) return null
      head.copy(a.root.position); head.x += 0.5; head.y += CUST_H * 0.8
      return head
    }, { anchor: "side" })
    // tap box = the part of the customer you can see above the counter
    const hit = new T.Mesh(new T.BoxGeometry(0.75, CUST_H - L0.y, 0.5), new T.MeshBasicMaterial({ visible: false })); hit.position.y = L0.y + (CUST_H - L0.y) / 2
    a.root.add(hit)
    const target = { type: "cust", id: c.id, enabled: false }
    gfx.addPick(hit, target, hit, a.body)
    const u = { a, c, card, lines, bar, wrap, unpin, target, hit, sig: "", emote: 0,
      place() { a.root.position.copy(custPos(c)) } }
    custUi.set(c.id, u)
    return u
  }
  function removeCustomer(id) {
    const u = custUi.get(id)
    if (!u) return
    u.unpin(); gfx.removePick(u.hit); u.a.root.removeFromParent()
    custUi.delete(id)
  }
  const catUi = new Map()
  function catPos(c) {
    const C = L0.counter
    const pl = c.plate !== null ? world.plateSpots[c.plate].group.position : new T.Vector3(0, L0.y, C.z0 + 0.4)
    const edge = new T.Vector3(c.side * (C.w / 2 + 0.2), L0.y, C.z0 + 0.25)
    const p = Math.max(0, c.p)
    const target = new T.Vector3(pl.x - c.side * 0.3, L0.y, pl.z + 0.05)
    const v = edge.clone().lerp(target, Math.min(1, p))
    if (c.p < 0) v.x += c.side * -c.p * 2
    return v
  }
  function addCat(c) {
    const m = catModel()
    world.root.add(m.group)
    const alert = el("div", { class: "ck-cat-alert", text: "🐱❗" })
    const p = new T.Vector3()
    const unpin = gfx.pin(alert, () => { if (c.state === "flee") return null; p.copy(m.group.position); p.y += 0.7; return p })
    gfx.addPick(m.group, { type: "cat", id: c.id, priority: true }, m.group, m.group)
    catUi.set(c.id, { m, unpin })
  }

  // ---- flights: food flying bin → cooker → plate → customer ---------------------------------------------------
  const flights = []
  function fly(obj, from, to, { dur = 0.32, arc = 0.45, scaleTo = null, onDone = null } = {}) {
    obj.position.copy(from)
    world.root.add(obj)
    flights.push({ obj, from: from.clone(), to: to.clone(), t: 0, dur, arc, s0: obj.scale.x, s1: scaleTo ?? obj.scale.x, onDone })
  }
  function stepFlights(dt) {
    for (let i = flights.length - 1; i >= 0; i--) {
      const f = flights[i]
      f.t += dt
      const k = Math.min(1, f.t / f.dur), e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2
      f.obj.position.lerpVectors(f.from, f.to, e)
      f.obj.position.y += Math.sin(k * Math.PI) * f.arc
      f.obj.scale.setScalar(f.s0 + (f.s1 - f.s0) * e)
      if (k >= 1) { f.obj.removeFromParent(); flights.splice(i, 1); f.onDone && f.onDone() }
    }
  }
  const pieceTop = (id, dy = 0.15) => world.pieces[id].group.position.clone().add(new T.Vector3(0, dy, 0))
  const plateTop = (i) => world.plateSpots[i].group.position.clone().add(new T.Vector3(0, 0.05, 0))
  const hidePlate = new Set()

  // ---- HUD -----------------------------------------------------------------------------------------------------
  const coinsEl = el("b", { class: "ck-coins", text: money(0) })
  const goalBar = el("div", { class: "ck-goal" }, el("i"), ...sim.goals.map((g, i) => el("span", { class: "ck-star", style: { left: `${(g / sim.goals[2]) * 100}%` }, "data-i": i, text: "★" })))
  const moneyBox = el("div", { class: "ck-money" }, coinsEl, goalBar)
  const info = el("span", { class: "ck-info" }, el("span", { class: "ck-info-ic", text: "👥" }), el("span", { class: "ck-info-bar" }, el("i")), el("b", { class: "ck-info-n" }))
  const pauseBtn = el("button", { class: "ck-pause", type: "button", "aria-label": "Pause" }, el("i"), el("i"))
  const top = el("div", { class: "ck-top" }, moneyBox, info, pauseBtn)
  const itemsEl = el("div", { class: "ck-items" })
  const cardsEl = el("div", { class: "ck-cards" })
  const others = el("div", { class: "ck-others" })
  const side = el("div", { class: "ck-side" }, itemsEl, cardsEl)
  const fxLayer = el("div", { class: "ck-fx" })
  const hint = el("div", { class: "ck-hint", hidden: true })
  const ghost = el("img", { class: "ck-ghost", hidden: true, alt: "" })
  box.append(top, others, side, fxLayer, hint, ghost)
  hudEl = top
  fitCamera()

  function popAt(v3, text, cls = "") {
    const [x, y] = gfx.toScreen(v3)
    const n = el("div", { class: `ck-pop ${cls}`, text, style: { left: `${x}px`, top: `${y}px` } })
    fxLayer.append(n)
    setTimeout(() => n.remove(), 1400)
  }
  function banner(text, cls = "", ms = 1500) {
    const n = el("div", { class: `ck-banner ${cls}`, text })
    fxLayer.append(n)
    setTimeout(() => n.remove(), ms)
  }
  function coinsFly(v3, n = 5) {
    const [x, y] = gfx.toScreen(v3)
    const r = moneyBox.getBoundingClientRect(), b = box.getBoundingClientRect()
    const tx = r.left - b.left + 26, ty = r.top - b.top + 16
    for (let i = 0; i < n; i++) {
      const c = el("i", { class: "ck-coinfly", style: { left: `${x + (Math.random() - 0.5) * 30}px`, top: `${y + (Math.random() - 0.5) * 20}px`, "--dx": `${tx - x}px`, "--dy": `${ty - y}px`, animationDelay: `${i * 0.06}s` } })
      fxLayer.append(c)
      setTimeout(() => c.remove(), 1100 + i * 60)
    }
    setTimeout(() => { moneyBox.classList.remove("bump"); void moneyBox.offsetWidth; moneyBox.classList.add("bump") }, 700)
  }

  function drawItems() {
    itemsEl.replaceChildren(...Object.keys(ITEM_ICONS).filter((k) => (kit.items || {})[k]).map((k) => {
      const left = sim.itemsLeft(k)
      return el("button", { class: "ck-item", type: "button", disabled: !left || !sim.usesLeft(), onclick: () => {
        if (sim.useItem(k)) { opts.onItem && opts.onItem(k); drawItems() }
      } }, ITEM_ICONS[k], el("small", { text: String(left) }))
    }))
  }
  drawItems()
  function drawCards() {
    if (!opts.duel) return
    cardsEl.replaceChildren(...[["cat", "🐱"], ["blackout", "💡"], ["rain", "🌧️"]].map(([k, ic]) => el("button", {
      class: "ck-card", type: "button", disabled: sim.cards <= 0, title: k,
      onclick: () => { if (sim.cards > 0 && opts.onPrank && opts.onPrank(k)) { sim.cards--; drawCards() } },
    }, ic)), el("small", { class: "ck-cardn", text: `×${sim.cards}` }))
  }
  drawCards()

  // ---- input: tap, or drag a plate / full cup to a customer or the bin ----------------------------------------
  let paused = false, started = false, ended = false
  let press = null
  const live = () => started && !paused && !ended
  const bounce = (obj) => { if (obj) obj.userData.bounce = 0.25 }
  function act(t) {
    if (!t) return
    let ok = false
    if (t.type === "cust") { const c = sim.customers.find((x) => x.id === t.id); if (c && c.slot !== null) ok = sim.serveTo(c.slot) }
    else ok = sim.tap(t)
    if (t.type === "piece") bounce(world.pieces[t.id].group)
    if (t.type === "plate") bounce(world.plateSpots[t.i].group)
    if (ok) { sfx.click(); if (navigator.vibrate) navigator.vibrate(8) }
  }
  const draggable = (t) => t && ((t.type === "plate" && sim.plates[t.i]?.item) || (t.type === "piece" && sim.piece(t.id)?.kind === "drink" && sim.piece(t.id).state === "full"))
  const dragItem = (t) => (t.type === "plate" ? sim.plates[t.i].item : { dish: sim.piece(t.id).makes, tops: [] })
  box.addEventListener("pointerdown", (e) => {
    if (!live() || e.target.closest("button, .ck-panel, .ck-tap")) return
    const t = gfx.pick(e.clientX, e.clientY)
    if (!t) return
    press = { t, x: e.clientX, y: e.clientY, drag: false }
    box.setPointerCapture?.(e.pointerId)
  })
  box.addEventListener("pointermove", (e) => {
    if (!press) return
    if (!press.drag && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 12 && draggable(press.t)) {
      press.drag = true
      const it = dragItem(press.t)
      ghost.src = thumb(it.dish, it.tops); ghost.hidden = false
      press.item = it
      if (press.t.type === "plate") hidePlate.add(press.t.i)
      for (const u of custUi.values()) u.card.classList.toggle("match", u.c.state === "wait" && u.c.order.some((l) => !l.done && l.dish === it.dish && sameTops(l.tops, it.tops)))
      box.classList.add("dragging")
    }
    if (press.drag) {
      const b = box.getBoundingClientRect()
      ghost.style.transform = `translate(${e.clientX - b.left - 36}px, ${e.clientY - b.top - 52}px)`
    }
  })
  const endPress = (e) => {
    if (!press) return
    const p = press
    press = null
    if (!p.drag) { act(p.t); return }
    ghost.hidden = true
    box.classList.remove("dragging")
    for (const u of custUi.values()) u.card.classList.remove("match")
    if (p.t.type === "plate") hidePlate.delete(p.t.i)
    const from = p.t.type === "plate" ? { plate: p.t.i } : { drink: p.t.id }
    const onCard = document.elementFromPoint(e.clientX, e.clientY)?.closest(".ck-bwrap")
    const d = onCard ? { type: "cust", id: Number(onCard.dataset.cust) } : gfx.pick(e.clientX, e.clientY)
    if (d && d.type === "cust") { const c = sim.customers.find((x) => x.id === d.id); if (c && c.slot !== null && sim.drop(from, { type: "cust", slot: c.slot })) sfx.click() }
    else if (d && d.type === "piece" && d.id === "trash") sim.drop(from, { type: "trash" })
  }
  box.addEventListener("pointerup", endPress)
  box.addEventListener("pointercancel", () => { if (press?.drag) { ghost.hidden = true; box.classList.remove("dragging"); if (press.t.type === "plate") hidePlate.delete(press.t.i) } press = null })

  // ---- pause / quality menu -----------------------------------------------------------------------------------
  pauseBtn.onclick = () => {
    if (ended || box.querySelector(".ck-panel")) return
    paused = !opts.duel
    const qs = ["auto", "ultra", "high", "saver"]
    const names = { auto: L("Otomatis", "Auto"), ultra: "Ultra", high: L("Tinggi", "High"), saver: L("Hemat baterai", "Battery saver") }
    const panel = el("div", { class: "ck-panel" },
      el("h3", { text: opts.duel ? L("Menu", "Menu") : L("Jeda", "Paused") }),
      el("p", { class: "muted small", text: L("Kualitas grafis", "Graphics quality") }),
      el("div", { class: "seg" }, qs.map((q) => el("button", { type: "button", class: qualityPref() === q ? "on" : "", text: names[q], onclick: () => {
        setQualityPref(q); gfx.auto = q === "auto"; if (q !== "auto") gfx.setQuality(q); panel.remove(); paused = false
      } }))),
      el("div", { class: "row", style: { marginTop: "14px", gap: "8px" } },
        el("button", { class: "btn primary grow", type: "button", text: L("Lanjut", "Resume"), onclick: () => { panel.remove(); paused = false } }),
        opts.quit ? el("button", { class: "btn", type: "button", text: L("Keluar", "Quit"), onclick: () => { panel.remove(); opts.quit() } }) : null))
    box.append(panel)
  }

  // ---- tutorial hints -------------------------------------------------------------------------------------------
  const seenHints = new Set()
  function showHint(key, v3) {
    if (seenHints.has(key) || !HINTS[key]) return
    seenHints.add(key)
    hint.hidden = false
    hint.textContent = L(...HINTS[key])
    hint.dataset.key = key
    hint._v = v3
    clearTimeout(hint._t)
    hint._t = setTimeout(() => { if (hint.dataset.key === key) hint.hidden = true }, 6000)
  }
  function tutorial() {
    const waiting = sim.customers.some((c) => c.state === "wait")
    if (level.tutorial) {
      const src = sim.pieces.find((p) => p.kind === "src"), first = src && sim.piece(src.feeds[0])
      if (waiting && !seenHints.has("meat")) showHint("meat", pieceTop(src.id, 0.45))
      else if (first?.state === "ready") showHint("take", pieceTop(first.id, 0.55))
      else if (sim.plates.some((p) => p.item) && waiting) { const pl = sim.plates.find((p) => p.item); showHint("serve", plateTop(pl.i).add(new T.Vector3(0, 0.3, 0))) }
      if (seenHints.has("serve") && sim.served >= 2) showHint("combo", null)
    }
    if (sim.pieces.some((p) => p.state === "burnt")) showHint("burn", pieceTop(sim.pieces.find((p) => p.state === "burnt").id, 0.55))
    if (level.hint && sim.t > 2.5) {
      const id = { egg: "eggs", drink: sim.piece("jusjeruk") ? "jusjeruk" : "teh", grill: "satemen", pot: "pot", saus: "saus" }[level.hint]
      if (id && sim.piece(id)) showHint(level.hint, pieceTop(id, 0.5))
    }
  }

  // ---- reacting to the simulation -------------------------------------------------------------------------------
  const srcFood = { meat: () => { const m = steakMesh("raw"); m.scale.setScalar(0.9); return m }, rice: () => { const m = new T.Mesh(new T.SphereGeometry(0.12, 12, 8), new T.MeshStandardMaterial({ color: 0xfbf8f0, roughness: 0.9 })); m.scale.y = 0.6; return m },
    eggs: () => prop("egg", 0.4), satemen: () => prop("skewer", 0.28) }
  function onEvents(evs) {
    for (const e of evs) {
      switch (e.e) {
        case "start": {
          sfx.place()
          const st = world.pieces[e.id]
          if (st.pan) st.pan.userData.toss = 0.6
          const mk = srcFood[e.from]
          if (mk) fly(mk(), pieceTop(e.from, 0.25), pieceTop(e.id, 0.3), { dur: 0.3, arc: 0.4 })
          break
        }
        case "plate": {
          sfx.pop()
          const p = sim.plates[e.plate]
          if (!p.item) break
          hidePlate.add(e.plate)
          const m = dishModel(p.item.dish, p.item.tops)
          fly(m, pieceTop(e.from, 0.3), plateTop(e.plate), { dur: 0.32, arc: 0.5, onDone: () => hidePlate.delete(e.plate) })
          break
        }
        case "top": {
          sfx.plop()
          const blob = (c) => new T.Mesh(new T.SphereGeometry(0.06, 10, 6), new T.MeshStandardMaterial({ color: c, roughness: 0.3 }))
          const tm = e.top === "telur" ? prop("egg-cooked", 0.24) : e.top === "kacang" ? blob(0x7b4a1e) : e.top === "saus" ? blob(0x4a2210)
            : e.top === "buncis" ? blob(0x3f9a3a) : e.top === "tomat" ? blob(0xe0352b) : prop("bread", 0.18)
          fly(tm, pieceTop(e.id, 0.35), plateTop(e.plate).add(new T.Vector3(0, 0.12, 0)), { dur: 0.28, arc: 0.35 })
          bounce(world.plateSpots[e.plate].group)
          break
        }
        case "give": {
          sfx.ding()
          const u = custUi.get(e.cust)
          const from = e.plate !== undefined ? plateTop(e.plate) : pieceTop(e.id, 0.3)
          const m = dishModel(e.dish, e.tops)
          if (u) fly(m, from, u.a.root.position.clone().add(new T.Vector3(0, CUST_H * 0.6, 0.35)), { dur: 0.35, arc: 0.4, scaleTo: 0.6 })
          break
        }
        case "cash": {
          sfx.cash()
          const u = custUi.get(e.id)
          if (u) {
            u.a.play("yes", { once: true }); u.emote = 1
            const v = u.a.root.position.clone().add(new T.Vector3(0, CUST_H * 1.05, 0))
            popAt(v, `+${money(e.amount)}`, "cash")
            coinsFly(v, Math.min(8, 3 + Math.round(e.amount / 10)))
            world.sparkle(v)
            if (e.hearts >= 4.5) popAt(v.clone().add(new T.Vector3(0, 0.35, 0)), "😍", "emo")
          }
          break
        }
        case "ready": sfx.blip(); world.sparkle(pieceTop(e.id, 0.35), [0.5, 1, 0.6], 8); break
        case "burnt": sfx.buzz(); popAt(pieceTop(e.id, 0.6), L("Gosong!", "Burnt!"), "bad"); break
        case "trash": sfx.swoosh(); break
        case "pour": sfx.scoop(); break
        case "nope": {
          sfx.wrong()
          const msg = { full: L("Piring penuh!", "No free plate!"), busy: L("Kompor penuh!", "All burners busy!"), noplate: L("Belum ada piringnya", "No plate for this"),
            tops: L("Topping-nya beda!", "Wrong toppings!"), nobody: L("Tidak ada yang pesan", "Nobody ordered that"), nothing: L("Belum ada pesanannya", "Their order isn't ready") }[e.why]
          const where = e.id ? pieceTop(e.id, 0.6) : e.plate !== undefined ? plateTop(e.plate).add(new T.Vector3(0, 0.4, 0)) : null
          if (msg && where) popAt(where, msg, "bad")
          if (e.id) shake(world.pieces[e.id].group)
          if (e.plate !== undefined) shake(world.plateSpots[e.plate].group)
          break
        }
        case "wrong": sfx.wrong(); { const u = custUi.get(e.cust); if (u) { u.a.play("no", { once: true }); u.emote = 0.9 } } break
        case "order": sfx.boop(); break
        case "combo": if (e.n >= 2) banner(`COMBO ×${e.n}!`, "combo", 1000); break
        case "card": banner(L("Kartu jahil +1 😈", "Prank card +1 😈"), "good", 1200); drawCards(); break
        case "angry": {
          sfx.groan()
          const u = custUi.get(e.id)
          if (u) { u.a.play("no", { once: true }); u.emote = 1.2; popAt(u.a.root.position.clone().add(new T.Vector3(0, CUST_H * 1.05, 0)), L("Huh! Lama!", "Hmph! Too slow!"), "bad") }
          break
        }
        case "skip": banner(L("Pembeli pergi, antrean penuh…", "A customer gave up waiting…"), "bad", 1100); break
        case "cat": sfx.knock(); banner(L("Meong! Oyen naik ke meja!", "Meow! Oyen's on the counter!"), "warn", 1300); break
        case "shoo": sfx.whistle(); break
        case "stolen": sfx.capture(); popAt(plateTop(e.plate).add(new T.Vector3(0, 0.5, 0)), L("Dicuri Oyen! 😾", "Oyen stole it! 😾"), "bad"); break
        case "blackout": sfx.thud(); banner(L("PET! Mati lampu!", "Power cut!"), "dark", 1600); break
        case "rain": sfx.splash(); banner(L("Hujan deras! Pembeli tak sabar", "Downpour! Customers are impatient"), "warn", 1500); world.setRain(true); break
        case "blocked": banner(L("Ditangkis! 🛡️", "Blocked! 🛡️"), "good", 1100); break
        case "rush": if (e.bedug) { sfx.drum(); banner(L("DUG! DUG! Buka puasa!", "BOOM! Time to break the fast!"), "warn", 1800) } else banner(L("Rombongan datang!", "Here comes a crowd!"), "warn", 1400); break
        case "critic": banner(L("Kritikus datang… 🧐", "The critic arrives… 🧐"), "warn", 1600); break
        case "critic_happy": sfx.fanfare(); banner(L("Kritikus puas! +Rp20.000", "Critic impressed! +Rp20,000"), "good", 1600); break
        case "critic_meh": banner(L("Kritikus: 'Hmm.'", "Critic: 'Hmm.'"), "", 1200); break
        case "viral": banner(L("📸 Viral! +Rp8.000", "📸 Gone viral! +Rp8,000"), "good", 1200); break
        case "review": banner(L("👎 Review jelek…", "👎 Bad review…"), "bad", 1200); break
        case "item": sfx.whoosh(); drawItems(); itemFx(e.k); break
      }
    }
  }
  function shake(obj) { if (obj) obj.userData.shake = 0.3 }
  function itemFx(k) {
    const names = { kopi: L("Masak ngebut! ☕", "Turbo cooking! ☕"), bel: L("Semua senang! 🔔", "Everyone's happy! 🔔"), sambal: L("Sambal rahasia! 🌶️", "Secret sambal! 🌶️"),
      ikan: L("Kucing kabur! 🐟", "Cats gone! 🐟"), senter: L("Terang lagi! 🔦", "Lights back! 🔦"), payung: L("Payung siap! ☂️", "Umbrellas up! ☂️") }
    banner(names[k] || k, "good", 1100)
  }

  // ---- per-frame sync ---------------------------------------------------------------------------------------------
  const burntMat = new T.MeshStandardMaterial({ color: 0x1b1714, roughness: 0.95 })
  const rings = {}
  for (const p of sim.pieces) {
    if (!["cook", "pot", "drink"].includes(p.kind)) continue
    const ring = el("div", { class: "ck-ring ck-tap" }, el("i"))
    // the timer above a pan is part of the pan: tapping it acts on the pan (take, scrape, serve the cup…)
    ring.addEventListener("pointerdown", (e) => { e.stopPropagation(); if (live()) act({ type: "piece", id: p.id }) })
    rings[p.id] = { ring, last: "", unpin: gfx.pin(ring, () => (["cooking", "ready", "burnt", "refill", "filling"].includes(p.state) ? pieceTop(p.id, p.kind === "drink" ? 0.85 : 0.62) : null)) }
  }
  let lastCoins = -1, lastStars = 0, lastReport = 0
  function sync(dt, t) {
    stepFlights(dt)
    // pieces
    for (const p of sim.pieces) {
      const r = world.pieces[p.id]
      const g = r.group
      // tap bounce / shake
      const b = g.userData.bounce || 0
      g.userData.bounce = Math.max(0, b - dt)
      const sh = g.userData.shake || 0
      g.userData.shake = Math.max(0, sh - dt)
      g.scale.setScalar((g.userData.s0 ??= g.scale.x) * (1 + Math.sin((b / 0.25) * Math.PI) * 0.08))
      g.rotation.y = Math.sin(sh * 60) * sh * 0.4
      const age = sim.t - p.t
      const ring = rings[p.id]
      if (p.kind === "cook") {
        const cooking = p.state === "cooking", ready = p.state === "ready", burnt = p.state === "burnt"
        if (r.food) r.food.visible = p.state !== "empty"
        if (cooking) { world.fireAt(p.id, 1); if (Math.random() < dt * 8) world.steamAt(world.stationFx(p.id), 1) }
        if (ready && Math.random() < dt * 5) world.steamAt(world.stationFx(p.id), 1)
        if (burnt && Math.random() < dt * 10) world.steamAt(world.stationFx(p.id), 1, true)
        if (r.pan) {
          const toss = r.pan.userData.toss || 0
          r.pan.userData.toss = Math.max(0, toss - dt)
          r.pan.rotation.z = cooking ? Math.sin(t * 9) * 0.04 + Math.sin(toss * 18) * toss * 0.3 : 0
          r.pan.position.y = toss > 0 ? Math.abs(Math.sin(toss * 18)) * 0.05 * toss : 0
        }
        if (r.steak) {
          r.steak.visible = p.state !== "empty"
          steakLook(r.steak, burnt ? "burnt" : cooking && age < sim.cookT(p) * 0.55 ? "raw" : "cooked")
          if (cooking && Math.random() < dt * 14) world.fire.spawn({ ...world.stationFx(p.id), vy: 0.4, life: 0.25, size: 0.06, color: [1, 0.6, 0.2], alpha: 0.7 })
        } else if (r.food) r.food.traverse((o) => { if (o.isMesh) { if (!o.userData.mat0) o.userData.mat0 = o.material; o.material = burnt ? burntMat : o.userData.mat0 } })
        if (r.coals) r.coals.emissiveIntensity = 1.1 + Math.sin(t * 6) * 0.3 + (cooking ? 0.6 : 0)
        const prog = cooking ? age / sim.cookT(p) : ready ? age / sim.burnT(p) : 1
        const cls = cooking ? "cook" : ready ? (age > sim.burnT(p) - 2.2 ? "warn" : "ready") : burnt ? "burnt" : ""
        if (cls !== ring.last) { ring.ring.className = `ck-ring ck-tap ${cls}`; ring.last = cls; ring.ring.dataset.icon = ready ? "✓" : burnt ? "✕" : "" }
        ring.ring.style.setProperty("--p", String(Math.min(1, Math.max(0, prog))))
      } else if (p.kind === "pot") {
        r.balls.forEach((bl, i) => { bl.visible = p.state === "ready" && i < p.portions; bl.position.y = 0.5 + Math.sin(t * 3 + i) * 0.01 })
        if (Math.random() < dt * 4) world.steamAt(world.stationFx(p.id), 1)
        const cls = p.state === "refill" ? "cook" : ""
        if (p.state === "refill") { world.fireAt(p.id, 1); ring.ring.style.setProperty("--p", String(Math.min(1, age / (p.refill * kit.cook * (kit.quick || 1))))) }
        if (cls !== ring.last) { ring.ring.className = `ck-ring ck-tap ${cls}`; ring.last = cls }
      } else if (p.kind === "drink") {
        if (r.cup) {
          r.cup.visible = p.state !== "empty"
          const k = p.state === "filling" ? Math.min(1, age / (p.prep * (kit.drink || 1))) : 1
          r.cup.scale.y = (r.cup.userData.sy ??= r.cup.scale.y) * (0.3 + 0.7 * k)
        }
        const cls = p.state === "filling" ? "cook" : p.state === "full" ? "ready" : ""
        if (cls !== ring.last) { ring.ring.className = `ck-ring ck-tap ${cls}`; ring.last = cls; ring.ring.dataset.icon = p.state === "full" ? "✓" : "" }
        if (p.state === "filling") ring.ring.style.setProperty("--p", String(Math.min(1, age / (p.prep * (kit.drink || 1)))))
      }
    }
    // plates
    sim.plates.forEach((pl, i) => {
      const s = world.plateSpots[i]
      const key = pl.item && !hidePlate.has(i) ? dishKey(pl.item.dish, pl.item.tops) : ""
      if (key !== s.key) { s.key = key; s.dish.clear(); if (key) s.dish.add(dishModel(pl.item.dish, pl.item.tops)) }
      const b = s.group.userData.bounce || 0
      s.group.userData.bounce = Math.max(0, b - dt)
      const sh = s.group.userData.shake || 0
      s.group.userData.shake = Math.max(0, sh - dt)
      s.group.scale.setScalar(1 + Math.sin((b / 0.25) * Math.PI) * 0.1)
      s.group.rotation.y = Math.sin(sh * 60) * sh * 0.4
    })
    // customers
    for (const c of sim.customers) {
      const u = custUi.get(c.id) || addCustomer(c)
      const a = u.a
      u.place()
      const want = c.moving ? (c.state === "out" ? -c.side : c.side) * -Math.PI / 2 : 0
      let dr = want - a.root.rotation.y
      dr = Math.atan2(Math.sin(dr), Math.cos(dr))
      a.root.rotation.y += dr * Math.min(1, dt * 10)
      u.emote = Math.max(0, u.emote - dt)
      if (u.emote <= 0) a.play(c.moving ? "walk" : "idle")
      a.update(dt)
      u.target.enabled = c.state === "wait"
      const lsig = `${c.state}|${c.order.map((l) => l.done).join()}|${sim.hidden()}`
      if (lsig !== u.sig) {
        u.sig = lsig
        u.lines.replaceChildren(...(c.state === "wait" ? c.order.map((l) => el("span", { class: `ck-line${l.done ? " done" : ""}`, title: dishName(l) },
          sim.hidden() && !l.done ? el("b", { text: "?" }) : el("img", { src: thumb(l.dish, l.tops), alt: dishName(l) }))) : [el("span", { class: "ck-dots", text: "…" })]))
      }
      const h = c.hearts / 5
      u.bar.style.setProperty("--h", `${Math.max(0, h * 100)}%`)
      u.card.dataset.mood = h < 0.3 ? "low" : h < 0.6 ? "mid" : "ok"
    }
    for (const id of [...custUi.keys()]) if (!sim.customers.find((c) => c.id === id)) removeCustomer(id)
    // cats
    for (const c of sim.cats) {
      const u = catUi.get(c.id) || (addCat(c), catUi.get(c.id))
      u.m.group.position.copy(catPos(c))
      u.m.group.rotation.y = c.state === "flee" ? c.side * Math.PI / 2 : -c.side * Math.PI / 2
      u.m.update(dt, c.p < 1 || c.state === "flee", c.state === "flee")
    }
    for (const [id, u] of [...catUi]) if (!sim.cats.find((c) => c.id === id)) { u.unpin(); gfx.removePick(u.m.group); u.m.group.removeFromParent(); catUi.delete(id) }
    // weather / power
    world.setDark(sim.t < sim.fx.dark)
    if (world.raining && sim.t >= sim.fx.rain) world.setRain(false)
    // HUD
    if (sim.coins !== lastCoins) {
      lastCoins = sim.coins
      coinsEl.textContent = money(sim.coins)
      goalBar.firstChild.style.width = `${Math.min(100, (sim.coins / sim.goals[2]) * 100)}%`
      const st = sim.stars()
      goalBar.querySelectorAll(".ck-star").forEach((n, i) => n.classList.toggle("on", i < st))
      if (st > lastStars) { lastStars = st; setTimeout(() => { sfx.win(); banner("★".repeat(st), "stars", 1200) }, 700) }
    }
    if (opts.onScore && performance.now() - lastReport > 250) { opts.onScore(sim.coins); lastReport = performance.now() }
    const total = sim.served + sim.lost + sim.schedule.length + sim.pending.length + sim.customers.filter((c) => !["out", "happy", "mad"].includes(c.state)).length
    const done = sim.served + sim.lost
    if (opts.duel) { info.firstChild.textContent = "⏱"; info.lastChild.textContent = `${Math.max(0, Math.ceil(sim.limit - sim.t))}s`; info.children[1].firstChild.style.width = `${Math.min(100, (sim.t / sim.limit) * 100)}%` }
    else { info.lastChild.textContent = `${done}/${total}`; info.children[1].firstChild.style.width = `${total ? (done / total) * 100 : 0}%` }
    if (!hint.hidden) {
      if (hint._v) { const [x, y] = gfx.toScreen(hint._v); hint.style.left = `${x}px`; hint.style.top = `${y - 34}px`; hint.classList.remove("free") }
      else hint.classList.add("free")
    }
    if (started) tutorial()
  }

  // ---- camera ---------------------------------------------------------------------------------------------------
  function camera(dt) {
    const cam = gfx.camera
    const k = Math.min(1, dt * (camMode === "intro" ? 1.6 : 3))
    if (camMode === "focus" && focus.pos) { cam.position.lerp(focus.pos, k); lookNow.lerp(focus.look, k) }
    else {
      cam.position.lerp(camGoal, k); lookNow.lerp(camLook, k)
      if (camMode === "intro" && cam.position.distanceTo(camGoal) < 0.02) camMode = "play"
    }
    cam.lookAt(lookNow)
  }

  let doneT = 0
  gfx.tickers.add((dt, t) => {
    camera(dt)
    const run = started && !paused && !ended && !sim.paused && (opts.duel || !upright())   // the career waits while the phone is upright
    if (run) {
      const evs = sim.step(dt * (window.__ckSpeed || 1))   // __ckSpeed: automated tests only
      if (evs.length) onEvents(evs)
      if (sim.over && !doneT) { doneT = 1; finish() }
    }
    sync(run || !started ? dt : 0, t)
    if (opts.tick) opts.tick(dt)
  })
  gfx.start()

  // ---- story hook: dialogue scenes happen right here at the counter --------------------------------------------------
  const stage = {
    gfx, world, box, sim, kit,
    spot(i) {   // where a story character stands (behind the counter)
      const xs = L0.slots
      return new T.Vector3(xs[Math.max(0, Math.min(xs.length - 1, i))], STEP, L0.custZ)
    },
    focus(v3, dist = 2.6) {
      if (!v3) { camMode = "play"; return }
      camMode = "focus"
      focus.look = v3.clone()
      focus.pos = v3.clone().add(new T.Vector3(0, 0.12, dist))
    },
  }

  async function begin() {
    if (opts.story) { box.classList.add("story"); await opts.story(stage); box.classList.remove("story") }
    camMode = "play"
    banner(opts.duel ? L("SIAP… MASAK!", "READY… COOK!") : L("BUKA!", "OPEN!"), "open", 1300)
    sfx.mpStart()
    setTimeout(() => { started = true }, 700)
  }

  function finish() {
    ended = true
    sfx.mpFinish()
    banner(L("TUTUP!", "CLOSED!"), "open", 1400)
    const res = { coins: sim.coins, stars: sim.stars(), served: sim.served, lost: sim.lost, perfect: sim.perfect, combo: sim.bestCombo, used: { ...sim.used }, goals: sim.goals }
    if (opts.onScore) opts.onScore(sim.coins, true)
    setTimeout(() => opts.onEnd && opts.onEnd(res), 1600)
  }

  return {
    stage, sim, begin,
    prank(kind, dur) { sim.prank(kind, dur) },
    setOthers(list) {
      others.replaceChildren(...list.map((p) => el("span", { class: `ck-other${p.me ? " me" : ""}` }, el("i", { text: p.avatar }), el("b", { text: money(p.coins) }))))
    },
    destroy() {
      for (const u of custUi.values()) u.unpin()
      world.dispose()
      gfx.dispose()
      box.remove()
    },
  }
}
