// Gambar & Juri AI: everyone draws the same word; Gemini ranks the drawings with a comment.
import { avatar, el } from "../lib.js?v=__VERSION__"
import { createCanvas, toolbar } from "./canvas.js?v=__VERSION__"

export function mount(stage, ctx) {
  const catChip = (c) => (c ? el("div", { class: "cat-chip", text: `${c.icon} ${ctx.L(c.id, c.en)}` }) : null)
  const top = el("div", { class: "center" })
  const box = el("div")
  const tools = el("div")
  const bar = el("div", { class: "action-bar" })
  stage.append(top, box, tools, bar)
  let cv = null, round = -1, phase = "", timer = 0

  return {
    destroy() { cv && cv.destroy(); clearInterval(timer) },
    update(v, events) {
      const me = ctx.me.id
      for (const e of events) { if (e.e === "draw") ctx.sfx.turn(); if (e.e === "judged") ctx.sfx.win() }
      const changed = v.round !== round || v.phase !== phase
      round = v.round
      phase = v.phase
      if (v.phase !== "judging") clearInterval(timer)
      if (v.phase === "draw") {
        if (changed || !cv) {
          box.replaceChildren()
          cv = createCanvas(box, { editable: true, onStroke: (d) => ctx.raw({ t: "stroke", d }) })
          cv.load(v.mine)
          tools.replaceChildren(toolbar(cv))
        }
        const done = v.done.includes(me)
        cv.enabled = !done
        top.replaceChildren(el("div", { class: "small muted", text: ctx.L(`Ronde ${v.round}/${v.rounds} — gambarkan:`, `Round ${v.round}/${v.rounds} — draw:`) }), el("div", { class: "big-msg", text: v.word }), catChip(v.cat))
        bar.replaceChildren(done ? el("span", { class: "muted", text: ctx.L(`Selesai ✓ — menunggu ${ctx.seats().length - v.done.length} orang`, `Done ✓ — waiting for ${ctx.seats().length - v.done.length}`) })
          : el("button", { class: "btn teal", type: "button", text: ctx.L("Selesai menggambar ✓", "I'm done ✓"), onclick: () => ctx.send({ do: "done" }) }))
      } else if (v.phase === "judging") {
        if (cv) { cv.destroy(); cv = null }
        tools.replaceChildren()
        const wait = el("div", { class: "small muted", style: { marginTop: "8px" } })
        box.replaceChildren(el("div", { class: "q-card", style: { padding: "40px" } }, el("div", { class: "big-msg", text: "🤖🧐" }),
          el("div", { text: ctx.L("Juri AI sedang menilai gambar…", "The AI judge is looking at the drawings…") }), wait))
        // the free AI is sometimes busy: the server keeps retrying for up to ~30 s — show that it's still working
        clearInterval(timer)
        const t0 = v.judge_t0 ?? ctx.now()
        const tick = () => {
          const s = Math.max(0, Math.round(ctx.now() - t0))
          wait.textContent = s < 6 ? "" : ctx.L(`Juri lagi ramai, dicoba lagi… ${s} dtk (maks ±30)`, `The judge is busy, trying again… ${s} s (max ~30)`)
        }
        tick()
        timer = setInterval(tick, 1000)
        top.replaceChildren(el("div", { class: "big-msg", text: v.word }))
        bar.replaceChildren()
      } else if (v.phase === "result" && v.result) {
        if (cv) { cv.destroy(); cv = null }
        tools.replaceChildren()
        top.replaceChildren(el("div", { class: "small muted", text: ctx.L("Hasil juri untuk", "The judge's verdict for") }), el("div", { class: "big-msg", text: v.word }))
        const grid = el("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "12px" } })
        for (const r of v.result) {
          const tile = el("div", { class: "card", style: { padding: "10px", margin: 0 } })
          const cbox = el("div")
          tile.append(el("div", { class: "row between" }, el("b", { text: ["🥇", "🥈", "🥉"][r.rank - 1] || `#${r.rank}` }), el("span", {}, avatar(ctx.player(r.id)), " ", ctx.name(r.id))), cbox,
            el("div", { class: "small", style: { marginTop: "6px", fontWeight: 700 }, text: r.comment }),
            r.looks_like ? el("div", { class: "small muted", text: `${ctx.L("Mirip", "Looks like")}: ${r.looks_like}` }) : null,
            el("div", { class: "small", text: `+${r.pts}${r.score !== null && r.score !== undefined ? ` · ${r.score}/100` : ""}` }))
          grid.append(tile)
          const c = createCanvas(cbox, { editable: false })
          c.load(v.canvas[r.id] || [])
        }
        box.replaceChildren(grid)
        bar.replaceChildren()
      } else {
        top.replaceChildren(el("div", { class: "big-msg", text: ctx.L("Siap-siap menggambar…", "Get ready to draw…") }))
        box.replaceChildren()
      }
    },
  }
}
