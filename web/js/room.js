// The live table: WebSocket connection, seats, turn/timer, chat, reactions, pause/resume, end screen.
import { $, api, avatar, confetti, el, icon, sheet, share, toast } from "./lib.js?v=__VERSION__"
import { L, RULES, gname, getLang } from "./i18n.js?v=__VERSION__"
import { isOn, sfx, toggle } from "./sound.js?v=__VERSION__"
import { go, state } from "./app.js?v=__VERSION__"
import { optionsForm } from "./lobby.js?v=__VERSION__"

let R = null  // the current room session

export function leaveRoom() {
  if (R) { R.closed = true; try { R.ws && R.ws.close() } catch (_) {} ; R.game && R.game.destroy && R.game.destroy(); clearInterval(R.timer); R = null }
}

const REACTIONS = ["😂", "😱", "🔥", "👏", "😭", "😡", "🤯", "😎", "🙏", "💀", "🥳", "❤️"]

export async function renderRoom(root, code) {
  leaveRoom()
  const me = state.me
  const s = R = { code, closed: false, ws: null, room: null, view: null, game: null, gameKey: null, clock: { srv: 0, at: 0, paused: true },
    chat: [], unread: 0, turnDeadline: null, lastTurnMine: false, retry: 0, ended: false, seq: 0 }

  // ---- layout -------------------------------------------------------------------------------------------
  const title = el("div", { class: "title", text: "…" })
  const codeTag = el("span", { class: "code", text: code })
  const soundBtn = el("button", { class: "icon-btn", type: "button", "aria-label": "Sound" }, icon(isOn() ? "sound" : "mute"))
  soundBtn.onclick = () => { const on = toggle(); soundBtn.replaceChildren(icon(on ? "sound" : "mute")) }
  const menuBtn = el("button", { class: "icon-btn", type: "button", "aria-label": "Menu" }, icon("menu"))
  const back = el("button", { class: "icon-btn", type: "button", "aria-label": "Back", onclick: () => go("lobby") }, icon("back"))
  const seatsBar = el("div", { class: "seats-bar" })
  const timerBar = el("div", { class: "timer-bar", hidden: true }, el("i"))
  const stage = el("div", { class: "stage" })
  const chatBtn = el("button", { class: "icon-btn", type: "button", "aria-label": "Chat" }, icon("chat"))
  const reactBtn = el("button", { class: "icon-btn", type: "button", "aria-label": "React" }, icon("smile"))
  const peek = el("div", { class: "chat-peek" })
  const overlay = el("div")
  root.replaceChildren(el("div", { class: "room" },
    el("div", { class: "room-top" }, back, title, codeTag, soundBtn, menuBtn), seatsBar, timerBar, stage),
    el("div", { class: "float-btns" }, reactBtn, chatBtn), peek, overlay)

  // ---- helpers -----------------------------------------------------------------------------------------
  const seat = (pid) => (s.room?.seats || []).find((x) => x.id === pid)
  const ctx = {
    me, code, L, sfx, toast,
    send: (a) => send({ t: "act", a }),
    raw: (m) => send(m),
    player: (pid) => seat(pid) || { id: pid, name: pid?.startsWith("bot") ? "Bot" : "?", avatar: "🤖", color: "#9aa5b1" },
    name: (pid) => ctx.player(pid).name,
    color: (pid) => ctx.player(pid).color,
    seats: () => s.room?.seats || [],
    now: () => (s.clock.paused ? s.clock.srv : s.clock.srv + (performance.now() - s.clock.at) / 1000),
    options: () => s.room?.options || {},
    isHost: () => s.room?.host === me.id,
  }

  window.__bg = { send: (a) => ctx.send(a), raw: (m) => send(m), view: () => s.view, room: () => s.room }  // for automated tests

  function send(m) {
    if (s.ws && s.ws.readyState === 1) s.ws.send(JSON.stringify(m))
    else toast(L("Menyambung ulang…", "Reconnecting…"), "bad")
  }

  // ---- menu ----------------------------------------------------------------------------------------------
  menuBtn.onclick = () => {
    const g = state.byKey[s.room?.game]
    const sh = sheet(L("Menu", "Menu"))
    sh.body.append(
      el("h3", { text: L("Cara main", "How to play") }), el("p", { class: "muted", text: (RULES[g?.key] || ["", ""])[getLang() === "en" ? 1 : 0] }),
      el("div", { class: "col" },
        el("button", { class: "btn", type: "button", onclick: () => share(L(`Ayo main ${gname(g)} di BashGames! Kode: ${code}`, `Join my ${gname(g)} game on BashGames! Code: ${code}`), `${location.origin}/#room/${code}`) },
          icon("share"), L("Ajak teman (WhatsApp)", "Invite friends")),
        ctx.isHost() && ["playing", "paused"].includes(s.room?.status) ? el("button", { class: "btn danger", type: "button",
          onclick: () => { if (confirm(L("Akhiri permainan sekarang? Skor saat ini jadi hasil akhir.", "End the game now? Current scores become final."))) { send({ t: "end" }); sh.close() } } },
          L("Akhiri permainan", "End game")) : null,
        el("button", { class: "btn ghost", type: "button", onclick: () => { sh.close(); go("lobby") } }, L("Kembali ke lobi", "Back to lobby"))))
  }

  // ---- chat & reactions ------------------------------------------------------------------------------------
  function showPeek(m) {
    const line = el("div", {}, `${m.name}: ${m.text}`)
    peek.append(line)
    while (peek.children.length > 3) peek.firstChild.remove()
    setTimeout(() => line.remove(), 5000)
  }
  function drawChatBadge() {
    chatBtn.replaceChildren(icon("chat"), s.unread ? el("span", { class: "dot", text: s.unread > 9 ? "9+" : s.unread }) : null)
  }
  chatBtn.onclick = () => {
    s.unread = 0
    drawChatBadge()
    const list = el("div", { class: "chat-list" })
    const draw = () => {
      list.replaceChildren(...s.chat.map((m) => el("div", { class: `chat-msg${m.from === me.id ? " me" : ""}` },
        avatar(ctx.player(m.from)), el("div", {}, el("div", { class: "who", text: m.name }), el("div", { class: "bubble", text: m.text })))))
      list.scrollTop = list.scrollHeight
    }
    draw()
    const input = el("input", { class: "input", maxlength: 300, placeholder: L("Tulis pesan…", "Say something…") })
    const sendBtn = el("button", { class: "icon-btn", type: "button" }, icon("send"))
    const doSend = () => { const t = input.value.trim(); if (t) { send({ t: "chat", text: t }); input.value = "" } }
    sendBtn.onclick = doSend
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") doSend() })
    const sh = sheet(L("Obrolan", "Chat"), { onClose: () => { s.chatDraw = null } })
    s.chatDraw = draw
    sh.body.append(list, el("div", { class: "row" }, input, sendBtn))
    setTimeout(() => input.focus(), 100)
  }
  reactBtn.onclick = () => {
    const sh = sheet(L("Reaksi", "React"))
    sh.body.append(el("div", { class: "react-row" }, REACTIONS.map((e) => el("button", { type: "button", text: e, onclick: () => { send({ t: "react", e }); sh.close() } }))))
  }
  function floatReaction(from, e) {
    const chip = seatsBar.querySelector(`[data-pid="${from}"]`)
    const r = chip ? chip.getBoundingClientRect() : { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0 }
    const f = el("div", { class: "react-float", text: e, style: { left: `${r.left + r.width / 2 - 19}px`, top: `${Math.max(60, r.top + 10)}px` } })
    document.body.append(f)
    setTimeout(() => f.remove(), 2300)
    sfx.boop()
  }

  // ---- seats bar + timer ----------------------------------------------------------------------------------
  function drawSeats() {
    const v = s.view || {}
    const turn = new Set([v.turn].concat(s.game?.turnIds ? s.game.turnIds(v) : []).filter(Boolean))
    const scores = s.game?.scores ? s.game.scores(v) : (v.scores || {})
    const fmt = s.game?.scoreFmt || ((x) => x)
    seatsBar.replaceChildren(...(s.room?.seats || []).map((p) => el("div", {
      class: `seat${turn.has(p.id) ? " turn" : ""}${p.online ? "" : " offline"}`, "data-pid": p.id },
    avatar(p), el("span", { text: p.name }), p.id === me.id ? el("span", { class: "me-tag", text: L("kamu", "you") }) : null,
    scores[p.id] !== undefined ? el("span", { class: "sc", text: fmt(scores[p.id], p.id) }) : null)))
  }
  s.timer = setInterval(() => {
    const v = s.view
    const bar = timerBar.firstChild
    let end = null, total = null
    if (s.room?.status === "playing" && v && !v.over) {
      if (s.turnDeadline && s.room.timer) { end = s.turnDeadline; total = s.room.timer }
      else if (v.deadline && (v.limit || v.phase)) { end = v.deadline; total = v.limit || 6 }
    }
    if (end === null) { timerBar.hidden = true; return }
    const left = end - ctx.now()
    timerBar.hidden = false
    bar.style.transform = `scaleX(${Math.max(0, Math.min(1, left / total))})`
    if (left > 0 && left < 5 && Math.floor(left * 2) !== s.lastTick) {
      s.lastTick = Math.floor(left * 2)
      if (s.turnMine || !s.turnDeadline) sfx.tick()
    }
  }, 100)

  // ---- lobby (inside the room) ---------------------------------------------------------------------------------
  function drawLobby() {
    const r = s.room
    const g = state.byKey[r.game]
    const mySeat = seat(me.id)
    const host = r.host === me.id
    const cards = []
    for (let i = 0; i < r.max; i++) {
      const p = r.seats[i]
      if (!p) { cards.push(el("div", { class: "seat-card empty" }, i < r.min ? L("Menunggu pemain…", "Waiting…") : L("Kursi kosong", "Open seat"))); continue }
      cards.push(el("div", { class: "seat-card" },
        g.teams && r.seats.length === 4 ? el("span", { class: `team pill ${p.team ? "warn" : "ok"}`, text: `Tim ${p.team ? "B" : "A"}` }) : null,
        host && p.id !== me.id ? el("button", { class: "icon-btn kick", type: "button", "aria-label": "Remove", onclick: () => send({ t: "kick", id: p.id }) }, icon("x")) : null,
        avatar(p, "big"), el("b", { text: p.name }),
        el("span", { class: `state ${p.id === r.host ? "" : p.ready ? "pill ok" : "pill"}`, text: p.id === r.host ? "👑 Host" : p.ready ? L("Siap ✓", "Ready ✓") : L("Belum siap", "Not ready") }),
        !p.online ? el("div", { class: "hint", text: "offline" }) : null))
    }
    const start = el("button", { class: "btn primary big wide", type: "button", text: L("Mulai!", "Start!"), onclick: () => send({ t: "start" }) })
    const ready = el("button", { class: `btn big wide ${mySeat?.ready ? "ghost" : "teal"}`, type: "button", text: mySeat?.ready ? L("Batal siap", "Not ready") : L("Aku siap!", "I'm ready!"), onclick: () => send({ t: "ready" }) })
    const sit = el("button", { class: "btn big wide teal", type: "button", text: L("Duduk & ikut main", "Take a seat"), onclick: () => send({ t: "sit" }) })
    const opts = el("div")
    if (host) {
      const f = optionsForm(g, r.options)
      const save = el("button", { class: "btn small", type: "button", text: L("Simpan pengaturan", "Save settings"), onclick: () => { send({ t: "options", options: f.values() }); toast(L("Tersimpan", "Saved")) } })
      opts.append(el("details", { class: "card" }, el("summary", { style: { fontWeight: 900, cursor: "pointer" }, text: `⚙️ ${L("Pengaturan permainan", "Game settings")}` }),
        el("div", { style: { marginTop: "12px" } }, f.node, save)))
    } else {
      const lines = g.options.map((o) => {
        const v = r.options[o.key] ?? o.default
        const choice = o.choices ? (o.choices.find((c) => c[0] === v) || []) : []
        const text = o.type === "multi" ? (v || []).length + " ✓" : o.type === "bool" ? (v ? "✓" : "—") : o.type === "text" ? (v || "—") : (getLang() === "en" ? choice[2] : choice[1]) ?? v
        return el("div", { class: "row between small" }, el("span", { class: "muted", text: getLang() === "en" ? o.label_en : o.label_id }), el("b", { text: String(text) }))
      })
      if (g.kind === "turn") lines.push(el("div", { class: "row between small" }, el("span", { class: "muted", text: L("Batas waktu giliran", "Turn timer") }), el("b", { text: r.timer ? `${r.timer}s` : L("mati", "off") })))
      opts.append(el("div", { class: "card" }, el("h3", { text: `⚙️ ${L("Pengaturan", "Settings")}` }), lines))
    }
    stage.replaceChildren(el("div", { class: "room-lobby" },
      el("div", { class: "invite-box" }, el("div", { class: "grow" }, el("div", { class: "muted small", text: L("Kode ruang", "Room code") }), el("div", { class: "code", text: r.code })),
        el("button", { class: "btn teal", type: "button", onclick: () => share(L(`Ayo main ${gname(g)} di BashGames! Kode: ${r.code}`, `Join my ${gname(g)} game on BashGames! Code: ${r.code}`), `${location.origin}/#room/${r.code}`) }, icon("share"), L("Ajak", "Invite"))),
      el("p", { class: "muted small center", text: `${r.mode === "santai" ? "🛋️ " + L("Mode santai: main kapan saja", "Play-later mode") : "⚡ Live"} · ${r.min === r.max ? r.min : `${r.min}–${r.max}`} ${L("pemain", "players")}` }),
      el("div", { class: "seat-cards" }, cards),
      mySeat ? (host ? start : ready) : (r.seats.length < r.max ? sit : el("p", { class: "center muted", text: L("Ruang penuh — kamu menonton.", "Room full — you're watching.") })),
      mySeat && !host ? el("button", { class: "link", type: "button", text: L("Berdiri (keluar kursi)", "Leave seat"), onclick: () => send({ t: "stand" }) }) : null,
      opts, el("div", { class: "card" }, el("h3", { text: L("Cara main", "How to play") }), el("p", { class: "muted", text: (RULES[g.key] || ["", ""])[getLang() === "en" ? 1 : 0] }))))
  }

  // ---- game mount -------------------------------------------------------------------------------------------------
  async function ensureGame() {
    const key = s.room.game
    if (s.game && s.gameKey === key) return
    s.game && s.game.destroy && s.game.destroy()
    s.gameKey = key
    const mod = await import(`./games/${key}.js?v=__VERSION__`)
    stage.replaceChildren()
    s.game = mod.mount(stage, ctx)
  }

  // ---- overlays ---------------------------------------------------------------------------------------------------
  function drawOverlay() {
    const r = s.room
    overlay.replaceChildren()
    if (!r) return
    if (r.status === "starting") {
      overlay.append(el("div", { class: "overlay" }, el("div", { class: "box" }, el("div", { class: "big-msg", text: "🎲" }),
        el("h2", { text: L("Menyiapkan permainan…", "Getting the game ready…") }),
        el("p", { class: "muted", text: L("Soal & kata disiapkan — maksimal ±10 detik. Soal AI yang belum siap akan menyusul di tengah permainan.", "Preparing questions and words — 10 s at most. AI questions that aren’t ready yet slip in during the game.") }))))
      return
    }
    if (r.status === "paused" && r.countdown > 0) {
      let n = Math.ceil(r.countdown)
      const num = el("div", { class: "countdown", text: n })
      overlay.append(el("div", { class: "overlay" }, num))
      sfx.tick()
      const t = setInterval(() => { n -= 1; if (n <= 0 || s.room.status !== "paused") { clearInterval(t); return } num.textContent = n; num.style.animation = "none"; void num.offsetWidth; num.style.animation = ""; sfx.tick() }, 1000)
      return
    }
    if (r.status === "paused") {
      const mine = seat(me.id)
      const readyNow = r.ready_resume.includes(me.id)
      const missing = r.seats.filter((p) => !p.online)
      overlay.append(el("div", { class: "overlay" }, el("div", { class: "box" },
        el("div", { class: "big-msg", text: "⏸️" }),
        el("h2", { text: missing.length ? L("Menunggu pemain kembali", "Waiting for players to come back") : L("Semua sudah kembali!", "Everyone's back!") }),
        el("p", { class: "muted", text: L("Permainan dijeda untuk semua. Semua tekan Siap untuk lanjut.", "The game is paused for everyone. Everyone taps Ready to continue.") }),
        el("div", { class: "wait-list" }, r.seats.map((p) => el("div", { class: "row" }, avatar(p), el("b", { class: "grow", text: p.name }),
          !p.online ? el("span", { class: "pill bad", text: L("terputus", "offline") }) : r.ready_resume.includes(p.id) ? el("span", { class: "pill ok", text: L("siap", "ready") }) : el("span", { class: "pill", text: L("belum", "waiting") }),
          ctx.isHost() && !p.online ? el("button", { class: "btn small ghost", type: "button", text: L("Lepas", "Drop"), onclick: () => { if (confirm(L(`Keluarkan ${p.name} dari permainan?`, `Remove ${p.name} from the game?`))) send({ t: "drop", id: p.id }) } }) : null))),
        mine ? el("button", { class: `btn big wide ${readyNow ? "ghost" : "primary"}`, type: "button", disabled: readyNow, text: readyNow ? L("Menunggu yang lain…", "Waiting for others…") : L("Siap lanjut!", "Ready!"), onclick: () => send({ t: "ready" }) }) : null)))
      return
    }
    if (r.status === "finished" && r.end) drawEnd(r.end)
  }

  function drawEnd(end) {
    const players = end.players || []
    const byRank = [...players].sort((a, b) => a.rank - b.rank)
    const iWon = players.some((p) => p.id === me.id && p.rank === 1)
    if (!s.ended) {
      s.ended = true
      if (iWon) { confetti(); sfx.win() } else if (players.some((p) => p.id === me.id)) sfx.lose()
    }
    const top = byRank.slice(0, 3)
    const order = [top[1], top[0], top[2]].filter(Boolean)
    const fmt = s.game?.scoreFmt || ((x) => x)
    const pod = el("div", { class: "podium" }, order.map((p) => {
      const place = p.rank === 1 ? "p1" : p.rank === 2 ? "p2" : "p3"
      return el("div", { class: `step ${place}` }, p.rank === 1 ? el("div", { class: "crown", text: "👑" }) : null, avatar(p, "big"),
        el("div", { class: "name", text: p.name }), el("div", { class: "block", text: p.rank }))
    }))
    const rest = byRank.slice(3).map((p) => el("div", { class: "row between", style: { padding: "6px 4px" } }, el("span", {}, `${p.rank}. `, p.name), el("b", { text: fmt(p.score, p.id) })))
    const aw = (end.awards || []).map((a) => el("div", { class: "award" }, el("span", { class: "em", text: a.emoji }),
      el("div", { class: "grow" }, el("b", { text: getLang() === "en" ? a.title_en : a.title_id }), el("div", { class: "small muted", text: `${ctx.name(a.id)} · ${a.value}` }))))
    const loser = byRank[byRank.length - 1]
    const r = s.room
    const iVoted = (r.rematch || []).includes(me.id)
    overlay.replaceChildren(el("div", { class: "overlay", style: { alignItems: "start", overflowY: "auto" } }, el("div", { class: "box", style: { marginTop: "4vh" } },
      el("h1", { text: iWon ? L("Kamu menang! 🎉", "You win! 🎉") : `${byRank[0]?.name || "?"} ${L("menang!", "wins!")}` }),
      pod,
      players.some((p) => p.score) ? [el("div", { class: "score-list" }, byRank.slice(0, 3).map((p) => el("div", { class: "row between" }, el("span", {}, avatar(p), " ", p.name), el("b", { text: fmt(p.score, p.id) })))),
      rest] : null,
      aw.length ? [el("h3", { style: { marginTop: "16px" }, text: `🏅 ${L("Penghargaan", "Awards")}` }), aw] : null,
      (end.roast_id && loser) ? el("p", { class: "roast", text: `${loser.name}: ${getLang() === "en" ? end.roast_en : end.roast_id}` }) : null,
      end.dare ? el("div", { class: "dare-card" }, el("div", { class: "small", text: `🎭 ${L("Tantangan untuk", "Dare for")} ${end.dare.name}` }),
        el("div", { style: { fontWeight: 900, fontSize: "18px" }, text: getLang() === "en" ? end.dare.text_en : end.dare.text_id })) : null,
      end.extra?.stacks ? el("p", { class: "small muted", text: L("Chip poker disimpan ke dompet harianmu.", "Poker chips were saved to your daily wallet.") }) : null,
      el("div", { class: "col", style: { marginTop: "14px" } },
        seat(me.id) ? el("button", { class: "btn primary big wide", type: "button", disabled: iVoted, text: iVoted ? L(`Menunggu yang lain… (${(r.rematch || []).length}/${r.seats.filter((p) => p.online).length})`, `Waiting for others… (${(r.rematch || []).length}/${r.seats.filter((p) => p.online).length})`) : L("Main lagi! 🔁", "Play again! 🔁"),
          onclick: () => send({ t: "rematch" }) }) : null,
        el("button", { class: "btn ghost wide", type: "button", text: L("Lihat papan", "See the board"), onclick: () => overlay.replaceChildren(el("button", { class: "btn primary", style: { position: "fixed", bottom: "80px", left: "50%", transform: "translateX(-50%)", zIndex: 70 }, text: L("Hasil", "Results"), onclick: () => drawEnd(end) })) }),
        el("button", { class: "btn ghost wide", type: "button", text: L("Kembali ke lobi", "Back to lobby"), onclick: () => go("lobby") })))))
  }

  // ---- messages ------------------------------------------------------------------------------------------------------
  async function onMessage(m) {
    if (m.t === "hello") { s.chat = m.chat || []; return }
    if (m.t === "room") {
      const prev = s.room
      s.room = m.room
      const g = state.byKey[s.room.game]
      title.textContent = `${g?.icon || ""} ${gname(g)}`
      if (s.room.status === "lobby") {
        s.ended = false
        if (s.game) { s.game.destroy && s.game.destroy(); s.game = null; s.gameKey = null }
        drawLobby()
      } else if (!s.game) {
        await ensureGame()
        if (s.view) s.game.update(s.view, [], ctx)
      }
      if (prev && prev.status !== s.room.status && s.room.status === "playing") sfx.turn()
      drawSeats()
      drawOverlay()
      return
    }
    if (m.t === "state") {
      if (m.seq < s.seq) return
      s.seq = m.seq
      s.clock = { srv: m.clock, at: performance.now(), paused: m.paused || s.room?.status !== "playing" }
      s.turnDeadline = m.turn_deadline
      s.view = m.view
      if (!m.view) return
      if (!s.game) await ensureGame()
      const turnMine = m.view.turn === me.id || (s.game.turnIds ? s.game.turnIds(m.view).includes(me.id) : false)
      if (turnMine && !s.turnMine && !m.view.over) sfx.turn()
      s.turnMine = turnMine
      try { s.game.update(m.view, m.events || [], ctx) } catch (e) { console.error(e) }
      drawSeats()
      return
    }
    if (m.t === "frame" && s.game?.onFrame) {
      s.clock = { srv: m.clock, at: performance.now(), paused: false }
      s.game.onFrame(m.f)
      return
    }
    if (m.t === "snap" && s.game?.onSnap) { s.game.onSnap(m.s); return }
    if (m.t === "stroke" && s.game?.onStroke) { s.game.onStroke(m.from, m.d); return }
    if (m.t === "chat") {
      s.chat.push(m.msg)
      if (s.chatDraw) s.chatDraw()
      else { s.unread++; drawChatBadge(); showPeek(m.msg) }
      if (m.msg.from !== me.id) sfx.blip()
      return
    }
    if (m.t === "react") { floatReaction(m.from, m.e); return }
    if (m.t === "error") { toast(m.error, "bad"); sfx.wrong(); return }
  }

  // ---- connection ------------------------------------------------------------------------------------------------------
  function connect() {
    if (s.closed) return
    const ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws/${code}`)
    s.ws = ws
    ws.onopen = () => { s.retry = 0 }
    ws.onmessage = (e) => { try { onMessage(JSON.parse(e.data)) } catch (err) { console.error(err) } }
    ws.onclose = (e) => {
      if (s.closed) return
      if (e.code === 4404) { toast(L("Ruang tidak ditemukan.", "Room not found."), "bad"); go("lobby"); return }
      if (e.code === 4401) { location.reload(); return }
      s.retry = Math.min(s.retry + 1, 6)
      setTimeout(connect, [300, 800, 1500, 3000, 5000, 8000][s.retry - 1])
    }
  }
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && s === R && (!s.ws || s.ws.readyState > 1)) connect()
  })
  connect()
  drawChatBadge()
  // Opening the room from a push/invite without an account seat still works: the server seats you in the lobby.
  api(`/rooms/${code}`).catch((e) => { if (e.status === 404) { toast(L("Ruang tidak ditemukan.", "Room not found."), "bad"); go("lobby") } })
}
