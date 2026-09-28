// Hot-Hot Hop: a Fire Bar sweeps around the platform — jump over it every time it reaches you!
// It speeds up, sometimes reverses, and later there are two. Last one standing wins.
import { el, svg } from "../lib.js?v=__VERSION__"
import { banner, kit, loop, popText } from "./mp.js?v=__VERSION__"

const RING = 34

export function mount(stage, ctx) {
  const K = kit(stage, ctx, { scoreLabel: "s" })
  const box = el("div", { class: "mp", style: { background: "radial-gradient(circle, #ff9a2a, #6b1206)" } })
  const q = el("div", { class: "mp-q" })
  const ctrl = el("div", { class: "mp-ctrl" })
  stage.append(box, q, ctrl)
  const g = svg("svg", { viewBox: "0 0 100 100", style: "touch-action:none" })
  box.append(g)
  g.append(svg("circle", { cx: 50, cy: 50, r: 44, fill: "#8a8f99", stroke: "#50545c", "stroke-width": 1.4 }), svg("circle", { cx: 50, cy: 50, r: 44, fill: "none", stroke: "rgba(255,255,255,.2)", "stroke-width": 0.6, "stroke-dasharray": "2 2" }))
  const barsG = svg("g"), peopleG = svg("g")
  g.append(barsG, svg("circle", { cx: 50, cy: 50, r: 5, fill: "#5b5f68", stroke: "#2c2e33", "stroke-width": 0.8 }), peopleG)
  const jumpBtn = el("button", { class: "mp-btn huge red", type: "button" }, el("span", { text: ctx.L("LOMPAT! ⬆️", "JUMP! ⬆️") }))
  jumpBtn.addEventListener("pointerdown", (e) => { e.preventDefault(); jump() })
  box.addEventListener("pointerdown", (e) => { e.preventDefault(); jump() })
  ctrl.append(jumpBtn)
  let V = null, bars = [0], lastUpd = 0, localJump = 0, P = new Map()
  const kd = (e) => { if (e.code === "Space" || e.key === "ArrowUp") { e.preventDefault(); jump() } }
  document.addEventListener("keydown", kd)

  function jump() {
    if (!V || V.phase !== "play" || !(V.alive || []).includes(ctx.me.id)) return
    if (performance.now() - localJump < (V.air || 0.56) * 1000) return
    localJump = performance.now()
    ctx.sfx.swoosh()
    ctx.send({ t: ctx.now() })
  }
  function fireBar() {
    const grp = svg("g")
    for (let k = 0; k < 7; k++) grp.append(svg("circle", { cx: 50 + 6 + k * 5.6, cy: 50, r: 2.6 - k * 0.12, fill: k % 2 ? "#ffd84a" : "#ff6a1a", class: "mp-spark" }))
    return grp
  }
  const stop = loop(ctx, (now) => {
    if (!V) return
    // extrapolate the bars between server frames
    const dt = V.phase === "play" ? Math.min(0.1, (performance.now() - lastUpd) / 1000) : 0
    if (barsG.childNodes.length !== bars.length) barsG.replaceChildren(...bars.map(() => fireBar()))
    bars.forEach((b, i) => { const a = b + (V.w || 0) * dt * (V.dirn || 1); barsG.children[i].setAttribute("transform", `rotate(${a.toFixed(2)} 50 50)`) })
    for (const p of ctx.seats()) {
      let node = P.get(p.id)
      if (!node) { node = svg("g", {}, svg("ellipse", { class: "sh", rx: 4, ry: 1.4, fill: "rgba(0,0,0,.3)" }), svg("g", { class: "body" }, svg("circle", { r: 4.4, fill: p.color, stroke: p.id === ctx.me.id ? "#ffd400" : "#fff", "stroke-width": 0.9 }), svg("text", { "text-anchor": "middle", "dominant-baseline": "central", "font-size": 5.4, text: p.avatar }))); peopleG.append(node); P.set(p.id, node) }
      const a = ((V.ang || {})[p.id] || 0) * Math.PI / 180
      const x = 50 + Math.cos(a) * RING, y = 50 + Math.sin(a) * RING
      const j = (V.jump || {})[p.id]
      let h = 0
      const mine = p.id === ctx.me.id
      const since = mine ? (performance.now() - localJump) / 1000 : j != null ? now - j : 9
      if (since >= 0 && since < (V.air || 0.56)) h = Math.sin((since / (V.air || 0.56)) * Math.PI) * 7
      const out = !(V.alive || []).includes(p.id)
      node.setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)})`)
      node.querySelector(".body").setAttribute("transform", `translate(0 ${(-h).toFixed(2)}) scale(${(1 + h * 0.03).toFixed(3)})`)
      node.setAttribute("opacity", out ? 0.25 : 1)
    }
  })
  return {
    destroy() { stop(); document.removeEventListener("keydown", kd) },
    scores: (v) => v.scores,
    update(v, events) {
      V = v
      bars = v.bars || [0]
      lastUpd = performance.now()
      K.update(v, events, box)
      const alive = (v.alive || []).includes(ctx.me.id)
      jumpBtn.disabled = !alive || v.phase !== "play"
      q.replaceChildren(alive ? ctx.L("Lompat saat api lewat! (ketuk di mana saja)", "Jump when the fire bar reaches you! (tap anywhere)") : ctx.L("Kamu terbakar 🔥 — tonton yang lain!", "You got burned 🔥 — watch the others!"),
        el("small", { text: ctx.L(`Bertahan: ${(v.alive || []).map((p) => ctx.player(p).avatar).join(" ")}`, `Still in: ${(v.alive || []).map((p) => ctx.player(p).avatar).join(" ")}`) }))
      for (const e of events) {
        if (e.e === "burn") { if (e.who === ctx.me.id) { ctx.sfx.lose(); banner(box, ctx.L("TERBAKAR!", "BURNED!"), { kind: "bad" }) } else popText(box, `${ctx.player(e.who).avatar} 🔥`, 50, 30, "bad") }
        if (e.e === "reverse") { ctx.sfx.boop(); popText(box, ctx.L("⟲ Berbalik!", "⟲ Reverse!"), 50, 50) }
        if (e.e === "bar2") { ctx.sfx.buzz(); banner(box, ctx.L("2 API!", "2 BARS!"), { kind: "bad", ms: 1200 }) }
      }
    },
  }
}
