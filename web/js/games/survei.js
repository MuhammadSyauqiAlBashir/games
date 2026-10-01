// Survei 100 (Family 100): the board of hidden answers; everyone types guesses at once. Found answers flip open
// with the finder's avatar; a wrong guess shows the big red ❌ (3 and you're locked for the round).
import { el } from "../lib.js?v=__VERSION__"

export function mount(stage, ctx) {
  const head = el("div", { class: "center" })
  const q = el("div", { class: "q-card sv-q" })
  const board = el("div", { class: "sv-board" })
  const strikes = el("div", { class: "sv-strikes" })
  const row = el("div", { class: "answer-row" })
  const input = el("input", { type: "text", maxlength: 50, autocomplete: "off", autocapitalize: "off", autocorrect: "off", spellcheck: "false", enterkeyhint: "send" })
  const okBtn = el("button", { class: "btn primary big", type: "button", text: "OK" })
  okBtn.addEventListener("pointerdown", (e) => { if (document.activeElement === input) e.preventDefault() })
  row.append(input, okBtn)
  const feed = el("div", { class: "guess-feed" })
  const bigX = el("div", { class: "sv-bigx", hidden: true, text: "❌" })
  stage.append(head, q, board, strikes, row, feed, bigX)
  let V = null, shown = {}, lastRound = -1

  const send = () => { const t = input.value.trim(); if (t && V?.phase === "play") { ctx.send({ do: "guess", text: t }); input.value = "" } input.focus() }
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); send() } })
  okBtn.onclick = send
  const feedLine = (n) => { feed.prepend(n); while (feed.children.length > 12) feed.lastChild.remove() }

  return {
    scores: (v) => v.scores,
    update(v, events) {
      V = v
      const me = ctx.me.id
      if (v.round !== lastRound) { lastRound = v.round; shown = {}; feed.replaceChildren() }
      for (const e of events) {
        if (e.e === "hit") {
          ctx.sfx.ding()
          feedLine(el("div", {}, `${ctx.player(e.who).avatar} ${ctx.name(e.who)}: `, el("b", { text: `${e.a} (+${e.pts})` })))
        }
        if (e.e === "x") {
          ctx.sfx.buzz()
          bigX.textContent = "❌".repeat(e.n)
          bigX.hidden = false
          bigX.classList.remove("pop"); void bigX.offsetWidth; bigX.classList.add("pop")
          setTimeout(() => { bigX.hidden = true }, 900)
          feedLine(el("div", { class: "muted" }, `✗ ${e.text}`))
        }
        if (e.e === "already") ctx.toast(ctx.L(`“${e.text}” sudah dibuka (no. ${e.n})`, `“${e.text}” is already open (#${e.n})`))
        if (e.e === "locked") ctx.toast(ctx.L("Kamu sudah 3× salah — tunggu ronde berikutnya", "3 wrong guesses — wait for the next round"), "bad")
        if (e.e === "go") { ctx.sfx.turn(); setTimeout(() => input.focus(), 50) }
        if (e.e === "reveal" || e.e === "clear") ctx.sfx.whoosh()
      }
      head.replaceChildren(el("div", { class: "small muted", text: ctx.L(`Ronde ${v.round}/${v.rounds}`, `Round ${v.round}/${v.rounds}`) }),
        v.double ? el("div", { class: "pill warn", text: ctx.L("RONDE GANDA ×2", "DOUBLE ROUND ×2") }) : null)
      q.replaceChildren(el("div", { class: "small muted", text: ctx.L("Survei 100 orang membuktikan…", "We asked 100 people…") }), el("div", { class: "q", text: v.q }))
      board.replaceChildren(...v.board.map((b) => {
        const open = !!b.a
        const fresh = open && !shown[b.n]
        if (open) shown[b.n] = true
        const by = b.by ? ctx.player(b.by) : null
        return el("div", { class: `sv-slot${open ? " open" : ""}${fresh ? " flip" : ""}${open && !b.by ? " missed" : ""}` },
          el("span", { class: "n", text: b.n }),
          el("span", { class: "a", text: open ? b.a : "" }),
          open ? el("span", { class: "p", text: b.pts }) : null,
          by ? el("span", { class: "by", style: { "--c": by.color }, text: by.avatar }) : null)
      }))
      strikes.textContent = v.phase === "play" ? "❌".repeat(v.strikes) + "▫️".repeat(Math.max(0, v.max_strikes - v.strikes)) : ""
      const can = v.phase === "play" && v.strikes < v.max_strikes
      row.classList.toggle("waiting", !can)
      input.disabled = !can
      input.placeholder = v.phase === "show" ? ctx.L("Siap-siap…", "Get ready…") : can ? ctx.L("Ketik jawabanmu…", "Type your answer…") : ctx.L("Tunggu ronde berikutnya", "Wait for the next round")
    },
  }
}
