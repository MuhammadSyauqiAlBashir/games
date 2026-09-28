// Sequence: a 10×10 card board, team chips, your hand below. Pick a card, then a highlighted square.
import { el, svg } from "../lib.js?v=__VERSION__"
import { SUIT, pcard, status } from "./common.js?v=__VERSION__"

const TEAM = ["#3b82d6", "#3fa66a", "#e5484d"]
const TEAM_NAME = [["Biru", "Blue"], ["Hijau", "Green"], ["Merah", "Red"]]

export function mount(stage, ctx) {
  const st = el("div", { class: "status-line" })
  const info = el("div", { class: "center small muted" })
  const wrap = el("div", { class: "board-wrap felt", style: { padding: "8px" } })
  const bar = el("div", { class: "action-bar" })
  const hand = el("div", { class: "hand", style: { minHeight: "96px" } })
  stage.append(st, info, wrap, bar, hand)
  let sel = null, V = null

  function targets(v, card) {
    if (!card) return new Set()
    const team = String(v.teams[ctx.me.id])
    const out = new Set()
    if (card === "JD" || card === "JC") v.chips.forEach((c, i) => { if (!c && ![0, 9, 90, 99].includes(i)) out.add(i) })
    else if (card === "JH" || card === "JS") {
      const inSeq = new Set(Object.values(v.seqs).flat(2))
      v.chips.forEach((c, i) => { if (c && c !== team && !inSeq.has(i)) out.add(i) })
    } else v.layout.forEach((c, i) => { if (c === card && !v.chips[i]) out.add(i) })
    return out
  }

  function draw() {
    const v = V
    const mine = v.turn === ctx.me.id && !v.over
    const card = sel !== null ? v.hand[sel] : null
    const tg = mine ? targets(v, card) : new Set()
    const g = svg("svg", { viewBox: "0 0 100 100" })
    v.layout.forEach((c, i) => {
      const x = (i % 10) * 10, y = Math.floor(i / 10) * 10
      const corner = c === "XX"
      const red = c[1] === "H" || c[1] === "D"
      const hit = tg.has(i)
      g.append(svg("rect", { x: x + .4, y: y + .4, width: 9.2, height: 9.2, rx: 1.2, fill: corner ? "#e3a93b" : hit ? "#fff3c4" : "#fffaf0",
        stroke: v.last === i ? "#e07a5f" : hit ? "#e3a93b" : "rgba(0,0,0,.08)", "stroke-width": v.last === i || hit ? .8 : .2,
        style: hit ? "cursor:pointer" : "", onclick: () => { if (hit) { ctx.send({ card: sel, cell: i }); sel = null } } }))
      if (corner) g.append(svg("text", { x: x + 5, y: y + 6.6, "text-anchor": "middle", "font-size": 5, "pointer-events": "none", text: "★" }))
      else {
        g.append(svg("text", { x: x + 5, y: y + 4.6, "text-anchor": "middle", "font-size": 3.6, "font-weight": 900, fill: red ? "#c63c3c" : "#2b2622", "pointer-events": "none",
          text: c[0] === "T" ? "10" : c[0] }))
        g.append(svg("text", { x: x + 5, y: y + 8.6, "text-anchor": "middle", "font-size": 3.8, fill: red ? "#c63c3c" : "#2b2622", "pointer-events": "none", text: SUIT[c[1]] }))
      }
      const chip = v.chips[i]
      if (chip) {
        g.append(svg("circle", { cx: x + 5, cy: y + 5, r: 3.6, fill: TEAM[Number(chip)], stroke: "#fff", "stroke-width": .7, opacity: .93, "pointer-events": "none" }))
        if (hit) g.append(svg("text", { x: x + 5, y: y + 6.6, "text-anchor": "middle", "font-size": 4.4, "pointer-events": "none", text: "✂️" }))
      }
    })
    for (const [team, seqs] of Object.entries(v.seqs)) for (const sq of seqs) {
      const a = sq[0], b = sq[sq.length - 1]
      g.append(svg("line", { x1: (a % 10) * 10 + 5, y1: Math.floor(a / 10) * 10 + 5, x2: (b % 10) * 10 + 5, y2: Math.floor(b / 10) * 10 + 5,
        stroke: TEAM[Number(team)], "stroke-width": 1.6, "stroke-linecap": "round", opacity: .85, "pointer-events": "none" }))
    }
    wrap.replaceChildren(g)
    const dead = new Set(v.dead)
    const w = Math.max(44, Math.min(62, (window.innerWidth - 40) / Math.max(6, v.hand.length) + 14))
    hand.replaceChildren(...v.hand.map((c, i) => {
      const n = pcard(c, w, {})
      if (sel === i) n.classList.add("sel")
      if (dead.has(i)) n.classList.add("dim")
      n.onclick = () => { if (!mine) return; sel = sel === i ? null : i; ctx.sfx.click(); draw() }
      if (c[0] === "J") n.append(el("span", { style: { position: "absolute", bottom: "2px", right: "3px", fontSize: "10px" }, text: c === "JD" || c === "JC" ? "👀" : "👁️" }))
      return n
    }))
    bar.replaceChildren()
    if (mine && sel !== null && dead.has(sel) && !v.swapped) bar.append(el("button", { class: "btn small", type: "button", text: ctx.L("Tukar kartu mati", "Swap dead card"), onclick: () => { ctx.send({ dead: sel }); sel = null } }))
    if (mine && card) bar.append(el("span", { class: "muted small", text: card === "JD" || card === "JC" ? ctx.L("Jack mata dua: taruh di kotak mana saja", "Two-eyed jack: any empty square")
      : card === "JH" || card === "JS" ? ctx.L("Jack mata satu: buang chip lawan", "One-eyed jack: remove an opponent chip") : tg.size ? ctx.L("Ketuk kotak yang menyala", "Tap a highlighted square") : ctx.L("Kartu mati — tukar", "Dead card — swap it") }))
  }

  return {
    update(v, events) {
      V = v
      for (const e of events) if (e.e === "play") { if (e.seq) ctx.sfx.win(); else if (e.removed) ctx.sfx.capture(); else ctx.sfx.place() }
      if (v.turn !== ctx.me.id) sel = null
      const myTeam = v.teams[ctx.me.id]
      info.replaceChildren(el("span", {}, ctx.L(`Butuh ${v.need} sequence · `, `Need ${v.need} sequence${v.need > 1 ? "s" : ""} · `)),
        ...[...new Set(Object.values(v.teams))].map((t) => el("span", { class: "pill", style: { background: TEAM[t], color: "#fff", marginRight: "4px" } },
          `${TEAM_NAME[t][ctx.L(0, 1)]}${t === myTeam ? ctx.L(" (kamu)", " (you)") : ""}: ${(v.seqs[String(t)] || []).length}`)))
      draw()
      status(ctx, st, v, { mine: ctx.L("Giliranmu — pilih kartu", "Your turn — pick a card") })
    },
    scores: (v) => Object.fromEntries(Object.entries(v.teams).map(([p, t]) => [p, `●${(v.seqs[String(t)] || []).length}`])),
  }
}
