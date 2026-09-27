// Tic-tac-toe on any board size.
import { el, svg } from "../lib.js?v=__VERSION__"
import { status } from "./common.js?v=__VERSION__"

export function mount(stage, ctx) {
  const st = el("div", { class: "status-line" })
  const info = el("div", { class: "center small muted" })
  const wrap = el("div", { class: "board-wrap", style: { background: "var(--card)", borderRadius: "22px", boxShadow: "var(--shadow-lg)", padding: "10px" } })
  stage.append(st, info, wrap)
  return {
    update(v, events) {
      for (const e of events) if (e.e === "place") ctx.sfx.place()
      const n = v.n, size = 100 / n
      const mine = v.turn === ctx.me.id && !v.over
      const win = new Set(v.win || [])
      const g = svg("svg", { viewBox: "0 0 100 100" })
      for (let k = 1; k < n; k++) {
        g.append(svg("line", { x1: k * size, y1: 2, x2: k * size, y2: 98, stroke: "var(--line-2)", "stroke-width": .6, "stroke-linecap": "round" }))
        g.append(svg("line", { y1: k * size, x1: 2, y2: k * size, x2: 98, stroke: "var(--line-2)", "stroke-width": .6, "stroke-linecap": "round" }))
      }
      v.grid.forEach((pid, i) => {
        const r = Math.floor(i / n), c = i % n
        const cx = c * size + size / 2, cy = r * size + size / 2
        g.append(svg("rect", { x: c * size, y: r * size, width: size, height: size, fill: win.has(i) ? "rgba(227,169,59,.25)" : "transparent",
          style: mine && !pid ? "cursor:pointer" : "", onclick: () => { if (mine && !pid) ctx.send({ i }) } }))
        if (pid) g.append(svg("text", { x: cx, y: cy + size * .22, "text-anchor": "middle", "font-size": size * .62, "font-weight": 900, fill: ctx.color(pid),
          "font-family": "Nunito, sans-serif", "pointer-events": "none", text: v.sym[pid] }))
      })
      wrap.replaceChildren(g)
      info.textContent = ctx.L(`${v.k} berderet menang · `, `${v.k} in a row wins · `) + Object.entries(v.sym).map(([p, s]) => `${s} ${ctx.name(p)}`).join("  ")
      status(ctx, st, v, { over: v.results.length && v.results.every((r) => r.rank === 1) ? ctx.L("Seri!", "Draw!") : undefined })
    },
  }
}
