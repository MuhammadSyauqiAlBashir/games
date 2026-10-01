// Tebak Gambar (draw & guess): the drawer draws live, everyone else guesses by typing.
import { avatar, el } from "../lib.js?v=__VERSION__"
import { createCanvas, toolbar } from "./canvas.js?v=__VERSION__"

export function mount(stage, ctx) {
  const catChip = (c) => (c ? el("div", { class: "cat-chip", text: `${c.icon} ${ctx.L(c.id, c.en)}` }) : null)
  const top = el("div", { class: "center" })
  const canvasBox = el("div")
  const tools = el("div")
  const feed = el("div", { class: "guess-feed" })
  const guessRow = el("div", { class: "answer-row" })
  stage.append(top, canvasBox, tools, guessRow, feed)
  let cv = null, drawer = null, turnKey = null, lastHints = 0
  // The guess row is built once and only shown/hidden: detaching a focused input closes the phone keyboard.
  const input = el("input", { type: "text", placeholder: "…", maxlength: 60, autocomplete: "off", autocapitalize: "off", autocorrect: "off", spellcheck: "false", enterkeyhint: "send" })
  const send = () => { const t = input.value.trim(); if (t) { ctx.send({ do: "guess", text: t }); input.value = "" } input.focus() }
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); send() } })
  const okBtn = el("button", { class: "btn primary big", type: "button", text: "OK", onclick: send })
  okBtn.addEventListener("pointerdown", (e) => { if (document.activeElement === input) e.preventDefault() })
  guessRow.append(input, okBtn)
  guessRow.hidden = true

  function feedLine(node) { feed.prepend(node); while (feed.children.length > 30) feed.lastChild.remove() }

  function setupCanvas(v) {
    const me = ctx.me.id
    const isDrawer = v.drawer === me
    if (cv) cv.destroy()
    canvasBox.replaceChildren()
    cv = createCanvas(canvasBox, { editable: isDrawer, onStroke: (d) => ctx.raw({ t: "stroke", d }) })
    cv.load(v.strokes)
    tools.replaceChildren(isDrawer ? toolbar(cv) : el("span"))
  }

  return {
    destroy() { cv && cv.destroy() },
    onStroke(from, d) { if (cv && from !== ctx.me.id) cv.apply(d) },
    update(v, events) {
      const me = ctx.me.id
      const key = `${v.turn}:${v.drawer}:${v.phase === "draw" ? "d" : v.phase}`
      if (!cv || key !== turnKey) {
        if (v.phase === "draw" || !cv) setupCanvas(v)
        turnKey = key
        if (v.phase === "pick") feed.replaceChildren()
      }
      if (cv) cv.enabled = v.phase === "draw" && v.drawer === me
      for (const e of events) {
        if (e.e === "guess") feedLine(el("div", {}, `${ctx.player(e.who).avatar} ${ctx.name(e.who)}: ${e.text}`))
        if (e.e === "chat") feedLine(el("div", { class: "muted" }, `${ctx.name(e.who)}: ${e.text}`))
        if (e.e === "got") { feedLine(el("div", { class: "got" }, `✅ ${ctx.name(e.who)} ${ctx.L("menebak benar!", "guessed it!")} +${e.pts}`)); if (e.who === me) ctx.sfx.right(); else ctx.sfx.blip() }
        if (e.e === "almost") { ctx.toast(ctx.L(`“${e.text}” hampir benar! 🔥`, `“${e.text}” is close! 🔥`)); ctx.sfx.pop() }
        if (e.e === "reveal") { ctx.sfx.whoosh() }
        if (e.e === "pick" && e.who === me) ctx.sfx.turn()
      }
      drawer = v.drawer
      const isDrawer = drawer === me
      const guessed = v.guessed && v.guessed[me] !== undefined
      if (v.phase === "pick") {
        top.replaceChildren(el("div", { class: "small muted", text: ctx.L(`Giliran ${v.turn}/${v.turns}`, `Turn ${v.turn}/${v.turns}`) }),
          isDrawer ? el("div", {}, el("div", { class: "big-msg", text: ctx.L("Pilih kata untuk digambar", "Choose a word to draw") }),
            el("div", { class: "row wrap", style: { justifyContent: "center" } }, v.choices.map((w, i) => el("button", { class: "btn primary dg-choice", type: "button", onclick: () => ctx.send({ do: "pick", i }) },
              el("span", { text: w.w ?? w }), w.cat ? el("small", { text: `${w.cat.icon} ${ctx.L(w.cat.id, w.cat.en)}` }) : null))))
            : el("div", { class: "big-msg" }, avatar(ctx.player(drawer)), " ", ctx.L(`${ctx.name(drawer)} memilih kata…`, `${ctx.name(drawer)} is choosing…`)))
      } else if (v.phase === "draw") {
        if (!isDrawer) {
          const hints = (v.hint_times || []).filter((t) => ctx.now() >= t).length
          if (hints !== lastHints) { lastHints = hints; if (hints) ctx.sfx.pop() }
        }
        top.replaceChildren(isDrawer ? el("div", {}, el("div", { class: "small muted", text: ctx.L("Gambarkan:", "Draw:") }), el("div", { class: "big-msg", text: v.word }), catChip(v.cat))
          : el("div", {}, el("div", { class: "small muted", text: ctx.L(`${ctx.name(drawer)} menggambar · ${v.letters} huruf`, `${ctx.name(drawer)} is drawing · ${v.letters} letters`) }),
            el("div", { class: "word-mask", text: guessed ? v.word : v.mask }), catChip(v.cat)))
      } else if (v.phase === "reveal") {
        top.replaceChildren(el("div", { class: "small muted", text: ctx.L("Katanya adalah", "The word was") }), el("div", { class: "big-msg", text: v.word }), catChip(v.cat))
      } else top.replaceChildren()
      const showGuess = v.phase === "draw" && !isDrawer
      if (!showGuess && document.activeElement === input) input.blur()
      guessRow.hidden = !showGuess
      input.placeholder = guessed ? ctx.L("Kamu sudah benar! Ngobrol aja…", "You got it! Chat…") : ctx.L("Tebak di sini…", "Guess here…")
    },
  }
}
