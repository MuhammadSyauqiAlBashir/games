// Silly sounds for emoji reactions (synthesized, no files): the "make fun of each other" soundboard.
// Every phone in the room plays the sender's emoji; each player's own sound on/off setting applies.
import { audio, masterVolume } from "./sound.js?v=__VERSION__"

// ---- tiny synth kit -------------------------------------------------------------------------------------------
function out(a, vol) {
  const g = a.createGain()
  g.gain.value = vol * masterVolume()
  g.connect(a.destination)
  return g
}
// osc(a, dest, {type, f: [[time, freq]...], dur, at, env: [attack, release], vib: [rate, depth]})
function osc(a, dest, { type = "sine", f, dur, at = 0, env = [0.01, 0.08], vol = 1, vib = null, filter = null }) {
  const t0 = a.currentTime + at
  const o = a.createOscillator(), g = a.createGain()
  o.type = type
  const pts = Array.isArray(f) ? f : [[0, f]]
  o.frequency.setValueAtTime(pts[0][1], t0)
  for (const [t, hz] of pts.slice(1)) o.frequency.exponentialRampToValueAtTime(Math.max(20, hz), t0 + t)
  if (vib) { const l = a.createOscillator(), lg = a.createGain(); l.frequency.value = vib[0]; lg.gain.value = vib[1]; l.connect(lg).connect(o.frequency); l.start(t0); l.stop(t0 + dur + 0.05) }
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(vol, t0 + env[0])
  g.gain.setValueAtTime(vol, t0 + Math.max(env[0], dur - env[1]))
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  let node = o
  if (filter) { const fl = a.createBiquadFilter(); fl.type = filter[0]; fl.frequency.value = filter[1]; fl.Q.value = filter[2] || 1; node.connect(fl); node = fl }
  node.connect(g).connect(dest)
  o.start(t0); o.stop(t0 + dur + 0.05)
  return o
}
let noiseBuf = null
function noise(a, dest, { dur, at = 0, vol = 1, filter = ["lowpass", 1000, 1], sweep = null, am = null, env = [0.01, 0.1] }) {
  if (!noiseBuf || noiseBuf.sampleRate !== a.sampleRate) {
    noiseBuf = a.createBuffer(1, a.sampleRate * 2, a.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  const t0 = a.currentTime + at
  const s = a.createBufferSource(), fl = a.createBiquadFilter(), g = a.createGain()
  s.buffer = noiseBuf; s.loop = true
  fl.type = filter[0]; fl.frequency.setValueAtTime(filter[1], t0); fl.Q.value = filter[2] || 1
  if (sweep) fl.frequency.exponentialRampToValueAtTime(sweep, t0 + dur)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(vol, t0 + env[0])
  g.gain.setValueAtTime(vol, t0 + Math.max(env[0], dur - env[1]))
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  let last = g
  if (am) { const m = a.createGain(), l = a.createOscillator(), lg = a.createGain(); m.gain.value = 0.5; l.frequency.value = am; lg.gain.value = 0.5; l.connect(lg).connect(m.gain); l.start(t0); l.stop(t0 + dur + 0.05); g.connect(m); last = m }
  s.connect(fl).connect(g)
  last.connect(dest)
  s.start(t0); s.stop(t0 + dur + 0.05)
}

// ---- the soundboard --------------------------------------------------------------------------------------------
const SOUNDS = {
  "😂": (a, d) => [620, 560, 600, 520, 560, 470].forEach((f, i) => osc(a, d, { type: "square", f: [[0, f], [0.09, f * 0.8]], dur: 0.11, at: i * 0.13, vol: 0.35, filter: ["lowpass", 1800] })),
  "😱": (a, d) => { osc(a, d, { type: "sawtooth", f: [[0, 380], [0.5, 1300]], dur: 0.9, vol: 0.3, vib: [11, 40], filter: ["bandpass", 1400, 1.5] }); noise(a, d, { dur: 0.8, vol: 0.12, filter: ["highpass", 2500] }) },
  "🔥": (a, d) => { noise(a, d, { dur: 0.7, vol: 0.45, filter: ["bandpass", 400, 0.8], sweep: 2500 }); for (let i = 0; i < 9; i++) noise(a, d, { dur: 0.025, at: 0.1 + Math.random() * 0.6, vol: 0.5, filter: ["highpass", 3000] }) },
  "👏": (a, d) => { for (let i = 0; i < 8; i++) noise(a, d, { dur: 0.06, at: i * 0.11 + Math.random() * 0.03, vol: 0.8, filter: ["bandpass", 1500 + Math.random() * 700, 1.2], env: [0.002, 0.05] }) },
  "😭": (a, d) => { [[392, 0], [370, 0.35], [349, 0.7]].forEach(([f, t]) => osc(a, d, { type: "sawtooth", f, dur: 0.32, at: t, vol: 0.3, filter: ["lowpass", 900] })); osc(a, d, { type: "sawtooth", f: [[0, 330], [1, 300]], dur: 1.1, at: 1.05, vol: 0.32, vib: [6, 9], filter: ["lowpass", 800] }) },
  "😡": (a, d) => { osc(a, d, { type: "sawtooth", f: [[0, 95], [0.6, 75]], dur: 0.7, vol: 0.5, vib: [28, 18], filter: ["lowpass", 600] }); noise(a, d, { dur: 0.7, vol: 0.2, filter: ["lowpass", 500], am: 25 }) },
  "🤯": (a, d) => { osc(a, d, { type: "sine", f: [[0, 400], [0.6, 1800]], dur: 0.6, vol: 0.3, vib: [9, 25] }); noise(a, d, { dur: 1.0, at: 0.6, vol: 0.55, filter: ["lowpass", 900], sweep: 80 }); osc(a, d, { type: "sine", f: [[0, 110], [0.6, 40]], dur: 0.7, at: 0.6, vol: 0.45 }) },
  "😎": (a, d) => [[147, 0], [175, 0.18], [196, 0.36], [262, 0.62]].forEach(([f, t], i) => osc(a, d, { type: "triangle", f: i === 3 ? [[0, f], [0.25, f * 1.06]] : f, dur: i === 3 ? 0.45 : 0.16, at: t, vol: 0.55, vib: i === 3 ? [5, 6] : null })),
  "🙏": (a, d) => [523, 659, 784, 1047, 1319].forEach((f, i) => osc(a, d, { type: "sine", f, dur: 0.6, at: i * 0.07, vol: 0.25, env: [0.005, 0.5] })),
  "💀": (a, d) => { osc(a, d, { type: "square", f: [[0, 220], [0.8, 55]], dur: 0.9, vol: 0.18, filter: ["lowpass", 700] }); [880, 740, 988, 659, 830].forEach((f, i) => osc(a, d, { type: "triangle", f, dur: 0.07, at: 0.95 + i * 0.07, vol: 0.4, env: [0.002, 0.06] })) },
  "🥳": (a, d) => { osc(a, d, { type: "sawtooth", f: [[0, 300], [0.12, 900], [0.6, 950]], dur: 0.65, vol: 0.28, vib: [32, 60], filter: ["bandpass", 1200, 1] }); noise(a, d, { dur: 0.6, vol: 0.15, filter: ["bandpass", 2500, 2] }) },
  "❤️": (a, d) => { [0, 0.22].forEach((t) => osc(a, d, { type: "sine", f: [[0, 90], [0.12, 50]], dur: 0.16, at: t, vol: 0.9 })); [1319, 1568, 2093].forEach((f, i) => osc(a, d, { type: "sine", f, dur: 0.4, at: 0.5 + i * 0.06, vol: 0.2, env: [0.005, 0.35] })) },
  // ---- the teasing ones ----
  "🤡": (a, d) => [0, 0.28].forEach((t) => { osc(a, d, { type: "sawtooth", f: [[0, 340], [0.2, 300]], dur: 0.22, at: t, vol: 1, filter: ["bandpass", 900, 1.6] }); osc(a, d, { type: "square", f: [[0, 345], [0.2, 305]], dur: 0.22, at: t, vol: 0.45, filter: ["bandpass", 1300, 2] }) }),
  "💩": (a, d) => {
    osc(a, d, { type: "sawtooth", f: [[0, 95], [0.25, 70], [0.55, 110], [0.75, 60]], dur: 0.8, vol: 0.6, vib: [38, 22], filter: ["lowpass", 380, 4] })
    noise(a, d, { dur: 0.8, vol: 0.35, filter: ["lowpass", 450, 3], am: 42 })
    osc(a, d, { type: "sawtooth", f: [[0, 140], [0.15, 90]], dur: 0.18, at: 0.9, vol: 0.45, vib: [50, 30], filter: ["lowpass", 500, 4] })
  },
  "😜": (a, d) => { noise(a, d, { dur: 0.75, vol: 0.55, filter: ["lowpass", 900, 2], am: 33 }); osc(a, d, { type: "sawtooth", f: [[0, 120], [0.7, 95]], dur: 0.75, vol: 0.3, vib: [33, 25], filter: ["lowpass", 700, 3] }) },
  "🐔": (a, d) => [[0, 0.09], [0.16, 0.09], [0.32, 0.09], [0.55, 0.32]].forEach(([t, dur], i) => osc(a, d, { type: "square", f: i === 3 ? [[0, 700], [0.08, 1100], [0.3, 650]] : [[0, 850], [dur, 620]], dur, at: t, vol: i === 3 ? 0.32 : 0.25, filter: ["bandpass", 1300, 1.5], vib: i === 3 ? [18, 40] : null })),
  "🐢": (a, d) => [[110, 0, 0.45], [98, 0.55, 0.45], [82, 1.1, 0.9]].forEach(([f, t, dur], i) => osc(a, d, { type: "sawtooth", f: i === 2 ? [[0, f], [dur, f * 0.85]] : f, dur, at: t, vol: 0.45, filter: ["lowpass", 450, 2], vib: i === 2 ? [5, 4] : null })),
  "😴": (a, d) => { noise(a, d, { dur: 0.9, vol: 0.4, filter: ["bandpass", 300, 1.5], sweep: 700, am: 45, env: [0.4, 0.2] }); osc(a, d, { type: "sine", f: [[0, 1100], [0.5, 650]], dur: 0.55, at: 1.0, vol: 0.25 }) },
  "🤪": (a, d) => { osc(a, d, { type: "sine", f: [[0, 160], [0.7, 260]], dur: 0.75, vol: 0.55, vib: [14, 90] }); osc(a, d, { type: "triangle", f: [[0, 80], [0.7, 130]], dur: 0.75, vol: 0.3, vib: [14, 45] }) },
  "🦗": (a, d) => { for (let k = 0; k < 3; k++) osc(a, d, { type: "sine", f: 4600, dur: 0.22, at: 0.15 + k * 0.55, vol: 0.18, env: [0.01, 0.05], vib: [0, 0] }); for (let k = 0; k < 3; k++) noise(a, d, { dur: 0.22, at: 0.15 + k * 0.55, vol: 0.12, filter: ["bandpass", 4600, 8], am: 38 }) },
}
export const SILLY = ["🤡", "💩", "😜", "🐔", "🐢", "😴", "🤪", "🦗"]

// A small guard so a flood of reactions doesn't turn into noise: at most 3 sounds at once, one per sender per 0.5 s.
let playing = 0
const lastBy = new Map()
export function playEmoji(e, from = "") {
  const fn = SOUNDS[e]
  const a = audio()
  if (!fn || !a) return false
  const now = performance.now()
  if (playing >= 3 || now - (lastBy.get(from) || 0) < 500) return false
  lastBy.set(from, now)
  playing++
  setTimeout(() => { playing-- }, 1400)
  try { fn(a, out(a, 0.9)) } catch (_) { /* a browser without some node type: stay quiet */ }
  return true
}
export const hasEmojiSound = (e) => !!SOUNDS[e]

// For automated checks: render one emoji sound offline → { peak, rms, seconds of sound }.
export async function renderEmoji(e) {
  const rate = 22050, off = new OfflineAudioContext(1, rate * 3, rate)
  const g = off.createGain(); g.gain.value = 0.9; g.connect(off.destination)
  SOUNDS[e](off, g)
  const buf = await off.startRendering()
  const d = buf.getChannelData(0)
  let peak = 0, sum = 0, last = 0
  for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); peak = Math.max(peak, v); sum += v * v; if (v > 0.01) last = i }
  return { peak: +peak.toFixed(3), rms: +Math.sqrt(sum / d.length).toFixed(4), seconds: +(last / rate).toFixed(2) }
}
