// Foto Hunt: find the thing, snap it, the AI checks it. First accepted photo wins the most points.
import { el } from "../lib.js?v=__VERSION__"
import { cameraButton, photoUrl, privacyNote } from "./photokit.js?v=__VERSION__"

export function mount(stage, ctx) {
  const head = el("div", { class: "center" })
  const card = el("div", { class: "q-card fh-card" })
  const mineBox = el("div", { class: "center fh-mine" })
  const list = el("div", { class: "fh-list" })
  const gallery = el("div", { class: "fh-gallery" })
  let V = null
  const cam = cameraButton(ctx, { facing: "environment", label: ctx.L("Foto sekarang!", "Snap it!"), round: () => V?.round })
  stage.append(head, card, cam.el, mineBox, list, gallery, privacyNote(ctx))
  let lastRound = -1

  return {
    scores: (v) => v.scores,
    update(v, events) {
      V = v
      const me = ctx.me.id
      if (v.round !== lastRound) { lastRound = v.round; cam.hidePreview() }
      for (const e of events) {
        if (e.e === "go") ctx.sfx.turn()
        if (e.e === "ok") { ctx.sfx[e.who === me ? "win" : "ding"](); if (e.who !== me) ctx.toast(ctx.L(`${ctx.name(e.who)} dapat! (ke-${e.place})`, `${ctx.name(e.who)} found it! (#${e.place})`)) }
        if (e.e === "no" && e.who === me) ctx.sfx.buzz()
        if (e.e === "reveal") ctx.sfx.whoosh()
      }
      const it = v.item
      head.replaceChildren(el("div", { class: "small muted", text: ctx.L(`Ronde ${v.round}/${v.rounds}`, `Round ${v.round}/${v.rounds}`) }))
      card.replaceChildren(el("div", { class: "small muted", text: ctx.L("📸 Cari dan foto:", "📸 Find and photograph:") }), el("div", { class: "q", text: ctx.L(it.id, it.en) }))
      const mine = v.sub[me] || {}
      const playing = v.phase === "play"
      cam.enabled = playing && !["ok", "pending"].includes(mine.st) && (mine.n || 0) < v.max_tries
      cam.setLabel(mine.st === "no" ? ctx.L(`Coba lagi (${v.max_tries - mine.n} lagi)`, `Try again (${v.max_tries - mine.n} left)`) : ctx.L("Foto sekarang!", "Snap it!"))
      mineBox.replaceChildren(
        mine.st === "pending" ? el("div", { class: "fh-status wait", text: ctx.L("🤖 Juri AI sedang mengecek fotomu…", "🤖 The AI is checking your photo…") }) : null,
        mine.st === "ok" ? el("div", { class: "fh-status ok" }, el("b", { text: ctx.L(`✅ Diterima! +${mine.pts}`, `✅ Accepted! +${mine.pts}`) }), el("div", { text: mine.comment || "" })) : null,
        mine.st === "no" ? el("div", { class: "fh-status no" }, el("b", { text: ctx.L("❌ Belum pas", "❌ Not quite") }), el("div", { text: `${mine.what ? `(${mine.what}) ` : ""}${mine.comment || ""}` })) : null,
        v.phase === "ready" ? el("div", { class: "big-msg", text: ctx.L("Siap-siap…", "Get ready…") }) : null)
      list.replaceChildren(...ctx.seats().map((s) => {
        const d = v.sub[s.id] || {}
        const st = d.st === "ok" ? `✅ ${v.order.indexOf(s.id) + 1}` : d.st === "pending" ? "⏳" : d.st === "no" ? "❌" : "🔍"
        return el("span", { class: "pill", text: `${s.avatar} ${s.name} ${st}` })
      }))
      gallery.replaceChildren()
      if (v.phase === "reveal" || v.over) {
        const ids = v.order
        if (!ids.length) gallery.append(el("p", { class: "muted center", text: ctx.L("Tidak ada yang berhasil ronde ini 😅", "Nobody made it this round 😅") }))
        for (const pid of ids) {
          const d = v.sub[pid] || {}
          gallery.append(el("figure", { class: "fh-shot" }, el("img", { src: photoUrl(ctx, v.round, pid), alt: "", loading: "lazy" }),
            el("figcaption", {}, el("b", { text: `${ctx.player(pid).avatar} ${ctx.name(pid)} +${d.pts || 0}` }), el("span", { text: d.comment || "" }))))
        }
      }
    },
  }
}
