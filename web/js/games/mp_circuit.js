// Boss Sumo Bro Blitzers: turn the circuit tiles so the current reaches your platform — then ZAP the boss!
// Everyone solves the same puzzle; fastest gets 5, then 3, 2, 1.
import { el, svg } from "../lib.js?v=__VERSION__"
import { banner, kit, loop, popText } from "./mp.js?v=__VERSION__"

const SH = { I: [0, 2], L: [0, 1], T: [0, 1, 3], X: [0, 1, 2, 3] }
const sides = (s, r) => new Set(SH[s].map((d) => (d + r) % 4))

export function mount(stage, ctx) {
  const K = kit(stage, ctx)
  const box = el("div", { class: "mp", style: { background: "linear-gradient(#2a2250,#140f2a)" } })
  const q = el("div", { class: "mp-q" })
  const note = el("div", { class: "mp-note" })
  stage.append(box, q, note)
  const g = svg("svg", { viewBox: "0 0 100 92" })
  box.append(g)
  const boss = svg("g", { transform: "translate(50 11)" }, svg("ellipse", { cy: 6, rx: 16, ry: 4, fill: "#e8f4ff", opacity: 0.8 }), svg("text", { "text-anchor": "middle", "dominant-baseline": "central", "font-size": 13, text: "🥋" }))
  const grid = svg("g"), fx = svg("g")
  g.append(boss, grid, fx)
  let V = null, rk = "", rot = null, lastTap = 0, cells = []
  const N = 5, CS = 14, OX = 15, OY = 22

  function lit(tiles, r) {
    const on = new Set(), start = [0, 2]
    if (!sides(tiles[start[1] * N], r[start[1] * N]).has(3)) return { on, done: false }
    const st = [start]; on.add(start[1] * N)
    let done = false
    while (st.length) {
      const [x, y] = st.pop()
      const op = sides(tiles[y * N + x], r[y * N + x])
      if (x === N - 1 && y === 2 && op.has(1)) done = true
      for (const [d, dx, dy] of [[0, 0, -1], [1, 1, 0], [2, 0, 1], [3, -1, 0]]) {
        if (!op.has(d)) continue
        const nx = x + dx, ny = y + dy
        if (nx < 0 || ny < 0 || nx >= N || ny >= N || on.has(ny * N + nx)) continue
        if (sides(tiles[ny * N + nx], r[ny * N + nx]).has((d + 2) % 4)) { on.add(ny * N + nx); st.push([nx, ny]) }
      }
    }
    return { on, done }
  }
  function build(v) {
    grid.replaceChildren(svg("rect", { x: OX - 2, y: OY - 2, width: N * CS + 4, height: N * CS + 4, rx: 3, fill: "#0c0a1a", stroke: "#5b4ab8", "stroke-width": 0.8 }),
      svg("text", { x: OX - 8, y: OY + 2.5 * CS, "text-anchor": "middle", "dominant-baseline": "central", "font-size": 8, text: "⚡" }))
    const me = ctx.player(ctx.me.id)
    grid.append(svg("g", { transform: `translate(${OX + N * CS + 7} ${OY + 2.5 * CS})` }, svg("rect", { x: -5, y: -5, width: 10, height: 10, rx: 2, fill: me.color }), svg("text", { "text-anchor": "middle", "dominant-baseline": "central", "font-size": 6, text: me.avatar })))
    cells = v.tiles.map((t, i) => {
      const x = OX + (i % N) * CS, y = OY + Math.floor(i / N) * CS
      const wire = svg("g")
      const c = svg("g", { transform: `translate(${x + CS / 2} ${y + CS / 2})`, class: "mp-tap" }, svg("rect", { x: -CS / 2 + 0.5, y: -CS / 2 + 0.5, width: CS - 1, height: CS - 1, rx: 1.6, fill: "#221c40" }), wire)
      c.addEventListener("pointerdown", () => tap(i))
      grid.append(c)
      return { c, wire, t }
    })
  }
  function paint() {
    if (!V || !rot) return
    const { on } = lit(V.tiles, rot)
    cells.forEach((cl, i) => {
      const lt = on.has(i)
      cl.wire.replaceChildren(...[...SH[cl.t]].map((d) => svg("line", { x1: 0, y1: 0, x2: 0, y2: -CS / 2, stroke: lt ? "#ffe14a" : "#7a86b8", "stroke-width": 2.6, "stroke-linecap": "round", transform: `rotate(${d * 90})` })),
        svg("circle", { r: 2, fill: lt ? "#ffe14a" : "#7a86b8" }))
      cl.wire.setAttribute("transform", `rotate(${rot[i] * 90})`)
    })
  }
  function tap(i) {
    if (!V || V.phase !== "play" || (V.solved || []).includes(ctx.me.id)) return
    rot[i] = (rot[i] + 1) % 4
    lastTap = performance.now()
    ctx.sfx.click()
    paint()
    ctx.send({ i })
  }
  const stop = loop(ctx, (now) => { boss.setAttribute("transform", `translate(50 ${(11 + Math.sin(now * 2) * 1).toFixed(2)})`) })
  return {
    destroy: stop,
    scores: (v) => v.scores,
    update(v, events) {
      V = v
      K.update(v, events, box)
      const key = `${v.round}:${v.tiles.join("")}`
      if (key !== rk && v.tiles.length) { rk = key; rot = [...(v.mine || [])]; build(v) }
      else if (v.mine && performance.now() - lastTap > 700) rot = [...v.mine]
      paint()
      const solved = v.solved || []
      q.replaceChildren(ctx.L("Putar ubin (ketuk) supaya listrik ⚡ sampai ke kotakmu!", "Turn the tiles (tap) so the current ⚡ reaches your platform!"),
        el("small", { text: solved.length ? ctx.L(`Sudah nyambung: ${solved.map((p) => ctx.player(p).avatar).join(" ")}`, `Connected: ${solved.map((p) => ctx.player(p).avatar).join(" ")}`) : ctx.L("Tercepat: 5 poin", "Fastest: 5 points") }))
      note.textContent = solved.includes(ctx.me.id) ? ctx.L("⚡ Nyambung! Tunggu yang lain…", "⚡ Connected! Waiting for the others…") : ""
      for (const e of events) {
        if (e.e === "round") ctx.sfx.pop()
        if (e.e === "solved") { if (e.who === ctx.me.id) { ctx.sfx.fanfare(); banner(box, "ZAP!", { kind: "good", ms: 1200 }) } else popText(box, `${ctx.player(e.who).avatar} ⚡`, 50, 20) }
        if (e.e === "zap") { ctx.sfx.boom(); boss.classList.remove("mp-shake"); void box.offsetWidth; boss.classList.add("mp-shake") }
      }
    },
  }
}
