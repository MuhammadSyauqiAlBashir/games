// Karaoke Klasik: listen to the clip (synthesized on every phone at the same moment), then each player sings it.
// The singer's phone tracks the pitch every 50 ms; everyone sees the line move over the melody bars live.
import { el, svg } from "../lib.js?v=__VERSION__"
import { Mic, clicks, playSong, soundGate, unlocked } from "./audiokit.js?v=__VERSION__"

const DT = 0.05

export function mount(stage, ctx) {
  const head = el("div", { class: "center" })
  const gate = soundGate(ctx, { mic: true, onReady: () => replayIfListening() })
  const lane = svg("svg", { class: "ko-lane", viewBox: "0 0 100 40", preserveAspectRatio: "none" })
  const lyrics = el("div", { class: "ko-lyrics" })
  const big = el("div", { class: "ko-big" })
  const info = el("div", { class: "ko-info" })
  const table = el("div", { class: "ko-table" })
  stage.append(head, gate, el("div", { class: "ko-stage" }, lane, big), lyrics, info, table)
  let V = null, songKey = "", stopSong = null, raf = 0, mic = null, singKey = "", frames = [], sentI = 0, timer = 0, startedListen = ""

  // ---- drawing --------------------------------------------------------------------------------------------
  let geo = null
  function drawSong(song) {
    const ms = song.notes.map((n) => n[0])
    const lo = Math.min(...ms) - 3, hi = Math.max(...ms) + 3
    const total = song.notes.reduce((a, n) => a + n[1], 0)
    const beat = 60 / song.bpm
    geo = { lo, hi, secs: total * beat, beat }
    const y = (m) => 40 - ((m - lo) / (hi - lo)) * 40
    lane.replaceChildren()
    let t = 0
    for (const [m, b] of song.notes) {
      lane.append(svg("rect", { x: (t * beat / geo.secs) * 100, y: y(m) - 1.4, width: Math.max(0.6, (b * beat / geo.secs) * 100 - 0.4), height: 2.8, rx: 1.2, class: "ko-bar" }))
      t += b
    }
    lane.append(svg("polyline", { class: "ko-sung", points: "" }), svg("line", { class: "ko-head", x1: 0, x2: 0, y1: 0, y2: 40 }))
    geo.y = y
    // lyrics as syllables with their start times
    let tt = 0
    geo.syl = song.notes.map(([m, b, w]) => { const s = { t: tt * beat, len: b * beat, w, m }; tt += b; return s })
    lyrics.replaceChildren(...geo.syl.map((s) => el("span", { text: s.w.replace(/-$/, "") + (s.w.endsWith("-") ? "" : " ") })))
  }

  // the melody per 50 ms frame, to line the singer up with it
  function refAt(i) {
    const t = i * DT
    for (const s of geo.syl) if (t >= s.t && t < s.t + s.len) return s.m
    return null
  }
  // the singer's key: median pitch-class difference against the melody so far (so a lower voice still lands on the bars)
  function keyShift(f) {
    const d = []
    f.forEach((v, i) => { const r = v == null ? null : refAt(i); if (r != null) d.push((((r - v) % 12) + 18) % 12 - 6) })
    if (d.length < 6) return 0
    d.sort((a, b) => a - b)
    return Math.round(d[d.length >> 1])
  }

  function drawSung(f, refMid) {
    if (!geo) return
    const pts = []
    const k = keyShift(f)
    f.forEach((v, i) => {
      if (v == null) return
      const folded = v + k + 12 * Math.round((refMid - v - k) / 12)   // in the melody's key and octave
      pts.push(`${((i * DT) / geo.secs) * 100},${geo.y(folded).toFixed(2)}`)
    })
    lane.querySelector(".ko-sung").setAttribute("points", pts.join(" "))
  }

  function frame() {
    raf = requestAnimationFrame(frame)
    if (!V || !geo) return
    let t = null
    if (V.phase === "listen") t = ctx.now() - V.t0
    if (V.phase === "sing") t = ctx.now() - V.t0 - V.count_in
    const head = lane.querySelector(".ko-head")
    if (t == null || t < 0 || t > geo.secs + 0.3) { head.setAttribute("x1", -5); head.setAttribute("x2", -5) } else {
      const x = (t / geo.secs) * 100
      head.setAttribute("x1", x); head.setAttribute("x2", x)
    }
    const spans = lyrics.children
    for (let i = 0; i < geo.syl.length; i++) spans[i]?.classList.toggle("on", t != null && t >= geo.syl[i].t && (i + 1 >= geo.syl.length || t < geo.syl[i + 1].t))
    if (V.phase === "sing") {
      const c = V.t0 + V.count_in - ctx.now()
      big.textContent = c > 0 ? String(Math.ceil(c)) : ""
    } else if (V.phase !== "score") big.textContent = ""
  }
  raf = requestAnimationFrame(frame)

  // ---- listening ------------------------------------------------------------------------------------------
  function replayIfListening() {
    if (V && V.phase === "listen" && unlocked()) { stopSong && stopSong(); stopSong = playSong(ctx, V.song, V.t0); startedListen = `${V.round}` }
  }

  // ---- singing (my turn) ---------------------------------------------------------------------------------------
  async function singMine(v) {
    frames = []; sentI = 0
    try {
      mic = new Mic()
      await mic.start()
    } catch (e) {
      ctx.toast(e.message, "bad")
      ctx.send({ do: "skip" })
      return
    }
    clicks(ctx, v.t0, v.count_in, 1)
    const start = v.t0 + v.count_in, secs = v.song.seconds
    const refMid = (geo.lo + geo.hi) / 2
    timer = setInterval(() => {
      const t = ctx.now() - start
      if (t < 0) return
      const i = Math.floor(t / DT)
      while (frames.length <= i && frames.length * DT <= secs + 0.6) frames.push(frames.length === i ? mic.pitch() : null)
      if (frames.length - sentI >= 8) { ctx.send({ do: "live", i: sentI, f: frames.slice(sentI).map((x) => x == null ? null : +x.toFixed(1)) }); sentI = frames.length }
      drawSung(frames, refMid)
      if (t > secs + 0.6) finishMine()
    }, 25)
  }
  function finishMine() {
    clearInterval(timer); timer = 0
    if (mic) { mic.stop(); mic = null }
    ctx.send({ do: "sung", f: frames.map((x) => x == null ? null : +x.toFixed(1)) })
  }

  return {
    destroy() { cancelAnimationFrame(raf); clearInterval(timer); mic && mic.stop(); stopSong && stopSong() },
    scores: (v) => v.scores,
    update(v, events) {
      V = v
      const me = ctx.me.id
      const key = `${v.round}:${v.song.id}`
      if (key !== songKey) { songKey = key; drawSong(v.song) }
      for (const e of events) {
        if (e.e === "listen") { if (unlocked()) { stopSong && stopSong(); stopSong = playSong(ctx, v.song, v.t0); startedListen = `${v.round}` } }
        if (e.e === "scored") ctx.sfx[e.score >= 75 ? "win" : e.score >= 45 ? "ding" : "groan"]()
      }
      if (v.phase === "listen" && startedListen !== `${v.round}` && unlocked()) replayIfListening()
      const singer = v.singer
      head.replaceChildren(el("div", { class: "small muted", text: ctx.L(`Lagu ${v.round}/${v.rounds}`, `Song ${v.round}/${v.rounds}`) }),
        el("div", { class: "big-msg", text: `🎵 ${v.song.title}` }))
      const sk = `${v.round}:${singer}:${v.phase}`
      if (v.phase === "sing" && sk !== singKey) {
        singKey = sk
        lane.querySelector(".ko-sung").setAttribute("points", "")
        if (singer === me) singMine(v)
      }
      if (v.phase === "sing" && singer !== me) drawSung(v.live || [], (geo.lo + geo.hi) / 2)
      info.className = "ko-info"
      if (v.phase === "intro") info.textContent = ctx.L("Siap-siap dengarkan lagunya… 🎧", "Get ready to listen… 🎧")
      else if (v.phase === "listen") info.textContent = unlocked() ? ctx.L("Dengarkan dan hafalkan nadanya! 👂", "Listen and remember the tune! 👂") : ctx.L("Nyalakan suara dulu ☝️", "Turn on sound first ☝️")
      else if (v.phase === "sing") {
        info.textContent = singer === me ? ctx.L("🎤 GILIRANMU! Nyanyi saat hitungan habis", "🎤 YOUR TURN! Sing when the count ends") : ctx.L(`🎤 ${ctx.name(singer)} sedang bernyanyi…`, `🎤 ${ctx.name(singer)} is singing…`)
        if (singer === me) info.className = "ko-info mine"
      } else if (v.phase === "score" && v.last) {
        const L = v.last
        big.textContent = `${L.score}`
        drawSung(L.f || [], (geo.lo + geo.hi) / 2)
        info.replaceChildren(el("b", { text: `${ctx.player(L.who).avatar} ${ctx.name(L.who)}: ${L.score}/100` }), el("div", { text: ctx.L(L.comment, L.comment_en) }),
          el("div", { class: "small muted", text: ctx.L(`nada ${L.pitch}% · terisi ${L.cover}%${L.shift ? ` · nada dasar ${L.shift > 0 ? "+" : ""}${L.shift}` : ""}`,
            `pitch ${L.pitch}% · covered ${L.cover}%${L.shift ? ` · key ${L.shift > 0 ? "+" : ""}${L.shift}` : ""}`) }))
      } else if (v.phase === "result") info.textContent = ctx.L("Hasil lagu ini", "This song's results")
      const rows = Object.entries(v.res || {}).sort((a, b) => b[1].score - a[1].score)
      table.replaceChildren(...rows.map(([p, r], i) => el("div", { class: `ko-row${p === me ? " me" : ""}` },
        el("span", { text: `${["🥇", "🥈", "🥉"][i] || "🎤"} ${ctx.player(p).avatar} ${ctx.name(p)}` }), el("b", { text: `${r.score}` }))))
    },
  }
}
