// A drawing canvas on a 0..1000 grid. Local strokes are sent in small batches; remote strokes are replayed.
import { el } from "../lib.js?v=__VERSION__"

export const COLORS = ["#2b2622", "#e5484d", "#f0843c", "#f2cf3c", "#3fa66a", "#3b82d6", "#9b6bd6", "#8b5a3c", "#f7a6c1", "#ffffff"]

export function createCanvas(container, { editable = false, onStroke = () => {} } = {}) {
  const wrap = el("div", { class: "canvas-wrap" })
  const cv = el("canvas")
  wrap.append(cv)
  container.append(wrap)
  const g = cv.getContext("2d")
  let strokes = []
  let color = COLORS[0], width = 10
  const fit = () => {
    const r = wrap.getBoundingClientRect()
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    cv.width = Math.max(10, Math.round(r.width * dpr))
    cv.height = Math.max(10, Math.round(r.height * dpr))
    redraw()
  }
  const S = () => cv.width / 1000
  function paintStroke(s, from = 0) {
    const k = S()
    g.strokeStyle = s.c
    g.fillStyle = s.c
    g.lineWidth = s.w * k
    g.lineCap = "round"
    g.lineJoin = "round"
    const p = s.p
    if (p.length === 1 || (from === 0 && p.length === 1)) {
      g.beginPath(); g.arc(p[0][0] * k, p[0][1] * k, s.w * k / 2, 0, Math.PI * 2); g.fill(); return
    }
    g.beginPath()
    const start = Math.max(0, from - 1)
    g.moveTo(p[start][0] * k, p[start][1] * k)
    for (let i = start + 1; i < p.length; i++) g.lineTo(p[i][0] * k, p[i][1] * k)
    g.stroke()
  }
  function redraw() {
    g.fillStyle = "#fffdf8"
    g.fillRect(0, 0, cv.width, cv.height)
    for (const s of strokes) paintStroke(s)
  }
  function apply(d) {
    if (d.k === "b") { strokes.push({ c: d.c, w: d.w, p: [...d.p] }); paintStroke(strokes[strokes.length - 1]) }
    else if (d.k === "m" && strokes.length) { const s = strokes[strokes.length - 1]; const from = s.p.length; s.p.push(...d.p); paintStroke(s, from) }
    else if (d.k === "u") { strokes.pop(); redraw() }
    else if (d.k === "x") { strokes = []; redraw() }
  }
  // Drawing input
  let drawing = false, buf = [], timer = null
  const pos = (e) => {
    const r = cv.getBoundingClientRect()
    return [Math.round(Math.max(0, Math.min(1000, (e.clientX - r.left) / r.width * 1000))), Math.round(Math.max(0, Math.min(1000, (e.clientY - r.top) / r.height * 1000)))]
  }
  const flush = () => { if (buf.length) { onStroke({ k: "m", p: buf }); buf = [] } }
  if (editable) {
    cv.addEventListener("pointerdown", (e) => {
      if (!api.enabled) return
      e.preventDefault()
      cv.setPointerCapture(e.pointerId)
      drawing = true
      const p = pos(e)
      const d = { k: "b", c: color, w: width, p: [p] }
      apply(d)
      onStroke(d)
      timer = setInterval(flush, 50)
    })
    cv.addEventListener("pointermove", (e) => {
      if (!drawing) return
      e.preventDefault()
      const p = pos(e)
      const last = strokes[strokes.length - 1]?.p.slice(-1)[0]
      if (last && Math.abs(last[0] - p[0]) + Math.abs(last[1] - p[1]) < 4) return
      apply({ k: "m", p: [p] })
      buf.push(p)
    })
    const end = () => { if (!drawing) return; drawing = false; clearInterval(timer); flush() }
    cv.addEventListener("pointerup", end)
    cv.addEventListener("pointercancel", end)
  }
  const ro = new ResizeObserver(fit)
  ro.observe(wrap)
  const api = {
    wrap, enabled: editable,
    load(list) { strokes = (list || []).map((s) => ({ c: s.c, w: s.w, p: [...s.p] })); redraw() },
    apply,
    setColor(c) { color = c }, setWidth(w) { width = w },
    undo() { apply({ k: "u" }); onStroke({ k: "u" }) },
    clear() { apply({ k: "x" }); onStroke({ k: "x" }) },
    destroy() { ro.disconnect(); clearInterval(timer) },
    count: () => strokes.length,
  }
  return api
}

export function toolbar(cv) {
  const bar = el("div", { class: "palette" })
  let cur = COLORS[0], w = 10
  const draw = () => bar.replaceChildren(
    ...COLORS.map((c) => el("button", { type: "button", class: cur === c ? "on" : "", style: { background: c }, "aria-label": c, onclick: () => { cur = c; cv.setColor(c); cv.setWidth(c === "#ffffff" ? 36 : w); draw() } })),
    ...[4, 10, 22].map((n) => el("button", { type: "button", class: w === n ? "on" : "", style: { background: "var(--card)", display: "grid", placeItems: "center" }, onclick: () => { w = n; cv.setWidth(n); draw() } },
      el("i", { style: { width: `${n / 2 + 3}px`, height: `${n / 2 + 3}px`, borderRadius: "50%", background: "var(--ink)", display: "block" } }))),
    el("button", { type: "button", style: { background: "var(--card)" }, text: "↩", onclick: () => cv.undo() }),
    el("button", { type: "button", style: { background: "var(--card)" }, text: "🗑", onclick: () => cv.clear() }))
  draw()
  return bar
}
