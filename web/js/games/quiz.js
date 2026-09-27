// Trivia (multiple choice), Matematika (typed numbers) and Tebak Gambar Kata / rebus (typed words).
import { avatar, el, svg } from "../lib.js?v=__VERSION__"

const LEVEL = { 1: ["Mudah", "Easy", "×1"], 2: ["Sedang", "Medium", "×2"], 3: ["Sulit", "Hard", "×3"], 4: ["Ahli", "Expert", "×5"] }

export function rebusSvg(elements) {
  const g = svg("svg", { viewBox: "0 0 100 100", style: "width:100%;max-width:320px;height:auto;display:block;margin:0 auto" })
  g.append(svg("rect", { x: 1, y: 1, width: 98, height: 98, rx: 8, fill: "#fffdf8", stroke: "#e5d9c8" }))
  for (const e of elements || []) {
    const style = e.style || ""
    const x = Number(e.x ?? 50), y = Number(e.y ?? 50), size = Number(e.size || 16) * (style === "big" ? 1.6 : style === "small" ? .5 : 1)
    const color = /^#[0-9a-f]{3,8}$/i.test(e.color || "") ? e.color : "#2b2622"
    if (style === "line") { g.append(svg("line", { x1: 18, y1: y, x2: 82, y2: y, stroke: color, "stroke-width": 1.4, "stroke-linecap": "round" })); continue }
    if (style === "box") { g.append(svg("rect", { x: 26, y: 30, width: 48, height: 48, rx: 2, fill: "none", stroke: color, "stroke-width": 1.4 })); continue }
    if (style === "circle") { g.append(svg("circle", { cx: x, cy: y, r: 22, fill: "none", stroke: color, "stroke-width": 1.4 })); continue }
    let rot = Number(e.rotate || 0)
    if (style === "up") rot -= 90
    if (style === "down") rot += 90
    const tr = [`translate(${x} ${y})`, rot ? `rotate(${rot})` : "", style === "mirror" ? "scale(-1 1)" : ""].join(" ")
    const t = svg("text", { x: 0, y: size * .35, "text-anchor": "middle", "font-size": size, "font-weight": style === "bold" || style === "big" ? 900 : 800,
      fill: color, "font-family": "Nunito, sans-serif", transform: tr, text: e.t || "" })
    g.append(t)
    if (style === "strike") g.append(svg("line", { x1: x - size * .35 * (e.t || "").length * .6, y1: y, x2: x + size * .35 * (e.t || "").length * .6, y2: y, stroke: "#c9503f", "stroke-width": 1.2 }))
  }
  return g
}

export function mountQuiz(stage, ctx, kind) {
  const card = el("div")
  const answers = el("div")
  const others = el("div", { class: "row wrap", style: { justifyContent: "center", margin: "10px 0" } })
  const foot = el("div", { class: "row between", style: { marginTop: "8px" } })
  stage.append(card, answers, others, foot)
  let lastI = -1, input = null, V = null, hintTimer = null

  function report(i) {
    const reason = prompt(ctx.L("Apa yang salah? (opsional)", "What's wrong? (optional)"), "") ?? null
    if (reason === null) return
    ctx.send({ do: "report", i, reason })
    ctx.toast(ctx.L("Terima kasih! Soal ini tidak dihitung dan tidak dipakai lagi.", "Thanks! This question won't count and won't be used again."))
  }

  function draw(v, events) {
    const lang = ctx.L("id", "en")
    const q = v.q
    const lv = LEVEL[v.level] || LEVEL[1]
    if (v.phase === "intro") {
      card.replaceChildren(el("div", { class: "q-card", style: { padding: "40px 18px" } },
        el("div", { class: `q-level lv${v.level}`, text: `${ctx.L("Fase", "Phase")}: ${lv[lang === "en" ? 1 : 0]} ${lv[2]}` }),
        el("div", { class: "big-msg", text: v.i < 0 ? ctx.L("Siap-siap!", "Get ready!") : ctx.L("Makin sulit, makin banyak poin!", "Harder — more points!") })))
      answers.replaceChildren(); others.replaceChildren(); foot.replaceChildren()
      return
    }
    if (!q) return
    const voided = v.void.includes(v.i)
    const head = el("div", { class: "row between" }, el("span", { class: `q-level lv${q.level}`, text: `${lv[lang === "en" ? 1 : 0]} ${lv[2]}` }),
      el("span", { class: "small muted", text: `${v.i + 1}/${v.n}` }))
    const body = []
    if (kind === "rebus") body.push(rebusSvg(q.elements), el("div", { class: "small muted", style: { marginTop: "6px" }, text: `${q.words.length} ${ctx.L("kata", "word(s)")}: ${q.words.map((n) => "_".repeat(n)).join(" ")}` }))
    else {
      if (q.flag && (q.topic === "flags")) body.push(el("img", { src: `/flags/${q.flag}.svg`, alt: "flag", style: { width: "70%", maxWidth: "260px", margin: "4px auto 10px", borderRadius: "8px", boxShadow: "var(--shadow)" } }))
      body.push(el("div", { class: "q", text: q.q }))
      if (q.unit) body.push(el("div", { class: "small muted", text: `(${q.unit})` }))
    }
    if (v.phase === "reveal") {
      const ans = kind === "trivia" ? q.choices[q.answer] : q.answer
      body.push(el("div", { style: { marginTop: "12px", fontWeight: 900, fontSize: "20px", color: "var(--ok)" }, text: `✓ ${ans}` }))
      if (q.explain) body.push(el("div", { class: "small muted", text: q.explain }))
      if (voided) body.push(el("div", { class: "pill warn", text: ctx.L("Dilaporkan — tidak dihitung", "Reported — doesn't count") }))
    }
    card.replaceChildren(el("div", { class: "q-card" }, head, body))

    const mine = v.mine || {}
    answers.replaceChildren()
    if (kind === "trivia") {
      answers.append(el("div", { class: "choices" }, q.choices.map((c, k) => {
        let cls = `choice c${k}`
        if (v.phase === "reveal") cls += k === q.answer ? " right" : mine.c === k ? " wrong picked" : " wrong"
        else if (mine.c === k) cls += " picked"
        return el("button", { class: cls, type: "button", disabled: v.phase !== "question" || mine.final,
          onclick: () => { ctx.sfx.click(); ctx.send({ c: k }) } }, el("span", { class: "k", text: "ABCD"[k] }), el("span", { text: c }))
      })))
    } else if (v.phase === "question" && !mine.final) {
      if (!input || lastI !== v.i) {
        input = el("input", { inputmode: kind === "math" && !/hari|day/i.test(q.q) ? "decimal" : "text", autocomplete: "off", autocapitalize: "off", spellcheck: "false",
          placeholder: kind === "math" ? ctx.L("Jawaban…", "Answer…") : ctx.L("Tebakanmu…", "Your guess…"), maxlength: 80 })
        input.addEventListener("keydown", (e) => { if (e.key === "Enter") submit() })
      }
      const submit = () => { const t = input.value.trim(); if (!t) return; ctx.send({ text: t }); input.value = "" }
      answers.append(el("div", { class: "answer-row" }, input, el("button", { class: "btn primary big", type: "button", text: "OK", onclick: submit })),
        mine.tries ? el("div", { class: "center small muted", style: { marginTop: "6px" }, text: kind === "math" ? ctx.L(`Salah — sisa ${3 - mine.tries} kesempatan`, `Wrong — ${3 - mine.tries} tries left`) : ctx.L("Belum tepat, coba lagi!", "Not yet — try again!") }) : null)
      if (kind === "rebus" && v.hints) {
        const now = ctx.now()
        const h = []
        if (now >= v.hints.at[0] && v.hints.hint) h.push(`💡 ${v.hints.hint}`)
        if (now >= v.hints.at[1]) h.push(`🔤 ${v.hints.letters}`)
        if (h.length) answers.append(el("div", { class: "center", style: { marginTop: "8px", fontWeight: 800 }, text: h.join("  ·  ") }))
      }
      if (lastI !== v.i) setTimeout(() => input && input.focus(), 50)
    } else if (mine.final) {
      answers.append(el("div", { class: "center big-msg", style: { color: mine.ok ? "var(--ok)" : "var(--bad)" },
        text: mine.ok ? `✓ +${mine.pts}` : ctx.L("✗ Tidak tepat", "✗ Not this time") }))
    }
    lastI = v.i
    others.replaceChildren(...ctx.seats().map((p) => {
      const a = v.answered[p.id]
      const tag = v.phase === "reveal" ? (a?.ok ? "✅" : "❌") : a?.done ? "✔️" : "…"
      return el("span", { class: "seat", style: { padding: "3px 10px 3px 3px" } }, avatar(p), el("span", { text: tag }))
    }))
    foot.replaceChildren(el("span"), el("button", { class: "report-btn", type: "button", onclick: () => report(v.i) }, "⚑ ", ctx.L("Soal salah?", "Wrong question?")))
    void events
  }

  hintTimer = setInterval(() => { if (V && kind === "rebus" && V.phase === "question") draw(V, []) }, 1000)
  return {
    destroy() { clearInterval(hintTimer) },
    update(v, events) {
      for (const e of events) {
        if (e.e === "right" && e.who === ctx.me.id) ctx.sfx.right()
        if (e.e === "wrong") { ctx.sfx.wrong(); card.classList.remove("shake"); void card.offsetWidth; card.classList.add("shake") }
        if (e.e === "right" && e.who !== ctx.me.id) ctx.sfx.blip()
        if (e.e === "question") ctx.sfx.pop()
        if (e.e === "level") ctx.sfx.turn()
        if (e.e === "report" && e.who !== ctx.me.id) ctx.toast(ctx.L(`${ctx.name(e.who)} melaporkan soal ini`, `${ctx.name(e.who)} reported this question`))
      }
      if (kind === "rebus" && V && V.i === v.i && v.phase === "question" && JSON.stringify(V.mine) === JSON.stringify(v.mine) && JSON.stringify(V.answered) === JSON.stringify(v.answered)) {
        V = v
        return
      }
      V = v
      draw(v, events)
    },
  }
}
