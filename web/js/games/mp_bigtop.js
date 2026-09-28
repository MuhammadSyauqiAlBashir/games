// Big-Top Quiz: Toads roll around on circus balls; pictures flash on the balls. Then answer!
import { el, svg } from "../lib.js?v=__VERSION__"
import { banner, clamp, ease, kit, loop, popText, toad } from "./mp.js?v=__VERSION__"

const TOAD_COLORS = ["#e5484d", "#3b82d6", "#3fa66a", "#f0a030"]
const FLASH = 0.62

function posAt(keys, t) {
  if (t <= keys[0][0]) return [keys[0][1], keys[0][2], 0]
  for (let k = 1; k < keys.length; k++) {
    const [t1, x1, y1] = keys[k]
    const [t0, x0, y0] = keys[k - 1]
    if (t < t1) {
      const p = t1 === t0 ? 1 : ease((t - t0) / (t1 - t0))
      return [x0 + (x1 - x0) * p, y0 + (y1 - y0) * p, (x1 - x0) * Math.sin(p * Math.PI)]
    }
  }
  const last = keys[keys.length - 1]
  return [last[1], last[2], 0]
}

export function mount(stage, ctx) {
  const K = kit(stage, ctx)
  const box = el("div", { class: "mp" })
  const q = el("div", { class: "mp-q" })
  const btns = el("div", { class: "mp-btns" })
  const note = el("div", { class: "mp-note" })
  stage.append(box, q, btns, note)
  const g = svg("svg", { viewBox: "0 0 100 80" })
  g.append(svg("defs", {},
    svg("radialGradient", { id: "btSpot", cx: ".5", cy: ".3", r: ".7" }, svg("stop", { offset: 0, "stop-color": "#fff6c7" }), svg("stop", { offset: 1, "stop-color": "#f3b64a" }))))
  // tent stripes + curtains + stage
  for (let i = 0; i < 10; i++) g.append(svg("rect", { x: i * 10, y: 0, width: 10, height: 80, fill: i % 2 ? "#d92f3a" : "#fbe9d0" }))
  g.append(svg("path", { d: "M0 0 L100 0 L100 8 Q 90 14 80 8 Q 70 14 60 8 Q 50 14 40 8 Q 30 14 20 8 Q 10 14 0 8 Z", fill: "#8a1a24" }))
  g.append(svg("ellipse", { cx: 50, cy: 66, rx: 52, ry: 20, fill: "url(#btSpot)" }))
  g.append(svg("path", { d: "M0 0 Q 8 40 3 80 L 0 80 Z", fill: "#a31f2c" }), svg("path", { d: "M100 0 Q 92 40 97 80 L 100 80 Z", fill: "#a31f2c" }))
  const actors = svg("g")
  const labels = svg("g")
  g.append(actors, labels)
  box.append(g)
  let V = null, actorsKey = "", A = [], lastFlashSfx = -1

  function build(v) {
    actors.replaceChildren()
    A = []
    const n = v.script.n
    for (let i = 0; i < n; i++) {
      const shadow = svg("ellipse", { rx: 8, ry: 1.6, fill: "rgba(0,0,0,.22)" })
      const ballSpin = svg("g")
      const stripes = svg("g", {}, svg("circle", { r: 8, fill: "#fff", stroke: "#1d2340", "stroke-width": 0.6 }),
        svg("path", { d: "M-8 0 A 8 8 0 0 1 8 0 Z", fill: TOAD_COLORS[i % 4], opacity: 0.9 }),
        svg("circle", { r: 2.4, fill: "#ffd400", stroke: "#1d2340", "stroke-width": 0.4 }))
      ballSpin.append(stripes)
      const face = svg("g", { opacity: 0 }, svg("circle", { r: 7.4, fill: "#fffdf5", stroke: "#1d2340", "stroke-width": 0.5 }), svg("text", { "text-anchor": "middle", "dominant-baseline": "central", "font-size": 9 }))
      const t = toad(TOAD_COLORS[i % 4], 0.62)
      const wave = svg("text", { x: 5, y: -18, "font-size": 5, opacity: 0, text: "👋" })
      const tap = svg("circle", { r: 11, fill: "transparent", class: "mp-tap" })
      tap.addEventListener("click", () => answer(i, true))
      const grp = svg("g", {}, shadow, svg("g", { class: "ball" }, ballSpin, face), svg("g", { transform: "translate(0 -8.4)" }, t, wave), tap)
      actors.append(grp)
      A.push({ grp, ballSpin, face, faceText: face.querySelector("text"), shadow, wave, x: 50, y: 60 })
    }
  }

  function answer(i, fromToad) {
    if (!V || V.phase !== "ask" || V.mine != null) return
    const where = V.q && V.q.type === "where"
    if (where !== !!fromToad) return
    ctx.sfx.click()
    ctx.send({ i })
  }

  const stop = loop(ctx, (now) => {
    if (!V || !A.length) return
    const sc = V.script
    const t = V.phase === "show" ? now - V.t0 : V.phase === "start" ? 0 : sc.show
    A.forEach((a, i) => {
      const [x, y, dx] = posAt(sc.keys[i], t)
      const arc = sc.style === "swap" ? -Math.abs(dx) * 0.22 * Math.sign(dx || 1) : 0
      a.grp.setAttribute("transform", `translate(${x.toFixed(2)} ${(y + arc).toFixed(2)})`)
      a.shadow.setAttribute("cy", (8.6 - arc).toFixed(2))
      a.ballSpin.setAttribute("transform", `rotate(${((x * 9) % 360).toFixed(1)})`)
      // flashes
      let show = null
      if (V.phase === "show") {
        for (const [ft, k, img] of sc.flashes) if (k === i && t >= ft && t < ft + FLASH) show = [img, (t - ft) / FLASH]
      }
      if (show) {
        const p = show[1]
        const sx = p < 0.15 ? p / 0.15 : p > 0.85 ? (1 - p) / 0.15 : 1
        a.face.setAttribute("opacity", 1)
        a.face.setAttribute("transform", `scale(${sx.toFixed(2)} 1)`)
        if (a.faceText.textContent !== show[0]) a.faceText.textContent = show[0]
      } else a.face.setAttribute("opacity", 0)
      const waving = V.phase === "show" && sc.wave && sc.wave[1] === i && t >= sc.wave[0] - 0.3 && t < sc.wave[0] + 0.9
      a.wave.setAttribute("opacity", waving ? 1 : 0)
      if (waving) a.wave.setAttribute("transform", `rotate(${Math.sin(now * 18) * 25} 7 -20)`)
    })
    if (V.phase === "show") {
      const idx = sc.flashes.findIndex(([ft]) => t >= ft && t < ft + 0.05)
      if (idx >= 0 && idx !== lastFlashSfx) { lastFlashSfx = idx; ctx.sfx.blip() }
    }
  })

  function drawLabels(v) {
    labels.replaceChildren()
    if (!v.q || v.q.type !== "where" || !["ask", "reveal", "finish"].includes(v.phase)) return
    const sc = v.script
    const order = sc.keys.map((k, i) => [posAt(k, sc.show)[0], i]).sort((a, b) => a[0] - b[0])
    order.forEach(([x], k) => {
      const i = order[k][1]
      const y = posAt(sc.keys[i], sc.show)[1]
      const cls = v.answer === i ? "#22a845" : v.mine === i ? "#2b64e0" : "#1d2340"
      labels.append(svg("g", { transform: `translate(${x} ${y - 25})` }, svg("circle", { r: 4, fill: cls, stroke: "#fff", "stroke-width": 0.8 }),
        svg("text", { "text-anchor": "middle", "dominant-baseline": "central", "font-size": 4.4, "font-weight": 900, fill: "#fff", text: "ABCD"[k] })))
    })
    return order.map(([, i]) => i)
  }

  return {
    destroy: stop,
    scores: (v) => v.scores,
    update(v, events) {
      V = v
      K.update(v, events, box)
      const key = `${v.round}:${v.script && v.script.n}`
      if (v.script && v.script.keys && key !== actorsKey) { actorsKey = key; build(v); lastFlashSfx = -1 }
      const reveal = v.phase === "reveal" || v.phase === "finish"
      const order = drawLabels(v)
      btns.replaceChildren()
      if (v.q && ["ask", "reveal", "finish"].includes(v.phase)) {
        const where = v.q.type === "where"
        const choices = where ? order.map((_, k) => "ABCD"[k]) : v.q.choices
        btns.style.setProperty("--n", choices.length)
        choices.forEach((c, k) => {
          const idx = where ? order[k] : k
          const cls = reveal ? (idx === v.answer ? "right" : v.mine === idx ? "wrong" : "gray") : v.mine === idx ? "blue on" : ""
          btns.append(el("button", { class: `mp-btn ${cls}`, type: "button", disabled: v.phase !== "ask" || v.mine != null, onclick: () => { if (V.phase === "ask" && V.mine == null) { ctx.sfx.click(); ctx.send({ i: idx }) } } },
            el("span", { class: "em", text: c })))
        })
        q.replaceChildren(ctx.L(v.q.id, v.q.en), el("small", { text: reveal ? "" : ctx.L("Tercepat benar: 5 poin, lalu 3, 2, 1", "Fastest correct: 5 points, then 3, 2, 1") }))
      } else {
        const hint = v.script ? { swap: ctx.L("Bola-bolanya bertukar tempat…", "The balls swap places…"), circle: ctx.L("Mereka berputar!", "They roll in a circle!"), wander: ctx.L("Mereka lari ke mana-mana!", "They're all over the place!") }[v.script.style] : ""
        q.replaceChildren(v.phase === "show" || v.phase === "start" ? ctx.L("Perhatikan gambar di bola & Toad-nya! 👀", "Watch the pictures on the balls and the Toads! 👀") : "", el("small", { text: hint || "" }))
      }
      const n = (v.picked || []).length
      note.textContent = v.phase === "ask" ? (v.mine != null ? ctx.L(`Terkunci ✓ — ${n}/${ctx.seats().length} menjawab`, `Locked in ✓ — ${n}/${ctx.seats().length} answered`) : ctx.L(`${n}/${ctx.seats().length} menjawab`, `${n}/${ctx.seats().length} answered`)) : ""
      if (reveal && v.q && ["more", "fewer", "more3"].includes(v.q.type) && v.script) {
        const counts = v.q.choices.map((c) => `${c}×${v.script.flashes.filter((f) => f[2] === c).length}`)
        note.textContent = counts.join("   ")
      }
      for (const e of events) {
        if (e.e === "round") ctx.sfx.pop()
        if (e.e === "ask") ctx.sfx.turn()
        if (e.e === "reveal") {
          const mineGot = (e.got || {})[ctx.me.id]
          if (mineGot) { ctx.sfx.ding(); banner(box, `+${mineGot}`, { kind: "good", ms: 1300 }) } else if (v.mine != null) ctx.sfx.buzz()
          Object.entries(e.got || {}).forEach(([p, pts], k) => popText(box, `${ctx.player(p).avatar} +${pts}`, 30 + k * 14, 30))
        }
      }
      void clamp
    },
  }
}
