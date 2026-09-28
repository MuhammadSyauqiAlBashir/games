// Gold 'n Brown: pastries rise in the oven. Tap each one the moment it turns golden brown — not before, not burnt!
import { el, svg } from "../lib.js?v=__VERSION__"
import { loop, popText, reporter, rng, soloFrame } from "./mp.js?v=__VERSION__"

const POS = [[20, 30], [40, 30], [60, 30], [80, 30], [30, 55], [50, 55], [70, 55]]
const RISE = 1.5, GOLD = 0.85, BURN = 0.9

export function mount(stage, ctx) {
  const S = soloFrame(stage, ctx, { bg: "radial-gradient(circle at 50% 60%, #ff9a3c, #7a2e10)", scoreLabel: "🪙" })
  const R = reporter(ctx)
  const g = svg("svg", { viewBox: "0 0 100 76" })
  S.box.append(g)
  g.append(svg("path", { d: "M6 72 L6 20 Q 50 -6 94 20 L 94 72 Z", fill: "#3a1a0c", stroke: "#1e0c05", "stroke-width": 1.2 }))
  const tiles = POS.map(([x, y], i) => {
    const grp = svg("g", { transform: `translate(${x} ${y})`, class: "mp-tap" }, svg("ellipse", { rx: 9, ry: 5, fill: "#5b2a12", stroke: "#8a4a22", "stroke-width": 0.6 }))
    const pastry = svg("g")
    grp.append(pastry, svg("ellipse", { rx: 10, ry: 9, fill: "transparent" }))
    grp.addEventListener("pointerdown", () => tap(i))
    g.append(grp)
    return { pastry, cur: null }
  })
  let V = null, key = "", G = null

  function newGame(seed, t0) {
    const r = rng(seed)
    const plan = []
    let t = 0.4
    while (t < 44) { plan.push({ t, i: Math.floor(r() * 7), red: r() < 0.12 }); t += Math.max(0.35, 1.05 - t * 0.012) * (0.6 + r() * 0.8) }
    G = { plan, t0, score: 0, state: {}, taken: new Set() }
  }
  const stageOf = (p, t) => { const a = t - p.t; return a < 0 ? null : a < RISE ? "rise" : a < RISE + GOLD ? "gold" : a < RISE + GOLD + BURN ? "burnt" : null }
  function tap(i) {
    if (!V || V.phase !== "play" || !G) return
    const t = ctx.now() - G.t0
    const p = G.plan.find((q, k) => q.i === i && !G.taken.has(k) && stageOf(q, t))
    if (!p) return
    const k = G.plan.indexOf(p)
    const st = stageOf(p, t)
    G.taken.add(k)
    const [x, y] = POS[i]
    if (st === "gold") { const v = p.red ? 3 : 1; G.score += v; ctx.sfx.coin(); popText(S.box, `+${v}`, x, (y / 76) * 100) }
    else if (st === "rise") { ctx.sfx.boop(); popText(S.box, ctx.L("Mentah!", "Raw!"), x, (y / 76) * 100, "bad") }
    else { ctx.sfx.wrong(); popText(S.box, ctx.L("Gosong!", "Burnt!"), x, (y / 76) * 100, "bad") }
    R.set(G.score)
  }
  function pastryNode(st, a, red) {
    const col = st === "rise" ? "#f3e2c0" : st === "gold" ? (red ? "#e8733a" : "#e3a53a") : "#3a2a20"
    const sc = st === "rise" ? 0.5 + (a / RISE) * 0.5 : 1
    return svg("g", { transform: `scale(${sc.toFixed(2)})` },
      svg("path", { d: "M-8 2 Q -9 -6 0 -7 Q 9 -6 8 2 Q 0 5 -8 2 Z", fill: col, stroke: "rgba(0,0,0,.25)", "stroke-width": 0.5 }),
      svg("path", { d: "M-4 -4 Q 0 -2 4 -4 M-5 -1 Q 0 1 5 -1", stroke: "rgba(255,255,255,.35)", "stroke-width": 0.6, fill: "none" }),
      st === "gold" ? svg("text", { y: -9, "text-anchor": "middle", "font-size": 4, text: "✨" }) : st === "burnt" ? svg("text", { y: -9, "text-anchor": "middle", "font-size": 4, text: "💨" }) : null)
  }
  const stop = loop(ctx, (now) => {
    if (!G || !V) return
    const t = V.phase === "play" ? now - G.t0 : -1
    tiles.forEach((tile, i) => {
      let best = null
      G.plan.forEach((p, k) => { if (p.i === i && !G.taken.has(k)) { const st = stageOf(p, t); if (st) best = [st, t - p.t, p.red] } })
      const sig = best ? `${best[0]}:${best[0] === "rise" ? Math.round(best[1] * 10) : ""}:${best[2]}` : ""
      if (tile.cur !== sig) { tile.cur = sig; tile.pastry.replaceChildren(best ? pastryNode(best[0], best[1], best[2]) : "") }
    })
  })
  return {
    destroy: stop,
    scores: (v) => v.scores,
    update(v, events) {
      V = v
      S.update(v, events)
      if (v.phase === "play" && key !== `${v.round}:${v.seed}`) { key = `${v.round}:${v.seed}`; newGame(v.seed, v.t0); R.reset() }
      if (!G) newGame(5, 1e9)
      S.q.replaceChildren(ctx.L("Ketuk roti saat KEEMASAN ✨ — jangan mentah, jangan gosong!", "Tap each pastry when it's GOLDEN ✨ — not raw, not burnt!"), el("small", { text: ctx.L("Roti merah = 3 koin", "Red pastry = 3 coins") }))
    },
  }
}
