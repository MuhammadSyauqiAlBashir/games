// Pesta mode: the minigame roulette → how-to-play card (everyone taps Ready) → the minigame →
// results with coins → … → bonus stars → the winner. The minigame itself is its own module, mounted inside.
import { el } from "../lib.js?v=__VERSION__"
import { RULES, TINT } from "../i18n.js?v=__VERSION__"
import { state } from "../app.js?v=__VERSION__"
import { banner } from "./mp.js?v=__VERSION__"

const CONTROLS = {
  mp_thwomp: ["👆 Ketuk Thwomp / tombol huruf", "👆 Tap a Thwomp or its letter"],
  mp_bigtop: ["👀 Perhatikan, lalu ketuk jawaban", "👀 Watch, then tap your answer"],
  mp_buzzer: ["🔔 Ketuk jawaban paling cepat", "🔔 Tap the answer first"],
  mp_shell: ["🎁 Ikuti peti, ketuk yang aman", "🎁 Follow the chests, tap a safe one"],
  mp_turntable: ["🔴 Tekan / tidak, lalu 🔒 Kunci", "🔴 Press or not, then 🔒 lock in"],
  mp_pound: ["🕳️ Sembunyi / 🔨 pilih lubang", "🕳️ Hide / 🔨 pick a hole"],
  mp_sled: ["🛷 Ketuk LEPAS! di saat yang pas", "🛷 Tap LET GO! at the right moment"],
  mp_fish: ["🎣 Ketuk TARIK! saat pelampung tenggelam", "🎣 Tap REEL! when the float sinks"],
  mp_flower: ["⬆️ Berdiri / ⬇️ Jongkok", "⬆️ Stand / ⬇️ Squat"],
  mp_memory: ["🚪 Ketuk 2 pintu di giliranmu", "🚪 Knock on 2 doors on your turn"],
  mp_circuit: ["👆 Ketuk ubin untuk memutar", "👆 Tap tiles to turn them"],
  mp_blocks: ["🟩 Pilih potongan yang hijau", "🟩 Pick a green piece"],
  mp_shadow: ["🔷 Pilih 2 bentuk lalu COCOKKAN", "🔷 Pick 2 shapes, then MATCH"],
  mp_conveyor: ["🧱 Pilih potongan → ketuk papan", "🧱 Pick a piece → tap the board"],
  mp_electric: ["☝️ Seret Toad pelan-pelan", "☝️ Drag your Toad carefully"],
  mp_filter: ["👈👉 Geser surat / tombol", "👈👉 Swipe the letter / buttons"],
  mp_bakery: ["👆 Ketuk roti keemasan", "👆 Tap the golden pastries"],
  mp_noggin: ["🔨 Ketuk yang muncul", "🔨 Tap what pops up"],
  mp_lane: ["👈👉 Geser / ketuk kiri-kanan", "👈👉 Swipe / tap left-right"],
  mp_golf: ["📱 Miringkan HP / joystick", "📱 Tilt your phone / joystick"],
  mp_pickax: ["📳 Goyang HP / ketuk GALI", "📳 Shake / tap DIG"],
  mp_hammer: ["🔨 Tunggu hijau → PUKUL", "🔨 Wait for green → SWING"],
  mp_chicken: ["🎤 Bersuara / tahan GAS", "🎤 Make noise / hold GAS"],
  mp_junior: ["🎤 Bersuara / tahan NAIK", "🎤 Make noise / hold UP"],
  mp_rhythm: ["🥄 Ketuk sesuai ketukan", "🥄 Tap on the beat"],
  mp_konga: ["🥁 L / R / keduanya", "🥁 L / R / both"],
  mp_camera: ["☝️ Geser · 🔍 zoom · 📸", "☝️ Drag · 🔍 zoom · 📸"],
  mp_bowling: ["👆 Kunci arah → kunci tenaga", "👆 Lock aim → lock power"],
  mp_floor: ["⬆️⬇️⬅️➡️ Geser / panah", "⬆️⬇️⬅️➡️ Swipe / arrows"],
  mp_hop: ["⬆️ Ketuk untuk LOMPAT", "⬆️ Tap to JUMP"],
  mp_stamp: ["🕹️ Joystick", "🕹️ Joystick"],
  mp_flags: ["🕹️ Joystick", "🕹️ Joystick"],
  mp_sunset: ["↔️ Joystick kiri-kanan", "↔️ Joystick left-right"],
  mp_arm: ["👊 Tekan secepatnya", "👊 Mash the button"],
  mp_rope: ["✋🤚 Gantian", "✋🤚 Alternate"],
  mp_slappy: ["🖐️ TAMPAR · ⬆️ LOMPAT", "🖐️ SLAP · ⬆️ JUMP"],
}

export function mount(stage, ctx) {
  const screen = el("div", { class: "pp-screen" })
  const subStage = el("div", { class: "pp-sub", hidden: true })
  stage.append(screen, subStage)
  let V = null, sub = null, subKey = null, pending = null, drawn = "", rollTimer = 0, bonusTimers = []

  const G = (k) => state.byKey[k] || { name_en: k, icon: "🎲" }
  const P = (v) => v.party || {}

  function destroySub() {
    if (sub && sub.destroy) sub.destroy()
    sub = null; subKey = null
    subStage.replaceChildren()
  }
  async function ensureSub(key) {
    if (subKey === key) return
    destroySub()
    subKey = key
    const mod = await import(`./${key}.js?v=__VERSION__`)
    if (subKey !== key) return
    subStage.replaceChildren()
    sub = mod.mount(subStage, ctx)
    if (pending) { const p = pending; pending = null; sub.update(p.v, p.ev) }
  }

  // ---- screens ------------------------------------------------------------------------------------------
  function coinsBar(v, gained = {}) {
    const p = P(v)
    const seats = [...ctx.seats()].sort((a, b) => (p.coins[b.id] || 0) - (p.coins[a.id] || 0))
    return el("div", { class: "pp-coins" }, seats.map((s, i) => el("div", { class: `pp-coin${s.id === ctx.me.id ? " me" : ""}`, style: { "--c": s.color } },
      el("span", { class: "pos", text: `${i + 1}` }), el("span", { class: "av", text: s.avatar }), el("b", { text: s.id === ctx.me.id ? ctx.L("Kamu", "You") : s.name }),
      el("span", { class: "c", text: `🪙 ${p.coins[s.id] || 0}` }), gained[s.id] ? el("span", { class: "g", text: `+${gained[s.id]}` }) : null)))
  }

  function roulette(v) {
    const p = P(v)
    const pool = p.all
    const reel = el("div", { class: "pp-reel" })
    const track = el("div", { class: "pp-track" })
    reel.append(track, el("div", { class: "pp-pointer" }))
    // a long strip that ends on the chosen minigame
    const strip = []
    for (let k = 0; k < 26; k++) strip.push(pool[(k * 7 + p.idx * 3) % pool.length])
    strip.push(p.key, pool[(p.idx + 1) % pool.length], pool[(p.idx + 2) % pool.length])
    const target = strip.length - 3
    strip.forEach((k) => track.append(el("div", { class: "pp-card", style: { "--t": TINT[k] || "#3b6cf2" } }, el("span", { class: "i", text: G(k).icon }), el("span", { class: "n", text: G(k).name_en }))))
    screen.replaceChildren(el("div", { class: "pp-head" }, el("div", { class: "pp-title", text: "Minigame!" }), el("div", { class: "pp-sub-t", text: ctx.L(`Minigame ${p.idx + 1} dari ${p.count}`, `Minigame ${p.idx + 1} of ${p.count}`) })), reel, coinsBar(v))
    const cardW = 132
    const t0 = p.t0
    let lastCell = -1
    const spin = () => {
      if (!reel.isConnected) return
      const t = Math.min(1, (ctx.now() - t0) / 3.3)
      const e = 1 - (1 - t) ** 4
      const x = e * (target * cardW)
      track.style.transform = `translateX(${-x + reel.clientWidth / 2 - cardW / 2}px)`
      const cell = Math.floor(x / cardW + 0.5)
      if (cell !== lastCell) { lastCell = cell; if (t < 1) ctx.sfx.tick() }
      if (t < 1) rollTimer = requestAnimationFrame(spin)
      else { track.children[target].classList.add("won"); ctx.sfx.fanfare() }
    }
    cancelAnimationFrame(rollTimer)
    rollTimer = requestAnimationFrame(spin)
  }

  function intro(v) {
    const p = P(v)
    const g = G(p.key)
    const rules = (RULES[p.key] || ["", ""])[ctx.L(0, 1)]
    const ready = p.ready || []
    const meReady = ready.includes(ctx.me.id)
    screen.replaceChildren(
      el("div", { class: "pp-intro", style: { "--t": TINT[p.key] || "#3b6cf2" } },
        el("div", { class: "pp-intro-top" }, el("span", { class: "i", text: g.icon }), el("div", {}, el("small", { text: ctx.L(`Minigame ${p.idx + 1}/${p.count}`, `Minigame ${p.idx + 1}/${p.count}`) }), el("h2", { text: g.name_en }))),
        el("div", { class: "pp-rules" }, el("b", { text: ctx.L("Cara main", "How to play") }), el("p", { text: rules })),
        el("div", { class: "pp-ctrl" }, el("b", { text: ctx.L("Kontrol", "Controls") }), el("p", { text: (CONTROLS[p.key] || ["", ""])[ctx.L(0, 1)] })),
        el("div", { class: "pp-ready" }, ctx.seats().map((s) => el("div", { class: `pp-r${ready.includes(s.id) ? " ok" : ""}`, style: { "--c": s.color } },
          el("span", { class: "av", text: s.avatar }), el("span", { text: ready.includes(s.id) ? "✓" : "…" })))),
        el("button", { class: `mp-btn huge ${meReady ? "gray" : "green"}`, type: "button", disabled: meReady, onclick: () => { ctx.sfx.pop(); ctx.send({ do: "ready" }) } },
          el("span", { text: meReady ? ctx.L("Menunggu yang lain…", "Waiting for the others…") : ctx.L("SIAP! 👍", "READY! 👍") }))))
  }

  function result(v, events) {
    const p = P(v)
    const last = p.last || {}
    const n = ctx.seats().length
    const ranked = [...ctx.seats()].sort((a, b) => (last.ranks?.[a.id] || n) - (last.ranks?.[b.id] || n))
    const medal = ["🥇", "🥈", "🥉", "4"]
    screen.replaceChildren(
      el("div", { class: "pp-head" }, el("div", { class: "pp-title", text: ctx.L("Hasil", "Results") }), el("div", { class: "pp-sub-t", text: G(last.key).name_en })),
      el("div", { class: "pp-places" }, ranked.map((s, i) => {
        const r = last.ranks?.[s.id] || n
        return el("div", { class: `pp-place r${r}${s.id === ctx.me.id ? " me" : ""}`, style: { "--c": s.color, animationDelay: `${(ranked.length - i) * 0.25}s` } },
          el("span", { class: "m", text: medal[r - 1] || r }), el("span", { class: "av", text: s.avatar }), el("b", { text: s.name }),
          el("span", { class: "pts", text: last.scores && last.scores[s.id] !== undefined ? `${last.scores[s.id]} ${ctx.L("poin", "pts")}` : "" }),
          el("span", { class: "gain", text: last.coins?.[s.id] ? `+${last.coins[s.id]} 🪙` : "—" }))
      })),
      coinsBar(v, last.coins || {}),
      el("div", { class: "pp-next", text: p.idx + 1 < p.count ? ctx.L("Minigame berikutnya sebentar lagi…", "Next minigame coming up…") : ctx.L("Minigame terakhir selesai!", "That was the last minigame!") }))
    if (events.some((e) => e.e === "result")) {
      const mine = last.ranks?.[ctx.me.id]
      if (mine === 1) { ctx.sfx.win(); banner(screen, ctx.L("MENANG!", "YOU WIN!"), { ms: 1800 }) } else ctx.sfx.coin()
    }
  }

  function bonus(v, events) {
    const p = P(v)
    const list = p.bonus || []
    const wrap = el("div", { class: "pp-bonus" })
    screen.replaceChildren(el("div", { class: "pp-head" }, el("div", { class: "pp-title", text: ctx.L("Bintang Bonus!", "Bonus Stars!") }),
      el("div", { class: "pp-sub-t", text: ctx.L("+15 koin untuk tiap bintang", "+15 coins per star") })), wrap, coinsBar(v))
    if (!events.some((e) => e.e === "bonus")) { list.forEach((b) => wrap.append(bonusCard(b, true))); return }
    bonusTimers.forEach(clearTimeout); bonusTimers = []
    list.forEach((b, i) => {
      bonusTimers.push(setTimeout(() => { ctx.sfx.drum() }, i * 2600))
      bonusTimers.push(setTimeout(() => { wrap.append(bonusCard(b, false)); ctx.sfx.fanfare() }, i * 2600 + 1100))
    })
  }
  function bonusCard(b, still) {
    return el("div", { class: `pp-star${still ? " still" : ""}` }, el("span", { class: "e", text: b.emoji }), el("div", {}, el("b", { text: ctx.L(b.id, b.en) }),
      el("div", { class: "who" }, b.who.map((pid) => el("span", { text: `${ctx.player(pid).avatar} ${ctx.name(pid)}` })))), el("span", { class: "c", text: "+15 🪙" }))
  }

  return {
    destroy() { destroySub(); cancelAnimationFrame(rollTimer); bonusTimers.forEach(clearTimeout) },
    scores: (v) => P(v).coins || {},
    scoreFmt: (x) => `🪙${x}`,
    update(v, events) {
      V = v
      const p = P(v)
      if (p.phase === "play") {
        screen.hidden = true
        subStage.hidden = false
        drawn = ""
        if (sub && subKey === p.key) sub.update(v, events)
        else {
          pending = pending && pending.key === p.key ? { key: p.key, v, ev: [...pending.ev, ...events] } : { key: p.key, v, ev: events }
          ensureSub(p.key)
        }
        return
      }
      if (sub) destroySub()
      subStage.hidden = true
      screen.hidden = false
      const key = `${p.phase}:${p.idx}:${(p.ready || []).length}`
      if (key === drawn && !events.length) return
      drawn = key
      if (p.phase === "start") {
        screen.replaceChildren(el("div", { class: "pp-head" }, el("div", { class: "pp-title big", text: "Minigame Party!" }),
          el("div", { class: "pp-sub-t", text: ctx.L(`${p.count} minigame · menang = +10 koin · koin terbanyak juara!`, `${p.count} minigames · win = +10 coins · most coins wins!`) })),
        el("div", { class: "pp-lineup" }, p.order.map((k, i) => el("span", { style: { "--t": TINT[k] || "#3b6cf2", animationDelay: `${i * 0.08}s` }, text: "?" }))), coinsBar(v))
        if (events.some((e) => e.e === "start")) ctx.sfx.mpStart()
      } else if (p.phase === "roulette") { if (events.some((e) => e.e === "roulette") || !screen.querySelector(".pp-reel")) roulette(v) }
      else if (p.phase === "intro") intro(v)
      else if (p.phase === "result") result(v, events)
      else if (p.phase === "bonus") bonus(v, events)
      else if (p.phase === "finish") screen.replaceChildren(el("div", { class: "pp-head" }, el("div", { class: "pp-title", text: ctx.L("Pesta selesai!", "Party over!") })), coinsBar(v))
      void V
    },
  }
}
