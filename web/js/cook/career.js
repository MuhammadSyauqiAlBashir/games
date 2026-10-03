// Wok & Roll career hub (#cook): your stall in 3D, the chapter map, equipment, skills, items, chef & cart.
import * as T from "./three.js?v=__VERSION__"
import { api, busy, confetti, el, rp, toast } from "../lib.js?v=__VERSION__"
import { L } from "../i18n.js?v=__VERSION__"
import { sfx } from "../sound.js?v=__VERSION__"
import { Gfx } from "./gfx.js?v=__VERSION__"
import { Actor, dishModel, loadPacks, steakLook } from "./models.js?v=__VERSION__"
import { CART_COLORS, World } from "./world.js?v=__VERSION__"
import { CAST, CHAPTERS, LAYOUTS, levelByKey } from "./levels.js?v=__VERSION__"
import { hashSeed } from "./sim.js?v=__VERSION__"
import { ITEM_ICONS, ensureCss, playDay } from "./play.js?v=__VERSION__"
import { runStory } from "./story.js?v=__VERSION__"

const money = (rb) => rp(rb * 1000)
let current = null

export function leaveCook() {
  if (current) { current.destroy(); current = null }
}

export async function renderCook(app, go) {
  leaveCook()
  ensureCss()
  const page = el("div", { class: "ck-page" })
  app.replaceChildren(page)
  page.append(el("div", { class: "ck-loading" }, el("div", { class: "ck-load-wok", text: "🍳" }), el("b", { text: L("Membuka warung…", "Opening the stall…") })))
  const [data] = await Promise.all([api("/cook"), loadPacks()])
  const S = { data, tab: "map", diorama: null, playing: null }
  current = { destroy() { S.diorama?.destroy(); S.playing?.destroy() } }
  const cat = data.catalog

  // ---- header ---------------------------------------------------------------------------------------------
  const view = el("div", { class: "ck-view" })
  const stats = el("div", { class: "ck-stats" })
  const tabs = el("nav", { class: "ck-tabs" })
  const body = el("div", { class: "ck-body" })
  const back = el("button", { class: "ck-back", type: "button", text: "←", "aria-label": L("Kembali", "Back"), onclick: () => go("lobby") })
  const title = el("div", { class: "ck-title" }, el("b", { text: "Wok & Roll" }), el("small", { text: L("Karier masak", "Cooking career") }))
  page.replaceChildren(el("div", { class: "ck-head" }, view, back, title, stats), tabs, body)

  function save() { return S.data.save }
  function drawStats() {
    const sv = save(), lvl = S.data.level, xs = cat.xp_levels
    const cur = xs[lvl - 1] || 0, nxt = xs[lvl] || cur + 1
    const totalStars = Object.values(sv.stars).reduce((a, b) => a + b, 0)
    stats.replaceChildren(
      el("span", { class: "ck-stat" }, "💰 ", el("b", { text: money(sv.money) })),
      el("span", { class: "ck-stat" }, "⭐ ", el("b", { text: String(totalStars) })),
      el("span", { class: "ck-stat lvl" }, el("b", { text: `Lv ${lvl}` }), el("i", { class: "ck-xp" }, el("i", { style: { width: `${Math.min(100, ((sv.xp - cur) / (nxt - cur)) * 100)}%` } }))),
      S.data.points > 0 ? el("span", { class: "ck-stat pts", text: `+${S.data.points} skill` }) : null)
  }

  // ---- the 3D diorama of your stall --------------------------------------------------------------------------
  function buildDiorama() {
    S.diorama?.destroy()
    const sv = save()
    const chapter = Math.max(1, ...Object.keys(sv.stars).filter((k) => sv.stars[k] >= 1).map((k) => (k.endsWith("-6") ? Number(k[0]) + 1 : Number(k[0]))))
    const layoutKey = (CHAPTERS.find((c) => c.n === chapter) || CHAPTERS[CHAPTERS.length - 1]).layout
    const gfx = new Gfx(view)
    const L0 = LAYOUTS[layoutKey]
    const world = new World(gfx, L0, { cart: sv.chef.cart })
    for (const p of L0.pieces) world.pieces[p.id].group.visible = !p.extra || !!sv.equip.wajan2
    const show = L0.scene === "bistro" ? [["steak", ["saus", "buncis"]], ["jusjeruk", []], ["steak", ["tomat"]]] : [["nasgor", ["telur"]], ["esteh", []], ["nasgor", ["kerupuk"]]]
    show.forEach(([d, t], i) => world.plateSpots[i].dish.add(dishModel(d, t)))
    for (let i = 3; i < world.plateSpots.length; i++) world.plateSpots[i].group.visible = i < 3 + (sv.equip.piring || 0)
    const xs = L0.slots
    const chef = new Actor(sv.chef.model, { hat: sv.chef.hat, apron: "#c8382f", height: 2.2 })
    chef.root.position.set(xs[0], 0, L0.custZ)
    const nenek = new Actor(CAST.nenek.model, { height: 2.2 })
    nenek.root.position.set(xs[1], 0, L0.custZ)
    world.root.add(chef.root, nenek.root)
    let em = 2
    const look = new T.Vector3(0, 1.05, 0.3)
    gfx.tickers.add((dt, t) => {
      const d = gfx.w < gfx.h ? 9.5 : 7
      gfx.camera.position.set(Math.sin(t * 0.15) * 0.9, 3.0 + Math.sin(t * 0.3) * 0.15, look.z + d)
      gfx.camera.lookAt(look)
      chef.update(dt); nenek.update(dt)
      em -= dt
      if (em < 0) { em = 4 + Math.random() * 3; (Math.random() < 0.5 ? chef : nenek).play(Math.random() < 0.7 ? "yes" : "work", { once: true }); setTimeout(() => { chef.play("idle"); nenek.play("idle") }, 1600) }
      const hot = world.pieces.wok1 ? "wok1" : "grill1"
      if (Math.random() < dt * 4) world.steamAt(world.stationFx(hot), 1)
      if (Math.random() < dt * 20) world.fireAt(hot, 0.5)
    })
    if (world.pieces.wok1) world.pieces.wok1.food.visible = true
    if (L0.scene === "bistro") for (const id of ["grill1", "grill2", "grill3"]) steakLook(world.pieces[id].steak, id === "grill2" ? "raw" : "cooked")
    gfx.start()
    S.diorama = { destroy() { world.dispose(); gfx.dispose() }, chef }
  }

  // ---- tabs ---------------------------------------------------------------------------------------------------
  const TABS = [["map", "🗺️", L("Karier", "Career")], ["equip", "🍳", L("Alat", "Gear")], ["skills", "✨", L("Skill", "Skills")],
    ["items", "🎒", L("Tas", "Bag")], ["chef", "👩‍🍳", L("Chef", "Chef")]]
  function drawTabs() {
    tabs.replaceChildren(...TABS.map(([k, ic, lb]) => el("button", { type: "button", class: S.tab === k ? "on" : "", onclick: () => { S.tab = k; drawTabs(); draw() } },
      el("span", { text: ic }), lb)))
  }

  async function act(path, json, btn) {
    const run = async () => {
      try {
        const r = await api(path, { method: "POST", json })
        Object.assign(S.data, r)
        drawStats(); draw()
        return r
      } catch (e) { sfx.wrong(); toast(e.message, "bad"); return null }
    }
    return btn ? busy(btn, run) : run()
  }

  // ---- career map ----------------------------------------------------------------------------------------------
  function drawMap() {
    const sv = save()
    const out = []
    for (const ch of CHAPTERS) {
      const levels = ch.levels.map((lv, i) => {
        const stars = sv.stars[lv.key] || 0
        const open = i === 0 ? (ch.n === 1 || (sv.stars[`${ch.n - 1}-6`] || 0) >= 1) : (sv.stars[ch.levels[i - 1].key] || 0) >= 1
        return el("button", { class: `ck-node${open ? "" : " locked"}${stars ? " done" : ""}`, type: "button", disabled: !open,
          onclick: () => startLevel(lv.key) },
        el("span", { class: "ck-node-n", text: open ? lv.key : "🔒" }),
        el("b", { text: L(lv.id, lv.en) }),
        el("span", { class: "ck-node-stars" }, [0, 1, 2].map((s) => el("i", { class: s < stars ? "on" : "", text: "★" }))),
        sv.best[lv.key] ? el("small", { text: money(sv.best[lv.key]) }) : null)
      })
      out.push(el("section", { class: "ck-chapter" }, el("h3", {}, el("span", { text: ch.icon }), ` ${L("Bab", "Chapter")} ${ch.n} · ${L(ch.id, ch.en)}`),
        el("div", { class: "ck-nodes" }, levels)))
    }
    out.push(el("section", { class: "ck-chapter soon" }, el("h3", { text: `☕ ${L("Bab 3 · Kafe Kekinian — segera", "Chapter 3 · The Trendy Café — soon")}` })))
    if (S.data.friends.length) {
      out.push(el("section", { class: "ck-friends" }, el("h3", { text: L("Teman", "Friends") }),
        S.data.friends.map((f) => el("div", { class: "ck-friend" }, el("span", { class: "av", style: { "--c": f.color }, text: f.avatar }),
          el("b", { text: f.name }), el("small", { text: `Lv ${f.level} · ⭐${f.stars} · 🏆${f.wins}` })))))
    }
    out.push(el("p", { class: "muted small center", text: L("Duel: buat ruang 'Wok & Roll Duel' di halaman Main. Skill, alat & item kariermu ikut terpakai!",
      "Duel: open a 'Wok & Roll Duel' room on the Play page. Your career skills, gear and items come with you!") }))
    return out
  }

  function drawEquip() {
    const sv = save()
    return el("div", { class: "ck-shop" }, Object.entries(cat.equip).map(([k, d]) => {
      const lv = sv.equip[k] || 0, max = d.cost.length - 1
      const cost = lv < max ? d.cost[lv + 1] : null
      const btn = el("button", { class: "btn primary small", type: "button", disabled: cost === null || sv.money < cost,
        text: cost === null ? L("Maks", "Max") : `${lv ? L("Naikkan", "Upgrade") : L("Beli", "Buy")} ${money(cost)}` })
      btn.onclick = async () => { const r = await act("/cook/buy", { kind: "equip", key: k }, btn); if (r) { sfx.cash(); if (k === "wajan2") buildDiorama() } }
      return el("div", { class: "ck-card-row" }, el("span", { class: "ck-ic", text: d.icon }),
        el("div", { class: "grow" }, el("b", { text: L(d.id, d.en) }), el("small", { class: "muted", text: L(d.did, d.den) }),
          el("span", { class: "ck-pips" }, Array.from({ length: max }, (_, i) => el("i", { class: i < lv ? "on" : "" })))), btn)
    }))
  }

  function drawSkills() {
    const sv = save(), lvl = S.data.level
    return [el("p", { class: "muted small", text: L(`Poin skill: ${S.data.points}. Dapat 1 poin tiap naik level chef.`, `Skill points: ${S.data.points}. You get 1 per chef level.`) }),
      el("div", { class: "ck-shop" }, Object.entries(cat.skills).map(([k, d]) => {
        const r = sv.skills[k] || 0, max = d.v.length - 1
        const need = r < max ? d.lvl[r + 1] : null
        const can = need !== null && lvl >= need && S.data.points > 0
        const btn = el("button", { class: "btn small" + (can ? " primary" : ""), type: "button", disabled: !can,
          text: need === null ? L("Maks", "Max") : lvl < need ? `Lv ${need}` : L("Pelajari", "Learn") })
        btn.onclick = async () => { const res = await act("/cook/buy", { kind: "skill", key: k }, btn); if (res) sfx.ladder() }
        return el("div", { class: "ck-card-row" }, el("span", { class: "ck-ic", text: d.icon }),
          el("div", { class: "grow" }, el("b", { text: L(d.id, d.en) }), el("small", { class: "muted", text: L(d.did, d.den) }),
            el("span", { class: "ck-pips" }, Array.from({ length: max }, (_, i) => el("i", { class: i < r ? "on" : "" })))), btn)
      }))]
  }

  function drawItems() {
    const sv = save()
    return [el("p", { class: "muted small", text: L(`Pakai maksimal ${cat.max_item_uses} item per hari/duel. Bintang 3 pertama kali = 2 item gratis!`,
      `Use up to ${cat.max_item_uses} items per day/duel. First 3-star clear = 2 free items!`) }),
    el("div", { class: "ck-shop" }, Object.entries(cat.items).map(([k, d]) => {
      const have = sv.items[k] || 0
      const btn = el("button", { class: "btn small primary", type: "button", disabled: sv.money < d.cost || have >= 9, text: `+1 ${money(d.cost)}` })
      btn.onclick = async () => { const r = await act("/cook/buy", { kind: "item", key: k }, btn); if (r) sfx.pop() }
      return el("div", { class: "ck-card-row" }, el("span", { class: "ck-ic", text: d.icon }),
        el("div", { class: "grow" }, el("b", { text: `${L(d.id, d.en)} ×${have}` }), el("small", { class: "muted", text: L(d.did, d.den) })), btn)
    }))]
  }

  function drawChef() {
    const sv = save()
    const stars = Object.values(sv.stars).reduce((a, b) => a + b, 0)
    const name = el("input", { value: sv.chef.name || "", maxlength: 24, placeholder: L("Nama chef", "Chef name") })
    const saveName = el("button", { class: "btn small", type: "button", text: L("Simpan", "Save") })
    saveName.onclick = () => act("/cook/chef", { name: name.value }, saveName)
    const hatNames = { toque: L("Topi chef", "Chef's hat"), bandana: "Bandana", cap: L("Topi", "Cap"), peci: "Peci", crown: L("Mahkota Wajan Emas", "Golden Wok Crown") }
    const pick = (field, value) => act("/cook/chef", { [field]: value }).then((r) => { if (r) buildDiorama() })
    return [
      el("div", { class: "field" }, el("span", { text: L("Nama chef", "Chef name") }), el("div", { class: "row" }, name, saveName)),
      el("div", { class: "field" }, el("span", { text: L("Karakter", "Character") }), el("div", { class: "ck-chips" }, cat.models.map((m, i) =>
        el("button", { type: "button", class: `chip${sv.chef.model === m ? " on" : ""}`, text: `${["👩", "👧", "👱‍♀️", "👩‍🦰", "🧑", "🧑‍🔬", "👨", "🧔"][i] || "🙂"} ${i + 1}`, onclick: () => pick("model", m) })))),
      el("div", { class: "field" }, el("span", { text: L("Topi", "Hat") }), el("div", { class: "ck-chips" }, cat.hats.map(([h, need]) =>
        el("button", { type: "button", class: `chip${sv.chef.hat === h ? " on" : ""}`, disabled: stars < need, text: stars < need ? `🔒 ${hatNames[h]} (⭐${need})` : hatNames[h], onclick: () => pick("hat", h) })))),
      el("div", { class: "field" }, el("span", { text: L("Warna gerobak", "Cart colour") }), el("div", { class: "ck-chips" }, cat.carts.map(([c, need]) =>
        el("button", { type: "button", class: `chip${sv.chef.cart === c ? " on" : ""}`, disabled: stars < need, style: { "--sw": CART_COLORS[c] },
          text: stars < need ? `🔒 ⭐${need}` : "", onclick: () => pick("cart", c) }, el("i", { class: "ck-swatch" }))))),
      el("p", { class: "muted small", text: L(`Statistik: ${sv.stats.days} hari, ${sv.stats.served} pembeli, ${sv.stats.duels} duel, ${sv.stats.wins} menang.`,
        `Stats: ${sv.stats.days} days, ${sv.stats.served} customers, ${sv.stats.duels} duels, ${sv.stats.wins} wins.`) }),
    ]
  }

  function draw() {
    const map = { map: drawMap, equip: drawEquip, skills: drawSkills, items: drawItems, chef: drawChef }
    body.replaceChildren(...[].concat(map[S.tab]()))
  }

  // ---- playing a day ---------------------------------------------------------------------------------------------
  async function startLevel(key) {
    const lv = levelByKey(key)
    if (!lv) return
    S.diorama?.destroy(); S.diorama = null
    const sv = save()
    const chapter = CHAPTERS.find((c) => c.n === lv.chapter)
    const seen = new Set(sv.seen)
    const story = []
    const keys = []
    if (lv.key.endsWith("-1") && !seen.has(`c${chapter.n}`)) { story.push(...chapter.intro); keys.push(`c${chapter.n}`) }
    if (lv.before && !seen.has(`${lv.key}b`)) { story.push(...lv.before); keys.push(`${lv.key}b`) }
    const host = el("div", { class: "ck-full" })
    document.body.append(host)
    const kit = S.data.kit
    let ctl = null
    const close = () => { ctl?.destroy(); host.remove(); S.playing = null; buildDiorama(); drawStats(); draw() }
    ctl = await playDay(host, {
      level: lv, kit, seed: hashSeed(lv.key),
      story: story.length ? (stage) => runStory(stage, story, { chefName: sv.chef.name }) : null,
      quit: close,
      onEnd: (res) => results(host, lv, res, close, keys),
    })
    S.playing = ctl
    ctl.begin()
  }

  async function results(host, lv, res, close, keys) {
    const r = await api("/cook/day", { method: "POST", json: { key: lv.key, coins: res.coins, stars: res.stars, served: res.served, used: res.used } }).catch((e) => { toast(e.message, "bad"); return null })
    if (keys.length) api("/cook/chef", { method: "POST", json: { seen: keys } }).then((x) => Object.assign(S.data, x)).catch(() => {})
    if (r) Object.assign(S.data, r)
    const got = r?.result || {}
    const chapter = CHAPTERS.find((c) => c.n === lv.chapter)
    const lastOfChapter = chapter.levels[chapter.levels.length - 1].key === lv.key
    const after = [...(res.stars && lv.after && !save().seen.includes(`${lv.key}a`) ? lv.after : []), ...(res.stars && lastOfChapter && !save().seen.includes(`c${chapter.n}o`) ? chapter.outro : [])]
    const idx = CHAPTERS.flatMap((c) => c.levels).findIndex((x) => x.key === lv.key)
    const next = CHAPTERS.flatMap((c) => c.levels)[idx + 1]
    if (res.stars === 3) confetti(120)
    if (res.stars) sfx.fanfare(); else sfx.lose()
    const panel = el("div", { class: "ck-result" },
      el("h2", { text: res.stars ? L("Hari yang hebat!", "What a day!") : L("Belum berhasil…", "Not quite…") }),
      el("div", { class: "ck-bigstars" }, [0, 1, 2].map((i) => el("i", { class: i < res.stars ? "on" : "", style: { animationDelay: `${0.3 + i * 0.35}s` }, text: "★" }))),
      el("div", { class: "ck-res-rows" },
        el("div", {}, el("span", { text: L("Pendapatan", "Takings") }), el("b", { text: money(res.coins) })),
        el("div", {}, el("span", { text: L("Pembeli puas", "Happy customers") }), el("b", { text: `${res.served} / ${res.served + res.lost}` })),
        el("div", {}, el("span", { text: L("Combo terbaik", "Best combo") }), el("b", { text: `×${res.combo}` })),
        r ? el("div", { class: "gain" }, el("span", { text: L("Masuk tabungan", "To savings") }), el("b", { text: `+${money(got.money || 0)}` })) : null,
        r ? el("div", { class: "gain" }, el("span", { text: "XP" }), el("b", { text: `+${got.xp || 0}` })) : null),
      got.level_up ? el("div", { class: "ck-levelup", text: L(`Naik level! Chef Lv ${got.level} — dapat 1 poin skill ✨`, `Level up! Chef Lv ${got.level} — 1 skill point ✨`) }) : null,
      got.drops && Object.keys(got.drops).length ? el("div", { class: "ck-drops" }, L("Hadiah: ", "Reward: "), Object.entries(got.drops).map(([k, n]) => el("span", { text: `${ITEM_ICONS[k]}×${n}` }))) : null,
      el("div", { class: "row", style: { gap: "8px", marginTop: "16px" } },
        el("button", { class: "btn grow", type: "button", text: L("Ulangi", "Retry"), onclick: () => { close(); startLevel(lv.key) } }),
        next && res.stars ? el("button", { class: "btn primary grow", type: "button", text: L("Lanjut ▶", "Next ▶"), onclick: () => { close(); startLevel(next.key) } }) : null,
        el("button", { class: "btn grow", type: "button", text: L("Peta", "Map"), onclick: close })))
    if (after.length && S.playing) {
      await runStory(S.playing.stage, after, { chefName: save().chef.name })
      const k2 = [lv.after ? `${lv.key}a` : null, lastOfChapter ? `c${chapter.n}o` : null].filter(Boolean)
      api("/cook/chef", { method: "POST", json: { seen: k2 } }).then((x) => Object.assign(S.data, x)).catch(() => {})
    }
    host.append(panel)
  }

  drawStats(); drawTabs(); draw()
  buildDiorama()
}
