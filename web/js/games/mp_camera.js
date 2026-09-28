// Camera-Ready: copy the photo! Drag to move your camera, zoom in/out, and snap when the moving Lakitu
// is in the same spot. The closer your picture, the more points.
import { el, svg } from "../lib.js?v=__VERSION__"
import { banner, clamp, loop, reporter, rng, soloFrame } from "./mp.js?v=__VERSION__"

const W = 160, H = 100, ASPECT = 4 / 3
const CAST = ["🍄", "⭐", "🐢", "👻", "🌸", "🦖", "🏰", "🌳", "🐸", "🎈"]

function scene(seed) {
  const r = rng(seed)
  const items = Array.from({ length: 9 }, (_, i) => ({ e: CAST[(i + Math.floor(r() * 10)) % CAST.length], x: 10 + r() * 140, y: 22 + r() * 66, s: 7 + r() * 7 }))
  const lk = { y: 12 + r() * 30, x0: 20 + r() * 30, x1: 100 + r() * 40, per: 3 + r() * 2 }
  const tw = 34 + r() * 30, th = tw / ASPECT
  const ph = 0.15 + r() * 0.7
  const S0 = { lk }
  const cx = lakituX(S0, ph * lk.per) + (r() - 0.5) * tw * 0.4, cy = lk.y + th * (0.1 + r() * 0.3)
  const target = { w: tw, x: Math.max(0, Math.min(W - tw, cx - tw / 2)), y: Math.max(0, Math.min(H - th, cy - th / 2)), ph }
  return { items, lk, target }
}
const lakituX = (S, t) => S.lk.x0 + (S.lk.x1 - S.lk.x0) * (0.5 - Math.cos((t / S.lk.per) * Math.PI * 2) / 2)

function world(S, t) {
  const g = svg("g")
  g.append(svg("rect", { width: W, height: H, fill: "#9fe0ff" }), svg("rect", { y: 70, width: W, height: 30, fill: "#7cd36b" }))
  for (const it of S.items) g.append(svg("text", { x: it.x, y: it.y, "text-anchor": "middle", "dominant-baseline": "central", "font-size": it.s, text: it.e }))
  const lk = svg("g", { class: "lk" }, svg("text", { "text-anchor": "middle", "dominant-baseline": "central", "font-size": 10, text: "☁️" }), svg("text", { y: -5, "text-anchor": "middle", "dominant-baseline": "central", "font-size": 6, text: "🐢" }))
  lk.setAttribute("transform", `translate(${lakituX(S, t)} ${S.lk.y})`)
  g.append(lk)
  return g
}

export function mount(stage, ctx) {
  const Sf = soloFrame(stage, ctx, { bg: "#20264a", max: 100 })
  const R = reporter(ctx)
  const ref = svg("svg", { class: "cam-ref" })
  const view = svg("svg", { style: "touch-action:none", viewBox: `0 0 ${W} ${W / ASPECT}` })
  Sf.box.append(view, el("div", { class: "cam-ref-box" }, el("small", { text: ctx.L("CONTOH", "TARGET") }), ref))
  const zin = el("button", { class: "mp-btn blue", type: "button", onclick: () => zoom(0.85) }, el("span", { class: "em", text: "🔍+" }))
  const zout = el("button", { class: "mp-btn blue", type: "button", onclick: () => zoom(1.18) }, el("span", { class: "em", text: "🔍−" }))
  const snap = el("button", { class: "mp-btn red huge", type: "button", onclick: () => shoot() }, el("span", { text: "📸" }))
  Sf.ctrl.append(zout, snap, zin)
  let V = null, key = "", S = null, cam = null, taken = false, liveW = null, drag = null

  function reset(seed) {
    S = scene(seed)
    const tg = S.target
    const th = tg.w / ASPECT
    ref.setAttribute("viewBox", `${tg.x} ${tg.y} ${tg.w} ${th}`)
    ref.replaceChildren(world(S, tg.ph * S.lk.per))
    cam = { w: 70, x: 45, y: 15 }
    view.replaceChildren(liveW = world(S, 0))
    taken = false
    apply()
  }
  function apply() {
    cam.w = Math.max(12, Math.min(W, cam.w))
    const h = cam.w / ASPECT
    cam.x = Math.max(0, Math.min(W - cam.w, cam.x)); cam.y = Math.max(0, Math.min(H - h, cam.y))
    view.setAttribute("viewBox", `${cam.x.toFixed(2)} ${cam.y.toFixed(2)} ${cam.w.toFixed(2)} ${h.toFixed(2)}`)
  }
  function zoom(k) { if (taken) return; const cx = cam.x + cam.w / 2, cy = cam.y + cam.w / ASPECT / 2; cam.w *= k; cam.x = cx - cam.w / 2; cam.y = cy - cam.w / ASPECT / 2; apply(); ctx.sfx.click() }
  view.addEventListener("pointerdown", (e) => { if (!taken) { drag = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y }; view.setPointerCapture(e.pointerId) } })
  view.addEventListener("pointermove", (e) => {
    if (!drag) return
    const r = view.getBoundingClientRect(), k = cam.w / r.width
    cam.x = drag.cx - (e.clientX - drag.x) * k; cam.y = drag.cy - (e.clientY - drag.y) * k; apply()
  })
  view.addEventListener("pointerup", () => { drag = null })
  function shoot() {
    if (!V || V.phase !== "play" || taken) return
    taken = true
    const tg = S.target, th = tg.w / ASPECT, ch = cam.w / ASPECT
    const ix = Math.max(0, Math.min(cam.x + cam.w, tg.x + tg.w) - Math.max(cam.x, tg.x)), iy = Math.max(0, Math.min(cam.y + ch, tg.y + th) - Math.max(cam.y, tg.y))
    const inter = ix * iy, iou = inter / (cam.w * ch + tg.w * th - inter)
    const t = ctx.now() - V.t0
    const dx = Math.abs(lakituX(S, t) - lakituX(S, tg.ph * S.lk.per))
    const timing = clamp(1 - dx / 60) * 0.35 + 0.65
    const score = Math.round(iou * timing * 1000) / 10
    ctx.sfx.whoosh()
    Sf.box.classList.remove("mp-flash"); void Sf.box.offsetWidth; Sf.box.classList.add("mp-flash")
    banner(Sf.box, `${Math.round(score)}%`, { kind: score > 70 ? "good" : "bad", ms: 1600 })
    R.set(score, true)
  }
  const stop = loop(ctx, (now) => {
    if (!S || !V || !liveW) return
    if (!taken) { const t = V.phase === "play" ? now - V.t0 : 0; liveW.querySelector(".lk").setAttribute("transform", `translate(${lakituX(S, t).toFixed(2)} ${S.lk.y})`) }
  })
  return {
    destroy: stop,
    scores: (v) => v.scores,
    update(v, events) {
      V = v
      Sf.update(v, events)
      if (v.phase === "play" && key !== `${v.round}:${v.seed}`) { key = `${v.round}:${v.seed}`; reset(v.seed); R.reset() }
      if (!S) reset(11)
      Sf.q.replaceChildren(ctx.L("Tiru foto CONTOH: geser kamera, zoom, lalu 📸 saat Lakitu di posisi yang sama!", "Copy the TARGET photo: drag the camera, zoom, then 📸 when Lakitu is in the same spot!"),
        el("small", { text: ctx.L("Satu jepretan per ronde", "One shot per round") }))
    },
  }
}
