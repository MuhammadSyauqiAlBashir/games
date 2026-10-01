// Refleks Kilat: one big tap area. The phone measures your reaction from the moment the signal is drawn on
// your own screen, so a slow connection doesn't cost you. Tapping before the signal is a false start.
import { el } from "../lib.js?v=__VERSION__"

export function mount(stage, ctx) {
  const head = el("div", { class: "center" })
  const pad = el("button", { class: "rk-pad", type: "button" })
  const big = el("div", { class: "rk-big" })
  const sub = el("div", { class: "rk-sub" })
  pad.append(big, sub)
  const board = el("div", { class: "rk-board" })
  stage.append(head, pad, board)
  let V = null, raf = 0, goAt = null, answered = false, roundKey = "", shownIdx = -1, myMs = null

  function instruction(rd) {
    if (rd.k === "green") return [ctx.L("Tap saat layar jadi HIJAU", "Tap when it turns GREEN"), "🟢"]
    if (rd.k === "target") return [ctx.L(`Tap saat ${rd.target} muncul — jangan yang lain!`, `Tap when ${rd.target} appears — nothing else!`), rd.target]
    return [ctx.L("Tap saat KATA dan WARNANYA sama", "Tap when the WORD matches its COLOUR"), "🎨"]
  }

  pad.addEventListener("pointerdown", (e) => {
    e.preventDefault()
    if (!V || V.phase !== "run" || answered) return
    answered = true
    if (goAt === null) {
      ctx.send({ do: "false", r: V.round })
      ctx.sfx.buzz()
      pad.className = "rk-pad false"
      big.textContent = ctx.L("Kecepetan! ❌", "Too soon! ❌")
      sub.textContent = ctx.L("Tunggu sinyalnya dulu", "Wait for the signal")
      return
    }
    myMs = Math.round(performance.now() - goAt)
    ctx.send({ do: "tap", r: V.round, ms: myMs })
    ctx.sfx.pop()
    pad.className = "rk-pad done"
    big.textContent = `${myMs} ms`
    sub.textContent = myMs < 250 ? ctx.L("Kilat! ⚡", "Lightning! ⚡") : myMs < 400 ? ctx.L("Cepat!", "Quick!") : ctx.L("Lumayan", "Not bad")
  })

  const frame = () => {
    raf = requestAnimationFrame(frame)
    if (!V || V.phase !== "run" || answered) return
    const rd = V.rd
    const t = ctx.now() - V.t0
    if (rd.k === "green") {
      if (t >= rd.go && goAt === null) {
        goAt = performance.now()
        pad.className = "rk-pad go"
        big.textContent = ctx.L("TAP!", "TAP!")
        sub.textContent = ""
      } else if (goAt === null) {
        pad.className = "rk-pad wait"
        big.textContent = ctx.L("Tunggu…", "Wait…")
        sub.textContent = ""
      }
      return
    }
    let idx = -1
    for (let i = 0; i < rd.seq.length; i++) if (t >= rd.seq[i][0]) idx = i
    if (idx === shownIdx) return
    shownIdx = idx
    pad.className = "rk-pad seq"
    if (idx < 0) { big.textContent = "…"; big.style.color = ""; sub.textContent = instruction(rd)[0]; return }
    if (rd.k === "target") {
      big.textContent = rd.seq[idx][1]
      big.style.color = ""
      big.classList.remove("pulse"); void big.offsetWidth; big.classList.add("pulse")
    } else {
      const [, w, ink] = rd.seq[idx]
      big.textContent = ctx.L(rd.colors[w][0], rd.colors[w][1])
      big.style.color = rd.colors[ink][2]
    }
    sub.textContent = ""
    if (idx === rd.seq.length - 1 && goAt === null) goAt = performance.now()
  }
  raf = requestAnimationFrame(frame)

  return {
    destroy() { cancelAnimationFrame(raf) },
    scores: (v) => v.scores,
    update(v, events) {
      V = v
      const key = `${v.round}:${v.phase}`
      if (key !== roundKey) {
        roundKey = key
        if (v.phase === "ready" || v.phase === "run") {
          if (v.phase === "ready") { answered = false; myMs = null }
          goAt = null; shownIdx = -1
          big.style.color = ""
        }
      }
      for (const e of events) { if (e.e === "run") ctx.sfx.turn(); if (e.e === "result") ctx.sfx.whoosh() }
      const [txt, em] = instruction(v.rd)
      head.replaceChildren(el("div", { class: "small muted", text: ctx.L(`Ronde ${v.round}/${v.rounds}`, `Round ${v.round}/${v.rounds}`) }),
        el("div", { class: "rk-instr", text: txt }))
      if (v.phase === "ready") {
        pad.className = "rk-pad ready"
        big.textContent = em
        big.style.color = ""
        sub.textContent = ctx.L("Siap-siap…", "Get ready…")
      }
      if (v.phase === "run" && answered && v.res[ctx.me.id] === undefined) { /* waiting for the server */ }
      // board: this round's times, then totals
      const res = v.phase === "result" && v.last ? v.last.res : v.res
      const rows = Object.entries(res || {}).sort((a, b) => (a[1][0] === "ok" ? a[1][1] : 1e9) - (b[1][0] === "ok" ? b[1][1] : 1e9))
      const pts = v.phase === "result" && v.last ? v.last.pts : {}
      board.replaceChildren(
        rows.length ? el("div", { class: "rk-times" }, rows.map(([p, [kind, ms]]) => el("div", { class: `rk-row${p === ctx.me.id ? " me" : ""}` },
          el("span", { text: `${ctx.player(p).avatar} ${ctx.name(p)}` }),
          el("b", { text: kind === "ok" ? `${ms} ms` : ctx.L("curi start", "false start") }),
          pts[p] ? el("span", { class: "pill ok", text: `+${pts[p]}` }) : el("span")))) : null,
        el("p", { class: "small muted center", text: Object.entries(v.best || {}).length
          ? ctx.L("Rekor tercepat: ", "Best times: ") + Object.entries(v.best).sort((a, b) => a[1] - b[1]).map(([p, ms]) => `${ctx.name(p)} ${ms} ms`).join(" · ") : "" }))
    },
  }
}
