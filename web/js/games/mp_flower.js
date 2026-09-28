// Talking Flower Says: red caps and green caps; stand or squat exactly as told.
// Don't move when the order isn't for your cap! Three mistakes and you're out.
import { el, svg } from "../lib.js?v=__VERSION__"
import { banner, flower, kit, loop, popText } from "./mp.js?v=__VERSION__"

const CAP = { red: "#e5484d", green: "#3fa66a" }

export function mount(stage, ctx) {
  const K = kit(stage, ctx)
  const box = el("div", { class: "mp", style: { background: "linear-gradient(#a8e6ff 0%, #d9f6ff 55%, #7fd36b 56%, #5fbf5a 100%)" } })
  const q = el("div", { class: "mp-q" })
  const btns = el("div", { class: "mp-btns", style: { "--n": 2 } })
  const note = el("div", { class: "mp-note" })
  stage.append(box, q, btns, note)
  const g = svg("svg", { viewBox: "0 0 100 80" })
  for (const [x, c] of [[8, "#ff8fb1"], [18, "#ffd84a"], [84, "#b48cff"], [93, "#ff8fb1"]]) g.append(svg("g", { transform: `translate(${x} 47)` },
    svg("line", { y1: 0, y2: 8, stroke: "#3f9d4a", "stroke-width": 0.8 }), ...[0, 72, 144, 216, 288].map((a) => svg("ellipse", { cy: -2, rx: 1.4, ry: 2.4, fill: c, transform: `rotate(${a})` })), svg("circle", { r: 1.2, fill: "#fff3a0" })))
  const fl = svg("g", { transform: "translate(50 22) scale(.9)" })
  fl.append(flower(0))
  const mouth = fl.querySelector(".mp-mouth")
  const bubble = svg("g", { transform: "translate(50 4)" })
  const bubbleBg = svg("rect", { x: -34, y: -1, width: 68, height: 11, rx: 5.5, fill: "#fff", stroke: "#1d2340", "stroke-width": 0.6 })
  const bubbleT = svg("text", { y: 5.4, "text-anchor": "middle", "dominant-baseline": "central", "font-size": 4.6, "font-weight": 900, fill: "#1d2340" })
  bubble.append(bubbleBg, bubbleT)
  const peopleG = svg("g")
  g.append(fl, peopleG, bubble)
  box.append(g)
  let V = null, cmdAt = 0, P = {}

  function drawPeople(v) {
    peopleG.replaceChildren()
    P = {}
    const seats = ctx.seats()
    const w = 100 / seats.length
    seats.forEach((p, i) => {
      const x = w * i + w / 2
      const out = !(v.alive || []).includes(p.id)
      const grp = svg("g", { opacity: out ? 0.35 : 1 })
      const body = svg("g")
      const cap = CAP[(v.caps || {})[p.id]] || "#999"
      body.append(
        svg("rect", { x: -4.5, y: -12, width: 9, height: 12, rx: 3.5, fill: p.color, stroke: "#1d2340", "stroke-width": 0.5 }),
        svg("circle", { cy: -17, r: 5.4, fill: "#fff3df", stroke: "#1d2340", "stroke-width": 0.5 }),
        svg("text", { y: -16.6, "text-anchor": "middle", "dominant-baseline": "central", "font-size": 6.4, text: p.avatar }),
        svg("path", { d: "M-6 -20 Q -5.5 -27 0 -27 Q 5.5 -27 6 -20 L 8.5 -19.4 Q 0 -18 -6 -20 Z", fill: cap, stroke: "#1d2340", "stroke-width": 0.5 }),
        svg("circle", { cy: -23.6, r: 1.9, fill: "#fff" }),
        svg("text", { y: -23.4, "text-anchor": "middle", "dominant-baseline": "central", "font-size": 2.4, "font-weight": 900, fill: cap, text: (v.caps || {})[p.id] === "red" ? "M" : "L" }))
      const hearts = svg("text", { y: 7, "text-anchor": "middle", "font-size": 3.6, text: out ? "💀" : "❤️".repeat(Math.max(0, (v.hearts || {})[p.id] || 0)) })
      grp.append(svg("ellipse", { cy: 0.4, rx: 6, ry: 1.3, fill: "rgba(0,0,0,.2)" }), body, hearts)
      if (p.id === ctx.me.id) grp.append(svg("text", { y: -31, "text-anchor": "middle", "font-size": 4, "font-weight": 900, fill: "#1d2340", text: ctx.L("KAMU", "YOU") }))
      peopleG.append(svg("g", { transform: `translate(${x} 70)` }, grp))
      P[p.id] = { body, x }
    })
  }

  function cmdText(c, lang) {
    if (!c) return ""
    if (c.kind === "swap") return lang === "en" ? "Swap caps! 🔄" : "Tukar topi! 🔄"
    const who = c.target === "all" ? (lang === "en" ? "EVERYONE" : "SEMUA") : c.target === "red" ? (lang === "en" ? "RED caps" : "Topi MERAH") : (lang === "en" ? "GREEN caps" : "Topi HIJAU")
    const act = c.pose === "stand" ? (lang === "en" ? "stand" : "berdiri") : (lang === "en" ? "squat" : "jongkok")
    return `${who}… ${c.neg ? (lang === "en" ? "DON'T " : "JANGAN ") : ""}${act}!`
  }

  function setPose(pose) {
    if (!V || !(V.alive || []).includes(ctx.me.id)) return
    ctx.sfx.swoosh()
    V.pose = { ...V.pose, [ctx.me.id]: pose }   // instant feedback
    paintPoses()
    ctx.send({ pose })
  }

  function paintPoses() {
    for (const [pid, p] of Object.entries(P)) {
      const sq = (V.pose || {})[pid] === "squat"
      p.body.setAttribute("transform", sq ? "translate(0 5) scale(1 .62)" : "")
    }
  }

  const stop = loop(ctx, (now) => {
    if (!V) return
    const talk = V.phase === "cmd" && performance.now() - cmdAt < 700
    mouth.setAttribute("ry", talk ? (0.6 + Math.abs(Math.sin(now * 18)) * 2.6).toFixed(2) : "0.6")
    fl.setAttribute("transform", `translate(50 ${(22 + Math.sin(now * 2) * 0.6).toFixed(2)}) rotate(${(Math.sin(now * 1.5) * 3).toFixed(2)}) scale(.9)`)
  })

  return {
    destroy: stop,
    scores: (v) => v.scores,
    update(v, events) {
      V = v
      K.update(v, events, box)
      drawPeople(v)
      paintPoses()
      const lang = ctx.L("id", "en")
      const txt = v.phase === "cmd" || v.phase === "judge" ? cmdText(v.cmd, lang) : v.phase === "start" ? ctx.L("Dengarkan aku baik-baik~ 🌺", "Listen closely~ 🌺") : ""
      bubbleT.textContent = txt
      const bw = Math.min(96, Math.max(36, [...txt].length * 2.45 + 10))
      bubbleBg.setAttribute("x", -bw / 2); bubbleBg.setAttribute("width", bw)
      bubble.setAttribute("opacity", txt ? 1 : 0)
      const me = ctx.me.id
      const alive = (v.alive || []).includes(me)
      const pose = (v.pose || {})[me]
      btns.replaceChildren(
        el("button", { class: `mp-btn blue${pose === "stand" ? " on" : ""}`, type: "button", disabled: !alive, onclick: () => setPose("stand") }, el("span", { class: "em", text: "⬆️" }), el("span", { text: ctx.L("BERDIRI", "STAND") })),
        el("button", { class: `mp-btn red${pose === "squat" ? " on" : ""}`, type: "button", disabled: !alive, onclick: () => setPose("squat") }, el("span", { class: "em", text: "⬇️" }), el("span", { text: ctx.L("JONGKOK", "SQUAT") })))
      const cap = (v.caps || {})[me]
      q.replaceChildren(el("span", { text: cap ? ctx.L(`Topimu: ${cap === "red" ? "🔴 MERAH" : "🟢 HIJAU"}`, `Your cap: ${cap === "red" ? "🔴 RED" : "🟢 GREEN"}`) : "" }),
        el("small", { text: ctx.L("Kalau perintahnya bukan untuk topimu — JANGAN bergerak!", "If the order isn't for your cap — DON'T move!") }))
      note.textContent = alive ? "" : ctx.L("Kamu keluar — tonton yang lain 🌺", "You're out — watch the others 🌺")
      for (const e of events) {
        if (e.e === "cmd") { cmdAt = performance.now(); ctx.sfx.boop(); bubble.classList.remove("mp-flash"); void bubble.getBBox; bubble.classList.add("mp-flash") }
        if (e.e === "judge") {
          if ((e.miss || []).includes(me)) { ctx.sfx.buzz(); banner(box, ctx.L("SALAH!", "OOPS!"), { kind: "bad", ms: 900 }) }
          else if (alive && v.cmd && v.cmd.kind !== "swap") ctx.sfx.blip()
          ;(e.miss || []).filter((p) => p !== me).forEach((p) => P[p] && popText(box, "❌", P[p].x, 55, "bad"))
          if (v.cmd && v.cmd.kind === "swap") ctx.sfx.ladder()
        }
      }
    },
  }
}
