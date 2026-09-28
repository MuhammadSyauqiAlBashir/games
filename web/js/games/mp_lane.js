// Lane Change: your hover car speeds along a 5-lane track. Switch lanes to grab coins; dodge the Thwomps.
import { el, svg } from "../lib.js?v=__VERSION__"
import { coin, loop, popText, reporter, rng, soloFrame, thwomp } from "./mp.js?v=__VERSION__"

const LANES = 5
const lx = (l) => 14 + l * 18

export function mount(stage, ctx) {
  const S = soloFrame(stage, ctx, { bg: "#20264a", scoreLabel: "🪙" })
  const R = reporter(ctx)
  const g = svg("svg", { viewBox: "0 0 100 120", style: "touch-action:none" })
  S.box.append(g)
  S.box.style.maxWidth = "min(100%, 480px, calc((100dvh - 440px) * .83))"
  for (let l = 0; l <= LANES; l++) g.append(svg("line", { x1: 5 + l * 18, y1: 0, x2: 5 + l * 18, y2: 120, stroke: "rgba(140,170,255,.35)", "stroke-width": 0.6, "stroke-dasharray": "4 3", class: "ln-dash" }))
  const items = svg("g")
  const car = svg("g", {}, svg("ellipse", { cx: 0, cy: 5, rx: 6, ry: 1.6, fill: "rgba(120,200,255,.35)" }),
    svg("path", { d: "M-6 3 Q -7 -6 0 -8 Q 7 -6 6 3 Z", fill: "#e5484d", stroke: "#fff", "stroke-width": 0.6 }), svg("ellipse", { cx: 0, cy: -3, rx: 3, ry: 2.4, fill: "#9fe0ff" }))
  const me = svg("text", { y: -2.6, "text-anchor": "middle", "dominant-baseline": "central", "font-size": 4 })
  car.append(me)
  g.append(items, car)
  const lb = el("button", { class: "mp-btn blue", type: "button", onclick: () => shift(-1) }, el("span", { class: "em", text: "⬅️" }))
  const rb = el("button", { class: "mp-btn blue", type: "button", onclick: () => shift(1) }, el("span", { class: "em", text: "➡️" }))
  S.ctrl.append(lb, rb)
  let V = null, key = "", G = null, sx = null

  function newGame(seed, t0) {
    const r = rng(seed)
    const list = []
    let d = 30
    while (d < 2200) {
      const pat = r()
      const l0 = Math.floor(r() * LANES)
      if (pat < 0.35) for (let k = 0; k < 5; k++) list.push({ d: d + k * 7, l: l0, k: "c" })
      else if (pat < 0.6) for (let k = 0; k < 5; k++) list.push({ d: d + k * 7, l: Math.max(0, Math.min(LANES - 1, l0 + (k % 2 ? 1 : 0))), k: "c" })
      else if (pat < 0.75) list.push({ d, l: l0, k: "r" })
      else { list.push({ d, l: l0, k: "t" }); if (r() < 0.5) list.push({ d, l: (l0 + 2) % LANES, k: "t" }) }
      d += 26 + r() * 20
    }
    G = { list, t0, lane: 2, x: lx(2), score: 0, got: new Set(), stun: 0, nodes: new Map() }
    items.replaceChildren()
  }
  function shift(dl) {
    if (!G || !V || V.phase !== "play" || performance.now() < G.stun) return
    G.lane = Math.max(0, Math.min(LANES - 1, G.lane + dl))
    ctx.sfx.swoosh()
  }
  g.addEventListener("pointerdown", (e) => { sx = e.clientX })
  g.addEventListener("pointerup", (e) => {
    if (sx === null) return
    const r = g.getBoundingClientRect()
    const dx = e.clientX - sx
    shift(Math.abs(dx) > 20 ? Math.sign(dx) : e.clientX < r.left + r.width / 2 ? -1 : 1)
    sx = null
  })
  const kd = (e) => { if (e.key === "ArrowLeft") shift(-1); if (e.key === "ArrowRight") shift(1) }
  document.addEventListener("keydown", kd)

  const dist = (t) => 22 * t + 0.55 * t * t  // speeds up
  const stopLoop = loop(ctx, (now) => {
    if (!G || !V) return
    const t = V.phase === "play" ? Math.max(0, now - G.t0) : 0
    const D = dist(t)
    G.x += (lx(G.lane) - G.x) * 0.3
    car.setAttribute("transform", `translate(${G.x.toFixed(2)} 100)`)
    car.setAttribute("opacity", performance.now() < G.stun ? (Math.sin(now * 30) > 0 ? 0.4 : 1) : 1)
    g.querySelectorAll(".ln-dash").forEach((l) => l.setAttribute("stroke-dashoffset", (D % 7).toFixed(2)))
    for (const [i, it] of G.list.entries()) {
      const y = 100 - (it.d - D)
      let n = G.nodes.get(i)
      if (y < -10 || y > 130 || G.got.has(i)) { if (n) { n.remove(); G.nodes.delete(i) } continue }
      if (!n) {
        n = svg("g", {}, it.k === "c" ? coin(3) : it.k === "r" ? svg("g", {}, svg("circle", { r: 3.4, fill: "#e5484d", stroke: "#8a1c1c", "stroke-width": 0.6 })) : svg("g", { transform: "scale(.5)" }, thwomp(20, 22)))
        items.append(n); G.nodes.set(i, n)
      }
      n.setAttribute("transform", `translate(${lx(it.l)} ${y.toFixed(2)})`)
      if (V.phase === "play" && Math.abs(y - 100) < 4 && Math.abs(lx(it.l) - G.x) < 7) {
        G.got.add(i)
        if (it.k === "t") { if (performance.now() > G.stun) { G.stun = performance.now() + 1000; G.score = Math.max(0, G.score - 2); ctx.sfx.thud(); popText(S.box, "−2", (G.x / 100) * 100, 70, "bad") } }
        else { const v = it.k === "r" ? 3 : 1; G.score += v; ctx.sfx.coin(); if (v > 1) popText(S.box, "+3", G.x, 70) }
        R.set(G.score)
      }
    }
  })
  return {
    destroy() { stopLoop(); document.removeEventListener("keydown", kd) },
    scores: (v) => v.scores,
    update(v, events) {
      V = v
      S.update(v, events)
      if (v.phase === "play" && key !== `${v.round}:${v.seed}`) { key = `${v.round}:${v.seed}`; newGame(v.seed, v.t0); R.reset() }
      if (!G) newGame(4, 1e9)
      me.textContent = ctx.player(ctx.me.id).avatar
      S.q.replaceChildren(ctx.L("Geser / ketuk kiri-kanan untuk pindah jalur. Ambil koin!", "Swipe or tap left/right to change lanes. Grab the coins!"), el("small", { text: ctx.L("🔴 = 3 koin · Thwomp = −2 & oleng", "🔴 = 3 coins · Thwomp = −2 & wobble") }))
    },
  }
}
