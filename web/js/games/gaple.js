// Gaple (dominoes): a big felt table where the line snakes like a real game — it grows out of the first tile,
// turns the corner at the table edge and comes back the other way; doubles lie crosswise. Your tiles below.
import { el, svg } from "../lib.js?v=__VERSION__"
import { domino, status } from "./common.js?v=__VERSION__"

const U = 10          // one domino half
const HALF_W = 6.5 * U  // how far a row may run from the centre before it turns

const PIPS = { 0: [], 1: [[.5, .5]], 2: [[.27, .27], [.73, .73]], 3: [[.25, .25], [.5, .5], [.75, .75]], 4: [[.27, .27], [.73, .27], [.27, .73], [.73, .73]],
  5: [[.25, .25], [.75, .25], [.5, .5], [.25, .75], [.75, .75]], 6: [[.27, .22], [.73, .22], [.27, .5], [.73, .5], [.27, .78], [.73, .78]] }

// Lay out the line: returns [{cells: [[cx, cy, pips], [cx, cy, pips]], i}] in table units.
function layout(line, origin, halfW = HALF_W) {
  const out = []
  if (!line.length) return out
  origin = Math.max(0, Math.min(line.length - 1, origin))
  const o = line[origin].t
  if (o[0] === o[1]) out.push({ i: origin, cells: [[0, -U / 2, o[0]], [0, U / 2, o[1]]] })
  else out.push({ i: origin, cells: [[-U / 2, 0, o[0]], [U / 2, 0, o[1]]] })
  const startEdge = o[0] === o[1] ? U / 2 : U
  // walk one arm outward; sx: first horizontal direction, sy: which way it turns
  const arm = (idxs, sx, sy, flip) => {
    let ex = sx * startEdge, ey = 0, afterCorner = false
    for (const i of idxs) {
      let [m, op] = line[i].t           // m touches the line so far, op is the new open end
      if (flip) [m, op] = [op, m]
      const dbl = m === op && !afterCorner  // right after a corner a double lies in line (no room crosswise)
      afterCorner = false
      const along = dbl ? U : 2 * U
      const next = ex + sx * along
      if (Math.abs(next) > halfW) {
        // corner: this tile turns and goes along the edge, the line then comes back
        const cx = ex + sx * U / 2
        out.push({ i, cells: [[cx, ey, m], [cx, ey + sy * U, op]] })
        ey += sy * 2 * U
        sx = -sx
        ex = cx - sx * U / 2
        afterCorner = true
        continue
      }
      if (dbl) out.push({ i, cells: [[ex + sx * U / 2, ey - U / 2, m], [ex + sx * U / 2, ey + U / 2, op]] })
      else out.push({ i, cells: [[ex + sx * U / 2, ey, m], [ex + sx * 1.5 * U, ey, op]] })
      ex = next
    }
  }
  arm([...Array(line.length - origin - 1).keys()].map((k) => origin + 1 + k), 1, 1, false)
  arm([...Array(origin).keys()].map((k) => origin - 1 - k), -1, -1, true)
  return out
}

function tileNode(t, fresh) {
  const [[ax, ay, a], [bx, by, b]] = t.cells
  const x0 = Math.min(ax, bx) - U / 2, y0 = Math.min(ay, by) - U / 2
  const w = Math.abs(ax - bx) + U, h = Math.abs(ay - by) + U
  const g = svg("g", { class: fresh ? "gp-tile fresh" : "gp-tile" })
  g.append(svg("rect", { x: x0 + 0.5, y: y0 + 1.1, width: w - 0.4, height: h - 0.4, rx: 1.6, fill: "rgba(0,0,0,.3)" }),
    svg("rect", { x: x0 + 0.2, y: y0 + 0.2, width: w - 0.4, height: h - 0.4, rx: 1.6, fill: "#fffaf0", stroke: "#cdbd9f", "stroke-width": 0.35 }))
  if (ax === bx) g.append(svg("line", { x1: x0 + 1.2, y1: (ay + by) / 2, x2: x0 + w - 1.2, y2: (ay + by) / 2, stroke: "#cdbd9f", "stroke-width": 0.35 }))
  else g.append(svg("line", { x1: (ax + bx) / 2, y1: y0 + 1.2, x2: (ax + bx) / 2, y2: y0 + h - 1.2, stroke: "#cdbd9f", "stroke-width": 0.35 }))
  for (const [cx, cy, n] of t.cells) for (const [px, py] of PIPS[n] || []) g.append(svg("circle", { cx: cx - U / 2 + px * U, cy: cy - U / 2 + py * U, r: U * 0.085, fill: n === 1 ? "#c1121f" : "#2e2722" }))
  return g
}

export function mount(stage, ctx) {
  const st = el("div", { class: "status-line" })
  const opp = el("div", { class: "row wrap", style: { justifyContent: "center", gap: "10px", marginBottom: "6px" } })
  const felt = el("div", { class: "felt gp-felt" })
  const info = el("div", { class: "gp-info" })
  const table = svg("svg", { class: "gp-table" })
  felt.append(info, table)
  const bar = el("div", { class: "action-bar" })
  const hand = el("div", { class: "gp-hand" })
  stage.append(st, opp, felt, bar, hand)
  let sel = null, seen = new Set(), lastRound = 0

  function drawTable(v) {
    if (v.round !== lastRound) { seen = new Set(); lastRound = v.round }
    table.replaceChildren()
    if (!v.line.length) {
      table.setAttribute("viewBox", "-60 -30 120 60")
      table.append(svg("text", { x: 0, y: 2, "text-anchor": "middle", "font-size": 6, "font-weight": 800, fill: "rgba(255,255,255,.8)", text: ctx.L("Meja masih kosong", "The table is empty") }))
      return
    }
    const aspect = table.clientWidth / Math.max(1, table.clientHeight) || 0.8
    const tiles = layout(v.line, v.origin ?? Math.floor(v.line.length / 2), aspect < 1.1 ? 4.6 * U : HALF_W)
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9
    for (const t of tiles) for (const [cx, cy] of t.cells) { x0 = Math.min(x0, cx - U); y0 = Math.min(y0, cy - U); x1 = Math.max(x1, cx + U); y1 = Math.max(y1, cy + U) }
    // keep the table at least a comfortable size so a short line isn't blown up huge
    let w = Math.max(x1 - x0, (aspect < 1.1 ? 10 : 14) * U), h = Math.max(y1 - y0, 6 * U)
    if (w / h > aspect) h = w / aspect; else w = h * aspect  // fill the table, whatever its shape
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2
    table.setAttribute("viewBox", `${cx - w / 2 - 2} ${cy - h / 2 - 2} ${w + 4} ${h + 4}`)
    for (const t of tiles) {
      const key = `${v.line[t.i].t.join("-")}`
      table.append(tileNode(t, !seen.has(key) && seen.size > 0))
      seen.add(key)
    }
  }

  return {
    update(v, events) {
      for (const e of events) {
        if (e.e === "play") ctx.sfx.place()
        if (e.e === "draw") ctx.sfx.card()
        if (e.e === "pass") ctx.toast(ctx.L(`${ctx.name(e.who)} pas`, `${ctx.name(e.who)} passes`))
        if (e.e === "round") { ctx.sfx.win(); ctx.toast(e.blocked ? ctx.L(`Buntu! ${ctx.name(e.winner)} menang (titik terkecil)`, `Blocked! ${ctx.name(e.winner)} wins (lowest total)`)
          : ctx.L(`${ctx.name(e.winner)} habis duluan! +${e.points}`, `${ctx.name(e.winner)} went out! +${e.points}`)) }
      }
      const me = ctx.me.id
      const mine = v.turn === me && v.phase === "play" && !v.over
      opp.replaceChildren(...Object.entries(v.counts).filter(([p]) => p !== me).map(([p, n]) =>
        el("div", { class: `seat${v.turn === p ? " turn" : ""}` }, el("span", { class: "av", style: { "--c": ctx.color(p) }, text: ctx.player(p).avatar }),
          el("span", { text: `${ctx.name(p)} · ${n} 🁢` }))))
      info.replaceChildren(v.ends ? el("span", { class: "gp-end", text: `◀ ${v.ends[0]}` }) : el("span"),
        el("span", { text: `${ctx.L("Tumpukan", "Boneyard")}: ${v.bone}` }), v.ends ? el("span", { class: "gp-end", text: `${v.ends[1]} ▶` }) : el("span"))
      drawTable(v)
      felt.querySelector(".gp-over")?.remove()
      if (v.phase === "round_over" && v.round_over) {
        felt.append(el("div", { class: "gp-over" }, el("div", {}, el("div", { class: "big-msg", text: `🏆 ${ctx.name(v.round_over.winner)} +${v.round_over.points}` }),
          el("div", { class: "small", text: ctx.L("Ronde berikutnya sebentar lagi…", "Next round starting…") }))))
      }
      // Hand
      const can = v.can || {}
      if (sel !== null && !can[sel]) sel = null
      hand.replaceChildren(...v.hand.map((t, i) => {
        const ok = !!can[i]
        const n = el("button", { type: "button", class: `gp-card${sel === i ? " sel" : ""}${mine && !ok ? " dim" : ""}`, style: { cursor: ok ? "pointer" : "default" } },
          domino(t[0], t[1], { size: 36, vertical: true, highlight: ok }))
        n.onclick = () => {
          if (!ok) return
          const sides = can[i]
          if (sides.length === 1) { ctx.send({ do: "play", i, side: sides[0] }); sel = null; return }
          sel = i
          ctx.sfx.click()
          drawSides(i)
        }
        return n
      }))
      function drawSides(i) {
        bar.replaceChildren(
          el("button", { class: "btn primary", type: "button", text: ctx.L(`◀ Kiri (${v.ends[0]})`, `◀ Left (${v.ends[0]})`), onclick: () => { ctx.send({ do: "play", i, side: "L" }); sel = null } }),
          el("button", { class: "btn primary", type: "button", text: ctx.L(`Kanan (${v.ends[1]}) ▶`, `Right (${v.ends[1]}) ▶`), onclick: () => { ctx.send({ do: "play", i, side: "R" }); sel = null } }))
      }
      bar.replaceChildren()
      const hasPlay = Object.keys(can).length > 0
      if (mine && !hasPlay) {
        if (v.bone > 0) bar.append(el("button", { class: "btn gold big", type: "button", text: ctx.L("⛏️ Nyangkul", "⛏️ Draw (nyangkul)"), onclick: () => ctx.send({ do: "draw" }) }))
        else bar.append(el("button", { class: "btn big", type: "button", text: ctx.L("Pas", "Pass"), onclick: () => ctx.send({ do: "pass" }) }))
      }
      if (sel !== null) drawSides(sel)
      status(ctx, st, v, { mine: hasPlay ? ctx.L("Giliranmu — pilih kartu", "Your turn — pick a tile") : v.bone ? ctx.L("Tidak ada yang cocok — nyangkul!", "Nothing fits — draw!") : ctx.L("Tidak bisa jalan — pas", "Can't play — pass") })
    },
    scores: (v) => (v.target ? v.scores : v.counts),
  }
}
