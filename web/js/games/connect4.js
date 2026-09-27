// Connect 4: tap a column to drop a disc (with a falling animation).
import { el, svg } from "../lib.js?v=__VERSION__"
import { status } from "./common.js?v=__VERSION__"

export function mount(stage, ctx) {
  const st = el("div", { class: "status-line" })
  const wrap = el("div", { class: "board-wrap free" })
  stage.append(st, wrap)
  return {
    update(v, events) {
      const w = v.w, h = v.h
      const mine = v.turn === ctx.me.id && !v.over
      const drop = events.find((e) => e.e === "drop")
      if (drop) ctx.sfx.place()
      const win = new Set(v.win || [])
      const cs = 100 / w
      const g = svg("svg", { viewBox: `0 0 100 ${cs * h + 4}`, style: "width:100%;height:auto" })
      g.append(svg("rect", { x: 0, y: 2, width: 100, height: cs * h + 2, rx: 5, fill: "#3b6fb6" }))
      const ids = [...new Set(v.grid.filter(Boolean))]
      for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
        const i = r * w + c, pid = v.grid[i]
        const fill = pid ? (ctx.seats()[0]?.id === pid ? "#e5484d" : "#f2b63c") : "var(--bg)"
        const circ = svg("circle", { cx: c * cs + cs / 2, cy: r * cs + cs / 2 + 3, r: cs * .38, fill, stroke: win.has(i) ? "#fff" : "rgba(0,0,0,.15)", "stroke-width": win.has(i) ? 1.4 : .5 })
        if (drop && drop.col === c && drop.row === r) {
          circ.animate([{ transform: `translateY(${-(r + 1) * cs}px)` }, { transform: "translateY(0)" }], { duration: 250 + r * 60, easing: "cubic-bezier(.4,0,.8,1)" })
        }
        g.append(circ)
      }
      for (let c = 0; c < w; c++) g.append(svg("rect", { x: c * cs, y: 0, width: cs, height: cs * h + 4, fill: "transparent",
        style: mine ? "cursor:pointer" : "", onclick: () => { if (mine) ctx.send({ col: c }) } }))
      wrap.replaceChildren(g)
      void ids
      const color = (pid) => (ctx.seats()[0]?.id === pid ? "🔴" : "🟡")
      status(ctx, st, v, { mine: `${color(ctx.me.id)} ${ctx.L("Giliranmu — pilih kolom", "Your turn — pick a column")}`,
        other: `${color(v.turn)} ${ctx.L(`Menunggu ${ctx.name(v.turn)}…`, `Waiting for ${ctx.name(v.turn)}…`)}`,
        over: v.results.every((r) => r.rank === 1) ? ctx.L("Seri!", "Draw!") : undefined })
    },
  }
}
