// Rocky Rope Race: climb the cave wall bar by bar. Alone you alternate LEFT and RIGHT hands; in a 2v2 team you
// and your partner take turns. Same hand (or same player) twice = you slip!
import { el, svg } from "../lib.js?v=__VERSION__"
import { banner, kit, loop, popText } from "./mp.js?v=__VERSION__"

export function mount(stage, ctx) {
  const K = kit(stage, ctx, { scoreLabel: "🪜" })
  const box = el("div", { class: "mp", style: { background: "linear-gradient(#4a3a2a,#2a1f14)" } })
  const q = el("div", { class: "mp-q" })
  const ctrl = el("div", { class: "mp-ctrl" })
  stage.append(box, q, ctrl)
  const g = svg("svg", { viewBox: "0 0 100 90" })
  box.append(g)
  const wall = svg("g"), climbers = svg("g")
  g.append(wall, climbers)
  let V = null, built = ""

  function build(v) {
    wall.replaceChildren()
    const T = v.teams.length, w = 90 / T
    for (let t = 0; t < T; t++) {
      const x = 5 + t * w + w / 2
      for (let b = 0; b <= v.bars; b++) { const y = 84 - (b / v.bars) * 76; wall.append(svg("line", { x1: x - 6, y1: y, x2: x + 6, y2: y, stroke: b === v.bars ? "#ffd400" : "#8a7a64", "stroke-width": b === v.bars ? 1.4 : 0.9, "stroke-linecap": "round" })) }
    }
    wall.append(svg("text", { x: 50, y: 5, "text-anchor": "middle", "font-size": 4, "font-weight": 900, fill: "#ffd400", text: "🏁" }))
  }
  function send(h) { if (V && V.phase === "play") { ctx.sfx.click(); ctx.send(h ? { h } : {}) } }
  const stop = loop(ctx, (now) => {
    if (!V) return
    const T = V.teams.length, w = 90 / T
    climbers.replaceChildren(...V.teams.map((team, t) => {
      const x = 5 + t * w + w / 2, y = 84 - (V.bar[t] / V.bars) * 76
      const stunned = V.stun[t] > now
      return svg("g", { transform: `translate(${x} ${y + 4})` }, ...team.map((p, k) => svg("g", { transform: `translate(${(k - (team.length - 1) / 2) * 7} ${stunned ? Math.sin(now * 30) : 0})` },
        svg("circle", { r: 3.4, fill: ctx.color(p), stroke: team.includes(ctx.me.id) ? "#ffd400" : "#fff", "stroke-width": 0.7 }), svg("text", { "text-anchor": "middle", "dominant-baseline": "central", "font-size": 4.2, text: ctx.player(p).avatar }))),
      stunned ? svg("text", { y: -6, "text-anchor": "middle", "font-size": 4, text: "💫" }) : null)
    }))
  })
  return {
    destroy: stop,
    scores: (v) => v.scores,
    update(v, events) {
      V = v
      K.update(v, events, box)
      const key = `${v.teams.length}:${v.bars}`
      if (key !== built) { built = key; build(v) }
      const t = v.teams.findIndex((tm) => tm.includes(ctx.me.id))
      const team = v.teams[t] || []
      const solo = team.length === 1
      const exp = v.expect[t]
      if (!ctrl.dataset.mode || ctrl.dataset.mode !== (solo ? "solo" : "team")) {
        ctrl.dataset.mode = solo ? "solo" : "team"
        ctrl.replaceChildren()
        if (solo) {
          for (const h of ["L", "R"]) { const b = el("button", { class: `mp-btn huge ${h === "L" ? "red" : "blue"}`, type: "button" }, el("span", { text: h === "L" ? ctx.L("✋ KIRI", "✋ LEFT") : ctx.L("KANAN 🤚", "RIGHT 🤚") })); b.addEventListener("pointerdown", (e) => { e.preventDefault(); send(h) }); ctrl.append(b) }
        } else { const b = el("button", { class: "mp-btn huge green", type: "button" }, el("span", { text: ctx.L("RAIH! ✊", "GRAB! ✊") })); b.addEventListener("pointerdown", (e) => { e.preventDefault(); send(null) }); ctrl.append(b) }
      }
      q.replaceChildren(solo ? ctx.L(`Gantian KIRI–KANAN! ${exp ? (exp === "L" ? "Sekarang: KANAN" : "Sekarang: KIRI") : ""}`, `Alternate LEFT–RIGHT! ${exp ? (exp === "L" ? "Next: RIGHT" : "Next: LEFT") : ""}`)
        : exp === ctx.me.id ? ctx.L("Giliran PARTNER-mu! Tunggu…", "Your PARTNER's turn! Wait…") : ctx.L("Giliranmu — RAIH!", "Your turn — GRAB!"),
      el("small", { text: ctx.L("Tangan/pemain yang sama 2× = tergelincir 💫", "Same hand/player twice = slip 💫") }))
      for (const e of events) {
        if (e.e === "slip" && e.team === t) { ctx.sfx.wrong(); popText(box, ctx.L("Tergelincir!", "Slipped!"), 50, 50, "bad") }
        if (e.e === "top") { if (e.team === t) { ctx.sfx.fanfare(); banner(box, ctx.L("SAMPAI!", "TOP!"), { kind: "good" }) } else ctx.sfx.ding() }
      }
    },
  }
}
