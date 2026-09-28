// Ular Tangga: 10×10 board, ladders and snakes, animated pieces with avatars.
import { el, svg } from "../lib.js?v=__VERSION__"
import { die, status } from "./common.js?v=__VERSION__"

const TILE = ["#fff4e0", "#fde3c2", "#e7f1dc", "#fbe0e0", "#e1ecf7"]
function cellXY(n) {  // 1..100 → centre (x, y) in a 100×100 box; 1 is bottom-left, rows snake
  if (n <= 0) return [-4, 97]
  const i = n - 1
  const row = Math.floor(i / 10)
  let col = i % 10
  if (row % 2 === 1) col = 9 - col
  return [col * 10 + 5, (9 - row) * 10 + 5]
}

function drawBoard(g, board) {
  for (let n = 1; n <= 100; n++) {
    const [x, y] = cellXY(n)
    g.append(svg("rect", { x: x - 5, y: y - 5, width: 10, height: 10, fill: TILE[(n * 7) % TILE.length], stroke: "#f3e3c8", "stroke-width": .3 }))
    g.append(svg("text", { x: x - 4, y: y - 2.2, "font-size": 2.6, "font-weight": 800, fill: "#9b8a74", text: n }))
  }
  g.append(svg("text", { x: 95, y: 7.5, "text-anchor": "middle", "font-size": 5, text: "🏁" }))
  for (const [a, b] of Object.entries(board.ladders)) {
    const [x1, y1] = cellXY(Number(a)), [x2, y2] = cellXY(b)
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy), nx = -dy / len * 1.6, ny = dx / len * 1.6
    const lad = svg("g", { opacity: .95 })
    lad.append(svg("line", { x1: x1 + nx, y1: y1 + ny, x2: x2 + nx, y2: y2 + ny, stroke: "#8a6038", "stroke-width": .9, "stroke-linecap": "round" }))
    lad.append(svg("line", { x1: x1 - nx, y1: y1 - ny, x2: x2 - nx, y2: y2 - ny, stroke: "#8a6038", "stroke-width": .9, "stroke-linecap": "round" }))
    const rungs = Math.max(2, Math.floor(len / 3.2))
    for (let k = 1; k < rungs; k++) {
      const t = k / rungs
      g.append(lad)
      lad.append(svg("line", { x1: x1 + dx * t + nx, y1: y1 + dy * t + ny, x2: x1 + dx * t - nx, y2: y1 + dy * t - ny, stroke: "#b88a57", "stroke-width": .7 }))
    }
    g.append(lad)
  }
  const snakeCols = ["#3fa66a", "#e5484d", "#9b6bd6", "#f0843c", "#3b82d6"]
  let k = 0
  for (const [a, b] of Object.entries(board.snakes)) {
    const [x1, y1] = cellXY(Number(a)), [x2, y2] = cellXY(b)
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2
    const dx = x2 - x1, dy = y2 - y1
    const c1x = mx - dy * .35 + dx * -.2, c1y = my + dx * .35
    const c2x = mx + dy * .35, c2y = my - dx * .35 + dy * .2
    const d = `M${x1},${y1} C${c1x},${c1y} ${c2x},${c2y} ${x2},${y2}`
    const col = snakeCols[k++ % snakeCols.length]
    g.append(svg("path", { d, fill: "none", stroke: "rgba(0,0,0,.15)", "stroke-width": 3, "stroke-linecap": "round", transform: "translate(.4,.5)" }))
    g.append(svg("path", { d, fill: "none", stroke: col, "stroke-width": 2.6, "stroke-linecap": "round" }))
    g.append(svg("path", { d, fill: "none", stroke: "rgba(255,255,255,.55)", "stroke-width": .6, "stroke-dasharray": "1 1.6", "stroke-linecap": "round" }))
    g.append(svg("circle", { cx: x1, cy: y1, r: 2.1, fill: col }))
    g.append(svg("circle", { cx: x1 - .7, cy: y1 - .5, r: .45, fill: "#fff" }))
    g.append(svg("circle", { cx: x1 + .7, cy: y1 - .5, r: .45, fill: "#fff" }))
  }
}

export function mount(stage, ctx) {
  const st = el("div", { class: "status-line" })
  const wrap = el("div", { class: "board-wrap", style: { borderRadius: "20px", overflow: "hidden", boxShadow: "var(--shadow-lg)" } })
  const bar = el("div", { class: "action-bar" })
  stage.append(st, wrap, bar)
  let layer = null, tokens = {}, boardKey = "", rolling = false
  return {
    update(v, events) {
      const key = JSON.stringify(v.board)
      if (key !== boardKey) {
        boardKey = key
        const g = svg("svg", { viewBox: "0 0 100 100" })
        drawBoard(g, v.board)
        layer = svg("g")
        g.append(layer)
        wrap.replaceChildren(g)
        tokens = {}
      }
      const roll = events.find((e) => e.e === "roll")
      if (roll) {
        ctx.sfx.dice()
        rolling = true
        setTimeout(() => { rolling = false }, 700)
        setTimeout(() => { if (roll.ladder) ctx.sfx.ladder(); else if (roll.snake) ctx.sfx.snake(); else if (roll.stuck) ctx.sfx.wrong() }, 650)
      }
      const at = {}
      Object.entries(v.pos).forEach(([pid, n]) => { (at[n] = at[n] || []).push(pid) })
      Object.entries(v.pos).forEach(([pid, n]) => {
        let [x, y] = cellXY(n)
        const grp = at[n]
        const idx = grp.indexOf(pid)
        if (grp.length > 1) { x += (idx - (grp.length - 1) / 2) * 3; y += (idx % 2) * 1.5 }
        let t = tokens[pid]
        if (!t) {
          const p = ctx.player(pid)
          t = svg("g", { style: "transition: transform .5s cubic-bezier(.3,.7,.3,1.2)" },
            svg("circle", { cx: 0, cy: .6, r: 3.4, fill: "rgba(0,0,0,.25)" }),
            svg("circle", { cx: 0, cy: 0, r: 3.4, fill: p.color, stroke: "#fff", "stroke-width": .8 }),
            svg("text", { x: 0, y: 1.4, "text-anchor": "middle", "font-size": 4, text: p.avatar }))
          tokens[pid] = t
          layer.append(t)
        }
        if (roll && roll.who === pid && (roll.ladder || roll.snake)) {
          const [sx, sy] = cellXY(roll.step)
          t.style.transform = `translate(${sx}px, ${sy}px)`
          setTimeout(() => { t.style.transform = `translate(${x}px, ${y}px)` }, 650)
        } else t.style.transform = `translate(${x}px, ${y}px)`
      })
      const mine = v.turn === ctx.me.id && !v.over
      bar.replaceChildren(el("div", { class: `dice${rolling ? " rolling" : ""}` }, die(v.dice).firstChild),
        mine ? el("button", { class: "btn primary big", type: "button", text: ctx.L("Lempar dadu 🎲", "Roll 🎲"), onclick: () => ctx.send({ do: "roll" }) }) : null)
      let msg
      if (roll && roll.stuck) msg = ctx.L(`${ctx.name(roll.who)} butuh angka pas — diam di tempat`, `${ctx.name(roll.who)} needs an exact roll — stays put`)
      else if (roll && roll.ladder) msg = ctx.L(`${ctx.name(roll.who)} naik tangga! 🪜`, `${ctx.name(roll.who)} climbs a ladder! 🪜`)
      else if (roll && roll.snake) msg = ctx.L(`${ctx.name(roll.who)} digigit ular! 🐍`, `${ctx.name(roll.who)} got bitten! 🐍`)
      status(ctx, st, v, msg && !mine ? { other: msg } : {})
      if (msg && mine) st.textContent = msg + " · " + ctx.L("Giliranmu!", "Your turn!")
    },
    scores: (v) => v.pos,
  }
}
