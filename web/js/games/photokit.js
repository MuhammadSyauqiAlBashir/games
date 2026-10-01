// Camera helpers for the photo games: open the phone camera, shrink the photo to a small JPEG on the phone,
// and send it to the room over HTTPS. Photos stay in the room's memory on the server (never saved).
import { el } from "../lib.js?v=__VERSION__"

async function toJpeg(file, max = 1024) {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.decoding = "async"
    img.src = url
    await img.decode()
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
    const c = document.createElement("canvas")
    c.width = Math.round(img.naturalWidth * k)
    c.height = Math.round(img.naturalHeight * k)
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height)
    return await new Promise((res) => c.toBlob(res, "image/jpeg", 0.82))
  } finally {
    URL.revokeObjectURL(url)
  }
}

// A big camera button. facing: "environment" (back camera) or "user" (selfie).
export function cameraButton(ctx, { facing = "environment", label, round }) {
  const input = el("input", { type: "file", accept: "image/*", capture: facing, hidden: true })
  const btn = el("button", { class: "btn primary big pk-cam", type: "button" }, el("span", { text: "📷" }), el("span", { class: "lbl", text: label }))
  const preview = el("img", { class: "pk-preview", alt: "", hidden: true })
  const wrap = el("div", { class: "pk-cam-wrap" }, preview, btn, input)
  let busy = false
  btn.onclick = () => { if (!busy) input.click() }
  input.onchange = async () => {
    const file = input.files && input.files[0]
    input.value = ""
    if (!file) return
    busy = true
    btn.disabled = true
    btn.querySelector(".lbl").textContent = ctx.L("Mengirim…", "Sending…")
    try {
      const blob = await toJpeg(file)
      if (!blob) throw new Error(ctx.L("Foto tidak bisa dibaca", "Couldn't read the photo"))
      preview.src = URL.createObjectURL(blob)
      preview.hidden = false
      const r = await fetch(`/api/rooms/${ctx.code}/photo?r=${round()}`, { method: "POST", headers: { "X-BG": "1", "Content-Type": "image/jpeg" }, body: blob, credentials: "same-origin" })
      if (!r.ok) {
        let msg = `${r.status}`
        try { msg = (await r.json()).detail || msg } catch { /* not json */ }
        throw new Error(msg)
      }
      ctx.sfx.whoosh()
    } catch (e) {
      ctx.toast(e.message || String(e), "bad")
    } finally {
      busy = false
      btn.disabled = false
      btn.querySelector(".lbl").textContent = label
    }
  }
  return { el: wrap, setLabel(t) { label = t; if (!busy) btn.querySelector(".lbl").textContent = t }, hidePreview() { preview.hidden = true; preview.removeAttribute("src") },
    set enabled(on) { btn.disabled = !on || busy; wrap.hidden = !on } }
}

export const photoUrl = (ctx, r, pid) => `/api/rooms/${ctx.code}/photo/${r}/${pid}`

export const privacyNote = (ctx) => el("p", { class: "small muted center pk-note",
  text: ctx.L("🔒 Foto hanya untuk ronde ini: dinilai Google Gemini, tidak disimpan di server.", "🔒 Photos are only for this round: judged by Google Gemini, never saved on the server.") })
