// Wok & Roll Duel: everyone cooks the same day in their own 3D kitchen (full screen) with their career kit.
// The phone reports its money to the room; prank cards (cat / power cut / rain) go to the current leader.
import { el, toast } from "../lib.js?v=__VERSION__"
import { reporter } from "./mp.js?v=__VERSION__"
import { duelLevel } from "../cook/levels.js?v=__VERSION__"
import { ensureCss, playDay } from "../cook/play.js?v=__VERSION__"
import { loadPacks } from "../cook/models.js?v=__VERSION__"

export function mount(stage, ctx) {
  ensureCss()
  loadPacks().catch(() => {})
  const R = reporter(ctx)
  const wait = el("div", { class: "ck-duel-wait" }, el("div", { class: "ck-load-wok", text: "🍳" }), el("b", { text: ctx.L("Bersiap… dapur sedang dipanaskan", "Get ready… heating up the kitchen") }))
  stage.append(wait)
  let ctl = null, host = null, V = null, seed = 0, lastNow = 0, frozen = 0, finished = false
  const seen = new Set()

  function leader(v) {
    const others = ctx.seats().filter((p) => p.id !== ctx.me.id)
    others.sort((a, b) => (v.prog[b.id] || 0) - (v.prog[a.id] || 0))
    return others[0]?.id
  }

  async function start(v) {
    seed = v.seed
    const kit = v.kits[ctx.me.id] || {}
    host = el("div", { class: "ck-full" })
    document.body.append(host)
    ctl = await playDay(host, {
      level: duelLevel(v.stage, v.dur), kit, seed, duel: true,
      onScore: (coins, done) => R.set(coins, !!done),
      onItem: (k) => ctx.send({ do: "item", k }),
      onPrank: (kind) => {
        const target = leader(V)
        if (!target) return false
        ctx.send({ do: "prank", kind, target })
        return true
      },
      onEnd: () => {
        finished = true
        host.append(el("div", { class: "ck-result" }, el("h2", { text: ctx.L("Tutup! Menunggu hasil…", "Closed! Waiting for the results…") }),
          el("p", { class: "muted", text: ctx.L("Pembeli terakhir sedang membayar.", "The last customers are paying.") })))
      },
      // the room's game clock stops while someone is disconnected (Live mode): pause the kitchen too
      tick: () => {
        const n = ctx.now()
        if (n === lastNow) frozen++; else frozen = 0
        lastNow = n
        if (ctl) ctl.stage.sim.paused = frozen > 20
      },
    })
    ctl.begin()
    wait.remove()
  }

  function others(v) {
    if (!ctl) return
    ctl.setOthers(ctx.seats().map((p) => ({ avatar: p.avatar, coins: Math.round(v.prog[p.id] || 0), me: p.id === ctx.me.id }))
      .sort((a, b) => b.coins - a.coins))
  }

  return {
    update(v, events) {
      V = v
      if (v.phase === "play" && v.seed && v.seed !== seed && !ctl) start(v)
      others(v)
      for (const e of events || []) {
        if (e.e === "prank" && !seen.has(`${e.who}${e.t}`)) {
          seen.add(`${e.who}${e.t}`)
          const icon = { cat: "🐱", blackout: "💡", rain: "🌧️" }[e.kind]
          if (e.target === ctx.me.id) { ctl?.prank(e.kind, e.dur); toast(`${icon} ${ctx.name(e.who)} ${ctx.L("menjahilimu!", "pranked you!")}`, "bad") }
          else if (e.who === ctx.me.id) toast(`${icon} ${ctx.L("Terkirim ke", "Sent to")} ${ctx.name(e.target)}!`)
        }
      }
      if (v.over && host) { ctl?.destroy(); ctl = null; host.remove(); host = null }
      void finished
    },
    scores: (v) => Object.fromEntries(Object.entries(v.prog || {}).map(([k, x]) => [k, Math.round(x)])),
    destroy() { ctl?.destroy(); host?.remove() },
  }
}
