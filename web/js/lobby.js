import { api, avatar, busy, el, sheet, toast } from "./lib.js?v=__VERSION__"
import { L, RULES, TINT, gname, getLang } from "./i18n.js?v=__VERSION__"
import { sfx } from "./sound.js?v=__VERSION__"
import { go, state } from "./app.js?v=__VERSION__"

export async function renderLobby(page) {
  const [rooms, players] = await Promise.all([api("/rooms"), api("/players")])
  const me = state.me
  const code = el("input", { maxlength: 4, placeholder: "KODE", autocapitalize: "characters", "aria-label": L("Kode ruang", "Room code") })
  const join = el("button", { class: "btn primary", type: "button", text: L("Gabung", "Join") })
  join.onclick = () => { const c = code.value.trim().toUpperCase(); if (c.length === 4) go(`room/${c}`); else toast(L("Kode 4 huruf", "4-letter code"), "bad") }
  code.addEventListener("keydown", (e) => { if (e.key === "Enter") join.click() })

  const roomItem = (r, fresh) => {
    const g = state.byKey[r.game]
    const status = r.status === "lobby" ? L(`menunggu pemain · ${r.players.length}/${g?.max ?? "?"}`, `waiting · ${r.players.length}/${g?.max ?? "?"}`)
      : r.status === "paused" ? L("dijeda", "paused") : r.mode === "santai" ? L("santai", "play-later") : L("berlangsung", "in play")
    return el("a", { class: `room-item${fresh ? " fresh" : ""}`, href: `#room/${r.code}` }, el("span", { class: "gi", text: g?.icon || "🎲" }),
      el("span", { class: "grow" }, el("b", { text: gname(g) }), el("br"),
        el("small", { class: "muted", text: `${r.code} · ${status}` })),
      r.your_turn ? el("span", { class: "pill warn", text: L("Giliranmu!", "Your turn!") }) : null,
      el("span", { class: "avatars" }, r.players.map((p) => avatar(p))))
  }

  // Rooms + friends update live (pushed over /ws/lobby): a new room pops in on everyone's phone.
  const roomsBox = el("div")
  const friendsBox = el("div", { class: "card", style: { padding: "12px" } })
  let showAll = false, known = null
  function drawRooms(list) {
    const mine = list.filter((r) => r.seated && r.status !== "finished")
    const open = list.filter((r) => !r.seated && r.status === "lobby")
    const isNew = (r) => known && !known.has(r.code)
    const mineList = el("div", { class: "room-list" }, (showAll ? mine : mine.slice(0, 5)).map((r) => roomItem(r, isNew(r))))
    if (mine.length > 5 && !showAll) mineList.append(el("button", { class: "link", type: "button", text: L(`Lihat semua (${mine.length})`, `Show all (${mine.length})`),
      onclick: () => { showAll = true; drawRooms(list) } }))
    if (known && open.some(isNew)) sfx.pop()
    known = new Set(list.map((r) => r.code))
    roomsBox.replaceChildren(
      mine.length ? [el("div", { class: "section-title" }, el("h2", { text: L("Ruang kamu", "Your rooms") })), mineList] : null,
      open.length ? [el("div", { class: "section-title" }, el("h2", {}, L("Ruang terbuka", "Open rooms"), el("span", { class: "live-dot", title: "live" }))),
        el("div", { class: "room-list" }, open.map((r) => roomItem(r, isNew(r))))] : null)
  }
  let people = players.players
  function drawFriends(online) {
    if (online) people = people.map((p) => ({ ...p, online: online.has(p.id) }))
    friendsBox.replaceChildren(el("div", { class: "players-online" }, people.map((p) =>
      el("div", { class: "p" }, el("span", { class: "av", style: { "--c": p.color, position: "relative" } }, p.avatar, el("i", { class: `online-dot${p.online ? " on" : ""}` })),
        el("span", { text: p.name })))),
      people.length <= 1 ? el("p", { class: "muted small", text: L("Teman muncul di sini setelah mereka masuk sekali.", "Friends show up here after they log in once.") }) : null)
  }
  drawRooms(rooms.rooms)
  drawFriends()
  liveLobby(page, (m) => {
    drawRooms(m.rooms)
    const ids = new Set(m.online)
    if (m.online.some((id) => !people.find((p) => p.id === id))) api("/players").then((r) => { people = r.players; drawFriends(ids) }).catch(() => {})
    else drawFriends(ids)
  })

  page.append(
    el("div", { class: "topbar" }, el("a", { class: "logo", href: "#lobby" }, el("span", { class: "mark", text: "🎲" }), "BashGames"),
      el("a", { href: "#profile", style: { textDecoration: "none" } }, avatar(me, "big"))),
    el("div", { class: "hero-card" }, el("span", { class: "deco", text: "🎉" }),
      el("h1", { text: L(`Hai, ${me.name}!`, `Hi, ${me.name}!`) }),
      el("p", { text: L("Pilih permainan untuk bikin ruang, atau masukkan kode dari teman.", "Pick a game to open a room, or enter a friend's code.") }),
      el("div", { class: "join-row" }, code, join)),
    el("button", { class: "ck-entry", type: "button", onclick: () => go("cook") }, el("span", { class: "big", text: "🍳" }),
      el("span", {}, el("b", { text: "Wok & Roll" }), el("small", { text: L("Karier masak 3D — bistro steak & warung tenda!", "3D cooking career — steak bistro & tent warung!") })),
      el("span", { class: "go", text: L("Main ▶", "Play ▶") })),
    roomsBox,
    el("div", { class: "section-title" }, el("h2", { text: L("Teman", "Friends") })),
    friendsBox,
    state.categories.map((cat) => [
      el("div", { class: "section-title" }, el("h2", { text: getLang() === "en" ? cat.en : cat.id })),
      el("div", { class: "game-grid" }, cat.games.map((k) => state.byKey[k]).filter(Boolean).map((g) =>
        el("button", { class: "game-tile", type: "button", style: { "--tint": TINT[g.key] }, onclick: () => createRoom(g) },
          el("span", { class: "gi", text: g.icon }),
          el("span", {}, el("b", { text: gname(g) }), el("small", { text: `${g.min === g.max ? g.min : `${g.min}–${g.max}`} ${L("pemain", "players")}` }))))),
    ]))
}

// The home page's live connection: reconnects after a drop or when the phone wakes up; closes itself once the
// page is gone (another tab of the app was opened).
function liveLobby(page, onMsg) {
  let ws = null, retry = 0, timer = 0, ping = 0
  const alive = () => page.isConnected
  const open = () => {
    clearTimeout(timer)
    if (!alive() || (ws && ws.readyState <= 1)) return
    ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws/lobby`)
    ws.onopen = () => { retry = 0 }
    ws.onmessage = (e) => {
      if (!alive()) { stop(); return }
      let m
      try { m = JSON.parse(e.data) } catch { return }
      if (m.t === "lobby") onMsg(m)
    }
    ws.onclose = () => { if (alive()) timer = setTimeout(open, Math.min(15000, 1000 * 2 ** retry++)) }
  }
  const wake = () => { if (!alive()) { stop(); return } if (document.visibilityState === "visible") { retry = 0; open() } }
  const stop = () => {
    clearTimeout(timer); clearInterval(ping)
    document.removeEventListener("visibilitychange", wake); window.removeEventListener("hashchange", gone)
    if (ws) { ws.onclose = null; ws.close() }
  }
  const gone = () => setTimeout(() => { if (!alive()) stop() }, 0)
  document.addEventListener("visibilitychange", wake)
  window.addEventListener("hashchange", gone)
  let n = 0
  ping = setInterval(() => { if (!alive()) stop(); else if (++n % 8 === 0 && ws && ws.readyState === 1) ws.send("ping") }, 3000)
  open()
}

// ---------------------------------------------------------------------------------------------------------
// Create a room: game options (+ turn timer, mode, dare)
// ---------------------------------------------------------------------------------------------------------
export function optionsForm(g, values = {}, { withMeta = true } = {}) {
  const vals = { ...Object.fromEntries(g.options.map((o) => [o.key, o.default])), ...values }
  const node = el("div", { class: "col", style: { gap: "4px" } })
  const lbl = (o) => (getLang() === "en" ? o.label_en : o.label_id)
  for (const o of g.options) {
    if (o.type === "select") {
      const seg = el("div", { class: "seg" })
      const draw = () => seg.replaceChildren(...o.choices.map(([v, a, b]) => el("button", { type: "button", class: vals[o.key] === v ? "on" : "",
        text: getLang() === "en" ? b : a, onclick: () => { vals[o.key] = v; draw() } })))
      draw()
      node.append(el("div", { class: "field" }, el("span", { text: lbl(o) }), seg))
    } else if (o.type === "multi") {
      const box = el("div", { class: "row wrap" })
      vals[o.key] = [...(vals[o.key] || [])]
      const draw = () => box.replaceChildren(...o.choices.map(([v, a, b]) => el("button", { type: "button", class: `chip${vals[o.key].includes(v) ? " on" : ""}`,
        text: getLang() === "en" ? b : a, onclick: () => {
          vals[o.key] = vals[o.key].includes(v) ? vals[o.key].filter((x) => x !== v) : [...vals[o.key], v]
          if (!vals[o.key].length) vals[o.key] = [v]
          draw()
        } })))
      draw()
      node.append(el("div", { class: "field" }, el("span", { text: lbl(o) }), box, o.help_id ? el("small", { class: "hint", text: getLang() === "en" ? o.help_en : o.help_id }) : null))
    } else if (o.type === "bool") {
      const cb = el("input", { type: "checkbox", checked: !!vals[o.key], onchange: (e) => { vals[o.key] = e.target.checked } })
      node.append(el("label", { class: "switch", style: { margin: "6px 0 10px" } }, cb, el("span", { text: lbl(o) })))
    } else if (o.type === "text") {
      const inp = el("textarea", { rows: 2, maxlength: 300, value: vals[o.key] || "", oninput: (e) => { vals[o.key] = e.target.value } })
      node.append(el("label", { class: "field" }, el("span", { text: lbl(o) }), inp, o.help_id ? el("small", { class: "hint", text: getLang() === "en" ? o.help_en : o.help_id }) : null))
    }
  }
  if (withMeta && g.kind === "turn") {
    const general = Number((state.me.prefs || {}).timer ?? 60)
    vals._timer = values._timer ?? general
    const seg = el("div", { class: "seg" })
    const choices = [[0, L("Mati", "Off")], [15, "15s"], [30, "30s"], [60, "60s"], [120, "2m"]]
    const draw = () => seg.replaceChildren(...choices.map(([v, t]) => el("button", { type: "button", class: vals._timer === v ? "on" : "", text: t, onclick: () => { vals._timer = v; draw() } })))
    draw()
    node.append(el("div", { class: "field" }, el("span", { text: L("Batas waktu per giliran", "Turn timer") }), seg,
      el("small", { class: "hint", text: L("Kalau habis, server melakukan langkah aman otomatis. Default dari Profil.", "When it runs out the server makes a safe move. Default is set in Profile.") })))
  }
  if (withMeta) {
    vals._dare = values._dare ?? false
    node.append(el("label", { class: "switch", style: { margin: "6px 0" } }, el("input", { type: "checkbox", checked: vals._dare, onchange: (e) => { vals._dare = e.target.checked } }),
      el("span", { text: L("Tantangan untuk yang kalah 🎭", "Loser dare 🎭") })))
  }
  return { node, values: () => vals }
}

function createRoom(g) {
  const s = sheet(`${g.icon} ${gname(g)}`)
  let mode = "live"
  const form = optionsForm(g)
  const modeSeg = el("div", { class: "seg" })
  const drawMode = () => modeSeg.replaceChildren(
    el("button", { type: "button", class: mode === "live" ? "on" : "", text: L("⚡ Live (bareng)", "⚡ Live"), onclick: () => { mode = "live"; drawMode() } }),
    el("button", { type: "button", class: mode === "santai" ? "on" : "", text: L("🛋️ Santai (kapan saja)", "🛋️ Play later"), onclick: () => { mode = "santai"; drawMode() } }))
  drawMode()
  const create = el("button", { class: "btn primary big wide", type: "button", text: L("Buat ruang", "Open a room") })
  create.onclick = () => busy(create, async () => {
    const r = await api("/rooms", { method: "POST", json: { game: g.key, mode, options: form.values() } })
    s.close()
    go(`room/${r.code}`)
  })
  s.body.append(
    el("p", { class: "muted", text: (RULES[g.key] || ["", ""])[getLang() === "en" ? 1 : 0] }),
    g.santai ? el("div", { class: "field" }, el("span", { text: L("Cara main", "How you play") }), modeSeg,
      el("small", { class: "hint", text: L("Santai: tidak perlu online bersamaan, dapat notifikasi saat giliranmu.", "Play later: no need to be online together; you get a push on your turn.") })) : null,
    form.node, el("div", { style: { marginTop: "10px" } }, create))
}
