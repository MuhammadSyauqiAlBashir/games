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
export function die(n, rolling = false) {
  return el("div", { class: `dice${rolling ? " rolling" : ""}` }, n ? dieSvg(n) : el("span", { style: { fontSize: "30px" }, text: "🎲" }))
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
