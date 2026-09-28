// Sled to the Edge: a Cooligan pulls your sled faster and faster. Let go so you stop as close to the edge
// as you dare — go over and it's a splash!
import { el, svg } from "../lib.js?v=__VERSION__"
import { banner, clamp, cooligan, kit, loop, popText } from "./mp.js?v=__VERSION__"

const TOP = 14, BOT = 70  // edge line y and start line y

export function mount(stage, ctx) {
  const K = kit(stage, ctx)
  const box = el("div", { class: "mp", style: { background: "#bfe9ff" } })
  const q = el("div", { class: "mp-q" })
  const btns = el("div", { class: "mp-btns", style: { "--n": 1 } })
  const note = el("div", { class: "mp-note" })
  stage.append(box, q, btns, note)
  const g = svg("svg", { viewBox: "0 0 100 80" })
  g.append(svg("rect", { width: 100, height: TOP, fill: "#1f6fc2" }))
  const waves = svg("g")
  for (let k = 0; k < 3; k++) waves.append(svg("path", { d: `M0 ${4 + k * 4} q 5 -2 10 0 t 10 0 t 10 0 t 10 0 t 10 0 t 10 0 t 10 0 t 10 0 t 10 0 t 10 0`, stroke: "rgba(255,255,255,.35)", "stroke-width": 0.6, fill: "none" }))
  g.append(waves)
  g.append(svg("rect", { y: TOP, width: 100, height: 80 - TOP, fill: "#e8f7ff" }))
  for (let k = 0; k < 14; k++) g.append(svg("path", { d: `M${k * 8} ${TOP + 4} l 18 60`, stroke: "rgba(150,200,235,.35)", "stroke-width": 0.5 }))
  g.append(svg("path", { d: `M0 ${TOP} ${Array.from({ length: 21 }, (_, i) => `L${i * 5} ${TOP + (i % 2 ? 1.6 : 0)}`).join(" ")} L100 ${TOP}`, stroke: "#fff", "stroke-width": 1.6, fill: "none" }))
  const ticks = svg("g"), lanes = svg("g"), fx = svg("g")
  g.append(ticks, lanes, fx)
  g.append(svg("line", { x1: 0, y1: BOT, x2: 100, y2: BOT, stroke: "#e5484d", "stroke-width": 0.8, "stroke-dasharray": "2 1.4" }))
  box.append(g)
  box.addEventListener("pointerdown", () => release())
  let V = null, rk = "", L = [], splashed = {}

  const travel = (ice, t) => { const v = ice.a * t; return [0.5 * ice.a * t * t + (v * v) / (2 * ice.mu), v / ice.mu, v] }

  function build(v) {
    lanes.replaceChildren(); ticks.replaceChildren()
    const seats = ctx.seats()
    const w = 100 / seats.length
    const edge = v.ice.edge
    for (let m = 0; m <= edge; m += 10) {
      const y = BOT - (m / edge) * (BOT - TOP)
      ticks.append(svg("line", { x1: 0, y1: y, x2: 2.4, y2: y, stroke: "#7aa7c9", "stroke-width": 0.4 }))
      if (m % 20 === 0 && m) ticks.append(svg("text", { x: 3, y: y + 1, "font-size": 2.6, fill: "#7aa7c9", "font-weight": 800, text: `${edge - m}m` }))
    }
    L = seats.map((p, i) => {
      const x = w * i + w / 2
      lanes.append(svg("line", { x1: w * i, y1: TOP, x2: w * i, y2: 80, stroke: "rgba(120,170,210,.35)", "stroke-width": 0.4 }))
      const coolG = svg("g", { style: "filter: drop-shadow(0 0 .6px #1f4f7a)" }, cooligan())
      const rope = svg("line", { stroke: "#8a5a2b", "stroke-width": 0.5 })
      const sled = svg("g", {},
        svg("rect", { x: -5, y: -3.5, width: 10, height: 8, rx: 2, fill: p.color, stroke: "#333", "stroke-width": 0.5 }),
        svg("line", { x1: -5.5, y1: 5, x2: 5.5, y2: 5, stroke: "#555", "stroke-width": 0.7 }),
        svg("text", { y: 0.6, "text-anchor": "middle", "dominant-baseline": "central", "font-size": 6, text: p.avatar }))
      const marker = svg("g")
      lanes.append(rope, coolG, sled, marker)
      return { pid: p.id, x, sled, coolG, rope, marker }
    })
  }

  function release() {
    if (!V || V.phase !== "pull" || (V.rel || {})[ctx.me.id] !== undefined) return
    ctx.sfx.swoosh()
    ctx.send({ t: ctx.now() })
  }

  const yOf = (d, edge) => BOT - (d / edge) * (BOT - TOP)

  const stop = loop(ctx, (now) => {
    if (!V || !L.length || !V.ice || !V.ice.edge) return
    const ice = V.ice
    const t = V.phase === "pull" || V.phase === "slide" ? now - V.t0 : V.phase === "ready" || V.phase === "start" ? 0 : 99
    waves.setAttribute("transform", `translate(${(Math.sin(now) * 2).toFixed(2)} 0)`)
    for (const l of L) {
      const rel = (V.rel || {})[l.pid]
      let d, coolD, fall = 0
      if (rel === undefined) {
        const tt = Math.min(t, V.t_max)
        d = 0.5 * ice.a * tt * tt
        if (t > V.t_max) { const v = ice.a * V.t_max; d += v * (t - V.t_max) }
        coolD = d + 6
      } else {
        const [total, slide, v0] = travel(ice, rel)
        const x0 = 0.5 * ice.a * rel * rel
        const s = clamp((t - rel) / slide) * slide
        d = t < rel ? 0.5 * ice.a * t * t : x0 + v0 * s - 0.5 * ice.mu * s * s
        if (t >= rel + slide) d = total
        coolD = t < rel ? d + 6 : x0 + 6 + v0 * (t - rel) * 1.2
      }
      const edge = ice.edge
      if (d > edge) { fall = Math.min(1, (d - edge) / 6); d = Math.min(d, edge + 8) }
      const y = yOf(d, edge)
      l.sled.setAttribute("transform", `translate(${l.x} ${y.toFixed(2)}) scale(${(1 - fall * 0.5).toFixed(2)})`)
      l.sled.setAttribute("opacity", (1 - fall * 0.8).toFixed(2))
      const cy = yOf(coolD, edge)
      const cool = coolD < edge + 8
      l.coolG.setAttribute("transform", `translate(${l.x} ${cy.toFixed(2)}) scale(.62)`)
      l.coolG.setAttribute("opacity", cool ? 1 : 0)
      l.rope.setAttribute("x1", l.x); l.rope.setAttribute("x2", l.x); l.rope.setAttribute("y1", y - 3.5); l.rope.setAttribute("y2", cy + 2)
      l.rope.setAttribute("opacity", rel === undefined && cool ? 1 : 0)
      if (fall > 0.6 && !splashed[`${V.round}:${l.pid}`]) {
        splashed[`${V.round}:${l.pid}`] = true
        ctx.sfx.splash()
        popText(box, "💦", l.x, (TOP / 80) * 100)
      }
    }
  })

  return {
    destroy: stop,
    scores: (v) => v.scores,
    update(v, events) {
      V = v
      K.update(v, events, box)
      const key = `${v.round}:${v.ice && v.ice.edge}`
      if (v.ice && v.ice.edge && key !== rk) { rk = key; build(v) }
      const me = ctx.me.id
      const released = (v.rel || {})[me] !== undefined
      btns.replaceChildren(el("button", { class: `mp-btn huge ${released ? "gray" : "red"}`, type: "button", disabled: v.phase !== "pull" || released, onclick: release },
        el("span", { text: released ? ctx.L("Meluncur… 🛷", "Sliding… 🛷") : v.phase === "pull" ? ctx.L("LEPAS!", "LET GO!") : ctx.L("Siap-siap…", "Get ready…") })))
      const ice = v.ice || {}
      const kind = { licin: ctx.L("Es LICIN 🧊 (meluncur jauh)", "SLIPPERY ice 🧊 (slides far)"), normal: ctx.L("Es normal ❄️", "Normal ice ❄️"), kasar: ctx.L("Es KASAR 🪨 (cepat berhenti)", "ROUGH ice 🪨 (stops fast)") }[ice.kind] || ""
      q.replaceChildren(ice.edge ? ctx.L(`Tepi jurang: ${ice.edge} m`, `The edge: ${ice.edge} m`) : ctx.L("Kereta luncur siap!", "Sleds ready!"), el("small", { text: `${kind} · ${ctx.L("Berhenti paling dekat tepi menang — jangan nyebur!", "Stop closest to the edge — don't fall in!")}` }))
      note.replaceChildren()
      if ((v.phase === "result" || v.phase === "finish") && v.dist) {
        const rows = Object.entries(v.dist).sort((a, b) => (a[1] < 0) - (b[1] < 0) || a[1] - b[1])
        note.append(...rows.map(([p, d]) => el("span", { style: { margin: "0 6px", whiteSpace: "nowrap" } }, `${ctx.player(p).avatar} ${d < 0 ? ctx.L("💦 nyebur", "💦 splash") : `${d} m`}${v.got && v.got[p] ? ` (+${v.got[p]})` : ""}`)))
      }
      for (const e of events) {
        if (e.e === "round") ctx.sfx.pop()
        if (e.e === "pull") { banner(box, ctx.L("TARIK!", "PULL!"), { ms: 900 }); ctx.sfx.whoosh() }
        if (e.e === "release" && e.who !== me) ctx.sfx.swoosh()
        if (e.e === "result") {
          const mine = (e.dist || {})[me]
          if (mine !== undefined && mine >= 0 && e.got[me] === 5) { ctx.sfx.fanfare(); banner(box, ctx.L("PALING PAS!", "CLOSEST!"), { kind: "good", ms: 1500 }) }
          else if (mine < 0) ctx.sfx.lose()
          else ctx.sfx.ding()
        }
      }
    },
  }
}
