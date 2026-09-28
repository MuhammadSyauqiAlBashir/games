import { api, avatar, busy, el, sheet, toast } from "./lib.js?v=__VERSION__"
import { L, RULES, TINT, gname, getLang } from "./i18n.js?v=__VERSION__"
import { go, state } from "./app.js?v=__VERSION__"

export async function renderLobby(page) {
  const [rooms, players] = await Promise.all([api("/rooms"), api("/players")])
  const me = state.me
  const code = el("input", { maxlength: 4, placeholder: "KODE", autocapitalize: "characters", "aria-label": L("Kode ruang", "Room code") })
  const join = el("button", { class: "btn primary", type: "button", text: L("Gabung", "Join") })
  join.onclick = () => { const c = code.value.trim().toUpperCase(); if (c.length === 4) go(`room/${c}`); else toast(L("Kode 4 huruf", "4-letter code"), "bad") }
  code.addEventListener("keydown", (e) => { if (e.key === "Enter") join.click() })

  const mine = rooms.rooms.filter((r) => r.seated && r.status !== "finished")
  const open = rooms.rooms.filter((r) => !r.seated && r.status === "lobby")
  const roomItem = (r) => {
    const g = state.byKey[r.game]
    return el("a", { class: "room-item", href: `#room/${r.code}` }, el("span", { class: "gi", text: g?.icon || "🎲" }),
      el("span", { class: "grow" }, el("b", { text: gname(g) }), el("br"),
        el("small", { class: "muted", text: `${r.code} · ${r.status === "lobby" ? L("menunggu pemain", "waiting") : r.mode === "santai" ? L("santai", "play-later") : L("berlangsung", "in play")}` })),
      r.your_turn ? el("span", { class: "pill warn", text: L("Giliranmu!", "Your turn!") }) : null,
      el("span", { class: "avatars" }, r.players.map((p) => avatar(p))))
  }

  page.append(
    el("div", { class: "topbar" }, el("a", { class: "logo", href: "#lobby" }, el("span", { class: "mark", text: "🎲" }), "BashGames"),
      el("a", { href: "#profile", style: { textDecoration: "none" } }, avatar(me, "big"))),
    el("div", { class: "hero-card" }, el("span", { class: "deco", text: "🎉" }),
      el("h1", { text: L(`Hai, ${me.name}!`, `Hi, ${me.name}!`) }),
      el("p", { text: L("Pilih permainan untuk bikin ruang, atau masukkan kode dari teman.", "Pick a game to open a room, or enter a friend's code.") }),
      el("div", { class: "join-row" }, code, join)),
    mine.length ? [el("div", { class: "section-title" }, el("h2", { text: L("Ruang kamu", "Your rooms") })), (() => {
      const list = el("div", { class: "room-list" }, mine.slice(0, 5).map(roomItem))
      if (mine.length > 5) list.append(el("button", { class: "link", type: "button", text: L(`Lihat semua (${mine.length})`, `Show all (${mine.length})`),
        onclick: (e) => { list.replaceChildren(...mine.map(roomItem)) } }))
      return list
    })()] : null,
    open.length ? [el("div", { class: "section-title" }, el("h2", { text: L("Ruang terbuka", "Open rooms") })), el("div", { class: "room-list" }, open.map(roomItem))] : null,
    el("div", { class: "section-title" }, el("h2", { text: L("Teman", "Friends") })),
    el("div", { class: "card", style: { padding: "12px" } }, el("div", { class: "players-online" }, players.players.map((p) =>
      el("div", { class: "p" }, el("span", { class: "av", style: { "--c": p.color, position: "relative" } }, p.avatar, el("i", { class: `online-dot${p.online ? " on" : ""}` })),
        el("span", { text: p.name })))),
      players.players.length <= 1 ? el("p", { class: "muted small", text: L("Teman muncul di sini setelah mereka masuk sekali.", "Friends show up here after they log in once.") }) : null),
    state.categories.map((cat) => [
      el("div", { class: "section-title" }, el("h2", { text: getLang() === "en" ? cat.en : cat.id })),
      el("div", { class: "game-grid" }, cat.games.map((k) => state.byKey[k]).filter(Boolean).map((g) =>
        el("button", { class: "game-tile", type: "button", style: { "--tint": TINT[g.key] }, onclick: () => createRoom(g) },
          el("span", { class: "gi", text: g.icon }),
          el("span", {}, el("b", { text: gname(g) }), el("small", { text: `${g.min === g.max ? g.min : `${g.min}–${g.max}`} ${L("pemain", "players")}` }))))),
    ]))
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
