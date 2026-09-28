// Shadow Play: choose one shape from each wheel so together they cast the shadow on the screen. 3 tries a round.
import { el, svg } from "../lib.js?v=__VERSION__"
import { banner, kit, popText } from "./mp.js?v=__VERSION__"

function shape(name, fill) {
  const P = {
    circle: () => svg("circle", { r: 10, fill }), square: () => svg("rect", { x: -9, y: -9, width: 18, height: 18, fill }),
    triangle: () => svg("path", { d: "M0 -11 L 11 9 L -11 9 Z", fill }), star: () => svg("path", { d: "M0 -12 L 3 -3 L 12 -3 L 5 3 L 8 12 L 0 6 L -8 12 L -5 3 L -12 -3 L -3 -3 Z", fill }),
    moon: () => { const pts = []; for (let a = 50; a <= 310; a += 10) pts.push([Math.cos(a * Math.PI / 180) * 11, Math.sin(a * Math.PI / 180) * 11]); for (let a = 290; a >= 70; a -= 10) pts.push([5 + Math.cos(a * Math.PI / 180) * 8, Math.sin(a * Math.PI / 180) * 9.5]); return svg("polygon", { points: pts.map((q) => q.map((v) => v.toFixed(2)).join(",")).join(" "), fill }) }, heart: () => svg("path", { d: "M0 10 C -14 0 -8 -12 0 -5 C 8 -12 14 0 0 10 Z", fill }),
    diamond: () => svg("path", { d: "M0 -12 L 9 0 L 0 12 L -9 0 Z", fill }), bar: () => svg("rect", { x: -12, y: -4, width: 24, height: 8, rx: 2, fill }),
    dot: () => svg("circle", { r: 4.5, fill }), ring: () => svg("path", { d: "M-8 0 a 8 8 0 1 0 16 0 a 8 8 0 1 0 -16 0 M-4.5 0 a 4.5 4.5 0 1 1 9 0 a 4.5 4.5 0 1 1 -9 0", fill, "fill-rule": "evenodd" }),
    arrow: () => svg("path", { d: "M-9 -3 L 2 -3 L 2 -8 L 10 0 L 2 8 L 2 3 L -9 3 Z", fill }), cross: () => svg("path", { d: "M-3 -9 H3 V-3 H9 V3 H3 V9 H-3 V3 H-9 V-3 H-3 Z", fill }),
    wave: () => svg("path", { d: "M-10 0 q 5 -7 10 0 t 10 0 v 5 q -5 -7 -10 0 t -10 0 Z", fill }), bolt: () => svg("path", { d: "M2 -11 L -6 2 L 0 2 L -2 11 L 7 -3 L 1 -3 Z", fill }),
    drop: () => svg("path", { d: "M0 -10 C 6 -2 8 2 8 5 A 8 8 0 0 1 -8 5 C -8 2 -6 -2 0 -10 Z", fill }), crown: () => svg("path", { d: "M-10 6 L -10 -6 L -5 0 L 0 -8 L 5 0 L 10 -6 L 10 6 Z", fill }),
  }
  return P[name]()
}

export function mount(stage, ctx) {
  const K = kit(stage, ctx)
  const box = el("div", { class: "mp", style: { background: "linear-gradient(#1b2340,#0d1224)" } })
  const q = el("div", { class: "mp-q" })
  const pickA = el("div", { class: "sp-row" }), pickB = el("div", { class: "sp-row" })
  const go = el("button", { class: "mp-btn green", type: "button", onclick: () => submit() }, el("span", { text: ctx.L("COCOKKAN! 🔦", "MATCH! 🔦") }))
  const note = el("div", { class: "mp-note" })
  stage.append(box, q, pickA, pickB, go, note)
  const g = svg("svg", { viewBox: "0 0 100 56" })
  box.append(g)
  let V = null, a = null, b = null, rk = ""

  function scenePair(ai, bi, place, fill, x) {
    const grp = svg("g", { transform: `translate(${x} 30)` })
    grp.append(svg("g", { transform: `translate(${place[0] * 7 - 4} 0) scale(1.2)` }, shape(V.a[ai], fill)), svg("g", { transform: `translate(${place[0] * -3 + 8} ${place[1] * 7}) scale(1.1)` }, shape(V.b[bi], fill)))
    return grp
  }
  function draw() {
    g.replaceChildren(svg("ellipse", { cx: 28, cy: 30, rx: 26, ry: 24, fill: "rgba(255,248,200,.9)" }), svg("text", { x: 28, y: 4.5, "text-anchor": "middle", "font-size": 3.6, "font-weight": 900, fill: "#fff", text: ctx.L("BAYANGAN", "SHADOW") }),
      scenePair(V.target[0], V.target[1], V.place, "#10131f", 28),
      svg("text", { x: 76, y: 4.5, "text-anchor": "middle", "font-size": 3.6, "font-weight": 900, fill: "#fff", text: ctx.L("PILIHANMU", "YOURS") }))
    if (a !== null && b !== null) g.append(scenePair(a, b, V.place, "#5aa2ff", 76))
    else g.append(svg("text", { x: 76, y: 32, "text-anchor": "middle", "font-size": 10, fill: "rgba(255,255,255,.4)", text: "?" }))
  }
  function row(host, list, sel, onPick) {
    host.replaceChildren(...list.map((n, i) => { const s = svg("svg", { viewBox: "-13 -13 26 26", width: 34, height: 34 }); s.append(shape(n, sel === i ? "#fff" : "#1d2340")); return el("button", { class: `sp-b${sel === i ? " on" : ""}`, type: "button", onclick: () => { ctx.sfx.click(); onPick(i) } }, s) }))
  }
  function submit() {
    if (!V || V.phase !== "play" || a === null || b === null) return
    ctx.send({ a, b })
  }
  return {
    scores: (v) => v.scores,
    update(v, events) {
      V = v
      K.update(v, events, box)
      if (rk !== String(v.round)) { rk = String(v.round); a = null; b = null }
      const solved = (v.solved || []).includes(ctx.me.id)
      row(pickA, v.a, a, function f(i) { a = i; row(pickA, v.a, a, f); draw() })
      row(pickB, v.b, b, function f(i) { b = i; row(pickB, v.b, b, f); draw() })
      draw()
      go.disabled = v.phase !== "play" || solved || v.tries >= 3
      q.replaceChildren(ctx.L("Pilih 1 bentuk dari tiap baris supaya bayangannya sama!", "Pick one shape from each row so the shadow matches!"), el("small", { text: ctx.L(`Sisa percobaan: ${Math.max(0, 3 - v.tries)} · Tercepat benar: 5 poin`, `Tries left: ${Math.max(0, 3 - v.tries)} · Fastest correct: 5 points`) }))
      note.textContent = solved ? ctx.L("✓ Cocok! Tunggu yang lain…", "✓ Matched! Waiting for the others…") : ""
      for (const e of events) {
        if (e.e === "round") ctx.sfx.pop()
        if (e.e === "match") { if (e.who === ctx.me.id) { ctx.sfx.fanfare(); banner(box, ctx.L("COCOK!", "MATCH!"), { kind: "good", ms: 1100 }) } else popText(box, `${ctx.player(e.who).avatar} ✓`, 50, 20) }
        if (e.e === "nope") { ctx.sfx.buzz(); popText(box, ctx.L("Belum cocok", "Not quite"), 76, 50, "bad") }
      }
    },
  }
}
