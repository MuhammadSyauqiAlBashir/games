// Shared helpers: DOM, API, sheets, toasts, local storage.

export const $ = (s, r = document) => r.querySelector(s)
export const $$ = (s, r = document) => [...r.querySelectorAll(s)]
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Views pass nested lists and optional parts (cond ? node : null) to append/replaceChildren:
// flatten them and skip empty values instead of printing "null".
for (const proto of [Element.prototype, DocumentFragment.prototype]) {
  for (const name of ["append", "prepend", "replaceChildren"]) {
    const orig = proto[name]
    proto[name] = function (...nodes) {
      return orig.apply(this, nodes.flat(Infinity).filter((n) => n !== null && n !== undefined && n !== false))
    }
  }
}

export function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag)
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue
    if (k === "class") n.className = v
    else if (k === "text") n.textContent = v
    else if (k === "style" && typeof v === "object") {
      for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith("--")) n.style.setProperty(sk, sv); else n.style[sk] = sv }
    }
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v)
    else if (k === "value") n.value = v
    else if (k === "checked") n.checked = !!v
    else n.setAttribute(k, v === true ? "" : v)
  }
  for (const c of kids.flat(Infinity)) if (c !== null && c !== undefined && c !== false) n.append(c instanceof Node ? c : document.createTextNode(String(c)))
  return n
}

export const SVGNS = "http://www.w3.org/2000/svg"
export function svg(tag, attrs = {}, ...kids) {
  const n = document.createElementNS(SVGNS, tag)
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue
    if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v)
    else if (k === "text") n.textContent = v
    else n.setAttribute(k, v)
  }
  for (const c of kids.flat(Infinity)) if (c) n.append(c)
  return n
}

const ICONS = {
  x: "M6 6l12 12M18 6L6 18", back: "M15 6l-6 6 6 6", chat: "M4 5h16v11H9l-5 4z", smile: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8.5 14a4 4 0 0 0 7 0M9 9.5h.01M15 9.5h.01",
  menu: "M4 7h16M4 12h16M4 17h16", sound: "M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11", mute: "M4 9v6h4l5 4V5L8 9zM17 9l5 5M22 9l-5 5",
  share: "M4 12v8h16v-8M12 3v13M7 8l5-5 5 5", copy: "M8 8h12v12H8zM4 16V4h12", info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5h.01",
  send: "M4 12l16-8-6 16-3-7z", check: "M5 13l4 4L19 7", plus: "M12 5v14M5 12h14", undo: "M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3",
  trash: "M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3", flag: "M5 21V4M5 4h11l-2 4 2 4H5",
}
export function icon(name, cls = "") {
  return svg("svg", { viewBox: "0 0 24 24", class: `ico ${cls}`, "aria-hidden": "true" }, svg("path", { d: ICONS[name] || "" }))
}

export class ApiError extends Error {
  constructor(status, message, data) { super(message); this.status = status; this.data = data }
}
let onAuth = () => {}
export const setAuthHandler = (fn) => { onAuth = fn }

export async function api(path, { method = "GET", json, quiet = false } = {}) {
  const opts = { method, credentials: "same-origin", headers: { "X-BG": "1" } }
  if (json !== undefined) { opts.headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(json) }
  let res
  for (let i = 0; ; i++) {
    try { res = await fetch("/api" + path, opts); break } catch (e) {
      if (method !== "GET" || i >= 2) throw new ApiError(0, "No connection. Check your internet.")
      await sleep(600 * (i + 1))
    }
  }
  let data = {}
  try { data = await res.json() } catch (_) {}
  if (res.status === 401 && !quiet) onAuth(res.status, data)
  if (!res.ok) throw new ApiError(res.status, data.error || `Error ${res.status}`, data)
  return data
}

let toastT
export function toast(msg, kind = "") {
  const t = $("#toast")
  t.textContent = msg
  t.className = `toast ${kind}`
  t.hidden = false
  clearTimeout(toastT)
  toastT = setTimeout(() => (t.hidden = true), 2600)
}

export function sheet(title, { onClose } = {}) {
  const body = el("div", { class: "sheet-body" })
  const close = el("button", { class: "icon-btn", type: "button", "aria-label": "Close" }, icon("x"))
  const d = el("dialog", { class: "sheet" }, el("div", { class: "sheet-head" }, el("h2", { text: title }), close), body)
  const done = () => { if (d.open) d.close() }
  close.onclick = done
  d.addEventListener("click", (e) => { if (e.target === d) done() })
  d.addEventListener("close", () => { d.remove(); onClose && onClose() })
  document.body.append(d)
  d.showModal()
  return { dialog: d, body, close: done }
}

export async function busy(btn, fn) {
  btn.disabled = true
  btn.classList.add("loading")
  try { return await fn() } finally { btn.disabled = false; btn.classList.remove("loading") }
}

export const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v) } catch (_) { return d } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch (_) {} },
}

const nf = new Intl.NumberFormat("id-ID")
export const rp = (n) => (n < 0 ? "−Rp" : "Rp") + nf.format(Math.abs(Math.round(n || 0)))
export function rpShort(n) {
  const a = Math.abs(n || 0), s = n < 0 ? "−" : ""
  if (a >= 1e9) return `${s}Rp${(a / 1e9).toFixed(1).replace(".", ",").replace(",0", "")}M`
  if (a >= 1e6) return `${s}Rp${(a / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(".", ",").replace(",0", "")}jt`
  if (a >= 1e3) return `${s}Rp${Math.round(a / 1e3)}rb`
  return `${s}Rp${a}`
}
export const num = (n) => nf.format(Math.round(n || 0))

export function avatar(p, cls = "") {
  return el("span", { class: `av ${cls}`, style: { "--c": p?.color || "#ccc" }, title: p?.name || "" }, p?.avatar || "🙂")
}

export function confetti(n = 90) {
  const box = el("div", { class: "confetti" })
  const colors = ["#e07a5f", "#e3a93b", "#3d8b7a", "#4f8fcb", "#d9667e", "#8e6c9e"]
  for (let i = 0; i < n; i++) {
    box.append(el("i", { style: { left: `${Math.random() * 100}%`, background: colors[i % colors.length],
      animationDuration: `${2 + Math.random() * 2.5}s`, animationDelay: `${Math.random() * .8}s`, transform: `rotate(${Math.random() * 360}deg)` } }))
  }
  document.body.append(box)
  setTimeout(() => box.remove(), 5500)
}

export function share(text, url) {
  if (navigator.share) return navigator.share({ text, url }).catch(() => {})
  window.open(`https://wa.me/?text=${encodeURIComponent(text + " " + url)}`, "_blank")
}
