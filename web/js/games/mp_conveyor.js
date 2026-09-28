// Coin Conveyor: place block pieces on a 7×7 grid. Fill a row or column to clear it and bank its coins;
// Bob-ombs blow up the blocks around them. Everyone gets the same pieces.
import { el, svg } from "../lib.js?v=__VERSION__"
import { banner, bobomb, coin, loop, popText, reporter, rng, soloFrame } from "./mp.js?v=__VERSION__"

const N = 7
const SHAPES = [[[0, 0]], [[0, 0], [1, 0]], [[0, 0], [0, 1]], [[0, 0], [1, 0], [2, 0]], [[0, 0], [0, 1], [0, 2]], [[0, 0], [1, 0], [0, 1]],
  [[0, 0], [1, 0], [1, 1]], [[0, 0], [1, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [2, 0], [1, 1]], [[0, 0], [0, 1], [0, 2], [1, 2]], [[0, 0], [1, 0], [2, 0], [3, 0]], [[1, 0], [0, 1], [1, 1], [2, 1]]]

export function mount(stage, ctx) {
  const S = soloFrame(stage, ctx, { bg: "linear-gradient(#5b6b8a,#39455e)", scoreLabel: "🪙" })
  const R = reporter(ctx)
  const g = svg("svg", { viewBox: "0 0 100 100" })
  S.box.append(g)
  const tray = el("div", { class: "cv-tray" })
  const trash = el("button", { class: "mp-btn gray", type: "button", text: "🗑️", onclick: () => discard() })
  S.ctrl.append(tray, trash)
  let V = null, key = "", G = null

  function newGame(seed) {
    const r = rng(seed)
    const piece = () => {
      const sh = SHAPES[Math.floor(r() * SHAPES.length)]
      return sh.map(([x, y]) => ({ x, y, k: r() < 0.14 ? "B" : r() < 0.18 ? "R" : "C" }))
    }
    G = { r, piece, grid: Array(N * N).fill(null), tray: [piece(), piece(), piece()], sel: 0, coins: 0 }
  }

  function fits(p, ox, oy) { return p.every((c) => { const x = ox + c.x, y = oy + c.y; return x >= 0 && y >= 0 && x < N && y < N && !G.grid[y * N + x] }) }

  function place(ox, oy) {
    if (!G || !V || V.phase !== "play") return
    const p = G.tray[G.sel]
    if (!p) return
    const minx = Math.min(...p.map((c) => c.x)), miny = Math.min(...p.map((c) => c.y))
    if (!fits(p, ox - minx, oy - miny)) { ctx.sfx.wrong(); return }
    for (const c of p) G.grid[(oy - miny + c.y) * N + (ox - minx + c.x)] = c.k
    ctx.sfx.place()
    G.tray[G.sel] = null
    clear()
    if (G.tray.every((x) => !x)) G.tray = [G.piece(), G.piece(), G.piece()]
    G.sel = G.tray.findIndex((x) => x)
    R.set(G.coins)
    draw()
  }

  function clear() {
    const lines = []
    for (let y = 0; y < N; y++) if ([...Array(N).keys()].every((x) => G.grid[y * N + x])) lines.push([...Array(N).keys()].map((x) => y * N + x))
    for (let x = 0; x < N; x++) if ([...Array(N).keys()].every((y) => G.grid[y * N + x])) lines.push([...Array(N).keys()].map((y) => y * N + x))
    if (!lines.length) return
    const kill = new Set(lines.flat())
    for (const i of [...kill]) if (G.grid[i] === "B") {
      const x = i % N, y = Math.floor(i / N)
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < N && yy < N && G.grid[yy * N + xx]) kill.add(yy * N + xx) }
    }
    let got = 0, booms = 0
    for (const i of kill) { if (G.grid[i] === "C") got += 1; if (G.grid[i] === "R") got += 3; if (G.grid[i] === "B") booms++; G.grid[i] = null }
    got += (lines.length - 1) * 3
    G.coins += got
    if (booms) ctx.sfx.boom(); else ctx.sfx.coin()
    popText(S.box, `+${got} 🪙`, 50, 40)
    if (lines.length > 1) banner(S.box, `COMBO ×${lines.length}!`, { kind: "good", ms: 1000 })
  }

  function discard() {
    if (!G || V?.phase !== "play" || !G.tray[G.sel]) return
    G.tray[G.sel] = null
    if (G.tray.every((x) => !x)) G.tray = [G.piece(), G.piece(), G.piece()]
    G.sel = G.tray.findIndex((x) => x)
    ctx.sfx.swoosh()
    draw()
  }

  function cellNode(k, x, y, s) {
    const grp = svg("g", { transform: `translate(${x} ${y})` }, svg("rect", { x: 0.4, y: 0.4, width: s - 0.8, height: s - 0.8, rx: 1.4, fill: "#d89a3c", stroke: "#8a5a12", "stroke-width": 0.5 }))
    if (k === "C") grp.append(svg("g", { transform: `translate(${s / 2} ${s / 2})` }, coin(s * 0.28)))
    if (k === "R") grp.append(svg("g", { transform: `translate(${s / 2} ${s / 2})` }, svg("circle", { r: s * 0.3, fill: "#e5484d", stroke: "#8a1c1c", "stroke-width": 0.5 })))
    if (k === "B") grp.append(svg("g", { transform: `translate(${s / 2} ${s / 2 + 0.6})` }, bobomb(s * 0.26, false)))
    return grp
  }

  function draw() {
    g.replaceChildren()
    const s = 12.4, o = (100 - s * N) / 2
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const k = G && G.grid[y * N + x]
      const cell = svg("rect", { x: o + x * s + 0.3, y: o + y * s + 0.3, width: s - 0.6, height: s - 0.6, rx: 1.2, fill: "rgba(255,255,255,.12)", class: "mp-tap" })
      cell.addEventListener("click", () => place(x, y))
      g.append(cell)
      if (k) { const n = cellNode(k, o + x * s, o + y * s, s); n.style.pointerEvents = "none"; g.append(n) }
    }
    tray.replaceChildren(...(G ? G.tray : []).map((p, i) => {
      const t = svg("svg", { viewBox: "0 0 40 40", width: 64, height: 64 })
      if (p) { const w = Math.max(...p.map((c) => c.x)) + 1, h = Math.max(...p.map((c) => c.y)) + 1, cs = 9.5; for (const c of p) t.append(cellNode(c.k, 20 - (w * cs) / 2 + c.x * cs, 20 - (h * cs) / 2 + c.y * cs, cs)) }
      return el("button", { class: `cv-piece${G.sel === i ? " on" : ""}`, type: "button", disabled: !p, onclick: () => { G.sel = i; ctx.sfx.click(); draw() } }, t)
    }))
  }

  const stop = loop(ctx, () => {})
  return {
    destroy: stop,
    scores: (v) => v.scores,
    update(v, events) {
      V = v
      S.update(v, events)
      if (v.phase === "play" && key !== `${v.round}:${v.seed}`) { key = `${v.round}:${v.seed}`; newGame(v.seed); R.reset(); draw() }
      if (!G) { newGame(1); draw() }
      S.q.replaceChildren(ctx.L(`Koinmu: 🪙 ${G.coins}`, `Your coins: 🪙 ${G.coins}`), el("small", { text: ctx.L("Pilih potongan di bawah, lalu ketuk petak. Penuhi baris/kolom untuk ambil koin. 💣 meledakkan sekitarnya.", "Pick a piece below, then tap a square. Fill a row/column to bank coins. 💣 blows up its neighbours.") }))
    },
  }
}
