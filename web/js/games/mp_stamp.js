// Stamp Out!: bounce around on your stamp and cover the pad in your colour — you can stamp over the others!
// Most squares when time's up wins.
import { el, svg } from "../lib.js?v=__VERSION__"
import { joystick, kit, loop, smoother } from "./mp.js?v=__VERSION__"

export function mount(stage, ctx) {
  const K = kit(stage, ctx, { scoreLabel: "▦" })
  const box = el("div", { class: "mp", style: { background: "#fff8e8" } })
  const q = el("div", { class: "mp-q" })
  const ctrl = el("div", { class: "mp-ctrl" })
  stage.append(box, q, ctrl)
  const g = svg("svg", { viewBox: "0 0 100 100" })
  box.append(g)
  const gridG = svg("g"), peopleG = svg("g")
  g.append(gridG, peopleG)
  const J = joystick(ctrl, (a, m) => ctx.send({ a, m }))
  let V = null, n = 0, cells = [], P = new Map(), lastGrid = ""
  const sm = smoother(0.4)

  function build(N) {
    n = N
    const s = 100 / N
    gridG.replaceChildren()
    cells = []
    for (let i = 0; i < N * N; i++) { const r = svg("rect", { x: (i % N) * s, y: Math.floor(i / N) * s, width: s + 0.05, height: s + 0.05, fill: "#fff8e8" }); gridG.append(r); cells.push(r) }
  }
  const color = {}
  const stop = loop(ctx, (now) => {
    if (!V || !n) return
    const s = 100 / n
    for (const p of ctx.seats()) {
      const pos = (V.pos || {})[p.id]
      if (!pos) continue
      let node = P.get(p.id)
      if (!node) { node = svg("g", {}, svg("ellipse", { class: "sh", rx: 3.4, ry: 1.3, fill: "rgba(0,0,0,.2)" }), svg("g", { class: "b" }, svg("rect", { x: -3.6, y: -3.6, width: 7.2, height: 7.2, rx: 1.6, fill: p.color, stroke: p.id === ctx.me.id ? "#ffd400" : "#fff", "stroke-width": 0.8 }), svg("text", { "text-anchor": "middle", "dominant-baseline": "central", "font-size": 4.6, text: p.avatar }))); peopleG.append(node); P.set(p.id, node) }
      const [x, y] = sm(p.id, pos[0] * s, pos[1] * s)
      const hop = Math.abs(Math.sin(((now % (V.hop || 0.42)) / (V.hop || 0.42)) * Math.PI)) * 3
      node.setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)})`)
      node.querySelector(".b").setAttribute("transform", `translate(0 ${(-hop).toFixed(2)})`)
    }
  })
  return {
    destroy() { stop(); J.destroy() },
    scores: (v) => v.scores,
    update(v, events) {
      V = v
      K.update(v, events, box)
      if (v.n && v.n !== n) build(v.n)
      for (const p of ctx.seats()) color[(v.idx || {})[p.id]] = p.color
      if (v.grid && v.grid !== lastGrid) {
        for (let i = 0; i < v.grid.length; i++) if (v.grid[i] !== lastGrid[i]) cells[i].setAttribute("fill", v.grid[i] === "." ? "#fff8e8" : color[v.grid[i]] || "#999")
        lastGrid = v.grid
      }
      q.replaceChildren(ctx.L("Gerakkan joystick — cap sebanyak mungkin kotak dengan warnamu!", "Move with the joystick — stamp as many squares as you can in your colour!"), el("small", { text: ctx.L("Boleh menimpa warna lawan 😈", "You can stamp over the others 😈") }))
    },
  }
}
