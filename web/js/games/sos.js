// SOS: tap a square, pick S or O. Completed SOS lines are drawn in the player's colour.
import { el, svg } from "../lib.js?v=__VERSION__"
import { status } from "./common.js?v=__VERSION__"

export function mount(stage, ctx) {
  const st = el("div", { class: "status-line" })
  const wrap = el("div", { class: "board-wrap wood", style: { padding: "10px" } })
  const pick = el("div", { class: "action-bar" })
  stage.append(st, wrap, pick)
  let sel = null
  let V = null
  function draw() {
    const v = V
    const n = v.n
    const mine = v.turn === ctx.me.id && !v.over
    const size = 100 / n
    const g = svg("svg", { viewBox: "0 0 100 100" })
    for (let i = 0; i < n * n; i++) {
      const r = Math.floor(i / n), c = i % n
      const val = v.grid[i]
      g.append(svg("rect", { x: c * size + .6, y: r * size + .6, width: size - 1.2, height: size - 1.2, rx: size * .18,
        fill: sel === i ? "#fff3c4" : val ? "#fffaf0" : "rgba(255,250,240,.72)", stroke: v.last === i ? "#e07a5f" : "none", "stroke-width": .8,
        style: mine && !val ? "cursor:pointer" : "", onclick: () => { if (mine && !val) { sel = i; ctx.sfx.click(); draw() } } }))
      if (val) g.append(svg("text", { x: c * size + size / 2, y: r * size + size * .68, "text-anchor": "middle", "font-size": size * .55, "font-weight": 900,
        fill: val === "S" ? "#c9503f" : "#3d6f9e", "font-family": "Nunito, sans-serif", "pointer-events": "none", text: val }))
    }
    for (const [r1, c1, r2, c2, pid] of v.lines) {
      g.append(svg("line", { x1: c1 * size + size / 2, y1: r1 * size + size / 2, x2: c2 * size + size / 2, y2: r2 * size + size / 2,
        stroke: ctx.color(pid), "stroke-width": size * .16, "stroke-linecap": "round", opacity: .65, "pointer-events": "none" }))
    }
    wrap.replaceChildren(g)
    pick.replaceChildren()
    if (mine && sel !== null) {
      for (const l of ["S", "O"]) pick.append(el("button", { class: "btn big primary", type: "button", style: { minWidth: "90px", fontSize: "26px" }, text: l,
        onclick: () => { ctx.send({ i: sel, l }); sel = null } }))
    } else if (mine) pick.append(el("span", { class: "muted", text: ctx.L("Pilih kotak kosong", "Tap an empty square") }))
    status(ctx, st, v, { mine: ctx.L("Giliranmu — bikin SOS!", "Your turn — make an SOS!") })
  }
  return {
    update(v, events) {
      V = v
      if (v.turn !== ctx.me.id) sel = null
      for (const e of events) if (e.e === "place") { if (e.sos) ctx.sfx.right(); else ctx.sfx.place() }
      draw()
    },
  }
}
