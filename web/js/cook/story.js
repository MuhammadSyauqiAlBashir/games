// Wok & Roll story scenes: visual-novel dialogue played inside the 3D kitchen (camera moves to the speaker).
import * as T from "./three.js?v=__VERSION__"
import { el } from "../lib.js?v=__VERSION__"
import { L } from "../i18n.js?v=__VERSION__"
import { sfx } from "../sound.js?v=__VERSION__"
import { Actor, catModel } from "./models.js?v=__VERSION__"
import { CAST } from "./levels.js?v=__VERSION__"

// Where each speaker stands behind the counter: customer spot 0 = left, 1 = middle, 2 = right.
const SPOT = { me: 0, nenek: 1 }

export async function runStory(stage, lines, { chefName = "" } = {}) {
  if (!lines || !lines.length) return
  const { world, box, kit } = stage
  const cast = new Map()
  const head = new T.Vector3()
  function actorFor(who) {
    if (who === "narrator") return null
    if (cast.has(who)) return cast.get(who)
    const c = who === "me" ? { model: kit.model || "q-blonde", hat: kit.hat || "toque" } : CAST[who]
    let entry
    if (c.cat) {
      const m = catModel()
      m.group.position.set(0.4, world.L.y, world.C.z0 + 0.35); m.group.rotation.y = -0.6
      world.root.add(m.group)
      entry = { a: null, root: m.group, h: 0.4, cat: m }
    } else {
      const a = new Actor(c.model, { hat: c.hat || null, apron: who === "me" ? "#c8382f" : false, height: 2.2 })
      a.root.position.copy(stage.spot(SPOT[who] ?? 2))
      world.root.add(a.root)
      entry = { a, root: a.root, h: 1.9 }   // face height of a customer-size character
    }
    cast.set(who, entry)
    return entry
  }
  const tick = (dt) => { for (const e of cast.values()) { e.a?.update(dt); e.cat?.update(dt, false, false) } }
  stage.gfx.tickers.add(tick)

  const name = el("b", { class: "ck-say-name" })
  const text = el("p", { class: "ck-say-text" })
  const next = el("span", { class: "ck-say-next", text: "▼" })
  const skip = el("button", { class: "ck-skip", type: "button", text: L("Lewati ⏭", "Skip ⏭") })
  const panel = el("div", { class: "ck-say" }, name, text, next)
  const veil = el("div", { class: "ck-story" }, panel, skip)
  box.append(veil)
  let skipAll = false
  skip.onclick = (e) => { e.stopPropagation(); skipAll = true; veil.dispatchEvent(new Event("pointerdown")) }

  for (const line of lines) {
    if (skipAll) break
    const who = line.who
    const c = CAST[who] || {}
    const ent = actorFor(who)
    name.textContent = who === "me" ? (chefName || L("Kamu", "You")) : L(c.id, c.en)
    name.hidden = !name.textContent
    panel.className = `ck-say ${who === "narrator" ? "narr" : ""}`
    if (ent) {
      ent.root.getWorldPosition(head); head.y += ent.h
      stage.focus(head, ent.cat ? 1.6 : 2.3)
      if (line.emote && ent.a) ent.a.play(line.emote === "emote-yes" ? "yes" : "no", { once: true })
      else if (ent.a) ent.a.play("idle")
    } else stage.focus(null)
    const full = L(line.id, line.en)
    text.textContent = ""
    sfx.blip()
    await new Promise((resolve) => {
      let i = 0, done = false
      const timer = setInterval(() => {
        i += 2
        text.textContent = full.slice(0, i)
        if (i >= full.length) { clearInterval(timer); done = true }
      }, 28)
      const onTap = (e) => {
        if (e.target === skip) return
        if (!done && !skipAll) { clearInterval(timer); text.textContent = full; done = true; return }
        veil.removeEventListener("pointerdown", onTap)
        clearInterval(timer)
        resolve()
      }
      veil.addEventListener("pointerdown", onTap)
    })
  }
  veil.remove()
  stage.gfx.tickers.delete(tick)
  for (const e of cast.values()) e.root.removeFromParent()
  stage.focus(null)
}
