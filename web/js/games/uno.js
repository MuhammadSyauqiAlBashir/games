// UNO table: opponents on top, discard + draw pile on felt, your hand at the bottom.
import { el, sheet } from "../lib.js?v=__VERSION__"
import { UNO_COLORS, fly, rectOf, status, unoBack, unoCard } from "./common.js?v=__VERSION__"

const CNAME = { R: ["Merah", "Red"], G: ["Hijau", "Green"], B: ["Biru", "Blue"], Y: ["Kuning", "Yellow"] }

export function mount(stage, ctx) {
  const st = el("div", { class: "status-line" })
  const opp = el("div", { class: "row wrap", style: { justifyContent: "center", gap: "10px", margin: "2px 0 8px" } })
  const table = el("div", { class: "felt uno-table" })
  const actions = el("div", { class: "action-bar" })
  const hand = el("div", { class: "hand" })
  stage.append(st, opp, table, actions, hand)
  let sel = null
  let swapOpen = false
  let lastMine = null, seatEls = {}, prevHand = 0

  function chooseColor(cb) {
    const s = sheet(ctx.L("Pilih warna", "Choose a colour"))
    s.body.append(el("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" } },
      Object.entries(UNO_COLORS).map(([k, c]) => el("button", { class: "btn big", type: "button", style: { background: c, color: "#fff" }, text: CNAME[k][ctx.L(0, 1)],
        onclick: () => { s.close(); cb(k) } }))))
  }
  function chooseTarget(v) {
    if (swapOpen) return
    swapOpen = true
    const s = sheet(ctx.L("Tukar kartu dengan siapa?", "Swap hands with who?"), { onClose: () => { swapOpen = false } })
    s.body.append(el("div", { class: "col" }, Object.keys(v.counts).filter((p) => p !== ctx.me.id).map((p) =>
      el("button", { class: "btn wide", type: "button", text: `${ctx.player(p).avatar} ${ctx.name(p)} (${v.counts[p]})`, onclick: () => { s.close(); ctx.send({ do: "swap", target: p }) } }))))
  }

  return {
    update(v, events) {
      for (const e of events) {
        if (e.e === "draw") ctx.sfx.whoosh()
        if (e.e === "uno") { ctx.sfx.coin(); ctx.toast(`${ctx.name(e.who)}: UNO! 🟥`) }
        if (e.e === "caught") { ctx.sfx.wrong(); ctx.toast(ctx.L(`${ctx.name(e.who)} ketahuan lupa UNO! +2`, `${ctx.name(e.who)} forgot UNO! +2`)) }
        if (e.e === "challenge") ctx.toast(e.guilty ? ctx.L("Challenge berhasil! Pemain +4 ambil 4 kartu", "Challenge won! The +4 player draws 4") : ctx.L("Challenge gagal! Ambil 6", "Challenge failed! Draw 6"))
        if (e.e === "round") { ctx.sfx.win(); ctx.toast(ctx.L(`${ctx.name(e.winner)} menang ronde! +${e.points}`, `${ctx.name(e.winner)} wins the round! +${e.points}`)) }
        if (e.e === "swap") ctx.toast(ctx.L(`${ctx.name(e.who)} tukar kartu dengan ${ctx.name(e.with)}`, `${ctx.name(e.who)} swapped hands with ${ctx.name(e.with)}`))
      }
      const me = ctx.me.id
      const mine = v.turn === me && !v.over
      // Opponents
      seatEls = {}
      opp.replaceChildren(...Object.entries(v.counts).filter(([p]) => p !== me).map(([p, n]) => {
        const turn = v.turn === p
        return seatEls[p] = el("div", { class: "col", style: { alignItems: "center", gap: "2px", opacity: turn ? 1 : .8 } },
          el("div", { style: { display: "flex", height: "44px" } }, Array.from({ length: Math.min(n, 8) }, (_, i) => el("span", { style: { marginLeft: i ? "-22px" : 0 } }, unoBack(30)))),
          el("div", { class: `seat${turn ? " turn" : ""}`, style: { padding: "2px 8px 2px 3px" } }, el("span", { class: "av", style: { "--c": ctx.color(p), width: "22px", height: "22px", fontSize: "13px" }, text: ctx.player(p).avatar }),
            el("span", { text: `${ctx.name(p)} · ${n}` }), v.called.includes(p) && n === 1 ? el("b", { style: { color: "#e5484d" }, text: " UNO!" }) : null))
      }))
      // Table
      const pile = el("button", { type: "button", style: { border: 0, background: "none", padding: 0, cursor: mine && v.phase === "play" ? "pointer" : "default", position: "relative" },
        onclick: () => { if (mine && v.phase === "play") ctx.send({ do: "draw" }) } }, unoBack(84),
        el("span", { class: "pill", style: { position: "absolute", bottom: "-8px", left: "50%", transform: "translateX(-50%)" }, text: v.deck }))
      const top = el("span", { class: "uno-top" }, unoCard(v.top, 108))
      const colorDot = el("div", { style: { width: "26px", height: "26px", borderRadius: "50%", background: UNO_COLORS[v.color], border: "3px solid #fff", boxShadow: "0 2px 6px rgba(0,0,0,.3)" }, title: CNAME[v.color]?.[ctx.L(0, 1)] })
      table.replaceChildren(pile, top, el("div", { class: "col", style: { alignItems: "center", color: "#fff", fontWeight: 900 } }, colorDot,
        el("div", { style: { fontSize: "26px" }, text: v.dir === 1 ? "↻" : "↺" }), v.pending ? el("div", { class: "pill bad", text: `+${v.pending}` }) : null))
      if (v.phase === "round_over" && v.round_over) table.append(el("div", { style: { position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "rgba(0,0,0,.45)", borderRadius: "26px", color: "#fff", textAlign: "center" } },
        el("div", {}, el("div", { class: "big-msg", text: `🏆 ${ctx.name(v.round_over.winner)}` }), el("div", { text: ctx.L(`+${v.round_over.points} poin · ronde berikutnya…`, `+${v.round_over.points} points · next round…`) }))))
      // Actions
      actions.replaceChildren()
      const count = v.hand.length
      if (count <= 2 && !v.called.includes(me) && !v.over) actions.append(el("button", { class: "btn big", type: "button", style: { background: "#e5484d", color: "#fff" }, text: "UNO!", onclick: () => ctx.send({ do: "uno" }) }))
      if (v.vulnerable && v.vulnerable !== me) actions.append(el("button", { class: "btn gold", type: "button", text: ctx.L(`Tangkap ${ctx.name(v.vulnerable)}! 🕵️`, `Catch ${ctx.name(v.vulnerable)}! 🕵️`), onclick: () => ctx.send({ do: "catch" }) }))
      if (mine && v.phase === "respond4") {
        actions.append(el("button", { class: "btn", type: "button", text: ctx.L(`Terima +${v.pending}`, `Take +${v.pending}`), onclick: () => ctx.send({ do: "accept" }) }))
        if (!v.rules.w4_any && v.pending === 4) actions.append(el("button", { class: "btn primary", type: "button", text: ctx.L("Challenge! ⚖️", "Challenge! ⚖️"), onclick: () => ctx.send({ do: "challenge" }) }))
      }
      if (mine && v.phase === "drawn") actions.append(el("button", { class: "btn", type: "button", text: ctx.L("Simpan kartu", "Keep it"), onclick: () => ctx.send({ do: "keep" }) }))
      if (mine && v.phase === "play" && v.pending) actions.append(el("button", { class: "btn", type: "button", text: ctx.L(`Ambil ${v.pending}`, `Draw ${v.pending}`), onclick: () => ctx.send({ do: "draw" }) }))
      if (mine && v.phase === "swap") chooseTarget(v)
      // Hand
      const can = new Set(v.can)
      const jump = new Set(v.jump)
      if (sel !== null && !(can.has(sel) || jump.has(sel))) sel = null
      const avail = Math.min(window.innerWidth, 900) - 24
      const w = Math.max(52, Math.min(74, avail / 4.5))
      const overlap = count > 1 ? Math.max(8, (count * w - avail) / (count - 1)) : 0
      hand.replaceChildren(...v.hand.map((c, i) => {
        const ok = can.has(i) || jump.has(i)
        const card = el("span", { class: `${ok ? "ok" : mine ? "dim" : ""}${sel === i ? " sel" : ""}`, style: { borderRadius: "10px", marginLeft: i ? `-${overlap}px` : "0" } }, unoCard(c, w))
        card.onclick = () => {
          if (!ok) return
          if (sel !== i) { sel = i; ctx.sfx.click(); hand.querySelectorAll("span").forEach((x, k) => x.classList.toggle("sel", k === i)); return }
          const play = (color) => { lastMine = { rect: card.getBoundingClientRect(), code: c }; ctx.send({ do: "play", i, color }); sel = null }
          if (c.startsWith("W")) chooseColor(play); else play()
        }
        return card
      }))
      // Animations: played cards fly to the pile, drawn cards fly from the deck.
      let k = 0
      for (const e of events) {
        if (e.e === "play") {
          const from = e.who === me ? lastMine?.rect : rectOf(seatEls[e.who])
          const to = rectOf(top)
          top.style.visibility = "hidden"
          fly(unoCard(e.card, 108), from || rectOf(pile), to, { dur: 460, delay: k * 120, rotate: (Math.random() - 0.5) * 14, spin: e.who === me ? 0 : 180, arc: 30,
            onDone: () => { top.style.visibility = ""; top.classList.remove("land"); void top.offsetWidth; top.classList.add("land"); ctx.sfx.card() } })
          if (e.who === me) lastMine = null
          k++
        }
        if (e.e === "draw") {
          const n = Math.min(e.n || 1, 8)
          const to = e.who === me ? rectOf(hand.lastElementChild) || rectOf(hand) : rectOf(seatEls[e.who])
          for (let j = 0; j < n; j++) fly(unoBack(84), rectOf(pile), to, { dur: 380, delay: k * 120 + j * 110, rotate: 0, arc: 20 })
          k += 1
        }
      }
      if (v.hand.length > prevHand && prevHand > 0) [...hand.children].slice(prevHand).forEach((c, j) => { c.style.animationDelay = `${0.25 + j * 0.11}s`; c.classList.add("slide-in") })
      prevHand = v.hand.length
      let mineMsg = ctx.L("Giliranmu — ketuk kartu 2×", "Your turn — tap a card twice")
      if (v.phase === "drawn") mineMsg = ctx.L("Kartu yang diambil bisa dimainkan!", "The card you drew can be played!")
      if (v.phase === "respond4") mineMsg = ctx.L(`Kena +${v.pending}!`, `Hit by +${v.pending}!`)
      if (v.pending && v.phase === "play" && mine) mineMsg = ctx.L(`Tumpuk atau ambil ${v.pending}`, `Stack or draw ${v.pending}`)
      status(ctx, st, v, { mine: mineMsg })
      if (!mine && v.phase === "round_over") st.textContent = ctx.L("Ronde selesai", "Round over")
    },
    scores: (v) => (v.target ? v.scores : v.counts),
    scoreFmt: (x) => x,
  }
}
