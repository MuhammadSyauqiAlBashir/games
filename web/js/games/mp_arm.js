// Robo Arm Wrestle: mash the button with your team to push the robot arm onto the other team's button!
// 2 players: 1v1 · 3 players: 1 vs 2 (the solo player counts double) · 4 players: 2v2. Best of 3.
import { el, svg } from "../lib.js?v=__VERSION__"
import { banner, kit, loop } from "./mp.js?v=__VERSION__"

const TEAM_COL = ["#e5484d", "#2b64e0"]

export function mount(stage, ctx) {
  const K = kit(stage, ctx, { scoreLabel: "🏆" })
  const box = el("div", { class: "mp", style: { background: "linear-gradient(#3a3f4a,#1b1e24)" } })
  const q = el("div", { class: "mp-q" })
  const ctrl = el("div", { class: "mp-ctrl" })
  stage.append(box, q, ctrl)
  const g = svg("svg", { viewBox: "0 0 100 70" })
  box.append(g)
  const t0 = svg("text", { x: 86, y: 12, "text-anchor": "middle", "font-size": 5, "font-weight": 900 }), t1 = svg("text", { x: 14, y: 12, "text-anchor": "middle", "font-size": 5, "font-weight": 900 })
  g.append(svg("rect", { x: 10, y: 52, width: 80, height: 10, rx: 3, fill: "#6b7385" }),
    svg("rect", { x: 8, y: 47, width: 12, height: 5, rx: 2, fill: TEAM_COL[1] }), svg("rect", { x: 80, y: 47, width: 12, height: 5, rx: 2, fill: TEAM_COL[0] }), t0, t1)
  const arm = svg("g", {}, svg("rect", { x: -3, y: -34, width: 6, height: 34, rx: 3, fill: "#c7ccd6", stroke: "#646c7c", "stroke-width": 0.8 }),
    svg("circle", { cy: -34, r: 5.5, fill: "#9aa3b2", stroke: "#646c7c", "stroke-width": 0.8 }), svg("rect", { x: -7, y: -38, width: 3, height: 7, rx: 1, fill: TEAM_COL[0] }), svg("rect", { x: 4, y: -38, width: 3, height: 7, rx: 1, fill: TEAM_COL[1] }))
  g.append(svg("g", { transform: "translate(50 52)" }, arm), svg("circle", { cx: 50, cy: 52, r: 4, fill: "#50545c" }))
  const mash = el("button", { class: "mp-btn huge", type: "button" }, el("span", { text: ctx.L("TEKAN! TEKAN! 👊", "MASH! MASH! 👊") }))
  mash.addEventListener("pointerdown", (e) => { e.preventDefault(); tap() })
  ctrl.append(mash)
  let V = null, pend = 0, lastSend = 0, shown = 0
  const kd = (e) => { if (e.code === "Space" && !e.repeat) { e.preventDefault(); tap() } }
  document.addEventListener("keydown", kd)

  function tap() {
    if (!V || V.phase !== "play") return
    pend++
    ctx.sfx.tick()
    mash.classList.remove("mp-flash"); void mash.offsetWidth; mash.classList.add("mp-flash")
  }
  const stop = loop(ctx, () => {
    if (!V) return
    if (pend && performance.now() - lastSend > 140) { ctx.send({ n: Math.min(6, pend) }); pend = Math.max(0, pend - 6); lastSend = performance.now() }
    shown += ((V.p || 0) - shown) * 0.25
    arm.setAttribute("transform", `rotate(${(shown * 75).toFixed(2)})`)
  })
  return {
    destroy() { stop(); document.removeEventListener("keydown", kd) },
    scores: (v) => v.scores,
    update(v, events) {
      V = v
      K.update(v, events, box)
      const teams = v.teams || [[], []]
      const myT = teams[0].includes(ctx.me.id) ? 0 : 1
      t0.textContent = teams[0].map((p) => ctx.player(p).avatar).join("") + ` ${v.wins?.[0] ?? 0}`
      t1.textContent = `${v.wins?.[1] ?? 0} ` + teams[1].map((p) => ctx.player(p).avatar).join("")
      t0.setAttribute("fill", TEAM_COL[0]); t1.setAttribute("fill", TEAM_COL[1])
      mash.className = `mp-btn huge ${myT ? "blue" : "red"}`
      q.replaceChildren(ctx.L(`Timmu: ${myT ? "BIRU" : "MERAH"} — dorong lengan ke tombol lawan!`, `Your team: ${myT ? "BLUE" : "RED"} — push the arm onto their button!`),
        el("small", { text: ctx.L("Ketuk secepat mungkin · menang 2 ronde duluan", "Tap as fast as you can · first to 2 rounds") }))
      for (const e of events) {
        if (e.e === "round") ctx.sfx.pop()
        if (e.e === "slam") { ctx.sfx.boom(); banner(box, e.team === myT ? ctx.L("MENANG!", "WIN!") : ctx.L("KALAH!", "LOST!"), { kind: e.team === myT ? "good" : "bad", ms: 1500 }) }
      }
    },
  }
}
