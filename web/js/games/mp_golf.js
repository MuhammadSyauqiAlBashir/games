// Tilt-a-Golf: tilt your phone to roll the ball into the cup. Sand slows you down; fall off an edge and you start over.
// No motion sensor? Use the on-screen joystick.
import { el, svg } from "../lib.js?v=__VERSION__"
import { banner, joystick, loop, motionOK, onTilt, reporter, rng, soloFrame } from "./mp.js?v=__VERSION__"

function course(seed, round) {
  const r = rng(seed + round * 17)
  const walls = [], sand = [], holes = []
  const layouts = [
    () => { walls.push([10, 40, 70, 4], [30, 75, 60, 4]); sand.push([60, 15, 18, 14]); holes.push([20, 60, 5]) },
    () => { walls.push([25, 25, 4, 60], [55, 15, 4, 60], [75, 50, 4, 45]); sand.push([30, 60, 20, 16]); holes.push([65, 30, 5], [40, 88, 4.5]) },
    () => { walls.push([10, 30, 55, 4], [35, 55, 55, 4], [10, 80, 55, 4]); sand.push([70, 8, 20, 18]); holes.push([80, 40, 5], [20, 68, 5]) },
  ]
  layouts[(round - 1) % 3]()
  if (r() < 0.5) holes.push([15 + r() * 70, 15 + r() * 70, 4])
  return { walls, sand, holes, start: [50, 108], cup: [50, 8] }
}

export function mount(stage, ctx) {
  const S = soloFrame(stage, ctx, { bg: "#7cc86a", max: 100 })
  const R = reporter(ctx)
  const g = svg("svg", { viewBox: "0 0 100 118" })
  S.box.append(g)
  S.box.style.maxWidth = "min(100%, 460px, calc((100dvh - 470px) * .85))"
  const lay = svg("g"), ball = svg("g", {}, svg("ellipse", { cx: 0.6, cy: 1, rx: 2.6, ry: 1.2, fill: "rgba(0,0,0,.25)" }), svg("circle", { r: 2.5, fill: "#fff", stroke: "#999", "stroke-width": 0.3 }))
  g.append(lay, ball)
  const sensorBtn = el("button", { class: "mp-btn green", type: "button", onclick: async () => { if (await motionOK()) { useTilt = true; sensorBtn.hidden = true; ctx.toast(ctx.L("Sensor aktif — miringkan HP!", "Sensor on — tilt your phone!")) } else ctx.toast(ctx.L("Sensor tidak tersedia, pakai joystick", "No sensor — use the joystick")) } },
    el("span", { class: "em", text: "📱" }), el("span", { class: "lab", text: ctx.L("Pakai sensor miring", "Use tilt sensor") }))
  const joyBox = el("div", { class: "mp-sensor" })
  S.ctrl.append(sensorBtn, joyBox)
  let jx = 0, jy = 0, tx = 0, ty = 0, useTilt = false
  const J = joystick(joyBox, (a, m) => { jx = m ? Math.cos(a) : 0; jy = m ? Math.sin(a) : 0 })
  const offTilt = onTilt((gamma, beta) => { tx = Math.max(-1, Math.min(1, gamma / 30)); ty = Math.max(-1, Math.min(1, (beta - 25) / 30)) })
  let V = null, key = "", C = null, B = null, lastT = 0

  function reset(seed, round) {
    C = course(seed, round)
    lay.replaceChildren(
      svg("rect", { x: 2, y: 2, width: 96, height: 114, rx: 5, fill: "#6fbf5e", stroke: "#3f7f35", "stroke-width": 1.2 }),
      ...Array.from({ length: 12 }, (_, i) => svg("rect", { x: 2, y: 2 + i * 9.5, width: 96, height: 4.75, fill: "rgba(255,255,255,.05)" })),
      ...C.sand.map(([x, y, w, h]) => svg("rect", { x, y, width: w, height: h, rx: 4, fill: "#ecd49a" })),
      ...C.holes.map(([x, y, r]) => svg("circle", { cx: x, cy: y, r, fill: "#1d2a14" })),
      ...C.walls.map(([x, y, w, h]) => svg("rect", { x, y, width: w, height: h, rx: 1.4, fill: "#9a6536", stroke: "#5b3212", "stroke-width": 0.5 })),
      svg("circle", { cx: C.cup[0], cy: C.cup[1] + 2, r: 3.4, fill: "#111" }), svg("line", { x1: C.cup[0], y1: C.cup[1] + 2, x2: C.cup[0], y2: C.cup[1] - 8, stroke: "#eee", "stroke-width": 0.5 }),
      svg("path", { d: `M${C.cup[0]} ${C.cup[1] - 8} l 6 2 l -6 2 Z`, fill: "#e5484d" }))
    B = { x: C.start[0], y: C.start[1], vx: 0, vy: 0, done: false, best: 0 }
  }
  const stop = loop(ctx, (now) => {
    if (!B || !V) return
    const dt = Math.min(0.05, Math.max(0, now - lastT)); lastT = now
    if (V.phase === "play" && !B.done) {
      const ax = (useTilt ? tx : jx) * 70, ay = (useTilt ? ty : jy) * 70
      const inSand = C.sand.some(([x, y, w, h]) => B.x > x && B.x < x + w && B.y > y && B.y < y + h)
      const fr = inSand ? 0.86 : 0.975
      B.vx = (B.vx + ax * dt) * fr; B.vy = (B.vy + ay * dt) * fr
      let nx = B.x + B.vx * dt, ny = B.y + B.vy * dt
      for (const [x, y, w, h] of C.walls) {
        if (nx > x - 2.5 && nx < x + w + 2.5 && ny > y - 2.5 && ny < y + h + 2.5) {
          if (B.x <= x - 2.5 || B.x >= x + w + 2.5) { B.vx *= -0.5; nx = B.x } else { B.vy *= -0.5; ny = B.y }
        }
      }
      if (nx < 4.5 || nx > 95.5) { B.vx *= -0.5; nx = Math.max(4.5, Math.min(95.5, nx)) }
      if (ny < 4.5 || ny > 113.5) { B.vy *= -0.5; ny = Math.max(4.5, Math.min(113.5, ny)) }
      B.x = nx; B.y = ny
      if (C.holes.some(([x, y, r]) => Math.hypot(B.x - x, B.y - y) < r - 0.5)) { ctx.sfx.plop(); B.x = C.start[0]; B.y = C.start[1]; B.vx = B.vy = 0 }
      const d = Math.hypot(B.x - C.cup[0], B.y - C.cup[1] - 2)
      if (d < 3.2 && Math.hypot(B.vx, B.vy) < 60) { B.done = true; R.set(100, true); ctx.sfx.fanfare(); banner(S.box, ctx.L("MASUK!", "IN THE HOLE!"), { kind: "good" }) }
      else { B.best = Math.max(B.best, Math.round((1 - d / 104) * 90)); R.set(B.best) }
    }
    ball.setAttribute("transform", `translate(${B.x.toFixed(2)} ${B.y.toFixed(2)})`)
  })
  return {
    destroy() { stop(); offTilt(); J.destroy() },
    scores: (v) => v.scores,
    update(v, events) {
      V = v
      S.update(v, events)
      if (v.phase === "play" && key !== `${v.round}:${v.seed}`) { key = `${v.round}:${v.seed}`; reset(v.seed, v.round); R.reset() }
      if (!C) reset(1, 1)
      S.q.replaceChildren(ctx.L("Miringkan HP (atau pakai joystick) untuk menggelindingkan bola ke lubang ⛳", "Tilt your phone (or use the joystick) to roll the ball into the cup ⛳"), el("small", { text: ctx.L("Pasir = lambat · lubang hitam = mulai ulang", "Sand = slow · black holes = start over") }))
    },
  }
}
