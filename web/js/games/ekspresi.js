// Ekspresi Challenge: everyone takes a selfie acting out the challenge; the AI ranks the expressions.
import { el } from "../lib.js?v=__VERSION__"
import { cameraButton, photoUrl, privacyNote } from "./photokit.js?v=__VERSION__"

export function mount(stage, ctx) {
  const head = el("div", { class: "center" })
  const card = el("div", { class: "q-card fh-card" })
  const mineBox = el("div", { class: "center fh-mine" })
  const list = el("div", { class: "fh-list" })
  const gallery = el("div", { class: "fh-gallery" })
  let V = null, timer = 0
  const cam = cameraButton(ctx, { facing: "user", label: ctx.L("Ambil selfie!", "Take a selfie!"), round: () => V?.round })
  stage.append(head, card, cam.el, mineBox, list, gallery, privacyNote(ctx))
  let lastRound = -1

  return {
    destroy() { clearInterval(timer) },
    scores: (v) => v.scores,
    update(v, events) {
      V = v
      const me = ctx.me.id
      if (v.round !== lastRound) { lastRound = v.round; cam.hidePreview() }
      for (const e of events) {
        if (e.e === "go") ctx.sfx.turn()
        if (e.e === "judged") ctx.sfx.win()
      }
      head.replaceChildren(el("div", { class: "small muted", text: ctx.L(`Ronde ${v.round}/${v.rounds}`, `Round ${v.round}/${v.rounds}`) }))
      card.replaceChildren(el("div", { class: "small muted", text: ctx.L("🤪 Tantangan:", "🤪 Challenge:") }), el("div", { class: "q", text: ctx.L(v.item.id, v.item.en) }))
      const mine = v.sub[me] || {}
      cam.enabled = v.phase === "play" && mine.st !== "in"
      clearInterval(timer)
      mineBox.replaceChildren()
      if (v.phase === "ready") mineBox.append(el("div", { class: "big-msg", text: ctx.L("Siap-siap pasang gaya…", "Get your face ready…") }))
      if (v.phase === "play" && mine.st === "in") mineBox.append(el("div", { class: "fh-status ok", text: ctx.L("✅ Selfie masuk! Menunggu yang lain…", "✅ Selfie in! Waiting for the others…") }))
      if (v.phase === "judging") {
        const wait = el("div", { class: "small muted" })
        mineBox.append(el("div", { class: "fh-status wait" }, el("div", { class: "big-msg", text: "🤖🧐" }), el("div", { text: ctx.L("Juri AI sedang menilai ekspresi…", "The AI judge is looking at the faces…") }), wait))
        const t0 = v.judge_t0 ?? ctx.now()
        const tick = () => { const s = Math.round(ctx.now() - t0); wait.textContent = s < 6 ? "" : ctx.L(`Juri lagi ramai, dicoba lagi… ${s} dtk (maks ±30)`, `The judge is busy, trying again… ${s} s (max ~30)`) }
        tick()
        timer = setInterval(tick, 1000)
      }
      list.replaceChildren(...ctx.seats().map((s) => el("span", { class: "pill", text: `${s.avatar} ${s.name} ${(v.sub[s.id] || {}).st === "in" ? "✅" : "📷"}` })))
      gallery.replaceChildren()
      if (v.phase === "result" && v.result) {
        for (const r of v.result) {
          gallery.append(el("figure", { class: `fh-shot${r.rank === 1 && r.sent ? " best" : ""}` },
            r.sent ? el("img", { src: photoUrl(ctx, v.round, r.id), alt: "", loading: "lazy" }) : el("div", { class: "fh-empty", text: "🙈" }),
            el("figcaption", {}, el("b", { text: `${["🥇", "🥈", "🥉"][r.rank - 1] || `#${r.rank}`} ${ctx.player(r.id).avatar} ${ctx.name(r.id)} +${r.pts}${r.score != null ? ` · ${r.score}/100` : ""}` }),
              el("span", { text: r.sent ? r.comment : ctx.L("Tidak kirim selfie", "No selfie") }))))
        }
      }
    },
  }
}
