// Ketik Ngebut: everyone types the same text; cars race along with each player's progress.
// Capitals and punctuation don't matter (phones are slow at them) — only letters, numbers and spaces.
import { el } from "../lib.js?v=__VERSION__"

const norm = (s, keepTrail) => {
  let t = s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").replace(/^ /, "")
  if (!keepTrail) t = t.trimEnd()
  return t
}
const CARS = ["🚗", "🚕", "🚙", "🏎️", "🚓", "🚑", "🛻", "🚌"]

export function mount(stage, ctx) {
  const head = el("div", { class: "center" })
  const track = el("div", { class: "kt-track" })
  const text = el("div", { class: "kt-text" })
  const box = el("textarea", { class: "kt-input", rows: 2, autocomplete: "off", autocapitalize: "off", autocorrect: "off", spellcheck: "false" })
  const note = el("div", { class: "small muted center" })
  stage.append(head, track, text, box, note)
  let V = null, lastRound = -1, sent = 0, sendT = 0, errs = 0, prevLen = 0, finished = false

  function paint() {
    if (!V) return
    const target = V.target
    const typed = norm(box.value, true)
    let k = 0
    while (k < typed.length && k < target.length && typed[k] === target[k]) k++
    const wrong = typed.length > k
    text.replaceChildren(el("span", { class: "ok", text: target.slice(0, k) }),
      el("span", { class: wrong ? "bad" : "cur", text: target.slice(k, k + 1) || " " }), el("span", { text: target.slice(k + 1) }))
    box.classList.toggle("bad", wrong)
    return { k, typed, wrong }
  }

  box.addEventListener("input", () => {
    if (!V || V.phase !== "play" || finished) return
    const r = paint()
    if (r.typed.length > prevLen && r.wrong) { errs++; ctx.sfx.blip() }
    prevLen = r.typed.length
    if (norm(box.value) === V.target) {
      finished = true
      ctx.send({ do: "done", text: box.value, errs })
      box.disabled = true
      return
    }
    if (r.k !== sent && performance.now() - sendT > 250) { sent = r.k; sendT = performance.now(); ctx.send({ do: "p", n: r.k }) }
  })
  // catch the last progress update after typing pauses
  const iv = setInterval(() => {
    if (!V || V.phase !== "play" || finished) return
    const r = paint()
    if (r && r.k !== sent) { sent = r.k; sendT = performance.now(); ctx.send({ do: "p", n: r.k }) }
  }, 700)

  return {
    destroy() { clearInterval(iv) },
    scores: (v) => v.scores,
    update(v, events) {
      V = v
      const me = ctx.me.id
      if (v.round !== lastRound) { lastRound = v.round; box.value = ""; errs = 0; sent = 0; prevLen = 0; finished = false }
      for (const e of events) {
        if (e.e === "go") { ctx.sfx.turn(); box.disabled = false; setTimeout(() => box.focus(), 50) }
        if (e.e === "finish") { ctx.sfx[e.who === me ? "win" : "ding"](); ctx.toast(ctx.L(`${ctx.name(e.who)} finis ke-${e.place}! ${e.wpm} kata/menit`, `${ctx.name(e.who)} finished #${e.place}! ${e.wpm} wpm`)) }
        if (e.e === "result") ctx.sfx.whoosh()
      }
      head.replaceChildren(el("div", { class: "small muted", text: ctx.L(`Ronde ${v.round}/${v.rounds}`, `Round ${v.round}/${v.rounds}`) }),
        el("div", { class: "big-msg", text: v.phase === "ready" ? ctx.L("Siap… ketik secepatnya!", "Ready… type fast!") : v.phase === "play" ? ctx.L("KETIK! ⌨️", "TYPE! ⌨️") : ctx.L("Hasil ronde", "Round results") }))
      const len = v.target.length
      const ids = ctx.seats().map((s) => s.id)
      track.replaceChildren(...ids.map((pid, i) => {
        const p = Math.min(1, (v.prog[pid] || 0) / len)
        const d = v.done[pid] || (v.last && v.phase === "result" ? v.last.done[pid] : null)
        return el("div", { class: `kt-lane${pid === me ? " me" : ""}` },
          el("span", { class: "kt-name", text: `${ctx.player(pid).avatar} ${ctx.name(pid)}` }),
          el("span", { class: "kt-road" }, el("span", { class: "kt-car", style: { left: `calc(${(p * 100).toFixed(1)}% - ${p * 28}px)` }, text: CARS[i % CARS.length] })),
          el("span", { class: "kt-flag", text: d ? `🏁 ${d.wpm}` : "" }))
      }))
      if (v.phase === "ready") { text.replaceChildren(el("span", { class: "muted", text: v.text })); box.disabled = true }
      else paint()
      box.hidden = v.phase !== "play"
      note.textContent = v.phase === "play" ? ctx.L("Huruf besar & tanda baca tidak perlu.", "Capitals and punctuation aren't needed.")
        : v.phase === "result" && v.last ? Object.entries(v.last.pts).map(([p, n]) => `${ctx.name(p)} +${n}`).join(" · ") : ""
    },
  }
}
