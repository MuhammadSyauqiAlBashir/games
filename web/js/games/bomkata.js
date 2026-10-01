// Bom Kata (word bomb): players sit around the table, the bomb points at whoever must type a word containing
// the letters on it. The fuse is secret — the ticking speeds up the longer you take.
import { el } from "../lib.js?v=__VERSION__"

const WHY = { syl: ["Harus mengandung huruf di bom", "Must contain the letters on the bomb"], short: ["Kurang panjang", "Too short"],
  used: ["Sudah dipakai", "Already used"], unknown: ["Tidak ada di kamus", "Not in the dictionary"] }

export function mount(stage, ctx) {
  const table = el("div", { class: "bk-table" })
  const bomb = el("div", { class: "bk-bomb" }, el("span", { class: "bk-fuse" }), el("b", { class: "bk-syl" }))
  const arrow = el("div", { class: "bk-arrow" })
  const seatsBox = el("div")
  table.append(seatsBox, arrow, bomb)
  const info = el("div", { class: "bk-info" })
  const row = el("div", { class: "answer-row" })
  const input = el("input", { type: "text", maxlength: 30, autocomplete: "off", autocapitalize: "off", autocorrect: "off", spellcheck: "false", enterkeyhint: "send" })
  const okBtn = el("button", { class: "btn primary big", type: "button", text: "💣➜" })
  okBtn.addEventListener("pointerdown", (e) => { if (document.activeElement === input) e.preventDefault() })
  row.append(input, okBtn)
  const letters = el("div", { class: "bk-letters" })
  stage.append(table, info, row, letters)
  let V = null, seatNodes = {}, lastTurn = null, typeTimer = 0, lastSent = "", raf = 0, nextTick = 0

  const submit = () => {
    const w = input.value.trim().toLowerCase()
    if (!w || !V || V.turn !== ctx.me.id || V.phase !== "play") return
    ctx.send({ do: "word", w })
  }
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); submit() } })
  okBtn.onclick = submit
  input.addEventListener("input", () => {
    // others see what you type (a little delayed, to keep the connection calm)
    clearTimeout(typeTimer)
    typeTimer = setTimeout(() => { const t = input.value.toLowerCase(); if (t !== lastSent && V?.turn === ctx.me.id) { lastSent = t; ctx.send({ do: "type", text: t }) } }, 120)
  })

  function place(order) {
    const n = order.length
    seatsBox.replaceChildren()
    seatNodes = {}
    order.forEach((pid, i) => {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2
      const x = 50 + Math.cos(a) * 38, y = 50 + Math.sin(a) * 38
      const node = el("div", { class: "bk-seat", style: { left: `${x}%`, top: `${y}%` } },
        el("span", { class: "av", style: { "--c": ctx.color(pid) }, text: ctx.player(pid).avatar }),
        el("small", { class: "nm", text: ctx.name(pid) }), el("small", { class: "hearts" }), el("small", { class: "typing" }))
      node.dataset.a = a
      seatsBox.append(node)
      seatNodes[pid] = node
    })
  }

  // ticking: faster the longer the bomb has been with the same player (the real fuse stays secret)
  const loop = () => {
    raf = requestAnimationFrame(loop)
    if (!V || V.phase !== "play") { bomb.style.setProperty("--heat", 0); return }
    const held = ctx.now() - V.since
    const heat = Math.min(1, held / 14)
    bomb.style.setProperty("--heat", heat.toFixed(2))
    const now = performance.now()
    if (now >= nextTick) { ctx.sfx.tick(); nextTick = now + Math.max(180, 900 - held * 55) }
  }
  raf = requestAnimationFrame(loop)

  return {
    destroy() { cancelAnimationFrame(raf); clearTimeout(typeTimer) },
    scores: (v) => Object.fromEntries(Object.entries(v.lives).map(([p, n]) => [p, n > 0 ? "❤️".repeat(n) : "💀"])),
    update(v, events) {
      V = v
      const me = ctx.me.id
      if (Object.keys(seatNodes).join() !== v.order.join()) place(v.order)
      for (const e of events) {
        if (e.e === "good") { ctx.sfx.right(); flash(e.who, e.w, "good") }
        if (e.e === "bad") {
          ctx.sfx.buzz(); flash(e.who, e.w, "bad")
          if (e.who === me) { row.classList.remove("shake"); void row.offsetWidth; row.classList.add("shake"); ctx.toast(ctx.L(...WHY[e.why]), "bad") }
        }
        if (e.e === "boom") { ctx.sfx.boom(); table.classList.remove("boom"); void table.offsetWidth; table.classList.add("boom") }
        if (e.e === "out") ctx.toast(ctx.L(`${ctx.name(e.who)} tersingkir 💀`, `${ctx.name(e.who)} is out 💀`))
        if (e.e === "life") { ctx.sfx.coin(); ctx.toast(ctx.L(`${ctx.name(e.who)} dapat nyawa bonus! ❤️`, `${ctx.name(e.who)} won a bonus life! ❤️`)) }
        if (e.e === "go") nextTick = 0
      }
      // seats
      for (const pid of v.order) {
        const n = seatNodes[pid]
        if (!n) continue
        const lives = v.lives[pid]
        n.classList.toggle("on", v.turn === pid && v.phase === "play")
        n.classList.toggle("dead", lives <= 0)
        n.querySelector(".hearts").textContent = lives > 0 ? "❤️".repeat(lives) : "💀"
        n.querySelector(".typing").textContent = v.turn === pid && v.phase === "play" ? (v.typing || "…") : ""
      }
      const holder = seatNodes[v.turn]
      if (holder) arrow.style.transform = `translate(-50%, -50%) rotate(${(+holder.dataset.a * 180) / Math.PI + 90}deg)`
      arrow.hidden = !(v.phase === "play" && holder)
      bomb.querySelector(".bk-syl").textContent = v.phase === "intro" ? "…" : v.syl.toUpperCase()
      // info + input
      const mine = v.turn === me && v.phase === "play"
      info.textContent = v.phase === "intro" ? ctx.L("Siap-siap… bom segera dinyalakan!", "Get ready… lighting the fuse!")
        : v.phase === "boom" ? ctx.L(`💥 DUAR! Meledak di tangan ${ctx.name(v.turn)}`, `💥 BOOM! It blew up on ${ctx.name(v.turn)}`)
        : mine ? ctx.L(`Ketik kata yang mengandung “${v.syl.toUpperCase()}”!`, `Type a word containing “${v.syl.toUpperCase()}”!`)
        : ctx.L(`${ctx.name(v.turn)} sedang mikir…`, `${ctx.name(v.turn)} is thinking…`)
      info.className = `bk-info${mine ? " mine" : ""}`
      row.classList.toggle("waiting", !mine)
      input.disabled = !mine
      if (v.turn !== lastTurn) {
        lastTurn = v.turn
        input.value = ""
        lastSent = ""
        if (mine) { ctx.sfx.turn(); setTimeout(() => input.focus(), 50) }
      }
      input.placeholder = mine ? ctx.L(`kata dengan “${v.syl}”`, `a word with “${v.syl}”`) : ctx.L("tunggu giliranmu", "wait for your turn")
      // bonus letters: use them all for an extra life
      const have = new Set(v.letters || [])
      letters.replaceChildren(el("small", { class: "muted", text: ctx.L("Huruf bonus ❤️: ", "Bonus letters ❤️: ") }),
        ...[...(v.bonus || "")].map((c) => el("span", { class: have.has(c) ? "on" : "", text: c.toUpperCase() })))
    },
  }

  function flash(pid, w, kind) {
    const n = seatNodes[pid]
    if (!n) return
    const b = el("div", { class: `bk-pop ${kind}`, text: w })
    n.append(b)
    setTimeout(() => b.remove(), 1400)
  }
}
