// Texas Hold'em table: seats around an oval felt, community cards in the middle, your cards and actions below.
import { el } from "../lib.js?v=__VERSION__"
import { rp, rpShort } from "../lib.js?v=__VERSION__"
import { pcard } from "./common.js?v=__VERSION__"

export function mount(stage, ctx) {
  const st = el("div", { class: "status-line" })
  const table = el("div", { class: "felt", style: { position: "relative", width: "min(100%, calc(50dvh * 1.25))", maxWidth: "760px", margin: "0 auto", aspectRatio: "1.25", borderRadius: "48%/42%", border: "10px solid #7a4a2a" } })
  const meRow = el("div", { class: "row", style: { justifyContent: "center", gap: "12px", marginTop: "10px" } })
  const actions = el("div", { class: "action-bar" })
  const raiseBox = el("div", { class: "card", hidden: true, style: { maxWidth: "520px", margin: "0 auto" } })
  const log = el("div", { class: "center small muted", style: { minHeight: "20px" } })
  stage.append(st, table, meRow, actions, raiseBox, log)
  let raiseTo = 0

  return {
    update(v, events) {
      for (const e of events) {
        if (e.e === "bet") { if (e.do === "fold") ctx.sfx.card(); else if (e.do === "check") ctx.sfx.click(); else ctx.sfx.cash() }
        if (e.e === "street") ctx.sfx.card()
        if (e.e === "showdown" || e.e === "win") ctx.sfx.coin()
        if (e.e === "newhand") ctx.sfx.whoosh()
      }
      const me = ctx.me.id
      const order = v.order
      const all = ctx.seats().map((s) => s.id)
      // Seats around the table, me at the bottom.
      const myIdx = Math.max(0, all.indexOf(me))
      const rot = [...all.slice(myIdx), ...all.slice(0, myIdx)]
      table.replaceChildren()
      rot.forEach((pid, k) => {
        const a = Math.PI / 2 + (k / rot.length) * Math.PI * 2
        const x = 50 + Math.cos(a) * 36, y = 50 + Math.sin(a) * 38
        const inHand = order.includes(pid)
        const folded = v.folded.includes(pid)
        const busted = v.busted.includes(pid) || v.left.includes(pid)
        const turn = v.turn === pid
        const shown = v.shown?.[pid]
        const bet = v.bets[pid]
        const tags = []
        if (v.button === pid) tags.push("Ⓓ")
        if (v.sb_p === pid) tags.push("SB")
        if (v.bb_p === pid) tags.push("BB")
        const box = el("div", { style: { position: "absolute", left: `${x}%`, top: `${y}%`, transform: "translate(-50%,-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", opacity: busted ? .35 : folded ? .55 : 1 } },
          pid !== me && inHand && !folded ? el("div", { style: { display: "flex", gap: "2px" } }, shown ? shown.map((c) => pcard(c, 30)) : [pcard(null, 26), pcard(null, 26)]) : null,
          el("div", { class: `seat${turn ? " turn" : ""}`, style: { padding: "3px 9px 3px 3px" } },
            el("span", { class: "av", style: { "--c": ctx.color(pid), width: "24px", height: "24px", fontSize: "14px" }, text: ctx.player(pid).avatar }),
            el("span", { class: "col", style: { gap: 0, lineHeight: 1.1 } }, el("b", { style: { fontSize: "12px" }, text: ctx.name(pid) }),
              el("span", { style: { fontSize: "11px", color: "var(--ink-2)" }, text: busted ? ctx.L("habis", "out") : rpShort(v.stacks[pid] || 0) })),
            tags.length ? el("span", { class: "pill", style: { fontSize: "10px" }, text: tags.join(" ") }) : null),
          bet ? el("div", { class: "pill gold", style: { background: "#f2c94c", color: "#3a2a10", fontSize: "11px" }, text: `🪙 ${rpShort(bet)}` }) : null,
          v.allin.includes(pid) ? el("div", { class: "pill bad", style: { fontSize: "10px" }, text: "ALL-IN" }) : null)
        table.append(box)
      })
      const center = el("div", { style: { position: "absolute", left: "50%", top: "46%", transform: "translate(-50%,-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" } },
        el("div", { style: { display: "flex", gap: "4px" } }, [0, 1, 2, 3, 4].map((i) => v.board[i] ? pcard(v.board[i], 40) : el("div", { style: { width: "40px", aspectRatio: "5/7", borderRadius: "8px", border: "2px dashed rgba(255,255,255,.25)" } }))),
        el("div", { style: { color: "#fff", fontWeight: 900 } }, `Pot ${rp(v.pot)}`),
        el("div", { style: { color: "rgba(255,255,255,.75)", fontSize: "12px", fontWeight: 700 } }, `Blind ${rpShort(v.blinds[0])}/${rpShort(v.blinds[1])} · ${ctx.L("level", "level")} ${v.level + 1}`))
      table.append(center)
      if (v.phase === "showdown" && v.result) {
        center.append(el("div", { style: { background: "rgba(0,0,0,.55)", color: "#fff", padding: "6px 12px", borderRadius: "12px", fontWeight: 800, fontSize: "13px", textAlign: "center" } },
          v.result.winners.map((x) => el("div", {}, `🏆 ${ctx.name(x.id)} +${rp(x.amount)}${x.hand ? ` · ${ctx.L(x.hand_id, x.hand)}` : ""}`))))
      }
      // My cards
      meRow.replaceChildren(...(v.hole || []).map((c) => pcard(c, 64)))
      if (v.result?.hands?.[me] && v.phase === "showdown") meRow.append(el("span", { class: "pill", text: ctx.L(v.result.hands[me].id, v.result.hands[me].en) }))
      // Actions
      actions.replaceChildren()
      raiseBox.hidden = true
      const lg = v.legal || {}
      const mine = v.turn === me && v.phase === "hand" && !v.over
      if (mine) {
        if (lg.fold) actions.append(el("button", { class: "btn", type: "button", text: "Fold", onclick: () => ctx.send({ do: "fold" }) }))
        if (lg.check) actions.append(el("button", { class: "btn teal", type: "button", text: "Check", onclick: () => ctx.send({ do: "check" }) }))
        if (lg.call) actions.append(el("button", { class: "btn teal", type: "button", text: `Call ${rpShort(lg.call)}`, onclick: () => ctx.send({ do: "call" }) }))
        if (lg.can_raise) {
          raiseTo = Math.max(lg.min_raise, Math.min(raiseTo || lg.min_raise, lg.max_raise))
          actions.append(el("button", { class: "btn primary", type: "button", text: v.to_call ? "Raise…" : "Bet…", onclick: () => { raiseBox.hidden = !raiseBox.hidden } }))
          const label = el("b", { text: rp(raiseTo) })
          const range = el("input", { type: "range", min: lg.min_raise, max: lg.max_raise, step: 10000, value: raiseTo, style: { width: "100%" },
            oninput: (e) => { raiseTo = Number(e.target.value); label.textContent = rp(raiseTo) } })
          const preset = (t, val) => el("button", { class: "chip", type: "button", text: t, onclick: () => { raiseTo = Math.max(lg.min_raise, Math.min(val, lg.max_raise)); range.value = raiseTo; label.textContent = rp(raiseTo) } })
          raiseBox.replaceChildren(el("div", { class: "row between" }, el("span", { text: ctx.L("Naikkan ke", "Raise to") }), label), range,
            el("div", { class: "row wrap", style: { margin: "8px 0" } }, preset("Min", lg.min_raise), preset("½ pot", v.pot / 2 + (v.bets[me] || 0)), preset("Pot", v.pot + (v.bets[me] || 0)), preset("All-in", lg.max_raise)),
            el("button", { class: "btn primary wide", type: "button", text: ctx.L("Kirim", "Confirm"), onclick: () => ctx.send(raiseTo >= lg.max_raise ? { do: "allin" } : { do: "raise", to: raiseTo }) }))
        }
      }
      if (!v.over && !v.left.includes(me) && !v.busted.includes(me)) actions.append(el("button", { class: "btn ghost small", type: "button", text: ctx.L("Keluar meja", "Leave table"),
        onclick: () => { if (confirm(ctx.L("Keluar dari meja? Chip-mu disimpan ke dompet.", "Leave the table? Your chips go back to your wallet."))) ctx.send({ do: "leave" }) } }))
      log.textContent = (v.log || []).slice(-2).join(" · ")
      const toCall = v.to_call
      st.className = `status-line${mine ? " mine" : ""}`
      st.textContent = v.over ? ctx.L("Permainan selesai", "Game over") : v.phase === "showdown" ? ctx.L("Tangan berikutnya sebentar lagi…", "Next hand coming up…")
        : mine ? (toCall ? ctx.L(`Giliranmu — ${rp(toCall)} untuk call`, `Your turn — ${rp(toCall)} to call`) : ctx.L("Giliranmu — check atau bet", "Your turn — check or bet"))
          : v.turn ? ctx.L(`Menunggu ${ctx.name(v.turn)}…`, `Waiting for ${ctx.name(v.turn)}…`) : ""
    },
    scores: (v) => v.stacks,
    scoreFmt: (x) => (typeof x === "number" ? rpShort(x) : x),
  }
}
