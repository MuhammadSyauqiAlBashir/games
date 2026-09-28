// Little synthesized sound effects (Web Audio, no files). Players choose on/off + volume.
let ctx = null
let enabled = true
let volume = 0.7

export function configure({ sound = true, volume: v = 70 } = {}) {
  enabled = !!sound
  volume = Math.max(0, Math.min(1, v / 100))
}
export const isOn = () => enabled
export function toggle() { enabled = !enabled; return enabled }

function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext
    if (!C) return null
    ctx = new C()
  }
  if (ctx.state === "suspended") ctx.resume()
  return ctx
}
// iOS needs a first user gesture to unlock audio.
document.addEventListener("pointerdown", () => ac(), { once: true })

function tone(freq, dur, { type = "sine", vol = .3, slide = 0, delay = 0 } = {}) {
  const a = ac()
  if (!a || !enabled) return
  const t = a.currentTime + delay
  const o = a.createOscillator(), g = a.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol * volume, t + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(a.destination)
  o.start(t)
  o.stop(t + dur + 0.02)
}
function noise(dur, { vol = .2, delay = 0, hp = 800 } = {}) {
  const a = ac()
  if (!a || !enabled) return
  const t = a.currentTime + delay
  const buf = a.createBuffer(1, a.sampleRate * dur, a.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length)
  const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain()
  s.buffer = buf
  f.type = "highpass"
  f.frequency.value = hp
  g.gain.value = vol * volume
  s.connect(f).connect(g).connect(a.destination)
  s.start(t)
}

export const sfx = {
  click: () => tone(520, .06, { type: "triangle", vol: .15 }),
  pop: () => tone(660, .09, { type: "sine", vol: .25, slide: 300 }),
  place: () => { tone(320, .08, { type: "triangle", vol: .3 }); tone(480, .06, { type: "sine", vol: .15, delay: .04 }) },
  dice: () => { for (let i = 0; i < 6; i++) noise(.05, { vol: .25, delay: i * .07, hp: 1500 }) },
  card: () => noise(.12, { vol: .18, hp: 2500 }),
  coin: () => { tone(988, .08, { type: "square", vol: .08 }); tone(1319, .25, { type: "square", vol: .08, delay: .08 }) },
  right: () => { tone(660, .1, { vol: .25 }); tone(880, .18, { vol: .25, delay: .1 }) },
  wrong: () => tone(180, .25, { type: "sawtooth", vol: .12, slide: -60 }),
  tick: () => tone(1200, .03, { type: "square", vol: .06 }),
  turn: () => { tone(523, .1, { vol: .2 }); tone(784, .15, { vol: .2, delay: .1 }) },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, .25, { type: "triangle", vol: .25, delay: i * .12 })),
  lose: () => [392, 370, 349, 311].forEach((f, i) => tone(f, i === 3 ? .7 : .28, { type: "sawtooth", vol: .1, delay: i * .3, slide: i === 3 ? -40 : 0 })),
  goal: () => { noise(.8, { vol: .25, hp: 500 }); tone(784, .3, { vol: .2, delay: .1 }) },
  whoosh: () => noise(.25, { vol: .15, hp: 300 }),
  blip: () => tone(880, .05, { vol: .1 }),
  boop: () => tone(300, .12, { vol: .2, slide: 200 }),
  capture: () => { tone(200, .15, { type: "square", vol: .12, slide: -80 }); noise(.1, { vol: .15, delay: .05 }) },
  ladder: () => [523, 587, 659, 698, 784].forEach((f, i) => tone(f, .08, { vol: .15, delay: i * .05 })),
  snake: () => tone(700, .5, { type: "sawtooth", vol: .08, slide: -550 }),
  mpStart: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i === 4 ? .35 : .1, { type: "square", vol: .09, delay: i * .07 })),
  mpFinish: () => { tone(1568, .12, { type: "square", vol: .1 }); tone(1175, .12, { type: "square", vol: .1, delay: .13 }); tone(1568, .4, { type: "square", vol: .1, delay: .26 }); noise(.5, { vol: .08, hp: 3000, delay: .1 }) },
  ding: () => { tone(1319, .08, { type: "square", vol: .08 }); tone(1976, .25, { type: "square", vol: .08, delay: .08 }) },
  buzz: () => tone(140, .35, { type: "sawtooth", vol: .14 }),
  boom: () => { noise(.9, { vol: .45, hp: 60 }); tone(90, .6, { type: "sine", vol: .4, slide: -50 }) },
  splash: () => { noise(.6, { vol: .25, hp: 900 }); noise(.3, { vol: .15, hp: 3000, delay: .08 }) },
  knock: () => { tone(220, .06, { type: "triangle", vol: .35 }); tone(200, .06, { type: "triangle", vol: .3, delay: .14 }) },
  drum: () => { for (let i = 0; i < 16; i++) noise(.05, { vol: .12 + i * .01, hp: 200, delay: i * .06 }) },
  fanfare: () => [392, 523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, i === 6 ? .5 : .12, { type: "square", vol: .09, delay: i * .11 })),
  thud: () => { tone(70, .25, { type: "sine", vol: .5, slide: -30 }); noise(.15, { vol: .2, hp: 150 }) },
  swoosh: () => noise(.18, { vol: .12, hp: 1500 }),
  reel: () => { for (let i = 0; i < 8; i++) tone(900 + i * 40, .03, { type: "square", vol: .05, delay: i * .035 }) },
  plop: () => tone(500, .12, { type: "sine", vol: .25, slide: -300 }),
  whistle: () => { tone(2300, .12, { vol: .12 }); tone(2250, .28, { vol: .12, delay: .15, slide: -80 }) },
  kick: () => { tone(140, .12, { type: "sine", vol: .45, slide: -70 }); noise(.05, { vol: .2, hp: 1200 }) },
  net: () => { noise(.45, { vol: .22, hp: 2500 }); noise(.3, { vol: .12, hp: 600, delay: .05 }) },
  glove: () => { tone(110, .1, { type: "triangle", vol: .4, slide: -30 }); noise(.08, { vol: .25, hp: 900 }) },
  cheer: () => { for (let i = 0; i < 4; i++) noise(.9, { vol: .1, hp: 400 + i * 350, delay: i * .15 }) },
  groan: () => { tone(220, .6, { type: "sawtooth", vol: .05, slide: -90 }); noise(.7, { vol: .06, hp: 300 }) },
  seed: (i = 0) => tone(1500 + (i % 5) * 90, .05, { type: "triangle", vol: .16, slide: -500 }),
  scoop: () => { noise(.12, { vol: .12, hp: 1800 }); tone(420, .09, { type: "triangle", vol: .12, slide: 200 }) },
  cash: () => { tone(1568, .06, { type: "square", vol: .06 }); tone(2093, .2, { type: "square", vol: .06, delay: .07 }) },
}
