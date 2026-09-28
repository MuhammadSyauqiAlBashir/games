// Bowser Filter: sort the incoming mail. Normal mail and love letters → folder; Bowser mail and Bob-omb mail → trash.
// Swipe the letter left/right or tap the buttons. Wrong = −1.
import { el, svg } from "../lib.js?v=__VERSION__"
import { loop, popText, reporter, rng, soloFrame } from "./mp.js?v=__VERSION__"

const KINDS = [
  { k: "mail", e: "✉️", good: true, pts: 1, w: 5 },
  { k: "love", e: "💌", good: true, pts: 2, w: 2 },
  { k: "bowser", e: "🐢", good: false, pts: 1, w: 4, badge: "👑" },
  { k: "bomb", e: "💣", good: false, pts: 2, w: 2 },
]

export function mount(stage, ctx) {
  const S = soloFrame(stage, ctx, { bg: "linear-gradient(#e9f1ff,#c8dbff)", scoreLabel: "📧" })
  const R = reporter(ctx)
  const g = svg("svg", { viewBox: "0 0 100 70", style: "touch-action:none" })
  S.box.append(g)
  g.append(svg("rect", { x: 3, y: 3, width: 94, height: 64, rx: 4, fill: "#fff", stroke: "#3b6cf2", "stroke-width": 1 }),
    svg("rect", { x: 3, y: 3, width: 94, height: 8, rx: 4, fill: "#3b6cf2" }), svg("text", { x: 8, y: 8.6, "font-size": 4, "font-weight": 900, fill: "#fff", text: "📥 Inbox" }),
    svg("g", { transform: "translate(15 42)" }, svg("text", { "text-anchor": "middle", "dominant-baseline": "central", "font-size": 16, text: "📁" })),
    svg("g", { transform: "translate(85 42)" }, svg("text", { "text-anchor": "middle", "dominant-baseline": "central", "font-size": 16, text: "🗑️" })))
  const card = svg("g")
  const queue = svg("g")
  g.append(queue, card)
  const left = el("button", { class: "mp-btn blue", type: "button", onclick: () => sort(true) }, el("span", { class: "em", text: "📁" }), el("span", { class: "lab", text: ctx.L("Folder", "Folder") }))
  const right = el("button", { class: "mp-btn red", type: "button", onclick: () => sort(false) }, el("span", { class: "em", text: "🗑️" }), el("span", { class: "lab", text: ctx.L("Sampah", "Trash") }))
  S.ctrl.append(left, right)
  let V = null, key = "", G = null, drag = null, fly = null

  function newGame(seed) {
    const r = rng(seed)
    const total = KINDS.reduce((a, k) => a + k.w, 0)
    const next = () => { let x = r() * total; for (const k of KINDS) { x -= k.w; if (x <= 0) return k } return KINDS[0] }
    G = { next, cur: next(), q: [next(), next(), next()], score: 0, streak: 0 }
    draw()
  }
  function mailNode(k, s = 1) {
    return svg("g", { transform: `scale(${s})` },
      svg("rect", { x: -16, y: -10, width: 32, height: 20, rx: 2, fill: k.good ? "#fffdf2" : "#ffe9e6", stroke: k.good ? "#b8a36b" : "#c1121f", "stroke-width": 0.8 }),
      svg("path", { d: "M-16 -10 L 0 2 L 16 -10", fill: "none", stroke: k.good ? "#b8a36b" : "#c1121f", "stroke-width": 0.7 }),
      svg("text", { y: 3, "text-anchor": "middle", "dominant-baseline": "central", "font-size": 10, text: k.e }),
      k.badge ? svg("text", { x: 11, y: -6, "font-size": 5, text: k.badge }) : null)
  }
  function draw() {
    queue.replaceChildren(...G.q.map((k, i) => svg("g", { transform: `translate(${50 + (i + 1) * 5} ${22 - i * 2}) scale(${0.5 - i * 0.08})`, opacity: 0.6 - i * 0.15 }, mailNode(k))))
    card.replaceChildren(mailNode(G.cur, 1))
  }
  function sort(toFolder) {
    if (!V || V.phase !== "play" || !G || fly) return
    const k = G.cur
    const ok = k.good === toFolder
    if (ok) { G.streak++; const b = G.streak >= 5 ? 1 : 0; G.score += k.pts + b; ctx.sfx.coin(); popText(S.box, `+${k.pts + b}`, toFolder ? 20 : 80, 40) }
    else { G.streak = 0; G.score = Math.max(0, G.score - 1); ctx.sfx.buzz(); popText(S.box, "−1", toFolder ? 20 : 80, 40, "bad") }
    fly = { to: toFolder ? 15 : 85, t: performance.now() }
    R.set(G.score)
  }
  g.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY } })
  g.addEventListener("pointerup", (e) => { if (!drag) return; const dx = e.clientX - drag.x; drag = null; if (Math.abs(dx) > 30) sort(dx < 0) })

  const stop = loop(ctx, () => {
    if (!G) return
    if (fly) {
      const p = Math.min(1, (performance.now() - fly.t) / 160)
      card.setAttribute("transform", `translate(${50 + (fly.to - 50) * p} ${40 + p * 4}) scale(${1 - p * 0.6})`)
      if (p >= 1) { fly = null; G.cur = G.q.shift(); G.q.push(G.next()); draw(); card.setAttribute("transform", "translate(50 40)") }
    } else card.setAttribute("transform", "translate(50 40)")
  })
  return {
    destroy: stop,
    scores: (v) => v.scores,
    update(v, events) {
      V = v
      S.update(v, events)
      if (v.seed && key !== `${v.round}:${v.seed}`) { key = `${v.round}:${v.seed}`; newGame(v.seed); R.reset() }
      if (!G) newGame(3)
      S.q.replaceChildren(ctx.L("✉️💌 → 📁 Folder  ·  🐢👑💣 → 🗑️ Sampah", "✉️💌 → 📁 Folder  ·  🐢👑💣 → 🗑️ Trash"),
        el("small", { text: ctx.L("Geser surat ke kiri/kanan atau pakai tombol. 5 benar berturut-turut = bonus!", "Swipe the letter left/right or use the buttons. 5 in a row = bonus!") }))
    },
  }
}
