// Shared pieces for game renderers: status line, dice, playing cards, UNO cards, dominoes.
import { el, svg } from "../lib.js?v=__VERSION__"

export function status(ctx, node, v, { mine, other, over } = {}) {
  const myTurn = v.turn === ctx.me.id
  node.className = `status-line${myTurn && !v.over ? " mine" : ""}`
  if (v.over) node.textContent = over || ctx.L("Selesai!", "Game over!")
  else if (myTurn) node.textContent = mine || ctx.L("Giliranmu!", "Your turn!")
  else if (v.turn) node.textContent = other || ctx.L(`Menunggu ${ctx.name(v.turn)}…`, `Waiting for ${ctx.name(v.turn)}…`)
  else node.textContent = ""
}

const PIPS = { 1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[26, 26], [50, 50], [74, 74]], 4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]], 6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]] }
export function dieSvg(n, color = "#2e2722") {
  return svg("svg", { viewBox: "0 0 100 100" }, (PIPS[n] || []).map(([x, y]) => svg("circle", { cx: x, cy: y, r: 10, fill: n === 1 ? "#d9534f" : color })))
}
// ---- 3D dice ----------------------------------------------------------------------------------------------------
// A real cube with six pip faces. makeDie() returns a die that tumbles and lands on a value; the animation is
// time-based, so re-rendering the screen mid-roll doesn't restart it.
const PIP_CELLS = { 1: [5], 2: [3, 7], 3: [3, 5, 7], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] }
const FACE_ROT = { 1: [0, 0], 6: [0, 180], 3: [0, -90], 4: [0, 90], 5: [-90, 0], 2: [90, 0] }  // cube rotation [x, y] showing face n
function cubeNode(size) {
  const cube = el("div", { class: "cube" })
  for (const n of [1, 2, 3, 4, 5, 6]) {
    const face = el("div", { class: `face f${n}` })
    for (let c = 1; c <= 9; c++) face.append(el("i", { class: PIP_CELLS[n].includes(c) ? `pip${n === 1 ? " red" : ""}` : "" }))
    cube.append(face)
  }
  return el("div", { class: "die3d", style: { "--s": `${size}px` } }, cube, el("span", { class: "die-shadow" }))
}
export function makeDie(size = 64) {
  const node = cubeNode(size)
  const cube = node.firstChild
  let cur = [-18, 24], from = cur, to = cur, t0 = 0, dur = 0, raf = 0, value = 0
  const apply = (rx, ry, lift = 0) => { cube.style.transform = `translateY(${-lift}px) rotateX(${rx}deg) rotateY(${ry}deg)` }
  const tick = () => {
    const p = Math.min(1, (performance.now() - t0) / dur)
    const e = 1 - (1 - p) ** 3
    const lift = Math.sin(Math.min(1, p * 1.25) * Math.PI) * size * 0.55
    apply(from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e, lift)
    if (p < 1) raf = requestAnimationFrame(tick); else { cur = to; node.classList.remove("rolling") }
  }
  apply(...cur)
  return {
    el: node,
    get value() { return value },
    show(n, roll = false) {
      if (!n) { node.classList.add("blank"); return }
      node.classList.remove("blank")
      const [fx, fy] = FACE_ROT[n]
      const tilt = [-14, 18]  // a slight 3/4 view so you can see it's a cube
      if (!roll) {
        if (n === value && !node.classList.contains("rolling")) return
        if (node.classList.contains("rolling") && n === value) return
        value = n
        cancelAnimationFrame(raf)
        cur = [fx + tilt[0], fy + tilt[1]]
        apply(...cur)
        return
      }
      value = n
      cancelAnimationFrame(raf)
      from = cur
      const spinX = 360 * (2 + Math.floor(Math.random() * 2)), spinY = 360 * (1 + Math.floor(Math.random() * 2))
      to = [fx + tilt[0] + spinX + Math.round(from[0] / 360) * 360, fy + tilt[1] + spinY + Math.round(from[1] / 360) * 360]
      t0 = performance.now(); dur = 900
      node.classList.add("rolling")
      raf = requestAnimationFrame(tick)
    },
  }
}
// A still 3D die showing n (or a 🎲 if there's no value yet).
export function die(n, rolling = false) {
  if (!n) return el("div", { class: "dice" }, el("span", { style: { fontSize: "30px" }, text: "🎲" }))
  const d = makeDie(56)
  d.show(n, rolling)
  return d.el
}

// ---- dice throw ----------------------------------------------------------------------------------------------------
// Big 3D dice fly in from the side of the board, bounce, roll over and settle on the rolled values. Resolves once
// they've landed (the pieces move after that); the dice then fade away. Drawn in a fixed layer on <body> so the
// board's rounded/clipped corners can't flatten the 3D on iPhone.
const BOUNCES = [0, 0.3, 0.52, 0.68, 0.8]   // where each bounce lands (fraction of the flight)
const BOUNCE_H = [1, 0.42, 0.18, 0.07]      // bounce heights (× die size)
export function throwDice(host, values, { onHit } = {}) {
  return new Promise((resolve) => {
    const r = host.getBoundingClientRect()
    if (!r.width || document.hidden || !values.length) { resolve(); return }
    const S = Math.round(Math.min(104, Math.max(60, Math.min(r.width, r.height) * 0.19)))
    const layer = el("div", { class: "dice-throw", style: { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` } })
    document.body.append(layer)
    const fromLeft = Math.random() < 0.5, dir = fromLeft ? 1 : -1
    const n = values.length
    const dice = values.map((val, k) => {
      const shadow = el("span", { class: "dt-shadow", style: { width: `${S}px`, height: `${S * 0.3}px` } })
      const node = cubeNode(S)
      node.querySelector(".die-shadow").remove()
      layer.append(shadow, node)
      const [fx, fy] = FACE_ROT[val]
      return {
        node, shadow, cube: node.firstChild,
        sx: fromLeft ? -S * 1.2 : r.width + S * 0.2, sy: r.height * (0.62 + Math.random() * 0.25) - k * S * 0.5,
        ex: r.width / 2 + (k - (n - 1) / 2) * S * 1.45 + (Math.random() * 14 - 7), ey: r.height / 2 + (Math.random() * 18 - 9) + (k ? S * 0.25 : 0),
        end: [fx - 14, fy + 18], yaw: Math.random() * 24 - 12,
        spin: [360 * (2 + Math.floor(Math.random() * 2)) * (Math.random() < 0.5 ? 1 : -1), 360 * (3 + k) * dir],
        delay: k * 90, seg: 0,
      }
    })
    const DUR = 1250
    const t0 = performance.now()
    const frame = () => {
      let done = true
      for (const d of dice) {
        const p = Math.max(0, Math.min(1, (performance.now() - t0 - d.delay) / DUR))
        if (p < 1) done = false
        const travel = 1 - (1 - p) ** 2.4               // slows down as it rolls to a stop
        const turn = 1 - (1 - Math.min(1, p / 0.9)) ** 2.6 // rotation finishes a little before it stops sliding
        let h = 0, seg = BOUNCES.length - 1
        for (let i = 0; i < BOUNCES.length - 1; i++) {
          if (p < BOUNCES[i + 1]) {
            seg = i
            const q = (p - BOUNCES[i]) / (BOUNCES[i + 1] - BOUNCES[i])
            h = BOUNCE_H[i] * S * 1.3 * (i === 0 ? Math.cos(q * Math.PI / 2) : Math.sin(q * Math.PI))
            break
          }
        }
        if (seg !== d.seg) { d.seg = seg; onHit && onHit(BOUNCE_H[Math.max(0, seg - 1)] || 0.05) }
        const rock = p > 0.86 ? Math.sin((p - 0.86) / 0.14 * Math.PI * 2) * 7 * (1 - p) / 0.14 : 0
        const x = d.sx + (d.ex - d.sx) * travel, y = d.sy + (d.ey - d.sy) * travel
        const rx = d.end[0] + d.spin[0] * (1 - turn) + rock, ry = d.end[1] + d.spin[1] * (1 - turn)
        const yaw = d.yaw + (1 - turn) * 70 * dir
        d.node.style.transform = `translate(${(x - S / 2).toFixed(1)}px, ${(y - S / 2 - h).toFixed(1)}px)`
        d.cube.style.transform = `rotateZ(${yaw.toFixed(1)}deg) rotateX(${rx.toFixed(1)}deg) rotateY(${ry.toFixed(1)}deg)`
        const lift = Math.min(1, h / (S * 1.3))
        d.shadow.style.transform = `translate(${(x - S / 2).toFixed(1)}px, ${(y + S * 0.38).toFixed(1)}px) scale(${(1 - lift * 0.45).toFixed(2)})`
        d.shadow.style.opacity = (0.55 - lift * 0.35).toFixed(2)
      }
      if (!done) { requestAnimationFrame(frame); return }
      layer.classList.add("landed")
      setTimeout(resolve, 380)
      setTimeout(() => layer.classList.add("gone"), 900)
      setTimeout(() => layer.remove(), 1250)
    }
    requestAnimationFrame(frame)
  })
}

// Holds a game's screen updates while dice are in the air: update() may return a promise (a throw); updates that
// arrive meanwhile are kept (events joined, latest view wins) and shown right after the dice land.
export function gated(update) {
  let busy = false, held = null
  const run = (v, events) => {
    const wait = update(v, events)
    if (wait && wait.then) {
      busy = true
      wait.then(() => { busy = false; if (held) { const [hv, he] = held; held = null; run(hv, he) } })
    }
  }
  return (v, events) => { if (busy) { held = held ? [v, held[1].concat(events)] : [v, events]; return } run(v, events) }
}

export const SUIT = { S: "♠", H: "♥", D: "♦", C: "♣" }
export function pcard(code, w = 56, extra = {}) {
  if (!code) return el("div", { class: "pcard back", style: { "--cw": `${w}px` }, ...extra })
  const r = code[0] === "T" ? "10" : code[0]
  const s = code[1]
  return el("div", { class: `pcard${s === "H" || s === "D" ? " red" : ""}`, style: { "--cw": `${w}px` }, ...extra },
    el("span", { class: "r", text: r }), el("span", { class: "s", text: SUIT[s] }))
}

export const UNO_COLORS = { R: "#e5484d", G: "#3fa66a", B: "#3b82d6", Y: "#f2b63c" }
export function unoCard(code, w = 64, extra = {}) {
  const wild = code.startsWith("W")
  const c = wild ? "#2e2722" : UNO_COLORS[code[0]]
  const v = wild ? (code === "W4" ? "+4" : "★") : code[1] === "S" ? "⦸" : code[1] === "R" ? "⇄" : code[1] === "D" ? "+2" : code[1]
  const node = svg("svg", { viewBox: "0 0 100 140", width: w, height: w * 1.4, style: "flex:none;filter:drop-shadow(0 3px 5px rgba(0,0,0,.25))", ...extra },
    svg("rect", { x: 2, y: 2, width: 96, height: 136, rx: 12, fill: "#fff" }),
    svg("rect", { x: 8, y: 8, width: 84, height: 124, rx: 9, fill: c }),
    wild ? [svg("path", { d: "M50 30 A40 45 0 0 1 90 70 L50 70 Z", fill: UNO_COLORS.R, opacity: .9 }), svg("path", { d: "M90 70 A40 45 0 0 1 50 110 L50 70 Z", fill: UNO_COLORS.B, opacity: .9 }),
      svg("path", { d: "M50 110 A40 45 0 0 1 10 70 L50 70 Z", fill: UNO_COLORS.Y, opacity: .9 }), svg("path", { d: "M10 70 A40 45 0 0 1 50 30 L50 70 Z", fill: UNO_COLORS.G, opacity: .9 })] :
      svg("ellipse", { cx: 50, cy: 70, rx: 34, ry: 50, fill: "#fff", transform: "rotate(25 50 70)" }),
    svg("text", { x: 50, y: 84, "text-anchor": "middle", "font-size": v.length > 1 ? 36 : 44, "font-weight": 900, fill: wild ? "#fff" : c,
      "font-family": "Nunito, sans-serif", stroke: wild ? "#2e2722" : "none", "stroke-width": wild ? 1.5 : 0, text: v }),
    svg("text", { x: 16, y: 30, "font-size": 20, "font-weight": 900, fill: "#fff", "font-family": "Nunito, sans-serif", text: v }))
  return node
}
export function unoBack(w = 64) {
  return svg("svg", { viewBox: "0 0 100 140", width: w, height: w * 1.4, style: "flex:none;filter:drop-shadow(0 3px 5px rgba(0,0,0,.25))" },
    svg("rect", { x: 2, y: 2, width: 96, height: 136, rx: 12, fill: "#fff" }), svg("rect", { x: 8, y: 8, width: 84, height: 124, rx: 9, fill: "#2e2722" }),
    svg("ellipse", { cx: 50, cy: 70, rx: 34, ry: 50, fill: UNO_COLORS.R, transform: "rotate(25 50 70)" }),
    svg("text", { x: 50, y: 80, "text-anchor": "middle", "font-size": 26, "font-weight": 900, fill: "#f2b63c", "font-family": "Nunito, sans-serif", transform: "rotate(-15 50 70)", text: "UNO" }))
}

const DPIPS = { 0: [], 1: [[50, 50]], 2: [[30, 30], [70, 70]], 3: [[28, 28], [50, 50], [72, 72]], 4: [[30, 30], [70, 30], [30, 70], [70, 70]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]], 6: [[30, 24], [70, 24], [30, 50], [70, 50], [30, 76], [70, 76]] }
export function domino(a, b, { size = 34, vertical = false, highlight = false, back = false } = {}) {
  const w = vertical ? size : size * 2, h = vertical ? size * 2 : size
  const half = (n, ox, oy) => (DPIPS[n] || []).map(([x, y]) => svg("circle", { cx: ox + x * size / 100, cy: oy + y * size / 100, r: size * .085, fill: "#2e2722" }))
  return svg("svg", { width: w, height: h, viewBox: `0 0 ${w} ${h}`, style: "flex:none;overflow:visible" },
    svg("rect", { x: .5, y: .5, width: w - 1, height: h - 1, rx: size * .16, fill: back ? "#8a6038" : "#fffaf0", stroke: highlight ? "#e3a93b" : "#b9a88f", "stroke-width": highlight ? 3 : 1.2 }),
    back ? null : [vertical ? svg("line", { x1: 4, y1: size, x2: w - 4, y2: size, stroke: "#b9a88f", "stroke-width": 1.2 }) : svg("line", { x1: size, y1: 4, x2: size, y2: h - 4, stroke: "#b9a88f", "stroke-width": 1.2 }),
      half(a, 0, 0), vertical ? half(b, 0, size) : half(b, size, 0)])
}

export function colorFor(ctx, pid) { return ctx.color(pid) || "#999" }

// ---- flying cards / chips ------------------------------------------------------------------------------------
// Moves a copy of `node` from one screen rectangle to another (fixed position, on top of everything).
export function fly(node, from, to, { dur = 420, delay = 0, rotate = 0, spin = 0, scaleFrom = 1, arc = 0, onDone } = {}) {
  if (!from || !to) { onDone && onDone(); return Promise.resolve() }
  const box = el("div", { class: "fly", style: { left: `${to.left}px`, top: `${to.top}px`, width: `${to.width}px`, height: `${to.height}px` } }, node)
  document.body.append(box)
  const dx = from.left + from.width / 2 - (to.left + to.width / 2), dy = from.top + from.height / 2 - (to.top + to.height / 2)
  const sx = from.width / Math.max(1, to.width) * scaleFrom
  const kf = [
    { transform: `translate(${dx}px, ${dy}px) scale(${sx}) rotate(${spin}deg)`, opacity: 1 },
    { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - arc}px) scale(${(sx + 1) / 2 * 1.08}) rotate(${(spin + rotate) / 2}deg)`, opacity: 1, offset: 0.55 },
    { transform: `translate(0, 0) scale(1) rotate(${rotate}deg)`, opacity: 1 },
  ]
  const anim = box.animate(kf, { duration: dur, delay, easing: "cubic-bezier(.25,.8,.3,1)", fill: "both" })
  return anim.finished.then(() => { box.remove(); onDone && onDone() }, () => box.remove())
}
export const rectOf = (n) => (n && n.isConnected ? n.getBoundingClientRect() : null)
export function chipStack(n = 3) {
  const cols = ["#e5484d", "#3b82d6", "#2e2722", "#3fa66a", "#f2b63c"]
  return el("div", { class: "chip-stack" }, Array.from({ length: n }, (_, i) => el("i", { style: { background: cols[i % cols.length], bottom: `${i * 3}px` } })))
}
