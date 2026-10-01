// Big-Top Quiz: every Toad carries ONE picture on its circus ball for the whole round. Look, the balls turn away,
// the Toads shuffle (some wave, some jump, a ball may flash its picture) — then answer.
import { el, svg } from "../lib.js?v=__VERSION__"
import { banner, ease, kit, loop, popText, toad } from "./mp.js?v=__VERSION__"

const TOAD_COLORS = ["#e5484d", "#3b82d6", "#3fa66a", "#f0a030", "#9b6bd6"]

function posAt(keys, t) {
  if (t <= keys[0][0]) return [keys[0][1], keys[0][2], 0]
  for (let k = 1; k < keys.length; k++) {
    const [t1, x1, y1] = keys[k], [t0, x0, y0] = keys[k - 1]
    if (t < t1) { const p = t1 === t0 ? 1 : ease((t - t0) / (t1 - t0)); return [x0 + (x1 - x0) * p, y0 + (y1 - y0) * p, (x1 - x0) * Math.sin(p * Math.PI)] }
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
  g.append(svg("defs", {}, svg("radialGradient", { id: "btSpot", cx: ".5", cy: ".3", r: ".7" }, svg("stop", { offset: 0, "stop-color": "#fff6c7" }), svg("stop", { offset: 1, "stop-color": "#f3b64a" }))))
  for (let i = 0; i < 10; i++) g.append(svg("rect", { x: i * 10, y: 0, width: 10, height: 80, fill: i % 2 ? "#d92f3a" : "#fbe9d0" }))
  g.append(svg("path", { d: "M0 0 L100 0 L100 8 Q 90 14 80 8 Q 70 14 60 8 Q 50 14 40 8 Q 30 14 20 8 Q 10 14 0 8 Z", fill: "#8a1a24" }))
  g.append(svg("ellipse", { cx: 50, cy: 66, rx: 52, ry: 20, fill: "url(#btSpot)" }))
  g.append(svg("path", { d: "M0 0 Q 8 40 3 80 L 0 80 Z", fill: "#a31f2c" }), svg("path", { d: "M100 0 Q 92 40 97 80 L 100 80 Z", fill: "#a31f2c" }))
  const actors = svg("g"), labels = svg("g")
  g.append(actors, labels)
  box.append(g)
  let V = null, actorsKey = "", A = [], lastSfx = -1, flipped = false

  function build(v) {
    actors.replaceChildren()
    A = []
    const n = v.script.n
    for (let i = 0; i < n; i++) {
      const shadow = svg("ellipse", { rx: 8, ry: 1.6, fill: "rgba(0,0,0,.22)" })
      const back = svg("g", {}, svg("circle", { r: 8, fill: "#fff", stroke: "#1d2340", "stroke-width": 0.6 }),
        svg("path", { d: "M-8 0 A 8 8 0 0 1 8 0 Z", fill: TOAD_COLORS[i % 5], opacity: 0.9 }), svg("circle", { r: 2.4, fill: "#ffd400", stroke: "#1d2340", "stroke-width": 0.4 }))
      const face = svg("g", {}, svg("circle", { r: 7.6, fill: "#fffdf5", stroke: "#1d2340", "stroke-width": 0.5 }),
        svg("text", { "text-anchor": "middle", "dominant-baseline": "central", "font-size": 9.5, text: v.script.imgs[i] }))
      const ballG = svg("g", {}, back, face)
      const t = toad(TOAD_COLORS[i % 5], 0.62)
      const wave = svg("text", { x: 5, y: -18, "font-size": 5, opacity: 0, text: "👋" })
      const body = svg("g", {}, svg("g", { transform: "translate(0 -8.4)" }, t, wave), ballG)
      const tap = svg("circle", { r: 11, fill: "transparent", class: "mp-tap" })
      tap.addEventListener("click", () => answer(i, true))
      const grp = svg("g", {}, shadow, body, tap)
      actors.append(grp)
      A.push({ grp, body, ballG, back, face, shadow, wave })
    }
  }

  function answer(i, fromToad) {
    if (!V || V.phase !== "ask" || V.mine != null) return
    if ((V.q && V.q.type === "where") !== !!fromToad) return
    ctx.sfx.click()
    ctx.send({ i })
  }

  const stop = loop(ctx, (now) => {
    if (!V || !A.length) return
    const sc = V.script
    const t = V.phase === "show" ? now - V.t0 : V.phase === "start" ? 0 : sc.show
    const reveal = V.phase === "reveal" || V.phase === "finish"
    A.forEach((a, i) => {
      const [x, y, dx] = posAt(sc.keys[i], t)
      const arc = sc.style === "swap" ? -Math.abs(dx) * 0.22 * Math.sign(dx || 1) : 0
      let hop = 0
      for (const [et, k, kind] of sc.events) {
        if (k !== i || kind !== "jump") continue
        const p = (t - et) / 0.5
        if (p > 0 && p < 1) hop = Math.sin(p * Math.PI) * 9
      }
      a.grp.setAttribute("transform", `translate(${x.toFixed(2)} ${(y + arc).toFixed(2)})`)
      a.body.setAttribute("transform", `translate(0 ${(-hop).toFixed(2)})`)
      a.shadow.setAttribute("cy", (8.6 - arc).toFixed(2))
      a.shadow.setAttribute("rx", (8 - hop * 0.4).toFixed(2))
      // the picture is visible while peeking, during a flash, and at the reveal; a quick "turn" in between
      let vis = t < sc.peek || reveal
      for (const [et, k, kind] of sc.events) if (k === i && kind === "flash" && t >= et && t < et + 0.6) vis = true
      const turn = Math.abs(t - sc.peek) < 0.18 && V.phase === "show" ? Math.abs(t - sc.peek) / 0.18 : 1
      a.face.setAttribute("opacity", vis ? 1 : 0)
      a.back.setAttribute("opacity", vis ? 0 : 1)
      a.ballG.setAttribute("transform", `scale(${turn.toFixed(2)} 1) rotate(${vis ? 0 : ((x * 9) % 360).toFixed(1)})`)
      const waving = V.phase === "show" && sc.events.some(([et, k, kind]) => k === i && kind === "wave" && t >= et - 0.2 && t < et + 1.0)
      a.wave.setAttribute("opacity", waving ? 1 : 0)
      if (waving) a.wave.setAttribute("transform", `rotate(${Math.sin(now * 18) * 25} 7 -20)`)
    })
    if (V.phase === "show") {
      if (t > sc.peek && !flipped) { flipped = true; ctx.sfx.swoosh(); showPrompt(V) }
      const idx = sc.events.findIndex(([et]) => t >= et && t < et + 0.05)
      if (idx >= 0 && idx !== lastSfx) { lastSfx = idx; const kind = sc.events[idx][2]; if (kind === "jump") ctx.sfx.boop(); else if (kind === "flash") ctx.sfx.blip(); else ctx.sfx.pop() }
    }
  })

  function drawLabels(v) {
    labels.replaceChildren()
    if (!v.q || v.q.type !== "where" || !["ask", "reveal", "finish"].includes(v.phase)) return null
    const sc = v.script
    const order = sc.keys.map((k, i) => [posAt(k, sc.show)[0], i]).sort((a, b) => a[0] - b[0])
    order.forEach(([x], k) => {
      const i = order[k][1]
      const y = posAt(sc.keys[i], sc.show)[1]
      const col = v.answer === i ? "#22a845" : v.mine === i ? "#2b64e0" : "#1d2340"
      labels.append(svg("g", { transform: `translate(${x} ${y - 25})` }, svg("circle", { r: 4, fill: col, stroke: "#fff", "stroke-width": 0.8 }),
        svg("text", { "text-anchor": "middle", "dominant-baseline": "central", "font-size": 4.4, "font-weight": 900, fill: "#fff", text: "ABCDE"[k] })))
    })
    return order.map(([, i]) => i)
  }

  function showPrompt(v) {
    if (v.q && ["ask", "reveal", "finish"].includes(v.phase)) return
    const t = v.phase === "show" ? ctx.now() - v.t0 : 0
    q.replaceChildren(v.phase === "show" && v.script && t < v.script.peek ? ctx.L("INGAT gambar tiap Toad! 👀", "REMEMBER each Toad's picture! 👀") : ctx.L("Ikuti Toad-nya… siapa melambai, siapa melompat? 🤹", "Follow the Toads… who waves, who jumps? 🤹"),
      el("small", { text: ctx.L("Tiap Toad selalu membawa gambar yang sama", "Each Toad always carries the same picture") }))
  }

  return {
    destroy: stop,
    scores: (v) => v.scores,
    update(v, events) {
      V = v
      K.update(v, events, box)
      const key = `${v.round}:${v.script && v.script.n}:${v.script && (v.script.imgs || []).join("")}`
      if (v.script && v.script.keys && key !== actorsKey) { actorsKey = key; build(v); lastSfx = -1; flipped = false }
      const reveal = v.phase === "reveal" || v.phase === "finish"
      const order = drawLabels(v)
      btns.replaceChildren()
      if (v.q && ["ask", "reveal", "finish"].includes(v.phase)) {
        const where = v.q.type === "where"
        const choices = where ? order.map((_, k) => "ABCDE"[k]) : v.q.choices
        btns.style.setProperty("--n", choices.length)
        choices.forEach((c, k) => {
          const idx = where ? order[k] : k
          const cls = reveal ? (idx === v.answer ? "right" : v.mine === idx ? "wrong" : "gray") : v.mine === idx ? "blue on" : ""
          btns.append(el("button", { class: `mp-btn ${cls}`, type: "button", disabled: v.phase !== "ask" || v.mine != null, onclick: () => { if (V.phase === "ask" && V.mine == null) { ctx.sfx.click(); ctx.send({ i: idx }) } } },
            el("span", { class: "em", text: c })))
        })
        q.replaceChildren(ctx.L(v.q.id, v.q.en), el("small", { text: reveal ? "" : ctx.L("Tercepat benar: 5 poin, lalu 3, 2, 1", "Fastest correct: 5 points, then 3, 2, 1") }))
      } else showPrompt(v)
      const n = (v.picked || []).length
      note.textContent = v.phase === "ask" ? (v.mine != null ? ctx.L(`Terkunci ✓ — ${n}/${ctx.seats().length} menjawab`, `Locked in ✓ — ${n}/${ctx.seats().length} answered`) : ctx.L(`${n}/${ctx.seats().length} menjawab`, `${n}/${ctx.seats().length} answered`)) : ""
      for (const e of events) {
        if (e.e === "round") ctx.sfx.pop()
        if (e.e === "ask") ctx.sfx.turn()
        if (e.e === "reveal") {
          const mineGot = (e.got || {})[ctx.me.id]
          if (mineGot) { ctx.sfx.ding(); banner(box, `+${mineGot}`, { kind: "good", ms: 1300 }) } else if (v.mine != null) ctx.sfx.buzz()
          Object.entries(e.got || {}).forEach(([p, pts], k) => popText(box, `${ctx.player(p).avatar} +${pts}`, 30 + k * 14, 30))
        }
      }
    },
  }
}
