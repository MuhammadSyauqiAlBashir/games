// Congklak: a big wooden board (vertical on phones held upright, horizontal otherwise).
// Moves are replayed slowly: the hand picks the seeds up and drops them one by one.
import { el, svg } from "../lib.js?v=__VERSION__"
import { status } from "./common.js?v=__VERSION__"

const HOLE_R = 4.7
const SEED_COLORS = ["#f6ecd6", "#eadbbd", "#fff6e3", "#e3cfa8", "#f2e2c4"]
const STORES = [7, 15]
// Step timing (ms). The server adds matching extra turn time (Congklak.anim_seconds).
export const stepMs = (k) => (k < 20 ? 420 : Math.max(240, 420 - (k - 20) * 10))

// Seed slot k inside a hole (or a store, stretched along its long axis).
function slot(k, store) {
  const layer = store ? 0 : Math.floor(k / 15)
  const j = store ? k : k % 15
  const a = j * 2.39996
  const rr = (store ? 0.82 : 0.93) * Math.sqrt(j + 0.5)
  return [Math.cos(a) * rr + layer * 0.5, Math.sin(a) * rr - layer * 0.5]
}
const hash = (a, b) => { let h = a * 374761393 + b * 668265263; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296 }

function seedNode(x, y, h, k) {
  const rot = Math.round(hash(h, k) * 180)
  const c = SEED_COLORS[Math.floor(hash(k, h) * SEED_COLORS.length)]
  return svg("g", { transform: `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${rot})` },
    svg("ellipse", { rx: 0.98, ry: 0.74, fill: c, stroke: "rgba(60,35,15,.35)", "stroke-width": 0.14 }),
    svg("ellipse", { cx: -0.25, cy: -0.22, rx: 0.34, ry: 0.2, fill: "rgba(255,255,255,.75)" }),
    svg("line", { x1: 0.1, y1: -0.5, x2: 0.1, y2: 0.5, stroke: "rgba(90,56,31,.35)", "stroke-width": 0.12 }))
}

const ease = { out: (t) => 1 - (1 - t) ** 3, in: (t) => t * t, inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2) }

export function mount(stage, ctx) {
  const st = el("div", { class: "status-line" })
  const wrap = el("div", { class: "cong-wrap" })
  const bar = el("div", { class: "row", style: { justifyContent: "center", gap: "8px", minHeight: "40px", marginTop: "6px" } })
  const note = el("div", { class: "center small muted" })
  stage.append(st, wrap, bar, note)

  let V = null, shown = null, vertical = null, dead = false
  let queue = [], running = false, speed = 1
  let G = null // current board drawing: { g, holes: [], hand, layer, pos() }

  const skipBtn = el("button", { class: "btn", type: "button", hidden: true, text: ctx.L("⏩ Percepat", "⏩ Speed up"), onclick: () => { speed = 6; skipBtn.hidden = true } })
  bar.append(skipBtn)

  // ---- geometry ------------------------------------------------------------------------------------
  // Positions are made on a 100×42 horizontal board, then turned for the upright one.
  function flatPos(i, mySide) {
    if (STORES.includes(i)) {
      const side = i === 7 ? 0 : 1
      return [side === mySide ? 93.2 : 6.8, 21]
    }
    const side = i <= 6 ? 0 : 1
    const k = side === 0 ? i : i - 8
    const bottom = side === mySide
    return [bottom ? 19 + k * 10.33 : 19 + (6 - k) * 10.33, bottom ? 30.6 : 11.4]
  }
  const map = ([x, y]) => (vertical ? [42 - y, x] : [x, y])
  const pos = (i) => map(flatPos(i, mySide()))
  // "Outside" of a hole = where its number goes.
  const labelPos = (i) => { const [x, y] = flatPos(i, mySide()); return map([x, y > 21 ? y + 7.3 : y - 7.3]) }
  const mySide = () => (V && V.side[ctx.me.id] !== undefined ? V.side[ctx.me.id] : 0)
  const seatPos = (i, k) => {
    const [x, y] = pos(i)
    const store = STORES.includes(i)
    let [dx, dy] = slot(k, store)
    if (store) { dx *= 1.05; dy *= 2.3; if (vertical) [dx, dy] = [dy, dx] }
    return [x + dx, y + dy]
  }
  const handPos = (i) => { const [x, y] = pos(i); return [x, y - 6.2] }

  function fit() {
    const isV = window.innerHeight > window.innerWidth * 1.15
    const top = wrap.getBoundingClientRect().top
    const avail = Math.max(190, window.innerHeight - Math.max(0, top) - 70)
    const width = stage.clientWidth || window.innerWidth
    if (isV) {
      const h = Math.min(avail, width * 100 / 42 * 0.98)
      wrap.style.width = `${Math.round(h * 0.42)}px`
      wrap.style.height = `${Math.round(h)}px`
    } else {
      const w = Math.min(width, 1000, avail * 100 / 42)
      wrap.style.width = `${Math.round(w)}px`
      wrap.style.height = `${Math.round(w * 0.42)}px`
    }
    if (isV !== vertical) { vertical = isV; if (V && !running) build(shown) ; else if (V) needRebuild = true }
  }
  let needRebuild = false

  // ---- drawing ------------------------------------------------------------------------------------
  function build(board) {
    if (!V || !board) return
    const W = vertical ? 42 : 100, H = vertical ? 100 : 42
    const g = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "cong-board" })
    g.append(svg("defs", {},
      svg("linearGradient", { id: "cgWood", x1: 0, y1: 0, x2: vertical ? 1 : 0, y2: vertical ? 0 : 1 },
        svg("stop", { offset: "0", "stop-color": "#c99560" }), svg("stop", { offset: ".55", "stop-color": "#b27d48" }), svg("stop", { offset: "1", "stop-color": "#9a6636" })),
      svg("radialGradient", { id: "cgHole", cx: ".45", cy: ".38", r: ".7" },
        svg("stop", { offset: "0", "stop-color": "#4a2c16" }), svg("stop", { offset: ".75", "stop-color": "#6a4325" }), svg("stop", { offset: "1", "stop-color": "#83562f" }))))
    g.append(svg("rect", { x: 0.8, y: 0.8, width: W - 1.6, height: H - 1.6, rx: vertical ? 19 : 19.5, fill: "url(#cgWood)", stroke: "#7d5230", "stroke-width": 0.7 }))
    for (let k = 0; k < 9; k++) {
      const t = 4 + k * (vertical ? 4.3 : 4.1)
      const d = vertical ? `M${t} 8 C ${t + 1.2} 30, ${t - 1.2} 70, ${t} 92` : `M8 ${t} C 30 ${t + 1.2}, 70 ${t - 1.2}, 92 ${t}`
      g.append(svg("path", { d, stroke: "rgba(90,52,22,.16)", "stroke-width": 0.35, fill: "none" }))
    }
    const holes = []
    const turnMine = V.turn === ctx.me.id && !V.over && !running
    for (let i = 0; i < 16; i++) {
      const [x, y] = pos(i)
      const store = STORES.includes(i)
      const side = i <= 7 ? 0 : 1
      const canTap = turnMine && !store && side === mySide() && board[i] > 0
      const hg = svg("g", { class: `cg-hole${canTap ? " can" : ""}${V.last === i && !store ? " last" : ""}` })
      if (store) {
        const [rx, ry] = vertical ? [14.2, 5.4] : [5.4, 14.2]
        hg.append(svg("ellipse", { cx: x, cy: y, rx, ry, fill: "url(#cgHole)", stroke: "#5a381f", "stroke-width": 0.5 }))
      } else {
        hg.append(svg("circle", { class: "rim", cx: x, cy: y, r: HOLE_R + 0.5, fill: "none" }))
        hg.append(svg("circle", { cx: x, cy: y, r: HOLE_R, fill: "url(#cgHole)", stroke: "#5a381f", "stroke-width": 0.45 }))
      }
      const seeds = svg("g")
      hg.append(seeds)
      const [lx, ly] = store ? pos(i) : labelPos(i)
      const lab = svg("g", { class: "cg-count" })
      const labBg = svg("rect", { x: lx - 2.6, y: ly - 1.9, width: 5.2, height: 3.8, rx: 1.9, fill: store ? "rgba(40,22,10,.55)" : "rgba(60,35,15,.35)" })
      const labT = svg("text", { x: lx, y: ly + 1.05, "text-anchor": "middle", "font-size": 2.9, "font-weight": 900, fill: "#fff4e0", text: "" })
      lab.append(labBg, labT)
      if (canTap) {
        hg.append(svg("circle", { cx: x, cy: y, r: HOLE_R + 1.8, fill: "transparent" }))
        hg.style.cursor = "pointer"
        hg.addEventListener("click", () => { if (!running) { ctx.sfx.click(); ctx.send({ hole: i }) } })
      }
      g.append(hg)
      holes[i] = { g: hg, seeds, lab, labT, n: -1 }
    }
    const labels = svg("g")
    for (let i = 0; i < 16; i++) labels.append(holes[i].lab)
    const layer = svg("g", { style: "pointer-events:none" })
    const hand = svg("g", { style: "pointer-events:none", opacity: 0 },
      svg("ellipse", { cx: 0.4, cy: 1.2, rx: 3.4, ry: 1.3, fill: "rgba(0,0,0,.22)" }),
      svg("circle", { r: 3.3, fill: "#fff8ea", stroke: "#8a6038", "stroke-width": 0.45 }),
      svg("text", { class: "hand-n", y: 1.25, "text-anchor": "middle", "font-size": 3.4, "font-weight": 900, fill: "#6b3f1d", text: "" }))
    g.append(labels, layer, hand)
    wrap.replaceChildren(g)
    G = { g, holes, layer, hand, handN: hand.querySelector(".hand-n"), hx: 0, hy: 0, carry: 0 }
    for (let i = 0; i < 16; i++) setCount(i, board[i])
  }

  function setCount(i, n) {
    const h = G.holes[i]
    if (h.n === n) return
    const store = STORES.includes(i)
    const cap = store ? 80 : 30
    // Keep the seeds already drawn; add or remove at the end so nothing jumps.
    while (h.seeds.childNodes.length > Math.min(n, cap)) h.seeds.lastChild.remove()
    for (let k = h.seeds.childNodes.length; k < Math.min(n, cap); k++) { const [x, y] = seatPos(i, k); h.seeds.append(seedNode(x, y, i, k)) }
    h.n = n
    h.labT.textContent = n
  }
  const setHand = (x, y, n) => {
    G.hx = x; G.hy = y
    G.hand.setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)})`)
    if (n !== undefined) { G.carry = n; G.handN.textContent = n; G.hand.setAttribute("opacity", n > 0 ? 1 : 0) }
  }

  // ---- tiny animation kit ---------------------------------------------------------------------------
  const tween = (ms, fn) => new Promise((res) => {
    const dur = Math.max(16, ms / speed)
    const t0 = performance.now()
    const f = (t) => {
      if (dead) return res()
      const p = Math.min(1, (t - t0) / dur)
      fn(p)
      if (p < 1) requestAnimationFrame(f); else res()
    }
    requestAnimationFrame(f)
  })
  const wait = (ms) => tween(ms, () => {})

  async function fly(nodes, to, ms) {
    // nodes: [[node, x, y]] moved to point `to` with a little arc, then removed
    for (const [n] of nodes) G.layer.append(n)
    await tween(ms, (p) => {
      const e = ease.inOut(p)
      nodes.forEach(([n, x, y], k) => {
        const q = Math.min(1, Math.max(0, e * 1.15 - k * 0.004))
        const nx = x + (to[0] - x) * q, ny = y + (to[1] - y) * q - Math.sin(q * Math.PI) * 3
        n.setAttribute("transform", `translate(${nx.toFixed(2)} ${ny.toFixed(2)})`)
      })
    })
    for (const [n] of nodes) n.remove()
  }
  function lift(i) {
    // Take the drawn seeds of hole i as flying nodes (positions in board coordinates).
    const out = []
    const h = G.holes[i]
    const shownN = h.seeds.childNodes.length
    for (let k = 0; k < Math.min(shownN, 24); k++) {
      const [x, y] = seatPos(i, k)
      out.push([svg("g", {}, svg("ellipse", { rx: 0.98, ry: 0.74, fill: SEED_COLORS[k % 5], stroke: "rgba(60,35,15,.35)", "stroke-width": 0.14 })), x, y])
    }
    return out
  }
  async function glide(i) {
    const [x0, y0] = [G.hx, G.hy]
    const [x1, y1] = handPos(i)
    const d = Math.hypot(x1 - x0, y1 - y0)
    const ms = Math.min(260, 110 + d * 7)
    await tween(ms, (p) => { const e = ease.inOut(p); setHand(x0 + (x1 - x0) * e, y0 + (y1 - y0) * e - Math.sin(p * Math.PI) * Math.min(4, d * 0.2)) })
  }
  async function drop(i, board, k) {
    const n = board[i]
    const target = seatPos(i, Math.min(n, (STORES.includes(i) ? 80 : 30) - 1))
    const seed = seedNode(0, 0, i, n)
    G.layer.append(seed)
    const [sx, sy] = [G.hx, G.hy + 0.5]
    setHand(G.hx, G.hy, G.carry - 1)
    await tween(stepMs(k) * 0.42, (p) => {
      const e = ease.in(p)
      const s = 1.35 - 0.35 * p
      seed.setAttribute("transform", `translate(${(sx + (target[0] - sx) * e).toFixed(2)} ${(sy + (target[1] - sy) * e).toFixed(2)}) scale(${s.toFixed(3)})`)
    })
    seed.remove()
    board[i] += 1
    setCount(i, board[i])
    ripple(i)
    ctx.sfx.seed(k)
  }
  function ripple(i) {
    const [x, y] = pos(i)
    const r = svg("circle", { cx: x, cy: y, r: HOLE_R, fill: "none", stroke: "#ffe7a8", "stroke-width": 0.6, class: "cg-ripple" })
    G.layer.append(r)
    setTimeout(() => r.remove(), 600)
  }
  async function scoop(i, board) {
    const n = board[i]
    const nodes = lift(i)
    board[i] = 0
    setCount(i, 0)
    ctx.sfx.scoop()
    const [hx, hy] = handPos(i)
    if (G.carry === 0) setHand(hx, hy)
    await fly(nodes, [hx, hy], 360)
    setHand(hx, hy, G.carry + n)
    await wait(220)
  }

  // ---- replay a move ------------------------------------------------------------------------------
  async function replay(ev) {
    const board = [...shown]
    const side = V.side[ev.who] ?? 0
    const store = STORES[side]
    const hl = G.holes[ev.hole].g
    hl.classList.add("picked")
    const [hx, hy] = handPos(ev.hole)
    setHand(hx, hy, 0)
    await wait(250)
    await scoop(ev.hole, board)
    hl.classList.remove("picked")
    let pick = 0, k = 0
    for (const d of ev.drops) {
      if (dead) return
      if (d === -1) {
        const [h] = ev.pickups[pick++]
        await wait(160)
        await scoop(h, board)
        continue
      }
      await glide(d)
      await drop(d, board, k++)
      await wait(stepMs(k) * 0.2)
    }
    setHand(G.hx, G.hy, 0)
    if (ev.again) { flash(ctx.L("Jalan lagi! 🔁", "Go again! 🔁")); ctx.sfx.turn(); await wait(700) }
    if (ev.capture) {
      const [a, b, n] = ev.capture
      G.holes[a].g.classList.add("hit"); G.holes[b].g.classList.add("hit")
      await wait(450)
      const nodes = [...lift(a), ...lift(b)]
      board[a] = 0; board[b] = 0
      setCount(a, 0); setCount(b, 0)
      ctx.sfx.capture()
      await fly(nodes, pos(store), 650)
      board[store] += n
      setCount(store, board[store])
      flash(ctx.L(`Tembak! +${n} 🎯`, `Captured! +${n} 🎯`))
      await wait(700)
    }
    shown = board
  }
  async function sweepTo(final) {
    // End of game: the remaining seeds go to their owner's store.
    const moves = []
    for (let i = 0; i < 16; i++) if (!STORES.includes(i) && shown[i] && !final[i]) moves.push(i)
    if (!moves.length) return
    await wait(400)
    await Promise.all(moves.map((i) => { const nodes = lift(i); setCount(i, 0); return fly(nodes, pos(i <= 6 ? 7 : 15), 700) }))
  }
  function flash(text) {
    const f = el("div", { class: "cg-flash", text })
    wrap.append(f)
    setTimeout(() => f.remove(), 1400)
  }

  async function run() {
    if (running) return
    running = true
    build(shown)
    skipBtn.hidden = false
    while (queue.length && !dead) {
      const { ev, final } = queue.shift()
      if (queue.length) speed = Math.max(speed, 2.5)
      await replay(ev)
      if (!queue.length) await sweepTo(final)
    }
    running = false
    speed = 1
    skipBtn.hidden = true
    if (dead) return
    shown = V.board
    build(shown)
    drawStatus(V, null)
  }

  function drawStatus(v, ev) {
    const cap = ev && ev.capture
    status(ctx, st, v, { mine: running ? ctx.L("Giliranmu (tunggu biji selesai disebar)…", "Your turn (wait for the seeds)…")
      : cap ? ctx.L("Tembak! Giliranmu", "Captured! Your turn") : ctx.L("Giliranmu — ketuk lubang yang menyala", "Your turn — tap a glowing hole") })
    if (ev && ev.again && v.turn === ev.who) st.textContent += ctx.L(" (jalan lagi!)", " (again!)")
  }

  const onResize = () => fit()
  window.addEventListener("resize", onResize)
  window.addEventListener("orientationchange", onResize)

  return {
    destroy() { dead = true; window.removeEventListener("resize", onResize); window.removeEventListener("orientationchange", onResize) },
    update(v, events) {
      V = v
      if (vertical === null) { fit(); if (!shown) shown = v.board }
      const sows = events.filter((e) => e.e === "sow")
      if (sows.length && shown) {
        for (const ev of sows) queue.push({ ev, final: v.board })
        run()
      } else if (!running) {
        shown = v.board
        build(shown)
      }
      if (needRebuild && !running) { needRebuild = false; build(shown) }
      note.textContent = v.side[ctx.me.id] !== undefined
        ? (vertical ? ctx.L("Lubangmu di kiri, lumbungmu di bawah.", "Your holes are on the left; your store is at the bottom.")
          : ctx.L("Lubangmu di bawah, lumbungmu di kanan.", "Your holes are along the bottom; your store is on the right."))
        : ""
      drawStatus(v, sows[sows.length - 1])
    },
    scores: (v) => Object.fromEntries(Object.entries(v.side).map(([p, sd]) => [p, v.board[sd === 0 ? 7 : 15]])),
  }
}
