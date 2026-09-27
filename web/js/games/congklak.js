// Congklak: wooden board with 7 holes per side and two stores; sowing is animated seed by seed.
import { el, svg } from "../lib.js?v=__VERSION__"
import { status } from "./common.js?v=__VERSION__"

// Layout: my holes along the bottom (left→right), the opponent's along the top (right→left).
export function mount(stage, ctx) {
  const st = el("div", { class: "status-line" })
  const wrap = el("div", { class: "board-wrap free wood", style: { padding: "10px", maxWidth: "760px" } })
  const note = el("div", { class: "center small muted", style: { marginTop: "8px" } })
  stage.append(st, wrap, note)
  let shown = null, anim = null, V = null

  function positions(mySide) {
    const pos = {}
    const hole = (i) => {
      const side = i <= 6 ? 0 : 1
      const k = side === 0 ? i : i - 8
      const bottom = side === mySide
      const x = bottom ? 18 + k * 10.6 : 18 + (6 - k) * 10.6
      return [x, bottom ? 29 : 11]
    }
    for (let i = 0; i < 16; i++) {
      if (i === 7 || i === 15) {
        const side = i === 7 ? 0 : 1
        pos[i] = [side === mySide ? 93 : 7, 20]
      } else pos[i] = hole(i)
    }
    return pos
  }

  function draw(board) {
    const v = V
    const mySide = v.side[ctx.me.id] ?? 0
    const P = positions(mySide)
    const mine = v.turn === ctx.me.id && !v.over && !anim
    const g = svg("svg", { viewBox: "0 0 100 40", style: "width:100%;height:auto" })
    g.append(svg("rect", { x: 1, y: 1, width: 98, height: 38, rx: 19, fill: "#b8844f", stroke: "#8a6038", "stroke-width": .8 }))
    for (let i = 0; i < 16; i++) {
      const [x, y] = P[i]
      const store = i === 7 || i === 15
      const side = i <= 7 ? 0 : 1
      const canTap = mine && !store && side === mySide && board[i] > 0
      const hole = svg("g", { style: canTap ? "cursor:pointer" : "", onclick: () => { if (canTap) ctx.send({ hole: i }) } })
      if (store) hole.append(svg("ellipse", { cx: x, cy: y, rx: 5.5, ry: 14, fill: "#6d4527", stroke: "#5a381f", "stroke-width": .6 }))
      else hole.append(svg("circle", { cx: x, cy: y, r: 4.4, fill: canTap ? "#7a4d2b" : "#6d4527", stroke: canTap ? "#f2c94c" : "#5a381f", "stroke-width": canTap ? .8 : .5 }))
      const n = board[i]
      const seeds = Math.min(n, store ? 30 : 12)
      for (let s = 0; s < seeds; s++) {
        const a = s * 2.399, rr = (store ? 1.1 : .9) * Math.sqrt(s + .5)
        hole.append(svg("circle", { cx: x + Math.cos(a) * rr * (store ? .9 : 1), cy: y + Math.sin(a) * rr * (store ? 2.2 : 1), r: .85,
          fill: ["#f3ead7", "#e9dcc2", "#fff8ea"][s % 3], stroke: "rgba(0,0,0,.15)", "stroke-width": .15 }))
      }
      hole.append(svg("text", { x, y: store ? y + 17.3 : (y > 20 ? y + 7.6 : y - 5.4), "text-anchor": "middle", "font-size": 2.8, "font-weight": 900, fill: "#fff4e0", text: n }))
      g.append(hole)
    }
    wrap.replaceChildren(g)
  }

  function animate(ev, finalBoard) {
    // Replay the sowing on the previous board: pick up, drop seed by seed.
    const board = [...shown]
    const seq = []
    seq.push(() => { board[ev.hole] = 0 })
    let pickI = 0
    let last = ev.hole
    for (const d of ev.drops) {
      if (d === -1) {
        const [h] = ev.pickups[pickI++]
        seq.push(() => { board[h] = 0 })
        last = h
      } else seq.push(() => { board[d] += 1; last = d })
    }
    let k = 0
    anim = setInterval(() => {
      if (k >= seq.length) {
        clearInterval(anim)
        anim = null
        if (ev.capture) ctx.sfx.capture()
        shown = finalBoard
        draw(shown)
        return
      }
      seq[k++]()
      ctx.sfx.tick()
      draw(board)
    }, Math.max(60, Math.min(160, 2400 / seq.length)))
    void last
  }

  return {
    update(v, events) {
      V = v
      const ev = events.find((e) => e.e === "sow")
      if (ev && shown && !anim) animate(ev, v.board)
      else if (!anim) { shown = v.board; draw(shown) }
      const mySide = v.side[ctx.me.id]
      note.textContent = mySide !== undefined ? ctx.L("Lubangmu di bawah, lumbungmu di kanan.", "Your holes are along the bottom; your store is on the right.") : ""
      const cap = ev && ev.capture
      status(ctx, st, v, { mine: cap ? ctx.L("Tembak! Giliranmu", "Captured! Your turn") : ctx.L("Giliranmu — pilih lubang", "Your turn — pick a hole"),
        over: undefined })
      if (ev && ev.again && v.turn === ev.who) st.textContent += ctx.L(" (jalan lagi!)", " (again!)")
    },
    scores: (v) => Object.fromEntries(Object.entries(v.side).map(([p, sd]) => [p, v.board[sd === 0 ? 7 : 15]])),
  }
}
