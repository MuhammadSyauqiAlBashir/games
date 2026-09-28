// Speak Up, Junior!: Bowser Jr. flies his Clown Car to the right. Make noise (or hold the button) to rise,
// go quiet to sink — collect as many Bowser medals as you can.
import { el, svg } from "../lib.js?v=__VERSION__"
import { loop, micLevel, reporter, rng, soloFrame } from "./mp.js?v=__VERSION__"

export function mount(stage, ctx) {
  const S = soloFrame(stage, ctx, { bg: "linear-gradient(#6fc6ff,#c9ecff)", scoreLabel: "🏅" })
  const R = reporter(ctx)
  const g = svg("svg", { viewBox: "0 0 100 64" })
  S.box.append(g)
  const world = svg("g")
  const jr = svg("g", {}, svg("path", { d: "M-6 0 Q -6 6 0 6 Q 6 6 6 0 Z", fill: "#fff", stroke: "#999", "stroke-width": 0.5 }),
    svg("circle", { cy: 1.8, r: 1.6, fill: "#e5484d" }), svg("text", { y: -2.8, "text-anchor": "middle", "dominant-baseline": "central", "font-size": 6, text: "🐢" }), svg("path", { d: "M-6.5 -0.4 L 6.5 -0.4", stroke: "#999", "stroke-width": 0.6 }))
  g.append(world, jr)
  const micBtn = el("button", { class: "mp-btn green", type: "button", onclick: async () => {
    try { mic = await micLevel(); micBtn.hidden = true; ctx.toast(ctx.L("Mikrofon aktif — bersuara untuk naik!", "Mic on — make noise to rise!")) } catch (_) { ctx.toast(ctx.L("Mikrofon ditolak — tahan tombol NAIK", "Mic blocked — hold the UP button")) }
  } }, el("span", { class: "em", text: "🎤" }), el("span", { class: "lab", text: ctx.L("Pakai mikrofon", "Use microphone") }))
  const up = el("button", { class: "mp-btn huge blue", type: "button" }, el("span", { text: ctx.L("⬆️ NAIK (tahan)", "⬆️ UP (hold)") }))
  up.addEventListener("pointerdown", (e) => { e.preventDefault(); hold = true })
  for (const ev of ["pointerup", "pointerleave", "pointercancel"]) up.addEventListener(ev, () => { hold = false })
  S.ctrl.append(micBtn, up)
  let V = null, key = "", mic = null, hold = false, G = null, lastT = 0

  function newGame(seed) {
    const r = rng(seed)
    const medals = []
    let x = 40, y = 32
    while (x < 520) { y = Math.max(10, Math.min(54, y + (r() - 0.5) * 22)); const n = 2 + Math.floor(r() * 3); for (let k = 0; k < n; k++) medals.push({ x: x + k * 6, y: y + (r() < 0.3 ? k * 3 : 0) }); x += 22 + r() * 14 }
    G = { medals, y: 32, vy: 0, got: new Set(), score: 0 }
    world.replaceChildren(...medals.map((m) => svg("g", { transform: `translate(${m.x} ${m.y})` }, svg("circle", { r: 2.4, fill: "#f6c945", stroke: "#b8860b", "stroke-width": 0.5 }), svg("text", { "text-anchor": "middle", "dominant-baseline": "central", "font-size": 2.6, text: "🐢" }))))
  }
  const stop = loop(ctx, (now) => {
    if (!V || !G) return
    const dt = Math.min(0.05, Math.max(0, now - lastT)); lastT = now
    const t = V.phase === "play" ? now - V.t0 : 0
    const scroll = t * 32
    if (V.phase === "play") {
      const lvl = mic ? mic.level() : hold ? 0.7 : 0
      G.vy += (lvl > 0.1 ? -70 * lvl : 0) * dt + 28 * dt
      G.vy = Math.max(-40, Math.min(34, G.vy))
      G.y = Math.max(5, Math.min(59, G.y + G.vy * dt))
      if (G.y === 5 || G.y === 59) G.vy = 0
      G.medals.forEach((m, i) => {
        if (!G.got.has(i) && Math.abs(m.x - scroll - 22) < 4.5 && Math.abs(m.y - G.y) < 5) { G.got.add(i); G.score++; ctx.sfx.coin(); world.children[i].setAttribute("opacity", 0); R.set(G.score) }
      })
    }
    world.setAttribute("transform", `translate(${(-scroll).toFixed(2)} 0)`)
    jr.setAttribute("transform", `translate(22 ${G.y.toFixed(2)}) rotate(${Math.max(-20, Math.min(20, G.vy * 0.6)).toFixed(1)})`)
  })
  return {
    destroy() { stop(); mic && mic.stop() },
    scores: (v) => v.scores,
    update(v, events) {
      V = v
      S.update(v, events)
      if (v.phase === "play" && key !== `${v.round}:${v.seed}`) { key = `${v.round}:${v.seed}`; newGame(v.seed); R.reset(); lastT = ctx.now() }
      if (!G) newGame(6)
      S.q.replaceChildren(ctx.L("Bersuara (atau tahan NAIK) untuk terbang ke atas — diam untuk turun", "Make noise (or hold UP) to rise — go quiet to sink"), el("small", { text: ctx.L(`Medali: ${G.score}`, `Medals: ${G.score}`) }))
    },
  }
}
