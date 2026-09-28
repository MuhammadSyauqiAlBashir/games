// Thwomp the Difference: Thwomps rise to flash fruit pictures — tap the one that's different.
import { el, svg } from "../lib.js?v=__VERSION__"
import { banner, chipFor, clamp, easeOut, kit, loop, popText, thwomp } from "./mp.js?v=__VERSION__"

const XS = { 3: [22, 50, 78], 4: [15.5, 38.5, 61.5, 84.5] }
const GROUND = 57

function fruitNode(item, size) {
  const t = svg("text", { "text-anchor": "middle", "dominant-baseline": "central", "font-size": size, text: item.f })
  const m = item.m
  const tr = m === "flip" ? "scale(1 -1)" : m === "mirror" ? "scale(-1 1)" : m === "tilt" ? "rotate(38)" : m === "small" ? "scale(.66)" : ""
  const g = svg("g", { transform: tr }, t)
  if (m === "hue") g.setAttribute("filter", "url(#mpHue)")
  return g
}

export function mount(stage, ctx) {
  const K = kit(stage, ctx)
  const box = el("div", { class: "mp" })
  const q = el("div", { class: "mp-q" })
  const btns = el("div", { class: "mp-btns" })
  const note = el("div", { class: "mp-note" })
  stage.append(box, q, btns, note)
  const g = svg("svg", { viewBox: "0 0 100 72" })
  g.append(svg("defs", {},
    svg("linearGradient", { id: "twSky", x1: 0, y1: 0, x2: 0, y2: 1 }, svg("stop", { offset: 0, "stop-color": "#7fd3ff" }), svg("stop", { offset: 1, "stop-color": "#d8f3ff" })),
    svg("filter", { id: "mpHue" }, svg("feColorMatrix", { type: "hueRotate", values: "95" }))))
  g.append(svg("rect", { width: 100, height: 72, fill: "url(#twSky)" }))
  for (const [x, r, c] of [[12, 16, "#7cd36b"], [40, 22, "#5fc257"], [82, 18, "#7cd36b"]]) g.append(svg("circle", { cx: x, cy: GROUND + 4, r, fill: c }))
  for (const [x, y] of [[18, 10], [70, 7], [88, 16]]) g.append(svg("g", { transform: `translate(${x} ${y})`, opacity: 0.95 },
    svg("ellipse", { rx: 7, ry: 3, fill: "#fff" }), svg("ellipse", { cx: -3, cy: -1.8, rx: 3.5, ry: 3, fill: "#fff" }), svg("ellipse", { cx: 2.5, cy: -2.2, rx: 3.8, ry: 3.2, fill: "#fff" })))
  g.append(svg("rect", { y: GROUND, width: 100, height: 72 - GROUND, fill: "#c9793a" }))
  for (let x = 0; x < 100; x += 8) for (let y = GROUND; y < 72; y += 8) if (((x + y) / 8) % 2 < 1) g.append(svg("rect", { x, y, width: 8, height: 8, fill: "#b8682c" }))
  g.append(svg("rect", { y: GROUND - 1.2, width: 100, height: 2.4, fill: "#6fcf5b" }))
  const lane = svg("g")
  g.append(lane)
  box.append(g)
  let V = null, slots = [], roundKey = "", lastPeekSound = {}

  function build(v) {
    lane.replaceChildren()
    slots = []
    const xs = XS[v.n] || XS[3]
    v.items.forEach((item, i) => {
      const x = xs[i]
      const panel = svg("g", { transform: `translate(${x} ${GROUND - 12})` },
        svg("rect", { x: -10, y: -10, width: 20, height: 20, rx: 2.5, fill: "#fff8e1", stroke: "#d9a441", "stroke-width": 1 }),
        fruitNode(item, 12))
      const glow = svg("rect", { x: x - 12.5, y: GROUND - 24.5, width: 25, height: 25, rx: 4, fill: "none", stroke: "#ffd400", "stroke-width": 1.6, opacity: 0 })
      const tw = svg("g", {}, thwomp(21, 25))
      const shadow = svg("ellipse", { cx: x, cy: GROUND + 0.6, rx: 10, ry: 1.4, fill: "rgba(0,0,0,.25)" })
      const who = svg("g")
      const hit = svg("rect", { x: x - 12, y: 5, width: 24, height: GROUND - 3, fill: "transparent", class: "mp-tap" })
      hit.addEventListener("click", () => pick(i))
      lane.append(panel, glow, shadow, tw, who, hit)
      slots.push({ x, tw, glow, who, shadow })
    })
    btns.style.setProperty("--n", v.n)
    btns.replaceChildren(...v.items.map((_, i) => el("button", { class: "mp-btn blue", type: "button", onclick: () => pick(i) }, el("span", { class: "em", text: "ABCD"[i] }))))
  }

  function pick(i) {
    if (!V || V.phase !== "watch" || V.mine !== undefined && V.mine !== null) return
    ctx.sfx.click()
    ctx.send({ i })
  }

  function lift(v, i, t) {
    // height the Thwomp is raised (0 = down, 26 = fully up) at t seconds into the watch phase
    let h = 0
    for (const [k, t0, d, full] of v.peeks) {
      if (k !== i) continue
      const up = 0.16, down = 0.11
      const top = full ? 26 : 12
      if (t >= t0 && t < t0 + up) h = Math.max(h, top * easeOut((t - t0) / up))
      else if (t >= t0 + up && t < t0 + up + d) h = Math.max(h, top)
      else if (t >= t0 + up + d && t < t0 + up + d + down) h = Math.max(h, top * (1 - clamp((t - t0 - up - d) / down) ** 2))
    }
    return h
  }

  const stop = loop(ctx, (now) => {
    if (!V || !slots.length) return
    const reveal = V.phase === "reveal" || V.phase === "finish"
    slots.forEach((sl, i) => {
      let h = 0
      if (V.phase === "watch") {
        const t = now - V.t0
        h = lift(V, i, t)
        // thud when a Thwomp lands
        const landing = V.peeks.find(([k, t0, d]) => k === i && Math.abs(t - (t0 + 0.16 + d + 0.11)) < 0.035)
        if (landing && lastPeekSound[i] !== landing[1]) { lastPeekSound[i] = landing[1]; ctx.sfx.thud() }
      } else if (reveal) h = 27 * easeOut(clamp((now - V.t0) / 0.35))
      sl.tw.setAttribute("transform", `translate(${sl.x} ${GROUND - 12.5 - h})`)
      sl.shadow.setAttribute("rx", (10 - h * 0.15).toFixed(2))
      sl.glow.setAttribute("opacity", reveal && V.odd === i ? (0.6 + 0.4 * Math.sin(now * 8)).toFixed(2) : 0)
    })
  })

  return {
    destroy: stop,
    scores: (v) => v.scores,
    update(v, events) {
      V = v
      K.update(v, events, box)
      const key = `${v.round}:${v.n}:${JSON.stringify(v.items)}`
      if (key !== roundKey && v.items && v.items.length) { roundKey = key; build(v); lastPeekSound = {} }
      const reveal = v.phase === "reveal" || v.phase === "finish"
      const mine = v.mine
      ;[...btns.children].forEach((b, i) => {
        b.disabled = v.phase !== "watch" || (mine !== undefined && mine !== null)
        b.className = `mp-btn ${reveal ? (i === v.odd ? "right" : mine === i ? "wrong" : "gray") : mine === i ? "blue on" : "blue"}`
      })
      slots.forEach((sl, i) => {
        sl.who.replaceChildren()
        const pickers = reveal && v.picks ? Object.entries(v.picks).filter(([, x]) => x === i).map(([p]) => p) : (mine === i ? [ctx.me.id] : [])
        pickers.forEach((p, k) => sl.who.append(svg("text", { x: sl.x - (pickers.length - 1) * 3 + k * 6, y: 69, "text-anchor": "middle", "font-size": 5.2, text: ctx.player(p).avatar })))
      })
      q.replaceChildren(v.phase === "watch" ? ctx.L("Mana gambar yang BEDA?", "Which picture is DIFFERENT?") : v.phase === "start" ? ctx.L("Perhatikan Thwomp-nya!", "Watch the Thwomps!") : reveal ? ctx.L("Yang beda yang ini!", "This was the odd one!") : "",
        el("small", { text: v.phase === "watch" ? ctx.L("Tercepat benar dapat 5 poin, lalu 3, 2, 1", "Fastest correct gets 5 points, then 3, 2, 1") : "" }))
      const pickedN = (v.picked || []).length
      note.replaceChildren(v.phase === "watch" ? (mine !== undefined && mine !== null ? ctx.L(`Pilihanmu terkunci ✓ — ${pickedN}/${ctx.seats().length} sudah memilih`, `Locked in ✓ — ${pickedN}/${ctx.seats().length} chosen`) : ctx.L(`${pickedN}/${ctx.seats().length} sudah memilih`, `${pickedN}/${ctx.seats().length} have chosen`)) : "")
      for (const e of events) {
        if (e.e === "round") ctx.sfx.pop()
        if (e.e === "reveal") {
          const gotMe = (e.got || {})[ctx.me.id]
          if (gotMe) { ctx.sfx.ding(); banner(box, `+${gotMe}`, { kind: "good", ms: 1300 }) } else if (mine !== undefined && mine !== null) { ctx.sfx.buzz() }
          Object.entries(e.got || {}).forEach(([p, pts]) => { const sl = slots[v.odd]; if (sl) popText(box, `${ctx.player(p).avatar} +${pts}`, sl.x, 40 - Object.keys(e.got).indexOf(p) * 9) })
        }
      }
      void chipFor
    },
  }
}
