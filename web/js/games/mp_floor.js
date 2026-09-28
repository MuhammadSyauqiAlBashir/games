// The Floor Is Falling: Bowser flashes tiles red — step off them before they drop into the lava! Last one standing wins.
import { el, svg } from "../lib.js?v=__VERSION__"
import { banner, kit, loop, popText, smoother } from "./mp.js?v=__VERSION__"

export function mount(stage, ctx) {
  const K = kit(stage, ctx, { scoreLabel: "🌊" })
  const box = el("div", { class: "mp", style: { background: "radial-gradient(circle, #ff8a1f, #7a1a08)" } })
  const q = el("div", { class: "mp-q" })
  const pad = el("div", { class: "fl-pad" })
  stage.append(box, q, pad)
  const g = svg("svg", { viewBox: "0 0 100 100", style: "touch-action:none" })
  box.append(g)
  const tilesG = svg("g"), peopleG = svg("g")
  g.append(tilesG, peopleG)
  const dirs = [["u", "⬆️"], ["l", "⬅️"], ["d", "⬇️"], ["r", "➡️"]]
  for (const [d, t] of dirs) pad.append(el("button", { class: `mp-btn blue fl-${d}`, type: "button", onpointerdown: (e) => { e.preventDefault(); move(d) } }, el("span", { class: "em", text: t })))
  let V = null, n = 0, T = [], P = new Map(), sw = null
  const sm = smoother(0.45)

  function move(d) { if (V && V.phase === "play" && (V.alive || []).includes(ctx.me.id)) ctx.send({ d }) }
  g.addEventListener("pointerdown", (e) => { sw = [e.clientX, e.clientY] })
  g.addEventListener("pointerup", (e) => { if (!sw) return; const dx = e.clientX - sw[0], dy = e.clientY - sw[1]; sw = null; if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return; move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "r" : "l") : dy > 0 ? "d" : "u") })
  const kd = (e) => { const d = { ArrowUp: "u", ArrowDown: "d", ArrowLeft: "l", ArrowRight: "r" }[e.key]; if (d) { e.preventDefault(); move(d) } }
  document.addEventListener("keydown", kd)

  function build(N) {
    n = N
    const s = 88 / N
    tilesG.replaceChildren()
    T = []
    for (let i = 0; i < N * N; i++) {
      const x = 6 + (i % N) * s, y = 6 + Math.floor(i / N) * s
      const r = svg("rect", { x: x + 0.6, y: y + 0.6, width: s - 1.2, height: s - 1.2, rx: 1.6, fill: "#c9b8a0", stroke: "#6b5a44", "stroke-width": 0.6 })
      tilesG.append(r)
      T.push(r)
    }
  }
  const stop = loop(ctx, (now) => {
    if (!V || !n) return
    const s = 88 / n
    const warn = new Set(V.warn || []), gone = new Set(V.gone || [])
    T.forEach((r, i) => {
      r.setAttribute("fill", gone.has(i) ? "rgba(0,0,0,0)" : warn.has(i) ? (Math.sin(now * 22) > 0 ? "#ff5a4a" : "#ffd0c0") : ((i % n) + Math.floor(i / n)) % 2 ? "#c9b8a0" : "#d8c9b2")
      r.setAttribute("stroke-opacity", gone.has(i) ? 0 : 1)
    })
    for (const p of ctx.seats()) {
      const pos = (V.pos || {})[p.id]
      if (!pos) continue
      let node = P.get(p.id)
      if (!node) { node = svg("g", {}, svg("circle", { r: s * 0.32, fill: p.color, stroke: p.id === ctx.me.id ? "#ffd400" : "#fff", "stroke-width": 1 }), svg("text", { "text-anchor": "middle", "dominant-baseline": "central", "font-size": s * 0.42, text: p.avatar })); peopleG.append(node); P.set(p.id, node) }
      const [x, y] = sm(p.id, 6 + pos[0] * s + s / 2, 6 + pos[1] * s + s / 2)
      const out = !(V.alive || []).includes(p.id)
      node.setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${out ? 0.4 : 1})`)
      node.setAttribute("opacity", out ? 0.25 : 1)
    }
  })
  return {
    destroy() { stop(); document.removeEventListener("keydown", kd) },
    scores: (v) => v.scores,
    update(v, events) {
      V = v
      K.update(v, events, box)
      if (v.n && v.n !== n) build(v.n)
      const alive = (v.alive || []).includes(ctx.me.id)
      q.replaceChildren(alive ? ctx.L("Menjauh dari ubin MERAH! Geser / tombol panah", "Get off the RED tiles! Swipe or use the arrows") : ctx.L("Kamu jatuh ke lahar 🔥 — tonton yang lain!", "You fell in the lava 🔥 — watch the others!"),
        el("small", { text: ctx.L(`Gelombang ${v.wave || 0} · Masih bertahan: ${(v.alive || []).map((p) => ctx.player(p).avatar).join(" ")}`, `Wave ${v.wave || 0} · Still standing: ${(v.alive || []).map((p) => ctx.player(p).avatar).join(" ")}`) }))
      for (const e of events) {
        if (e.e === "warn") ctx.sfx.tick()
        if (e.e === "drop") ctx.sfx.thud()
        if (e.e === "fall") { if (e.who === ctx.me.id) { ctx.sfx.lose(); banner(box, ctx.L("JATUH!", "FELL!"), { kind: "bad" }) } else popText(box, `${ctx.player(e.who).avatar} 🔥`, 50, 30, "bad") }
      }
    },
  }
}
