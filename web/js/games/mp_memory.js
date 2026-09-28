// Knock-Knock Match: knock on two doors; matching characters = keep the pair and knock again.
import { el, svg } from "../lib.js?v=__VERSION__"
import { banner, kit, loop, popText } from "./mp.js?v=__VERSION__"

export function mount(stage, ctx) {
  const K = kit(stage, ctx, { scoreLabel: "🚪" })
  const box = el("div", { class: "mp", style: { background: "linear-gradient(#5b3a8c,#2d1d4a)" } })
  const q = el("div", { class: "mp-q" })
  const note = el("div", { class: "mp-note" })
  stage.append(box, q, note)
  const g = svg("svg", { viewBox: "0 0 100 84" })
  for (let y = 0; y < 84; y += 7) for (let x = (y / 7) % 2 ? -6 : 0; x < 100; x += 12) g.append(svg("rect", { x: x + 0.3, y: y + 0.3, width: 11.4, height: 6.4, rx: 0.8, fill: "rgba(255,255,255,.05)" }))
  const doorsG = svg("g")
  g.append(doorsG)
  box.append(g)
  let V = null, D = [], nk = 0, knockAt = {}

  function build(n) {
    doorsG.replaceChildren()
    const cols = 4, rows = n / cols
    const w = 19, h = rows === 3 ? 24 : 18.5, gx = 4.5, gy = rows === 3 ? 3.5 : 2
    const ox = (100 - cols * w - (cols - 1) * gx) / 2, oy = (84 - rows * h - (rows - 1) * gy) / 2
    D = Array.from({ length: n }, (_, i) => {
      const x = ox + (i % cols) * (w + gx), y = oy + Math.floor(i / cols) * (h + gy)
      const behind = svg("g", {}, svg("rect", { x: 0, y: 0, width: w, height: h, rx: 2, fill: "#fff6d8", stroke: "#e2b04a", "stroke-width": 0.6 }),
        svg("text", { x: w / 2, y: h / 2, "text-anchor": "middle", "dominant-baseline": "central", "font-size": Math.min(w, h) * 0.62 }))
      const door = svg("g", {},
        svg("rect", { x: 0, y: 0, width: w, height: h, rx: 2, fill: "#b86b2b", stroke: "#5b3212", "stroke-width": 0.7 }),
        svg("rect", { x: 2, y: 2, width: w - 4, height: h / 2 - 3, rx: 1, fill: "#a45d22" }), svg("rect", { x: 2, y: h / 2 + 1, width: w - 4, height: h / 2 - 3, rx: 1, fill: "#a45d22" }),
        svg("circle", { cx: w - 3.6, cy: h / 2, r: 1.1, fill: "#f6c945" }),
        svg("text", { x: w / 2, y: h / 2, "text-anchor": "middle", "dominant-baseline": "central", "font-size": 4.2, "font-weight": 900, fill: "rgba(255,255,255,.35)", text: i + 1 }))
      const owner = svg("g")
      const grp = svg("g", { transform: `translate(${x} ${y})` }, behind, door, owner)
      const tap = svg("rect", { x, y, width: w, height: h, fill: "transparent", class: "mp-tap" })
      tap.addEventListener("click", () => knock(i))
      doorsG.append(grp, tap)
      return { x, y, w, h, grp, door, behind, char: behind.querySelector("text"), owner, open: 0 }
    })
  }

  function knock(i) {
    if (!V || V.phase !== "pick" || V.turn !== ctx.me.id) return
    if (V.found[String(i)] || (V.open || []).includes(i)) return
    ctx.send({ door: i })
  }

  const stop = loop(ctx, () => {
    if (!V) return
    const t = performance.now()
    D.forEach((d, i) => {
      const shown = V.shown && V.shown[String(i)] !== undefined
      d.open += ((shown ? 1 : 0) - d.open) * 0.22
      const sh = knockAt[i] && t - knockAt[i] < 260 ? Math.sin((t - knockAt[i]) / 26) * 0.8 : 0
      // the door swings open to the left (scaleX toward 0 around its hinge)
      const sx = Math.max(0.08, 1 - d.open * 0.92)
      d.door.setAttribute("transform", `translate(${sh.toFixed(2)} 0) scale(${sx.toFixed(3)} 1)`)
    })
  })

  return {
    destroy: stop,
    scores: (v) => v.scores,
    update(v, events) {
      V = v
      K.update(v, events, box)
      if (v.n !== nk) { nk = v.n; build(v.n) }
      D.forEach((d, i) => {
        const c = v.shown && v.shown[String(i)]
        if (c && d.char.textContent !== c) d.char.textContent = c
        const who = v.found[String(i)]
        d.owner.replaceChildren()
        if (who) {
          const p = ctx.player(who)
          d.owner.append(svg("rect", { x: 0, y: 0, width: d.w, height: d.h, rx: 2, fill: "none", stroke: p.color, "stroke-width": 1.2 }),
            svg("circle", { cx: d.w - 3.2, cy: 3.2, r: 2.8, fill: p.color, stroke: "#fff", "stroke-width": 0.4 }),
            svg("text", { x: d.w - 3.2, y: 3.3, "text-anchor": "middle", "dominant-baseline": "central", "font-size": 3.2, text: p.avatar }))
        }
      })
      const mine = v.turn === ctx.me.id && v.phase === "pick"
      const tp = ctx.player(v.turn)
      q.replaceChildren(mine ? ctx.L(`Giliranmu! Ketuk ${(v.open || []).length ? "pintu kedua" : "dua pintu"} 🚪`, `Your turn! Knock on ${(v.open || []).length ? "a second door" : "two doors"} 🚪`)
        : v.phase === "start" ? ctx.L("Ingat-ingat siapa di balik pintu!", "Remember who's behind each door!") : ctx.L(`Giliran ${tp.avatar} ${tp.name}…`, `${tp.avatar} ${tp.name}'s turn…`),
      el("small", { text: ctx.L(`Pasangan ditemukan: ${Object.keys(v.found).length / 2}/${v.pairs} · Cocok = jalan lagi`, `Pairs found: ${Object.keys(v.found).length / 2}/${v.pairs} · Match = go again`) }))
      box.style.boxShadow = mine ? "0 0 0 4px #ffd400, var(--shadow-lg)" : ""
      note.textContent = ""
      for (const e of events) {
        if (e.e === "knock") { knockAt[e.door] = performance.now(); ctx.sfx.knock() }
        if (e.e === "match") { ctx.sfx.ding(); popText(box, `${e.char} ✓`, 50, 40); if (e.who === ctx.me.id) banner(box, ctx.L("COCOK!", "MATCH!"), { kind: "good", ms: 1000 }) }
        if (e.e === "miss") ctx.sfx.wrong()
        if (e.e === "turn" && e.who === ctx.me.id) ctx.sfx.turn()
      }
    },
  }
}
