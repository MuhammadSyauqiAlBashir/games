// Fast Fishing: reel in the moment the float sinks. Too early and the line snaps (tin can!).
import { el, svg } from "../lib.js?v=__VERSION__"
import { banner, cheep, clamp, kit, loop, popText } from "./mp.js?v=__VERSION__"

export function mount(stage, ctx) {
  const K = kit(stage, ctx, { scoreLabel: "🐟", pointsOf: (v) => v.wins || {} })
  const box = el("div", { class: "mp", style: { background: "linear-gradient(#8fdcff 0%, #8fdcff 30%, #2f8fd6 31%, #145a9e 100%)" } })
  const q = el("div", { class: "mp-q" })
  const btns = el("div", { class: "mp-btns", style: { "--n": 1 } })
  const note = el("div", { class: "mp-note" })
  stage.append(box, q, btns, note)
  const g = svg("svg", { viewBox: "0 0 100 76" })
  g.append(svg("ellipse", { cx: 20, cy: 22, rx: 26, ry: 6, fill: "#6fc96a" }), svg("ellipse", { cx: 84, cy: 22, rx: 22, ry: 5, fill: "#5fbf5a" }))
  const fishG = svg("g")
  for (let k = 0; k < 4; k++) fishG.append(svg("ellipse", { rx: 5, ry: 2, fill: "rgba(10,40,80,.35)" }))
  g.append(fishG)
  const lines = svg("g"), fx = svg("g")
  g.append(svg("rect", { x: 0, y: 66, width: 100, height: 10, fill: "#9a6536" }))
  for (let x = 0; x < 100; x += 10) g.append(svg("rect", { x: x + 0.3, y: 66, width: 9.4, height: 10, fill: x % 20 ? "#a86f3c" : "#9a6536" }))
  g.append(lines, fx)
  box.append(g)
  box.addEventListener("pointerdown", () => reel())
  let V = null, P = [], rk = "", sinkAt = null, sinkRound = null, nibT = 0, lastNib = 0, sent = false

  function build() {
    lines.replaceChildren()
    const seats = ctx.seats()
    P = seats.map((p, i) => {
      const x = (100 / seats.length) * (i + 0.5)
      const rod = svg("line", { x1: x, y1: 70, x2: x + 6, y2: 50, stroke: "#5b3212", "stroke-width": 1, "stroke-linecap": "round" })
      const line = svg("line", { stroke: "rgba(255,255,255,.85)", "stroke-width": 0.35 })
      const bob = svg("g", {}, svg("circle", { r: 1.9, fill: "#fff", stroke: "#333", "stroke-width": 0.3 }), svg("path", { d: "M-1.9 0 A 1.9 1.9 0 0 1 1.9 0 Z", fill: "#e5484d" }))
      const ring = svg("ellipse", { rx: 3, ry: 0.9, fill: "none", stroke: "rgba(255,255,255,.7)", "stroke-width": 0.35 })
      const who = svg("g", { transform: `translate(${x} 71)` }, svg("circle", { r: 4.4, fill: p.color, stroke: "#fff", "stroke-width": 0.6 }), svg("text", { "text-anchor": "middle", "dominant-baseline": "central", "font-size": 5.4, text: p.avatar }))
      const catchG = svg("g", { opacity: 0 })
      lines.append(line, ring, bob, rod, who, catchG)
      return { pid: p.id, x, bx: x + 4, by: 42, rod, line, bob, ring, catchG }
    })
  }

  function reel() {
    if (!V || sent) return
    const me = ctx.me.id
    if ((V.early || []).includes(me) || (V.reeled || []).includes(me)) return
    if (V.phase !== "wait" && V.phase !== "bite") return
    sent = true
    ctx.sfx.reel()
    if (V.phase === "bite" && sinkAt) ctx.send({ rt: (performance.now() - sinkAt) / 1000 })
    else ctx.send({ early: true })
  }

  const stop = loop(ctx, (now) => {
    if (!V || !P.length) return
    const bite = V.phase === "bite"
    const res = V.phase === "result" || V.phase === "finish"
    const nib = performance.now() - nibT < 450
    ;[...fishG.children].forEach((f, k) => f.setAttribute("transform", `translate(${(50 + Math.sin(now * 0.7 + k * 2) * 38).toFixed(2)} ${(52 + k * 3 + Math.sin(now * 1.3 + k) * 2).toFixed(2)}) scale(${Math.cos(now * 0.7 + k * 2) > 0 ? 1 : -1} 1)`))
    for (const p of P) {
      let dip = Math.sin(now * 2.2 + p.x) * 0.4
      if (nib) dip += Math.sin((performance.now() - nibT) / 45) * 1.2
      if (bite) dip = 3.2 + Math.sin(now * 20) * 0.5
      const snapped = (V.early || []).includes(p.pid)
      const pulled = res && V.winner === p.pid
      const t = res ? now - V.t0 : 0
      let bx = p.bx, by = p.by + dip
      if (pulled) { const k = clamp(t / 0.7); bx = p.bx + (p.x + 6 - p.bx) * k; by = p.by - Math.sin(k * Math.PI) * 26 + (50 - p.by) * k }
      p.bob.setAttribute("transform", `translate(${bx.toFixed(2)} ${by.toFixed(2)})`)
      p.bob.setAttribute("opacity", snapped ? 0.25 : 1)
      p.ring.setAttribute("cx", p.bx); p.ring.setAttribute("cy", p.by + 1.4)
      p.ring.setAttribute("opacity", bite || nib ? 1 : 0.35)
      p.line.setAttribute("x1", p.x + 6); p.line.setAttribute("y1", 50); p.line.setAttribute("x2", bx); p.line.setAttribute("y2", by)
      p.line.setAttribute("opacity", snapped ? 0 : 1)
      p.rod.setAttribute("x2", (p.x + (pulled ? 2 : 6)).toFixed(2)); p.rod.setAttribute("y2", pulled ? 44 : 50)
      p.catchG.setAttribute("opacity", pulled && t > 0.3 ? 1 : 0)
      if (pulled) p.catchG.setAttribute("transform", `translate(${bx.toFixed(2)} ${(by + 5).toFixed(2)}) rotate(${Math.sin(now * 14) * 20}) scale(.55)`)
    }
  })

  return {
    destroy: stop,
    scores: (v) => v.wins,
    update(v, events) {
      V = v
      K.update(v, events, box)
      if (!P.length || rk !== String(ctx.seats().length)) { rk = String(ctx.seats().length); build() }
      if (v.phase === "bite" && sinkRound !== v.round) { sinkRound = v.round; sinkAt = performance.now() }
      const me = ctx.me.id
      const early = (v.early || []).includes(me), reeled = (v.reeled || []).includes(me)
      if (v.phase === "wait" && !early && !reeled) sent = false
      btns.replaceChildren(el("button", { class: `mp-btn huge ${early ? "gray" : "blue"}`, type: "button", disabled: early || reeled || !["wait", "bite"].includes(v.phase), onclick: reel },
        el("span", { text: early ? ctx.L("Putus! 🥫", "Snapped! 🥫") : reeled ? ctx.L("Ditarik! ✓", "Reeled! ✓") : ctx.L("TARIK! 🎣", "REEL! 🎣") })))
      q.replaceChildren(v.phase === "bite" ? ctx.L("SEKARANG! 🎣", "NOW! 🎣") : v.phase === "wait" ? ctx.L("Tunggu pelampungnya TENGGELAM…", "Wait for the float to SINK…") : ctx.L("Mancing kilat!", "Fast fishing!"),
        el("small", { text: ctx.L(`Tarik terlalu cepat = tali putus. Menang ${v.need}× duluan jadi juara!`, `Too early = the line snaps. First to ${v.need} catches wins!`) }))
      note.replaceChildren()
      if ((v.phase === "result" || v.phase === "finish") && v.rt) {
        note.append(...Object.entries(v.rt).sort((a, b) => a[1] - b[1]).map(([p, rt]) => el("span", { style: { margin: "0 6px" } }, `${ctx.player(p).avatar} ⚡${Math.round(rt * 1000)} ms`)),
          ...(v.early || []).map((p) => el("span", { style: { margin: "0 6px" } }, `${ctx.player(p).avatar} 🥫`)))
      }
      for (const e of events) {
        if (e.e === "cast") { ctx.sfx.plop(); P.forEach((p) => p.catchG.replaceChildren(cheep())) }
        if (e.e === "nibble") { nibT = performance.now(); if (lastNib !== nibT) { lastNib = nibT; ctx.sfx.blip() } }
        if (e.e === "sink") { ctx.sfx.plop(); banner(box, "!", { ms: 700 }) }
        if (e.e === "early" && e.who === me) { ctx.sfx.wrong(); popText(box, "🥫 " + ctx.L("Kaleng!", "Tin can!"), 50, 40, "bad") }
        if (e.e === "catch") {
          if (e.who === me) { ctx.sfx.fanfare(); banner(box, ctx.L("DAPAT!", "GOT IT!"), { kind: "good", ms: 1500 }) }
          else if (e.who) { ctx.sfx.splash(); popText(box, `${ctx.player(e.who).avatar} 🐟`, 50, 30) }
          else banner(box, ctx.L("Kabur!", "Got away!"), { kind: "bad", ms: 1200 })
        }
      }
    },
  }
}
