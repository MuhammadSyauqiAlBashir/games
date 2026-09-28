// Gaple (dominoes): the line of tiles on felt, your tiles below, nyangkul/pass buttons.
import { el } from "../lib.js?v=__VERSION__"
import { domino, status } from "./common.js?v=__VERSION__"

export function mount(stage, ctx) {
  const st = el("div", { class: "status-line" })
  const opp = el("div", { class: "row wrap", style: { justifyContent: "center", gap: "10px", marginBottom: "8px" } })
  const felt = el("div", { class: "felt", style: { padding: "14px 10px", minHeight: "150px", display: "flex", flexDirection: "column", justifyContent: "center", position: "relative" } })
  const bar = el("div", { class: "action-bar" })
  const hand = el("div", { class: "row wrap", style: { justifyContent: "center", gap: "8px", padding: "8px 0" } })
  stage.append(st, opp, felt, bar, hand)
  let sel = null

  return {
    update(v, events) {
      for (const e of events) {
        if (e.e === "play") ctx.sfx.place()
        if (e.e === "draw") ctx.sfx.card()
        if (e.e === "pass") ctx.toast(ctx.L(`${ctx.name(e.who)} pas`, `${ctx.name(e.who)} passes`))
        if (e.e === "round") { ctx.sfx.win(); ctx.toast(e.blocked ? ctx.L(`Buntu! ${ctx.name(e.winner)} menang (titik terkecil)`, `Blocked! ${ctx.name(e.winner)} wins (lowest total)`)
          : ctx.L(`${ctx.name(e.winner)} habis duluan! +${e.points}`, `${ctx.name(e.winner)} went out! +${e.points}`)) }
      }
      const me = ctx.me.id
      const mine = v.turn === me && v.phase === "play" && !v.over
      opp.replaceChildren(...Object.entries(v.counts).filter(([p]) => p !== me).map(([p, n]) =>
        el("div", { class: `seat${v.turn === p ? " turn" : ""}` }, el("span", { class: "av", style: { "--c": ctx.color(p) }, text: ctx.player(p).avatar }),
          el("span", { text: `${ctx.name(p)} · ${n} 🁢` }))))
      // The line (scrolls sideways when long).
      const line = el("div", { style: { display: "flex", alignItems: "center", gap: "3px", overflowX: "auto", padding: "8px 4px", scrollbarWidth: "none" } })
      if (!v.line.length) line.append(el("div", { style: { color: "rgba(255,255,255,.8)", fontWeight: 800, margin: "0 auto" }, text: ctx.L("Meja masih kosong", "The table is empty") }))
      v.line.forEach((t) => line.append(domino(t.t[0], t.t[1], { size: 30, vertical: t.t[0] === t.t[1] })))
      felt.replaceChildren(
        v.ends ? el("div", { class: "row between", style: { color: "#fff", fontWeight: 900, fontSize: "13px", padding: "0 4px" } },
          el("span", { text: `◀ ${v.ends[0]}` }), el("span", { text: `${ctx.L("Tumpukan", "Boneyard")}: ${v.bone}` }), el("span", { text: `${v.ends[1]} ▶` })) : null,
        line)
      setTimeout(() => { line.scrollLeft = (line.scrollWidth - line.clientWidth) / 2 }, 0)
      if (v.phase === "round_over" && v.round_over) {
        felt.append(el("div", { style: { position: "absolute", inset: 0, background: "rgba(0,0,0,.55)", borderRadius: "26px", display: "grid", placeItems: "center", color: "#fff", textAlign: "center", padding: "10px" } },
          el("div", {}, el("div", { class: "big-msg", text: `🏆 ${ctx.name(v.round_over.winner)} +${v.round_over.points}` }),
            el("div", { class: "small", text: ctx.L("Ronde berikutnya sebentar lagi…", "Next round starting…") }))))
      }
      // Hand
      const can = v.can || {}
      if (sel !== null && !can[sel]) sel = null
      hand.replaceChildren(...v.hand.map((t, i) => {
        const ok = !!can[i]
        const n = el("button", { type: "button", style: { border: 0, background: "none", padding: 0, cursor: ok ? "pointer" : "default", opacity: mine && !ok ? .5 : 1,
          transform: sel === i ? "translateY(-10px)" : "" } }, domino(t[0], t[1], { size: 32, vertical: true, highlight: ok }))
        n.onclick = () => {
          if (!ok) return
          const sides = can[i]
          if (sides.length === 1) { ctx.send({ do: "play", i, side: sides[0] }); sel = null; return }
          sel = i
          ctx.sfx.click()
          drawSides(i)
        }
        return n
      }))
      function drawSides(i) {
        bar.replaceChildren(
          el("button", { class: "btn primary", type: "button", text: ctx.L(`◀ Kiri (${v.ends[0]})`, `◀ Left (${v.ends[0]})`), onclick: () => { ctx.send({ do: "play", i, side: "L" }); sel = null } }),
          el("button", { class: "btn primary", type: "button", text: ctx.L(`Kanan (${v.ends[1]}) ▶`, `Right (${v.ends[1]}) ▶`), onclick: () => { ctx.send({ do: "play", i, side: "R" }); sel = null } }))
      }
      bar.replaceChildren()
      const hasPlay = Object.keys(can).length > 0
      if (mine && !hasPlay) {
        if (v.bone > 0) bar.append(el("button", { class: "btn gold big", type: "button", text: ctx.L("⛏️ Nyangkul", "⛏️ Draw (nyangkul)"), onclick: () => ctx.send({ do: "draw" }) }))
        else bar.append(el("button", { class: "btn big", type: "button", text: ctx.L("Pas", "Pass"), onclick: () => ctx.send({ do: "pass" }) }))
      }
      if (sel !== null) drawSides(sel)
      status(ctx, st, v, { mine: hasPlay ? ctx.L("Giliranmu — pilih kartu", "Your turn — pick a tile") : v.bone ? ctx.L("Tidak ada yang cocok — nyangkul!", "Nothing fits — draw!") : ctx.L("Tidak bisa jalan — pas", "Can't play — pass") })
    },
    scores: (v) => (v.target ? v.scores : v.counts),
  }
}
