// Tricky Turntable: everyone secretly presses (or not). Each press turns the cog 90° clockwise;
// you get whatever lands in front of you — coins or a Bob-omb.
import { el, svg } from "../lib.js?v=__VERSION__"
import { banner, bobomb, clamp, coin, easeBack, kit, loop, popText } from "./mp.js?v=__VERSION__"

const DIR = [[0, -1], [1, 0], [0, 1], [-1, 0]]  // platform 0 top, 1 right, 2 bottom, 3 left
const C = [50, 42]

function cogPath(r, teeth = 16) {
  let d = ""
  for (let i = 0; i < teeth * 2; i++) {
    const a0 = (i / (teeth * 2)) * Math.PI * 2, a1 = ((i + 1) / (teeth * 2)) * Math.PI * 2, rr = i % 2 ? r : r * 1.1
    d += `${i ? "L" : "M"}${(Math.cos(a0) * rr).toFixed(2)} ${(Math.sin(a0) * rr).toFixed(2)} L${(Math.cos(a1) * rr).toFixed(2)} ${(Math.sin(a1) * rr).toFixed(2)} `
  }
  return d + "Z"
}

function itemNode(it) {
  if (it === "B") return svg("g", { transform: "translate(0 1)" }, bobomb(4.2))
  const g = svg("g")
  const n = Number(it)
  for (let k = 0; k < Math.min(n, 5); k++) g.append(svg("g", { transform: `translate(0 ${2 - k * 1.3})` }, coin(3.6)))
  g.append(svg("text", { x: 0, y: 9.5, "text-anchor": "middle", "font-size": 4.2, "font-weight": 900, fill: "#fff", stroke: "#6b3d00", "stroke-width": 0.9, "paint-order": "stroke", text: `+${n}` }))
  return g
}

export function mount(stage, ctx) {
  const K = kit(stage, ctx, { scoreLabel: "🪙" })
  const box = el("div", { class: "mp", style: { background: "radial-gradient(circle at 50% 45%, #6fd0ff, #2a78d6)" } })
  const q = el("div", { class: "mp-q" })
  const btns = el("div", { class: "mp-btns" })
  const note = el("div", { class: "mp-note" })
  stage.append(box, q, btns, note)
  const g = svg("svg", { viewBox: "0 0 100 86" })
  g.append(svg("circle", { cx: C[0], cy: C[1], r: 34, fill: "rgba(255,255,255,.12)" }))
  const cog = svg("g")
  cog.append(svg("path", { d: cogPath(15), fill: "#c7ccd6", stroke: "#646c7c", "stroke-width": 0.9 }), svg("circle", { r: 5, fill: "#8d94a3", stroke: "#646c7c", "stroke-width": 0.7 }))
  const plats = DIR.map(([dx, dy]) => {
    const arm = svg("rect", { x: -3, y: -26, width: 6, height: 14, fill: "#a9b0bd", stroke: "#646c7c", "stroke-width": 0.6, transform: `rotate(${Math.atan2(dy, dx) * 180 / Math.PI + 90})` })
    const plat = svg("g", { transform: `translate(${dx * 25} ${dy * 25})` }, svg("circle", { r: 8.2, fill: "#f4f6fb", stroke: "#646c7c", "stroke-width": 0.8 }))
    const item = svg("g")
    plat.append(item)
    cog.append(arm)
    return { plat, item }
  })
  plats.forEach((p) => cog.append(p.plat))
  g.append(cog)
  const seatsG = svg("g"), fx = svg("g")
  g.append(seatsG, fx)
  box.append(g)
  let V = null, rk = "", spunFor = null, turnSfx = 0

  function drawSeats(v) {
    seatsG.replaceChildren()
    for (const [pid, side] of Object.entries(v.side || {})) {
      const [dx, dy] = DIR[side]
      const x = C[0] + dx * 41, y = C[1] + dy * 38
      const p = ctx.player(pid)
      const reveal = v.phase === "reveal" || v.phase === "finish"
      const presses = reveal && v.press ? v.press[pid].filter(Boolean).length : null
      const locked = (v.locked || []).includes(pid)
      seatsG.append(svg("g", { transform: `translate(${x} ${y})` },
        svg("circle", { r: 6.2, fill: p.color, stroke: pid === ctx.me.id ? "#ffd400" : "#fff", "stroke-width": pid === ctx.me.id ? 1.4 : 0.8 }),
        svg("text", { "text-anchor": "middle", "dominant-baseline": "central", "font-size": 6.6, text: p.avatar }),
        presses !== null ? svg("g", { transform: "translate(6 -6)" }, svg("circle", { r: 3.3, fill: presses ? "#e02e3c" : "#8a93a2", stroke: "#fff", "stroke-width": 0.6 }),
          svg("text", { "text-anchor": "middle", "dominant-baseline": "central", "font-size": 3.6, "font-weight": 900, fill: "#fff", text: presses })) :
          locked ? svg("text", { x: 6.5, y: -5.5, "font-size": 4.2, text: "✅" }) : null))
    }
  }

  const stop = loop(ctx, (now) => {
    if (!V) return
    let ang = 0
    if ((V.phase === "reveal" || V.phase === "finish") && V.rot != null) {
      const t = now - V.t0 - 0.6
      const total = V.rot * 90
      const p = clamp(t / (0.45 + V.rot * 0.35))
      ang = total * (p < 1 ? easeBack(p) : 1)
      const step = Math.floor((ang + 1) / 90)
      if (t > 0 && step > turnSfx && step <= V.rot) { turnSfx = step; ctx.sfx.place() }
      if (p >= 1 && spunFor !== V.round) {
        spunFor = V.round
        const got = V.got || {}
        for (const [pid, it] of Object.entries(got)) {
          const [dx, dy] = DIR[V.side[pid]]
          const x = C[0] + dx * 30, y = (C[1] + dy * 30) / 86 * 100
          popText(box, it === "B" ? "💥 −2" : `+${it}`, x, y, it === "B" ? "bad" : "")
        }
        const mine = got[ctx.me.id]
        if (mine === "B") { ctx.sfx.boom(); box.classList.remove("mp-shake"); void box.offsetWidth; box.classList.add("mp-shake") } else if (mine) ctx.sfx.coin()
      }
    } else if (V.phase === "choose") {
      ang = Math.sin(now * 2) * 2
    }
    cog.setAttribute("transform", `translate(${C[0]} ${C[1]}) rotate(${ang.toFixed(2)})`)
    for (const p of plats) p.item.setAttribute("transform", `rotate(${(-ang).toFixed(2)})`)
  })

  return {
    destroy: stop,
    scores: (v) => v.scores,
    update(v, events) {
      V = v
      K.update(v, events, box)
      const key = `${v.round}:${JSON.stringify(v.items)}`
      if (key !== rk) { rk = key; turnSfx = 0; plats.forEach((p, i) => p.item.replaceChildren(itemNode(v.items[i]))) }
      drawSeats(v)
      const mine = v.mine || []
      const locked = (v.locked || []).includes(ctx.me.id)
      const choose = v.phase === "choose"
      btns.style.setProperty("--n", mine.length + 1)
      btns.replaceChildren(...mine.map((on, b) => el("button", { class: `mp-btn ${on ? "red on" : "gray"}`, type: "button", disabled: !choose || locked,
        onclick: () => { ctx.sfx.click(); ctx.send({ b }) } }, el("span", { class: "em", text: on ? "🔴" : "⚪" }), el("span", { class: "lab", text: on ? ctx.L("DITEKAN", "PRESSED") : ctx.L("Tekan", "Press") }))),
      el("button", { class: `mp-btn ${locked ? "green on" : "green"}`, type: "button", disabled: !choose || locked, onclick: () => { ctx.sfx.pop(); ctx.send({ do: "lock" }) } },
        el("span", { class: "em", text: locked ? "✅" : "🔒" }), el("span", { class: "lab", text: locked ? ctx.L("Terkunci", "Locked") : ctx.L("Kunci", "Lock in") })))
      const reveal = v.phase === "reveal" || v.phase === "finish"
      q.replaceChildren(choose ? ctx.L("Tekan atau tidak? Tiap tekanan (semua pemain) = putar 90° ↻", "Press or not? Every press (all players) = turn 90° ↻")
        : reveal && v.rot != null ? ctx.L(`Total ${v.rot === 0 ? "0 (atau kelipatan 4)" : v.rot} putaran!`, `Turns: ${v.rot === 0 ? "0 (or a multiple of 4)" : v.rot}!`) : ctx.L("Roda Koin berputar…", "The turntable…"),
      el("small", { text: ctx.L("Kamu dapat isi piring yang berhenti di depanmu. 💣 = −2 koin", "You get whatever stops in front of you. 💣 = −2 coins") }))
      note.textContent = choose ? ctx.L(`${(v.locked || []).length}/${ctx.seats().length} sudah kunci`, `${(v.locked || []).length}/${ctx.seats().length} locked in`) : ""
      for (const e of events) {
        if (e.e === "round") ctx.sfx.pop()
        if (e.e === "reveal") { ctx.sfx.drum(); banner(box, ctx.L("PUTAR!", "SPIN!"), { ms: 900 }) }
      }
    },
  }
}
