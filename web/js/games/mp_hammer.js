// Hammer It Home: your hammer charges up by itself. Swing when it's strong enough for the nail — high nails need
// more power. A weak swing only knocks it part way. First to hammer in 12 nails wins.
import { el, svg } from "../lib.js?v=__VERSION__"
import { banner, clamp, hammer, loop, motionOK, onShake, popText, reporter, rng, soloFrame } from "./mp.js?v=__VERSION__"

const NAILS = 12, CHARGE = 1.5

export function mount(stage, ctx) {
  const S = soloFrame(stage, ctx, { bg: "linear-gradient(#ffe3a8,#e9b264)", max: 12 })
  const R = reporter(ctx)
  const g = svg("svg", { viewBox: "0 0 100 70" })
  S.box.append(g)
  g.append(svg("rect", { x: 10, y: 8, width: 80, height: 56, rx: 2, fill: "#c98a4a", stroke: "#7a4a22", "stroke-width": 1 }))
  for (let i = 1; i < 6; i++) g.append(svg("line", { x1: 10, y1: 8 + i * 9.3, x2: 90, y2: 8 + i * 9.3, stroke: "rgba(0,0,0,.12)", "stroke-width": 0.5 }))
  const nailG = svg("g"), hamG = svg("g", {}, svg("g", { transform: "rotate(-90) scale(.8)" }, hammer("#6b7385")))
  const meter = svg("g", { transform: "translate(95 10)" })
  const fill = svg("rect", { x: -2.5, y: 0, width: 5, height: 0, rx: 1, fill: "#3fd07a" })
  const need = svg("line", { x1: -4, x2: 4, stroke: "#e5484d", "stroke-width": 0.9 })
  meter.append(svg("rect", { x: -2.5, y: 0, width: 5, height: 50, rx: 1.5, fill: "rgba(0,0,0,.2)" }), fill, need)
  g.append(nailG, hamG, meter)
  const swingBtn = el("button", { class: "mp-btn huge red", type: "button", onpointerdown: (e) => { e.preventDefault(); swing() } }, el("span", { text: ctx.L("🔨 PUKUL!", "🔨 SWING!") }))
  const sensorBtn = el("button", { class: "mp-btn green", type: "button", onclick: async () => { if (await motionOK()) { sensorBtn.hidden = true; off = onShake(() => swing(), 17) } } }, el("span", { class: "em", text: "📳" }), el("span", { class: "lab", text: ctx.L("Ayun HP", "Swing phone") }))
  S.ctrl.append(swingBtn, sensorBtn)
  let V = null, key = "", G = null, off = null, swingT = 0

  function newGame(seed) {
    const r = rng(seed)
    G = { nails: Array.from({ length: NAILS }, (_, i) => ({ h: i < 2 ? 0 : Math.floor(r() * 3) })), i: 0, depth: 0, charge0: performance.now(), done: false }
  }
  const needOf = (h) => [0.35, 0.62, 0.88][h]
  const power = () => clamp((performance.now() - G.charge0) / (CHARGE * 1000))
  function swing() {
    if (!G || !V || V.phase !== "play" || G.done || performance.now() - swingT < 250) return
    swingT = performance.now()
    const p = power(), n = G.nails[G.i]
    const k = p / needOf(n.h)
    G.depth = Math.min(1, G.depth + k)
    G.charge0 = performance.now()
    ctx.sfx.thud()
    if (G.depth >= 1) {
      G.i++; G.depth = 0; ctx.sfx.ding()
      popText(S.box, k >= 1 && k < 1.25 ? ctx.L("PAS!", "PERFECT!") : "✓", 45, 40)
      if (G.i >= NAILS) { G.done = true; R.set(NAILS, true); ctx.sfx.fanfare(); banner(S.box, ctx.L("SELESAI!", "DONE!"), { kind: "good" }) }
      else R.set(G.i)
    } else popText(S.box, ctx.L("Kurang kuat…", "Too weak…"), 45, 40, "bad")
  }
  const stop = loop(ctx, () => {
    if (!G) return
    const n = G.nails[Math.min(G.i, NAILS - 1)]
    const y = [54, 36, 18][n.h]
    const p = V && V.phase === "play" ? power() : 0
    fill.setAttribute("height", (p * 50).toFixed(2)); fill.setAttribute("y", (50 - p * 50).toFixed(2))
    fill.setAttribute("fill", p >= needOf(n.h) ? "#3fd07a" : "#f0a030")
    need.setAttribute("y1", 50 - needOf(n.h) * 50); need.setAttribute("y2", 50 - needOf(n.h) * 50)
    nailG.replaceChildren(svg("rect", { x: 49, y: y - 1.5, width: 2, height: 3, fill: "#555" }),
      svg("rect", { x: 50 + 2 - G.depth * 0, y: y - 0.7, width: 12 * (1 - G.depth) + 1, height: 1.4, fill: "#b8bec9" }),
      svg("rect", { x: 50 + 12 * (1 - G.depth) + 2, y: y - 2.4, width: 1.4, height: 4.8, fill: "#8a909c" }),
      svg("text", { x: 20, y: 62, "font-size": 5, "font-weight": 900, fill: "#5b3212", text: `${G.i}/${NAILS}` }))
    const sw = (performance.now() - swingT) / 200
    hamG.setAttribute("transform", `translate(${50 + 12 * (1 - G.depth) + 12} ${y}) rotate(${sw < 1 ? -40 + sw * 40 : -40 + p * 10})`)
  })
  return {
    destroy() { stop(); off && off() },
    scores: (v) => v.scores,
    update(v, events) {
      V = v
      S.update(v, events)
      if (v.phase === "play" && key !== `${v.round}:${v.seed}`) { key = `${v.round}:${v.seed}`; newGame(v.seed); R.reset() }
      if (!G) newGame(2)
      S.q.replaceChildren(ctx.L("Tunggu meteran HIJAU, lalu PUKUL!", "Wait for the meter to turn GREEN, then SWING!"), el("small", { text: ctx.L("Paku lebih tinggi butuh tenaga lebih. Garis merah = tenaga yang dibutuhkan.", "Higher nails need more power. The red line = power needed.") }))
    },
  }
}
