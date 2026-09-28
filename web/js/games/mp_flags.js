// Snag the Flags: run around and touch the white flags to claim them. Most flags wins!
import { el, svg } from "../lib.js?v=__VERSION__"
import { joystick, kit, loop, smoother } from "./mp.js?v=__VERSION__"

export function mount(stage, ctx) {
  const K = kit(stage, ctx, { scoreLabel: "🚩" })
  const box = el("div", { class: "mp", style: { background: "radial-gradient(circle, #3a4a8a, #0e1433)" } })
  const q = el("div", { class: "mp-q" })
  const ctrl = el("div", { class: "mp-ctrl" })
  stage.append(box, q, ctrl)
  const g = svg("svg", { viewBox: "0 0 100 100" })
  box.append(g)
  g.append(svg("circle", { cx: 50, cy: 50, r: 49, fill: "#8a93a6", stroke: "#4a5268", "stroke-width": 1 }), svg("circle", { cx: 38, cy: 36, r: 30, fill: "rgba(255,255,255,.08)" }))
  const flagsG = svg("g"), peopleG = svg("g")
  g.append(flagsG, peopleG)
  const J = joystick(ctrl, (a, m) => ctx.send({ a, m }))
  let V = null, F = [], P = new Map(), key = ""
  const sm = smoother(0.4)

  const stop = loop(ctx, () => {
    if (!V) return
    const k = 100 / (V.n || 20)
    for (const p of ctx.seats()) {
      const pos = (V.pos || {})[p.id]
      if (!pos) continue
      let node = P.get(p.id)
      if (!node) { node = svg("g", {}, svg("circle", { r: 3.6, fill: p.color, stroke: p.id === ctx.me.id ? "#ffd400" : "#fff", "stroke-width": 0.8 }), svg("text", { "text-anchor": "middle", "dominant-baseline": "central", "font-size": 4.4, text: p.avatar })); peopleG.append(node); P.set(p.id, node) }
      const [x, y] = sm(p.id, pos[0] * k, pos[1] * k)
      node.setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)})`)
    }
  })
  return {
    destroy() { stop(); J.destroy() },
    scores: (v) => v.scores,
    update(v, events) {
      V = v
      K.update(v, events, box)
      const k = 100 / (v.n || 20)
      if (v.flags && key !== JSON.stringify(v.flags[0])) {
        key = JSON.stringify(v.flags[0])
        F = v.flags.map(([x, y]) => { const f = svg("g", { transform: `translate(${x * k} ${y * k})` }, svg("line", { x1: 0, y1: 2, x2: 0, y2: -4, stroke: "#333", "stroke-width": 0.5 }), svg("path", { class: "fl", d: "M0 -4 L 4 -2.6 L 0 -1.2 Z", fill: "#fff" })); flagsG.append(f); return f })
      }
      F.forEach((f, i) => { const o = (v.owner || {})[String(i)]; f.querySelector(".fl").setAttribute("fill", o ? ctx.color(o) : "#fff") })
      const left = (v.flags || []).length - Object.keys(v.owner || {}).length
      q.replaceChildren(ctx.L(`Sentuh bendera putih! Sisa: ${left}`, `Touch the white flags! Left: ${left}`), el("small", { text: ctx.L("Gerakkan dengan joystick", "Move with the joystick") }))
      for (const e of events) if (e.e === "snag" && e.who === ctx.me.id) ctx.sfx.coin()
    },
  }
}
