// Sunset Standoff: one player steers the Bomber Bill down the runway; everyone else dodges left and right.
// Everyone gets a turn as the pilot (3 runs each). Hit = +2 for the pilot, dodge = +1.
import { el, svg } from "../lib.js?v=__VERSION__"
import { banner, joystick, kit, loop, popText, smoother } from "./mp.js?v=__VERSION__"

export function mount(stage, ctx) {
  const K = kit(stage, ctx)
  const box = el("div", { class: "mp", style: { background: "linear-gradient(#ff8a5b 0%, #ffcf6b 45%, #c98a4a 46%, #8a5a2b 100%)" } })
  const q = el("div", { class: "mp-q" })
  const ctrl = el("div", { class: "mp-ctrl" })
  stage.append(box, q, ctrl)
  const g = svg("svg", { viewBox: "0 0 100 100" })
  box.append(g)
  g.append(svg("circle", { cx: 50, cy: 38, r: 14, fill: "#fff1a8", opacity: 0.9 }), svg("path", { d: "M20 46 L 80 46 L 100 100 L 0 100 Z", fill: "#6b6f78" }))
  for (let i = 0; i < 6; i++) g.append(svg("rect", { x: 49, y: 50 + i * 8.5, width: 2, height: 4 + i, fill: "#fff" }))
  const bill = svg("g", {}, svg("ellipse", { cx: 0, cy: 3, rx: 7, ry: 2, fill: "rgba(0,0,0,.25)" }), svg("path", { d: "M-6 -6 L 6 -6 L 6 2 Q 0 9 -6 2 Z", fill: "#222" }),
    svg("circle", { cx: -2.4, cy: -1, r: 1.4, fill: "#fff" }), svg("circle", { cx: 2.4, cy: -1, r: 1.4, fill: "#fff" }), svg("text", { class: "pilot", y: -8, "text-anchor": "middle", "font-size": 5 }))
  const peopleG = svg("g")
  g.append(peopleG, bill)
  const J = joystick(ctrl, (a, m) => ctx.send({ a, m }), { axis: "x" })
  let V = null, P = new Map()
  const sm = smoother(0.45)
  const X = (x, y) => 50 + (x - 5) * (6 + y * 0.047)  // runway perspective

  const stop = loop(ctx, (now) => {
    if (!V) return
    const pilot = V.pilot
    const by = V.phase === "play" ? Math.min(1, (now - V.t0) / 2.6) : V.phase === "boom" ? 1 : 0
    const yB = 46 + by * 42
    const [bx] = sm("bill", X((V.x || {})[pilot] ?? 5, yB), 0)
    bill.setAttribute("transform", `translate(${bx.toFixed(2)} ${yB.toFixed(2)}) scale(${(0.5 + by * 0.9).toFixed(2)})`)
    bill.querySelector(".pilot").textContent = ctx.player(pilot).avatar
    for (const p of ctx.seats()) {
      if (p.id === pilot) { P.get(p.id)?.setAttribute("opacity", 0); continue }
      let node = P.get(p.id)
      if (!node) { node = svg("g", {}, svg("circle", { r: 4.4, fill: p.color, stroke: p.id === ctx.me.id ? "#ffd400" : "#fff", "stroke-width": 0.9 }), svg("text", { "text-anchor": "middle", "dominant-baseline": "central", "font-size": 5.4, text: p.avatar })); peopleG.append(node); P.set(p.id, node) }
      const [x] = sm(p.id, X((V.x || {})[p.id] ?? 5, 88), 0)
      const hit = V.phase === "boom" && (V.hits || []).includes(p.id)
      node.setAttribute("opacity", 1)
      node.setAttribute("transform", `translate(${x.toFixed(2)} ${hit ? 80 : 90}) rotate(${hit ? Math.sin(now * 20) * 30 : 0})`)
    }
  })
  return {
    destroy() { stop(); J.destroy() },
    scores: (v) => v.scores,
    update(v, events) {
      V = v
      K.update(v, events, box)
      const me = ctx.me.id
      const pp = ctx.player(v.pilot)
      q.replaceChildren(v.pilot === me ? ctx.L("KAMU PILOT! Arahkan Bullet Bill ke mereka 🚀", "YOU'RE THE PILOT! Steer the Bill into them 🚀") : ctx.L(`${pp.avatar} ${pp.name} menyetir Bullet Bill — HINDARI! ↔️`, `${pp.avatar} ${pp.name} is steering the Bill — DODGE! ↔️`),
        el("small", { text: ctx.L("Geser joystick kiri/kanan · kena = +2 pilot, lolos = +1", "Slide the joystick left/right · hit = +2 pilot, dodge = +1") }))
      for (const e of events) {
        if (e.e === "round") { ctx.sfx.pop(); if (e.pilot === me) banner(box, ctx.L("PILOT!", "PILOT!"), { kind: "good", ms: 1100 }) }
        if (e.e === "launch") ctx.sfx.whoosh()
        if (e.e === "boom") { ctx.sfx.boom(); if ((e.hits || []).includes(me)) popText(box, ctx.L("KENA!", "HIT!"), 50, 70, "bad"); else if (v.pilot !== me) popText(box, ctx.L("LOLOS!", "DODGED!"), 50, 70); else if (e.hits.length) popText(box, `+${e.hits.length * 2}`, 50, 60) }
      }
    },
  }
}
