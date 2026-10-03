// Wok & Roll counter simulation (Cooking-Fever style): pure logic, no 3D, deterministic for a seed so a duel
// gives every phone the same customers. Taps act at once (you are the chef's hands): tap a bin → it goes into a
// free cooker, tap a cooked dish → onto a free plate, tap a topping → onto the first plate that needs it,
// tap a plate (or drag it) → to the customer who ordered it. Money is in thousands of Rupiah ("rb").
import { CUSTOMERS, DISHES, LAYOUTS, TOPS } from "./levels.js?v=__VERSION__"

export function rng(seed) {
  let a = seed >>> 0 || 1
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export const hashSeed = (s) => [...String(s)].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7)

const WALK = 1.4              // seconds to walk in / out
const READ = 0.9              // a customer looks at the menu before the order card appears
const TIP = 0.25              // tip share of the bill at full hearts (times the customer's tip factor)
const PENDING_MAX = 4         // customers waiting off-screen for a free spot
export const DEFAULT_KIT = { cook: 1, burn: 1, plates: 0, patience: 1, tip: 1, drink: 1, seats: 0, wok2: false, quick: 1, heart: 1,
  prep: 0, combo: 0, cat: 0, card: 5, resist: 1, items: {}, level: 1 }

function pickW(r, weights) {
  const ent = Object.entries(weights)
  let x = r() * ent.reduce((a, [, w]) => a + w, 0)
  for (const [k, w] of ent) { x -= w; if (x <= 0) return k }
  return ent[ent.length - 1][0]
}
export const sameTops = (a, b) => a.length === b.length && a.every((x) => b.includes(x))
export const linePrice = (l) => DISHES[l.dish].price + l.tops.reduce((s, t) => s + TOPS[t].price, 0)
const wants = (l, item) => !l.done && l.dish === item.dish && sameTops(l.tops, item.tops)

export class Kitchen {
  constructor(level, kit, seed) {
    this.level = level
    this.kit = { ...DEFAULT_KIT, ...(kit || {}) }
    this.L = LAYOUTS[level.layout]
    this.r = rng(seed)
    this.t = 0
    this.coins = 0; this.served = 0; this.lost = 0; this.perfect = 0
    this.combo = 0; this.comboT = -99; this.bestCombo = 0; this.cards = 0
    this.used = {}; this.fx = { kopi: 0, sambal: 0, catSafe: 0, dark: 0, darkSafe: 0, rain: 0, rainSafe: 0 }
    this.over = false; this.closing = false
    this.out = []
    this.nextId = 1
    const groups = new Set(level.stations)
    this.pieces = this.L.pieces
      .filter((p) => groups.has(p.g) && (!p.extra || this.kit[p.extra]))
      .map((p) => ({ ...p, state: p.kind === "pot" ? "ready" : "empty", t: 0, portions: p.portions || 0 }))
    for (const p of this.pieces) if (p.feeds) p.feeds = p.feeds.filter((id) => this.piece(id))
    const nPlates = Math.min(this.L.plates.length, 3 + (this.kit.plates || 0))
    this.plates = Array.from({ length: nPlates }, (_, i) => ({ i, item: null }))
    const nSlots = Math.min((this.kit.seats ? this.L.slots4 : this.L.slots).length, (level.slots || 3) + (this.kit.seats || 0))
    this.slots = Array.from({ length: nSlots }, (_, i) => ({ i, cust: null }))
    this.customers = []
    this.pending = []
    this.cats = []
    this.schedule = this.makeSchedule()
    this.events = (level.events || []).map((e) => ({ ...e, done: false }))
    this.limit = level.limit || 600
    this.goals = this.makeGoals()
    // Prep Ahead skill: plain fried rice already waiting on plates.
    const base = Object.keys(level.menu).find((d) => !DISHES[d].drink)
    for (let i = 0; i < Math.min(this.kit.prep || 0, this.plates.length); i++) this.plates[i].item = { dish: base, tops: [] }
  }

  piece(id) { return this.pieces.find((p) => p.id === id) }
  cookT(p) { return p.cook * this.kit.cook * this.kit.quick * (this.t < this.fx.kopi ? 0.5 : 1) }
  burnT(p) { return p.burn * this.kit.burn }

  // ---- customers that will come today (fixed by the seed) ------------------------------------------
  makeSchedule() {
    const lv = this.level, r = this.r, list = []
    let t = lv.first ?? 2
    const add = (at, type) => {
      const def = CUSTOMERS[type]
      const model = Array.isArray(def.model) ? def.model[Math.floor(r() * def.model.length)] : def.model
      list.push({ at, type, model, order: this.makeOrder(def) })
    }
    for (let i = 0; i < lv.customers; i++) {
      add(t, pickW(r, lv.types))
      t += lv.gap[0] + r() * (lv.gap[1] - lv.gap[0])
    }
    for (const e of lv.events || []) {
      if (e.kind === "rush") for (let k = 0; k < e.n; k++) add(e.at + k * 0.7, pickW(r, lv.types))
      if (e.kind === "critic") add(e.at, "critic")
      if (e.kind === "rain") for (let k = 0; k < 3; k++) add(e.at + 2 + k * 3, pickW(r, lv.types))
    }
    return list.sort((a, b) => a.at - b.at)
  }

  makeOrder(def) {
    const lv = this.level, r = this.r
    const counts = lv.items || [1]
    let n = counts.length > 1 && r() < 0.42 ? counts[1] : counts[0]
    if (def.cheap) n = 1
    const lines = []
    const drinks = Object.keys(lv.menu).filter((d) => DISHES[d].drink)
    const foods = Object.keys(lv.menu).filter((d) => !DISHES[d].drink)
    for (let i = 0; i < n; i++) {
      let dish
      if (i === 1 && drinks.length && !DISHES[lines[0].dish].drink && r() < 0.7) dish = pickW(r, Object.fromEntries(drinks.map((d) => [d, lv.menu[d]])))
      else dish = pickW(r, lv.menu)
      if (def.cheap && foods.length) dish = foods[0]
      const allowed = DISHES[dish].tops.filter((t) => (lv.tops || []).includes(t))
      const tops = def.cheap ? [] : allowed.filter(() => def.influencer || def.critic || r() < (lv.topProb || 0))
      lines.push({ dish, tops, done: false })
    }
    return lines
  }

  makeGoals() {
    let pot = 0
    for (const c of this.schedule) {
      const def = CUSTOMERS[c.type]
      const base = c.order.reduce((s, l) => s + linePrice(l), 0)
      pot += base * (1 + TIP * def.tip * (def.fussy ? 2 : 1)) + (def.influencer ? 8 : 0) + (def.critic ? 20 : 0)
    }
    const r5 = (x) => Math.max(5, Math.round(x / 5) * 5)
    return [r5(pot * 0.4), r5(pot * 0.6), r5(pot * 0.78)]
  }

  stars() { return this.goals.filter((g) => this.coins >= g).length }
  emit(e) { this.out.push({ ...e, t: this.t }) }
  hidden() { return this.t < this.fx.dark }   // power cut: order cards go dark

  // ---- input --------------------------------------------------------------------------------------
  // tap({type: "piece", id}) | tap({type: "plate", i}) | tap({type: "cat", id})
  tap(tg) {
    if (this.over) return false
    if (tg.type === "cat") return this.shoo(tg.id)
    if (tg.type === "plate") return this.serveFrom({ plate: tg.i })
    const p = this.piece(tg.id)
    if (!p) return false
    if (p.kind === "src") {
      const c = p.feeds.map((id) => this.piece(id)).find((x) => x.state === "empty")
      if (!c) return this.nope("busy", p.id)
      c.state = "cooking"; c.t = this.t
      this.emit({ e: "start", id: c.id, from: p.id })
      return true
    }
    if (p.kind === "cook") {
      if (p.state === "burnt") { p.state = "empty"; this.emit({ e: "trash", id: p.id }); return true }
      if (p.state !== "ready") return this.nope("notyet", p.id)
      if (p.topping) {
        const pl = this.plates.find((x) => x.item && DISHES[x.item.dish].tops.includes(p.makes) && !x.item.tops.includes(p.makes))
        if (!pl) return this.nope("noplate", p.id)
        pl.item.tops.push(p.makes); p.state = "empty"
        this.emit({ e: "top", id: p.id, plate: pl.i, top: p.makes })
        return true
      }
      const pl = this.plates.find((x) => !x.item)
      if (!pl) return this.nope("full", p.id)
      pl.item = { dish: p.makes, tops: [] }; p.state = "empty"
      this.emit({ e: "plate", from: p.id, plate: pl.i })
      return true
    }
    if (p.kind === "pot") {
      if (p.state !== "ready") return this.nope("notyet", p.id)
      const pl = this.plates.find((x) => !x.item)
      if (!pl) return this.nope("full", p.id)
      pl.item = { dish: p.makes, tops: [] }
      if (--p.portions <= 0) { p.state = "refill"; p.t = this.t }
      this.emit({ e: "plate", from: p.id, plate: pl.i })
      return true
    }
    if (p.kind === "top") {
      const pl = this.plates.find((x) => x.item && DISHES[x.item.dish].tops.includes(p.adds) && !x.item.tops.includes(p.adds))
      if (!pl) return this.nope("noplate", p.id)
      pl.item.tops.push(p.adds)
      this.emit({ e: "top", id: p.id, plate: pl.i, top: p.adds })
      return true
    }
    if (p.kind === "drink") {
      if (p.state === "empty") { p.state = "filling"; p.t = this.t; this.emit({ e: "pour", id: p.id }); return true }
      if (p.state === "full") return this.serveFrom({ drink: p.id })
      return this.nope("notyet", p.id)
    }
    return false
  }

  nope(why, id, plate) { this.emit({ e: "nope", why, id, plate }); return false }

  // Drag & drop: a plate / a full cup onto a customer (by slot) or the bin.
  drop(from, to) {
    if (this.over) return false
    const cup = from.drink ? this.piece(from.drink) : null
    const item = from.plate !== undefined ? this.plates[from.plate]?.item : cup && cup.state === "full" ? { dish: cup.makes, tops: [] } : null
    if (!item) return false
    if (to.type === "trash") {
      if (from.plate !== undefined) this.plates[from.plate].item = null
      else cup.state = "empty"
      this.emit({ e: "trash", plate: from.plate, id: from.drink })
      return true
    }
    if (to.type === "cust") {
      const c = this.slots[to.slot]?.cust
      if (!c || c.state !== "wait") return this.nope("nobody", from.drink, from.plate)
      const l = c.order.find((x) => wants(x, item))
      if (!l) { this.emit({ e: "wrong", cust: c.id, slot: c.slot }); return false }
      this.give(c, l, from)
      return true
    }
    return false
  }

  // Tap a customer: hand over whatever ready plate / cup matches their order.
  serveTo(slot) {
    const c = this.slots[slot]?.cust
    if (this.over || !c || c.state !== "wait") return false
    for (const l of c.order) {
      if (l.done) continue
      const pl = this.plates.find((x) => x.item && wants(l, x.item))
      if (pl) { this.give(c, l, { plate: pl.i }); return true }
      const cup = this.pieces.find((p) => p.kind === "drink" && p.state === "full" && p.makes === l.dish && !l.tops.length)
      if (cup) { this.give(c, l, { drink: cup.id }); return true }
    }
    return this.nope("nothing")
  }

  // Tap a plate / full cup: it goes to the customer who has waited longest for exactly that.
  serveFrom(from) {
    const item = from.plate !== undefined ? this.plates[from.plate]?.item : { dish: this.piece(from.drink).makes, tops: [] }
    if (!item) return false
    const waiting = this.customers.filter((c) => c.state === "wait").sort((a, b) => a.since - b.since)
    for (const c of waiting) {
      const l = c.order.find((x) => wants(x, item))
      if (l) { this.give(c, l, from); return true }
    }
    // someone wants this dish with other toppings → tell the player
    const close = waiting.some((c) => c.order.some((l) => !l.done && l.dish === item.dish))
    return this.nope(close ? "tops" : "nobody", from.drink, from.plate)
  }

  give(c, l, from) {
    l.done = true
    if (from.plate !== undefined) this.plates[from.plate].item = null
    else this.piece(from.drink).state = "empty"
    this.emit({ e: "give", cust: c.id, slot: c.slot, plate: from.plate, id: from.drink, dish: l.dish, tops: [...l.tops] })
    if (c.order.every((x) => x.done)) this.pay(c)
    else c.hearts = Math.min(5, c.hearts + 1 * this.kit.heart)
  }

  itemsLeft(k) { return Math.max(0, (this.kit.items[k] || 0) - (this.used[k] || 0)) }
  usesLeft() { return Math.max(0, 3 - Object.values(this.used).reduce((a, b) => a + b, 0)) }
  useItem(k) {
    if (this.over || !this.itemsLeft(k) || !this.usesLeft()) return false
    this.used[k] = (this.used[k] || 0) + 1
    const t = this.t, fx = this.fx
    if (k === "kopi") fx.kopi = t + 10
    if (k === "bel") for (const c of [...this.customers, ...this.pending]) c.hearts = Math.min(5, c.hearts + 2)
    if (k === "sambal") fx.sambal = 3
    if (k === "ikan") { for (const c of this.cats) c.state = "flee"; fx.catSafe = t + 20 }
    if (k === "senter") { fx.dark = 0; fx.darkSafe = t + 20 }
    if (k === "payung") { fx.rain = 0; fx.rainSafe = t + 20 }
    this.emit({ e: "item", k })
    return true
  }

  // A prank from a duel opponent (or a story event).
  prank(kind, dur = 10) {
    const t = this.t, fx = this.fx
    if (kind === "cat") return this.spawnCat()
    if (kind === "blackout") { if (t < fx.darkSafe) { this.emit({ e: "blocked", kind }); return } fx.dark = Math.max(fx.dark, t + dur) }
    if (kind === "rain") { if (t < fx.rainSafe) { this.emit({ e: "blocked", kind }); return } fx.rain = Math.max(fx.rain, t + dur) }
    this.emit({ e: kind })
  }

  // ---- cats: Oyen hops onto the counter and creeps toward a full plate (p: 0 = at the edge, 1 = at the plate) -----
  spawnCat() {
    if (this.t < this.fx.catSafe) { this.emit({ e: "blocked", kind: "cat" }); return }
    const c = { id: this.nextId++, side: this.r() < 0.5 ? -1 : 1, p: 0, plate: null, state: "sneak", t: this.t, sit: 0 }
    if (this.kit.cat >= 3 && !this.autoShoo) { this.autoShoo = true; c.state = "flee"; this.emit({ e: "shoo", id: c.id, auto: true }) }
    this.cats.push(c)
    this.emit({ e: "cat", id: c.id })
  }

  shoo(id) {
    const c = this.cats.find((x) => x.id === id)
    if (!c || c.state === "flee") return false
    c.state = "flee"; this.emit({ e: "shoo", id })
    return true
  }

  stepCats(dt) {
    const sneak = 6.5 * (1 + 0.3 * this.kit.cat)      // seconds from the edge to the plate
    for (const c of [...this.cats]) {
      if (c.state === "flee") {
        c.p -= dt * 1.6
        if (c.p <= -0.6) this.cats.splice(this.cats.indexOf(c), 1)
        continue
      }
      if (c.plate === null || !this.plates[c.plate].item) {
        const full = this.plates.filter((p) => p.item)
        if (!full.length) { if (this.t - c.t > 8) c.state = "flee"; continue }
        c.plate = full[Math.floor(this.r() * full.length)].i
      }
      if (c.p < 1) { c.p = Math.min(1, c.p + dt / sneak); c.sit = 0 }
      else if ((c.sit += dt) > 0.8) {
        const pl = this.plates[c.plate]
        if (pl.item) { pl.item = null; this.emit({ e: "stolen", plate: pl.i }) }
        c.state = "flee"
      }
    }
  }

  // ---- the clock ----------------------------------------------------------------------------------
  step(dt) {
    if (this.over) return []
    this.t += dt
    const t = this.t
    for (const ev of this.events) if (!ev.done && t >= ev.at) {
      ev.done = true
      if (ev.kind === "cat") this.spawnCat()
      if (ev.kind === "blackout") this.prank("blackout", ev.dur || 12)
      if (ev.kind === "rain") this.prank("rain", ev.dur || 20)
      if (ev.kind === "rush") this.emit({ e: "rush", bedug: !!ev.bedug })
      if (ev.kind === "critic") this.emit({ e: "critic" })
    }
    while (this.schedule.length && this.schedule[0].at <= t && !this.closing) this.arrive(this.schedule.shift())
    for (const p of this.pieces) {
      if (p.kind === "cook") {
        if (p.state === "cooking" && t - p.t >= this.cookT(p)) { p.state = "ready"; p.t = t; this.emit({ e: "ready", id: p.id }) }
        else if (p.state === "ready" && t - p.t >= this.burnT(p)) { p.state = "burnt"; p.t = t; this.emit({ e: "burnt", id: p.id }) }
      } else if (p.kind === "pot" && p.state === "refill" && t - p.t >= p.refill * this.kit.cook * this.kit.quick) {
        p.state = "ready"; p.portions = this.L.pieces.find((x) => x.id === p.id).portions; this.emit({ e: "ready", id: p.id })
      } else if (p.kind === "drink" && p.state === "filling" && t - p.t >= p.prep * this.kit.drink) { p.state = "full"; this.emit({ e: "ready", id: p.id }) }
    }
    this.stepCustomers(dt)
    this.stepCats(dt)
    if (!this.closing && (t >= this.limit || (!this.schedule.length && !this.customers.length && !this.pending.length && t > 3))) this.close()
    const out = this.out
    this.out = []
    return out
  }

  close() {
    this.closing = true
    for (const c of this.customers) if (c.state !== "out") this.walkOut(c)
    this.over = true
    this.emit({ e: "close", stars: this.stars() })
  }

  // ---- customers ----------------------------------------------------------------------------------
  arrive(a) {
    const def = CUSTOMERS[a.type]
    const c = { id: this.nextId++, type: a.type, def, model: a.model, order: a.order.map((l) => ({ ...l })), hearts: 5, P: def.P,
      state: "pending", since: this.t, slot: null, p: 0, tp: 0, t: this.t, moving: false, side: 1 }
    if (this.pending.length >= PENDING_MAX) { this.lost++; this.emit({ e: "skip" }); return }
    this.pending.push(c)
  }

  stepCustomers(dt) {
    const t = this.t, fx = this.fx
    const rate = (c, k) => {
      let m = k * 5 / (c.P * this.kit.patience * (this.level.patience || 1))
      if (t < fx.rain) m *= 1.5
      if (t < fx.dark) m *= 0.85
      return m * dt
    }
    // waiting off-screen for a free spot at the counter
    for (const c of [...this.pending]) {
      c.hearts -= rate(c, 0.45)
      if (c.hearts <= 0) { this.pending.splice(this.pending.indexOf(c), 1); this.lost++; this.emit({ e: "skip" }); continue }
      const free = this.slots.filter((s) => !s.cust)
      if (!free.length) continue
      const s = free[Math.floor(this.r() * free.length)]
      this.pending.splice(this.pending.indexOf(c), 1)
      s.cust = c; c.slot = s.i; c.state = "walk"; c.p = 0; c.tp = 1; c.side = s.i < this.slots.length / 2 ? -1 : 1
      this.customers.push(c)
      this.emit({ e: "arrive", id: c.id, slot: s.i })
    }
    for (const c of [...this.customers]) {
      // p: 0 = off-screen at the side, 1 = at the counter spot
      const d = c.tp - c.p
      if (Math.abs(d) > 1e-4) { c.p += Math.sign(d) * Math.min(Math.abs(d), dt / WALK); c.moving = true } else c.moving = false
      if (c.state === "walk" && !c.moving) { c.state = "read"; c.t = t }
      else if (c.state === "read" && t - c.t >= READ) { c.state = "wait"; c.t = t; this.emit({ e: "order", id: c.id, slot: c.slot }) }
      else if (c.state === "wait") { c.hearts -= rate(c, 1); if (c.hearts <= 0) this.angry(c) }
      else if ((c.state === "happy" || c.state === "mad") && t - c.t > 0.9) this.walkOut(c)
      else if (c.state === "out" && !c.moving) this.customers.splice(this.customers.indexOf(c), 1)
    }
  }

  walkOut(c) {
    c.state = "out"
    c.tp = 0
    c.moving = true
    if (c.slot !== null) { c.lastSlot = c.slot; this.slots[c.slot].cust = null; c.slot = null }
  }

  angry(c) {
    this.lost++
    c.state = "mad"; c.t = this.t; c.hearts = 0
    this.combo = 0
    this.emit({ e: "angry", id: c.id, slot: c.slot })
  }

  bill(c) {
    const def = c.def
    const base = c.order.reduce((s, l) => s + linePrice(l), 0)
    let tipF = TIP * def.tip * (c.hearts / 5)
    if (def.fussy) tipF *= c.hearts >= 4 ? 2.4 : 0.4
    let tip = base * tipF * this.kit.tip
    if (this.fx.sambal > 0) { tip *= 2; this.fx.sambal--; this.emit({ e: "sambal" }) }
    let extra = 0
    if (def.influencer) { extra = c.hearts >= 4 ? 8 : c.hearts < 2 ? -4 : 0; if (extra) this.emit({ e: extra > 0 ? "viral" : "review", id: c.id }) }
    if (def.critic) { extra = c.hearts >= 4 ? 20 : 0; this.emit({ e: extra ? "critic_happy" : "critic_meh", id: c.id }) }
    if (c.hearts >= 4.5) this.perfect++
    return Math.max(1, Math.round(base + tip + extra))
  }

  pay(c) {
    this.served++
    c.hearts = Math.min(5, c.hearts + 0.5 * this.kit.heart)
    this.bump()
    const amount = this.bill(c) + this.comboBonus()
    this.coins += amount
    c.state = "happy"; c.t = this.t
    this.emit({ e: "cash", amount, id: c.id, slot: c.slot, hearts: c.hearts })
  }

  bump() {
    const win = 4 + 0.8 * this.kit.combo
    this.combo = this.t - this.comboT <= win ? this.combo + 1 : 1
    this.comboT = this.t
    this.bestCombo = Math.max(this.bestCombo, this.combo)
    if (this.combo > 1) this.emit({ e: "combo", n: this.combo })
    if (this.level.duel && this.combo > 1 && this.combo % this.kit.card === 0 && this.cards < 2) { this.cards++; this.emit({ e: "card" }) }
  }

  comboBonus() { return this.combo > 1 ? (this.combo - 1) * (2 + this.kit.combo) : 0 }
}
