// Wok & Roll world: the night street (or the tent) behind the customers, the counter with every piece on it, lights, weather.
import * as T from "./three.js?v=__VERSION__"
import { Particles, canvasTex, noiseFill } from "./gfx.js?v=__VERSION__"
import { box, catModel, checkerTex, cyl, dishModel, mat, mesh, prop, sph, stationModel } from "./models.js?v=__VERSION__"

export const CART_COLORS = { hijau: "#2f8f5b", biru: "#2b62c9", merah: "#c8382f", kuning: "#e3a51f", ungu: "#7b4fb3" }

// ---- textures ------------------------------------------------------------------------------------------------
function asphaltTex() {
  return canvasTex(512, 512, (g, w, h) => {
    noiseFill(g, w, h, "#2b2c30", 0.22, 26000, 2)
    g.strokeStyle = "rgba(0,0,0,.35)"; g.lineWidth = 1.5
    for (let i = 0; i < 9; i++) { g.beginPath(); let x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (Math.random() - 0.5) * 60; y += Math.random() * 40; g.lineTo(x, y) } g.stroke() }
  }, { repeat: [6, 6] })
}
function tileTex() {
  return canvasTex(256, 256, (g, w, h) => {
    noiseFill(g, w, h, "#8d877c", 0.12, 5000, 2)
    g.strokeStyle = "rgba(40,30,20,.45)"; g.lineWidth = 3
    for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, h); g.stroke(); g.beginPath(); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke() }
  }, { repeat: [16, 1] })
}
function shutterTex() {
  return canvasTex(128, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, 8)
    for (let y = 0; y < h; y += 8) { g.fillStyle = y % 16 ? "#9aa0a6" : "#7e848a"; g.fillRect(0, y, w, 8) }
    void gr
    g.fillStyle = "rgba(0,0,0,.15)"; for (let i = 0; i < 40; i++) g.fillRect(Math.random() * w, Math.random() * h, 2, 10 + Math.random() * 30)
  })
}
function signTex(text, sub, bg, fg) {
  return canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h)
    g.fillStyle = fg; g.textAlign = "center"; g.textBaseline = "middle"
    g.font = "900 54px Nunito, system-ui, sans-serif"; g.fillText(text, w / 2, sub ? h * 0.4 : h / 2)
    if (sub) { g.font = "700 26px Nunito, system-ui, sans-serif"; g.fillText(sub, w / 2, h * 0.8) }
  })
}
function neonTex(lines) {
  return canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = "#000"; g.fillRect(0, 0, w, h)
    g.textAlign = "center"; g.textBaseline = "middle"
    lines.forEach(([t, c, size, y]) => {
      g.font = `900 ${size}px Nunito, system-ui, sans-serif`
      g.shadowColor = c; g.shadowBlur = 18; g.fillStyle = c
      g.fillText(t, w / 2, y * h)
      g.shadowBlur = 0; g.fillStyle = "#fff"; g.globalAlpha = 0.55; g.fillText(t, w / 2, y * h); g.globalAlpha = 1
    })
  })
}
function cartPanelTex(color) {
  return canvasTex(1024, 256, (g, w, h) => {
    g.fillStyle = color; g.fillRect(0, 0, w, h)
    g.globalAlpha = 0.12; noiseFill(g, w, h, "rgba(0,0,0,0)", 0.6, 6000, 2); g.globalAlpha = 1
    g.strokeStyle = "#fff7e0"; g.lineWidth = 10; g.strokeRect(14, 14, w - 28, h - 28)
    g.fillStyle = "#fff7e0"; g.textAlign = "center"; g.textBaseline = "middle"
    g.font = "900 96px Nunito, system-ui, sans-serif"; g.fillText("NASI GORENG", w / 2, h * 0.42)
    g.font = "800 40px Nunito, system-ui, sans-serif"; g.fillStyle = "#ffd36b"; g.fillText("★ NENEK IJAH ★  sejak 1985", w / 2, h * 0.78)
  })
}
function bannerTex() {
  return canvasTex(1024, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#fff8e8"); gr.addColorStop(1, "#ffe9c2")
    g.fillStyle = gr; g.fillRect(0, 0, w, h)
    g.fillStyle = "#c8382f"; g.fillRect(0, 0, w, 26); g.fillRect(0, h - 26, w, 26)
    g.textAlign = "center"; g.textBaseline = "middle"
    g.fillStyle = "#1f5aa6"; g.font = "900 84px Nunito, system-ui, sans-serif"; g.fillText("WARUNG NENEK IJAH", w / 2, h * 0.43)
    g.fillStyle = "#c8382f"; g.font = "800 38px Nunito, system-ui, sans-serif"; g.fillText("SATE • BAKSO • NASI GORENG • ES JERUK", w / 2, h * 0.76)
  })
}

// ---- sky -----------------------------------------------------------------------------------------------------
function sky() {
  const geo = new T.SphereGeometry(80, 32, 16)
  const m = new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false, fog: false,
    uniforms: { dark: { value: 0 } },
    vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: `varying vec3 vP; uniform float dark;
      void main(){ float y = vP.y;
        vec3 top = vec3(0.24,0.36,0.66), mid = vec3(0.93,0.55,0.45), low = vec3(1.0,0.80,0.55);
        vec3 c = mix(low, mid, smoothstep(-0.02, 0.18, y)); c = mix(c, top, smoothstep(0.15, 0.6, y));
        c *= 1.0 - dark * 0.55; gl_FragColor = vec4(c, 1.0); }`,
  })
  const s = new T.Mesh(geo, m)
  const n = 260, pos = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, y = 0.25 + Math.random() * 0.75, r = Math.sqrt(1 - y * y); pos.set([Math.cos(a) * r * 75, y * 75, Math.sin(a) * r * 75], i * 3) }
  const sg = new T.BufferGeometry(); sg.setAttribute("position", new T.BufferAttribute(pos, 3))
  const stars = new T.Points(sg, new T.PointsMaterial({ color: 0xfff6e0, size: 0.35, sizeAttenuation: true, transparent: true, opacity: 0.8, depthWrite: false }))
  const g = new T.Group(); g.add(s, stars)
  return { group: g, mat: m }
}

// ---- lights that switch off in a power cut ----------------------------------------------------------------
class Switchable {
  constructor() { this.items = []; this.level = 1; this.target = 1 }
  add(obj, base, kind = "light") { this.items.push({ obj, base, kind }); return obj }
  set(on) { this.target = on ? 1 : 0 }
  update(dt, t) {
    if (this.level !== this.target) {
      const d = this.target - this.level
      this.level += Math.sign(d) * Math.min(Math.abs(d), dt * (this.target ? 2.5 : 6))
      // flicker while switching back on
      const k = this.target && this.level < 1 ? (Math.sin(t * 60) > 0.2 ? this.level : this.level * 0.2) : this.level
      for (const it of this.items) {
        if (it.kind === "light") it.obj.intensity = it.base * k
        else it.obj.emissiveIntensity = it.base * k
      }
    }
  }
}

// ---- building blocks ------------------------------------------------------------------------------------------
function shophouses(lights) {
  const g = new T.Group()
  const shops = [
    ["TOKO KELONTONG", "Sedia pulsa & gas", "#e9d9a8", "#2e5e3e", "#e0a35b"],
    ["FOTOKOPI 24 JAM", "Jilid • Laminating", "#cfe3e8", "#174c7a", "#a7c7d9"],
    ["APOTEK SEHAT", "Buka sampai malam", "#f2c6c0", "#a02c2c", "#f1e2c9"],
    ["BENGKEL MOTOR", "Tambal ban", "#d9d2c3", "#3d3d3d", "#c9b18a"],
    ["LAUNDRY KILOAN", "1 hari jadi", "#d5cbe8", "#5a3d8a", "#bfb3db"],
  ]
  const w = 3.1
  shops.forEach(([name, sub, wall, signBg, wall2], i) => {
    const x = (i - 2) * w
    const u = new T.Group(); u.position.set(x, 0, -6.2)
    const body = box(w - 0.08, 5.4, 1.4, mat(wall, { rough: 0.9 }), 0.04); body.position.y = 2.7
    const top = box(w + 0.05, 0.25, 1.6, mat(wall2, { rough: 0.8 })); top.position.y = 5.5
    const shutterOpen = i === 0
    const shutter = mesh(new T.PlaneGeometry(w - 0.6, 2.3), shutterOpen ? mat(0xffe3a8, { emissive: 0xffb860, ei: 0.35, rough: 0.9 }) : mat(0xffffff, { map: shutterTex(), rough: 0.55, metal: 0.4 }))
    shutter.position.set(0, 1.2, 0.71)
    if (shutterOpen) {
      lights.add(shutter.material, 0.35, "emissive")
      for (let k = 0; k < 4; k++) { const sh = box(0.5, 0.9 + Math.random() * 0.6, 0.3, mat(["#d8433b", "#2c6fc4", "#e3a51f", "#3b8c5a"][k], { rough: 0.7 })); sh.position.set(-0.9 + k * 0.6, 0.5, 0.5); u.add(sh) }
    }
    const sign = mesh(new T.PlaneGeometry(w - 0.4, 0.62), mat(0xffffff, { map: signTex(name, sub, signBg, "#fff"), rough: 0.6, emissive: 0xffffff, ei: 0.15 }))
    sign.material.emissiveMap = sign.material.map
    lights.add(sign.material, 0.15, "emissive")
    sign.position.set(0, 2.75, 0.73)
    const awning = box(w - 0.1, 0.06, 0.7, mat(signBg, { rough: 0.7 })); awning.position.set(0, 2.38, 1.05); awning.rotation.x = 0.18
    u.add(body, top, shutter, sign, awning)
    for (let k = 0; k < 2; k++) {
      const lit = Math.random() < 0.6
      const win = mesh(new T.PlaneGeometry(0.85, 1.0), lit ? mat(k ? 0xffd8a0 : 0xbfe0ff, { emissive: k ? 0xffb860 : 0x9cc8ff, ei: 0.45, rough: 0.4 }) : mat(0x1d2233, { rough: 0.15, metal: 0.4 }))
      if (lit) lights.add(win.material, 0.45, "emissive")
      win.position.set(-0.7 + k * 1.4, 4.0, 0.71)
      const frame = box(1.0, 1.15, 0.06, mat(0xf1ece2, { rough: 0.8 })); frame.position.set(win.position.x, 4.0, 0.69)
      u.add(frame, win)
    }
    if (i % 2) { const ac = box(0.7, 0.45, 0.3, mat(0xeeeeea, { rough: 0.5 }), 0.03); ac.position.set(0.9, 3.25, 0.85); u.add(ac) }
    g.add(u)
  })
  return g
}

function curve(a, b, sag) {
  const pts = []
  for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push(new T.Vector3().lerpVectors(a, b, t).add(new T.Vector3(0, -Math.sin(t * Math.PI) * sag, 0))) }
  return new T.CatmullRomCurve3(pts)
}

function stringLights(a, b, sag, n, lights, colors = [0xffd27a, 0xff9a5a, 0xfff1c0, 0x9be7ff, 0xff7aa8]) {
  const g = new T.Group()
  const c = curve(a, b, sag)
  g.add(mesh(new T.TubeGeometry(c, 40, 0.008, 4), mat(0x111111, { rough: 0.8 }), { shadow: false }))
  for (let i = 1; i < n; i++) {
    const p = c.getPoint(i / n)
    const col = colors[i % colors.length]
    const m = new T.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 2.2, roughness: 0.3 })
    lights.add(m, 2.2, "emissive")
    const b = new T.Mesh(new T.SphereGeometry(0.045, 10, 8), m); b.position.copy(p).add(new T.Vector3(0, -0.06, 0))
    g.add(b)
  }
  return g
}

function scooter() {
  const g = new T.Group()
  const body = mat(0x18a957, { rough: 0.35, metal: 0.2 }), dark = mat(0x1b1c20, { rough: 0.6 })
  for (const z of [-0.45, 0.45]) { const w = mesh(new T.TorusGeometry(0.17, 0.06, 10, 22), dark); w.position.set(0, 0.2, z); w.rotation.y = Math.PI / 2; g.add(w) }
  const deck = box(0.28, 0.12, 0.7, body, 0.05); deck.position.y = 0.3
  const rear = box(0.32, 0.32, 0.5, body, 0.1); rear.position.set(0, 0.48, -0.2)
  const seat = box(0.26, 0.08, 0.45, dark, 0.04); seat.position.set(0, 0.68, -0.18)
  const front = box(0.26, 0.55, 0.12, body, 0.05); front.position.set(0, 0.55, 0.38); front.rotation.x = -0.25
  const bar = cyl(0.02, 0.02, 0.55, dark, 6); bar.rotation.z = Math.PI / 2; bar.position.set(0, 0.88, 0.42)
  const lamp = sph(0.06, mat(0xffffff, { emissive: 0xfff2c0, ei: 1.5 })); lamp.position.set(0, 0.78, 0.47)
  const helmet = sph(0.16, body, 16, 12); helmet.scale.y = 0.85; helmet.position.set(0, 0.8, -0.2)
  g.add(deck, rear, seat, front, bar, lamp, helmet)
  return g
}

function lpg() {
  const g = new T.Group()
  const green = mat(0x58b947, { rough: 0.35, metal: 0.3 })
  const b = cyl(0.13, 0.13, 0.26, green, 20); b.position.y = 0.17
  const top = sph(0.13, green, 20, 10); top.scale.y = 0.6; top.position.y = 0.3
  const bot = sph(0.13, green, 20, 10); bot.scale.y = 0.4; bot.position.y = 0.04
  const valve = cyl(0.03, 0.04, 0.07, mat(0x9aa0a6, { metal: 0.9, rough: 0.3 }), 10); valve.position.y = 0.4
  const hose = mesh(new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(0, 0.42, 0), new T.Vector3(0.15, 0.55, 0.05), new T.Vector3(0.3, 0.7, 0)]), 12, 0.012, 5), mat(0x222222))
  g.add(b, top, bot, valve, hose)
  return g
}

function lantern() {
  const g = new T.Group()
  const brass = mat(0xc9a14a, { rough: 0.3, metal: 0.9 })
  const base = cyl(0.08, 0.1, 0.1, brass, 14); base.position.y = -0.18
  const glass = cyl(0.07, 0.07, 0.16, mat(0xfff3d0, { emissive: 0xffc46b, ei: 2.5, rough: 0.2 }), 14); glass.position.y = -0.06
  const cap = mesh(new T.ConeGeometry(0.1, 0.1, 14), brass); cap.position.y = 0.06
  const hook = mesh(new T.TorusGeometry(0.03, 0.006, 6, 12), brass); hook.position.y = 0.14
  g.add(base, glass, cap, hook)
  return { group: g, glass: glass.material }
}

function tent(L, lights) {
  const g = new T.Group()
  const blue = mat(0x2a68c9, { rough: 0.7, side: T.DoubleSide })
  const poleM = mat(0xb9bec4, { rough: 0.3, metal: 0.85 })
  const x0 = -3.2, x1 = 3.2, zb = -3.0, zf = 1.4
  for (const x of [x0, x1]) { const p = cyl(0.035, 0.035, 2.6, poleM, 10); p.position.set(x, 1.3, zb); g.add(p) }
  // back wall with the printed banner; roof only over the back so the camera sees in
  const back = mesh(new T.PlaneGeometry(x1 - x0, 1.6), blue); back.position.set(0, 1.85, zb - 0.02); g.add(back)
  const banner = mesh(new T.PlaneGeometry(4.6, 1.15), mat(0xffffff, { map: bannerTex(), rough: 0.7, emissive: 0xffffff, ei: 0.18 }))
  banner.material.emissiveMap = banner.material.map
  lights.add(banner.material, 0.18, "emissive")
  banner.position.set(0, 1.9, zb + 0.01); g.add(banner)
  const roof = mesh(new T.PlaneGeometry(x1 - x0 + 0.3, 1.5), blue); roof.position.set(0, 2.7, zb + 0.6); roof.rotation.x = -Math.PI / 2 + 0.35; g.add(roof)
  const valance = mesh(new T.PlaneGeometry(x1 - x0 + 0.3, 0.3), mat(0xffffff, { map: checkerTex("#2b62c9", "#ffffff"), rough: 0.7, side: T.DoubleSide }))
  valance.material.map.repeat.set(16, 1)
  valance.position.set(0, 2.45, zb + 1.3); g.add(valance)
  void zf
  return g
}

function counterFrontTex(color, tent) {
  return canvasTex(1024, 160, (g, w, h) => {
    g.fillStyle = color; g.fillRect(0, 0, w, h)
    g.globalAlpha = 0.1; noiseFill(g, w, h, "rgba(0,0,0,0)", 0.6, 5000, 2); g.globalAlpha = 1
    g.fillStyle = "rgba(255,255,255,.18)"; g.fillRect(0, 0, w, 10)
    g.fillStyle = "#fff7e0"; g.textAlign = "center"; g.textBaseline = "middle"
    g.font = "900 70px Nunito, system-ui, sans-serif"
    g.fillText(tent ? "WARUNG NENEK IJAH" : "NASI GORENG NENEK IJAH", w / 2, h * 0.52)
    g.font = "900 46px Nunito, system-ui, sans-serif"; g.fillStyle = "#ffd36b"
    g.fillText("★", w * 0.06, h * 0.52); g.fillText("★", w * 0.94, h * 0.52)
  })
}

function steelTex() {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = "#b4bbc3"; g.fillRect(0, 0, w, h)
    for (let y = 0; y < h; y++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? "255,255,255" : "0,0,0"},${Math.random() * 0.06})`; g.fillRect(0, y, w, 1) }
    g.strokeStyle = "rgba(60,64,70,.35)"; g.lineWidth = 3
    for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(i * w / 4, 0); g.lineTo(i * w / 4, h); g.stroke() }
  }, { repeat: [2, 1] })
}

function hangingLamp(lights) {
  const g = new T.Group()
  const cord = cyl(0.008, 0.008, 1.0, mat(0x111111), 4); cord.position.y = 0.5
  const shadeM = mat(0x2d6b4f, { rough: 0.45, metal: 0.3, side: T.DoubleSide })
  const shade = mesh(new T.ConeGeometry(0.26, 0.2, 24, 1, true), shadeM); shade.position.y = -0.02
  const bulbM = new T.MeshStandardMaterial({ color: 0xfff1cc, emissive: 0xffd08a, emissiveIntensity: 2.2 })
  lights.add(bulbM, 2.2, "emissive")
  const bulb = new T.Mesh(new T.SphereGeometry(0.07, 14, 10), bulbM); bulb.position.y = -0.1
  g.add(cord, shade, bulb)
  return g
}

// ---- the bistro (chapter 1): a bright restaurant like the owner's reference picture -----------------------------
function woodFloorTex() {
  return canvasTex(512, 512, (g, w, h) => {
    const cols = ["#b97a4a", "#c4885a", "#a96c3e", "#bd8152"]
    for (let y = 0; y < 8; y++) for (let x = 0; x < 3; x++) {
      const off = (y % 2) * 85
      g.fillStyle = cols[(x + y * 3) % cols.length]; g.fillRect(x * 171 + off - 171, y * 64, 171, 64); g.fillRect(x * 171 + off, y * 64, 171, 64)
      g.strokeStyle = "rgba(60,30,10,.35)"; g.lineWidth = 2; g.strokeRect(x * 171 + off, y * 64, 171, 64)
    }
    g.globalAlpha = 0.18; noiseFill(g, w, h, "rgba(0,0,0,0)", 0.5, 6000, 2)
  }, { repeat: [5, 5] })
}
function wallTex() {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = "#f6c9b4"; g.fillRect(0, 0, w, h)
    g.fillStyle = "#fbf3e8"; g.fillRect(0, h * 0.7, w, h * 0.3)
    g.strokeStyle = "#e9dccb"; g.lineWidth = 6
    for (let x = 16; x < w; x += 96) g.strokeRect(x, h * 0.74, 80, h * 0.22)
    g.fillStyle = "#e8a98f"; g.fillRect(0, h * 0.69, w, 8)
    g.globalAlpha = 0.07; noiseFill(g, w, h * 0.69, "rgba(0,0,0,0)", 0.6, 3000, 3)
  }, { repeat: [4, 1] })
}
function marbleTex() {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = "#a99c8e"; g.fillRect(0, 0, w, h)
    g.strokeStyle = "rgba(235,225,210,.35)"
    for (let i = 0; i < 18; i++) { g.lineWidth = 0.6 + Math.random() * 2; g.beginPath(); let x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); for (let k = 0; k < 7; k++) { x += (Math.random() - 0.3) * 70; y += (Math.random() - 0.5) * 40; g.lineTo(x, y) } g.stroke() }
  }, { repeat: [2, 1] })
}
function panelTex(color) {
  return canvasTex(1024, 256, (g, w, h) => {
    g.fillStyle = "#8a5634"; g.fillRect(0, 0, w, h)
    for (let x = 0; x < w; x += 128) { g.fillStyle = x % 256 ? "#94603c" : "#865230"; g.fillRect(x + 6, 14, 116, h - 28); g.strokeStyle = "rgba(40,20,8,.4)"; g.lineWidth = 3; g.strokeRect(x + 6, 14, 116, h - 28) }
    g.fillStyle = color; g.fillRect(0, 0, w, 10); g.fillRect(0, h - 10, w, 10)
  })
}
function paintingTex(seed) {
  return canvasTex(256, 192, (g, w, h) => {
    const pal = [["#ffd6a5", "#ff8c69", "#6bbf9f"], ["#c8e7ff", "#ffb3c6", "#ffd166"], ["#e9f5db", "#f4a261", "#2a9d8f"]][seed % 3]
    g.fillStyle = pal[0]; g.fillRect(0, 0, w, h)
    g.fillStyle = pal[1]; g.beginPath(); g.arc(w * 0.35, h * 0.45, 46, 0, 7); g.fill()
    g.fillStyle = pal[2]; g.fillRect(w * 0.5, h * 0.4, 90, 70)
  })
}
function chalkTex() {
  return canvasTex(512, 384, (g, w, h) => {
    g.fillStyle = "#2b3a33"; g.fillRect(0, 0, w, h)
    g.fillStyle = "#f6f0e2"; g.textAlign = "center"
    g.font = "900 64px Nunito, system-ui, sans-serif"; g.fillText("MENU", w / 2, 78)
    g.font = "700 34px Nunito, system-ui, sans-serif"
    ;["Steak Sapi ....... 30", "+ Saus Lada Hitam", "Jus Jeruk ........ 10", "Jus Anggur ....... 12"].forEach((t, i) => g.fillText(t, w / 2, 150 + i * 52))
  })
}

function bistroBackdrop(root, lights) {
  const floor = mesh(new T.PlaneGeometry(30, 30), mat(0xffffff, { map: woodFloorTex(), rough: 0.55 }))
  floor.rotation.x = -Math.PI / 2; root.add(floor)
  const wall = mesh(new T.PlaneGeometry(20, 5.2), mat(0xffffff, { map: wallTex(), rough: 0.9 }))
  wall.position.set(0, 2.6, -4.4); root.add(wall)
  for (const x of [-10, 10]) { const sw = mesh(new T.PlaneGeometry(10, 5.2), mat(0xf3c3ae, { rough: 0.9 })); sw.position.set(x, 2.6, 0.6); sw.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2; root.add(sw) }
  // arched windows with a warm evening glow
  for (const x of [-4.6, 0, 4.6]) {
    const sh = new T.Shape(); sh.moveTo(-0.85, 0); sh.lineTo(0.85, 0); sh.lineTo(0.85, 1.6); sh.absarc(0, 1.6, 0.85, 0, Math.PI, false); sh.lineTo(-0.85, 0)
    const glass = mesh(new T.ShapeGeometry(sh, 24), new T.MeshStandardMaterial({ color: 0xffe2b8, emissive: 0xffc58a, emissiveIntensity: 0.9, roughness: 0.3 }))
    lights.add(glass.material, 0.9, "emissive")
    glass.position.set(x, 1.15, -4.38)
    const frameS = new T.Shape(); frameS.moveTo(-0.97, -0.05); frameS.lineTo(0.97, -0.05); frameS.lineTo(0.97, 1.6); frameS.absarc(0, 1.6, 0.97, 0, Math.PI, false); frameS.lineTo(-0.97, -0.05)
    frameS.holes.push(sh)
    const frame = mesh(new T.ExtrudeGeometry(frameS, { depth: 0.08, bevelEnabled: false, curveSegments: 24 }), mat(0xffffff, { rough: 0.5 }))
    frame.position.set(x, 1.15, -4.42)
    const mull = box(0.05, 2.4, 0.04, mat(0xffffff, { rough: 0.5 })); mull.position.set(x, 2.3, -4.34)
    const mull2 = box(1.7, 0.05, 0.04, mat(0xffffff, { rough: 0.5 })); mull2.position.set(x, 2.1, -4.34)
    root.add(glass, frame, mull, mull2)
  }
  for (const [x, i] of [[-2.3, 0], [2.3, 1]]) {
    const pic = mesh(new T.PlaneGeometry(0.9, 0.68), mat(0xffffff, { map: paintingTex(i), rough: 0.6 })); pic.position.set(x, 2.9, -4.36)
    const fr = box(1.02, 0.8, 0.05, mat(0xd8a24a, { rough: 0.35, metal: 0.6 })); fr.position.set(x, 2.9, -4.4)
    root.add(fr, pic)
  }
  const chalk = mesh(new T.PlaneGeometry(1.4, 1.05), mat(0xffffff, { map: chalkTex(), rough: 0.9 })); chalk.position.set(6.9, 2.4, -4.35)
  const chalkF = box(1.52, 1.17, 0.06, mat(0x8a5634, { rough: 0.7 })); chalkF.position.set(6.9, 2.4, -4.4)
  root.add(chalkF, chalk)
  // cafe tables with mint chairs, plants, a bar shelf with bottles
  const mint = new T.MeshStandardMaterial({ color: 0x86d3c4, roughness: 0.5 })
  for (const [x, z] of [[-4.4, -3.0], [3.9, -3.1], [-6.6, -2.2]]) {
    const t = prop("tableRound", 2.2); t.position.set(x, 0, z); root.add(t)
    for (const dx of [-0.95, 0.95]) { const c = prop("chair", 2.3); c.traverse((o) => { if (o.isMesh) o.material = mint }); c.position.set(x + dx, 0, z - 0.6); c.rotation.y = dx < 0 ? Math.PI / 2 : -Math.PI / 2; root.add(c) }
    const vase = prop("glass", 0.6); vase.position.set(x + 0.7, 0.82, z - 0.4); root.add(vase)
  }
  for (const [x, s] of [[-7.6, 3], [7.4, 3.2], [-1.2, 2.6]]) { const pl = prop("pottedPlant", s); pl.position.set(x, 0, -4.0); root.add(pl) }
  const shelf = new T.Group(); shelf.position.set(5.9, 0, -4.05)
  for (let k = 0; k < 3; k++) {
    const b = box(2.2, 0.06, 0.4, mat(0x8a5634, { rough: 0.7 })); b.position.y = 1.5 + k * 0.55; shelf.add(b)
    for (let i = 0; i < 6; i++) { const bt = prop(i % 2 ? "soda-bottle" : "bottle-oil", 0.9); bt.position.set(-0.9 + i * 0.36, 1.53 + k * 0.55, 0); shelf.add(bt) }
  }
  root.add(shelf)
  // wall sconces
  for (const x of [-6.9, -2.3, 2.3, 6.9]) {
    const m = new T.MeshStandardMaterial({ color: 0xfff1d6, emissive: 0xffd08a, emissiveIntensity: 1.4 })
    lights.add(m, 1.4, "emissive")
    const sc = mesh(new T.SphereGeometry(0.13, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), m); sc.rotation.x = Math.PI; sc.position.set(x, 3.75, -4.3)
    root.add(sc)
  }
}

// ---- the world: background + the counter ------------------------------------------------------------------------
export class World {
  constructor(gfx, L, { cart = "hijau" } = {}) {
    this.gfx = gfx
    this.L = L
    const sc = gfx.scene
    this.lights = new Switchable()
    this.root = new T.Group(); sc.add(this.root)
    this.isTent = L.scene === "tent"
    this.isBistro = L.scene === "bistro"
    this.sky = sky(); sc.add(this.sky.group)
    if (this.isBistro) {
      sc.fog = new T.Fog(0xf3d2bd, 22, 50)
      bistroBackdrop(this.root, this.lights)
      this.ground = null
      this.hemi = new T.HemisphereLight(0xfff0e0, 0x7a5236, 0.85); this.root.add(this.hemi)
      const win = new T.DirectionalLight(0xffd8b0, 0.7); win.position.set(1, 4, -6); this.root.add(win)
      const front = new T.DirectionalLight(0xfff4e6, 0.75); front.position.set(-2, 4, 7); this.root.add(front)
      for (const x of [-3, 0, 3]) { const pl = new T.PointLight(0xffd6a0, 5, 7, 1.6); pl.position.set(x, 3.2, -2.2); this.root.add(pl); this.lights.add(pl, 5) }
    } else {
      sc.fog = new T.Fog(0xe9a37a, 18, 45)
      const ground = mesh(new T.PlaneGeometry(40, 40), mat(0xffffff, { map: asphaltTex(), rough: 0.62, metal: 0.05 }))
      ground.rotation.x = -Math.PI / 2; this.ground = ground; this.root.add(ground)
      const curb = box(40, 0.14, 1.9, mat(0xffffff, { map: tileTex(), rough: 0.85 })); curb.position.set(0, 0.07, -4.8); this.root.add(curb)
      this.root.add(shophouses(this.lights))
      const poleM = mat(0x6d6f73, { rough: 0.6, metal: 0.4 })
      for (const x of [-4.8, 4.8]) { const p = cyl(0.07, 0.09, 6.5, poleM, 10); p.position.set(x, 3.25, -4.2); this.root.add(p) }
      const bike = scooter(); bike.position.set(-3.4, 0.14, -4.6); bike.rotation.y = 0.9; this.root.add(bike)
      this.root.add(tent(L, this.lights))
      this.root.add(stringLights(new T.Vector3(-3.6, 2.9, -2.0), new T.Vector3(3.6, 2.9, -2.0), 0.4, 18, this.lights))
      const neon = mesh(new T.PlaneGeometry(2.0, 1.0), new T.MeshBasicMaterial({ map: neonTex([["NASI GORENG", "#ff4fa3", 92, 0.36], ["SATE • BAKSO", "#34e3ff", 64, 0.74]]), transparent: true, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false }))
      neon.position.set(-2.6, 3.4, -3.9); this.neon = neon
      const neonBoard = box(2.1, 1.1, 0.06, mat(0x15131c, { rough: 0.6 })); neonBoard.position.set(-2.6, 3.4, -3.95)
      this.root.add(neonBoard, neon)
      this.hemi = new T.HemisphereLight(0xffe4c4, 0x6a4a34, 1.1); this.root.add(this.hemi)
      const front = new T.DirectionalLight(0xfff0dc, 1.15); front.position.set(-2, 4, 7); this.root.add(front)
      for (const x of [-1.6, 1.6]) { const pl = new T.PointLight(0xffc27a, 5, 6, 1.6); pl.position.set(x, 2.2, -1.6); this.root.add(pl); this.lights.add(pl, 5) }
    }
    const key = new T.SpotLight(0xfff4e2, this.isBistro ? 12 : 20, 16, 0.8, 0.9, 1.3)
    key.position.set(0.6, 5.6, 3.8); key.target.position.set(0, 0.4, 1.0)
    this.root.add(key, key.target)
    gfx.addShadowLight(key)
    this.lights.add(key, key.intensity)
    const lan = lantern()
    this.lanternGroup = lan.group; this.root.add(lan.group)
    this.lantern = new T.PointLight(0xffb057, 3, 6, 1.5); this.root.add(this.lantern)

    this.cart = cart
    this.counter = new T.Group(); this.root.add(this.counter)
    this.pieces = {}
    this.plateSpots = []
    this.buildPieces()
    this.layout()

    this.fire = new Particles(gfx, { max: 260, additive: true, soft: 0.1 })
    this.steam = new Particles(gfx, { max: 240, soft: 0.0 })
    this.smoke = new Particles(gfx, { max: 160, soft: 0.0 })
    this.spark = new Particles(gfx, { max: 200, additive: true, soft: 0.25 })
    this.rainP = null
    this.raining = 0
    this.dark = false
    gfx.tickers.add(this.tick = (dt, t) => this.update(dt, t))
  }

  buildPieces() {
    for (const p of this.L.pieces) {
      const res = stationModel(p.model)
      if (res.food && !res.steak) res.food.visible = false
      const hit = new T.Mesh(new T.BoxGeometry(0.55, 0.55, 0.55), new T.MeshBasicMaterial({ visible: false }))   // in the piece's own (scaled) space
      hit.position.y = 0.22
      if (p.model === "fridge") hit.scale.set(2.3, 0.8, 0.9)
      if (p.model.startsWith("juice")) { hit.scale.set(1.1, 2.2, 1); hit.position.y = 0.55 }
      res.group.add(hit)
      res.hit = hit
      res.def = p
      this.root.add(res.group)
      this.pieces[p.id] = res
    }
    for (let i = 0; i < this.L.plates.length; i++) {
      const g = new T.Group()
      const mat_ = mesh(new T.CylinderGeometry(0.32, 0.32, 0.014, 32), mat(this.isBistro ? 0xffffff : 0xe2c79a, { rough: this.isBistro ? 0.3 : 0.85 }))
      mat_.position.y = 0.007
      const ring = mesh(new T.TorusGeometry(0.305, 0.016, 6, 36), mat(this.isBistro ? 0xe6e1d8 : 0xc58d4a, { rough: 0.5 })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.015
      const dish = new T.Group(); dish.position.y = 0.016; dish.scale.setScalar(1.45)
      const hit = new T.Mesh(new T.BoxGeometry(0.66, 0.5, 0.66), new T.MeshBasicMaterial({ visible: false })); hit.position.y = 0.2
      g.add(mat_, ring, dish, hit)
      this.root.add(g)
      this.plateSpots.push({ group: g, dish, hit, key: "" })
    }
  }

  layout() {
    const L = this.L, y = L.y, C = L.counter
    this.C = C
    this.counter.clear()
    const w = C.w + 0.5, d = C.z1 - C.z0 + 0.35, cz = (C.z0 + C.z1) / 2
    const accent = CART_COLORS[this.cart] || CART_COLORS.hijau
    if (this.isBistro) {
      const body = box(w, y - 0.06, d, mat(0x8a5634, { rough: 0.7 }), 0.03); body.position.set(0, (y - 0.06) / 2, cz)
      const top = box(w + 0.1, 0.07, d + 0.06, mat(0xffffff, { map: marbleTex(), rough: 0.4 }), 0.03); top.position.set(0, y - 0.035, cz)
      const front = mesh(new T.PlaneGeometry(w - 0.06, y - 0.1), mat(0xffffff, { map: panelTex(accent), rough: 0.6 }))
      front.position.set(0, (y - 0.06) / 2, C.z1 + 0.176)
      this.counter.add(body, top, front)
      // the big grill: glossy red chassis under the four grill cells, chrome rim and knobs
      const gx = this.L.pieces.filter((p) => p.model === "steakslot")
      if (gx.length) {
        const xs = gx.map((p) => p.at[0]), zs = gx.map((p) => p.at[1])
        const x0 = Math.min(...xs) - 0.36, x1 = Math.max(...xs) + 0.36, z0 = Math.min(...zs) - 0.33, z1 = Math.max(...zs) + 0.33
        const red = mat(0xcf2a2a, { rough: 0.25, metal: 0.15 }), chrome = mat(0xdfe3e8, { rough: 0.12, metal: 1 })
        const chassis = box(x1 - x0, 0.1, z1 - z0, red, 0.03); chassis.position.set((x0 + x1) / 2, y + 0.02, (z0 + z1) / 2)
        const rim = box(x1 - x0 + 0.04, 0.03, 0.05, chrome, 0.01); rim.position.set((x0 + x1) / 2, y + 0.08, z1)
        this.counter.add(chassis, rim)
        for (let i = 0; i < 4; i++) { const k = cyl(0.04, 0.04, 0.05, mat(0x222222, { rough: 0.4 }), 14); k.rotation.x = Math.PI / 2; k.position.set(x0 + 0.25 + i * ((x1 - x0 - 0.5) / 3), y + 0.03, z1 + 0.03); this.counter.add(k) }
      }
    } else {
      const steelTop = mat(0xffffff, { map: steelTex(), rough: 0.6, metal: 0.4 })
      const wood = mat(0x9a6b3e, { rough: 0.75 })
      const body = box(w, y - 0.06, d, mat(0x7a5233, { rough: 0.8 }), 0.03); body.position.set(0, (y - 0.06) / 2, cz)
      const top = box(w, 0.06, d, steelTop, 0.02); top.position.set(0, y - 0.03, cz)
      const ledge = box(w, 0.03, 0.62, wood, 0.01); ledge.position.set(0, y + 0.005, C.z0 + 0.45)
      const front = mesh(new T.PlaneGeometry(w - 0.1, y - 0.12), mat(0xffffff, { map: counterFrontTex(accent, true), rough: 0.5 }))
      front.position.set(0, (y - 0.06) / 2, C.z1 + 0.176)
      this.counter.add(body, top, ledge, front)
    }
    const ends = [-w / 2 + 0.2, w / 2 - 0.2]
    for (const [i, x] of ends.entries()) {
      const jar = cyl(0.06, 0.06, 0.14, mat(this.isBistro ? 0x9fd8cf : 0xc8382f, { rough: 0.2, opacity: 0.9 }), 14); jar.position.set(x, y + 0.07, C.z0 + 0.15)
      const lime = prop(i ? "lemon-half" : "paprika", 0.28); lime.position.set(x + (i ? -0.12 : 0.12), y, C.z0 + 0.15)
      this.counter.add(jar, lime)
    }
    this.lanternGroup.visible = !this.isBistro
    this.lanternGroup.position.set(w / 2 - 0.25, 2.1, C.z0 - 0.15)
    this.lantern.position.set(w / 2 - 0.25, 2.0, C.z0 - 0.1)
    for (const p of L.pieces) {
      const r = this.pieces[p.id]
      const [x, z] = p.at
      const lift = this.isBistro && p.model === "steakslot" ? 0.07 : 0
      r.group.position.set(x, y + lift, z)
      r.top = new T.Vector3(x, y + 0.75, z)
    }
    L.plates.forEach(([x, z], i) => { const s = this.plateSpots[i]; s.group.position.set(x, y + 0.02, z); s.top = new T.Vector3(x, y + 0.45, z) })
    this.placeDecor()
    this.counter.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true } })
  }

  // Pieces not used today are replaced by little still lifes so the counter never looks empty.
  decorate(active) {
    const sets = [
      () => { const g = new T.Group(); const b = prop("cutting-board", 0.42); const c = prop("cabbage", 0.42); c.position.set(0.02, 0.02, 0); const k = prop("cooking-knife", 0.36); k.position.set(0.05, 0.03, 0.13); g.add(b, c, k); return g },
      () => { const g = new T.Group(); [["bottle-oil", -0.1], ["soy", 0.08], ["bottle-ketchup", 0.12]].forEach(([n, x], i) => { const p = prop(n, 0.55); p.position.set(x, 0, i * 0.06 - 0.05); g.add(p) }); return g },
      () => { const g = new T.Group(); const bowl = prop("bowl", 0.5); g.add(bowl); for (let i = 0; i < 6; i++) { const t = prop(i % 2 ? "paprika" : "tomato", 0.42); t.position.set(Math.cos(i) * 0.07, 0.07, Math.sin(i) * 0.07); g.add(t) } return g },
      () => { const g = new T.Group(); const m = prop("mortar-pestle", 0.9); const o = prop("onion", 0.4); o.position.set(0.14, 0, 0.05); const l = prop("lemon-half", 0.45); l.position.set(-0.13, 0, 0.06); g.add(m, o, l); return g },
    ]
    let k = 0
    for (const p of this.L.pieces) {
      const r = this.pieces[p.id]
      if (active.has(p.id) || p.id === "grill2" || p.extra || p.model === "steakslot") continue
      const d = sets[k++ % sets.length]()
      d.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true } })
      r.decor = d
      this.root.add(d)
    }
    this.placeDecor()
  }

  placeDecor() {
    for (const p of this.L.pieces) {
      const r = this.pieces[p.id]
      if (r.decor) { const [x, z] = p.at; r.decor.position.set(x, this.L.y, z) }
    }
  }

  stationFx(id) {
    const r = this.pieces[id]
    return new T.Vector3(...r.fx).applyMatrix4(r.group.matrixWorld)
  }

  setDark(on) {
    if (on === this.dark) return
    this.dark = on
    this.lights.set(!on)
    this.lantern.intensity = on ? 9 : 3
  }

  setRain(on) {
    this.raining = on ? 1 : 0
    if (on && !this.rainP) this.rainP = new Particles(this.gfx, { max: 700, soft: 0.6 })
  }

  update(dt, t) {
    this.lights.update(dt, t)
    this.sky.mat.uniforms.dark.value += ((this.dark ? 1 : 0) - this.sky.mat.uniforms.dark.value) * Math.min(1, dt * 3)
    if (this.neon) this.neon.material.opacity = this.lights.level * (Math.sin(t * 23) > 0.97 ? 0.4 : 1)
    for (const p of [this.fire, this.steam, this.smoke, this.spark]) p.update(dt)
    if (this.rainP) {
      const n = this.raining ? Math.round(dt * 900) : 0
      for (let i = 0; i < n; i++) this.rainP.spawn({ x: (Math.random() - 0.5) * 12, y: 6 + Math.random() * 2, z: -5 + Math.random() * 5, vy: -11, vx: -0.6, life: 0.65, size: 0.05, color: [0.7, 0.8, 1], alpha: 0.55 })
      this.rainP.update(dt)
      if (this.ground) this.ground.material.roughness += ((this.raining ? 0.25 : 0.62) - this.ground.material.roughness) * Math.min(1, dt)
    }
  }

  fireAt(id, power = 1) {
    const r = this.pieces[id]
    if (!r?.fire) return
    const p = new T.Vector3(...r.fire).applyMatrix4(r.group.matrixWorld)
    for (let i = 0; i < 2 * power; i++) this.fire.spawn({ x: p.x + (Math.random() - 0.5) * 0.2, y: p.y, z: p.z + (Math.random() - 0.5) * 0.2, vy: 0.8 + Math.random() * 0.5, life: 0.3, size: 0.13, grow: -0.2, color: Math.random() < 0.5 ? [1, 0.55, 0.15] : [0.35, 0.55, 1], alpha: 0.85 })
  }
  steamAt(v, n = 1, dark = false) {
    const ps = dark ? this.smoke : this.steam
    for (let i = 0; i < n; i++) ps.spawn({ x: v.x + (Math.random() - 0.5) * 0.15, y: v.y, z: v.z + (Math.random() - 0.5) * 0.15, vy: 0.35 + Math.random() * 0.3, vx: (Math.random() - 0.5) * 0.1, life: 1.4, size: 0.16, grow: 0.3, drag: 0.4, color: dark ? [0.12, 0.12, 0.13] : [0.95, 0.95, 0.98], alpha: dark ? 0.75 : 0.28 })
  }
  sparkle(v, color = [1, 0.85, 0.3], n = 18) {
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = 0.8 + Math.random() * 1.4; this.spark.spawn({ x: v.x, y: v.y, z: v.z, vx: Math.cos(a) * s, vz: Math.sin(a) * s, vy: 1.4 + Math.random() * 1.4, gravity: -5, life: 0.75, size: 0.08, color, alpha: 1 }) }
  }

  dispose() { this.gfx.tickers.delete(this.tick) }
}

export { catModel, dishModel }
