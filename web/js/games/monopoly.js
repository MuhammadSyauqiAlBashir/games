// Monopoly: world-cities board (money in Rupiah), property cards, auctions, building, trading.
import { el, rp, rpShort, sheet, svg } from "../lib.js?v=__VERSION__"
import { die } from "./common.js?v=__VERSION__"

const GROUP = { brown: "#8b5a3c", lightblue: "#8fcfee", pink: "#d95aa5", orange: "#f39a3c", red: "#e5484d", yellow: "#f2cf3c",
  green: "#3fa66a", darkblue: "#2f5fb3", airport: "#5b6b7a", utility: "#9aa5b1" }
const ICON = { go: "🏁", jail: "🚔", parking: "🅿️", gotojail: "👮", tax: "💸", chance: "❓", chest: "🎁", airport: "✈️", utility: "💡" }

function cellRC(i) {
  if (i <= 10) return [10, 10 - i]
  if (i <= 20) return [10 - (i - 10), 0]
  if (i <= 30) return [0, i - 20]
  return [i - 30, 10]
}

export function mount(stage, ctx) {
  const st = el("div", { class: "status-line" })
  const wrap = el("div", { class: "board-wrap", style: { background: "#e9f3e6", borderRadius: "14px", boxShadow: "var(--shadow-lg)", overflow: "hidden" } })
  const panel = el("div", { class: "card", style: { maxWidth: "620px", margin: "10px auto 0", width: "100%" } })
  stage.append(st, wrap, panel)
  let V = null, tradeOpen = false

  const name = (sq) => V.squares[sq].name.split(" / ")[ctx.L(0, 1)] || V.squares[sq].name

  function squareInfo(sq) {
    const s = V.squares[sq]
    const p = V.props[String(sq)]
    const sh = sheet(`${ICON[s.type] || "🏙️"} ${name(sq)}`)
    const rows = []
    if (s.type === "street") {
      const labels = ctx.L(["Sewa", "1 rumah", "2 rumah", "3 rumah", "4 rumah", "Hotel"], ["Rent", "1 house", "2 houses", "3 houses", "4 houses", "Hotel"])
      s.rents.forEach((r, k) => rows.push(el("div", { class: "row between", style: { fontWeight: p && p.houses === k && p.owner ? 900 : 600 } }, el("span", { text: labels[k] }), el("span", { text: rp(r) }))))
      rows.push(el("div", { class: "row between muted small" }, el("span", { text: ctx.L("Harga rumah", "House cost") }), el("span", { text: rp(s.house) })))
      rows.push(el("div", { class: "small muted", text: ctx.L("Satu warna penuh tanpa rumah = sewa 2×.", "Full colour set without houses = double rent.") }))
    } else if (s.type === "airport") rows.push(el("p", { class: "muted", text: ctx.L("Sewa Rp250rb / 500rb / 1jt / 2jt untuk 1–4 bandara.", "Rent Rp250k / 500k / 1m / 2m for 1–4 airports.") }))
    else if (s.type === "utility") rows.push(el("p", { class: "muted", text: ctx.L("Sewa 4× dadu ×Rp10rb (10× jika punya keduanya).", "Rent 4× dice ×Rp10k (10× with both).") }))
    if (s.price) rows.unshift(el("div", { class: "row between" }, el("b", { text: ctx.L("Harga", "Price") }), el("b", { text: rp(s.price) })))
    if (p?.owner) rows.push(el("p", { style: { marginTop: "8px" }, text: `${ctx.L("Pemilik", "Owner")}: ${ctx.player(p.owner).avatar} ${ctx.name(p.owner)}${p.mort ? ctx.L(" · digadaikan", " · mortgaged") : ""}` }))
    sh.body.append(el("div", { style: { height: "10px", borderRadius: "6px", background: GROUP[s.group] || "#ccc", marginBottom: "10px" } }), ...rows)
  }

  function myProps() {
    const me = ctx.me.id
    const sh = sheet(ctx.L("Properti saya", "My properties"))
    const draw = () => {
      const list = Object.entries(V.props).filter(([, p]) => p.owner === me).map(([sq, p]) => [Number(sq), p])
      sh.body.replaceChildren(...(list.length ? list.map(([sq, p]) => {
        const s = V.squares[sq]
        const act = (doIt, label, cls = "") => el("button", { class: `btn small ${cls}`, type: "button", text: label, onclick: () => ctx.send({ do: doIt, sq }) })
        return el("div", { style: { padding: "10px 0", borderBottom: "1px solid var(--line)" } },
          el("div", { class: "row" }, el("span", { style: { width: "12px", height: "28px", borderRadius: "4px", background: GROUP[s.group] } }),
            el("b", { class: "grow", text: name(sq) }), el("span", { class: "small muted", text: p.mort ? ctx.L("digadai", "mortgaged") : p.houses === 5 ? "🏨" : "🏠".repeat(p.houses) })),
          el("div", { class: "row wrap", style: { marginTop: "6px" } },
            s.type === "street" && !p.mort && p.houses < 5 ? act("build", `${ctx.L("Bangun", "Build")} ${rpShort(s.house)}`, "teal") : null,
            p.houses ? act("sell", `${ctx.L("Jual bangunan", "Sell building")} +${rpShort(s.house / 2)}`) : null,
            !p.mort && !p.houses ? act("mortgage", `${ctx.L("Gadai", "Mortgage")} +${rpShort(s.price / 2)}`) : null,
            p.mort ? act("unmortgage", `${ctx.L("Tebus", "Lift")} ${rpShort(Math.floor(s.price / 2 * 1.1))}`) : null))
      }) : [el("p", { class: "empty", text: ctx.L("Belum punya properti.", "No properties yet.") })]))
    }
    draw()
    myProps.redraw = draw
    sh.dialog.addEventListener("close", () => { myProps.redraw = null })
  }

  function tradeBuilder() {
    const me = ctx.me.id
    const others = Object.keys(V.cash).filter((p) => p !== me && !V.bankrupt.includes(p))
    let to = others[0]
    const give = new Set(), get = new Set()
    const sh = sheet(ctx.L("Tawarkan pertukaran", "Propose a trade"))
    const cashGive = el("input", { class: "input", type: "number", min: 0, step: 10000, value: 0 })
    const cashGet = el("input", { class: "input", type: "number", min: 0, step: 10000, value: 0 })
    const body = el("div")
    const draw = () => {
      const propList = (owner, set) => Object.entries(V.props).filter(([, p]) => p.owner === owner).map(([sq]) => {
        const s = V.squares[sq]
        return el("button", { type: "button", class: `chip${set.has(Number(sq)) ? " on" : ""}`, onclick: () => { set.has(Number(sq)) ? set.delete(Number(sq)) : set.add(Number(sq)); draw() } },
          el("i", { style: { width: "8px", height: "8px", borderRadius: "2px", background: GROUP[s.group], display: "inline-block" } }), name(Number(sq)))
      })
      body.replaceChildren(
        el("div", { class: "row wrap" }, others.map((p) => el("button", { type: "button", class: `chip${to === p ? " on" : ""}`, text: `${ctx.player(p).avatar} ${ctx.name(p)}`, onclick: () => { to = p; get.clear(); draw() } }))),
        el("h3", { style: { marginTop: "12px" }, text: ctx.L("Kamu beri", "You give") }), el("div", { class: "row wrap" }, propList(me, give)),
        el("label", { class: "field" }, el("span", { text: ctx.L("Uang (Rp)", "Cash (Rp)") }), cashGive),
        el("h3", { text: ctx.L(`Kamu minta dari ${ctx.name(to)}`, `You ask from ${ctx.name(to)}`) }), el("div", { class: "row wrap" }, propList(to, get)),
        el("label", { class: "field" }, el("span", { text: ctx.L("Uang (Rp)", "Cash (Rp)") }), cashGet),
        el("button", { class: "btn primary wide", type: "button", text: ctx.L("Kirim tawaran", "Send offer"), onclick: () => {
          ctx.send({ do: "trade", to, give: { props: [...give], cash: Number(cashGive.value) || 0 }, get: { props: [...get], cash: Number(cashGet.value) || 0 } })
          sh.close()
        } }))
    }
    draw()
    sh.body.append(body)
  }

  function tradeIncoming(t) {
    if (tradeOpen) return
    tradeOpen = true
    const sh = sheet(ctx.L(`Tawaran dari ${ctx.name(t.from)}`, `Offer from ${ctx.name(t.from)}`), { onClose: () => { tradeOpen = false } })
    const side = (s) => [...s.props.map((sq) => name(sq)), s.cash ? rp(s.cash) : null, s.cards ? `${s.cards}× 🗝️` : null].filter(Boolean).join(", ") || "—"
    sh.body.append(el("p", {}, el("b", { text: ctx.L("Kamu dapat: ", "You get: ") }), side(t.give)), el("p", {}, el("b", { text: ctx.L("Kamu beri: ", "You give: ") }), side(t.get)),
      el("div", { class: "row" }, el("button", { class: "btn teal grow", type: "button", text: ctx.L("Terima 🤝", "Accept 🤝"), onclick: () => { ctx.send({ do: "trade_accept" }); sh.close() } }),
        el("button", { class: "btn grow", type: "button", text: ctx.L("Tolak", "Decline"), onclick: () => { ctx.send({ do: "trade_reject" }); sh.close() } })))
  }

  function drawBoard(v, events) {
    const g = svg("svg", { viewBox: "0 0 110 110" })
    g.append(svg("rect", { x: 0, y: 0, width: 110, height: 110, fill: "#d9ecd4" }))
    for (let i = 0; i < 40; i++) {
      const [r, c] = cellRC(i)
      const x = c * 10, y = r * 10
      const s = v.squares[i]
      const p = v.props[String(i)]
      const cellG = svg("g", { style: "cursor:pointer", onclick: () => squareInfo(i) })
      cellG.append(svg("rect", { x: x + .2, y: y + .2, width: 9.6, height: 9.6, fill: p?.mort ? "#ddd" : "#fffaf0", stroke: p?.owner ? ctx.color(p.owner) : "#b9cdb3", "stroke-width": p?.owner ? .9 : .3 }))
      if (s.group && GROUP[s.group] && s.type === "street") {
        const band = r === 10 ? [x + .2, y + .2, 9.6, 2.4] : r === 0 ? [x + .2, y + 7.4, 9.6, 2.4] : c === 0 ? [x + 7.4, y + .2, 2.4, 9.6] : [x + .2, y + .2, 2.4, 9.6]
        cellG.append(svg("rect", { x: band[0], y: band[1], width: band[2], height: band[3], fill: GROUP[s.group] }))
      }
      const label = (s.name.split(" / ")[0] || "").replace("Pajak ", "").replace("Penghasilan", "Pajak").replace(" City", "").replace("Rio de Janeiro", "Rio").replace("Buenos Aires", "B. Aires").replace("Kuala Lumpur", "K. Lumpur").slice(0, 9)
      if (s.type === "street") {
        cellG.append(svg("text", { x: x + 5, y: y + 5.6, "text-anchor": "middle", "font-size": 2.05, "font-weight": 800, fill: "#2e2722", text: label }))
        cellG.append(svg("text", { x: x + 5, y: y + 7.6, "text-anchor": "middle", "font-size": 1.9, fill: "#6b5f55", text: rpShort(s.price).replace("Rp", "") }))
      } else {
        cellG.append(svg("text", { x: x + 5, y: y + 5.6, "text-anchor": "middle", "font-size": i % 10 === 0 ? 4 : 3.4, text: ICON[s.type] || "" }))
        if (s.type === "airport" || s.type === "utility") cellG.append(svg("text", { x: x + 5, y: y + 8.4, "text-anchor": "middle", "font-size": 1.4, "font-weight": 800, fill: "#2e2722", text: label.slice(0, 11) }))
      }
      if (p?.houses) {
        if (p.houses === 5) cellG.append(svg("rect", { x: x + 3.4, y: y + (r === 10 ? 2.9 : 1), width: 3.2, height: 1.6, rx: .3, fill: "#e5484d" }))
        else for (let k = 0; k < p.houses; k++) cellG.append(svg("rect", { x: x + 1.3 + k * 2, y: y + (r === 10 ? 2.9 : 1), width: 1.5, height: 1.3, rx: .2, fill: "#3fa66a" }))
      }
      g.append(cellG)
    }
    // Centre
    g.append(svg("text", { x: 55, y: 44, "text-anchor": "middle", "font-size": 8, "font-weight": 800, fill: "#3d8b7a", "font-family": "Fraunces, serif", text: "MONOPOLI" }))
    if (v.pot && v.parking_rule) g.append(svg("text", { x: 55, y: 52, "text-anchor": "middle", "font-size": 3, "font-weight": 800, fill: "#2e2722", text: `🅿️ Jackpot ${rpShort(v.pot)}` }))
    if (v.ends_at) {
      const left = Math.max(0, v.ends_at - ctx.now())
      g.append(svg("text", { x: 55, y: 57, "text-anchor": "middle", "font-size": 3, "font-weight": 800, fill: "#6b5f55", text: `⏱️ ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, "0")}` }))
    }
    if (v.card) {
      g.append(svg("rect", { x: 25, y: 62, width: 60, height: 20, rx: 2, fill: v.card.deck === "chance" ? "#f39a3c" : "#8fcfee", stroke: "#fff", "stroke-width": .6 }))
      const text = ctx.L(v.card.id, v.card.en)
      const words = text.split(" ")
      let line = "", lines = []
      for (const w of words) { if ((line + " " + w).length > 34) { lines.push(line); line = w } else line = line ? line + " " + w : w }
      lines.push(line)
      lines.slice(0, 3).forEach((l, k) => g.append(svg("text", { x: 55, y: 68.5 + k * 3.6, "text-anchor": "middle", "font-size": 2.6, "font-weight": 800, fill: "#2e2722", text: l })))
      g.append(svg("text", { x: 55, y: 65.3, "text-anchor": "middle", "font-size": 2.2, fill: "#2e2722", text: v.card.deck === "chance" ? ctx.L("KESEMPATAN", "CHANCE") : ctx.L("DANA UMUM", "COMMUNITY CHEST") }))
    }
    // Tokens
    const at = {}
    for (const [pid, pos] of Object.entries(v.pos)) if (!v.bankrupt.includes(pid)) (at[pos] = at[pos] || []).push(pid)
    for (const [pos, pids] of Object.entries(at)) {
      const [r, c] = cellRC(Number(pos))
      pids.forEach((pid, k) => {
        const x = c * 10 + 2.6 + (k % 3) * 2.4, y = r * 10 + 4.3 + Math.floor(k / 3) * 2.8
        const jailed = v.jail[pid] >= 0
        g.append(svg("g", {}, svg("circle", { cx: x, cy: y, r: 1.55, fill: ctx.color(pid), stroke: jailed ? "#2e2722" : "#fff", "stroke-width": .4 }),
          svg("text", { x, y: y + .75, "text-anchor": "middle", "font-size": 2.1, text: ctx.player(pid).avatar })))
      })
    }
    wrap.replaceChildren(g)
    void events
  }

  function drawPanel(v) {
    const me = ctx.me.id
    const mine = v.turn === me && !v.over
    const phase = v.phase
    const btn = (label, doIt, cls = "", extra = {}) => el("button", { class: `btn ${cls}`, type: "button", text: label, onclick: () => ctx.send({ do: doIt, ...extra }) })
    const parts = []
    const cash = v.cash[me]
    if (cash !== undefined) parts.push(el("div", { class: "row between" }, el("b", { text: `💰 ${rp(cash)}` }), el("span", { class: "small muted", text: `${ctx.L("Kekayaan", "Net worth")} ${rpShort(v.worth[me])}` })))
    const row = el("div", { class: "row wrap", style: { marginTop: "10px" } })
    if (v.trade && v.trade.to === me) tradeIncoming(v.trade)
    if (v.trade && v.trade.from === me) parts.push(el("p", { class: "muted", text: ctx.L(`Menunggu jawaban ${ctx.name(v.trade.to)}…`, `Waiting for ${ctx.name(v.trade.to)}…`) }), btn(ctx.L("Batalkan", "Cancel"), "trade_cancel"))
    if (phase === "auction" && v.auction) {
      const au = v.auction
      const left = Math.max(0, Math.ceil(au.ends - ctx.now()))
      parts.push(el("h3", { text: `🔨 ${ctx.L("Lelang", "Auction")}: ${name(au.sq)}` }),
        el("p", {}, au.by ? `${ctx.L("Tawaran tertinggi", "Top bid")}: ${rp(au.bid)} — ${ctx.name(au.by)}` : ctx.L("Belum ada tawaran", "No bids yet"), ` · ⏱️ ${left}s`))
      if (!v.bankrupt.includes(me)) for (const inc of [10000, 50000, 100000, 500000]) row.append(btn(`+${rpShort(inc).replace("Rp", "")}`, "bid", "teal small", { amount: (au.bid || 0) + inc }))
    } else if (phase === "debt" && v.debt) {
      if (v.debt.who === me) {
        parts.push(el("h3", { style: { color: "var(--bad)" }, text: `⚠️ ${ctx.L("Kamu harus bayar", "You owe")} ${rp(v.debt.amount)}` }),
          el("p", { class: "muted small", text: ctx.L("Jual bangunan atau gadaikan properti untuk dapat uang.", "Sell buildings or mortgage properties to raise cash.") }))
        row.append(el("button", { class: "btn teal", type: "button", text: ctx.L("Kelola properti", "Manage properties"), onclick: myProps }), btn(ctx.L("Bayar", "Pay"), "pay_debt", "primary"),
          el("button", { class: "btn danger", type: "button", text: ctx.L("Bangkrut", "Go bankrupt"), onclick: () => { if (confirm(ctx.L("Yakin bangkrut?", "Declare bankruptcy?"))) ctx.send({ do: "bankrupt" }) } }))
      } else parts.push(el("p", { class: "muted", text: ctx.L(`${ctx.name(v.debt.who)} sedang mencari uang untuk bayar ${rp(v.debt.amount)}…`, `${ctx.name(v.debt.who)} is raising ${rp(v.debt.amount)}…`) }))
    } else if (mine && phase === "buy" && v.pending) {
      const s = v.squares[v.pending.sq]
      parts.push(el("h3", { text: `${ICON[s.type] || "🏙️"} ${name(v.pending.sq)} — ${rp(s.price)}` }))
      row.append(btn(ctx.L("Beli", "Buy"), "buy", "primary"), btn(ctx.L("Lelang", "Auction"), "auction"),
        el("button", { class: "btn ghost small", type: "button", text: ctx.L("Info", "Info"), onclick: () => squareInfo(v.pending.sq) }))
    } else if (mine && phase === "roll") {
      if (v.jail[me] >= 0) {
        parts.push(el("p", { text: ctx.L(`🚔 Di penjara (percobaan ${v.jail[me] + 1}/3): lempar double untuk keluar.`, `🚔 In jail (try ${v.jail[me] + 1}/3): roll doubles to get out.`) }))
        row.append(btn(ctx.L("Bayar Rp500rb", "Pay Rp500k"), "jail_pay"))
        if (v.jailcards[me]) row.append(btn(ctx.L("Pakai kartu bebas", "Use the card"), "jail_card"))
      }
      row.append(btn(ctx.L("Lempar dadu 🎲", "Roll 🎲"), "roll", "primary big"))
    } else if (mine && phase === "manage") {
      row.append(btn(v.again ? ctx.L("Double! Lempar lagi 🎲", "Doubles! Roll again 🎲") : ctx.L("Selesai giliran", "End turn"), "end", "primary"))
    }
    if (mine && ["roll", "manage"].includes(phase) && !v.trade) {
      row.append(el("button", { class: "btn small", type: "button", text: ctx.L("🏠 Properti", "🏠 Properties"), onclick: myProps }),
        el("button", { class: "btn small", type: "button", text: ctx.L("🤝 Tukar", "🤝 Trade"), onclick: tradeBuilder }))
    }
    const dice = v.dice ? el("div", { class: "row" }, die(v.dice[0]), die(v.dice[1])) : null
    panel.replaceChildren(...parts, dice ? el("div", { class: "row", style: { justifyContent: "center", margin: "8px 0" } }, dice) : null, row,
      el("div", { class: "small muted", style: { marginTop: "10px" } }, (v.log || []).slice(-4).reverse().map((l) => el("div", { text: `• ${ctx.L(l.id, l.en)}` }))))
    if (myProps.redraw) myProps.redraw()
  }

  const ticker = setInterval(() => { if (V && (V.phase === "auction" || V.ends_at)) { drawPanel(V); if (V.ends_at) drawBoard(V, []) } }, 1000)

  return {
    destroy() { clearInterval(ticker) },
    update(v, events) {
      V = v
      for (const e of events) {
        if (e.e === "roll") ctx.sfx.dice()
        if (e.e === "buy" || e.e === "sold") ctx.sfx.cash()
        if (e.e === "rent") ctx.sfx.coin()
        if (e.e === "card") ctx.sfx.card()
        if (e.e === "jail") ctx.sfx.wrong()
        if (e.e === "build") ctx.sfx.place()
        if (e.e === "bankrupt") ctx.sfx.lose()
        if (e.e === "trade_ok") { ctx.sfx.right(); ctx.toast(ctx.L("Pertukaran berhasil 🤝", "Trade done 🤝")) }
        if (e.e === "trade_no") ctx.toast(ctx.L("Tawaran ditolak", "Offer declined"))
      }
      drawBoard(v, events)
      drawPanel(v)
      const turn = v.turn
      st.className = `status-line${turn === ctx.me.id && !v.over ? " mine" : ""}`
      st.textContent = v.over ? ctx.L("Permainan selesai", "Game over") : v.phase === "auction" ? ctx.L("Lelang! Semua boleh menawar", "Auction! Everyone can bid")
        : turn === ctx.me.id ? ctx.L("Giliranmu", "Your turn") : ctx.L(`Giliran ${ctx.name(turn)}`, `${ctx.name(turn)}'s turn`)
    },
    scores: (v) => v.cash,
    scoreFmt: (x) => (typeof x === "number" ? rpShort(x) : x),
    turnIds: (v) => (v.phase === "auction" ? [] : v.trade ? [v.trade.to] : v.phase === "debt" && v.debt ? [v.debt.who] : []),
  }
}
