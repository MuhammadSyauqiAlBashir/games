// Pickax Dash: shake your phone (or tap like crazy) to dig through the rock. First one out the other side wins!
import { el, svg } from "../lib.js?v=__VERSION__"
import { banner, loop, motionOK, onShake, reporter, soloFrame } from "./mp.js?v=__VERSION__"

export function mount(stage, ctx) {
  const S = soloFrame(stage, ctx, { bg: "linear-gradient(#7fd3ff 0 30%, #9a6536 30%)", max: 100 })
  const R = reporter(ctx)
  const g = svg("svg", { viewBox: "0 0 100 60" })
  S.box.append(g)
  g.append(svg("rect", { x: 0, y: 18, width: 100, height: 42, fill: "#7a4a22" }))
  for (let i = 0; i < 40; i++) g.append(svg("circle", { cx: (i * 37) % 100, cy: 22 + ((i * 23) % 36), r: 1 + (i % 3), fill: "rgba(0,0,0,.15)" }))
  g.append(svg("text", { x: 94, y: 14, "text-anchor": "middle", "font-size": 9, text: "💰" }))
  const lanes = svg("g")
  g.append(lanes)
  const dig = el("button", { class: "mp-btn huge", type: "button", onpointerdown: (e) => { e.preventDefault(); hit(0.55) } }, el("span", { text: ctx.L("⛏️ GALI!", "⛏️ DIG!") }))
  const sensorBtn = el("button", { class: "mp-btn green", type: "button", onclick: async () => { if (await motionOK()) { sensorBtn.hidden = true; off = onShake((k) => hit(0.7 + k * 0.5)); ctx.toast(ctx.L("Goyangkan HP-mu!", "Shake your phone!")) } else ctx.toast(ctx.L("Sensor tidak tersedia — ketuk tombolnya", "No sensor — tap the button")) } },
    el("span", { class: "em", text: "📳" }), el("span", { class: "lab", text: ctx.L("Pakai goyang HP", "Use shaking") }))
  S.ctrl.append(dig, sensorBtn)
  let V = null, key = "", prog = 0, off = null, done = false

  function hit(k) {
    if (!V || V.phase !== "play" || done) return
    prog = Math.min(100, prog + k)
    ctx.sfx.tick()
    if (prog >= 100) { done = true; R.set(100, true); ctx.sfx.fanfare(); banner(S.box, ctx.L("TEMBUS!", "BREAKTHROUGH!"), { kind: "good" }) }
    else R.set(Math.round(prog * 10) / 10)
  }
  const stop = loop(ctx, () => {
    if (!V) return
    const seats = ctx.seats()
    if (lanes.childNodes.length !== seats.length) {
      lanes.replaceChildren(...seats.map((p, i) => svg("g", {}, svg("rect", { class: "tun", x: 0, y: 22 + i * (36 / seats.length), width: 0, height: 36 / seats.length - 2, fill: "#2a1608", rx: 2 }),
        svg("text", { class: "who", y: 22 + i * (36 / seats.length) + 36 / seats.length / 2, "dominant-baseline": "central", "font-size": 5, text: p.avatar }))))
    }
    seats.forEach((p, i) => {
      const val = p.id === ctx.me.id ? prog : (V.prog || {})[p.id] || 0
      const x = 4 + val * 0.9
      lanes.children[i].querySelector(".tun").setAttribute("width", x.toFixed(1))
      const w = lanes.children[i].querySelector(".who")
      w.setAttribute("x", (x - 2).toFixed(1))
      w.setAttribute("opacity", val >= 100 || val < 1 ? 1 : 0.55)
    })
  })
  return {
    destroy() { stop(); off && off() },
    scores: (v) => v.scores,
    update(v, events) {
      V = v
      S.update(v, events)
      if (v.phase === "play" && key !== `${v.round}:${v.seed}`) { key = `${v.round}:${v.seed}`; prog = 0; done = false; R.reset() }
      S.q.replaceChildren(ctx.L("Gali terowongan ke harta karun! 💰", "Dig through to the treasure! 💰"), el("small", { text: ctx.L("Goyangkan HP (aktifkan sensor) atau ketuk tombol GALI secepatnya", "Shake your phone (turn on the sensor) or tap DIG as fast as you can") }))
    },
  }
}
