// Toad-ally Electric Escape: drag your Toad through the electric maze without touching the walls or the Amps.
// Touch = zap back to the last checkpoint. First one out wins.
import { el, svg } from "../lib.js?v=__VERSION__"
import { banner, loop, popText, reporter, rng, soloFrame, toad } from "./mp.js?v=__VERSION__"

function build(seed) {
  const r = rng(seed)
  const pts = [[50, 124]]
  let y = 124
  while (y > 18) { y -= 12 + r() * 6; pts.push([14 + r() * 72, Math.max(10, y)]) }
  pts.push([50, 6])
  const segs = []
  let acc = 0
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i]
    const len = Math.hypot(bx - ax, by - ay)
    segs.push({ ax, ay, bx, by, len, s0: acc, w: Math.max(7.5, 12 - i * 0.45) })
    acc += len
  }
  const amps = []
  for (let k = 0; k < 4; k++) { const sg = segs[2 + Math.floor(r() * (segs.length - 3))]; amps.push({ sg, f: 0.3 + r() * 0.4, sp: 1.6 + r() * 1.6, ph: r() * 6 }) }
  return { pts, segs, total: acc, amps }
}
function nearest(M, x, y) {
  let best = { d: 1e9, s: 0, w: 10 }
  for (const g of M.segs) {
    const dx = g.bx - g.ax, dy = g.by - g.ay
    const t = Math.max(0, Math.min(1, ((x - g.ax) * dx + (y - g.ay) * dy) / (g.len * g.len)))
    const px = g.ax + dx * t, py = g.ay + dy * t
    const d = Math.hypot(x - px, y - py)
    if (d < best.d) best = { d, s: g.s0 + t * g.len, w: g.w }
  }
  return best
}
function pointAt(M, s) {
  for (const g of M.segs) if (s <= g.s0 + g.len) { const t = (s - g.s0) / g.len; return [g.ax + (g.bx - g.ax) * t, g.ay + (g.by - g.ay) * t] }
  return M.pts[M.pts.length - 1]
}

export function mount(stage, ctx) {
  const S = soloFrame(stage, ctx, { bg: "#141a2e", max: 100 })
  const R = reporter(ctx)
  const g = svg("svg", { viewBox: "0 0 100 130", style: "touch-action:none" })
  S.box.append(g)
  S.box.style.maxWidth = "min(100%, 460px, calc((100dvh - 450px) * .77))"
  const lay = svg("g"), ampsG = svg("g"), tG = svg("g", {}, svg("circle", { r: 4.2, fill: "rgba(255,255,255,.25)" }), svg("g", { transform: "translate(0 3) scale(.42)" }, toad("#e5484d")))
  g.append(lay, ampsG, tG)
  let V = null, key = "", M = null, st = null

  function reset(seed) {
    M = build(seed)
    lay.replaceChildren(
      svg("polyline", { points: M.pts.map((p) => p.join(",")).join(" "), fill: "none", stroke: "#ffe14a", "stroke-width": 13.4, "stroke-linejoin": "round", "stroke-linecap": "round", class: "el-zap" }),
      ...M.segs.map((s) => svg("line", { x1: s.ax, y1: s.ay, x2: s.bx, y2: s.by, stroke: "#20273f", "stroke-width": s.w, "stroke-linecap": "round" })),
      ...[M.total / 3, (2 * M.total) / 3].map((s) => { const [x, y] = pointAt(M, s); return svg("circle", { cx: x, cy: y, r: 2.4, fill: "#3fd07a", opacity: 0.8 }) }),
      svg("text", { x: 50, y: 9, "text-anchor": "middle", "dominant-baseline": "central", "font-size": 8, text: "🚪" }))
    ampsG.replaceChildren(...M.amps.map(() => svg("g", {}, svg("circle", { r: 2.8, fill: "#ffd84a", class: "mp-spark" }), svg("circle", { r: 1.6, fill: "#fff" }))))
    st = { x: 50, y: 124, best: 0, cp: 0, drag: false, stun: 0, done: false }
  }

  function toLocal(e) {
    const r = g.getBoundingClientRect()
    return [((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 130]
  }
  function zap() {
    ctx.sfx.buzz()
    S.box.classList.remove("mp-shake"); void S.box.offsetWidth; S.box.classList.add("mp-shake")
    const cps = [0, M.total / 3, (2 * M.total) / 3]
    const s = cps[st.cp]
    ;[st.x, st.y] = pointAt(M, s)
    st.drag = false
    st.stun = performance.now() + 700
    popText(S.box, "⚡ZAP!", 50, 50, "bad")
  }
  function moveTo(x, y) {
    const steps = Math.ceil(Math.hypot(x - st.x, y - st.y) / 1.5)
    for (let k = 1; k <= steps; k++) {
      const nx = st.x + ((x - st.x) * k) / steps, ny = st.y + ((y - st.y) * k) / steps
      const n = nearest(M, nx, ny)
      if (n.d > n.w / 2 - 1.6 || n.s > st.best + 14) { zap(); return }
      st.best = Math.max(st.best, n.s)
      if (st.best > M.total / 3 && st.cp < 1) { st.cp = 1; ctx.sfx.ding() }
      if (st.best > (2 * M.total) / 3 && st.cp < 2) { st.cp = 2; ctx.sfx.ding() }
    }
    st.x = x; st.y = y
    const pct = Math.min(100, (st.best / M.total) * 100)
    if (Math.hypot(x - 50, y - 6) < 6 && !st.done) { st.done = true; R.set(100, true); ctx.sfx.fanfare(); banner(S.box, ctx.L("LOLOS!", "ESCAPED!"), { kind: "good" }) }
    else R.set(Math.round(pct * 10) / 10)
  }
  g.addEventListener("pointerdown", (e) => {
    if (!V || V.phase !== "play" || !st || st.done || performance.now() < st.stun) return
    const [x, y] = toLocal(e)
    if (Math.hypot(x - st.x, y + 9 - st.y) < 14 || Math.hypot(x - st.x, y - st.y) < 12) { st.drag = true; g.setPointerCapture(e.pointerId) }
  })
  g.addEventListener("pointermove", (e) => { if (st && st.drag && V && V.phase === "play") { const [x, y] = toLocal(e); moveTo(x, y - 9) } })
  const up = () => { if (st) st.drag = false }
  g.addEventListener("pointerup", up); g.addEventListener("pointercancel", up)

  const stop = loop(ctx, (now) => {
    if (!M || !st) return
    const t = now
    M.amps.forEach((a, i) => {
      const s = a.sg, nx = -(s.by - s.ay) / s.len, ny = (s.bx - s.ax) / s.len
      const off = Math.sin(t * a.sp + a.ph) * (s.w / 2 - 1)
      const x = s.ax + (s.bx - s.ax) * a.f + nx * off, y = s.ay + (s.by - s.ay) * a.f + ny * off
      ampsG.children[i].setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)})`)
      if (V && V.phase === "play" && !st.done && performance.now() > st.stun && Math.hypot(x - st.x, y - st.y) < 4.4) zap()
    })
    tG.setAttribute("transform", `translate(${st.x.toFixed(2)} ${st.y.toFixed(2)})`)
    tG.setAttribute("opacity", performance.now() < st.stun ? (Math.sin(now * 40) > 0 ? 0.3 : 1) : 1)
  })
  return {
    destroy: stop,
    scores: (v) => v.scores,
    update(v, events) {
      V = v
      S.update(v, events)
      if (v.seed && key !== `${v.round}:${v.seed}`) { key = `${v.round}:${v.seed}`; reset(v.seed); R.reset() }
      if (!M) reset(7)
      S.q.replaceChildren(ctx.L("Seret Toad-mu ke pintu 🚪 tanpa menyentuh dinding listrik!", "Drag your Toad to the door 🚪 without touching the electric walls!"),
        el("small", { text: ctx.L("Titik hijau = checkpoint. Kena listrik atau Amp = balik ke checkpoint.", "Green dots = checkpoints. Touch the wall or an Amp = back to the checkpoint.") }))
    },
  }
}
