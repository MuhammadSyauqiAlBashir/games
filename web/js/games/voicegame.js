// Shared screen for the recorded voice games (Nyanyi Lagu Hits, Tiru Suara): DJ picks the song (hits only) →
// everyone hears the original → each player records in turn → all recordings play back → AI verdict or a vote.
import { el } from "../lib.js?v=__VERSION__"
import { Mic, audioCtx, clicks, loadClip, playAt, sliceToWav, soundGate, unlocked } from "./audiokit.js?v=__VERSION__"

const url = (ctx, r, who) => `/api/rooms/${ctx.code}/audio/${r}/${who}`

async function upload(ctx, r, slot, blob) {
  const res = await fetch(`/api/rooms/${ctx.code}/audio?r=${r}&slot=${slot}`, { method: "POST", headers: { "X-BG": "1", "Content-Type": "audio/wav" }, body: blob, credentials: "same-origin" })
  if (!res.ok) {
    let msg = `${res.status}`
    try { msg = (await res.json()).detail || msg } catch { /* not json */ }
    throw new Error(msg)
  }
}

export function mountVoice(stage, ctx, { task }) {
  const head = el("div", { class: "center" })
  const gate = soundGate(ctx, { mic: true, onReady: () => V && sync(V, []) })
  const card = el("div", { class: "q-card vg-card" })
  const panel = el("div", { class: "vg-panel" })
  const list = el("div", { class: "vg-list" })
  stage.append(head, gate, card, panel, list)
  let V = null, mic = null, recKey = "", timer = 0, playKey = "", stops = [], prepKey = "", prepNode = null, picked = null, judgeTimer = 0

  const stopAll = () => { for (const s of stops) s(); stops = [] }
  const clipUrl = (pid) => url(ctx, V.round, pid)

  // ---- DJ: choose the original clip ----------------------------------------------------------------------
  function prepPanel(v) {
    const title = el("input", { type: "text", maxlength: 80, value: v.title || "", placeholder: ctx.L("Judul lagu – penyanyi", "Song title – artist"), class: "vg-input" })
    title.addEventListener("change", () => ctx.send({ do: "title", t: title.value }))
    const file = el("input", { type: "file", accept: "audio/*", hidden: true })
    const status = el("div", { class: "small muted" })
    const slider = el("input", { type: "range", min: 0, max: 0, step: 0.5, value: 0, hidden: true, class: "vg-range" })
    const len = 10
    const btnFile = el("button", { class: "btn", type: "button", text: ctx.L("📁 Pilih file lagu", "📁 Pick a song file"), onclick: () => file.click() })
    const btnHear = el("button", { class: "btn", type: "button", text: ctx.L("▶ Dengar potongan", "▶ Preview"), hidden: true })
    const btnUse = el("button", { class: "btn teal", type: "button", text: ctx.L("✅ Pakai potongan ini", "✅ Use this part"), hidden: true })
    const btnRec = el("button", { class: "btn", type: "button", text: ctx.L("🎙️ Rekam dari speaker (10 dtk)", "🎙️ Record from a speaker (10 s)") })
    const btnGo = el("button", { class: "btn primary big", type: "button", text: ctx.L("Mulai ▶", "Start ▶"),
      onclick: () => { if (title.value !== v.title) ctx.send({ do: "title", t: title.value }); setTimeout(() => ctx.send({ do: "go" }), 150) } })
    let preview = null
    file.onchange = async () => {
      const f = file.files && file.files[0]
      if (!f) return
      status.textContent = ctx.L("Membaca lagu…", "Reading the song…")
      try {
        picked = await new Promise((res, rej) => f.arrayBuffer().then((b) => audioCtx().decodeAudioData(b, res, rej)))
        slider.max = Math.max(0, Math.floor(picked.duration - len))
        slider.value = Math.min(+slider.max, Math.round(picked.duration * 0.35))
        slider.hidden = btnHear.hidden = btnUse.hidden = false
        if (!title.value) { title.value = f.name.replace(/\.[^.]+$/, "").slice(0, 80); ctx.send({ do: "title", t: title.value }) }
        status.textContent = ctx.L(`Geser untuk memilih bagian reff (mulai ${slider.value} dtk)`, `Slide to the chorus (starts at ${slider.value} s)`)
      } catch { status.textContent = ctx.L("File ini tidak bisa diputar", "Can't play this file") }
    }
    slider.oninput = () => { status.textContent = ctx.L(`Mulai di detik ${slider.value}`, `Starts at ${slider.value} s`) }
    btnHear.onclick = () => {
      if (!picked) return
      preview && preview()
      const src = audioCtx().createBufferSource()
      src.buffer = picked
      src.connect(audioCtx().destination)
      src.start(0, +slider.value, len)
      preview = () => { try { src.stop() } catch { /* done */ } }
    }
    btnUse.onclick = async () => {
      if (!picked) return
      preview && preview()
      status.textContent = ctx.L("Mengirim…", "Sending…")
      try { await upload(ctx, v.round, "ref", sliceToWav(picked, +slider.value, len)); status.textContent = ctx.L("✅ Potongan lagu siap!", "✅ Clip ready!") } catch (e) { status.textContent = e.message }
    }
    btnRec.onclick = async () => {
      try {
        const m = new Mic()
        await m.start()
        m.startRec(11)
        let left = 10
        btnRec.disabled = true
        status.textContent = ctx.L("🔴 Merekam… putar lagunya di HP/speaker lain dekat mikrofon", "🔴 Recording… play the song on another phone/speaker near the mic")
        const iv = setInterval(() => { left--; btnRec.textContent = `🔴 ${left}` }, 1000)
        await new Promise((r) => setTimeout(r, 10000))
        clearInterval(iv)
        const wav = m.stopRec()
        m.stop()
        btnRec.disabled = false
        btnRec.textContent = ctx.L("🎙️ Rekam ulang", "🎙️ Record again")
        await upload(ctx, v.round, "ref", wav)
        status.textContent = ctx.L("✅ Potongan lagu siap!", "✅ Clip ready!")
      } catch (e) { status.textContent = e.message; btnRec.disabled = false }
    }
    return el("div", { class: "vg-prep" }, title, el("div", { class: "row wrap", style: { justifyContent: "center", gap: "8px" } }, btnFile, btnRec), file,
      slider, el("div", { class: "row wrap", style: { justifyContent: "center", gap: "8px" } }, btnHear, btnUse), status,
      el("p", { class: "small muted", text: ctx.L("Tanpa klip juga boleh: tulis judulnya saja, semua menyanyi dari ingatan.", "No clip is fine too: just the title, everyone sings from memory.") }), btnGo)
  }

  // ---- recording (my turn) -------------------------------------------------------------------------------------
  async function recordMine(v) {
    try {
      mic = new Mic()
      await mic.start()
    } catch (e) { ctx.toast(e.message, "bad"); ctx.send({ do: "skip" }); return }
    clicks(ctx, v.t0, v.count_in, 1)
    const start = v.t0 + v.count_in
    let started = false
    timer = setInterval(async () => {
      const t = ctx.now() - start
      if (t >= 0 && !started) { started = true; mic.startRec(v.rec + 0.5) }
      const meter = panel.querySelector(".vg-meter i")
      if (meter && mic) meter.style.width = `${Math.min(100, mic.level * 400)}%`
      const cd = panel.querySelector(".vg-count")
      if (cd) cd.textContent = t < 0 ? String(Math.ceil(-t)) : `🔴 ${Math.max(0, Math.ceil(v.rec - t))}`
      if (t >= v.rec) {
        clearInterval(timer); timer = 0
        const wav = mic.stopRec()
        mic.stop(); mic = null
        try { await upload(ctx, v.round, "me", wav) } catch (e) { ctx.toast(e.message, "bad") }
      }
    }, 50)
  }

  // ---- playback of everyone's clips at the shared moment ----------------------------------------------------------
  async function playAll(v) {
    stopAll()
    let t = v.t0
    for (const pid of v.order) {
      if (!v.clips.includes(pid)) continue
      const at = t
      t += v.lens[pid] + 1
      loadClip(clipUrl(pid)).then((buf) => { if (V && V.phase === "play") stops.push(playAt(ctx, buf, at)) }).catch(() => {})
    }
  }

  function replayBtn(pid) {
    return el("button", { class: "btn small", type: "button", text: "▶", onclick: async () => {
      stopAll()
      try { const b = await loadClip(clipUrl(pid)); stops.push(playAt(ctx, b, ctx.now())) } catch { ctx.toast(ctx.L("Rekaman tidak ada", "No recording"), "bad") }
    } })
  }

  function sync(v, events) {
    const me = ctx.me.id
    for (const e of events) {
      if (e.e === "rec" && e.who === me) ctx.sfx.turn()
      if (e.e === "result") ctx.sfx.fanfare()
    }
    // the original clip: everyone hears it together
    if (v.phase === "listen" && v.ref && unlocked() && playKey !== `L${v.round}`) {
      playKey = `L${v.round}`
      stopAll()
      loadClip(clipUrl("ref")).then((b) => { if (V?.phase === "listen") stops.push(playAt(ctx, b, v.t0)) }).catch(() => {})
    }
    if (v.phase === "play" && unlocked() && playKey !== `P${v.round}`) { playKey = `P${v.round}`; playAll(v) }
    if (!["listen", "play"].includes(v.phase) && playKey && !playKey.startsWith("R")) { playKey = ""; stopAll() }
    const rk = `${v.round}:${v.performer}`
    if (v.phase === "rec" && v.performer === me && rk !== recKey) { recKey = rk; recordMine(v) }
  }

  function render(v) {
    const me = ctx.me.id
    head.replaceChildren(el("div", { class: "small muted", text: ctx.L(`Ronde ${v.round}/${v.rounds}`, `Round ${v.round}/${v.rounds}`) }))
    const t = task(v)
    card.replaceChildren(el("div", { class: "small muted", text: t.label }), el("div", { class: "q", text: t.text }),
      v.lyrics ? el("div", { class: "vg-lyrics", text: `🎶 ${v.lyrics}` }) : null)
    clearInterval(judgeTimer)
    panel.replaceChildren()
    if (v.phase === "prep") {
      // built once per round and kept: rebuilding would lose the chosen file and the slider position
      if (v.dj === me) { const k = `${v.round}`; if (prepKey !== k) { prepKey = k; picked = null; prepNode = prepPanel(v) } panel.append(prepNode) }
      else panel.append(el("div", { class: "fh-status wait", text: ctx.L(`🎧 ${ctx.name(v.dj)} sedang memilih lagu…`, `🎧 ${ctx.name(v.dj)} is picking a song…`) }),
        v.ref ? el("div", { class: "small center", text: ctx.L("Klip lagu sudah siap ✅", "Song clip ready ✅") }) : null)
    } else if (v.phase === "listen") panel.append(el("div", { class: "big-msg", text: unlocked() ? "🎧 👂" : ctx.L("Nyalakan suara ☝️", "Turn on sound ☝️") }))
    else if (v.phase === "rec") {
      if (v.performer === me) panel.append(el("div", { class: "vg-rec" }, el("div", { class: "vg-count big-msg", text: "3" }),
        el("div", { class: "vg-meter" }, el("i")), el("div", { text: t.doIt }),
        el("button", { class: "btn small ghost", type: "button", text: ctx.L("Lewati", "Skip"), onclick: () => { clearInterval(timer); mic && mic.stop(); mic = null; ctx.send({ do: "skip" }) } })))
      else panel.append(el("div", { class: "fh-status wait", text: ctx.L(`🎙️ ${ctx.name(v.performer)} sedang merekam…`, `🎙️ ${ctx.name(v.performer)} is recording…`) }))
    } else if (v.phase === "play") {
      panel.append(el("div", { class: "big-msg", text: unlocked() ? ctx.L("🔊 Dengarkan semua!", "🔊 Listen to everyone!") : ctx.L("Nyalakan suara ☝️", "Turn on sound ☝️") }))
    } else if (v.phase === "judging") {
      const w = el("div", { class: "small muted" })
      panel.append(el("div", { class: "fh-status wait" }, el("div", { class: "big-msg", text: "🤖👂" }), el("div", { text: ctx.L("Juri AI sedang mendengarkan…", "The AI judge is listening…") }), w))
      const tick = () => { const s = Math.round(ctx.now() - (v.judge_t0 ?? ctx.now())); w.textContent = s < 10 ? "" : ctx.L(`${s} dtk… kalau juri sibuk, kalian yang memilih`, `${s} s… if the judge is busy, you'll vote`) }
      tick(); judgeTimer = setInterval(tick, 1000)
    } else if (v.phase === "vote") {
      panel.append(el("div", { class: "fh-status" }, el("b", { text: ctx.L("Juri AI sibuk — kalian yang menilai! Pilih yang terbaik:", "The AI judge is busy — you decide! Pick the best:") }),
        el("div", { class: "vg-votes" }, v.clips.map((p) => el("div", { class: "vg-vote" }, replayBtn(p),
          el("span", { text: `${ctx.player(p).avatar} ${ctx.name(p)}` }),
          el("button", { class: `btn small ${v.my_vote === p ? "teal" : "primary"}`, type: "button", disabled: !!v.my_vote || (p === me && v.clips.length > 1),
            text: v.my_vote === p ? "✓" : ctx.L("Pilih", "Pick"), onclick: () => ctx.send({ do: "vote", pid: p }) }))))))
    } else if (v.phase === "result" && v.result) {
      panel.append(...v.result.map((r) => el("div", { class: `vg-res${r.rank === 1 ? " best" : ""}` },
        el("div", { class: "row between" }, el("b", { text: `${["🥇", "🥈", "🥉"][r.rank - 1] || `#${r.rank}`} ${ctx.player(r.id).avatar} ${ctx.name(r.id)}` }),
          el("span", {}, replayBtn(r.id), el("span", { class: "pill ok", text: `+${r.pts}` }))),
        el("div", { class: "small", text: r.by === "vote" ? ctx.L(`${r.votes} suara`, `${r.votes} votes`) : `${r.score}/100 · ${r.comment}` }))))
      if (!v.result.length) panel.append(el("p", { class: "muted center", text: ctx.L("Tidak ada rekaman ronde ini", "No recordings this round") }))
    } else if (v.phase === "intro") panel.append(el("div", { class: "big-msg", text: ctx.L("Siap-siap…", "Get ready…") }))
    list.replaceChildren(...v.order.map((p) => el("span", { class: `pill${v.performer === p ? " warn" : ""}`, text: `${ctx.player(p).avatar} ${ctx.name(p)} ${v.clips.includes(p) ? "✅" : v.performer === p ? "🎙️" : ""}` })))
  }

  return {
    destroy() { clearInterval(timer); clearInterval(judgeTimer); mic && mic.stop(); stopAll() },
    scores: (v) => v.scores,
    update(v, events) {
      V = v
      sync(v, events)
      render(v)
    },
  }
}
