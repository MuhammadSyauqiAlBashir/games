// Ludo: classic cross board (2–4 players) or a round six-colour board (5–6 players).
import { el, svg } from "../lib.js?v=__VERSION__"
import { gated, makeDie, status, throwDice } from "./common.js?v=__VERSION__"

const SLOT_COLORS = ["#e5484d", "#3fa66a", "#f2b63c", "#3b82d6", "#9b6bd6", "#f0843c"]
const SLOT_LIGHT = ["#fbd5d6", "#cdebd8", "#fcebc4", "#cfe0f7", "#e6d9f6", "#fde0cb"]

// ---- 4-colour cross board on a 15×15 grid ---------------------------------------------------------------
function crossTrack() {
  const t = []
  for (let c = 1; c <= 5; c++) t.push([6, c])
  for (let r = 5; r >= 0; r--) t.push([r, 6])
  t.push([0, 7])
  for (let r = 0; r <= 5; r++) t.push([r, 8])
  for (let c = 9; c <= 14; c++) t.push([6, c])
  t.push([7, 14])
  for (let c = 14; c >= 9; c--) t.push([8, c])
  for (let r = 9; r <= 14; r++) t.push([r, 8])
  t.push([14, 7])
  for (let r = 14; r >= 9; r--) t.push([r, 6])
  for (let c = 5; c >= 0; c--) t.push([8, c])
  t.push([7, 0])
  t.push([6, 0])
  return t
}
const TRACK = crossTrack()
const HOME_COL = [
  [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]], [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]], [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
]
const YARD = [[1.5, 1.5], [1.5, 10.5], [10.5, 10.5], [10.5, 1.5]]  // [row, col] of each yard's top-left inner corner
const CENTER_OFF = [[7.5, 6.6], [6.6, 7.5], [7.5, 8.4], [8.4, 7.5]]

function crossXY(slot, prog, piece) {
  const cell = 100 / 15
  const at = (r, c) => [c * cell + cell / 2, r * cell + cell / 2]
  if (prog < 0) {
    const [r0, c0] = YARD[slot]
    const dx = piece % 2, dy = Math.floor(piece / 2)
    return [(c0 + dx * 2 + 0.5) * cell, (r0 + dy * 2 + 0.5) * cell]  // centres of the 4 spots in the yard's inner square
  }
  if (prog <= 50) return at(...TRACK[(13 * slot + prog) % 52])
  if (prog <= 55) return at(...HOME_COL[slot][prog - 51])
  const [r, c] = CENTER_OFF[slot]
  return [c * cell + (piece - 1.5) * 1.2, r * cell + (piece % 2) * 1.2]
}

function drawCross(g, size) {
  const cell = 100 / 15
  g.append(svg("rect", { x: 0, y: 0, width: 100, height: 100, rx: 4, fill: "#fffaf0" }))
  for (let s = 0; s < 4; s++) {
    const [r0, c0] = [[0, 0], [0, 9], [9, 9], [9, 0]][s]
    g.append(svg("rect", { x: c0 * cell, y: r0 * cell, width: 6 * cell, height: 6 * cell, rx: 3, fill: SLOT_COLORS[s] }))
    g.append(svg("rect", { x: (c0 + 1) * cell, y: (r0 + 1) * cell, width: 4 * cell, height: 4 * cell, rx: 3, fill: "#fffaf0" }))
    for (let p = 0; p < 4; p++) {
      const [x, y] = crossXY(s, -1, p)
      g.append(svg("circle", { cx: x, cy: y, r: cell * .55, fill: SLOT_LIGHT[s], stroke: SLOT_COLORS[s], "stroke-width": .5 }))
    }
  }
  TRACK.forEach(([r, c], i) => {
    const slotStart = i % 13 === 0 ? i / 13 : -1
    const star = i % 13 === 8
    g.append(svg("rect", { x: c * cell + .2, y: r * cell + .2, width: cell - .4, height: cell - .4, rx: .8,
      fill: slotStart >= 0 ? SLOT_COLORS[slotStart] : "#fff", stroke: "#e2d6c3", "stroke-width": .25 }))
    if (star) g.append(svg("text", { x: c * cell + cell / 2, y: r * cell + cell * .72, "text-anchor": "middle", "font-size": cell * .7, fill: "#c9a227", text: "★" }))
  })
  HOME_COL.forEach((col, s) => col.forEach(([r, c]) => g.append(svg("rect", { x: c * cell + .2, y: r * cell + .2, width: cell - .4, height: cell - .4, rx: .8, fill: SLOT_COLORS[s], opacity: .85 }))))
  const cx = 7.5 * cell, cy = 7.5 * cell, h = 1.5 * cell
  const tri = (pts, s) => g.append(svg("polygon", { points: pts.map((p) => p.join(",")).join(" "), fill: SLOT_COLORS[s] }))
  tri([[cx - h, cy - h], [cx, cy], [cx - h, cy + h]], 0)
  tri([[cx - h, cy - h], [cx, cy], [cx + h, cy - h]], 1)
  tri([[cx + h, cy - h], [cx, cy], [cx + h, cy + h]], 2)
  tri([[cx - h, cy + h], [cx, cy], [cx + h, cy + h]], 3)
  void size
}

// ---- 6-colour round board --------------------------------------------------------------------------------------
const RING = 78
function ringXY(i) {
  const a = (i / RING) * Math.PI * 2 - Math.PI / 2
  return [50 + Math.cos(a) * 40, 50 + Math.sin(a) * 40]
}
function roundXY(slot, prog, piece) {
  if (prog < 0) {
    const a = ((13 * slot) / RING) * Math.PI * 2 - Math.PI / 2 - 0.22
    const bx = 50 + Math.cos(a) * 47.5, by = 50 + Math.sin(a) * 47.5
    const off = [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]][piece]
    return [bx + off[0], by + off[1]]
  }
  if (prog <= 50) return ringXY((13 * slot + prog) % RING)
  const entry = (13 * slot + 50) % RING
  const a = (entry / RING) * Math.PI * 2 - Math.PI / 2
  const rr = 40 - (prog - 50) * 5.3
  return [50 + Math.cos(a) * rr + (prog === 56 ? (piece - 1.5) * 1.1 : 0), 50 + Math.sin(a) * rr]
}
function drawRound(g) {
  g.append(svg("circle", { cx: 50, cy: 50, r: 49, fill: "#fffaf0" }))
  for (let s = 0; s < 6; s++) {
    const entry = (13 * s + 50) % RING
    const a = (entry / RING) * Math.PI * 2 - Math.PI / 2
    for (let k = 1; k <= 5; k++) {
      const rr = 40 - k * 5.3
      g.append(svg("circle", { cx: 50 + Math.cos(a) * rr, cy: 50 + Math.sin(a) * rr, r: 2.2, fill: SLOT_COLORS[s], opacity: .8 }))
    }
    const ay = ((13 * s) / RING) * Math.PI * 2 - Math.PI / 2 - 0.22
    g.append(svg("circle", { cx: 50 + Math.cos(ay) * 47.5, cy: 50 + Math.sin(ay) * 47.5, r: 4.4, fill: SLOT_LIGHT[s], stroke: SLOT_COLORS[s], "stroke-width": .6 }))
  }
  for (let i = 0; i < RING; i++) {
    const [x, y] = ringXY(i)
    const start = i % 13 === 0 ? i / 13 : -1
    g.append(svg("circle", { cx: x, cy: y, r: 1.55, fill: start >= 0 ? SLOT_COLORS[start] : "#fff", stroke: "#e2d6c3", "stroke-width": .25 }))
    if (i % 13 === 8) g.append(svg("text", { x, y: y + .9, "text-anchor": "middle", "font-size": 2.6, fill: "#c9a227", text: "★" }))
  }
  g.append(svg("circle", { cx: 50, cy: 50, r: 9, fill: "#f3e7d3" }))
  g.append(svg("text", { x: 50, y: 52.5, "text-anchor": "middle", "font-size": 7, text: "🏠" }))
}

export function mount(stage, ctx) {
  const st = el("div", { class: "status-line" })
  const wrap = el("div", { class: "board-wrap", style: { borderRadius: "22px", overflow: "hidden", boxShadow: "var(--shadow-lg)" } })
  const bar = el("div", { class: "action-bar" })
  stage.append(st, wrap, bar)
  let board = null, tokens = {}, size = 4, V = null
  const D = makeDie(64)

  function build(v) {
    size = v.size
    const g = svg("svg", { viewBox: "0 0 100 100" })
    if (size === 4) drawCross(g); else drawRound(g)
    board = { g, layer: svg("g") }
    g.append(board.layer)
    wrap.replaceChildren(g)
    tokens = {}
  }
  const xy = (slot, prog, piece) => (size === 4 ? crossXY(slot, prog, piece) : roundXY(slot, prog, piece))

  function drawTokens(v) {
    const mine = v.turn === ctx.me.id && v.phase === "move"
    const movable = new Set(mine ? v.moves : [])
    const spots = {}
    for (const [pid, pieces] of Object.entries(v.pieces)) {
      pieces.forEach((prog, i) => {
        if (prog >= 0 && prog < 56) {
          const k = prog <= 50 ? `r${(13 * v.slot[pid] + prog) % (size === 4 ? 52 : RING)}` : `h${pid}${prog}`
          ;(spots[k] = spots[k] || []).push([pid, i])
        }
      })
    }
    for (const [pid, pieces] of Object.entries(v.pieces)) {
      const slot = v.slot[pid]
      pieces.forEach((prog, i) => {
        const key = `${pid}:${i}`
        let [x, y] = xy(slot, prog, i)
        const k = prog >= 0 && prog <= 50 ? `r${(13 * slot + prog) % (size === 4 ? 52 : RING)}` : null
        const group = k && spots[k]
        if (group && group.length > 1) {
          const idx = group.findIndex(([p, j]) => p === pid && j === i)
          x += (idx - (group.length - 1) / 2) * 1.6
          y -= idx * .5
        }
        let t = tokens[key]
        const canMove = pid === ctx.me.id && movable.has(i)
        const r = size === 4 ? 2.6 : 1.7
        if (!t) {
          t = svg("g", { class: "tok", style: "transition: transform .35s cubic-bezier(.3,.7,.3,1.2)" },
            svg("circle", { cx: 0, cy: .5, r, fill: "rgba(0,0,0,.3)" }),
            svg("circle", { cx: 0, cy: 0, r, fill: SLOT_COLORS[slot], stroke: "#fff", "stroke-width": r * .28 }),
            svg("circle", { cx: 0, cy: 0, r: r * .38, fill: "rgba(255,255,255,.55)" }),
            svg("circle", { class: "ring", cx: 0, cy: 0, r: r * 1.45, fill: "none", stroke: "#2e2722", "stroke-width": .5, "stroke-dasharray": "1.2 1", opacity: 0 }))
          tokens[key] = t
          board.layer.append(t)
        }
        t.style.transform = `translate(${x}px, ${y}px)`
        t.querySelector(".ring").setAttribute("opacity", canMove ? 1 : 0)
        t.style.cursor = canMove ? "pointer" : ""
        t.onclick = canMove ? () => ctx.send({ do: "move", piece: i }) : null
        if (canMove) board.layer.append(t)  // on top
      })
    }
  }

  function drawBar(v) {
    const mine = v.turn === ctx.me.id && !v.over
    D.show(v.dice)
    bar.replaceChildren(D.el)
    if (mine && v.phase === "roll") bar.append(el("button", { class: "btn primary big", type: "button", text: ctx.L("Lempar dadu 🎲", "Roll 🎲"), onclick: () => ctx.send({ do: "roll" }) }))
    else if (mine && v.phase === "move") bar.append(el("span", { class: "muted", text: ctx.L("Pilih bidak yang bercincin", "Tap a ringed piece") }))
    const legend = el("div", { class: "row wrap", style: { justifyContent: "center", width: "100%" } },
      Object.entries(v.slot).map(([pid, s]) => el("span", { class: "pill", style: { background: SLOT_LIGHT[s], color: "#2e2722" } },
        el("i", { style: { width: "10px", height: "10px", borderRadius: "50%", background: SLOT_COLORS[s], display: "inline-block" } }),
        ` ${ctx.name(pid)} ${v.pieces[pid].filter((p) => p === 56).length}/${v.pieces[pid].length} 🏠`)))
    bar.append(legend)
  }

  return {
    update: gated((v, events) => {
      if (!board || v.size !== size) build(v)
      if (events.some((e) => e.e === "roll") && v.dice) {
        ctx.sfx.dice()
        return throwDice(wrap, [v.dice], { onHit: ctx.sfx.dieHit }).then(() => render(v, events))
      }
      render(v, events)
    }),
    scores: (v) => Object.fromEntries(Object.entries(v.pieces).map(([p, ps]) => [p, `${ps.filter((x) => x === 56).length}🏠`])),
  }

  function render(v, events) {
      V = v
      for (const e of events) {
        if (e.e === "move") { if (e.caps && e.caps.length) ctx.sfx.capture(); else if (e.home) ctx.sfx.coin(); else ctx.sfx.place() }
      }
      drawTokens(v)
      drawBar(v)
      status(ctx, st, v, { mine: v.phase === "roll" ? ctx.L("Giliranmu — lempar dadu!", "Your turn — roll!") : ctx.L(`Dapat ${v.dice}! Pilih bidak`, `You rolled ${v.dice}! Pick a piece`) })
      void V
  }
}
