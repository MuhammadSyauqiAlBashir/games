// Wok & Roll renderer: WebGL2 + ACES tone mapping, soft shadows, image-based reflections, bloom, particles,
// HTML labels pinned to 3D points, and tap picking. Quality levels trade looks for battery.
import * as T from "./three.js?v=__VERSION__"
import { store } from "../lib.js?v=__VERSION__"

export const QUALITY = {
  ultra: { pr: 2, shadow: 2048, bloom: true, msaa: 4, glass: true },
  high: { pr: 1.5, shadow: 1024, bloom: true, msaa: 4, glass: false },
  saver: { pr: 1, shadow: 0, bloom: false, msaa: 0, glass: false },
}
export const qualityPref = () => store.get("cook_q", "auto")
export const setQualityPref = (q) => store.set("cook_q", q)

export class Gfx {
  constructor(host) {
    this.host = host
    this.canvas = document.createElement("canvas")
    this.canvas.className = "ck-canvas"
    this.labels = document.createElement("div")
    this.labels.className = "ck-labels"
    host.append(this.canvas, this.labels)
    const pref = qualityPref()
    this.qKey = pref === "auto" ? (Math.min(devicePixelRatio || 1, 3) >= 2 ? "high" : "saver") : pref
    this.auto = pref === "auto"
    this.renderer = new T.WebGLRenderer({ canvas: this.canvas, antialias: false, powerPreference: "high-performance", stencil: false })
    this.renderer.outputColorSpace = T.SRGBColorSpace
    this.renderer.toneMapping = T.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 0.95
    this.renderer.shadowMap.type = T.PCFShadowMap
    this.scene = new T.Scene()
    this.camera = new T.PerspectiveCamera(36, 1, 0.1, 120)
    this.last = 0
    this.elapsed = 0
    this.tickers = new Set()
    this.pickables = []
    this.pins = []
    this.ray = new T.Raycaster()
    const pm = new T.PMREMGenerator(this.renderer)
    this.envTex = pm.fromScene(new T.RoomEnvironment(), 0.04).texture
    pm.dispose()
    this.scene.environment = this.envTex
    this.scene.environmentIntensity = 0.35
    this.fps = { n: 0, t: 0, low: 0 }
    this.running = false
    this.applyQuality()
    this.resize()
    this.onResize = () => this.resize()
    window.addEventListener("resize", this.onResize)
    this.ro = new ResizeObserver(this.onResize)
    this.ro.observe(host)
    this.onVis = () => { this.last = 0 }   // no giant time step after the phone wakes up
    document.addEventListener("visibilitychange", this.onVis)
  }

  get q() { return QUALITY[this.qKey] }

  applyQuality() {
    const q = this.q
    const r = this.renderer
    r.setPixelRatio(Math.min(devicePixelRatio || 1, q.pr))
    r.shadowMap.enabled = q.shadow > 0
    for (const l of this.shadowLights || []) { l.castShadow = q.shadow > 0; if (q.shadow) { l.shadow.mapSize.set(q.shadow, q.shadow); l.shadow.map?.dispose(); l.shadow.map = null } }
    this.scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true }) })
    if (this.composer) { this.composer.dispose(); this.composer = null }
    if (q.bloom) {
      const size = r.getDrawingBufferSize(new T.Vector2())
      const rt = new T.WebGLRenderTarget(size.x, size.y, { type: T.HalfFloatType, samples: q.msaa })
      this.composer = new T.EffectComposer(r, rt)
      this.composer.addPass(new T.RenderPass(this.scene, this.camera))
      this.bloom = new T.UnrealBloomPass(new T.Vector2(size.x, size.y), 0.35, 0.3, 2.4)   // HDR threshold: only bulbs, neon and fire glow
      this.composer.addPass(this.bloom)
      this.composer.addPass(new T.OutputPass())
    }
    this.resize()
  }

  setQuality(k) {
    if (!QUALITY[k] || k === this.qKey) return
    this.qKey = k
    this.applyQuality()
  }

  resize() {
    const w = Math.max(1, this.host.clientWidth), h = Math.max(1, this.host.clientHeight)
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    if (this.composer) { this.composer.setPixelRatio(this.renderer.getPixelRatio()); this.composer.setSize(w, h) }
    this.w = w; this.h = h
    this.onCamera && this.onCamera()
  }

  addShadowLight(l, size = 7) {
    this.shadowLights = this.shadowLights || []
    this.shadowLights.push(l)
    l.castShadow = this.q.shadow > 0
    l.shadow.mapSize.set(this.q.shadow || 512, this.q.shadow || 512)
    l.shadow.bias = -0.0004
    l.shadow.normalBias = 0.02
    if (l.shadow.camera.isOrthographicCamera) Object.assign(l.shadow.camera, { left: -size, right: size, top: size, bottom: -size, near: 0.5, far: 30 })
    else { l.shadow.camera.near = 0.5; l.shadow.camera.far = 25 }
    l.shadow.radius = 4
  }

  start() {
    if (this.running) return
    this.running = true
    this.last = 0
    const loop = (now) => {
      if (!this.running) return
      this.raf = requestAnimationFrame(loop)
      if (document.hidden) return
      const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0.016
      this.last = now
      this.elapsed += dt
      const t = this.elapsed
      for (const f of this.tickers) {
        try { f(dt, t) } catch (err) {   // one bad frame must not freeze the game; report each problem once
          const k = String(err && err.message)
          if (!this.errs?.has(k)) { (this.errs ||= new Set()).add(k); console.error("cook frame:", err && err.stack) }
        }
      }
      if (this.composer) this.composer.render(dt)
      else this.renderer.render(this.scene, this.camera)
      this.updatePins()
      this.watchFps(dt)
    }
    this.raf = requestAnimationFrame(loop)
  }

  // Auto quality: drop a level when the phone can't keep ~40 fps for a few seconds.
  watchFps(dt) {
    if (!this.auto) return
    const f = this.fps
    f.n++; f.t += dt
    if (f.t < 2.5) return
    const fps = f.n / f.t
    f.n = 0; f.t = 0
    if (fps < 38) { if (++f.low >= 2) { f.low = 0; if (this.qKey === "ultra") this.setQuality("high"); else if (this.qKey === "high") this.setQuality("saver") } }
    else { f.low = 0; if (fps > 57 && this.qKey === "high" && (devicePixelRatio || 1) >= 2 && !f.upgraded) { f.upgraded = true; this.setQuality("ultra") } }
  }

  // ---- HTML labels pinned to a 3D point (order bubbles, timers, coins) ----------------------------
  pin(node, getPos, { offset = [0, 0], hideBehind = false, anchor = "bottom" } = {}) {
    const p = { node, getPos, offset, hideBehind, anchor, v: new T.Vector3() }
    node.classList.add("ck-pin")
    this.labels.append(node)
    this.pins.push(p)
    return () => { node.remove(); this.pins.splice(this.pins.indexOf(p), 1) }
  }

  updatePins() {
    for (const p of this.pins) {
      const pos = p.getPos()
      if (!pos) { p.node.style.display = "none"; continue }
      p.v.copy(pos).project(this.camera)
      if (p.v.z > 1) { p.node.style.display = "none"; continue }
      p.node.style.display = ""
      const x = (p.v.x * 0.5 + 0.5) * this.w + p.offset[0], y = (-p.v.y * 0.5 + 0.5) * this.h + p.offset[1]
      p.node.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) ${p.anchor === "side" ? "translate(0, -50%)" : "translate(-50%, -100%)"}`
    }
  }

  toScreen(v3) {
    const v = v3.clone().project(this.camera)
    return [(v.x * 0.5 + 0.5) * this.w, (-v.y * 0.5 + 0.5) * this.h]
  }

  // ---- picking: exact ray hit first, else the nearest target within ~44 px (fat fingers) ------------
  // obj = an invisible tap box; visual = the thing the player sees (checked first, so what's under the finger wins)
  addPick(obj, target, anchor, visual = null) { this.pickables.push({ obj, target, anchor: anchor || obj, visual }); return target }
  removePick(obj) { this.pickables = this.pickables.filter((p) => p.obj !== obj && p.visual !== obj) }

  pick(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect()
    const x = clientX - r.left, y = clientY - r.top
    const ndc = new T.Vector2((x / r.width) * 2 - 1, -(y / r.height) * 2 + 1)
    this.ray.setFromCamera(ndc, this.camera)
    const live = this.pickables.filter((p) => p.obj.visible !== false && p.target.enabled !== false)
    // 1) the visible surface under the finger (tap boxes are skipped here)
    const visuals = live.filter((p) => p.visual && p.visual.visible !== false)
    const vhits = this.ray.intersectObjects(visuals.map((p) => p.visual), true)
    for (const h of vhits) {
      if (h.object.material && h.object.material.visible === false) continue
      let o = h.object
      while (o) { const p = visuals.find((q) => q.visual === o); if (p) return p.target; o = o.parent }
    }
    // 2) the padded tap boxes
    const hits = this.ray.intersectObjects(live.map((p) => p.obj), true)
    for (const h of hits) {
      let o = h.object
      while (o) { const p = live.find((q) => q.obj === o); if (p) return p.target; o = o.parent }
    }
    // no exact hit: the nearest target whose on-screen outline is within ~28 px (fat fingers)
    let best = null, bd = 28
    for (const p of live) {
      const d = this.screenDistance(p.obj, x, y) * (p.target.priority ? 0.7 : 1)
      if (d < bd) { bd = d; best = p.target }
    }
    return best
  }

  // Distance in px from (x, y) to the screen rectangle of an object's bounds (0 when inside).
  screenDistance(obj, x, y) {
    const bb = this._bb || (this._bb = new T.Box3())
    bb.setFromObject(obj)
    if (bb.isEmpty()) return Infinity
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    const v = this._v || (this._v = new T.Vector3())
    for (let i = 0; i < 8; i++) {
      v.set(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z).project(this.camera)
      const sx = (v.x * 0.5 + 0.5) * this.w, sy = (-v.y * 0.5 + 0.5) * this.h
      x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy)
    }
    const dx = Math.max(x0 - x, 0, x - x1), dy = Math.max(y0 - y, 0, y - y1)
    return Math.hypot(dx, dy)
  }

  dispose() {
    this.running = false
    cancelAnimationFrame(this.raf)
    window.removeEventListener("resize", this.onResize)
    document.removeEventListener("visibilitychange", this.onVis)
    this.ro.disconnect()
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose()
      if (o.material) [].concat(o.material).forEach((m) => { for (const k of ["map", "emissiveMap", "roughnessMap", "normalMap", "alphaMap"]) m[k]?.dispose?.(); m.dispose() })
    })
    this.envTex.dispose()
    this.composer?.dispose()
    this.renderer.dispose()
    this.renderer.forceContextLoss?.()
    this.canvas.remove(); this.labels.remove()
  }
}

// ---- particles: one Points cloud per effect type, CPU-simulated, soft round sprites -------------------
const SPRITE_VS = `
attribute float size; attribute float alpha; attribute vec3 tint;
varying float vA; varying vec3 vC;
uniform float scale;
void main() {
  vA = alpha; vC = tint;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * scale / -mv.z;
  gl_Position = projectionMatrix * mv;
}`
const SPRITE_FS = `
varying float vA; varying vec3 vC;
uniform float soft;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float d = length(p) * 2.0;
  float a = smoothstep(1.0, soft, d) * vA;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vC, a);
}`

export class Particles {
  constructor(gfx, { max = 300, additive = false, soft = 0.2 } = {}) {
    this.max = max
    this.pos = new Float32Array(max * 3); this.size = new Float32Array(max); this.alpha = new Float32Array(max); this.tint = new Float32Array(max * 3)
    this.p = []
    const g = new T.BufferGeometry()
    g.setAttribute("position", new T.BufferAttribute(this.pos, 3).setUsage(T.DynamicDrawUsage))
    g.setAttribute("size", new T.BufferAttribute(this.size, 1).setUsage(T.DynamicDrawUsage))
    g.setAttribute("alpha", new T.BufferAttribute(this.alpha, 1).setUsage(T.DynamicDrawUsage))
    g.setAttribute("tint", new T.BufferAttribute(this.tint, 3).setUsage(T.DynamicDrawUsage))
    this.mat = new T.ShaderMaterial({
      vertexShader: SPRITE_VS, fragmentShader: SPRITE_FS, transparent: true, depthWrite: false,
      blending: additive ? T.AdditiveBlending : T.NormalBlending,
      uniforms: { scale: { value: 400 }, soft: { value: soft } },
    })
    this.points = new T.Points(g, this.mat)
    this.points.frustumCulled = false
    this.points.renderOrder = 5
    this.geo = g
    gfx.scene.add(this.points)
    this.gfx = gfx
  }

  // spawn({x,y,z, vx,vy,vz, life, size, grow, color:[r,g,b], alpha, drag, gravity})
  spawn(o) {
    if (this.p.length >= this.max) this.p.shift()
    this.p.push({ age: 0, vx: 0, vy: 0, vz: 0, grow: 0, alpha: 1, drag: 0, gravity: 0, color: [1, 1, 1], size: 0.2, life: 1, ...o })
  }

  update(dt) {
    this.mat.uniforms.scale.value = this.gfx.h * this.gfx.renderer.getPixelRatio() * 0.9
    const ps = this.p
    let n = 0
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i]
      p.age += dt
      if (p.age >= p.life) { ps.splice(i, 1); continue }
      p.vy += p.gravity * dt
      const k = 1 - p.drag * dt
      p.vx *= k; p.vy *= k; p.vz *= k
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt
    }
    for (const p of ps) {
      const f = p.age / p.life
      this.pos[n * 3] = p.x; this.pos[n * 3 + 1] = p.y; this.pos[n * 3 + 2] = p.z
      this.size[n] = p.size + p.grow * p.age
      this.alpha[n] = p.alpha * (f < 0.15 ? f / 0.15 : 1 - (f - 0.15) / 0.85)
      this.tint[n * 3] = p.color[0]; this.tint[n * 3 + 1] = p.color[1]; this.tint[n * 3 + 2] = p.color[2]
      n++
    }
    this.geo.setDrawRange(0, n)
    for (const a of ["position", "size", "alpha", "tint"]) this.geo.attributes[a].needsUpdate = true
  }
}

// ---- procedural canvas textures ------------------------------------------------------------------------
export function canvasTex(w, h, draw, { repeat = null, srgb = true } = {}) {
  const c = document.createElement("canvas")
  c.width = w; c.height = h
  draw(c.getContext("2d"), w, h)
  const t = new T.CanvasTexture(c)
  if (srgb) t.colorSpace = T.SRGBColorSpace
  t.anisotropy = 4
  if (repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]) }
  return t
}

export function noiseFill(g, w, h, base, spread, n = 9000, size = 2) {
  g.fillStyle = base
  g.fillRect(0, 0, w, h)
  for (let i = 0; i < n; i++) {
    const v = (Math.random() - 0.5) * spread
    g.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`
    g.fillRect(Math.random() * w, Math.random() * h, size, size)
  }
}
