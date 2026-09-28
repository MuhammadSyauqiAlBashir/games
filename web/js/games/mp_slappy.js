// Slappy-Go-Round: press SLAP to send the giant hand around the circle — everyone else must jump over it.
// If they all clear it, it comes back and slaps YOU. 5 slaps and you're out.
import { el, svg } from "../lib.js?v=__VERSION__"
import { banner, kit, loop, popText } from "./mp.js?v=__VERSION__"

const RING = 32

export function mount(stage, ctx) {
  const K = kit(stage, ctx, { scoreLabel: "❤️" })
  const box = el("div", { class: "mp", style: { background: "radial-gradient(circle, #ffd9a8, #b86b2b)" } })
  const q = el("div", { class: "mp-q" })
  const ctrl = el("div", { class: "mp-ctrl" })
  stage.append(box, q, ctrl)
  const g = svg("svg", { viewBox: "0 0 100 100", style: "touch-action:none" })
  box.append(g)
  g.append(svg("circle", { cx: 50, cy: 50, r: 44, fill: "#f3e2c0", stroke: "#8a5a2b", "stroke-width": 1.2 }))
  const hand = svg("g", { opacity: 0 }, svg("rect", { x: 0, y: -2, width: 30, height: 4, rx: 2, fill: "#8d94a3" }), svg("text", { x: 34, y: 0.5, "text-anchor": "middle", "dominant-baseline": "central", "font-size": 12, transform: "rotate(90 34 0)", text: "🖐️" }))
  const peopleG = svg("g")
  g.append(hand, svg("circle", { cx: 50, cy: 50, r: 5, fill: "#6b7385" }), peopleG)
  const slap = el("button", { class: "mp-btn huge red", type: "button" }, el("span", { text: ctx.L("TAMPAR! 🖐️", "SLAP! 🖐️") }))
  const jumpB = el("button", { class: "mp-btn huge blue", type: "button" }, el("span", { text: ctx.L("LOMPAT ⬆️", "JUMP ⬆️") }))
  slap.addEventListener("pointerdown", (e) => { e.preventDefault(); if (V && V.phase === "play") { ctx.sfx.click(); ctx.send({ do: "slap" }) } })
  jumpB.addEventListener("pointerdown", (e) => { e.preventDefault(); jump() })
  g.addEventListener("pointerdown", (e) => { e.preventDefault(); jump() })
  ctrl.append(slap, jumpB)
  let V = null, P = new Map(), localJump = 0
  const kd = (e) => { if (e.code === "Space") { e.preventDefault(); jump() } if (e.key === "s") ctx.send({ do: "slap" }) }
  document.addEventListener("keydown", kd)

  function jump() {
    if (!V || V.phase !== "play" || !(V.alive || []).includes(ctx.me.id)) return
    if (performance.now() - localJump < (V.air + 0.15) * 1000) return
    localJump = performance.now(); ctx.sfx.swoosh()
    ctx.send({ t: ctx.now() })
  }
  const stop = loop(ctx, (now) => {
    if (!V) return
    const h = V.hand
    if (h) {
      const prog = Math.min(1, (now - h.t) / V.lap)
      const a = (V.ang[h.by] || 0) + prog * 360
      hand.setAttribute("opacity", 1)
      hand.setAttribute("transform", `translate(50 50) rotate(${a.toFixed(2)})`)
    } else hand.setAttribute("opacity", 0)
    for (const p of ctx.seats()) {
      let node = P.get(p.id)
      if (!node) { node = svg("g", {}, svg("ellipse", { rx: 4, ry: 1.4, fill: "rgba(0,0,0,.25)" }), svg("g", { class: "b" }, svg("circle", { r: 5, fill: p.color, stroke: p.id === ctx.me.id ? "#ffd400" : "#fff", "stroke-width": 0.9 }), svg("text", { "text-anchor": "middle", "dominant-baseline": "central", "font-size": 6, text: p.avatar })), svg("text", { class: "hp", y: 10, "text-anchor": "middle", "font-size": 3.2 })); peopleG.append(node); P.set(p.id, node) }
      const a = ((V.ang || {})[p.id] || 0) * Math.PI / 180
      const mine = p.id === ctx.me.id
      const j = (V.jump || {})[p.id]
      const since = mine ? (performance.now() - localJump) / 1000 : j != null ? now - j : 9
      const hgt = since >= 0 && since < V.air ? Math.sin((since / V.air) * Math.PI) * 7 : 0
      node.setAttribute("transform", `translate(${(50 + Math.cos(a) * (RING + 6)).toFixed(2)} ${(50 + Math.sin(a) * (RING + 6)).toFixed(2)})`)
      node.querySelector(".b").setAttribute("transform", `translate(0 ${(-hgt).toFixed(2)})`)
      node.querySelector(".hp").textContent = "❤️".repeat(Math.max(0, V.hp - (V.dmg || {})[p.id]))
      node.setAttribute("opacity", (V.alive || []).includes(p.id) ? 1 : 0.25)
    }
    const cd = (V.cool || {})[ctx.me.id]
    slap.disabled = !!V.hand || (cd && now < cd) || V.phase !== "play"
  })
  return {
    destroy() { stop(); document.removeEventListener("keydown", kd) },
    scores: (v) => v.scores,
    update(v, events) {
      V = v
      K.update(v, events, box)
      q.replaceChildren(ctx.L("TAMPAR untuk memutar tangan · LOMPAT saat tangan lewat!", "SLAP to spin the hand · JUMP when it reaches you!"),
        el("small", { text: ctx.L("Kalau semua berhasil lompat, tangannya balik menampar si pemutar 😆", "If everyone clears it, it comes back and slaps the spinner 😆") }))
      for (const e of events) {
        if (e.e === "spin") ctx.sfx.whoosh()
        if (e.e === "slap") { ctx.sfx.thud(); if (e.who === ctx.me.id) { banner(box, "SLAP!", { kind: "bad", ms: 900 }); box.classList.remove("mp-shake"); void box.offsetWidth; box.classList.add("mp-shake") } else popText(box, `${ctx.player(e.who).avatar} 💥`, 50, 40, "bad") }
        if (e.e === "backfire") popText(box, ctx.L("Senjata makan tuan! 😆", "Backfire! 😆"), 50, 60, "bad")
      }
    },
  }
}
