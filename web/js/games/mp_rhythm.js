// Rhythm Kitchen: ingredients drop to the beat — tap exactly when each one reaches the line.
// "Nice!" timing = 2 points, close = 1. Everyone cooks the same song; best chef wins.
import { el, svg } from "../lib.js?v=__VERSION__"
import { loop, popText, reporter, rng, soloFrame } from "./mp.js?v=__VERSION__"

const DISHES = [["Soup Troupe", "🥕🧅🍅🥔", "🍲"], ["Burger Builders", "🍔🧀🥬🍅", "🍔"], ["Parfait the Course", "🍓🍌🍒🫐", "🍨"], ["Short-Stack Chef", "🥞🧈🍯🍓", "🥞"], ["Copycat Curry", "🥕🥔🧅🌶️", "🍛"]]
const PATTERNS = ["x.x.", "xxx.", "x.xx", "x..x", "xx.x", "xxxx"]
const PENTA = [523, 587, 659, 784, 880, 1047]

export function makeChart(seed, bpm, bars, lead = 2.4) {
  const r = rng(seed)
  const beat = 60 / bpm
  const notes = []
  for (let b = 0; b < bars; b++) {
    const p = PATTERNS[Math.floor(r() * (b < 3 ? 3 : PATTERNS.length))]
    for (let k = 0; k < 4; k++) {
      if (p[k] === "x") notes.push({ t: lead + (b * 4 + k) * beat, f: PENTA[Math.floor(r() * PENTA.length)] })
      if (b > bars / 2 && p[k] === "x" && r() < 0.25) notes.push({ t: lead + (b * 4 + k + 0.5) * beat, f: PENTA[Math.floor(r() * PENTA.length)] })
    }
  }
  return { beat, notes: notes.sort((a, b) => a.t - b.t), end: lead + bars * 4 * beat }
}

export function mount(stage, ctx) {
  const S = soloFrame(stage, ctx, { bg: "linear-gradient(#ffd9a8,#ff9f6b)", scoreLabel: "🎵" })
  const R = reporter(ctx)
  const g = svg("svg", { viewBox: "0 0 100 80", style: "touch-action:none" })
  S.box.append(g)
  g.append(svg("rect", { x: 30, y: 0, width: 40, height: 80, fill: "rgba(255,255,255,.25)" }), svg("rect", { x: 30, y: 60.5, width: 40, height: 1.4, fill: "#fff" }))
  const pot = svg("text", { x: 50, y: 70, "text-anchor": "middle", "dominant-baseline": "central", "font-size": 14 })
  const falling = svg("g")
  const judge = svg("text", { x: 50, y: 50, "text-anchor": "middle", "font-size": 7, "font-weight": 900, fill: "#fff", stroke: "#b3261e", "stroke-width": 1, "paint-order": "stroke" })
  g.append(falling, pot, judge)
  const hitBtn = el("button", { class: "mp-btn huge", type: "button" }, el("span", { text: ctx.L("TAP! 🥄", "TAP! 🥄") }))
  hitBtn.addEventListener("pointerdown", (e) => { e.preventDefault(); hit() })
  g.addEventListener("pointerdown", (e) => { e.preventDefault(); hit() })
  S.ctrl.append(hitBtn)
  let V = null, key = "", C = null, judgeT = 0

  function newGame(seed, t0) {
    const r = rng(seed)
    const dish = DISHES[Math.floor(r() * DISHES.length)]
    C = { ...makeChart(seed, 104 + Math.floor(r() * 16), 14), t0, dish, score: 0, hit: new Set(), sched: -1 }
    pot.textContent = dish[2]
    falling.replaceChildren(...C.notes.map((n, i) => svg("text", { "text-anchor": "middle", "dominant-baseline": "central", "font-size": 8, text: [...dish[1]][i % [...dish[1]].length], opacity: 0 })))
  }
  function hit() {
    if (!C || !V || V.phase !== "play") return
    const t = ctx.now() - C.t0
    let best = -1, bd = 9
    C.notes.forEach((n, i) => { if (!C.hit.has(i)) { const d = Math.abs(n.t - t); if (d < bd) { bd = d; best = i } } })
    if (best < 0 || bd > 0.16) { ctx.sfx.click(); return }
    C.hit.add(best)
    const pts = bd <= 0.07 ? 2 : 1
    C.score += pts
    judge.textContent = pts === 2 ? "Nice!" : "OK"
    judgeT = performance.now()
    ctx.sfx.note(C.notes[best].f * 2, 0.08, 0, "triangle", 0.12)
    R.set(C.score)
  }
  const stop = loop(ctx, (now) => {
    if (!C || !V) return
    const t = V.phase === "play" ? now - C.t0 : -5
    // schedule the backing beat a little ahead
    const nb = Math.floor((t + 0.3 - 0.0) / C.beat)
    for (let b = C.sched + 1; b <= nb; b++) {
      const bt = b * C.beat
      if (bt < 0 || bt > C.end) continue
      ctx.sfx.kickAt(bt - t); ctx.sfx.hatAt(bt + C.beat / 2 - t)
      C.sched = b
    }
    C.notes.forEach((n, i) => {
      const node = falling.children[i]
      const dt = n.t - t
      if (C.hit.has(i) || dt > 1.4 || dt < -0.3) { node.setAttribute("opacity", 0); return }
      if (dt < -0.17 && !node.dataset.miss) { node.dataset.miss = "1"; judge.textContent = ctx.L("Luput", "Miss"); judgeT = performance.now() }
      node.setAttribute("opacity", 1)
      node.setAttribute("transform", `translate(50 ${(61 - dt * 44).toFixed(2)})`)
    })
    judge.setAttribute("opacity", performance.now() - judgeT < 450 ? 1 : 0)
  })
  return {
    destroy: stop,
    scores: (v) => v.scores,
    update(v, events) {
      V = v
      S.update(v, events)
      if (v.phase === "play" && key !== `${v.round}:${v.seed}`) { key = `${v.round}:${v.seed}`; newGame(v.seed, v.t0); R.reset() }
      if (!C) newGame(8, 1e9)
      S.q.replaceChildren(`${C.dish[2]} ${C.dish[0]}`, el("small", { text: ctx.L("Ketuk tepat saat bahan menyentuh garis putih — ikuti ketukan musiknya!", "Tap exactly when each ingredient touches the white line — follow the beat!") }))
    },
  }
}
