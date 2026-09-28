import { api, avatar, busy, el, icon, rp, store, toast } from "./lib.js?v=__VERSION__"
import { L, gname, getLang, setLang } from "./i18n.js?v=__VERSION__"
import { configure } from "./sound.js?v=__VERSION__"
import { applyTheme, route, state } from "./app.js?v=__VERSION__"

const fmtDate = (s) => s ? new Intl.DateTimeFormat(getLang() === "en" ? "en-GB" : "id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })
  .format(new Date(String(s).replace(" ", "T"))) : ""

// ---------------------------------------------------------------------------------------------------------
// Scores: my stats, head-to-head, leaderboards, monthly titles
// ---------------------------------------------------------------------------------------------------------
export async function renderScores(page) {
  let game = "", period = "all"
  const box = el("div")
  const gameSel = el("select", { class: "input", style: { maxWidth: "240px" } }, el("option", { value: "", text: L("Semua permainan", "All games") }),
    state.games.map((g) => el("option", { value: g.key, text: `${g.icon} ${gname(g)}` })))
  gameSel.onchange = () => { game = gameSel.value; load() }
  const per = el("div", { class: "seg" })
  const drawPer = () => per.replaceChildren(...[["all", L("Semua waktu", "All time")], ["month", L("Bulan ini", "This month")]].map(([k, t]) =>
    el("button", { type: "button", class: period === k ? "on" : "", text: t, onclick: () => { period = k; drawPer(); load() } })))
  drawPer()
  page.append(el("div", { class: "topbar" }, el("h1", { text: `🏆 ${L("Skor", "Scores")}` })), el("div", { class: "row wrap" }, gameSel, per), box)

  async function load() {
    const [st, lb] = await Promise.all([api(`/stats?game=${game}`), api(`/leaderboard?game=${game}&period=${period}`)])
    const me = state.me
    const titles = lb.titles.map((t) => el("div", { class: "award" }, el("span", { class: "em", text: state.byKey[t.game]?.icon || "🏅" }),
      el("div", { class: "grow" }, el("b", { text: `${getLang() === "en" ? t.title_en : t.title_id}` }), el("div", { class: "small muted", text: `${t.avatar} ${t.name} · ${t.wins} ${L("menang", "wins")}` }))))
    box.replaceChildren(
      el("div", { class: "card", style: { marginTop: "12px" } },
        el("div", { class: "row" }, avatar(me, "big"), el("div", { class: "grow" }, el("h2", { style: { margin: 0 }, text: me.name }),
          el("div", { class: "muted small", text: `${st.played} ${L("main", "played")} · ${st.wins} ${L("menang", "wins")} · ${st.rate}%${st.streak > 1 ? ` · 🔥 ${st.streak} ${L("beruntun", "in a row")}` : ""}` })))),
      titles.length ? [el("div", { class: "section-title" }, el("h2", { text: `👑 ${L("Gelar bulan ini", "This month's titles")}` })), el("div", { class: "card" }, titles)] : null,
      el("div", { class: "section-title" }, el("h2", { text: L("Papan peringkat", "Leaderboard") })),
      el("div", { class: "card" }, lb.rows.length ? lb.rows.map((r, i) => el("div", { class: "row", style: { padding: "8px 0", borderBottom: "1px solid var(--line)" } },
        el("b", { style: { width: "26px" }, text: ["🥇", "🥈", "🥉"][i] || `${i + 1}.` }), avatar(r), el("b", { class: "grow", text: r.name }),
        el("span", { class: "small muted", text: `${r.wins}/${r.played} · ${r.rate}%` }))) : el("p", { class: "empty", text: L("Belum ada permainan.", "No games yet.") })),
      st.h2h.length ? [el("div", { class: "section-title" }, el("h2", { text: L("Kamu vs teman", "You vs friends") })),
        el("div", { class: "card" }, st.h2h.map((h) => el("div", { class: "row", style: { padding: "8px 0", borderBottom: "1px solid var(--line)" } }, avatar(h),
          el("b", { class: "grow", text: h.name }), el("span", { class: `pill ${h.won > h.lost ? "ok" : h.won < h.lost ? "bad" : ""}`, text: `${h.won} – ${h.lost}` }),
          el("span", { class: "small muted", text: `${h.games} ${L("main", "games")}` }))))] : null,
      st.per_game.length ? [el("div", { class: "section-title" }, el("h2", { text: L("Per permainan", "By game") })),
        el("div", { class: "card" }, st.per_game.map((g) => el("div", { class: "row between", style: { padding: "6px 0" } },
          el("span", {}, `${state.byKey[g.game]?.icon || ""} ${gname(state.byKey[g.game])}`), el("b", { text: `${g.wins}/${g.played}` }))))] : null,
      el("div", { class: "section-title" }, el("h2", { text: L("Riwayat", "History") })),
      el("div", { class: "card" }, st.recent.length ? st.recent.map((m) => {
        const mine = m.players.find((p) => p.id === me.id)
        const won = m.winners.includes(me.id)
        return el("div", { class: "row", style: { padding: "8px 0", borderBottom: "1px solid var(--line)" } },
          el("span", { style: { fontSize: "24px" }, text: state.byKey[m.game]?.icon || "🎲" }),
          el("div", { class: "grow" }, el("b", { text: gname(state.byKey[m.game]) }), el("div", { class: "small muted", text: `${fmtDate(m.ended)} · ${m.players.map((p) => p.name).join(", ")}` })),
          el("span", { class: `pill ${won ? "ok" : ""}`, text: won ? L("Menang", "Won") : `#${mine?.rank}` }))
      }) : el("p", { class: "empty", text: L("Main dulu, nanti riwayatmu muncul di sini.", "Play a game and your history shows up here.") })))
  }
  await load()
}

// ---------------------------------------------------------------------------------------------------------
// Dares
// ---------------------------------------------------------------------------------------------------------
export async function renderDares(page) {
  const d = await api("/dares")
  const input = el("input", { class: "input", maxlength: 300, placeholder: L("Tulis tantangan baru… (mis. traktir martabak)", "Write a new dare… (e.g. buy martabak)") })
  const add = el("button", { class: "btn primary", type: "button" }, icon("plus"), L("Tambah", "Add"))
  add.onclick = () => busy(add, async () => { if (input.value.trim().length < 3) return; await api("/dares", { method: "POST", json: { text: input.value } }); page.replaceChildren(); renderDares(page) })
  page.append(el("div", { class: "topbar" }, el("h1", { text: `🎭 ${L("Tantangan", "Dares")}` })),
    el("p", { class: "muted", text: L("Nyalakan “Tantangan untuk yang kalah” saat membuat ruang. Yang terakhir dapat tantangan acak dari daftar ini.", "Turn on “Loser dare” when opening a room. Last place gets a random dare from this list.") }),
    el("div", { class: "section-title" }, el("h2", { text: L("Utang tantangan", "Dare tab") })),
    el("div", { class: "card" }, d.log.length ? d.log.map((x) => {
      const cb = el("input", { type: "checkbox", checked: x.done, onchange: async (e) => { await api(`/dares/log/${x.id}`, { method: "PATCH", json: { done: e.target.checked } }); toast(e.target.checked ? L("Lunas! 🎉", "Done! 🎉") : "OK") } })
      return el("label", { class: "row", style: { padding: "8px 0", borderBottom: "1px solid var(--line)", cursor: "pointer" } },
        el("span", { class: "switch" }, cb), el("span", { style: { fontSize: "22px" }, text: x.avatar }),
        el("div", { class: "grow" }, el("b", { text: x.name }), el("div", { class: "small", text: x.text }), el("div", { class: "small muted", text: `${state.byKey[x.game]?.icon || ""} ${fmtDate(x.created)}` })))
    }) : el("p", { class: "empty", text: L("Belum ada yang berutang tantangan 😇", "Nobody owes a dare yet 😇") })),
    el("div", { class: "section-title" }, el("h2", { text: L("Daftar tantangan", "Dare list") })),
    el("div", { class: "card" }, el("div", { class: "row" }, input, add),
      d.custom.map((x) => el("div", { class: "row", style: { padding: "8px 0", borderBottom: "1px solid var(--line)" } }, el("span", { class: "grow", text: x.text }),
        el("span", { class: "small muted", text: x.by }),
        el("button", { class: "icon-btn", type: "button", onclick: async () => { await api(`/dares/${x.id}`, { method: "DELETE" }); page.replaceChildren(); renderDares(page) } }, icon("trash")))),
      !d.custom.length ? [el("p", { class: "muted small", style: { marginTop: "10px" }, text: L("Belum ada tantangan sendiri — dipakai daftar bawaan ini:", "No custom dares yet — using these built-in ones:") }),
        d.defaults.map((x) => el("div", { class: "small", style: { padding: "3px 0" }, text: `• ${getLang() === "en" ? x.en : x.id}` }))] : null))
}

// ---------------------------------------------------------------------------------------------------------
// Profile & settings
// ---------------------------------------------------------------------------------------------------------
export async function renderProfile(page) {
  const me = state.me
  const prefs = { sound: true, volume: 70, timer: 60, ...(me.prefs || {}) }
  let av = me.avatar, color = me.color, lang = me.lang
  const name = el("input", { class: "input", maxlength: 20, value: me.name })
  const preview = el("div", { style: { display: "grid", placeItems: "center", margin: "6px 0 14px" } })
  const drawPreview = () => preview.replaceChildren(avatar({ avatar: av, color }, "xl"))
  drawPreview()
  const avGrid = el("div", { class: "row wrap" })
  const drawAv = () => avGrid.replaceChildren(...state.avatars.map((a) => el("button", { type: "button", class: `av${a === av ? " sel" : ""}`,
    style: { "--c": a === av ? color : "var(--card-2)", border: 0, cursor: "pointer", outline: a === av ? "3px solid var(--ink)" : "none" }, text: a, onclick: () => { av = a; drawAv(); drawPreview() } })))
  drawAv()
  const colGrid = el("div", { class: "row wrap" })
  const drawCol = () => colGrid.replaceChildren(...state.colors.map((c) => el("button", { type: "button", style: { width: "34px", height: "34px", borderRadius: "50%", border: "3px solid var(--card)",
    background: c, cursor: "pointer", outline: c === color ? "3px solid var(--ink)" : "none" }, onclick: () => { color = c; drawCol(); drawAv(); drawPreview() } })))
  drawCol()
  const langSeg = el("div", { class: "seg" })
  const drawLang = () => langSeg.replaceChildren(...[["id", "Bahasa Indonesia"], ["en", "English"]].map(([k, t]) => el("button", { type: "button", class: lang === k ? "on" : "", text: t, onclick: () => { lang = k; drawLang() } })))
  drawLang()
  let theme = store.get("bg_theme", "auto")
  const themeSeg = el("div", { class: "seg" })
  const drawTheme = () => themeSeg.replaceChildren(...[["auto", "Auto"], ["light", L("Terang", "Light")], ["dark", L("Gelap", "Dark")]].map(([k, t]) =>
    el("button", { type: "button", class: theme === k ? "on" : "", text: t, onclick: () => { theme = k; store.set("bg_theme", k); applyTheme(); drawTheme() } })))
  drawTheme()
  const sound = el("input", { type: "checkbox", checked: prefs.sound })
  const vol = el("input", { type: "range", min: 0, max: 100, value: prefs.volume, style: { width: "100%" } })
  const timerSeg = el("div", { class: "seg" })
  let timer = Number(prefs.timer)
  const drawTimer = () => timerSeg.replaceChildren(...[[0, L("Mati", "Off")], [15, "15s"], [30, "30s"], [60, "60s"], [120, "2m"]].map(([v, t]) =>
    el("button", { type: "button", class: timer === v ? "on" : "", text: t, onclick: () => { timer = v; drawTimer() } })))
  drawTimer()
  const save = el("button", { class: "btn primary big wide", type: "button", text: L("Simpan", "Save") })
  save.onclick = () => busy(save, async () => {
    const r = await api("/me", { method: "PUT", json: { name: name.value.trim() || me.name, avatar: av, color, lang, prefs: { sound: sound.checked, volume: Number(vol.value), timer } } })
    state.me = r.me
    setLang(r.me.lang)
    configure(r.me.prefs)
    toast(L("Tersimpan ✓", "Saved ✓"))
    route()
  })
  const push = el("button", { class: "btn", type: "button", text: L("🔔 Nyalakan notifikasi ajakan main", "🔔 Turn on game invites") })
  push.onclick = () => busy(push, enablePush)
  const old = el("input", { class: "input", type: "password", placeholder: L("Kata sandi lama", "Current password"), autocomplete: "current-password" })
  const nw = el("input", { class: "input", type: "password", placeholder: L("Kata sandi baru (min. 8)", "New password (8+)"), autocomplete: "new-password" })
  const chg = el("button", { class: "btn small", type: "button", text: L("Ganti kata sandi", "Change password") })
  chg.onclick = () => busy(chg, async () => { await api("/password", { method: "POST", json: { old: old.value, new: nw.value } }); toast(L("Diganti — masuk lagi ya", "Changed — please log in again")); setTimeout(() => location.reload(), 1200) })
  const wallet = await api("/wallet").catch(() => null)
  page.append(el("div", { class: "topbar" }, el("h1", { text: `👤 ${L("Profil", "Profile")}` })),
    el("div", { class: "card" }, preview,
      el("label", { class: "field" }, el("span", { text: L("Nama tampil", "Display name") }), name),
      el("div", { class: "field" }, el("span", { text: L("Avatar", "Avatar") }), avGrid),
      el("div", { class: "field" }, el("span", { text: L("Warna", "Colour") }), colGrid)),
    el("div", { class: "card" },
      el("div", { class: "field" }, el("span", { text: L("Bahasa aplikasi", "App language") }), langSeg),
      el("div", { class: "field" }, el("span", { text: L("Tampilan", "Theme") }), themeSeg),
      el("label", { class: "switch", style: { margin: "6px 0 10px" } }, sound, el("span", { text: L("Suara & efek", "Sound effects") })),
      el("div", { class: "field" }, el("span", { text: L("Volume", "Volume") }), vol),
      el("div", { class: "field" }, el("span", { text: L("Batas waktu giliran (aturan umum)", "Turn timer (general default)") }), timerSeg,
        el("small", { class: "hint", text: L("Dipakai sebagai default saat kamu membuat ruang; bisa diubah per permainan.", "Used as the default when you open a room; change it per game.") }))),
    save,
    wallet ? el("div", { class: "card", style: { marginTop: "14px" } }, el("b", { text: `♠️ ${L("Dompet poker hari ini", "Today's poker wallet")}: ${rp(wallet.balance)}` }),
      el("div", { class: "small muted", text: L("Direset ke Rp1.000.000 tiap 00:00 WIB.", "Resets to Rp1,000,000 at 00:00 WIB.") })) : null,
    el("div", { class: "card col", style: { marginTop: "14px" } }, push,
      me.admin ? el("a", { class: "btn", href: "#admin", text: L("🛠️ Admin: persetujuan & laporan soal", "🛠️ Admin: approvals & reports") }) : null,
      el("details", {}, el("summary", { style: { fontWeight: 800, cursor: "pointer" }, text: L("Kata sandi", "Password") }), el("div", { class: "col", style: { marginTop: "10px" } }, old, nw, chg)),
      el("button", { class: "btn ghost", type: "button", text: L("Keluar", "Log out"), onclick: async () => { await api("/logout", { method: "POST" }); location.reload() } })))
}

async function enablePush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) { toast(L("Pasang dulu ke Home Screen (Share → Add to Home Screen).", "Add to the Home Screen first (Share → Add to Home Screen)."), "bad"); return }
  const perm = await Notification.requestPermission()
  if (perm !== "granted") { toast(L("Notifikasi diblokir di pengaturan HP.", "Notifications are blocked in the phone settings."), "bad"); return }
  const reg = await navigator.serviceWorker.ready
  const { key } = await api("/push/key")
  const raw = Uint8Array.from(atob(key.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((key.length + 3) % 4)), (c) => c.charCodeAt(0))
  let sub = await reg.pushManager.getSubscription()
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: raw })
  const j = sub.toJSON()
  await api("/push/subscribe", { method: "POST", json: { endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, ua: navigator.userAgent.slice(0, 300) } })
  const r = await api("/push/test", { method: "POST" })
  toast(r.sent ? L("Notifikasi aktif! 🔔", "Notifications on! 🔔") : L("Terdaftar.", "Registered."))
}

// ---------------------------------------------------------------------------------------------------------
// Admin: approvals + reported questions
// ---------------------------------------------------------------------------------------------------------
export async function renderAdmin(page) {
  const [users, reps] = await Promise.all([api("/admin/users"), api("/reports")])
  page.append(el("div", { class: "topbar" }, el("h1", { text: "🛠️ Admin" })),
    el("div", { class: "section-title" }, el("h2", { text: L("Persetujuan akun", "Account approvals") })),
    el("div", { class: "card" }, users.users.map((u) => {
      const cb = el("input", { type: "checkbox", checked: u.approved, onchange: async (e) => { await api(`/admin/users/${u.id}`, { method: "PATCH", json: { approved: e.target.checked } }); toast("OK") } })
      return el("label", { class: "row", style: { padding: "8px 0", borderBottom: "1px solid var(--line)" } }, el("span", { class: "switch" }, cb),
        el("b", { class: "grow", text: u.username }), u.role === "admin" ? el("span", { class: "pill", text: "admin" }) : null,
        !u.approved ? el("span", { class: "pill warn", text: L("menunggu", "pending") }) : null)
    })),
    el("div", { class: "section-title" }, el("h2", { text: L("Laporan soal", "Reported questions") })),
    el("p", { class: "muted small", text: L("Soal yang dilaporkan otomatis tidak dipakai lagi, dan alasannya jadi pelajaran untuk AI. Pulihkan jika laporannya keliru.", "Reported questions are pulled automatically and the reason becomes a lesson for the AI. Restore one if the report was wrong.") }),
    el("div", { class: "card" }, reps.reports.length ? reps.reports.map((r) => {
      const q = r.question?.q || {}
      return el("div", { style: { padding: "10px 0", borderBottom: "1px solid var(--line)" } },
        el("div", { class: "row between" }, el("b", { text: `${r.kind} · ${r.topic || ""}` }), el("span", { class: "pill", text: r.status })),
        el("div", { class: "small", text: r.reason }),
        q.q ? el("div", { class: "small muted", text: `${q.q} → ${(q.choices || [])[q.answer] ?? q.answer ?? ""}` }) : null,
        r.status === "open" ? el("div", { class: "row", style: { marginTop: "6px" } },
          el("button", { class: "btn small", type: "button", text: L("Pulihkan soal", "Restore"), onclick: async (e) => { await api(`/reports/${r.id}`, { method: "PATCH", json: { action: "restore" } }); e.target.closest("div").remove() } }),
          el("button", { class: "btn small danger", type: "button", text: L("Hapus soal", "Delete"), onclick: async (e) => { await api(`/reports/${r.id}`, { method: "PATCH", json: { action: "delete" } }); e.target.closest("div").remove() } })) : null)
    }) : el("p", { class: "empty", text: L("Tidak ada laporan 👍", "No reports 👍") })))
}
