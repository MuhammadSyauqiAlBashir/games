// Sleight of Shell: Bowser hides Bob-ombs in chests and shuffles them. Pick a safe one or you're out!
import { el, svg } from "../lib.js?v=__VERSION__"
import { banner, bobomb, clamp, ease, easeOut, kit, loop, popText, star } from "./mp.js?v=__VERSION__"

const SX = [22, 50, 78], CY = 52

function bowser() {
  return svg("g", {},
    svg("path", { d: "M-15 6 Q -18 -12 0 -15 Q 18 -12 15 6 Q 0 14 -15 6 Z", fill: "#f2b441", stroke: "#7a4a10", "stroke-width": 0.8 }),
    svg("path", { d: "M-13 -7 L -19 -17 L -9 -11 Z", fill: "#fffbe8", stroke: "#8a7a5a", "stroke-width": 0.5 }),
    svg("path", { d: "M13 -7 L 19 -17 L 9 -11 Z", fill: "#fffbe8", stroke: "#8a7a5a", "stroke-width": 0.5 }),
    svg("path", { d: "M-8 -14 Q -4 -22 0 -15 Q 4 -22 8 -14 Q 3 -12 -8 -14 Z", fill: "#e3402f" }),
    svg("ellipse", { cx: -5, cy: -4, rx: 3.2, ry: 3.6, fill: "#fff" }), svg("ellipse", { cx: 5, cy: -4, rx: 3.2, ry: 3.6, fill: "#fff" }),
    svg("circle", { cx: -4.4, cy: -3.4, r: 1.5, fill: "#b8121f" }), svg("circle", { cx: 4.4, cy: -3.4, r: 1.5, fill: "#b8121f" }),
    svg("path", { d: "M-9 -8.5 L -2 -6.5 M 9 -8.5 L 2 -6.5", stroke: "#7a2a10", "stroke-width": 1.4, "stroke-linecap": "round" }),
    svg("path", { d: "M-9 4 Q 0 12 9 4 Q 0 7 -9 4 Z", fill: "#fff5e0", stroke: "#7a4a10", "stroke-width": 0.5 }),
    svg("path", { d: "M-6 5 L -5 7.5 L -4 5.6 M 4 5.6 L 5 7.5 L 6 5", stroke: "#7a4a10", "stroke-width": 0.4, fill: "#fff" }))
}

export function mount(stage, ctx) {
  const K = kit(stage, ctx, { scoreLabel: "" })
  const box = el("div", { class: "mp", style: { background: "linear-gradient(#2b2440,#15101f)" } })
  const q = el("div", { class: "mp-q" })
  const btns = el("div", { class: "mp-btns" })
  const note = el("div", { class: "mp-note" })
  stage.append(box, q, btns, note)
  const g = svg("svg", { viewBox: "0 0 100 76" })
  for (let y = 0; y < 44; y += 6) for (let x = (y / 6) % 2 ? -5 : 0; x < 100; x += 10) g.append(svg("rect", { x: x + 0.3, y: y + 0.3, width: 9.4, height: 5.4, rx: 0.8, fill: "#3a3350" }))
  g.append(svg("rect", { y: 44, width: 100, height: 32, fill: "#5a4a3a" }), svg("rect", { y: 44, width: 100, height: 1.4, fill: "#7a6650" }))
  g.append(svg("ellipse", { cx: 50, cy: 76, rx: 60, ry: 10, fill: "rgba(255,110,40,.35)" }))
  const bow = svg("g", { transform: "translate(50 17)" }, bowser())
  g.append(bow)
  const chestsG = svg("g"), fx = svg("g"), picksG = svg("g")
  g.append(chestsG, fx, picksG)
  box.append(g)

  const C = [0, 1, 2].map((id) => {
    const lid = svg("g", {}, svg("path", { d: "M-11 0 L -11 -6 Q 0 -11.5 11 -6 L 11 0 Z", fill: "#b86b2b", stroke: "#5b3212", "stroke-width": 0.9 }),
      svg("rect", { x: -2, y: -3, width: 4, height: 4.5, rx: 0.8, fill: "#e7b54a", stroke: "#8a5a12", "stroke-width": 0.4 }))
    const inner = svg("g")
    const grp = svg("g", {},
      svg("ellipse", { cx: 0, cy: 9.6, rx: 11, ry: 2, fill: "rgba(0,0,0,.35)" }),
      svg("rect", { x: -11, y: -4, width: 22, height: 13, rx: 1.5, fill: "#b86b2b", stroke: "#5b3212", "stroke-width": 0.9 }),
      svg("rect", { x: -11, y: 1, width: 22, height: 2, fill: "#e7b54a" }), inner, svg("g", { transform: "translate(0 -4)" }, lid))
    const tap = svg("rect", { x: -13, y: -16, width: 26, height: 28, fill: "transparent", class: "mp-tap" })
    grp.append(tap)
    chestsG.append(grp)
    return { id, grp, lid, inner, tap, x: SX[id], y: CY }
  })
  C.forEach((c) => c.tap.addEventListener("click", () => pickChest(c)))
  let V = null, rk = "", slotOf = [0, 1, 2], boomAt = null

  function pickChest(c) {
    if (!V || V.phase !== "pick" || V.mine != null || !(V.alive || []).includes(ctx.me.id)) return
    layout(1e9)
    const slot = slotOf[c.id]
    ctx.sfx.click()
    ctx.send({ slot })
  }

  function layout(t) {
    // chest positions t seconds into the show phase (replays Bowser's shuffle)
    const slot = [0, 1, 2]  // slot of chest id
    for (const m of V.moves || []) {
      if (t < m.t) break
      const p = clamp((t - m.t) / m.d)
      if (p < 1) {
        const e = ease(p)
        const pos = C.map((c) => [SX[slot[c.id]], CY])
        if (m.k === "swap") {
          const ia = slot.indexOf(m.a), ib = slot.indexOf(m.b)
          pos[ia] = [SX[m.a] + (SX[m.b] - SX[m.a]) * e, CY - Math.sin(e * Math.PI) * 9]
          pos[ib] = [SX[m.b] + (SX[m.a] - SX[m.b]) * e, CY + Math.sin(e * Math.PI) * 5]
        } else {
          for (let i = 0; i < 3; i++) {
            const s0 = slot[i], s1 = (s0 + m.dir + 3) % 3
            const wrap = Math.abs(s1 - s0) === 2
            pos[i] = [SX[s0] + (SX[s1] - SX[s0]) * e, CY + (wrap ? -Math.sin(e * Math.PI) * 14 : Math.sin(e * Math.PI) * 4)]
          }
        }
        return pos
      }
      if (m.k === "swap") { const ia = slot.indexOf(m.a), ib = slot.indexOf(m.b); slot[ia] = m.b; slot[ib] = m.a }
      else for (let i = 0; i < 3; i++) slot[i] = (slot[i] + m.dir + 3) % 3
    }
    slotOf = slot
    return C.map((c) => [SX[slot[c.id]], CY])
  }

  const stop = loop(ctx, (now) => {
    if (!V) return
    const bombs = V.bombs || []
    let lidOpen = 0, pos
    if (V.phase === "show") {
      const t = now - V.t0
      lidOpen = t < 0.5 ? t / 0.5 : t < 1.8 ? 1 : t < 2.2 ? 1 - (t - 1.8) / 0.4 : 0
      pos = t < 2.4 ? C.map((c) => [SX[c.id], CY]) : layout(t)
      C.forEach((c) => c.inner.setAttribute("opacity", t < 2.2 && bombs.includes(c.id) ? 1 : 0))
      bow.setAttribute("transform", `translate(50 ${17 + Math.sin(now * 6) * 0.8}) rotate(${Math.sin(now * 3) * 3})`)
    } else if (V.phase === "reveal" || V.phase === "finish") {
      const t = now - V.t0
      const final = V.final || [0, 1, 2]
      pos = C.map((c) => [SX[final[c.id]], CY])
      lidOpen = clamp(t / 0.4)
      C.forEach((c) => {
        const isBomb = bombs.includes(c.id)
        c.inner.setAttribute("opacity", isBomb && t < 1.0 ? 1 : 0)
      })
      if (t > 1.0 && boomAt !== V.round) {
        boomAt = V.round
        ctx.sfx.boom()
        C.filter((c) => bombs.includes(c.id)).forEach((c) => {
          const x = SX[(V.final || [0, 1, 2])[c.id]]
          const b = svg("g", { transform: `translate(${x} ${CY - 6})` }, svg("circle", { r: 4, fill: "#ffcf3d", class: "mp-boom" }), svg("circle", { r: 2.6, fill: "#fff5c0", class: "mp-boom" }))
          fx.append(b)
          setTimeout(() => b.remove(), 900)
        })
        box.classList.remove("mp-shake"); void box.offsetWidth; box.classList.add("mp-shake")
      }
    } else {
      pos = V.phase === "pick" ? layout(1e9) : C.map((c) => [SX[c.id], CY])
    }
    C.forEach((c, i) => {
      c.x = pos[i][0]; c.y = pos[i][1]
      c.grp.setAttribute("transform", `translate(${pos[i][0].toFixed(2)} ${pos[i][1].toFixed(2)})`)
      c.lid.setAttribute("transform", `translate(${(-2.5 * lidOpen).toFixed(2)} ${(-8 * lidOpen).toFixed(2)}) rotate(${(-24 * lidOpen).toFixed(1)} -11 0)`)
    })
    void easeOut
  })

  function drawPicks(v) {
    picksG.replaceChildren()
    const reveal = v.phase === "reveal" || v.phase === "finish"
    const bySlot = {}
    const src = reveal && v.picks ? v.picks : v.mine != null ? { [ctx.me.id]: v.mine } : {}
    for (const [p, s] of Object.entries(src)) (bySlot[s] = bySlot[s] || []).push(p)
    for (const [s, ps] of Object.entries(bySlot)) ps.forEach((p, k) => {
      const dead = reveal && (v.boom || []).includes(p)
      picksG.append(svg("text", { x: SX[s] - (ps.length - 1) * 3.2 + k * 6.4, y: CY + 19, "text-anchor": "middle", "font-size": 6, opacity: dead ? 0.45 : 1, text: dead ? "💥" : ctx.player(p).avatar }))
    })
  }

  return {
    destroy: stop,
    scores: (v) => v.scores,
    update(v, events) {
      V = v
      K.update(v, events, box)
      const key = `${v.round}`
      if (key !== rk) { rk = key; C.forEach((c) => { c.inner.replaceChildren(svg("g", { transform: "translate(0 -3) scale(.9)" }, bobomb(5))) }) }
      const alive = (v.alive || []).includes(ctx.me.id)
      drawPicks(v)
      btns.style.setProperty("--n", 3)
      btns.replaceChildren(...[0, 1, 2].map((s) => el("button", { class: `mp-btn ${v.mine === s ? "blue on" : ""}`, type: "button", disabled: v.phase !== "pick" || v.mine != null || !alive,
        onclick: () => { if (V.phase === "pick" && V.mine == null) { ctx.sfx.click(); ctx.send({ slot: s }) } } }, el("span", { class: "em", text: "🎁" }), el("span", { class: "lab", text: ["Kiri", "Tengah", "Kanan"][s] }))))
      const nb = (v.bombs || []).length
      q.replaceChildren(v.phase === "show" ? ctx.L(`Bowser menyembunyikan ${nb} bom… ikuti petinya!`, `Bowser hides ${nb} Bob-omb${nb > 1 ? "s" : ""}… follow the chests!`)
        : v.phase === "pick" ? ctx.L("Pilih peti yang AMAN!", "Pick a SAFE chest!") : v.phase === "reveal" ? ctx.L("Buka petinya…", "Opening…") : ctx.L("Awas bom Bowser!", "Watch out for Bowser's bombs!"),
      el("small", { text: ctx.L(`Masih bertahan: ${(v.alive || []).map((p) => ctx.player(p).avatar).join(" ")}`, `Still in: ${(v.alive || []).map((p) => ctx.player(p).avatar).join(" ")}`) }))
      note.textContent = !alive ? ctx.L("💥 Kamu sudah meledak — tonton yang lain!", "💥 You're out — cheer the others on!") : v.phase === "pick" && v.mine != null ? ctx.L("Terkunci ✓ Semoga aman…", "Locked in ✓ Fingers crossed…") : ""
      for (const e of events) {
        if (e.e === "round") { ctx.sfx.drum(); if (e.bombs > 1) banner(box, ctx.L("2 BOM!", "2 BOMBS!"), { kind: "bad", ms: 1300 }) }
        if (e.e === "pick") ctx.sfx.turn()
        if (e.e === "reveal") {
          if (e.saved) setTimeout(() => banner(box, ctx.L("Semua kena! Diulang 😅", "Everyone hit! Replay 😅"), { kind: "bad", ms: 1500 }), 1100)
          else if ((e.boom || []).includes(ctx.me.id)) setTimeout(() => { ctx.sfx.lose() }, 1100)
          else if (alive) setTimeout(() => { ctx.sfx.ding(); popText(box, ctx.L("AMAN!", "SAFE!"), 50, 30) }, 1100)
        }
      }
      void star
    },
  }
}
