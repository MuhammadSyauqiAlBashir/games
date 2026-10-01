// Sound kit for the voice games: one shared AudioContext (unlocked by a tap), the microphone with pitch tracking
// and 16 kHz WAV recording, a little piano/chord synth, and helpers to play WAV clips at a shared moment.
import { el } from "../lib.js?v=__VERSION__"

let AC = null
export const audioCtx = () => (AC ||= new (window.AudioContext || window.webkitAudioContext)())
export const unlocked = () => !!AC && AC.state === "running"

// Must run inside a tap (iOS). Also asks for the microphone once, so later turns don't stop for a prompt.
export async function unlock({ mic = false } = {}) {
  const ac = audioCtx()
  if (ac.state !== "running") await ac.resume()
  const b = ac.createBuffer(1, 1, 22050), src = ac.createBufferSource()
  src.buffer = b
  src.connect(ac.destination)
  src.start()
  if (mic) {
    const m = new Mic()
    try { await m.start() } finally { m.stop() }
  }
}

// game clock (server seconds) → AudioContext time
export const acTime = (ctx, serverT) => audioCtx().currentTime + (serverT - ctx.now())

// A tap-to-enable banner (shown until sound is on).
export function soundGate(ctx, { mic = false, onReady } = {}) {
  const btn = el("button", { class: "btn primary big ak-gate", type: "button", text: mic ? ctx.L("🔊🎤 Nyalakan suara & mikrofon", "🔊🎤 Turn on sound & mic") : ctx.L("🔊 Nyalakan suara", "🔊 Turn on sound") })
  btn.onclick = async () => {
    try { await unlock({ mic }); btn.hidden = true; onReady && onReady() } catch (e) {
      ctx.toast(e.message || ctx.L("Mikrofon tidak bisa dipakai — cek izin di Pengaturan", "Microphone blocked — check Settings"), "bad")
      if (unlocked()) { btn.hidden = true; onReady && onReady() }
    }
  }
  if (unlocked() && !mic) btn.hidden = true
  return btn
}

// ---- microphone --------------------------------------------------------------------------------------------
const REC_RATE = 16000

export class Mic {
  async start() {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Browser ini tidak bisa memakai mikrofon.")
    const ac = audioCtx()
    if (ac.state !== "running") await ac.resume()
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 } })
    } catch (e) {
      throw new Error(e && e.name === "NotAllowedError" ? "Izin mikrofon ditolak — aktifkan di Pengaturan." : "Mikrofon tidak bisa dinyalakan.")
    }
    if (!Mic.loaded) { await ac.audioWorklet.addModule("/js/games/tap-worklet.js"); Mic.loaded = true }
    this.src = ac.createMediaStreamSource(this.stream)
    this.tap = new AudioWorkletNode(ac, "tap")
    this.mute = ac.createGain()
    this.mute.gain.value = 0
    this.src.connect(this.tap).connect(this.mute).connect(ac.destination)
    this.rate = ac.sampleRate
    this.win = new Float32Array(2048)   // the newest samples, for pitch
    this.level = 0
    this.rec = null
    this.tap.port.onmessage = (e) => this.push(e.data)
  }

  push(x) {
    const w = this.win
    w.copyWithin(0, x.length)
    w.set(x, w.length - x.length)
    let sum = 0
    for (let i = 0; i < x.length; i++) sum += x[i] * x[i]
    this.level = Math.sqrt(sum / x.length)
    if (this.rec) {  // box-filter down to 16 kHz
      const r = this.rec, ratio = this.rate / REC_RATE
      for (let i = 0; i < x.length; i++) {
        r.acc += x[i]; r.n++; r.phase += 1
        if (r.phase >= ratio) {
          r.phase -= ratio
          const v = Math.max(-1, Math.min(1, r.acc / r.n))
          if (r.len < r.pcm.length) r.pcm[r.len++] = v < 0 ? v * 0x8000 : v * 0x7fff
          r.acc = 0; r.n = 0
        }
      }
    }
  }

  // Pitch of the last ~40 ms as a MIDI number (60 = middle C), or null for silence/noise.
  pitch() { return detectPitch(this.win, this.rate) }

  startRec(maxSeconds) { this.rec = { pcm: new Int16Array(Math.ceil(maxSeconds * REC_RATE)), len: 0, acc: 0, n: 0, phase: 0 } }
  stopRec() { const r = this.rec; this.rec = null; return r ? wavBlob(r.pcm.subarray(0, r.len), REC_RATE) : null }

  stop() {
    try { this.src && this.src.disconnect(); this.tap && this.tap.disconnect() } catch { /* already gone */ }
    if (this.stream) for (const t of this.stream.getTracks()) t.stop()
    this.stream = null
  }
}

// YIN pitch detection (de Cheveigné & Kawahara), voice range ~70–1000 Hz.
export function detectPitch(buf, sr) {
  const W = 1024
  let rms = 0
  for (let i = buf.length - W; i < buf.length; i++) rms += buf[i] * buf[i]
  if (Math.sqrt(rms / W) < 0.012) return null
  const maxLag = Math.min(Math.floor(sr / 70), buf.length - W - 1), minLag = Math.floor(sr / 1000)
  const off = buf.length - W - maxLag
  const d = new Float32Array(maxLag + 1)
  for (let tau = 1; tau <= maxLag; tau++) {
    let s = 0
    for (let i = 0; i < W; i++) { const v = buf[off + i] - buf[off + i + tau]; s += v * v }
    d[tau] = s
  }
  let run = 0, tau = -1
  for (let t = 1; t <= maxLag; t++) {
    run += d[t]
    const c = run ? (d[t] * t) / run : 1
    d[t] = c
    if (t > minLag && tau < 0 && c < 0.13) tau = t
    if (tau > 0 && t > tau && d[t] > d[t - 1]) break
    if (tau > 0 && d[t] < d[tau]) tau = t
  }
  if (tau < 0) return null
  const a = d[tau - 1] ?? d[tau], b = d[tau], c = d[tau + 1] ?? d[tau]
  const shift = (a - c) / (2 * (a - 2 * b + c) || 1)
  const f = sr / (tau + (Math.abs(shift) < 1 ? shift : 0))
  return 69 + 12 * Math.log2(f / 440)
}

export function wavBlob(pcm, rate) {
  const buf = new ArrayBuffer(44 + pcm.length * 2)
  const v = new DataView(buf)
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
  str(0, "RIFF"); v.setUint32(4, 36 + pcm.length * 2, true); str(8, "WAVE")
  str(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true)
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true)
  str(36, "data"); v.setUint32(40, pcm.length * 2, true)
  new Int16Array(buf, 44).set(pcm)
  return new Blob([buf], { type: "audio/wav" })
}

// A slice of a decoded music file → 16 kHz mono WAV (done on the phone; the server never decodes formats).
export function sliceToWav(audioBuffer, start, seconds) {
  const sr = audioBuffer.sampleRate, n0 = Math.floor(start * sr), n1 = Math.min(audioBuffer.length, Math.floor((start + seconds) * sr))
  const chans = [...Array(audioBuffer.numberOfChannels).keys()].map((c) => audioBuffer.getChannelData(c))
  const ratio = sr / REC_RATE, out = new Int16Array(Math.floor((n1 - n0) / ratio))
  for (let k = 0; k < out.length; k++) {
    const a = n0 + Math.floor(k * ratio), b = Math.min(n1, n0 + Math.floor((k + 1) * ratio))
    let s = 0, n = 0
    for (let i = a; i < b; i++) { for (const ch of chans) s += ch[i]; n += chans.length }
    const v = Math.max(-1, Math.min(1, n ? s / n : 0))
    out[k] = v < 0 ? v * 0x8000 : v * 0x7fff
  }
  return wavBlob(out, REC_RATE)
}

// ---- playback -------------------------------------------------------------------------------------------------
const cache = new Map()
export async function loadClip(url) {
  if (cache.has(url)) return cache.get(url)
  const p = fetch(url, { credentials: "same-origin" }).then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer() })
    .then((b) => new Promise((res, rej) => audioCtx().decodeAudioData(b, res, rej)))
  cache.set(url, p)
  p.catch(() => cache.delete(url))
  return p
}

// Play a decoded clip at a server-clock moment (or right away if that moment passed, from the right offset).
export function playAt(ctx, buffer, serverT, { gain = 1 } = {}) {
  const ac = audioCtx()
  const src = ac.createBufferSource(), g = ac.createGain()
  src.buffer = buffer
  g.gain.value = gain
  src.connect(g).connect(ac.destination)
  const when = acTime(ctx, serverT)
  const late = ac.currentTime - when
  if (late > buffer.duration) return () => {}
  if (late > 0) src.start(ac.currentTime + 0.02, late); else src.start(when)
  return () => { try { src.stop() } catch { /* done */ } }
}

// ---- synth: piano-ish melody + soft chords + bass, scheduled on the server clock --------------------------------
const CHORDS = { C: [48, 52, 55], F: [53, 57, 60], G: [55, 59, 62], Am: [57, 60, 64], Dm: [50, 53, 57], Em: [52, 55, 59], G7: [55, 59, 65] }
const hz = (m) => 440 * 2 ** ((m - 69) / 12)

function voice(ac, out, midi, t, dur, { type = "triangle", vol = 0.22, decay = 0.9 } = {}) {
  const o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain()
  o.type = type; o.frequency.value = hz(midi)
  o2.type = "sine"; o2.frequency.value = hz(midi + 12)
  const g2 = ac.createGain(); g2.gain.value = 0.18
  o.connect(g); o2.connect(g2).connect(g); g.connect(out)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012)
  g.gain.exponentialRampToValueAtTime(vol * 0.45, t + Math.min(dur, 0.25))
  g.gain.exponentialRampToValueAtTime(vol * 0.3 * decay, t + dur * 0.92)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08)
  o.start(t); o2.start(t); o.stop(t + dur + 0.1); o2.stop(t + dur + 0.1)
}

export function playSong(ctx, song, serverT, { melody = true, chords = true, vol = 1 } = {}) {
  const ac = audioCtx()
  const out = ac.createGain()
  out.gain.value = vol
  out.connect(ac.destination)
  const beat = 60 / song.bpm
  const t0 = acTime(ctx, serverT)
  const now = ac.currentTime
  let t = 0
  if (melody) for (const [m, b] of song.notes) { const at = t0 + t * beat; if (at >= now - 0.02) voice(ac, out, m, Math.max(at, now), b * beat * 0.95); t += b }
  const total = t
  if (chords) {
    const cs = song.chords
    cs.forEach(([b, name], i) => {
      const end = i + 1 < cs.length ? cs[i + 1][0] : total
      for (let k = b; k < end; k += song.meter || 4) {
        const at = t0 + k * beat, len = Math.min(song.meter || 4, end - k) * beat
        if (at < now - 0.02) continue
        for (const m of CHORDS[name] || CHORDS.C) voice(ac, out, m, at, len * 0.95, { type: "sine", vol: 0.05 })
        voice(ac, out, (CHORDS[name] || CHORDS.C)[0] - 12, at, beat * 0.9, { type: "triangle", vol: 0.12 })
      }
    })
  }
  return () => { try { out.disconnect() } catch { /* gone */ } }
}

// Count-in clicks before singing/recording.
export function clicks(ctx, serverT, n = 3, gap = 1) {
  const ac = audioCtx()
  for (let i = 0; i < n; i++) {
    const at = acTime(ctx, serverT + i * gap)
    if (at < ac.currentTime) continue
    voice(ac, ac.destination, i === n - 1 ? 84 : 79, at, 0.07, { type: "square", vol: 0.08 })
  }
}
