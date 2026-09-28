// Hot Cross Blocks: everyone secretly picks one of 4 pieces to extend their bridge over the lava.
// Same piece as someone else = nobody gets it. The piece must start where your bridge ends. First across wins!
import { el, svg } from "../lib.js?v=__VERSION__"
import { banner, kit, popText } from "./mp.js?v=__VERSION__"

export function mount(stage, ctx) {
  const K = kit(stage, ctx, { scoreLabel: "" })
  const box = el("div", { class: "mp", style: { background: "linear-gradient(#ff7a1a,#b3200c)" } })
  const q = el("div", { class: "mp-q" })
  const btns = el("div", { class: "mp-btns", style: { "--n": 4 } })
  const note = el("div", { class: "mp-note" })
  stage.append(box, q, btns, note)
  const g = svg("svg", { viewBox: "0 0 100 86" })
  box.append(g)
  let V = null

  function lanes(v) {
    g.replaceChildren()
    for (let i = 0; i < 20; i++) g.append(svg("circle", { cx: (i * 37) % 100, cy: (i * 53) % 86, r: 2 + (i % 3), fill: "rgba(255,210,80,.25)" }))
    const seats = ctx.seats()
    const lw = Math.min(22, 92 / seats.length), gap = (100 - lw * seats.length) / (seats.length + 1)
    const rows = v.goal, ch = 74 / rows, cw = lw / 3
    g.append(svg("rect", { x: 0, y: 0, width: 100, height: 6, fill: "#5b3a2a" }), svg("text", { x: 50, y: 4.4, "text-anchor": "middle", "font-size": 4, "font-weight": 900, fill: "#fff", text: "🚪 EXIT" }))
    seats.forEach((p, k) => {
      const x0 = gap + k * (lw + gap)
      const yOf = (row) => 80 - (row + 1) * ch
      g.append(svg("rect", { x: x0, y: 80, width: lw, height: 5, rx: 1, fill: "#5b3a2a" }))
      for (const [start, a, b, len] of v.path[p.id] || []) {
        for (let r = 0; r < len; r++) {
          const col = r === len - 1 ? b : a
          g.append(svg("rect", { x: x0 + col * cw + 0.3, y: yOf(start + r) + 0.3, width: cw - 0.6, height: ch - 0.6, rx: 0.8, fill: "#c9a36b", stroke: "#6b4a22", "stroke-width": 0.3 }))
          if (r === len - 1 && a !== b) g.append(svg("rect", { x: x0 + a * cw + 0.3, y: yOf(start + r) + 0.3, width: cw - 0.6, height: ch - 0.6, rx: 0.8, fill: "#c9a36b", stroke: "#6b4a22", "stroke-width": 0.3 }))
        }
      }
      const pos = v.pos[p.id] || 0, col = v.col[p.id] ?? 1
      const res = v.result && v.result[p.id]
      g.append(svg("g", { transform: `translate(${x0 + col * cw + cw / 2} ${pos ? yOf(pos - 1) + ch / 2 : 82.5})` }, svg("circle", { r: 3.4, fill: p.color, stroke: p.id === ctx.me.id ? "#ffd400" : "#fff", "stroke-width": 0.8 }),
        svg("text", { "text-anchor": "middle", "dominant-baseline": "central", "font-size": 4.2, text: p.avatar }),
        res ? svg("text", { y: -5.5, "text-anchor": "middle", "font-size": 4, text: res === "ok" ? "✅" : res === "clash" ? "💥" : "🫠" }) : null))
    })
  }
  function pieceSvg(pc) {
    const s = svg("svg", { viewBox: "0 0 30 40", width: 44, height: 58 })
    const cw = 9, ch = 8
    for (let r = 0; r < pc.len; r++) {
      const cols = r === pc.len - 1 && pc.in !== pc.out ? [pc.in, pc.out] : [r === pc.len - 1 ? pc.out : pc.in]
      for (const c of cols) s.append(svg("rect", { x: 1.5 + c * cw, y: 36 - (r + 1) * ch, width: cw - 1, height: ch - 1, rx: 1, fill: "#c9a36b", stroke: "#6b4a22", "stroke-width": 0.5 }))
    }
    s.append(svg("path", { d: `M${1.5 + pc.in * cw + cw / 2 - 2} 38 l 2 -2.6 l 2 2.6 Z`, fill: "#fff" }))
    return s
  }
  return {
    scores: (v) => v.pos,
    update(v, events) {
      V = v
      K.update({ ...v, scores: v.pos }, events, box)
      lanes(v)
      const me = ctx.me.id
      const col = v.col[me] ?? 1
      btns.replaceChildren(...(v.pieces || []).map((pc, i) => {
        const fitsMe = pc.in === col
        const reveal = v.phase === "reveal" && v.pick
        const cnt = reveal ? Object.values(v.pick).filter((x) => x === i).length : 0
        return el("button", { class: `mp-btn ${v.mine === i ? "blue on" : fitsMe ? "green" : "gray"}`, type: "button", disabled: v.phase !== "pick" || (v.finished || []).includes(me),
          onclick: () => { ctx.sfx.click(); ctx.send({ i }) } }, pieceSvg(pc), el("span", { class: "lab", text: reveal ? (cnt > 1 ? `💥 ×${cnt}` : cnt ? "✓" : "") : `+${pc.len}` }))
      }))
      q.replaceChildren(ctx.L("Pilih potongan jembatan — yang HIJAU cocok dengan ujung jembatanmu", "Pick a bridge piece — GREEN ones fit the end of your bridge"),
        el("small", { text: ctx.L("Kalau ada yang pilih potongan sama → tidak ada yang dapat!", "If someone picks the same piece → nobody gets it!") }))
      note.textContent = v.phase === "pick" ? ctx.L(`${(v.picked || []).length}/${ctx.seats().length} sudah memilih`, `${(v.picked || []).length}/${ctx.seats().length} have picked`) : ""
      for (const e of events) {
        if (e.e === "round") ctx.sfx.pop()
        if (e.e === "reveal") {
          const r = (e.result || {})[me]
          if (r === "ok") ctx.sfx.place(); else if (r === "clash") { ctx.sfx.buzz(); popText(box, ctx.L("Tabrakan!", "Clash!"), 50, 40, "bad") } else if (r === "sink") { ctx.sfx.splash(); popText(box, ctx.L("Tenggelam!", "Sank!"), 50, 40, "bad") }
        }
        if (e.e === "finish" && (V.finished || []).includes(me)) banner(box, ctx.L("SAMPAI!", "MADE IT!"), { kind: "good" })
      }
    },
  }
}
