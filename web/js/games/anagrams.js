// Anagrams: tap letter tiles (or type) to build English words; longer words score more.
import { el } from "../lib.js?v=__VERSION__"

const PTS = { 3: 100, 4: 400, 5: 1200, 6: 2000, 7: 3000, 8: 4000 }

export function mount(stage, ctx) {
  const head = el("div", { class: "center" })
  const word = el("div", { class: "word-mask", style: { minHeight: "34px", letterSpacing: ".2em" } })
  const tiles = el("div", { class: "letters" })
  const ctrl = el("div", { class: "action-bar" })
  const mineBox = el("div", { class: "card" })
  stage.append(head, word, tiles, ctrl, mineBox)
  let picked = [], letters = "", lastRound = -1, V = null

  function drawTiles() {
    word.textContent = picked.map((i) => letters[i]).join("").toUpperCase() || "·"
    tiles.replaceChildren(...[...letters].map((ch, i) => el("button", { type: "button", class: picked.includes(i) ? "used" : "", text: ch,
      onclick: () => { if (V?.phase !== "play" || picked.includes(i)) return; picked.push(i); ctx.sfx.click(); drawTiles() } })))
  }
  const submit = () => {
    const w = picked.map((i) => letters[i]).join("")
    if (w.length >= 3) ctx.send({ w })
    picked = []
    drawTiles()
  }
  const shuffle = () => {
    const arr = [...letters]
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]] }
    letters = arr.join("")
    picked = []
    drawTiles()
  }
  document.addEventListener("keydown", onKey)
  function onKey(e) {
    if (V?.phase !== "play") return
    if (e.key === "Enter") return submit()
    if (e.key === "Backspace") { picked.pop(); return drawTiles() }
    const k = e.key.toLowerCase()
    const i = [...letters].findIndex((c, idx) => c === k && !picked.includes(idx))
    if (i >= 0) { picked.push(i); drawTiles() }
  }

  return {
    destroy() { document.removeEventListener("keydown", onKey) },
    update(v, events) {
      V = v
      for (const e of events) {
        if (e.e === "word" && e.to === ctx.me.id) { ctx.sfx.right(); ctx.toast(`+${e.pts} ${e.w.toUpperCase()}`) }
        if (e.e === "go") ctx.sfx.turn()
        if (e.e === "times_up") ctx.sfx.whoosh()
      }
      if (v.round !== lastRound || (v.phase === "intro")) {
        if (v.round !== lastRound) { letters = v.letters; picked = []; lastRound = v.round }
      }
      head.replaceChildren(el("div", { class: "small muted", text: ctx.L(`Ronde ${v.round}/${v.rounds}`, `Round ${v.round}/${v.rounds}`) }),
        el("div", { class: "big-msg", text: v.phase === "intro" ? ctx.L("Siap-siap…", "Get ready…") : v.phase === "play" ? ctx.L("Susun kata!", "Make words!") : ctx.L("Waktu habis!", "Time's up!") }))
      drawTiles()
      ctrl.replaceChildren()
      if (v.phase === "play") ctrl.append(
        el("button", { class: "btn", type: "button", text: "⌫", onclick: () => { picked.pop(); drawTiles() } }),
        el("button", { class: "btn", type: "button", text: "🔀", onclick: shuffle }),
        el("button", { class: "btn primary big", type: "button", text: ctx.L("Kirim", "Enter"), onclick: submit }))
      if (v.phase === "reveal") {
        const all = v.found || {}
        mineBox.replaceChildren(el("h3", { text: ctx.L(`Kata awal: ${v.seed?.toUpperCase()}`, `The long word: ${v.seed?.toUpperCase()}`) }),
          ...Object.entries(all).map(([p, ws]) => el("div", { style: { margin: "8px 0" } }, el("b", { text: `${ctx.player(p).avatar} ${ctx.name(p)} (${ws.length})` }),
            el("div", { class: "word-chips" }, ws.map((w) => el("span", { text: w }))))),
          v.missed?.length ? [el("h3", { text: ctx.L("Terlewat", "Missed") }), el("div", { class: "word-chips" }, v.missed.map((w) => el("span", { class: "new", text: w })))] : null)
      } else {
        mineBox.replaceChildren(el("h3", { text: ctx.L(`Kata kamu (${v.mine.length})`, `Your words (${v.mine.length})`) }),
          el("div", { class: "word-chips" }, [...v.mine].reverse().map((w) => el("span", { text: `${w} ${PTS[w.length] || ""}` }))),
          el("p", { class: "small muted", style: { marginTop: "8px" }, text: Object.entries(v.counts).map(([p, n]) => `${ctx.name(p)}: ${n}`).join(" · ") }))
      }
    },
  }
}
