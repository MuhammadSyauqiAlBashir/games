// Stone-Eye Bowling: tap to lock your aim, tap again to lock your power, and roll the boulder into the
// Stone-Eyes. 3 frames of 2 rolls; knock down the most.
import { el, svg } from "../lib.js?v=__VERSION__"
import { banner, loop, popText, reporter, rng, soloFrame } from "./mp.js?v=__VERSION__"

const PINS = (() => { const out = []; [[4, 14], [3, 22], [2, 30], [1, 38]].forEach(([n, y]) => { for (let i = 0; i < n; i++) out.push([30 + (i - (n - 1) / 2) * 8, y]) }); return out })()

export function mount(stage, ctx) {
  const S = soloFrame(stage, ctx, { bg: "#e9c98a", scoreLabel: "🗿", max: 30 })
  const R = reporter(ctx)
  const g = svg("svg", { viewBox: "0 0 60 120" })
  S.box.append(g)
  S.box.style.maxWidth = "min(100%, 330px, calc((100dvh - 420px) * .5))"
  g.append(svg("rect", { x: 6, y: 2, width: 48, height: 116, rx: 3, fill: "#f3dca6", stroke: "#b8935a", "stroke-width": 0.8 }))
  for (let i = 0; i < 7; i++) g.append(svg("line", { x1: 10 + i * 7, y1: 2, x2: 10 + i * 7, y2: 118, stroke: "rgba(150,110,60,.18)", "stroke-width": 0.4 }))
  const pinsG = svg("g"), arrow = svg("g"), ballG = svg("g", {}, svg("circle", { r: 3.4, fill: "#6b7385", stroke: "#3a3f4a", "stroke-width": 0.5 }), svg("circle", { cx: -1, cy: -1, r: 0.8, fill: "rgba(255,255,255,.4)" }))
  const meter = svg("g", { transform: "translate(56 60)" })
  const mfill = svg("rect", { x: -1.6, width: 3.2, height: 0, fill: "#e5484d" })
  meter.append(svg("rect", { x: -1.6, y: -40, width: 3.2, height: 40, fill: "rgba(0,0,0,.2)" }), mfill)
  arrow.append(svg("line", { x1: 0, y1: 0, x2: 0, y2: -18, stroke: "#e5484d", "stroke-width": 1.2, "stroke-dasharray": "2 1.2" }), svg("path", { d: "M-2 -16 L 0 -20 L 2 -16 Z", fill: "#e5484d" }))
  g.append(pinsG, arrow, ballG, meter)
  const btn = el("button", { class: "mp-btn huge red", type: "button", onclick: () => press() }, el("span", { text: ctx.L("KUNCI ARAH", "LOCK AIM") }))
  S.ctrl.append(btn)
  let V = null, key = "", G = null

  function newGame(seed) { G = { r: rng(seed), frame: 1, roll: 1, up: PINS.map(() => true), stage: "aim", aim: 0, pow: 0, t0: performance.now(), score: 0, anim: null } ; drawPins() }
  function drawPins() {
    pinsG.replaceChildren(...PINS.map(([x, y], i) => svg("g", { transform: `translate(${x} ${y})`, opacity: G.up[i] ? 1 : 0.18 },
      svg("ellipse", { rx: 2.6, ry: 3.2, fill: "#9aa3ad", stroke: "#5b6270", "stroke-width": 0.4 }), svg("circle", { cy: -0.6, r: 1, fill: "#fff" }), svg("circle", { cy: -0.6, r: 0.5, fill: "#222" }))))
  }
  function press() {
    if (!G || !V || V.phase !== "play" || G.anim) return
    const t = (performance.now() - G.t0) / 1000
    if (G.stage === "aim") { G.aim = Math.sin(t * 3.4) * 11; G.stage = "power"; G.t0 = performance.now(); btn.firstChild.textContent = ctx.L("KUNCI TENAGA", "LOCK POWER"); ctx.sfx.click() }
    else if (G.stage === "power") { G.pow = Math.abs(Math.sin(t * 2.6)); roll() }
  }
  function roll() {
    ctx.sfx.swoosh()
    const a = (G.aim * Math.PI) / 180
    const dx = Math.sin(a), dy = -Math.cos(a)
    const hitNow = new Set()
    PINS.forEach(([x, y], i) => {
      if (!G.up[i]) return
      const px = x - 30, py = y - 108
      const along = px * dx + py * dy, perp = Math.abs(px * dy - py * dx)
      if (along > 0 && perp < 5.4 - (1 - G.pow) * 1.4) hitNow.add(i)
    })
    const fall = new Set(hitNow)
    const chance = 0.3 + G.pow * 0.55
    let grew = true
    while (grew) {
      grew = false
      PINS.forEach(([x, y], i) => {
        if (!G.up[i] || fall.has(i)) return
        for (const j of fall) { const [jx, jy] = PINS[j]; if (jy > y && Math.hypot(jx - x, jy - y) < 9.5 && G.r() < chance) { fall.add(i); grew = true; break } }
      })
    }
    G.anim = { t: performance.now(), dx, dy, fall }
  }
  function settle() {
    const { fall } = G.anim
    G.anim = null
    const n = fall.size
    fall.forEach((i) => { G.up[i] = false })
    G.score += n
    const left = G.up.filter(Boolean).length
    if (n) ctx.sfx.thud()
    if (left === 0) { banner(S.box, G.roll === 1 ? "STRIKE!" : "SPARE!", { kind: "good", ms: 1300 }); ctx.sfx.fanfare() } else popText(S.box, `${n} 🗿`, 50, 30, n ? "" : "bad")
    R.set(G.score, G.frame === 3 && (G.roll === 2 || left === 0))
    if (G.roll === 1 && left > 0) G.roll = 2
    else { G.frame++; G.roll = 1; G.up = PINS.map(() => true) }
    G.stage = G.frame > 3 ? "done" : "aim"; G.t0 = performance.now()
    btn.firstChild.textContent = G.stage === "done" ? ctx.L("Selesai ✓", "Done ✓") : ctx.L("KUNCI ARAH", "LOCK AIM")
    drawPins()
    drawQ()
  }
  function drawQ() {
    S.q.replaceChildren(ctx.L(`Frame ${Math.min(3, G.frame)}/3 · lemparan ${G.roll} · 🗿 ${G.score}`, `Frame ${Math.min(3, G.frame)}/3 · roll ${G.roll} · 🗿 ${G.score}`),
      el("small", { text: ctx.L("Ketuk untuk kunci arah, ketuk lagi untuk kunci tenaga", "Tap to lock the aim, tap again to lock the power") }))
  }
  const stop = loop(ctx, () => {
    if (!G) return
    const t = (performance.now() - G.t0) / 1000
    if (G.anim) {
      const p = Math.min(1, (performance.now() - G.anim.t) / 1100)
      ballG.setAttribute("transform", `translate(${(30 + G.anim.dx * p * 100).toFixed(2)} ${(108 + G.anim.dy * p * 100).toFixed(2)})`)
      if (p >= 1) settle()
    } else ballG.setAttribute("transform", "translate(30 108)")
    const ang = G.stage === "aim" ? Math.sin(t * 3.4) * 11 : G.aim
    arrow.setAttribute("transform", `translate(30 108) rotate(${ang.toFixed(1)})`)
    arrow.setAttribute("opacity", G.stage === "aim" || G.stage === "power" ? 1 : 0)
    const pw = G.stage === "power" ? Math.abs(Math.sin(t * 2.6)) : G.stage === "aim" ? 0 : G.pow
    mfill.setAttribute("height", (pw * 40).toFixed(2)); mfill.setAttribute("y", (-pw * 40).toFixed(2))
    btn.disabled = !V || V.phase !== "play" || !!G.anim || G.stage === "done"
  })
  return {
    destroy: stop,
    scores: (v) => v.scores,
    update(v, events) {
      V = v
      S.update(v, events)
      if (v.phase === "play" && key !== `${v.round}:${v.seed}`) { key = `${v.round}:${v.seed}`; newGame(v.seed); R.reset() }
      if (!G) newGame(4)
      drawQ()
    },
  }
}
