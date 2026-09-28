// Noggin Knock: things pop out of the holes — bonk coins (+1), red coins (+3); leave the Bob-ombs and Boos alone!
import { el, svg } from "../lib.js?v=__VERSION__"
import { bobomb, coin, hammer, loop, popText, reporter, rng, soloFrame } from "./mp.js?v=__VERSION__"

const HOLES = [[18, 64], [50, 66], [82, 64], [30, 44], [70, 44], [18, 26], [50, 24], [82, 26]]
const THINGS = [{ k: "coin", w: 6 }, { k: "red", w: 1.4 }, { k: "bomb", w: 2 }, { k: "boo", w: 1.6 }]

export function mount(stage, ctx) {
  const S = soloFrame(stage, ctx, { bg: "linear-gradient(#8fdc6a,#4fa84a)", scoreLabel: "🪙" })
  const R = reporter(ctx)
  const g = svg("svg", { viewBox: "0 0 100 80" })
  S.box.append(g)
  const H = HOLES.map(([x, y], i) => {
    const pop = svg("g")
    const clip = svg("clipPath", { id: `nk${i}` }, svg("rect", { x: x - 12, y: y - 22, width: 24, height: 22 }))
    const grp = svg("g", { class: "mp-tap" }, clip, svg("ellipse", { cx: x, cy: y, rx: 9, ry: 3.6, fill: "#3a2a14" }), svg("g", { "clip-path": `url(#nk${i})` }, pop),
      svg("path", { d: `M${x - 9} ${y} A 9 3.6 0 0 0 ${x + 9} ${y}`, fill: "none", stroke: "#6b4a22", "stroke-width": 1 }), svg("rect", { x: x - 12, y: y - 20, width: 24, height: 24, fill: "transparent" }))
    grp.addEventListener("pointerdown", () => tap(i))
    g.append(grp)
    return { x, y, pop, sig: "" }
  })
  const ham = svg("g", { opacity: 0 }, svg("g", { transform: "rotate(180) scale(.6)" }, hammer("#e5484d")))
  g.append(ham)
  let V = null, key = "", G = null, hamT = 0, hamXY = [50, 40]

  function newGame(seed, t0) {
    const r = rng(seed)
    const total = THINGS.reduce((a, b) => a + b.w, 0)
    const plan = []
    let t = 0.3
    while (t < 40) {
      let x = r() * total, kind = "coin"
      for (const th of THINGS) { x -= th.w; if (x <= 0) { kind = th.k; break } }
      plan.push({ t, i: Math.floor(r() * 8), kind, up: 0.75 + r() * 0.5 - Math.min(0.3, t * 0.006) })
      t += 0.32 + r() * 0.5
    }
    G = { plan, t0, score: 0, hit: new Set(), stun: 0 }
  }
  const upAt = (p, t) => { const a = t - p.t; if (a < 0 || a > p.up) return null; const k = a / p.up; return k < 0.2 ? k / 0.2 : k > 0.8 ? (1 - k) / 0.2 : 1 }
  function tap(i) {
    if (!V || V.phase !== "play" || !G || performance.now() < G.stun) return
    const t = ctx.now() - G.t0
    hamT = performance.now(); hamXY = HOLES[i]
    const k = G.plan.findIndex((p, j) => p.i === i && !G.hit.has(j) && upAt(p, t) > 0.35)
    ctx.sfx.thud()
    if (k < 0) return
    G.hit.add(k)
    const p = G.plan[k]
    const [x, y] = HOLES[i]
    const at = ((y - 14) / 80) * 100
    if (p.kind === "coin") { G.score += 1; ctx.sfx.coin(); popText(S.box, "+1", x, at) }
    if (p.kind === "red") { G.score += 3; ctx.sfx.ding(); popText(S.box, "+3", x, at) }
    if (p.kind === "bomb") { G.score = Math.max(0, G.score - 3); G.stun = performance.now() + 1100; ctx.sfx.boom(); popText(S.box, "💥 −3", x, at, "bad"); S.box.classList.remove("mp-shake"); void S.box.offsetWidth; S.box.classList.add("mp-shake") }
    if (p.kind === "boo") { G.score = Math.max(0, G.score - 2); ctx.sfx.wrong(); popText(S.box, "👻 −2", x, at, "bad") }
    R.set(G.score)
  }
  function thing(kind) {
    if (kind === "coin") return svg("g", { transform: "translate(0 -8)" }, coin(5))
    if (kind === "red") return svg("g", { transform: "translate(0 -8)" }, svg("circle", { r: 5.2, fill: "#e5484d", stroke: "#8a1c1c", "stroke-width": 0.8 }), svg("ellipse", { rx: 1.6, ry: 3, fill: "#ffb3b3" }))
    if (kind === "bomb") return svg("g", { transform: "translate(0 -7)" }, bobomb(5))
    return svg("g", { transform: "translate(0 -8)" }, svg("path", { d: "M-6 4 Q -7 -6 0 -7 Q 7 -6 6 4 L 4 2 L 2 4 L 0 2 L -2 4 L -4 2 Z", fill: "#fff", stroke: "#999", "stroke-width": 0.5 }),
      svg("circle", { cx: -2.2, cy: -2, r: 0.9, fill: "#222" }), svg("circle", { cx: 2.2, cy: -2, r: 0.9, fill: "#222" }), svg("path", { d: "M-2 1 Q 0 3 2 1", fill: "#e5484d" }))
  }
  const stop = loop(ctx, (now) => {
    if (!G || !V) return
    const t = V.phase === "play" ? now - G.t0 : -1
    H.forEach((h, i) => {
      let cur = null
      G.plan.forEach((p, j) => { if (p.i === i && !G.hit.has(j)) { const u = upAt(p, t); if (u !== null) cur = [p.kind, u] } })
      const sig = cur ? cur[0] : ""
      if (sig !== h.sig) { h.sig = sig; h.pop.replaceChildren(cur ? thing(cur[0]) : "") }
      if (cur) h.pop.setAttribute("transform", `translate(${h.x} ${(h.y + 12 - cur[1] * 12).toFixed(2)})`)
    })
    const ht = (performance.now() - hamT) / 180
    ham.setAttribute("opacity", ht < 1 ? 1 : 0)
    if (ht < 1) ham.setAttribute("transform", `translate(${hamXY[0] + 6} ${hamXY[1] - 12 + Math.sin(ht * Math.PI) * 4}) rotate(${-30 + ht * 30})`)
  })
  return {
    destroy: stop,
    scores: (v) => v.scores,
    update(v, events) {
      V = v
      S.update(v, events)
      if (v.phase === "play" && key !== `${v.round}:${v.seed}`) { key = `${v.round}:${v.seed}`; newGame(v.seed, v.t0); R.reset() }
      if (!G) newGame(9, 1e9)
      S.q.replaceChildren(ctx.L("Pukul 🪙 (+1) dan 🔴 (+3)!", "Bonk 🪙 (+1) and 🔴 (+3)!"), el("small", { text: ctx.L("Jangan pukul 💣 (−3 & pusing) atau 👻 (−2)", "Don't hit 💣 (−3 & dizzy) or 👻 (−2)") }))
    },
  }
}
