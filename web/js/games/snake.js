// Snake arena: drag to steer, hold 🚀 to boost. The browser rebuilds each body from the stream of head positions.
import { el } from "../lib.js?v=__VERSION__"

const FOOD_COLS = ["#f7a6c1", "#8fcfee", "#b8e986", "#fcd34d"]
const SKINS = ["stripes", "spots", "diamond", "zigzag", "gradient", "rainbow"]

function shade(hex, amt) {
  const n = parseInt(hex.replace("#", "").padEnd(6, "0").slice(0, 6), 16)
  const f = (c) => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)))
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`
}
function skinOf(id) { let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return SKINS[h % SKINS.length] }

// A snake: shadow, tapered body with shading, a skin pattern, then the head with eyes and a flicking tongue.
function drawSnake(g, id, sn, tx, ty, zoom, W, H, t) {
  const rad = (9 + Math.min(12, sn.len / 50)) * zoom
  const pts = sn.body.map(([x, y]) => [tx(x), ty(y)])
  const n = pts.length
  const vis = pts.some(([x, y]) => x > -60 && y > -60 && x < W + 60 && y < H + 60)
  if (!vis) return
  const skin = skinOf(id)
  const base = sn.color, dark = shade(base, -0.35), light = shade(base, 0.35)
  const radAt = (i) => rad * (i < n * 0.7 ? 1 : 0.35 + 0.65 * (1 - (i - n * 0.7) / (n * 0.3)))
  g.lineCap = "round"; g.lineJoin = "round"
  // shadow
  g.globalAlpha = 0.28
  g.strokeStyle = "#000"
  strokeBody(g, pts, radAt, 2, 4 * zoom, 4 * zoom)
  g.globalAlpha = 1
  // outline, body, highlight
  g.strokeStyle = dark; strokeBody(g, pts, radAt, 2.2)
  if (skin === "gradient") {
    for (let i = n - 1; i > 0; i--) {
      g.strokeStyle = shade(base, 0.45 * (i / n) - 0.05)
      g.lineWidth = radAt(i) * 1.8
      g.beginPath(); g.moveTo(...pts[i]); g.lineTo(...pts[i - 1]); g.stroke()
    }
  } else if (skin === "rainbow") {
    for (let i = n - 1; i > 0; i--) {
      g.strokeStyle = `hsl(${(i * 7 + t * 60) % 360} 75% 58%)`
      g.lineWidth = radAt(i) * 1.8
      g.beginPath(); g.moveTo(...pts[i]); g.lineTo(...pts[i - 1]); g.stroke()
    }
  } else { g.strokeStyle = base; strokeBody(g, pts, radAt, 1.8) }
  // pattern
  if (skin === "stripes") {
    g.strokeStyle = dark
    for (let i = 4; i < n - 2; i += 6) { g.lineWidth = radAt(i) * 1.7; g.beginPath(); g.moveTo(...pts[i]); g.lineTo(...pts[Math.min(n - 1, i + 2)]); g.stroke() }
  } else if (skin === "spots") {
    g.fillStyle = light
    for (let i = 3; i < n - 2; i += 4) { const [x, y] = pts[i]; const o = (i % 8 < 4 ? 1 : -1) * radAt(i) * 0.35; g.beginPath(); g.arc(x + o, y - o, radAt(i) * 0.3, 0, Math.PI * 2); g.fill() }
  } else if (skin === "diamond") {
    g.fillStyle = dark
    for (let i = 4; i < n - 2; i += 5) {
      const [x, y] = pts[i], [x2, y2] = pts[Math.max(0, i - 1)]
      const a = Math.atan2(y2 - y, x2 - x), r = radAt(i) * 0.75
      g.beginPath(); g.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); g.lineTo(x + Math.cos(a + 1.57) * r * .6, y + Math.sin(a + 1.57) * r * .6)
      g.lineTo(x - Math.cos(a) * r, y - Math.sin(a) * r); g.lineTo(x + Math.cos(a - 1.57) * r * .6, y + Math.sin(a - 1.57) * r * .6); g.closePath(); g.fill()
    }
  } else if (skin === "zigzag") {
    g.strokeStyle = light; g.lineWidth = Math.max(1.5, rad * 0.25)
    g.beginPath()
    for (let i = 1; i < n - 1; i++) {
      const [x, y] = pts[i], [x2, y2] = pts[i - 1]
      const a = Math.atan2(y2 - y, x2 - x) + Math.PI / 2, o = (i % 4 < 2 ? 1 : -1) * radAt(i) * 0.5
      const px = x + Math.cos(a) * o, py = y + Math.sin(a) * o
      if (i === 1) g.moveTo(px, py); else g.lineTo(px, py)
    }
    g.stroke()
  }
  // glossy highlight along the back
  g.globalAlpha = 0.28; g.strokeStyle = "#fff"; strokeBody(g, pts, radAt, 0.55, -rad * 0.3, -rad * 0.3); g.globalAlpha = 1
  // head
  const [hx, hy] = pts[0], a = sn.a
  if (sn.boost) { g.fillStyle = shade(base, 0.5) + ""; g.globalAlpha = 0.35; g.beginPath(); g.arc(hx, hy, rad * 1.8, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1 }
  // tongue flicks every ~1.6 s
  if ((t + id.length * 0.37) % 1.6 < 0.22) {
    const L = rad * 1.5, bx = hx + Math.cos(a) * rad * 1.05, by = hy + Math.sin(a) * rad * 1.05
    g.strokeStyle = "#e5484d"; g.lineWidth = Math.max(1.2, rad * 0.14)
    g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + Math.cos(a) * L, by + Math.sin(a) * L)
    g.lineTo(bx + Math.cos(a + 0.4) * L * 1.25, by + Math.sin(a + 0.4) * L * 1.25)
    g.moveTo(bx + Math.cos(a) * L, by + Math.sin(a) * L); g.lineTo(bx + Math.cos(a - 0.4) * L * 1.25, by + Math.sin(a - 0.4) * L * 1.25); g.stroke()
  }
  g.save(); g.translate(hx, hy); g.rotate(a)
  g.fillStyle = dark; g.beginPath(); g.ellipse(0, 0, rad * 1.32, rad * 1.12, 0, 0, Math.PI * 2); g.fill()
  g.fillStyle = skin === "rainbow" ? `hsl(${(t * 60) % 360} 75% 58%)` : base; g.beginPath(); g.ellipse(0, 0, rad * 1.22, rad * 1.02, 0, 0, Math.PI * 2); g.fill()
  g.fillStyle = "rgba(255,255,255,.25)"; g.beginPath(); g.ellipse(-rad * 0.1, -rad * 0.35, rad * 0.7, rad * 0.35, 0, 0, Math.PI * 2); g.fill()
  for (const side of [-1, 1]) {
    g.fillStyle = "#fff"; g.beginPath(); g.ellipse(rad * 0.45, side * rad * 0.48, rad * 0.36, rad * 0.32, 0, 0, Math.PI * 2); g.fill()
    g.fillStyle = "#111"; g.beginPath(); g.arc(rad * 0.58, side * rad * 0.46, rad * 0.17, 0, Math.PI * 2); g.fill()
    g.fillStyle = "#fff"; g.beginPath(); g.arc(rad * 0.62, side * rad * 0.42 - rad * 0.05, rad * 0.06, 0, Math.PI * 2); g.fill()
  }
  g.fillStyle = dark; g.beginPath(); g.arc(rad * 1.05, -rad * 0.2, rad * 0.07, 0, Math.PI * 2); g.arc(rad * 1.05, rad * 0.2, rad * 0.07, 0, Math.PI * 2); g.fill()
  g.restore()
  g.font = `800 ${Math.round(12 * zoom * 1.4)}px Nunito, sans-serif`
  g.fillStyle = "rgba(255,255,255,.9)"; g.textAlign = "center"
  g.fillText(sn.bot ? sn.name : `${sn.avatar || ""} ${sn.name}`, hx, hy - rad * 1.4 - 6 * zoom)
}
// Strokes the body as a tapered polyline (width = radius × k), optionally offset (for shadow/highlight).
function strokeBody(g, pts, radAt, k, dx = 0, dy = 0) {
  const n = pts.length
  if (n === 1) { g.beginPath(); g.arc(pts[0][0] + dx, pts[0][1] + dy, radAt(0) * k / 2, 0, Math.PI * 2); g.fillStyle = g.strokeStyle; g.fill(); return }
  // draw in a few chunks so the tail can taper
  const chunk = 6
  for (let s = n - 1; s > 0; s -= chunk) {
    const e = Math.max(0, s - chunk)
    g.lineWidth = radAt(s) * k
    g.beginPath(); g.moveTo(pts[s][0] + dx, pts[s][1] + dy)
    for (let i = s - 1; i >= e; i--) g.lineTo(pts[i][0] + dx, pts[i][1] + dy)
    g.stroke()
  }
}

export function mount(stage, ctx) {
  const info = el("div", { class: "row between small", style: { padding: "0 4px 6px", fontWeight: 800 } })
  const wrap = el("div", { style: { position: "relative", width: "100%", maxWidth: "760px", margin: "0 auto", height: "max(300px, calc(100dvh - 235px))", borderRadius: "22px", overflow: "hidden", boxShadow: "var(--shadow-lg)", touchAction: "none", background: "#1f2b25" } })
  const cv = el("canvas", { style: { width: "100%", height: "100%", display: "block", touchAction: "none" } })
  const boost = el("button", { type: "button", style: { position: "absolute", right: "14px", bottom: "14px", width: "70px", height: "70px", borderRadius: "50%", border: 0, fontSize: "30px", background: "rgba(255,255,255,.85)", boxShadow: "var(--shadow)" }, text: "🚀" })
  const board = el("div", { style: { position: "absolute", left: "10px", top: "10px", background: "rgba(0,0,0,.35)", color: "#fff", borderRadius: "12px", padding: "6px 10px", fontSize: "12px", fontWeight: 800 } })
  wrap.append(cv, boost, board)
  stage.append(info, wrap)
  const g = cv.getContext("2d")
  const S = { snakes: {}, food: new Map(), r: 1100, last: 0, prevHeads: {}, frameAt: 0 }
  let angle = 0, boosting = false, sentAt = 0, sentAngle = null, running = true, V = null

  const fit = () => {
    const r = wrap.getBoundingClientRect()
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    cv.width = Math.round(r.width * dpr)
    cv.height = Math.round(r.height * dpr)
  }
  const ro = new ResizeObserver(fit)
  ro.observe(wrap)
  fit()

  // ---- controls: floating analog stick (touch anywhere), boost button, arrow keys ----
  const stick = el("div", { class: "sn-stick", hidden: true }, el("i"))
  const knob = stick.firstChild
  wrap.append(stick)
  let stickId = null, sx = 0, sy = 0
  function sendInput(force = false) {
    const now = performance.now()
    if (!force && now - sentAt < 60 && sentAngle !== null && Math.abs(angle - sentAngle) < .05) return
    sentAt = now
    sentAngle = angle
    ctx.raw({ t: "input", d: { a: angle, b: boosting } })
  }
  const R = 46
  wrap.addEventListener("pointerdown", (e) => {
    if (e.target === boost || e.target.closest(".sn-btn")) return
    if (e.pointerType === "mouse") { const r = cv.getBoundingClientRect(); angle = Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)); sendInput(true); return }
    e.preventDefault()
    stickId = e.pointerId
    wrap.setPointerCapture(e.pointerId)
    const r = wrap.getBoundingClientRect()
    sx = e.clientX - r.left; sy = e.clientY - r.top
    stick.style.left = `${sx}px`; stick.style.top = `${sy}px`
    knob.style.transform = ""
    stick.hidden = false
  })
  wrap.addEventListener("pointermove", (e) => {
    if (e.pointerType === "mouse" && e.buttons) { const r = cv.getBoundingClientRect(); angle = Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)); sendInput(); return }
    if (e.pointerId !== stickId) return
    const r = wrap.getBoundingClientRect()
    let dx = e.clientX - r.left - sx, dy = e.clientY - r.top - sy
    const d = Math.hypot(dx, dy)
    if (d > R) { dx *= R / d; dy *= R / d }
    knob.style.transform = `translate(${dx}px, ${dy}px)`
    if (d > 8) { angle = Math.atan2(dy, dx); sendInput() }
  })
  const endStick = (e) => { if (e.pointerId === stickId) { stickId = null; stick.hidden = true } }
  wrap.addEventListener("pointerup", endStick)
  wrap.addEventListener("pointercancel", endStick)
  const setBoost = (b) => { boosting = b; boost.style.transform = b ? "scale(.9)" : ""; sendInput(true) }
  boost.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); setBoost(true) })
  boost.addEventListener("pointerup", () => setBoost(false))
  boost.addEventListener("pointerleave", () => boosting && setBoost(false))
  const keys = new Set()
  const key = (e) => {
    if (e.code === "Space") { e.preventDefault(); setBoost(e.type === "keydown"); return }
    const k = { ArrowLeft: "l", ArrowRight: "r", ArrowUp: "u", ArrowDown: "d", a: "l", d: "r", w: "u", s: "d" }[e.key]
    if (!k) return
    e.preventDefault()
    if (e.type === "keydown") keys.add(k); else keys.delete(k)
    const dx = (keys.has("r") ? 1 : 0) - (keys.has("l") ? 1 : 0), dy = (keys.has("d") ? 1 : 0) - (keys.has("u") ? 1 : 0)
    if (dx || dy) { angle = Math.atan2(dy, dx); sendInput() }
  }
  document.addEventListener("keydown", key)
  document.addEventListener("keyup", key)

  // ---- fullscreen / landscape game mode ----
  const fsBtn = el("button", { class: "sn-btn sn-fs", type: "button", "aria-label": "Fullscreen", text: "⛶" })
  const rotateHint = el("div", { class: "sn-rotate", hidden: true, text: ctx.L("🔄 Putar HP ke samping untuk arena lebih lebar", "🔄 Turn your phone sideways for a wider arena") })
  const fsInfo = el("div", { class: "sn-fsinfo", hidden: true })
  wrap.append(fsBtn, rotateHint, fsInfo)
  let fs = false
  const portrait = () => window.innerHeight > window.innerWidth
  function updateHint() { rotateHint.hidden = !(fs && portrait() && !document.fullscreenElement) }
  async function enterFs() {
    fs = true
    wrap.classList.add("sn-full")
    fsBtn.textContent = "✕"
    fsInfo.hidden = false
    try { if (wrap.requestFullscreen && !document.fullscreenElement) await wrap.requestFullscreen({ navigationUI: "hide" }) } catch (_) {}
    try { if (screen.orientation && screen.orientation.lock) await screen.orientation.lock("landscape") } catch (_) {}
    updateHint(); setTimeout(fit, 300)
  }
  async function exitFs() {
    fs = false
    wrap.classList.remove("sn-full")
    fsBtn.textContent = "⛶"
    fsInfo.hidden = true
    try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock() } catch (_) {}
    try { if (document.fullscreenElement) await document.exitFullscreen() } catch (_) {}
    updateHint(); setTimeout(fit, 300)
  }
  fsBtn.addEventListener("pointerdown", (e) => e.stopPropagation())
  fsBtn.addEventListener("click", () => (fs ? exitFs() : enterFs()))
  const onFsChange = () => { if (!document.fullscreenElement && fs && wrap.requestFullscreen) exitFs() }
  document.addEventListener("fullscreenchange", onFsChange)
  window.addEventListener("resize", updateHint)

  function onSnap(s) {
    S.snakes = {}
    for (const [id, sn] of Object.entries(s.snakes)) S.snakes[id] = { ...sn, body: sn.body.map((p) => [...p]), boost: 0, avatar: sn.bot ? "" : ctx.player(id).avatar }
    S.food = new Map(s.food.map((f) => [f[0], f]))
    S.r = s.r
  }
  let asked = 0
  function onFrame(f) {
    S.frameAt = performance.now()
    if (f.sn.some(([id]) => !S.snakes[id]) && performance.now() - asked > 1000) {
      asked = performance.now()
      ctx.raw({ t: "snap" })  // missed the start: ask for the full arena
      return
    }
    for (const [id, x, y, a, len, alive, b] of f.sn) {
      const sn = S.snakes[id]
      if (!sn) continue
      S.prevHeads[id] = sn.body[0] ? [...sn.body[0]] : [x, y]
      if (alive) {
        sn.body.unshift([x, y])
        if (sn.body.length > len) sn.body.length = len
      } else if (sn.alive) {
        sn.body = []
        if (id === ctx.me.id) ctx.sfx.lose()
      }
      sn.alive = !!alive
      sn.len = len
      sn.a = a
      sn.boost = b
    }
    for (const fa of f.fa) S.food.set(fa[0], fa)
    for (const fd of f.fd) S.food.delete(fd)
    S.r = f.r
  }

  function render() {
    if (!running) return
    requestAnimationFrame(render)
    const W = cv.width, H = cv.height
    const me = S.snakes[ctx.me.id]
    let cam = me && me.alive && me.body[0] ? me.body[0] : null
    if (!cam) {
      const alive = Object.values(S.snakes).filter((s) => s.alive && s.body[0]).sort((a, b) => b.len - a.len)
      cam = alive[0]?.body[0] || [0, 0]
    }
    const zoom = Math.max(W, H * 0.75) / 500
    const tx = (x) => (x - cam[0]) * zoom + W / 2
    const ty = (y) => (y - cam[1]) * zoom + H / 2
    g.fillStyle = "#16201b"
    g.fillRect(0, 0, W, H)
    // Grid
    g.strokeStyle = "rgba(255,255,255,.04)"
    g.lineWidth = 1
    const step = 80 * zoom
    for (let x = ((W / 2 - cam[0] * zoom) % step + step) % step; x < W; x += step) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke() }
    for (let y = ((H / 2 - cam[1] * zoom) % step + step) % step; y < H; y += step) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke() }
    // Arena
    g.fillStyle = "#223a2e"
    g.beginPath(); g.arc(tx(0), ty(0), S.r * zoom, 0, Math.PI * 2); g.fill()
    g.strokeStyle = "#e5484d"
    g.lineWidth = 5 * zoom
    g.stroke()
    // Food: soft glowing orbs
    for (const [, x, y, v] of S.food.values()) {
      const px = tx(x), py = ty(y)
      if (px < -10 || py < -10 || px > W + 10 || py > H + 10) continue
      const col = v > 1 ? "#f2cf3c" : FOOD_COLS[(x + y) & 3]
      const r0 = (v > 1 ? 5.2 : 3.6) * zoom
      g.fillStyle = col + "40"; g.beginPath(); g.arc(px, py, r0 * 2.1, 0, Math.PI * 2); g.fill()
      g.fillStyle = col; g.beginPath(); g.arc(px, py, r0, 0, Math.PI * 2); g.fill()
      g.fillStyle = "rgba(255,255,255,.7)"; g.beginPath(); g.arc(px - r0 * .3, py - r0 * .35, r0 * .35, 0, Math.PI * 2); g.fill()
    }
    // Snakes
    const t = performance.now() / 1000
    for (const [id, sn] of Object.entries(S.snakes)) {
      if (!sn.alive || !sn.body.length) continue
      drawSnake(g, id, sn, tx, ty, zoom, W, H, t)
    }
    // Mini-map
    const mm = 70 * (W / 700), mx = W - mm - 12, my = 12
    g.fillStyle = "rgba(0,0,0,.35)"; g.beginPath(); g.arc(mx + mm / 2, my + mm / 2, mm / 2, 0, Math.PI * 2); g.fill()
    for (const sn of Object.values(S.snakes)) {
      if (!sn.alive || !sn.body[0]) continue
      g.fillStyle = sn === me ? "#fff" : sn.color
      g.beginPath(); g.arc(mx + mm / 2 + sn.body[0][0] / 1100 * mm / 2, my + mm / 2 + sn.body[0][1] / 1100 * mm / 2, sn === me ? 3 : 2, 0, Math.PI * 2); g.fill()
    }
    // Leaderboard
    const top = Object.entries(S.snakes).filter(([, s]) => s.alive).sort((a, b) => b[1].len - a[1].len).slice(0, 5)
    board.replaceChildren(...top.map(([id, s], i) => el("div", { text: `${i + 1}. ${s.bot ? "🤖" : ctx.player(id).avatar} ${s.name} ${s.len}` })))
    if (me && !me.alive && V && !V.over) {
      g.fillStyle = "rgba(0,0,0,.45)"; g.fillRect(0, H / 2 - 40 * (W / 700), W, 80 * (W / 700))
      g.fillStyle = "#fff"; g.textAlign = "center"; g.font = `bold ${Math.round(26 * W / 700)}px Nunito, sans-serif`
      g.fillText(ctx.L("Kamu tertabrak! Menonton…", "You crashed! Watching…"), W / 2, H / 2 + 9 * W / 700)
    }
  }
  requestAnimationFrame(render)

  return {
    onSnap, onFrame,
    destroy() {
      running = false; ro.disconnect(); document.removeEventListener("keydown", key); document.removeEventListener("keyup", key)
      document.removeEventListener("fullscreenchange", onFsChange); window.removeEventListener("resize", updateHint)
      if (fs) exitFs()
    },
    update(v) {
      V = v
      const alive = Object.entries(v.alive).filter(([, a]) => a).length
      const left = Math.max(0, v.shrink - (ctx.now() || 0))
      fsInfo.textContent = `🐍 ${alive} · ${left > 0 ? `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, "0")}` : "⚠️"}`
      info.replaceChildren(el("span", { text: `🐍 ${alive} ${ctx.L("pemain hidup", "players alive")}` }),
        el("span", { text: left > 0 ? `${ctx.L("Arena menyempit", "Arena shrinks")} · ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, "0")}` : ctx.L("Arena terkecil!", "Smallest arena!") }))
    },
    scores: (v) => v.len,
  }
}
