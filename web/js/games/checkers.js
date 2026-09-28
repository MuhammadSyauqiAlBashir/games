// International checkers 10×10: tap a piece, then its destination (multi-captures are one tap).
import { el, svg } from "../lib.js?v=__VERSION__"
import { status } from "./common.js?v=__VERSION__"

export function mount(stage, ctx) {
  const st = el("div", { class: "status-line" })
  const wrap = el("div", { class: "board-wrap wood", style: { padding: "10px" } })
  stage.append(st, wrap)
  let sel = null, V = null
  function draw() {
    const v = V
    const mine = v.turn === ctx.me.id && !v.over
    const myColor = v.color[ctx.me.id]
    const flip = myColor === "b"
    const moves = mine ? v.moves || [] : []
    const froms = new Set(moves.map((m) => m.path[0]))
    const targets = sel !== null ? moves.filter((m) => m.path[0] === sel) : []
    const tset = new Map(targets.map((m) => [m.path[m.path.length - 1], m]))
    const g = svg("svg", { viewBox: "0 0 100 100" })
    const pos = (i) => { let r = Math.floor(i / 10), c = i % 10; if (flip) { r = 9 - r; c = 9 - c } return [c * 10, r * 10] }
    for (let i = 0; i < 100; i++) {
      const [x, y] = pos(i)
      const dark = (Math.floor(i / 10) + i % 10) % 2 === 1
      const last = (v.last || []).includes(i)
      g.append(svg("rect", { x, y, width: 10, height: 10, fill: dark ? (last ? "#8c5a33" : "#6d4527") : "#e8d2b0",
        onclick: () => { if (tset.has(i)) { ctx.send({ path: tset.get(i).path }); sel = null } } }))
      if (tset.has(i)) g.append(svg("circle", { cx: x + 5, cy: y + 5, r: 2, fill: "#f2c94c", opacity: .9, "pointer-events": "none" }))
    }
    v.board.forEach((p, i) => {
      if (!p) return
      const [x, y] = pos(i)
      const white = p.toLowerCase() === "w"
      const can = froms.has(i)
      const grp = svg("g", { style: can ? "cursor:pointer" : "", onclick: () => { if (can) { sel = sel === i ? null : i; ctx.sfx.click(); draw() } } },
        svg("circle", { cx: x + 5, cy: y + 5.6, r: 4, fill: "rgba(0,0,0,.35)" }),
        svg("circle", { cx: x + 5, cy: y + 5, r: 4, fill: white ? "#f7efe2" : "#2b2622", stroke: sel === i ? "#f2c94c" : can ? "#e3a93b" : white ? "#cdbfa8" : "#000",
          "stroke-width": sel === i ? 1 : can ? .7 : .4 }),
        svg("circle", { cx: x + 5, cy: y + 5, r: 2.6, fill: "none", stroke: white ? "#d8c9b0" : "#4a4038", "stroke-width": .4 }),
        p === p.toUpperCase() ? svg("text", { x: x + 5, y: y + 6.7, "text-anchor": "middle", "font-size": 4.4, "pointer-events": "none", text: "👑" }) : null)
      g.append(grp)
    })
    wrap.replaceChildren(g)
    status(ctx, st, v, { mine: ctx.L(`Giliranmu (${myColor === "w" ? "putih" : "hitam"})${moves.some((m) => m.caps.length) ? " — wajib makan!" : ""}`,
      `Your turn (${myColor === "w" ? "white" : "black"})${moves.some((m) => m.caps.length) ? " — you must capture!" : ""}`) })
  }
  return {
    update(v, events) {
      V = v
      sel = null
      for (const e of events) if (e.e === "move") { if (e.caps.length) ctx.sfx.capture(); else ctx.sfx.place(); if (e.king) ctx.sfx.coin() }
      draw()
    },
  }
}
