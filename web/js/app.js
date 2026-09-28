import { $, api, el, setAuthHandler, store, toast } from "./lib.js?v=__VERSION__"
import { L, setLang } from "./i18n.js?v=__VERSION__"
import { configure } from "./sound.js?v=__VERSION__"
import { renderLobby } from "./lobby.js?v=__VERSION__"
import { renderRoom, leaveRoom } from "./room.js?v=__VERSION__"
import { renderScores, renderDares, renderProfile, renderAdmin } from "./pages.js?v=__VERSION__"

export const state = { me: null, games: [], categories: [], avatars: [], colors: [], byKey: {} }

const TABS = [["lobby", "🎲", () => L("Main", "Play")], ["scores", "🏆", () => L("Skor", "Scores")],
  ["dares", "🎭", () => L("Tantangan", "Dares")], ["profile", "👤", () => L("Profil", "Profile")]]

export function applyTheme() {
  const t = store.get("bg_theme", "auto")
  if (t === "auto") document.documentElement.removeAttribute("data-theme")
  else document.documentElement.setAttribute("data-theme", t)
}

function shell(active) {
  const main = el("main", { class: "shell" })
  const bar = el("nav", { class: "tabbar", "aria-label": "Sections" },
    TABS.map(([k, em, label]) => el("a", { href: `#${k}`, class: active === k ? "on" : "" }, el("span", { class: "em", text: em }), label())))
  $("#app").replaceChildren(main, bar)
  return main
}

let rendering = 0
export async function route() {
  if (!state.me) return
  const [name, arg] = (location.hash.replace(/^#/, "") || "lobby").split("/")
  const my = ++rendering
  if (name !== "room") leaveRoom()
  try {
    if (name === "room" && arg) {
      await renderRoom($("#app"), arg.toUpperCase())
      return
    }
    const page = shell(["lobby", "scores", "dares", "profile"].includes(name) ? name : "lobby")
    if (name === "scores") await renderScores(page)
    else if (name === "dares") await renderDares(page)
    else if (name === "profile") await renderProfile(page)
    else if (name === "admin") await renderAdmin(page)
    else await renderLobby(page)
  } catch (err) {
    if (my !== rendering || err.status === 401) return
    $("#app").replaceChildren(el("div", { class: "center-view" }, el("div", { class: "card center" },
      el("h2", { text: L("Gagal memuat", "Couldn't load") }), el("p", { class: "muted", text: err.message }),
      el("button", { class: "btn primary", onclick: route, text: L("Coba lagi", "Try again") }))))
  }
}
window.addEventListener("hashchange", () => { const a = $("#app"); if (a) a.scrollTop = 0; route() })

// No pinch / double-tap zoom anywhere (iOS ignores user-scalable=no in some cases).
for (const t of ["gesturestart", "gesturechange", "gestureend"]) document.addEventListener(t, (e) => e.preventDefault(), { passive: false })
document.addEventListener("touchmove", (e) => { if (e.touches.length > 1 || (e.scale !== undefined && e.scale !== 1)) e.preventDefault() }, { passive: false })

export const go = (h) => { if (location.hash === `#${h}`) route(); else location.hash = h }

// ---------------------------------------------------------------------------------------------------------
function renderAuth(message = "", mode = "login") {
  const user = el("input", { autocomplete: "username", autocapitalize: "none", autocorrect: "off", spellcheck: "false", maxlength: 32, placeholder: "username" })
  const pass = el("input", { type: "password", autocomplete: mode === "login" ? "current-password" : "new-password", maxlength: 72,
    placeholder: mode === "login" ? "••••••••" : L("min. 8 karakter", "at least 8 characters") })
  const msg = el("p", { class: "form-msg", role: "alert", text: message })
  const submit = el("button", { class: "btn primary big wide", type: "submit", text: mode === "login" ? L("Masuk", "Log in") : L("Daftar", "Create account") })
  const f = el("form", {},
    el("label", { class: "field" }, el("span", { text: L("Nama pengguna", "Username") }), user),
    el("label", { class: "field" }, el("span", { text: L("Kata sandi", "Password") }), pass), msg, submit)
  f.addEventListener("submit", async (e) => {
    e.preventDefault()
    msg.textContent = ""
    submit.disabled = true
    try {
      if (mode === "register") {
        await api("/register", { method: "POST", json: { username: user.value.trim().toLowerCase(), password: pass.value } })
        renderAuth(L("Akun dibuat! Tunggu disetujui admin, lalu masuk.", "Account created! Wait for the admin to approve it, then log in."), "login")
        return
      }
      const d = await api("/login", { method: "POST", json: { username: user.value.trim().toLowerCase(), password: pass.value }, quiet: true })
      await afterLogin(d.me)
    } catch (err) { msg.textContent = err.message } finally { submit.disabled = false }
  })
  const other = el("button", { class: "link", type: "button", text: mode === "login" ? L("Belum punya akun? Daftar", "No account? Create one") : L("Sudah punya akun? Masuk", "Have an account? Log in"),
    onclick: () => renderAuth("", mode === "login" ? "register" : "login") })
  $("#app").replaceChildren(el("div", { class: "center-view" }, el("div", { class: "auth" },
    el("div", { class: "logo" }, el("span", { class: "mark", text: "🎲" }), "BashGames"),
    el("p", { class: "tag", text: L("Main bareng, di HP masing-masing.", "Play together, each on your own phone.") }),
    el("div", { class: "card" }, f, el("p", { class: "center small", style: { marginTop: "12px" } }, other),
      mode === "login" ? el("p", { class: "hint center", text: L("Akun yang sama dengan lyrsync & aplikasi keuangan.", "Same account as lyrsync and the finance app.") }) : null))))
}

setAuthHandler((status) => { if (status === 401) { state.me = null; renderAuth(L("Silakan masuk lagi.", "Please log in again.")) } })

async function afterLogin(me) {
  state.me = me
  setLang(me.lang)
  configure(me.prefs || {})
  const [g, m] = await Promise.all([api("/games"), api("/me")])
  state.games = g.games
  state.categories = g.categories
  state.byKey = Object.fromEntries(g.games.map((x) => [x.key, x]))
  state.avatars = m.avatars
  state.colors = m.colors
  state.me = m.me
  await route()
}

async function boot() {
  applyTheme()
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {})
    navigator.serviceWorker.addEventListener("message", (e) => {
      if (e.data && e.data.type === "navigate" && e.data.url) location.hash = e.data.url.split("#")[1] || "lobby"
    })
  }
  try {
    const res = await fetch("/api/me", { credentials: "same-origin" })
    if (res.status === 200) {
      const d = await res.json()
      await afterLogin(d.me)
    } else renderAuth()
  } catch (_) {
    renderAuth(L("Belum ada koneksi. Coba lagi sebentar…", "No connection yet. Retrying…"))
    setTimeout(boot, 4000)
  }
}
boot()
window.addEventListener("unhandledrejection", (e) => { if (e.reason && e.reason.message) toast(e.reason.message, "bad") })
