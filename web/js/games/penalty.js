// Penalty shootout: both pick left / middle / right at the same time.
import { el, svg } from "../lib.js?v=__VERSION__"

const SIDE_X = { L: 28, M: 50, R: 72 }

export function mount(stage, ctx) {
  const board = el("div", { class: "row", style: { justifyContent: "center", gap: "18px", margin: "4px 0 8px", flexWrap: "wrap" } })
  const field = el("div", { class: "board-wrap free", style: { maxWidth: "560px", borderRadius: "20px", overflow: "hidden", boxShadow: "var(--shadow-lg)" } })
  const msg = el("div", { class: "big-msg" })
  const pick = el("div", { class: "action-bar" })
  stage.append(board, field, msg, pick)
  let lastShot = null

  function scene(v, shot) {
    const g = svg("svg", { viewBox: "0 0 100 70", style: "width:100%;height:auto;display:block" })
    g.append(svg("rect", { x: 0, y: 0, width: 100, height: 70, fill: "#7cc47a" }))
    for (let k = 0; k < 7; k++) g.append(svg("rect", { x: 0, y: k * 10, width: 100, height: 5, fill: "#74bb72" }))
    g.append(svg("rect", { x: 14, y: 8, width: 72, height: 26, fill: "rgba(255,255,255,.35)", stroke: "#fff", "stroke-width": 1.2 }))
    for (let k = 1; k < 12; k++) g.append(svg("line", { x1: 14 + k * 6, y1: 8, x2: 14 + k * 6, y2: 34, stroke: "rgba(255,255,255,.5)", "stroke-width": .3 }))
    for (let k = 1; k < 5; k++) g.append(svg("line", { x1: 14, y1: 8 + k * 5.2, x2: 86, y2: 8 + k * 5.2, stroke: "rgba(255,255,255,.5)", "stroke-width": .3 }))
    g.append(svg("line", { x1: 4, y1: 34, x2: 96, y2: 34, stroke: "#fff", "stroke-width": .8 }))
    g.append(svg("circle", { cx: 50, cy: 58, r: .9, fill: "#fff" }))
    const keeper = v.keeper, shooter = v.shooter
    const kx = shot ? SIDE_X[shot.dive] : 50
    const keeperG = svg("g", { style: `transition: transform .45s cubic-bezier(.2,.8,.3,1); transform: translate(${kx - 50}px, 0) rotate(${shot ? (shot.dive === "L" ? -60 : shot.dive === "R" ? 60 : 0) : 0}deg); transform-origin: 50px 28px` },
      svg("rect", { x: 46, y: 18, width: 8, height: 12, rx: 3, fill: ctx.color(keeper) }),
      svg("text", { x: 50, y: 17, "text-anchor": "middle", "font-size": 7, text: ctx.player(keeper).avatar }),
      svg("text", { x: 43.5, y: 25, "font-size": 4, text: "🧤" }), svg("text", { x: 53.5, y: 25, "font-size": 4, text: "🧤" }))
    g.append(keeperG)
    const bx = shot ? SIDE_X[shot.shot] : 50, by = shot ? 20 : 56
    g.append(svg("text", { x: bx, y: by, "text-anchor": "middle", "font-size": 6, style: "transition: all .45s ease-out", text: "⚽" }))
    g.append(svg("text", { x: 50, y: 68, "text-anchor": "middle", "font-size": 6, text: ctx.player(shooter).avatar }))
    return g
  }

  return {
    update(v, events) {
      const shotEv = events.find((e) => e.e === "shot")
      if (shotEv) { lastShot = shotEv; setTimeout(() => (shotEv.goal ? ctx.sfx.goal() : ctx.sfx.capture()), 350) }
      if (events.find((e) => e.e === "kick")) { lastShot = null; ctx.sfx.whoosh() }
      board.replaceChildren(...ctx.seats().map((p) => el("div", { class: "col", style: { alignItems: "center", gap: "4px" } },
        el("span", { class: "seat" }, el("span", { class: "av", style: { "--c": p.color }, text: p.avatar }), el("b", { text: `${p.name} ${v.scores[p.id]}` })),
        el("div", { class: "row", style: { gap: "3px" } }, [...v.history[p.id], ...Array(Math.max(0, v.kicks - v.history[p.id].length)).fill(null)].map((h) =>
          el("span", { style: { width: "14px", height: "14px", borderRadius: "50%", background: h === null ? "var(--line)" : h ? "#3fb96a" : "#e5484d", display: "inline-block" } }))))))
      const shot = v.phase === "result" ? v.last || lastShot : null
      field.replaceChildren(scene(v, null))
      if (shot) requestAnimationFrame(() => requestAnimationFrame(() => field.replaceChildren(scene(v, shot))))
      const me = ctx.me.id
      const role = v.shooter === me ? "shooter" : v.keeper === me ? "keeper" : null
      msg.textContent = v.phase === "result" && shot ? (shot.goal ? "GOOOL! ⚽🎉" : ctx.L("DITEPIS! 🧤", "SAVED! 🧤"))
        : v.phase === "choose" ? (role === "shooter" ? ctx.L("Kamu menendang — pilih arah!", "You shoot — pick a side!") : role === "keeper" ? ctx.L("Kamu kiper — lompat ke mana?", "You're in goal — dive where?") : "")
          : v.sudden && v.phase !== "result" ? "Sudden death!" : ""
      pick.replaceChildren()
      if (v.phase === "choose" && role) {
        if (v.mine) pick.append(el("span", { class: "muted", text: ctx.L("Menunggu lawan…", "Waiting for your opponent…") }))
        else for (const [s, t] of [["L", ctx.L("⬅️ Kiri", "⬅️ Left")], ["M", ctx.L("⬆️ Tengah", "⬆️ Middle")], ["R", ctx.L("Kanan ➡️", "Right ➡️")]])
          pick.append(el("button", { class: "btn primary big", type: "button", text: t, onclick: () => { ctx.sfx.click(); ctx.send({ side: s }) } }))
      }
    },
  }
}
