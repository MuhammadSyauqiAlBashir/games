// Bowser Chicken: shout into the microphone (or hold the button) to drive your little car toward Bowser.
// Stop as close as you can — touch him and he stomps it flat!
import { el, svg } from "../lib.js?v=__VERSION__"
import { banner, loop, micLevel, reporter, soloFrame } from "./mp.js?v=__VERSION__"

const DRIVE = 10

export function mount(stage, ctx) {
  const S = soloFrame(stage, ctx, { bg: "linear-gradient(#ffcf8a 0 55%, #b8a28a 55%)", scoreLabel: "" })
  const R = reporter(ctx)
  const g = svg("svg", { viewBox: "0 0 100 60" })
  S.box.append(g)
  g.append(svg("rect", { x: 0, y: 40, width: 100, height: 20, fill: "#8d8d8d" }), svg("line", { x1: 0, y1: 50, x2: 100, y2: 50, stroke: "#fff", "stroke-width": 0.8, "stroke-dasharray": "5 4" }))
  for (let m = 0; m <= 100; m += 10) g.append(svg("line", { x1: 6 + m * 0.8, y1: 40, x2: 6 + m * 0.8, y2: 42, stroke: "#fff", "stroke-width": 0.4 }))
  const bowser = svg("g", { transform: "translate(92 30)" }, svg("text", { "text-anchor": "middle", "dominant-baseline": "central", "font-size": 22, text: "🐢" }), svg("text", { y: -12, "text-anchor": "middle", "font-size": 8, text: "👑" }))
  const car = svg("g", {}, svg("rect", { x: -5, y: -4, width: 10, height: 5, rx: 1.6, fill: "#e5484d" }), svg("rect", { x: -3, y: -7, width: 6, height: 3.5, rx: 1, fill: "#9fe0ff" }),
    svg("circle", { cx: -3, cy: 1.4, r: 1.6, fill: "#222" }), svg("circle", { cx: 3, cy: 1.4, r: 1.6, fill: "#222" }))
  const lvl = svg("rect", { x: 4, y: 4, width: 0, height: 3, rx: 1.5, fill: "#3fd07a" })
  g.append(bowser, car, svg("rect", { x: 4, y: 4, width: 40, height: 3, rx: 1.5, fill: "rgba(0,0,0,.2)" }), lvl, svg("text", { x: 46, y: 6.8, "font-size": 3.4, "font-weight": 900, text: "🎤" }))
  const micBtn = el("button", { class: "mp-btn green", type: "button", onclick: async () => {
    try { mic = await micLevel(); micBtn.hidden = true; ctx.toast(ctx.L("Mikrofon aktif — teriak! 📣", "Mic on — shout! 📣")) } catch (_) { ctx.toast(ctx.L("Mikrofon ditolak — tahan tombol GAS", "Mic blocked — hold the GAS button")) }
  } }, el("span", { class: "em", text: "🎤" }), el("span", { class: "lab", text: ctx.L("Pakai mikrofon", "Use microphone") }))
  const gas = el("button", { class: "mp-btn huge red", type: "button" }, el("span", { text: ctx.L("GAS! (tahan)", "GAS! (hold)") }))
  gas.addEventListener("pointerdown", (e) => { e.preventDefault(); hold = true })
  for (const ev of ["pointerup", "pointerleave", "pointercancel"]) gas.addEventListener(ev, () => { hold = false })
  S.ctrl.append(micBtn, gas)
  let V = null, key = "", mic = null, hold = false, C = null, lastT = 0

  const stop = loop(ctx, (now) => {
    if (!V || !C) return
    const dt = Math.min(0.05, Math.max(0, now - lastT)); lastT = now
    const t = V.phase === "play" ? now - V.t0 : 0
    const level = V.phase === "play" && t < DRIVE ? (mic ? mic.level() : hold ? 0.8 : 0) : 0
    lvl.setAttribute("width", (level * 40).toFixed(1))
    if (V.phase === "play" && !C.done) {
      C.v = Math.max(0, C.v + (level > 0.12 ? level * 38 : 0) * dt - 9 * dt)
      C.x += C.v * dt
      if (C.x >= 100) { C.x = 100; C.done = true; C.crash = true; ctx.sfx.boom(); banner(S.box, ctx.L("DIINJAK!", "STOMPED!"), { kind: "bad" }); R.set(0, true) }
      else if (t >= DRIVE && C.v < 0.05) { C.done = true; const sc = Math.round(C.x * 10) / 10; R.set(sc, true); ctx.sfx.ding(); banner(S.box, `${(100 - C.x).toFixed(1)} m`, { kind: "good", ms: 1400 }) }
    }
    car.setAttribute("transform", `translate(${(6 + C.x * 0.8).toFixed(2)} ${C.crash ? 46 : 44}) scale(1 ${C.crash ? 0.3 : 1})`)
    bowser.setAttribute("transform", `translate(92 ${30 + (C.crash ? Math.sin(now * 20) * 1 : 0)})`)
  })
  return {
    destroy() { stop(); mic && mic.stop() },
    scores: (v) => v.scores,
    update(v, events) {
      V = v
      S.update(v, events)
      if (v.phase === "play" && key !== `${v.round}:${v.seed}`) { key = `${v.round}:${v.seed}`; C = { x: 0, v: 0, done: false }; R.reset(); lastT = ctx.now() }
      if (!C) C = { x: 0, v: 0, done: true }
      const left = v.phase === "play" ? Math.max(0, DRIVE - (ctx.now() - v.t0)) : DRIVE
      S.q.replaceChildren(ctx.L("Bersuara 📣 (atau tahan GAS) untuk maju. Berhenti sedekat mungkin dengan Bowser!", "Make noise 📣 (or hold GAS) to drive. Stop as close to Bowser as you can!"),
        el("small", { text: ctx.L(`Waktu menyetir: ${left.toFixed(0)} dtk · sentuh Bowser = 0`, `Driving time: ${left.toFixed(0)} s · touch Bowser = 0`) }))
    },
  }
}
