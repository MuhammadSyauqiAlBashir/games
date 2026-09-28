// Lost and Pound: one player hides in a hole, the others choose where the hammer strikes.
// Everyone takes a turn hiding. Dodge = +3 for the hider; hit = +1 for each striker on target.
import { el, svg } from "../lib.js?v=__VERSION__"
import { banner, clamp, easeOut, hammer, kit, loop, popText } from "./mp.js?v=__VERSION__"

export function mount(stage, ctx) {
  const K = kit(stage, ctx)
  const box = el("div", { class: "mp", style: { background: "linear-gradient(#ffe9a8,#ffc75a)" } })
  const q = el("div", { class: "mp-q" })
  const btns = el("div", { class: "mp-btns" })
  const note = el("div", { class: "mp-note" })
  stage.append(box, q, btns, note)
  const g = svg("svg", { viewBox: "0 0 100 76" })
  for (let i = 0; i < 12; i++) g.append(svg("path", { d: `M50 30 L ${i * 10 - 10} -5 L ${i * 10} -5 Z`, fill: i % 2 ? "rgba(255,255,255,.25)" : "rgba(255,160,40,.18)" }))
  g.append(svg("rect", { x: 4, y: 44, width: 92, height: 30, rx: 6, fill: "#3b6cf2", stroke: "#1d3a9e", "stroke-width": 1.2 }),
    svg("rect", { x: 4, y: 44, width: 92, height: 6, rx: 3, fill: "#6b93ff" }))
  const holesG = svg("g"), hamG = svg("g"), marks = svg("g"), fx = svg("g")
  g.append(holesG, marks, hamG, fx)
  box.append(g)
  let V = null, hk = "", H = [], revealed = null

  function xs(n) { return n === 3 ? [25, 50, 75] : [17, 39, 61, 83] }

  function build(v) {
    holesG.replaceChildren()
    H = xs(v.holes).map((x, i) => {
      const mole = svg("g", { opacity: 0 })
      const moleClip = svg("g", {}, mole)
      const hole = svg("g", { transform: `translate(${x} 60)` },
        svg("ellipse", { rx: 9, ry: 4.2, fill: "#1b1f33" }),
        moleClip,
        svg("path", { d: "M-9 0 A 9 4.2 0 0 0 9 0 L 9 3 A 9 4.2 0 0 1 -9 3 Z", fill: "#3b6cf2" }),
        svg("ellipse", { rx: 9, ry: 4.2, fill: "none", stroke: "#ffd400", "stroke-width": 0.8 }))
      const tap = svg("rect", { x: x - 10.5, y: 36, width: 21, height: 36, fill: "transparent", class: "mp-tap" })
      tap.addEventListener("click", () => choose(i))
      holesG.append(hole, tap)
      return { x, mole }
    })
    hamG.replaceChildren()
  }

  function choose(i) {
    if (!V || V.phase !== "choose") return
    ctx.sfx.click()
    ctx.send({ hole: i })
  }

  const stop = loop(ctx, (now) => {
    if (!V || !H.length) return
    const reveal = V.phase === "reveal" || (V.phase === "finish" && V.result)
    if (!reveal) {
      hamG.replaceChildren()
      H.forEach((h) => h.mole.setAttribute("opacity", 0))
      return
    }
    const t = now - V.t0
    if (revealed !== V.round) {
      revealed = V.round
      hamG.replaceChildren()
      const struck = [...new Set(Object.values(V.strikes || {}).filter((x) => x != null))]
      struck.forEach((i) => { const hm = svg("g", {}, hammer()); hm.dataset.i = i; hamG.append(hm) })
      H.forEach((h, i) => {
        h.mole.replaceChildren()
        if (i === V.hide) {
          const p = ctx.player(V.hider)
          h.mole.append(svg("circle", { r: 6, fill: p.color, stroke: "#fff", "stroke-width": 0.8 }), svg("text", { "text-anchor": "middle", "dominant-baseline": "central", "font-size": 7, text: p.avatar }))
        }
      })
    }
    // mole pops up at 0.35 s, hammers swing down at 0.8 s
    H.forEach((h, i) => {
      if (i !== V.hide) return
      const up = easeOut(clamp((t - 0.35) / 0.25))
      const squash = V.result && V.result.hit ? clamp((t - 1.0) / 0.15) : 0
      h.mole.setAttribute("opacity", up > 0 ? 1 : 0)
      h.mole.setAttribute("transform", `translate(0 ${(-6 * up + squash * 4).toFixed(2)}) scale(1 ${(1 - squash * 0.45).toFixed(2)})`)
    })
    for (const hm of hamG.children) {
      const i = Number(hm.dataset.i)
      const sw = clamp((t - 0.7) / 0.3)
      const e = sw * sw
      hm.setAttribute("transform", `translate(${H[i].x} ${(16 + 31 * e).toFixed(2)}) rotate(${(-28 * (1 - e)).toFixed(1)}) rotate(180)`)
    }
    if (t > 1.0 && fx.dataset.r !== String(V.round)) {
      fx.dataset.r = String(V.round)
      if (V.result && V.result.hit) {
        ctx.sfx.thud()
        popText(box, "💫 BONK!", H[V.hide].x, 55, "bad")
        box.classList.remove("mp-shake"); void box.offsetWidth; box.classList.add("mp-shake")
      } else { ctx.sfx.boop(); popText(box, ctx.L("😜 Luput!", "😜 Missed!"), H[V.hide].x, 55) }
    }
  })

  function drawMarks(v) {
    marks.replaceChildren()
    const pos = xs(v.holes)
    const by = {}
    for (const [p, h] of Object.entries(v.strikes || {})) if (h != null) (by[h] = by[h] || []).push(p)
    for (const [h, ps] of Object.entries(by)) ps.forEach((p, k) => marks.append(svg("text", { x: pos[h] - (ps.length - 1) * 3 + k * 6, y: 41, "text-anchor": "middle", "font-size": 5.4, text: ctx.player(p).avatar })))
    if (v.hide != null && v.phase === "choose") marks.append(svg("text", { x: pos[v.hide], y: 69, "text-anchor": "middle", "font-size": 5, text: "🫥" }))
  }

  return {
    destroy: stop,
    scores: (v) => v.scores,
    update(v, events) {
      V = v
      K.update(v, events, box)
      if (`${v.holes}` !== hk) { hk = `${v.holes}`; build(v) }
      drawMarks(v)
      const me = ctx.me.id
      const hiding = v.hider === me
      const mineHole = hiding ? v.hide : (v.strikes || {})[me]
      btns.style.setProperty("--n", v.holes)
      btns.replaceChildren(...Array.from({ length: v.holes }, (_, i) => el("button", { class: `mp-btn ${hiding ? "blue" : "red"}${mineHole === i ? " on" : ""}`, type: "button", disabled: v.phase !== "choose",
        onclick: () => choose(i) }, el("span", { class: "em", text: hiding ? "🕳️" : "🔨" }), el("span", { class: "lab", text: `${i + 1}` }))))
      const hp = ctx.player(v.hider)
      const hearts = "❤️".repeat(Math.max(0, v.lives)) + "🤍".repeat(Math.max(0, 3 - v.lives))
      q.replaceChildren(hiding ? ctx.L("Kamu yang sembunyi! Pilih lubang 🕳️", "You're hiding! Pick a hole 🕳️") : ctx.L(`${hp.avatar} ${hp.name} sembunyi — pukul lubang yang mana? 🔨`, `${hp.avatar} ${hp.name} is hiding — where will you strike? 🔨`),
        el("small", { text: `${hp.avatar} ${hearts}  ·  ${ctx.L("Lolos = +3, kena = +1 per pemukul", "Dodge = +3, hit = +1 per striker")}` }))
      note.textContent = v.phase === "choose" ? (hiding ? ctx.L("Pemukul bisa lihat pilihan sesama pemukul — kamu tidak 😏", "Strikers can see each other's picks — you can't 😏")
        : ctx.L("Kamu bisa lihat pilihan pemukul lain (avatar di atas lubang). Kompak ya!", "You can see the other strikers' picks (avatars above the holes). Team up!")) : ""
      for (const e of events) {
        if (e.e === "round") { ctx.sfx.pop(); if (e.hider === me) banner(box, ctx.L("SEMBUNYI!", "HIDE!"), { kind: "good", ms: 1100 }) }
        if (e.e === "reveal") ctx.sfx.drum()
      }
    },
  }
}
