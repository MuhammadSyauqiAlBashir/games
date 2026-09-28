// Snake arena: drag to steer, hold 🚀 to boost. The browser rebuilds each body from the stream of head positions.
import { el } from "../lib.js?v=__VERSION__"

export function mount(stage, ctx) {
  const info = el("div", { class: "row between small", style: { padding: "0 4px 6px", fontWeight: 800 } })
  const wrap = el("div", { style: { position: "relative", width: "100%", maxWidth: "760px", margin: "0 auto", aspectRatio: "1", maxHeight: "calc(100dvh - 210px)", borderRadius: "22px", overflow: "hidden", boxShadow: "var(--shadow-lg)", touchAction: "none", background: "#1f2b25" } })
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

  function steer(e) {
    const r = cv.getBoundingClientRect()
    angle = Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2))
    sendInput()
  }
  function sendInput(force = false) {
    const now = performance.now()
    if (!force && now - sentAt < 60 && sentAngle !== null && Math.abs(angle - sentAngle) < .05) return
    sentAt = now
    sentAngle = angle
    ctx.raw({ t: "input", d: { a: angle, b: boosting } })
  }
  cv.addEventListener("pointerdown", (e) => { cv.setPointerCapture(e.pointerId); steer(e) })
  cv.addEventListener("pointermove", (e) => { if (e.pointerType === "mouse" || e.buttons) steer(e) })
  const setBoost = (b) => { boosting = b; boost.style.transform = b ? "scale(.9)" : ""; sendInput(true) }
  boost.addEventListener("pointerdown", (e) => { e.preventDefault(); setBoost(true) })
  boost.addEventListener("pointerup", () => setBoost(false))
  boost.addEventListener("pointerleave", () => boosting && setBoost(false))
  const key = (e) => { if (e.code === "Space") { e.preventDefault(); setBoost(e.type === "keydown") } }
  document.addEventListener("keydown", key)
  document.addEventListener("keyup", key)

  function onSnap(s) {
    S.snakes = {}
    for (const [id, sn] of Object.entries(s.snakes)) S.snakes[id] = { ...sn, body: sn.body.map((p) => [...p]), boost: 0 }
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
    const zoom = W / 650
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
    // Food
    for (const [, x, y, v] of S.food.values()) {
      const px = tx(x), py = ty(y)
      if (px < -10 || py < -10 || px > W + 10 || py > H + 10) continue
      g.fillStyle = v > 1 ? "#f2cf3c" : ["#f7a6c1", "#8fcfee", "#b8e986", "#fcd34d"][(x + y) & 3]
      g.beginPath(); g.arc(px, py, (v > 1 ? 5 : 3.5) * zoom, 0, Math.PI * 2); g.fill()
    }
    // Snakes
    for (const [id, sn] of Object.entries(S.snakes)) {
      if (!sn.alive || !sn.body.length) continue
      const rad = (9 + Math.min(12, sn.len / 50)) * zoom
      g.fillStyle = sn.color
      for (let i = sn.body.length - 1; i >= 0; i -= 1) {
        const [x, y] = sn.body[i]
        const px = tx(x), py = ty(y)
        if (px < -40 || py < -40 || px > W + 40 || py > H + 40) continue
        g.globalAlpha = i % 6 < 3 ? 1 : .85
        g.beginPath(); g.arc(px, py, rad, 0, Math.PI * 2); g.fill()
      }
      g.globalAlpha = 1
      const [hx, hy] = sn.body[0]
      const hpx = tx(hx), hpy = ty(hy)
      if (sn.boost) { g.strokeStyle = "rgba(255,255,255,.5)"; g.lineWidth = 3 * zoom; g.beginPath(); g.arc(hpx, hpy, rad * 1.3, 0, Math.PI * 2); g.stroke() }
      for (const side of [-1, 1]) {
        const ex = hpx + Math.cos(sn.a + side * .6) * rad * .55, ey = hpy + Math.sin(sn.a + side * .6) * rad * .55
        g.fillStyle = "#fff"; g.beginPath(); g.arc(ex, ey, rad * .32, 0, Math.PI * 2); g.fill()
        g.fillStyle = "#111"; g.beginPath(); g.arc(ex + Math.cos(sn.a) * rad * .12, ey + Math.sin(sn.a) * rad * .12, rad * .16, 0, Math.PI * 2); g.fill()
      }
      g.font = `${Math.round(12 * zoom * 1.4)}px Nunito, sans-serif`
      g.fillStyle = "rgba(255,255,255,.85)"
      g.textAlign = "center"
      g.fillText(sn.bot ? sn.name : `${ctx.player(id).avatar} ${sn.name}`, hpx, hpy - rad - 6 * zoom)
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
    destroy() { running = false; ro.disconnect(); document.removeEventListener("keydown", key); document.removeEventListener("keyup", key) },
    update(v) {
      V = v
      const alive = Object.entries(v.alive).filter(([, a]) => a).length
      const left = Math.max(0, v.shrink - (ctx.now() || 0))
      info.replaceChildren(el("span", { text: `🐍 ${alive} ${ctx.L("pemain hidup", "players alive")}` }),
        el("span", { text: left > 0 ? `${ctx.L("Arena menyempit", "Arena shrinks")} · ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, "0")}` : ctx.L("Arena terkecil!", "Smallest arena!") }))
    },
    scores: (v) => v.len,
  }
}
