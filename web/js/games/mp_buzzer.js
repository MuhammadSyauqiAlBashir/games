// Wario's Buzzer Beater: 10 bite-sized picture puzzles. First correct answer takes the point;
// a wrong answer locks you out of that question.
import { el, svg } from "../lib.js?v=__VERSION__"
import { dieSvg } from "./common.js?v=__VERSION__"
import { banner, coin, kit, loop, popText, wario } from "./mp.js?v=__VERSION__"

const ARROW = { N: "⬆️", E: "➡️", S: "⬇️", W: "⬅️" }
const reflect = (x, lo, hi) => { const w = hi - lo; let m = ((x - lo) % (2 * w) + 2 * w) % (2 * w); return lo + (m > w ? 2 * w - m : m) }

const sized = (n) => { n.setAttribute("width", 100); n.setAttribute("height", 100); return n }
function fuzzy(r = 2.6) {
  const g = svg("g")
  const pts = []
  for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, rr = i % 2 ? r : r * 1.35; pts.push(`${(Math.cos(a) * rr).toFixed(2)},${(Math.sin(a) * rr).toFixed(2)}`) }
  g.append(svg("polygon", { points: pts.join(" "), fill: "#1b1b1b" }), svg("circle", { cx: -0.8, cy: -0.4, r: 0.7, fill: "#fff" }), svg("circle", { cx: 0.8, cy: -0.4, r: 0.7, fill: "#fff" }))
  return g
}
function gear(r, teeth = 10) {
  let d = ""
  for (let i = 0; i < teeth * 2; i++) {
    const a0 = (i / (teeth * 2)) * Math.PI * 2, a1 = ((i + 1) / (teeth * 2)) * Math.PI * 2, rr = i % 2 ? r : r * 1.16
    d += `${i ? "L" : "M"}${(Math.cos(a0) * rr).toFixed(2)} ${(Math.sin(a0) * rr).toFixed(2)} L${(Math.cos(a1) * rr).toFixed(2)} ${(Math.sin(a1) * rr).toFixed(2)} `
  }
  return svg("path", { d: d + "Z", fill: "#c9ced8", stroke: "#6b7385", "stroke-width": 0.6 })
}

export function mount(stage, ctx) {
  const K = kit(stage, ctx, { scoreLabel: "🔔" })
  const box = el("div", { class: "mp", style: { background: "linear-gradient(#3a1f6b,#1c0f3a)" } })
  const q = el("div", { class: "mp-q" })
  const btns = el("div", { class: "mp-btns" })
  const note = el("div", { class: "mp-note" })
  stage.append(box, q, btns, note)
  const g = svg("svg", { viewBox: "0 0 100 85" })
  for (const x of [15, 50, 85]) g.append(svg("path", { d: `M${x} 0 L ${x - 14} 85 L ${x + 14} 85 Z`, fill: "rgba(255,240,170,.07)" }))
  const host = svg("g", {}, wario())
  g.append(host, svg("text", { x: 57, y: 8.6, "text-anchor": "middle", "font-size": 5, "font-weight": 900, "font-style": "italic", fill: "#ffd400", stroke: "#5a2a00", "stroke-width": 1.2, "paint-order": "stroke", text: "WARIO'S BUZZER BEATER" }))
  const board = svg("g", { transform: "translate(6 14.5)" })
  g.append(svg("rect", { x: 5, y: 13.5, width: 90, height: 69, rx: 4, fill: "#fffdf6", stroke: "#f6c945", "stroke-width": 1.4 }), board)
  box.append(g)
  let V = null, qKey = "", dyn = null  // dyn(now) animates the current puzzle

  const sx = (x) => 2 + x * 0.84, sy = (y) => 2 + y * 0.63  // puzzle space (0..100) → board

  function draw(v) {
    board.replaceChildren()
    dyn = null
    const Q = v.q
    if (!Q || !Q.spec) return
    const sp = Q.spec
    const tStart = v.t0
    if (Q.type === "coins") {
      const layer = svg("g")
      sp.pts.forEach(([x, y]) => layer.append(svg("g", { transform: `translate(${sx(x)} ${sy(y)})` }, coin(3.2))))
      const cover = svg("g", { opacity: 0 }, svg("rect", { x: 0, y: 0, width: 88, height: 67, rx: 3, fill: "#6b3fb5" }),
        svg("text", { x: 44, y: 36, "text-anchor": "middle", "dominant-baseline": "central", "font-size": 22, "font-weight": 900, fill: "#ffd400", text: "?" }))
      board.append(layer, cover)
      dyn = (now) => cover.setAttribute("opacity", now - tStart > sp.hide || V.phase !== "q" ? 1 : 0)
    } else if (Q.type === "maze") {
      const w = sp.w, c = 8.4, ox = 44 - (w * c) / 2, oy = 34 - (w * c) / 2
      const L = (x1, y1, x2, y2) => board.append(svg("line", { x1: ox + x1 * c, y1: oy + y1 * c, x2: ox + x2 * c, y2: oy + y2 * c, stroke: "#3a2a6b", "stroke-width": 1.1, "stroke-linecap": "round" }))
      board.append(svg("rect", { x: ox, y: oy, width: w * c, height: w * c, fill: "#e9f7e3" }))
      for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
        if (sp.right[y][x] && x < w - 1) L(x + 1, y, x + 1, y + 1)
        if (sp.down[y][x] && y < w - 1) L(x, y + 1, x + 1, y + 1)
      }
      const mid = Math.floor(w / 2)
      L(0, 0, mid, 0); L(mid + 1, 0, w, 0); L(0, w, mid, w); L(mid + 1, w, w, w)
      L(0, 0, 0, mid); L(0, mid + 1, 0, w); L(w, 0, w, mid); L(w, mid + 1, w, w)
      for (const [k, x, y] of [["N", mid + 0.5, -0.6], ["S", mid + 0.5, w + 0.6], ["W", -0.7, mid + 0.5], ["E", w + 0.7, mid + 0.5]])
        board.append(svg("text", { x: ox + x * c, y: oy + y * c, "text-anchor": "middle", "dominant-baseline": "central", "font-size": 5, text: ARROW[k] }))
      board.append(svg("g", { transform: `translate(${ox + (mid + 0.5) * c} ${oy + (mid + 0.5) * c}) scale(.3)` }, wario()))
    } else if (Q.type === "dice") {
      const cells = sp.track.map((t, i) => { const row = Math.floor(i / 6), col = row ? 5 - (i % 6) : i % 6; return [8 + col * 13.2, 14 + row * 22, t] })
      cells.forEach(([x, y, t], i) => {
        board.append(svg("rect", { x: x - 5.6, y: y - 5.6, width: 11.2, height: 11.2, rx: 2, fill: i === 0 ? "#ffe9a8" : "#dfe9ff", stroke: "#3a5bb8", "stroke-width": 0.6 }),
          svg("text", { x, y, "text-anchor": "middle", "dominant-baseline": "central", "font-size": 6.4, text: t }))
      })
      board.append(svg("path", { d: `M${cells[5][0] + 6} ${cells[5][1]} q 5 11 0 22`, stroke: "#3a5bb8", "stroke-width": 0.8, fill: "none", "stroke-dasharray": "1.5 1" }))
      board.append(svg("g", { transform: `translate(${cells[0][0]} ${cells[0][1] - 8}) scale(.28)` }, wario()))
      const die = svg("g", { transform: "translate(36 50) scale(.16)" })
      board.append(die)
      let shown = -1
      dyn = (now) => {
        const t = now - tStart
        const val = t < 1.4 ? 1 + (Math.floor(t * 14) % 6) : sp.roll
        if (val !== shown) { shown = val; die.replaceChildren(svg("rect", { width: 100, height: 100, rx: 18, fill: "#fff", stroke: "#333", "stroke-width": 4 }), sized(dieSvg(val))) }
      }
    } else if (Q.type === "fuzzy") {
      const lanes = sp.tracks.map((tr, k) => {
        const y = 9 + k * 16
        board.append(svg("rect", { x: 7, y: y - 5, width: 80, height: 10, rx: 5, fill: "#f3e6c8", stroke: "#b89b5e", "stroke-width": 0.5 }),
          svg("text", { x: 3, y, "text-anchor": "middle", "dominant-baseline": "central", "font-size": 5, "font-weight": 900, fill: "#3a2a6b", text: "ABCD"[k] }))
        const fz = tr.x.map(() => { const f = fuzzy(); board.append(f); return f })
        return { tr, y, fz }
      })
      dyn = (now) => {
        const t = now - tStart
        for (const { tr, y, fz } of lanes) tr.x.forEach((x0, i) => { const x = (((x0 + tr.v * t) % 100) + 100) % 100; fz[i].setAttribute("transform", `translate(${(9 + x * 0.76).toFixed(2)} ${y})`) })
      }
    } else if (Q.type === "creeper") {
      sp.paths.forEach((pts, k) => {
        const cx = 11 + k * 22
        const P = pts.map(([x, y]) => [cx + (x - 50) * 0.2, 2 + y * 0.6])
        board.append(svg("polyline", { points: P.map((p) => p.join(",")).join(" "), fill: "none", stroke: "#2f8f3a", "stroke-width": 2.2, "stroke-linejoin": "round", "stroke-linecap": "round" }))
        P.slice(1, -1).forEach(([x, y], i) => board.append(svg("ellipse", { cx: x + (i % 2 ? 1.6 : -1.6), cy: y, rx: 1.6, ry: 0.8, fill: "#58c25a" })))
        const top = P[P.length - 1]
        board.append(svg("circle", { cx: top[0], cy: top[1] - 1, r: 3, fill: "#e5484d" }), svg("circle", { cx: top[0] - 1, cy: top[1] - 2, r: 0.6, fill: "#fff" }), svg("circle", { cx: top[0] + 1.2, cy: top[1] - 0.4, r: 0.6, fill: "#fff" }))
        board.append(svg("text", { x: cx, y: 64.5, "text-anchor": "middle", "font-size": 4.6, "font-weight": 900, fill: "#3a2a6b", text: "ABCD"[k] }))
      })
    } else if (Q.type === "cogs") {
      const cogs = [0, 1, 2, 3].map((k) => {
        const x = 13 + k * 21, y = 32
        const odd = k === sp.odd
        const tr = odd ? (sp.odd_mod === "mirror" ? "scale(-1 1)" : "scale(1 -1)") : ""
        const grp = svg("g", {}, gear(8.4), svg("circle", { r: 6.4, fill: "#fff" }), svg("g", { transform: tr }, svg("text", { "text-anchor": "middle", "dominant-baseline": "central", "font-size": 8, text: sp.pose })))
        board.append(grp, svg("text", { x, y: 50, "text-anchor": "middle", "font-size": 4.6, "font-weight": 900, fill: "#3a2a6b", text: "ABCD"[k] }))
        return { grp, x, y, spin: sp.spin[k] }
      })
      dyn = (now) => { const t = now - tStart; for (const c of cogs) c.grp.setAttribute("transform", `translate(${c.x} ${c.y}) rotate(${(c.spin * t) % 360})`) }
    } else if (Q.type === "crowd") {
      board.append(svg("rect", { x: 0, y: 0, width: 88, height: 67, rx: 3, fill: "#f2ead8" }))
      const bugs = sp.bugs.map(([i, x, y, vx, vy]) => { const t = svg("text", { "text-anchor": "middle", "dominant-baseline": "central", "font-size": 6, text: sp.species[i] }); board.append(t); return { t, x, y, vx, vy } })
      dyn = (now) => { const t = now - tStart; for (const b of bugs) b.t.setAttribute("transform", `translate(${sx(reflect(b.x + b.vx * t, 6, 94)).toFixed(2)} ${sy(reflect(b.y + b.vy * t, 8, 92)).toFixed(2)})`) }
    } else if (Q.type === "bullets") {
      const n = sp.n, c = 10, ox = 44 - (n * c) / 2 + 4, oy = 36 - (n * c) / 2 + 3
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) board.append(svg("rect", { x: ox + x * c, y: oy + y * c, width: c, height: c, fill: (x + y) % 2 ? "#e3edff" : "#f5f8ff", stroke: "#b8c6ea", "stroke-width": 0.3 }))
      const bill = (x, y, rot) => svg("g", { transform: `translate(${x} ${y}) rotate(${rot})` }, svg("path", { d: "M-3 -2.4 L 1.5 -2.4 Q 4 0 1.5 2.4 L -3 2.4 Z", fill: "#222" }), svg("circle", { cx: 1, cy: -0.6, r: 0.7, fill: "#fff" }))
      const shots = svg("g")
      for (const r of sp.rows) { board.append(bill(ox - 4.5, oy + r * c + c / 2, 0)); shots.append(svg("line", { x1: ox, y1: oy + r * c + c / 2, x2: ox + n * c, y2: oy + r * c + c / 2, stroke: "#e5484d", "stroke-width": 0.5, "stroke-dasharray": "1.5 1.2" })) }
      for (const col of sp.cols) { board.append(bill(ox + col * c + c / 2, oy - 4.5, 90)); shots.append(svg("line", { x1: ox + col * c + c / 2, y1: oy, x2: ox + col * c + c / 2, y2: oy + n * c, stroke: "#e5484d", "stroke-width": 0.5, "stroke-dasharray": "1.5 1.2" })) }
      board.append(shots)
      sp.cells.forEach(([r, col], k) => board.append(svg("circle", { cx: ox + col * c + c / 2, cy: oy + r * c + c / 2, r: 3.4, fill: "#3b6cf2" }),
        svg("text", { x: ox + col * c + c / 2, y: oy + r * c + c / 2, "text-anchor": "middle", "dominant-baseline": "central", "font-size": 4.2, "font-weight": 900, fill: "#fff", text: "ABCD"[k] })))
    }
  }

  const stop = loop(ctx, (now) => {
    host.setAttribute("transform", `translate(12 ${(7.2 + Math.sin(now * 3) * 0.5).toFixed(2)}) rotate(${(Math.sin(now * 2) * 5).toFixed(1)}) scale(.46)`)
    if (dyn && V) dyn(now)
  })

  function choiceLabel(Q, c) {
    if (Q.type === "maze") return ARROW[c]
    return c
  }

  return {
    destroy: stop,
    scores: (v) => v.scores,
    update(v, events) {
      V = v
      K.update(v, events, box)
      const key = `${v.round}:${v.q && v.q.type}`
      if (key !== qKey && v.q && v.q.spec) { qKey = key; draw(v) }
      const reveal = v.phase === "reveal" || v.phase === "finish"
      const locked = (v.locked || []).includes(ctx.me.id)
      if (v.q && v.q.choices) {
        btns.style.setProperty("--n", v.q.choices.length)
        btns.replaceChildren(...v.q.choices.map((c, i) => el("button", {
          class: `mp-btn ${reveal ? (i === v.answer ? "right" : v.mine === i ? "wrong" : "gray") : v.mine === i ? "wrong" : "red"}`, type: "button",
          disabled: v.phase !== "q" || locked, onclick: () => { if (V.phase === "q" && !(V.locked || []).includes(ctx.me.id)) { ctx.sfx.click(); ctx.send({ i }) } },
        }, el("span", { class: "em", text: choiceLabel(v.q, c) }))))
        q.replaceChildren(ctx.L(v.q.spec.q.id, v.q.spec.q.en), el("small", { text: ctx.L("Pencet duluan! Salah = terkunci di soal ini", "Buzz first! Wrong = locked out of this one") }))
      }
      note.textContent = locked && v.phase === "q" ? ctx.L("❌ Kamu terkunci di soal ini…", "❌ You're locked out of this one…") : ""
      for (const e of events) {
        if (e.e === "question") ctx.sfx.pop()
        if (e.e === "buzz") {
          if (e.ok) { ctx.sfx.ding(); banner(box, "🔔", { kind: "good", ms: 1200, sub: `${ctx.player(e.who).avatar} ${ctx.name(e.who)} +1` }) }
          else if (e.who === ctx.me.id) { ctx.sfx.buzz(); btns.classList.remove("mp-shake"); void btns.offsetWidth; btns.classList.add("mp-shake") }
          else popText(box, `${ctx.player(e.who).avatar} ❌`, 50, 30, "bad")
        }
        if (e.e === "reveal" && !e.winner) banner(box, ctx.L("Tidak ada!", "Nobody!"), { kind: "bad", ms: 1200 })
      }
    },
  }
}
