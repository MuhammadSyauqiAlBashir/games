// DK's Konga Line: Donkey Kong plays a bar on his bongos — you copy it in the next bar.
// Left bongo, right bongo, or both together. Nice timing = 2, close = 1.
import { el, svg } from "../lib.js?v=__VERSION__"
import { loop, reporter, rng, soloFrame } from "./mp.js?v=__VERSION__"

const LEAD = 2.4

export function mount(stage, ctx) {
  const S = soloFrame(stage, ctx, { bg: "linear-gradient(#4fb04a,#1f6b2a)", scoreLabel: "🥁" })
  const R = reporter(ctx)
  const g = svg("svg", { viewBox: "0 0 100 70" })
  S.box.append(g)
  const dk = svg("g", { transform: "translate(18 22)" }, svg("text", { "text-anchor": "middle", "dominant-baseline": "central", "font-size": 18, text: "🦍" }))
  const say = svg("text", { x: 50, y: 10, "text-anchor": "middle", "font-size": 5, "font-weight": 900, fill: "#fff", stroke: "#1b3d10", "stroke-width": 1, "paint-order": "stroke" })
  g.append(dk, say)
  for (const [y, lab] of [[42, "L"], [58, "R"]]) g.append(svg("rect", { x: 8, y: y - 5, width: 90, height: 10, rx: 5, fill: "rgba(0,0,0,.2)" }), svg("circle", { cx: 16, cy: y, r: 5, fill: "none", stroke: "#fff", "stroke-width": 0.9 }), svg("text", { x: 16, y: y + 0.4, "text-anchor": "middle", "dominant-baseline": "central", "font-size": 4, "font-weight": 900, fill: "#fff", text: lab }))
  const notesG = svg("g")
  const judge = svg("text", { x: 50, y: 30, "text-anchor": "middle", "font-size": 7, "font-weight": 900, fill: "#ffd400", stroke: "#5a3a00", "stroke-width": 1, "paint-order": "stroke" })
  g.append(notesG, judge)
  const L = el("button", { class: "mp-btn huge", type: "button" }, el("span", { text: "🥁 L" }))
  const Rb = el("button", { class: "mp-btn huge blue", type: "button" }, el("span", { text: "R 🥁" }))
  L.addEventListener("pointerdown", (e) => { e.preventDefault(); tap("L") })
  Rb.addEventListener("pointerdown", (e) => { e.preventDefault(); tap("R") })
  S.ctrl.append(L, Rb)
  let V = null, key = "", C = null, judgeT = 0, lastTap = { L: -9, R: -9 }

  function newGame(seed, t0) {
    const r = rng(seed)
    const beat = 60 / 96
    const notes = []
    for (let k = 0; k < 5; k++) {
      const call = LEAD + k * 8 * beat
      const slots = [0, 1, 1.5, 2, 2.5, 3, 3.5].filter(() => r() < 0.55)
      if (!slots.includes(0)) slots.unshift(0)
      for (const s of slots) { const kind = r() < 0.15 + k * 0.05 ? "B" : r() < 0.5 ? "L" : "R"; notes.push({ t: call + s * beat, kind, dk: true }, { t: call + (s + 4) * beat, kind, dk: false }) }
    }
    C = { beat, notes, t0, score: 0, hit: new Set(), dkPlayed: new Set(), sched: -1 }
    notesG.replaceChildren(...notes.map((n) => svg("g", {}, ...(n.kind === "B" ? [42, 58] : [n.kind === "L" ? 42 : 58]).map((y) => svg("circle", { cy: y, r: 3.6, fill: n.dk ? "rgba(255,255,255,.35)" : "#ffd400", stroke: n.dk ? "none" : "#7a5200", "stroke-width": 0.6 })))))
  }
  function tap(side) {
    if (!C || !V || V.phase !== "play") return
    const t = ctx.now() - C.t0
    lastTap[side] = t
    ctx.sfx.bongo(side === "L")
    let best = -1, bd = 9
    C.notes.forEach((n, i) => { if (!n.dk && !C.hit.has(i) && (n.kind === side || n.kind === "B")) { const d = Math.abs(n.t - t); if (d < bd) { bd = d; best = i } } })
    if (best < 0 || bd > 0.16) return
    const n = C.notes[best]
    if (n.kind === "B" && Math.abs(lastTap.L - lastTap.R) > 0.09) return
    C.hit.add(best)
    const pts = bd <= 0.07 ? 2 : 1
    C.score += pts * (n.kind === "B" ? 2 : 1)
    judge.textContent = pts === 2 ? "Nice!" : "OK"
    judgeT = performance.now()
    R.set(C.score)
  }
  const stop = loop(ctx, (now) => {
    if (!C || !V) return
    const t = V.phase === "play" ? now - C.t0 : -5
    C.notes.forEach((n, i) => {
      const node = notesG.children[i]
      const dx = (n.t - t) * 34
      if (dx < -4 || dx > 90 || C.hit.has(i)) { node.setAttribute("opacity", 0) } else { node.setAttribute("opacity", 1); node.setAttribute("transform", `translate(${(16 + dx).toFixed(2)} 0)`) }
      if (n.dk && !C.dkPlayed.has(i) && n.t - t < 0.12 && n.t - t > -0.2) { C.dkPlayed.add(i); const d = n.t - t; if (n.kind !== "R") ctx.sfx.bongo(true, d); if (n.kind !== "L") ctx.sfx.bongo(false, d) }
    })
    const bar = Math.floor((t - LEAD) / (4 * C.beat))
    say.textContent = t < LEAD ? ctx.L("Siap…", "Ready…") : bar % 2 === 0 ? ctx.L("DK main — dengarkan! 👂", "DK plays — listen! 👂") : ctx.L("Giliranmu — tiru! 🥁", "Your turn — copy it! 🥁")
    dk.setAttribute("transform", `translate(18 ${22 + (bar % 2 === 0 && t > LEAD ? Math.abs(Math.sin(t * 10)) * -1.5 : 0)})`)
    judge.setAttribute("opacity", performance.now() - judgeT < 450 ? 1 : 0)
  })
  return {
    destroy: stop,
    scores: (v) => v.scores,
    update(v, events) {
      V = v
      S.update(v, events)
      if (v.phase === "play" && key !== `${v.round}:${v.seed}`) { key = `${v.round}:${v.seed}`; newGame(v.seed, v.t0); R.reset() }
      if (!C) newGame(3, 1e9)
      S.q.replaceChildren(ctx.L("DK memukul bongo, lalu kamu tiru di bar berikutnya!", "DK drums a bar, then you copy it in the next bar!"), el("small", { text: ctx.L("Bulatan kuning = giliranmu. Dua bulatan = pukul L+R bersamaan.", "Yellow circles = your notes. Two circles = hit L+R together.") }))
    },
  }
}
