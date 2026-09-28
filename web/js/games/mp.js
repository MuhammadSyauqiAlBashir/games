// Shared kit for the Mario Party–style minigames: HUD chips, START!/FINISH! banners, characters (SVG),
// coins and stars, a clock-driven animation loop, and point pop-ups.
import { el, svg } from "../lib.js?v=__VERSION__"

// ---- animation loop driven by the room's game clock -----------------------------------------------------
export function loop(ctx, fn) {
  let raf = 0, dead = false
  const f = () => { if (dead) return; try { fn(ctx.now()) } catch (e) { console.error(e) } raf = requestAnimationFrame(f) }
  raf = requestAnimationFrame(f)
  return () => { dead = true; cancelAnimationFrame(raf) }
}
export const clamp = (t) => Math.max(0, Math.min(1, t))
export const lerp = (a, b, t) => a + (b - a) * t
export const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)
export const easeOut = (t) => 1 - (1 - t) ** 3
export const easeBack = (t) => { const c = 1.7; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2 }

// ---- banners -------------------------------------------------------------------------------------------------
export function banner(host, text, { kind = "", ms = 1600, sub = "" } = {}) {
  const b = el("div", { class: `mp-banner ${kind}` }, el("b", { text }), sub ? el("span", { text: sub }) : null)
  host.append(b)
  setTimeout(() => b.remove(), ms)
  return b
}

// ---- HUD: round + player chips with points ---------------------------------------------------------------------
export function kit(stage, ctx, { title = "", scoreLabel = "", pointsOf = (v) => v.scores || {} } = {}) {
  const hud = el("div", { class: "mp-hud" })
  const round = el("div", { class: "mp-round" })
  const chips = el("div", { class: "mp-chips" })
  hud.append(round, chips)
  stage.append(hud)
  let shownPhase = null, lastPts = {}
  return {
    hud,
    update(v, events, host) {
      const ph = `${v.phase}:${v.round}`
      if (v.phase === "start" && shownPhase !== ph) { banner(host, "START!", { kind: "start" }); ctx.sfx.mpStart() }
      if (v.phase === "finish" && shownPhase !== ph) { banner(host, "FINISH!", { kind: "finish", ms: 2400 }); ctx.sfx.mpFinish() }
      shownPhase = ph
      round.textContent = v.round ? `${title ? title + " · " : ""}${ctx.L("Ronde", "Round")} ${Math.max(1, v.round)}${v.rounds ? "/" + v.rounds : ""}` : title
      const pts = pointsOf(v)
      chips.replaceChildren(...ctx.seats().map((p) => {
        const n = pts[p.id] ?? 0
        const up = lastPts[p.id] !== undefined && n > lastPts[p.id]
        return el("div", { class: `mp-chip${p.id === ctx.me.id ? " me" : ""}${up ? " up" : ""}`, style: { "--c": p.color } },
          el("span", { class: "av", text: p.avatar }), el("b", { text: n }), scoreLabel ? el("small", { text: scoreLabel }) : null)
      }))
      lastPts = { ...pts }
      void events
    },
  }
}

export function popText(host, text, x, y, cls = "") {
  const p = el("div", { class: `mp-pop ${cls}`, text, style: { left: `${x}%`, top: `${y}%` } })
  host.append(p)
  setTimeout(() => p.remove(), 1300)
}

export function chipFor(ctx, pid, extra = null) {
  const p = ctx.player(pid)
  return el("span", { class: "mp-chip small", style: { "--c": p.color } }, el("span", { class: "av", text: p.avatar }), el("b", { text: p.id === ctx.me.id ? ctx.L("Kamu", "You") : p.name }), extra)
}

// ---- characters (SVG groups drawn around 0,0) --------------------------------------------------------------------
export function coin(r = 5) {
  return svg("g", {}, svg("ellipse", { rx: r, ry: r, fill: "#f7c533", stroke: "#b8860b", "stroke-width": r * 0.14 }),
    svg("ellipse", { rx: r * 0.28, ry: r * 0.62, fill: "#fff3b0", stroke: "#d9a21b", "stroke-width": r * 0.08 }))
}
export function star(r = 6, fill = "#ffd400") {
  const pts = []
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; pts.push(`${(Math.cos(a) * rr).toFixed(2)},${(Math.sin(a) * rr).toFixed(2)}`) }
  return svg("g", {}, svg("polygon", { points: pts.join(" "), fill, stroke: "#c98a00", "stroke-width": r * 0.1, "stroke-linejoin": "round" }),
    svg("circle", { cx: -r * 0.15, cy: -r * 0.05, r: r * 0.08, fill: "#3a2a00" }), svg("circle", { cx: r * 0.15, cy: -r * 0.05, r: r * 0.08, fill: "#3a2a00" }))
}
export function thwomp(w = 26, h = 30, mood = "angry") {
  const g = svg("g")
  g.append(svg("rect", { x: -w / 2, y: -h / 2, width: w, height: h, rx: 2.4, fill: "#8e9bb0", stroke: "#4a5468", "stroke-width": 1.1 }))
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const x = sx * w / 2, y = sy * h / 2
    g.append(svg("polygon", { points: `${x},${y - sy * 3} ${x + sx * 3.6},${y + sy * 0.8} ${x},${y + sy * 0.2}`, fill: "#8e9bb0", stroke: "#4a5468", "stroke-width": 0.8 }))
  }
  g.append(svg("rect", { x: -w / 2 + 2, y: -h / 2 + 2, width: w - 4, height: h - 4, rx: 1.6, fill: "none", stroke: "rgba(255,255,255,.35)", "stroke-width": 0.6 }))
  const brow = mood === "angry" ? 2.6 : 0
  for (const s of [-1, 1]) {
    g.append(svg("ellipse", { cx: s * w * 0.2, cy: -h * 0.12, rx: w * 0.13, ry: h * 0.12, fill: "#fff", stroke: "#2d3446", "stroke-width": 0.6 }))
    g.append(svg("circle", { cx: s * w * 0.17, cy: -h * 0.1, r: w * 0.055, fill: "#1b1f2b" }))
    g.append(svg("line", { x1: s * w * 0.34, y1: -h * 0.3 - brow * 0.2, x2: s * w * 0.06, y2: -h * 0.26 + brow, stroke: "#2d3446", "stroke-width": 1.6, "stroke-linecap": "round" }))
  }
  g.append(svg("rect", { x: -w * 0.3, y: h * 0.12, width: w * 0.6, height: h * 0.18, rx: 1, fill: "#fff", stroke: "#2d3446", "stroke-width": 0.6 }))
  for (let i = 1; i < 5; i++) g.append(svg("line", { x1: -w * 0.3 + i * w * 0.12, y1: h * 0.12, x2: -w * 0.3 + i * w * 0.12, y2: h * 0.3, stroke: "#2d3446", "stroke-width": 0.4 }))
  return g
}
export function bobomb(r = 6, lit = true) {
  return svg("g", {},
    svg("circle", { r, fill: "#23252e", stroke: "#0e0f13", "stroke-width": r * 0.08 }),
    svg("circle", { cx: -r * 0.35, cy: -r * 0.35, r: r * 0.22, fill: "rgba(255,255,255,.35)" }),
    svg("ellipse", { cx: -r * 0.28, cy: -r * 0.05, rx: r * 0.12, ry: r * 0.22, fill: "#fff" }),
    svg("ellipse", { cx: r * 0.12, cy: -r * 0.05, rx: r * 0.12, ry: r * 0.22, fill: "#fff" }),
    svg("rect", { x: -r * 0.18, y: -r * 1.25, width: r * 0.36, height: r * 0.35, fill: "#b9b9b9" }),
    svg("path", { d: `M0 ${-r * 1.25} q ${r * 0.3} ${-r * 0.4} ${r * 0.1} ${-r * 0.7}`, stroke: "#c9a36b", "stroke-width": r * 0.12, fill: "none" }),
    lit ? svg("circle", { class: "mp-spark", cx: r * 0.1, cy: -r * 1.95, r: r * 0.2, fill: "#ffd24a" }) : null,
    svg("ellipse", { cx: -r * 0.5, cy: r * 0.95, rx: r * 0.42, ry: r * 0.2, fill: "#e8a33d" }),
    svg("ellipse", { cx: r * 0.5, cy: r * 0.95, rx: r * 0.42, ry: r * 0.2, fill: "#e8a33d" }))
}
export function toad(color = "#e5484d", s = 1) {
  const spots = svg("g", {}, ...[[-4.5, -12.5, 2], [4.5, -12.5, 2], [0, -16.5, 2.2]].map(([x, y, r]) => svg("circle", { cx: x, cy: y, r, fill: color })))
  return svg("g", { transform: `scale(${s})` },
    svg("ellipse", { cx: 0, cy: 0, rx: 4.5, ry: 3.2, fill: "#3456b8" }),
    svg("ellipse", { cx: 0, cy: -5.5, rx: 4.6, ry: 4, fill: "#ffe0bd" }),
    svg("circle", { cx: -1.6, cy: -5.6, r: 0.7, fill: "#222" }), svg("circle", { cx: 1.6, cy: -5.6, r: 0.7, fill: "#222" }),
    svg("path", { d: "M-1.2 -3.6 q1.2 1 2.4 0", stroke: "#a0522d", "stroke-width": 0.5, fill: "none" }),
    svg("path", { d: "M-8 -9.5 C -8 -19, 8 -19, 8 -9.5 C 4 -8, -4 -8, -8 -9.5 Z", fill: "#fff", stroke: "#d8d8d8", "stroke-width": 0.4 }),
    spots)
}
export function flower(open = 0) {
  const g = svg("g")
  g.append(svg("path", { d: "M0 6 C 1 16, -1 22, 0 30", stroke: "#3f9d4a", "stroke-width": 2.6, fill: "none" }))
  g.append(svg("ellipse", { cx: -6, cy: 20, rx: 6, ry: 2.4, fill: "#58b85a", transform: "rotate(-25 -6 20)" }))
  g.append(svg("ellipse", { cx: 6, cy: 24, rx: 6, ry: 2.4, fill: "#58b85a", transform: "rotate(25 6 24)" }))
  for (let i = 0; i < 8; i++) g.append(svg("ellipse", { cx: 0, cy: -10.5, rx: 5, ry: 7.5, fill: i % 2 ? "#ff5a5f" : "#ff7a7f", transform: `rotate(${i * 45})` }))
  g.append(svg("circle", { r: 9.5, fill: "#ffd84a", stroke: "#e2a600", "stroke-width": 0.7 }))
  g.append(svg("ellipse", { cx: -3.2, cy: -2.2, rx: 1.3, ry: 2.2, fill: "#2b1d0e" }), svg("ellipse", { cx: 3.2, cy: -2.2, rx: 1.3, ry: 2.2, fill: "#2b1d0e" }))
  g.append(svg("ellipse", { class: "mp-mouth", cx: 0, cy: 3.6, rx: 3.2, ry: 0.6 + open * 2.6, fill: "#8b2b1b" }))
  return g
}
export function chest(open = 0, color = "#b86b2b") {
  const g = svg("g")
  g.append(svg("rect", { x: -11, y: -4, width: 22, height: 13, rx: 1.5, fill: color, stroke: "#5b3212", "stroke-width": 0.9 }))
  g.append(svg("rect", { x: -11, y: 1, width: 22, height: 2, fill: "#e7b54a" }))
  const lid = svg("g", { class: "mp-lid", transform: `translate(0 -4) rotate(${-open * 70} -11 0)` },
    svg("path", { d: "M-11 0 L -11 -6 Q 0 -11 11 -6 L 11 0 Z", fill: color, stroke: "#5b3212", "stroke-width": 0.9 }),
    svg("rect", { x: -2, y: -3, width: 4, height: 4.5, rx: 0.8, fill: "#e7b54a", stroke: "#8a5a12", "stroke-width": 0.4 }))
  g.append(lid)
  return g
}
export function cheep(color = "#e5484d") {
  return svg("g", {},
    svg("path", { d: "M8 0 L 14 -5 L 13 0 L 14 5 Z", fill: "#f6c945" }),
    svg("ellipse", { rx: 9, ry: 7, fill: color }),
    svg("path", { d: "M-2 -7 L 2 -11 L 5 -6 Z", fill: "#f6c945" }),
    svg("circle", { cx: -4, cy: -1.5, r: 2.4, fill: "#fff" }), svg("circle", { cx: -4.6, cy: -1.5, r: 1.1, fill: "#111" }),
    svg("ellipse", { cx: -8, cy: 2.5, rx: 1.6, ry: 1.2, fill: "#b8323a" }))
}
export function cooligan() {
  return svg("g", {},
    svg("ellipse", { cx: 0, cy: 0, rx: 12, ry: 5, fill: "#8fd0ff", stroke: "#3b7fb5", "stroke-width": 0.7 }),
    svg("ellipse", { cx: 0, cy: -1.5, rx: 9, ry: 2.6, fill: "#c9ecff" }),
    svg("rect", { x: -9, y: -5.6, width: 7, height: 2.4, rx: 1.2, fill: "#ff5d8f" }), svg("rect", { x: -1, y: -5.6, width: 7, height: 2.4, rx: 1.2, fill: "#ff5d8f" }),
    svg("line", { x1: -2, y1: -4.4, x2: -1, y2: -4.4, stroke: "#ff5d8f", "stroke-width": 0.8 }))
}
export function hammer(color = "#b8612b") {
  return svg("g", {},
    svg("rect", { x: -1.4, y: 0, width: 2.8, height: 26, rx: 1, fill: "#d7a86e", stroke: "#8a5a2b", "stroke-width": 0.5 }),
    svg("rect", { x: -11, y: -9, width: 22, height: 11, rx: 2.5, fill: color, stroke: "#5b3212", "stroke-width": 0.8 }),
    svg("rect", { x: -11, y: -9, width: 4, height: 11, rx: 1.5, fill: "rgba(0,0,0,.18)" }), svg("rect", { x: 7, y: -9, width: 4, height: 11, rx: 1.5, fill: "rgba(0,0,0,.18)" }))
}
export function wario() {
  return svg("g", {},
    svg("ellipse", { cx: 0, cy: 4, rx: 10, ry: 9, fill: "#ffd9a8" }),
    svg("path", { d: "M-11 -2 Q -11 -13 0 -13 Q 11 -13 11 -2 Z", fill: "#f6d02f", stroke: "#b8960b", "stroke-width": 0.6 }),
    svg("circle", { cx: 0, cy: -6.5, r: 3.2, fill: "#fff" }), svg("text", { x: 0, y: -4.8, "text-anchor": "middle", "font-size": 4.8, "font-weight": 900, fill: "#2a52be", text: "W" }),
    svg("ellipse", { cx: -3.5, cy: 1.5, rx: 1.4, ry: 1.8, fill: "#2a52be" }), svg("ellipse", { cx: 3.5, cy: 1.5, rx: 1.4, ry: 1.8, fill: "#2a52be" }),
    svg("ellipse", { cx: 0, cy: 5.5, rx: 3.2, ry: 2.4, fill: "#f7a1b0" }),
    svg("path", { d: "M-7 8.5 Q -3.5 6.5 0 8 Q 3.5 6.5 7 8.5 L 5 10.5 Q 0 9 -5 10.5 Z", fill: "#4a2b18" }))
}
export function emojiText(t, size, extra = {}) {
  return svg("text", { "text-anchor": "middle", "dominant-baseline": "central", "font-size": size, ...extra, text: t })
}
