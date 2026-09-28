// Penalty shootout: both pick left / middle / right at the same time, then the kick is played out:
// run-up, the ball flying into the corner, the keeper diving, the net bulging (or the save).
import { el, svg } from "../lib.js?v=__VERSION__"

const GOAL = { x0: 24, x1: 76, top: 16, line: 46 }
const BACK = { x0: 28, x1: 72, top: 19, bottom: 43.5 }
const SPOT = [50, 61.2]
const SIDE_NAME = { L: ["Kiri", "Left"], M: ["Tengah", "Middle"], R: ["Kanan", "Right"] }
// Timeline (ms after the result arrives)
const T = { kick: 480, fly: 700, react: 80, dive: 520, after: 900 }

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
const lerp = (a, b, t) => a + (b - a) * t
const clamp = (t) => Math.max(0, Math.min(1, t))
const eOut = (t) => 1 - (1 - t) ** 3
const eInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
function bounce(t) { const n = 7.5625, d = 2.75; if (t < 1 / d) return n * t * t; if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75; if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375; return n * (t -= 2.625 / d) * t + 0.984375 }

// Keeper poses in local coordinates (hip at 0,0; up is -y).
const IDLE = { dx: 0, dy: 0, rot: 0, hl: [-6.8, -4.2], hr: [6.8, -4.2], fl: [-3.4, 9], fr: [3.4, 9] }
function lerpPose(a, b, t) {
  const p = (k) => [lerp(a[k][0], b[k][0], t), lerp(a[k][1], b[k][1], t)]
  return { dx: lerp(a.dx, b.dx, t), dy: lerp(a.dy, b.dy, t), rot: lerp(a.rot, b.rot, t), hl: p("hl"), hr: p("hr"), fl: p("fl"), fr: p("fr") }
}
function keeperWorld(pose, [x, y]) {
  const r = pose.rot * Math.PI / 180, k = 0.92
  return [50 + pose.dx + (x * Math.cos(r) - y * Math.sin(r)) * k, 37 + pose.dy + (x * Math.sin(r) + y * Math.cos(r)) * k]
}

function makePlan(shot, seed) {
  const R = rng(seed)
  const dir = shot.dive === "L" ? -1 : shot.dive === "R" ? 1 : 0
  let dive
  if (dir) {
    const high = R() < 0.5
    const rot = dir * (high ? 62 : 78), dy = high ? -5 : 1.5
    dive = { dx: dir * (high ? 10 : 11.5), dy, rot, hl: [-1.8, -17], hr: [1.8, -17.4], fl: [-1.2, 8.8], fr: [2.6, 7.6] }
  } else if (shot.shot === "M") dive = { dx: 0, dy: 0.8, rot: 0, hl: [-2.2, -5.5], hr: [2.2, -5.5], fl: [-3.8, 8.2], fr: [3.8, 8.2] }
  else dive = { dx: 0, dy: -2.8, rot: 0, hl: [-3.2, -17], hr: [3.2, -17], fl: [-2.4, 8.5], fr: [2.4, 8.5] }
  let target
  if (!shot.goal) {
    if (dir) {
      const f = 0.72 + R() * 0.3
      const hand = [(dive.hl[0] + dive.hr[0]) / 2 * f, (dive.hl[1] + dive.hr[1]) / 2 * f]
      target = keeperWorld(dive, hand)
    } else target = keeperWorld(dive, [0, -5.5])
  } else {
    const s = shot.shot === "L" ? -1 : shot.shot === "R" ? 1 : 0
    const x = s ? 50 + s * (13 + R() * 8.5) : 50 + (R() - 0.5) * 8
    const y = BACK.top + 1.5 + R() * 21
    target = [x, y]
  }
  return { shot, dive, dir, target, spin: (R() < 0.5 ? -1 : 1) * (500 + R() * 400) }
}

export function mount(stage, ctx) {
  const board = el("div", { class: "pen-score" })
  const field = el("div", { class: "pen-field" })
  const msg = el("div", { class: "pen-msg" })
  const pick = el("div", { class: "pen-pick" })
  stage.append(board, field, msg, pick)
  const banner = el("div", { class: "pen-banner", hidden: true })
  let V = null, anim = null, raf = 0, dead = false, bannerTimer = 0

  // ---- static scene ------------------------------------------------------------------------------------
  const g = svg("svg", { viewBox: "9 3 82 73", class: "pen-svg" })
  g.append(svg("defs", {},
    svg("linearGradient", { id: "pSky", x1: 0, y1: 0, x2: 0, y2: 1 }, svg("stop", { offset: 0, "stop-color": "#0d1830" }), svg("stop", { offset: 1, "stop-color": "#243e66" })),
    svg("linearGradient", { id: "pGrass", x1: 0, y1: 0, x2: 0, y2: 1 }, svg("stop", { offset: 0, "stop-color": "#3b8a43" }), svg("stop", { offset: 1, "stop-color": "#5dba5f" })),
    svg("radialGradient", { id: "pGlow", cx: ".5", cy: ".5", r: ".5" }, svg("stop", { offset: 0, "stop-color": "rgba(255,250,215,.95)" }), svg("stop", { offset: 1, "stop-color": "rgba(255,250,215,0)" })),
    svg("radialGradient", { id: "pBall", cx: ".38", cy: ".32", r: ".75" }, svg("stop", { offset: 0, "stop-color": "#ffffff" }), svg("stop", { offset: 1, "stop-color": "#cfd3d8" }))))
  g.append(svg("rect", { x: 0, y: 0, width: 100, height: 29, fill: "url(#pSky)" }))
  for (const x of [9, 91]) g.append(svg("circle", { cx: x, cy: 3.2, r: 7, fill: "url(#pGlow)", opacity: 0.55 }), svg("rect", { x: x - 3, y: 1.8, width: 6, height: 2.6, rx: 0.6, fill: "#fffbe6" }))
  g.append(svg("rect", { x: 0, y: 7, width: 100, height: 18.5, fill: "#18223a" }))
  const crowd = svg("g", { class: "pen-crowd" })
  {
    const R = rng(7)
    const shirts = ["#e5484d", "#f2cf3c", "#3b82d6", "#f7f7f7", "#3fa66a", "#f0843c", "#9b6bd6", "#f7a6c1"]
    for (let row = 0; row < 7; row++) {
      for (let x = 1 + (row % 2) * 1.2; x < 100; x += 2.4) {
        const y = 9 + row * 2.4 + R() * 0.4
        crowd.append(svg("circle", { cx: x + R() * 0.5, cy: y + 0.9, r: 0.95, fill: shirts[Math.floor(R() * shirts.length)], opacity: 0.8 }),
          svg("circle", { cx: x + R() * 0.3, cy: y - 0.3, r: 0.55, fill: ["#f1c9a0", "#c68e5d", "#8d5a3b"][Math.floor(R() * 3)], opacity: 0.85 }))
      }
    }
  }
  g.append(crowd)
  g.append(svg("rect", { x: 0, y: 25.2, width: 100, height: 3.6, fill: "#1f6f60" }),
    svg("text", { x: 50, y: 27.8, "text-anchor": "middle", "font-size": 2.3, "font-weight": 900, fill: "#e9fff7", "letter-spacing": 0.6, text: "BASHGAMES  ⚽  ADU PENALTI  ⚽  BASHGAMES  ⚽  PENALTY  ⚽  BASHGAMES" }))
  g.append(svg("rect", { x: 0, y: 28.8, width: 100, height: 49.2, fill: "url(#pGrass)" }))
  for (let k = 0; k < 10; k += 2) {
    const y0 = 28.8 + 49.2 * (k / 10) ** 1.5, y1 = 28.8 + 49.2 * ((k + 1) / 10) ** 1.5
    g.append(svg("rect", { x: 0, y: y0, width: 100, height: y1 - y0, fill: "rgba(255,255,255,.06)" }))
  }
  const line = { stroke: "rgba(255,255,255,.85)", "stroke-width": 0.45, fill: "none", "stroke-linejoin": "round" }
  g.append(svg("line", { x1: 0, y1: GOAL.line, x2: 100, y2: GOAL.line, ...line }),
    svg("polyline", { points: "31,46 28.5,51 71.5,51 69,46", ...line }),
    svg("polyline", { points: "13,46 5,67 95,67 87,46", ...line }),
    svg("path", { d: "M40.5 67 Q50 72.5 59.5 67", ...line }),
    svg("ellipse", { cx: SPOT[0], cy: SPOT[1] + 2.2, rx: 1.1, ry: 0.45, fill: "#fff" }))
  // goal shadow + inside
  g.append(svg("polygon", { points: "24,46 76,46 79,47.6 27,47.6", fill: "rgba(0,0,0,.16)" }),
    svg("polygon", { points: `${GOAL.x0},${GOAL.top} ${GOAL.x1},${GOAL.top} ${GOAL.x1},${GOAL.line} ${GOAL.x0},${GOAL.line}`, fill: "rgba(8,20,14,.22)" }))
  // side nets + roof (static)
  const net = { stroke: "rgba(255,255,255,.5)", "stroke-width": 0.16, fill: "none" }
  for (let t = 0; t <= 1.0001; t += 1 / 8) {
    g.append(svg("line", { x1: GOAL.x0, y1: lerp(GOAL.top, GOAL.line, t), x2: BACK.x0, y2: lerp(BACK.top, BACK.bottom, t), ...net }),
      svg("line", { x1: GOAL.x1, y1: lerp(GOAL.top, GOAL.line, t), x2: BACK.x1, y2: lerp(BACK.top, BACK.bottom, t), ...net }))
  }
  for (let t = 0; t <= 1.0001; t += 1 / 14) g.append(svg("line", { x1: lerp(GOAL.x0, GOAL.x1, t), y1: GOAL.top, x2: lerp(BACK.x0, BACK.x1, t), y2: BACK.top, ...net }))
  for (const x of [26, 74]) g.append(svg("line", { x1: x, y1: 17.5, x2: x, y2: 44.8, ...net }))
  // back net (bulges)
  const pocket = svg("ellipse", { rx: 0, ry: 0, fill: "rgba(0,0,0,.28)" })
  const backNet = svg("g")
  const netLines = []
  for (let i = 0; i <= 14; i++) netLines.push({ v: true, k: lerp(BACK.x0, BACK.x1, i / 14), n: svg("polyline", net) })
  for (let j = 0; j <= 8; j++) netLines.push({ v: false, k: lerp(BACK.top, BACK.bottom, j / 8), n: svg("polyline", net) })
  for (const l of netLines) backNet.append(l.n)
  g.append(pocket, backNet)
  function drawNet(cx, cy, A) {
    const disp = (x, y) => {
      if (!A) return [x, y]
      const d2 = (x - cx) ** 2 + (y - cy) ** 2
      const f = A * 0.5 * Math.exp(-d2 / (2 * 5.5 * 5.5))
      return [x + (cx - x) * f, y + (cy - y) * f]
    }
    for (const l of netLines) {
      const pts = []
      for (let s = 0; s <= 16; s++) {
        const t = s / 16
        const [x, y] = l.v ? disp(l.k, lerp(BACK.top, BACK.bottom, t)) : disp(lerp(BACK.x0, BACK.x1, t), l.k)
        pts.push(`${x.toFixed(2)},${y.toFixed(2)}`)
      }
      l.n.setAttribute("points", pts.join(" "))
    }
    pocket.setAttribute("cx", cx); pocket.setAttribute("cy", cy)
    pocket.setAttribute("rx", (Math.max(0, A) * 4.5).toFixed(2)); pocket.setAttribute("ry", (Math.max(0, A) * 3.6).toFixed(2))
  }
  drawNet(50, 30, 0)

  // pick zones
  const zones = {}
  const zoneG = svg("g")
  for (const [s, x0, x1] of [["L", 24.9, 41.9], ["M", 41.9, 58.1], ["R", 58.1, 75.1]]) {
    const r = svg("rect", { x: x0 + 0.3, y: GOAL.top + 1.2, width: x1 - x0 - 0.6, height: GOAL.line - GOAL.top - 1.5, rx: 1.4, class: "pen-zone" })
    const t = svg("text", { x: (x0 + x1) / 2, y: 33, "text-anchor": "middle", "font-size": 6, class: "pen-zone-icon", text: "" })
    const zg = svg("g", { class: "pen-zone-g" }, r, t)
    zg.addEventListener("click", () => choose(s))
    zones[s] = { g: zg, r, t }
    zoneG.append(zg)
  }

  // keeper
  const kLimb = (w, c) => svg("line", { stroke: c, "stroke-width": w, "stroke-linecap": "round" })
  const keeper = svg("g")
  const kLegL = kLimb(2.2, "#20242e"), kLegR = kLimb(2.2, "#20242e")
  const kBootL = svg("circle", { r: 1.25, fill: "#111" }), kBootR = svg("circle", { r: 1.25, fill: "#111" })
  const kArmL = kLimb(1.8, "#888"), kArmR = kLimb(1.8, "#888")
  const kGloveL = svg("circle", { r: 1.6, fill: "#fbfbfb", stroke: "#9aa3ad", "stroke-width": 0.25 }), kGloveR = svg("circle", { r: 1.6, fill: "#fbfbfb", stroke: "#9aa3ad", "stroke-width": 0.25 })
  const kShirt = svg("rect", { x: -3.7, y: -9, width: 7.4, height: 9.4, rx: 2.2, fill: "#888" })
  const kStripe = svg("rect", { x: -3.7, y: -5.4, width: 7.4, height: 1.3, fill: "rgba(255,255,255,.35)" })
  const kShorts = svg("rect", { x: -3.5, y: -0.6, width: 7, height: 3.4, rx: 1, fill: "#20242e" })
  const kHeadBg = svg("circle", { cx: 0, cy: -12.4, r: 3.4, fill: "#fff3df" })
  const kHead = svg("text", { x: 0, y: -10.6, "text-anchor": "middle", "font-size": 5, text: "" })
  keeper.append(kLegL, kLegR, kBootL, kBootR, kShorts, kArmL, kArmR, kShirt, kStripe, kHeadBg, kHead, kGloveL, kGloveR)
  const kShadow = svg("ellipse", { cx: 50, cy: 46.4, rx: 5, ry: 0.9, fill: "rgba(0,0,0,.25)" })

  // shooter (seen from behind)
  const shooter = svg("g")
  const sLegL = kLimb(2.4, "#f4f4f4"), sLegR = kLimb(2.4, "#f4f4f4")
  const sBootL = svg("circle", { r: 1.3, fill: "#222" }), sBootR = svg("circle", { r: 1.3, fill: "#222" })
  const sArmL = kLimb(1.8, "#888"), sArmR = kLimb(1.8, "#888")
  const sShirt = svg("rect", { x: -4, y: -10, width: 8, height: 10.4, rx: 2.4, fill: "#888" })
  const sNum = svg("text", { x: 0, y: -3.6, "text-anchor": "middle", "font-size": 4.4, "font-weight": 900, fill: "rgba(255,255,255,.9)", text: "10" })
  const sShorts = svg("rect", { x: -3.8, y: -0.6, width: 7.6, height: 3.6, rx: 1, fill: "#f4f4f4" })
  const sHeadBg = svg("circle", { cx: 0, cy: -13.4, r: 3.5, fill: "#fff3df" })
  const sHead = svg("text", { x: 0, y: -11.5, "text-anchor": "middle", "font-size": 5.2, text: "" })
  shooter.append(sLegL, sLegR, sBootL, sBootR, sShorts, sArmL, sArmR, sShirt, sNum, sHeadBg, sHead)
  const sShadow = svg("ellipse", { rx: 4.5, ry: 0.9, fill: "rgba(0,0,0,.25)" })

  // ball
  const ballShadow = svg("ellipse", { rx: 1.6, ry: 0.5, fill: "rgba(0,0,0,.35)" })
  const ballSpin = svg("g", {},
    svg("circle", { r: 1, fill: "url(#pBall)", stroke: "#3a3a3a", "stroke-width": 0.06 }),
    svg("path", { d: "M0 -.34 L.32 -.1 L.2 .28 L-.2 .28 L-.32 -.1 Z", fill: "#2b2b2b" }),
    ...[0, 72, 144, 216, 288].map((a) => svg("path", { d: "M-.16 -.98 L.16 -.98 L.1 -.78 L-.1 -.78 Z", fill: "#2b2b2b", transform: `rotate(${a + 36})` })))
  const ball = svg("g", {}, ballSpin)

  g.append(kShadow, zoneG, keeper, ballShadow, ball, sShadow, shooter)
  field.append(g, banner)

  const limb = (n, a, b) => { n.setAttribute("x1", a[0]); n.setAttribute("y1", a[1]); n.setAttribute("x2", b[0]); n.setAttribute("y2", b[1]) }
  const at = (n, p) => { n.setAttribute("cx", p[0]); n.setAttribute("cy", p[1]) }

  function setPlayers() {
    if (!V) return
    const kc = ctx.color(V.keeper) || "#e3a93b", sc = ctx.color(V.shooter) || "#3b82d6"
    for (const n of [kArmL, kArmR]) n.setAttribute("stroke", kc)
    kShirt.setAttribute("fill", kc)
    kHead.textContent = ctx.player(V.keeper)?.avatar || "🧤"
    for (const n of [sArmL, sArmR]) n.setAttribute("stroke", sc)
    sShirt.setAttribute("fill", sc)
    sHead.textContent = ctx.player(V.shooter)?.avatar || "⚽"
  }

  function poseKeeper(p, bob) {
    keeper.setAttribute("transform", `translate(${(50 + p.dx).toFixed(2)} ${(37 + p.dy + bob).toFixed(2)}) rotate(${p.rot.toFixed(1)}) scale(.92)`)
    limb(kLegL, [-1.6, 2.4], p.fl); limb(kLegR, [1.6, 2.4], p.fr); at(kBootL, p.fl); at(kBootR, p.fr)
    limb(kArmL, [-3.3, -7.6], p.hl); limb(kArmR, [3.3, -7.6], p.hr); at(kGloveL, p.hl); at(kGloveR, p.hr)
    const hip = keeperWorld(p, [0, 0])
    kShadow.setAttribute("cx", hip[0].toFixed(2))
    kShadow.setAttribute("rx", (5 + Math.abs(p.rot) / 12).toFixed(2))
  }
  function poseShooter(t) {
    // t in ms from the start of the run-up; <0 = standing ready
    const run = clamp(t / T.kick)
    const e = eInOut(run)
    const after = clamp((t - T.kick - 120) / 450)
    const x = lerp(35.5, 45.2, e) - eOut(after) * 5, y = lerp(71, 57.5, e) + eOut(after) * 1.5, sc = lerp(1.2, 0.98, e)
    const op = (1 - after * 0.5).toFixed(2)
    shooter.setAttribute("opacity", op); sShadow.setAttribute("opacity", op)
    const stride = t > 0 && t < T.kick ? Math.sin(run * Math.PI * 5) : 0
    const kick = clamp((t - T.kick + 140) / 260)
    const swing = kick > 0 ? Math.sin(kick * Math.PI) : 0
    shooter.setAttribute("transform", `translate(${x.toFixed(2)} ${(y - Math.abs(stride) * 0.6).toFixed(2)}) scale(${sc.toFixed(3)})`)
    const fl = [-2.6 + stride * 1.2, 9.6], fr = [2.6 - stride * 1.2 + swing * 3.2, 9.6 - swing * 3.6]
    limb(sLegL, [-1.7, 2.6], fl); limb(sLegR, [1.7, 2.6], fr); at(sBootL, fl); at(sBootR, fr)
    const arm = stride * 1.8 + swing * 2
    limb(sArmL, [-3.6, -8.2], [-6.6 - swing * 1.5, -1.8 + arm]); limb(sArmR, [3.6, -8.2], [6.4 + swing, -2 - arm])
    sShadow.setAttribute("cx", x.toFixed(2)); sShadow.setAttribute("cy", (y + 10 * sc).toFixed(2))
  }
  function placeBall(x, y, scale, rot, groundY, height) {
    ball.setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${scale.toFixed(3)})`)
    ballSpin.setAttribute("transform", `rotate(${rot.toFixed(1)})`)
    ballShadow.setAttribute("cx", x.toFixed(2)); ballShadow.setAttribute("cy", groundY.toFixed(2))
    const s = scale * 0.7 / (1 + height * 0.06)
    ballShadow.setAttribute("rx", (1.6 * s).toFixed(2)); ballShadow.setAttribute("ry", (0.5 * s).toFixed(2))
  }

  // ---- the animation --------------------------------------------------------------------------------
  function render(now) {
    const idleBob = Math.sin(now / 260) * 0.25
    if (!anim) {
      const sway = Math.sin(now / 700) * 1.2
      poseKeeper({ ...IDLE, dx: sway }, idleBob)
      poseShooter(-1)
      placeBall(SPOT[0], SPOT[1], 2.4, 0, SPOT[1] + 2.4, 0)
      drawNet(50, 30, 0)
      return
    }
    const t = now - anim.t0
    const P = anim.plan
    poseShooter(t)
    // keeper
    const kd = clamp((t - T.kick - T.react) / T.dive)
    const pose = lerpPose(IDLE, P.dive, eOut(kd))
    // after the ball arrives the keeper lands on the grass (or back on his feet)
    const fallT = clamp((t - T.kick - T.fly - 150) / 450)
    if (P.dir && kd >= 1) pose.dy = lerp(P.dive.dy, 6.2, bounce(fallT))
    else if (P.dive.dy < 0 && kd >= 1) pose.dy = lerp(P.dive.dy, 0, eOut(fallT))
    poseKeeper(pose, kd > 0 ? 0 : idleBob)
    // ball
    const hit = T.kick + T.fly
    const [tx, ty] = P.target
    if (t < T.kick) { placeBall(SPOT[0], SPOT[1], 2.4, 0, SPOT[1] + 2.4, 0); drawNet(50, 30, 0); return }
    if (t < hit) {
      const u = (t - T.kick) / T.fly
      const p = 1 - (1 - u) ** 1.35
      const gy = lerp(SPOT[1] + 2.4, GOAL.line + 0.4, 1 - (1 - p) ** 1.4)
      const scale = lerp(2.4, 1.25, p)
      const hv = (GOAL.line + 0.4 - 1.25 - ty) * p + Math.sin(p * Math.PI) * 3
      placeBall(lerp(SPOT[0], tx, p), gy - scale - hv, scale, P.spin * u, gy, hv)
      drawNet(50, 30, 0)
      return
    }
    const a = t - hit
    if (P.shot.goal) {
      // into the net, net bulges and springs back, ball drops to the back of the goal
      const A = a < 140 ? a / 140 : Math.exp(-(a - 140) / 320) * Math.cos((a - 140) / 95)
      drawNet(tx, ty, A)
      const push = clamp(a / 140)
      const fall = clamp((a - 180) / 650)
      const bx = lerp(tx, tx + (50 - tx) * 0.08, push)
      const by0 = lerp(ty, ty + 0.6, push)
      const by = lerp(by0, BACK.bottom - 1, bounce(fall))
      placeBall(bx, by, lerp(1.25, 1.05, push), P.spin * (1 + a / 1400), BACK.bottom + 0.3, Math.max(0, BACK.bottom - 1 - by))
    } else if (P.dir) {
      // parried away to the side
      drawNet(50, 30, 0)
      const u = clamp(a / 800)
      const e = eOut(u)
      const x = lerp(tx, tx + P.dir * 16, e), y = lerp(ty, ty + 22, e) - Math.sin(u * Math.PI) * 9
      placeBall(x, y, lerp(1.25, 2.1, e), P.spin * (1 - a / 900), lerp(GOAL.line + 0.4, 66, e), Math.max(0, lerp(GOAL.line + 0.4, 66, e) - y))
      ball.setAttribute("opacity", (1 - clamp((a - 600) / 300)).toFixed(2))
      ballShadow.setAttribute("opacity", (1 - clamp((a - 600) / 300)).toFixed(2))
    } else {
      // caught at the chest
      drawNet(50, 30, 0)
      const c = keeperWorld(pose, [0, -5.5])
      placeBall(c[0], c[1], 1.25, P.spin * 0.8, GOAL.line + 0.4, 6)
    }
  }
  function loop(now) { if (dead) return; render(now); raf = requestAnimationFrame(loop) }
  raf = requestAnimationFrame(loop)

  function startShot(shot, live) {
    const seed = (V ? Object.values(V.history).reduce((n, h) => n + h.length, 0) : 0) * 31 + (shot.shot.charCodeAt(0) * 7) + shot.dive.charCodeAt(0)
    anim = { t0: live ? performance.now() : -1e9, plan: makePlan(shot, seed) }
    ball.setAttribute("opacity", 1); ballShadow.setAttribute("opacity", 1)
    if (!live) return
    setTimeout(() => ctx.sfx.whistle(), 60)
    setTimeout(() => ctx.sfx.kick(), T.kick)
    const hit = T.kick + T.fly
    setTimeout(() => {
      if (dead) return
      if (shot.goal) { ctx.sfx.net(); setTimeout(() => ctx.sfx.cheer(), 120) } else { ctx.sfx.glove(); setTimeout(() => ctx.sfx.groan(), 150) }
      setTimeout(() => { if (!dead && anim) showBanner(shot) }, 380)
    }, hit)
  }
  function showBanner(shot) {
    const me = ctx.me.id
    const mine = shot.goal ? shot.shooter === me : shot.keeper === me
    banner.className = `pen-banner ${shot.goal ? "goal" : "save"}`
    banner.replaceChildren(el("b", { text: shot.goal ? "GOOOL!" : ctx.L("DITEPIS!", "SAVED!") }),
      el("span", { text: shot.goal ? `⚽ ${ctx.name(shot.shooter)}` : `🧤 ${ctx.name(shot.keeper)}` }))
    banner.hidden = false
    crowd.classList.toggle("jump", !!shot.goal)
    if (mine) confettiBurst(shot.goal ? ctx.color(shot.shooter) : ctx.color(shot.keeper))
    clearTimeout(bannerTimer)
    bannerTimer = setTimeout(() => { banner.hidden = true; crowd.classList.remove("jump") }, 2300)
  }
  function confettiBurst(color) {
    const box = el("div", { class: "pen-confetti" })
    const cols = [color || "#f2cf3c", "#f2cf3c", "#ffffff", "#3fa66a"]
    for (let i = 0; i < 36; i++) {
      box.append(el("i", { style: { left: `${50 + (Math.random() - 0.5) * 30}%`, background: cols[i % 4],
        "--dx": `${(Math.random() - 0.5) * 360}px`, "--dy": `${-120 - Math.random() * 160}px`, "--r": `${Math.random() * 900 - 450}deg`, animationDelay: `${Math.random() * 120}ms` } }))
    }
    field.append(box)
    setTimeout(() => box.remove(), 1800)
  }

  function choose(side) {
    const v = V
    if (!v || v.phase !== "choose" || v.mine) return
    if (v.shooter !== ctx.me.id && v.keeper !== ctx.me.id) return
    ctx.sfx.click()
    ctx.send({ side })
  }

  function drawScore(v) {
    const me = ctx.me.id
    const seats = ctx.seats()
    const kicksShown = Math.max(v.kicks, ...seats.map((p) => v.history[p.id].length))
    const team = (p) => el("div", { class: `pen-team${v.shooter === p.id ? " shooting" : ""}`, style: { "--c": p.color } },
      el("div", { class: "pen-who" }, el("span", { class: "av", style: { "--c": p.color }, text: p.avatar }),
        el("b", { text: p.id === me ? ctx.L("Kamu", "You") : p.name }), el("span", { class: "pen-role", text: v.shooter === p.id ? "⚽" : "🧤" })),
      el("div", { class: "pen-dots" }, [...v.history[p.id], ...Array(Math.max(0, kicksShown - v.history[p.id].length)).fill(null)].map((h) =>
        el("i", { class: h === null ? "" : h ? "in" : "out" }))))
    const [a, b] = seats
    if (!a || !b) return
    board.replaceChildren(team(a),
      el("div", { class: "pen-total" }, el("div", { class: "pen-nums", text: `${v.scores[a.id]} – ${v.scores[b.id]}` }),
        el("div", { class: "pen-sub", text: v.sudden ? "Sudden death" : ctx.L(`Tendangan ${Math.min(v.kicks, Math.max(...seats.map((p) => v.history[p.id].length)) + (v.phase === "choose" ? 1 : 0))}/${v.kicks}`,
          `Kick ${Math.min(v.kicks, Math.max(...seats.map((p) => v.history[p.id].length)) + (v.phase === "choose" ? 1 : 0))}/${v.kicks}`) })),
      team(b))
  }

  return {
    destroy() { dead = true; cancelAnimationFrame(raf); clearTimeout(bannerTimer) },
    update(v, events) {
      V = v
      setPlayers()
      const shotEv = events.find((e) => e.e === "shot")
      if (shotEv) startShot(shotEv, true)
      else if (v.phase === "result" && v.last && !anim) startShot(v.last, false)
      if (events.find((e) => e.e === "kick") || (v.phase !== "result" && anim && !shotEv)) { anim = null; banner.hidden = true }
      drawScore(v)
      const me = ctx.me.id
      const role = v.shooter === me ? "shooter" : v.keeper === me ? "keeper" : null
      const choosing = v.phase === "choose" && role && !v.mine
      for (const [s, z] of Object.entries(zones)) {
        z.g.classList.toggle("can", !!choosing)
        z.g.classList.toggle("on", v.phase === "choose" && v.mine === s)
        z.t.textContent = v.phase === "choose" && v.mine === s ? (role === "shooter" ? "🎯" : "🧤") : ""
      }
      const other = role === "shooter" ? v.keeper : v.shooter
      const otherReady = other && (v.picked || []).includes(other)
      if (v.phase === "choose") {
        msg.className = "pen-msg"
        msg.textContent = role === "shooter" ? ctx.L("Kamu menendang — ketuk sudut gawang!", "You're shooting — tap a corner of the goal!")
          : role === "keeper" ? ctx.L("Kamu kiper — lompat ke mana?", "You're in goal — where will you dive?")
            : ctx.L(`${ctx.name(v.shooter)} menendang…`, `${ctx.name(v.shooter)} is shooting…`)
        if (v.sudden) msg.textContent = `⚡ Sudden death — ${msg.textContent}`
      } else if (v.phase === "intro") {
        msg.className = "pen-msg"
        msg.textContent = ctx.L("Bersiap… 🏟️", "Get ready… 🏟️")
      } else {
        msg.className = "pen-msg quiet"
        msg.textContent = v.last ? ctx.L(`Tendangan ke ${SIDE_NAME[v.last.shot][0].toLowerCase()}, kiper ke ${SIDE_NAME[v.last.dive][0].toLowerCase()}`, `Shot ${SIDE_NAME[v.last.shot][1].toLowerCase()}, keeper went ${SIDE_NAME[v.last.dive][1].toLowerCase()}`) : ""
      }
      pick.replaceChildren()
      if (v.phase === "choose" && role) {
        if (v.mine) {
          pick.append(el("div", { class: "pen-wait" }, el("b", { text: `✓ ${ctx.L(SIDE_NAME[v.mine][0], SIDE_NAME[v.mine][1])}` }),
            el("span", { text: otherReady ? ctx.L(" — lawan juga sudah memilih!", " — your opponent has chosen too!") : ctx.L(" — menunggu lawan…", " — waiting for your opponent…") })))
        } else {
          for (const [s, icon] of [["L", "⬅️"], ["M", "⬆️"], ["R", "➡️"]]) {
            pick.append(el("button", { class: "btn primary big pen-btn", type: "button", onclick: () => choose(s) },
              el("span", { text: icon }), el("span", { text: ctx.L(SIDE_NAME[s][0], SIDE_NAME[s][1]) })))
          }
          if (otherReady) pick.append(el("div", { class: "pen-hint", text: ctx.L("Lawan sudah memilih ✓", "Your opponent has chosen ✓") }))
        }
      }
    },
  }
}
