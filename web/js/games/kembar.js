// Cari Kembar (Spot it): the middle card and your card share exactly one picture — tap it (on either card)
// before anyone else. A wrong tap freezes you for a moment.
import { el, svg } from "../lib.js?v=__VERSION__"

export function mount(stage, ctx) {
  const scores = el("div", { class: "row wrap", style: { justifyContent: "center", gap: "6px", marginBottom: "6px" } })
  const center = el("div", { class: "km-card center-card" })
  const mine = el("div", { class: "km-card mine" })
  const msg = el("div", { class: "km-msg" })
  const freeze = el("div", { class: "km-freeze", hidden: true, text: "❄️" })
  const wrap = el("div", { class: "km-wrap" }, center, msg, mine, freeze)
  stage.append(scores, wrap)
  let V = null, cKey = "", mKey = "", frozenUntil = 0

  function draw(node, lay, symbols) {
    const g = svg("svg", { viewBox: "0 0 100 100" })
    g.append(svg("circle", { cx: 50, cy: 50, r: 49, fill: "#fffdf8", stroke: "#e2d6c2", "stroke-width": 1.2 }))
    for (const [sym, x, y, r, rot] of lay) {
      const t = svg("text", { x, y, "font-size": r * 1.85, "text-anchor": "middle", "dominant-baseline": "central", transform: `rotate(${rot} ${x} ${y})`, text: symbols[sym], class: "km-sym" })
      const hit = svg("circle", { cx: x, cy: y, r: r * 0.95, fill: "transparent", class: "km-hit" })
      hit.addEventListener("pointerdown", (e) => { e.preventDefault(); tap(sym, t) })
      g.append(t, hit)
    }
    node.replaceChildren(g)
  }

  function tap(sym, node) {
    if (!V || V.phase !== "play" || performance.now() < frozenUntil) return
    node.classList.remove("tapped"); void node.getBBox(); node.classList.add("tapped")
    ctx.send({ do: "tap", sym, c: V.c })
  }

  return {
    scores: (v) => v.scores,
    update(v, events) {
      V = v
      const me = ctx.me.id
      for (const e of events) {
        if (e.e === "got") {
          ctx.sfx[e.who === me ? "right" : "pop"]()
          msg.replaceChildren(el("span", { class: "km-got", text: `${v.symbols[e.sym]} ${ctx.player(e.who).avatar} ${ctx.name(e.who)} +1` }))
          wrap.classList.remove("flashgot"); void wrap.offsetWidth; wrap.classList.add("flashgot")
        }
        if (e.e === "miss" && e.who === me) {
          ctx.sfx.buzz()
          frozenUntil = performance.now() + 1600
          freeze.hidden = false
          setTimeout(() => { freeze.hidden = true }, 1600)
        }
        if (e.e === "go") { ctx.sfx.turn(); msg.textContent = ctx.L("Cari gambar yang sama! 👀", "Find the matching picture! 👀") }
      }
      if (v.phase === "ready") { msg.textContent = ctx.L("Siap-siap… cari gambar kembarnya!", "Get ready… find the twin!"); center.replaceChildren(); mine.replaceChildren(); return }
      const ck = `${v.c}`, mk = JSON.stringify(v.mine)
      if (v.center && ck !== cKey) { cKey = ck; draw(center, v.center, v.symbols); center.classList.remove("deal"); void center.offsetWidth; center.classList.add("deal") }
      if (v.mine && mk !== mKey) { mKey = mk; draw(mine, v.mine, v.symbols) }
      scores.replaceChildren(...ctx.seats().map((s) => el("span", { class: `pill${s.id === me ? " ok" : ""}`, text: `${s.avatar} ${s.name} ${v.scores[s.id] || 0}/${v.target}` })),
        el("span", { class: "pill", text: ctx.L(`🂠 ${v.left} kartu`, `🂠 ${v.left} cards`) }))
    },
  }
}
