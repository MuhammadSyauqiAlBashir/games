// Trivia (multiple choice), Matematika (typed numbers) and Tebak Gambar Kata / rebus (typed words).
import { avatar, el, svg } from "../lib.js?v=__VERSION__"

const LEVEL = { 1: ["Mudah", "Easy", "×1"], 2: ["Sedang", "Medium", "×2"], 3: ["Sulit", "Hard", "×3"], 4: ["Ahli", "Expert", "×5"] }

export function rebusSvg(elements) {
  const g = svg("svg", { viewBox: "0 0 100 100", style: "width:100%;max-width:min(320px, 36dvh);height:auto;display:block;margin:0 auto" })
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
  let lastI = -1, V = null, hintTimer = null, cardKey = null
  const typed = {
    input: el("input", { type: "text", autocomplete: "off", autocapitalize: "off", autocorrect: "off", spellcheck: "false", enterkeyhint: "send", maxlength: 80 }),
    tries: el("div", { class: "center small muted", style: { marginTop: "6px" } }),
    hints: el("div", { class: "center", style: { marginTop: "8px", fontWeight: 800 } }),
    result: el("div", { class: "center big-msg" }),
    tts: el("div", { class: "tts" }),
  }
  let ttsWords = []
  // TTS boxes (Cak Lontong): show the letter count and fill in as you type.
  function drawTTS() {
    const letters = typed.input.value.toUpperCase().replace(/[^A-Z0-9]/g, "")
    let k = 0
    typed.tts.replaceChildren(...ttsWords.map((n) => el("div", { class: "tts-word" }, Array.from({ length: n }, () => el("span", { class: "tts-box", text: letters[k++] || "" })))))
  }
  typed.input.addEventListener("input", () => { if (kind === "lontong") drawTTS() })
  const submit = () => { const t = typed.input.value.trim(); if (!t || typed.row.classList.contains("waiting")) return; ctx.send({ text: t }); typed.input.value = ""; typed.input.focus() }
  typed.input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); submit() } })
  // pointerdown + preventDefault keeps the keyboard open while tapping OK
  const okBtn = el("button", { class: "btn primary big", type: "button", text: "OK", onclick: submit })
  okBtn.addEventListener("pointerdown", (e) => { if (document.activeElement === typed.input) e.preventDefault() })
  typed.row = el("div", { class: "answer-row" }, typed.input, okBtn)

  // Letter tiles for picture riddles (like the Tebak Gambar app): answer boxes + a pool of shuffled letters.
  const tiles = (() => {
    const boxes = el("div", { class: "tb-boxes" }), pool = el("div", { class: "tb-pool" })
    const hintBtn = el("button", { class: "btn small", type: "button", onclick: () => { if (V && V.phase === "question") { ctx.sfx.click(); ctx.send({ do: "reveal" }) } } }, "💡 ", ctx.L("Buka huruf (−30%)", "Open a letter (−30%)"))
    const backBtn = el("button", { class: "btn small", type: "button", text: "⌫", onclick: () => undo() })
    const root = el("div", { class: "tb" }, boxes, pool, el("div", { class: "row", style: { justifyContent: "center", gap: "8px", marginTop: "8px" } }, hintBtn, backBtn))
    let qi = -2, slots = [], used = new Set(), words = [], letters = "", locked = {}, sent = false, revMap = {}
    const L = () => slots.length
    function reset(v, q) {
      qi = v.i; words = q.words; letters = q.pool || ""
      slots = Array(words.reduce((a, b) => a + b, 0)).fill(null)
      used = new Set(); locked = {}; sent = false
    }
    function applyRevealed(v) {
      for (const [k, ch] of Object.entries(v.revealed || {})) {
        const i = Number(k)
        if (locked[i] !== undefined) continue
        if (slots[i] !== null && slots[i] !== undefined) { used.delete(slots[i]); slots[i] = null }
        let p = [...letters].findIndex((c, j) => c === ch && !used.has(j))
        if (p < 0) p = -1 - i
        locked[i] = p; slots[i] = p
        if (p >= 0) used.add(p)
      }
    }
    function text() {
      const chars = slots.map((p, i) => (p === null ? "" : p < 0 ? revMap[String(i)] || "" : letters[p]))
      let k = 0
      return words.map((n) => chars.slice(k, (k += n)).join("")).join(" ")
    }
    function put(p) {
      if (!V || V.phase !== "question" || (V.mine || {}).final || used.has(p)) return
      const i = slots.findIndex((x) => x === null)
      if (i < 0) return
      slots[i] = p; used.add(p); ctx.sfx.click()
      render()
      if (slots.every((x) => x !== null) && !sent) { sent = true; ctx.send({ text: text() }) }
    }
    function take(i) {
      if (locked[i] !== undefined || slots[i] === null) return
      used.delete(slots[i]); slots[i] = null; sent = false; ctx.sfx.pop(); render()
    }
    function undo() { for (let i = L() - 1; i >= 0; i--) if (slots[i] !== null && locked[i] === undefined) { take(i); return } }
    function wrong() {
      boxes.classList.remove("mp-shake"); void boxes.offsetWidth; boxes.classList.add("mp-shake")
      setTimeout(() => { for (let i = 0; i < L(); i++) if (locked[i] === undefined && slots[i] !== null) { used.delete(slots[i]); slots[i] = null } sent = false; render() }, 450)
    }
    function render() {
      boxes.replaceChildren()
      let k = 0
      for (const n of words) {
        const w = el("div", { class: "tb-word" })
        for (let j = 0; j < n; j++, k++) {
          const i = k, p = slots[i]
          const ch = p === null ? "" : p < 0 ? revMap[String(i)] || "" : letters[p]
          w.append(el("button", { class: `tb-box${p !== null ? " full" : ""}${locked[i] !== undefined ? " lock" : ""}`, type: "button", text: ch, onclick: () => take(i) }))
        }
        boxes.append(w)
      }
      pool.replaceChildren(...[...letters].map((c, j) => el("button", { class: `tb-tile${used.has(j) ? " used" : ""}`, type: "button", text: c, onclick: () => put(j) })))
      const asking = V && V.phase === "question" && !(V.mine || {}).final
      root.classList.toggle("waiting", !asking)
      hintBtn.disabled = !asking
    }
    return {
      root, wrong,
      draw(v, q, mine) {
        if (v.i !== qi) reset(v, q)
        if (v.phase === "reveal" && q.answer) {
          const flat = [...q.answer.toUpperCase().replace(/ /g, "")]
          slots = flat.map((_, i) => -1 - i); locked = {}
          revMap = Object.fromEntries(flat.map((c, i) => [String(i), c]))
        } else { revMap = v.revealed || {}; applyRevealed(v) }
        render()
        void mine
      },
    }
  })()

  function showHints(v) {
    const h = []
    if ((kind === "rebus" || kind === "lontong") && v.hints && v.phase === "question" && !(v.mine || {}).final) {
      const now = ctx.now()
      if (now >= v.hints.at[0] && v.hints.hint) h.push(`💡 ${v.hints.hint}`)
      if (now >= v.hints.at[1]) h.push(`🔤 ${v.hints.letters}`)
    }
    const text = h.join("  ·  ")
    if (typed.hints.textContent !== text) typed.hints.textContent = text
    typed.hints.hidden = !text
  }

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
      if (kind === "trivia") answers.replaceChildren()
      else { typed.result.hidden = typed.tries.hidden = typed.hints.hidden = true; typed.row.classList.add("waiting"); typed.input.placeholder = ctx.L("Siap-siap…", "Get ready…") }
      others.replaceChildren(); foot.replaceChildren(); cardKey = null
      return
    }
    if (!q) return
    const voided = v.void.includes(v.i)
    const head = el("div", { class: "row between" }, el("span", { class: `q-level lv${q.level}`, text: `${lv[lang === "en" ? 1 : 0]} ${lv[2]}` }),
      el("span", { class: "small muted", text: `${v.i + 1}/${v.n}` }))
    const body = []
    if (kind === "rebus") body.push(rebusSvg(q.elements))
    else {
      if (q.flag && (q.topic === "flags")) body.push(el("img", { src: `/flags/${q.flag}.svg`, alt: "flag", style: { width: "70%", maxWidth: "260px", margin: "4px auto 10px", borderRadius: "8px", boxShadow: "var(--shadow)" } }))
      if (kind === "lontong") body.push(el("div", { class: "lt-badge", text: "🥸 Cak Lontong Quiz" }))
      body.push(el("div", { class: "q", text: q.q }))
      if (q.unit) body.push(el("div", { class: "small muted", text: `(${q.unit})` }))
    }
    if (v.phase === "reveal") {
      const ans = kind === "trivia" ? q.choices[q.answer] : q.answer
      body.push(el("div", { style: { marginTop: "12px", fontWeight: 900, fontSize: "20px", color: "var(--ok)" }, text: `✓ ${ans}` }))
      if (kind === "lontong") body.push(el("div", { class: "lt-mikir", text: "MIKIR! 🤔" }), el("div", { class: "lt-explain", text: q.explain || "" }))
      else if (q.explain) body.push(el("div", { class: "small muted", text: q.explain }))
      if (voided) body.push(el("div", { class: "pill warn", text: ctx.L("Dilaporkan — tidak dihitung", "Reported — doesn't count") }))
    }
    const key = JSON.stringify([v.i, v.phase, voided, ctx.L("id", "en")])
    if (key !== cardKey) { cardKey = key; card.replaceChildren(el("div", { class: "q-card" }, head, body)) }

    const mine = v.mine || {}
    // The typed-answer row is created once and never detached: removing a focused input closes the phone keyboard.
    if (kind === "trivia") {
      answers.replaceChildren(el("div", { class: "choices" }, q.choices.map((c, k) => {
        let cls = `choice c${k}`
        if (v.phase === "reveal") cls += k === q.answer ? " right" : mine.c === k ? " wrong picked" : " wrong"
        else if (mine.c === k) cls += " picked"
        return el("button", { class: cls, type: "button", disabled: v.phase !== "question" || mine.final,
          onclick: () => { ctx.sfx.click(); ctx.send({ c: k }) } }, el("span", { class: "k", text: "ABCD"[k] }), el("span", { text: c }))
      })))
    } else if (kind === "rebus") {
      tiles.draw(v, q, mine)
      if (!answers.contains(tiles.root)) answers.replaceChildren(typed.result, tiles.root, typed.hints)
      showHints(v)
      typed.result.hidden = !mine.final
      if (mine.final) {
        typed.result.style.color = mine.ok ? "var(--ok)" : "var(--bad)"
        typed.result.textContent = mine.ok ? `✓ +${mine.pts}` : ctx.L("✗ Tidak tepat", "✗ Not this time")
      }
    } else {
      if (!answers.contains(typed.row)) answers.replaceChildren(...(kind === "lontong" ? [typed.result, typed.tts] : [typed.result]), typed.row, typed.tries, typed.hints)
      if (kind === "lontong") { ttsWords = q.words || []; drawTTS() }
      // The row stays on screen between questions so a phone keyboard that is open stays open.
      const asking = v.phase === "question" && !mine.final
      typed.row.hidden = false
      typed.row.classList.toggle("waiting", !asking)
      typed.input.inputMode = kind === "math" && !/hari|day/i.test(q.q) ? "decimal" : "text"
      typed.input.placeholder = asking ? (kind === "math" ? ctx.L("Jawaban…", "Answer…") : ctx.L("Tebakanmu…", "Your guess…"))
        : ctx.L("Tunggu soal berikutnya…", "Wait for the next question…")
      if (lastI !== v.i && v.phase === "question") { typed.input.value = ""; if (!matchMedia("(pointer: coarse)").matches || document.activeElement === typed.input) setTimeout(() => typed.input.focus(), 50) }
      typed.tries.hidden = !(asking && mine.tries)
      typed.tries.textContent = kind === "math" ? ctx.L(`Salah — sisa ${3 - mine.tries} kesempatan`, `Wrong — ${3 - mine.tries} tries left`) : ctx.L("Belum tepat, coba lagi!", "Not yet — try again!")
      showHints(v)
      typed.result.hidden = !mine.final
      if (mine.final) {
        typed.result.style.color = mine.ok ? "var(--ok)" : "var(--bad)"
        typed.result.textContent = mine.ok ? `✓ +${mine.pts}` : ctx.L("✗ Tidak tepat", "✗ Not this time")
      }
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

  hintTimer = setInterval(() => { if (V && (kind === "rebus" || kind === "lontong") && V.phase === "question") showHints(V) }, 1000)
  return {
    destroy() { clearInterval(hintTimer) },
    update(v, events) {
      for (const e of events) {
        if (e.e === "right" && e.who === ctx.me.id) ctx.sfx.right()
        if (e.e === "wrong") { ctx.sfx.wrong(); card.classList.remove("shake"); void card.offsetWidth; card.classList.add("shake"); if (kind === "rebus") tiles.wrong() }
        if (e.e === "revealed") ctx.sfx.pop()
        if (e.e === "trap") { ctx.sfx.buzz(); ctx.toast(ctx.L(`“${e.text}”? Itu jawaban orang normal! 🤓 MIKIR!`, `“${e.text}”? That's what a normal person says! 🤓 THINK!`)); typed.input.value = ""; drawTTS() }
        if (e.e === "right" && e.who !== ctx.me.id) ctx.sfx.blip()
        if (e.e === "question") ctx.sfx.pop()
        if (e.e === "level") ctx.sfx.turn()
        if (e.e === "report" && e.who !== ctx.me.id) ctx.toast(ctx.L(`${ctx.name(e.who)} melaporkan soal ini`, `${ctx.name(e.who)} reported this question`))
      }
      V = v
      draw(v, events)
    },
  }
}
