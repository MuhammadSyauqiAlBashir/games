// Wok & Roll models: Kenney CC0 packs (props, animated characters) + hero pieces modelled in code
// (stations, dishes, hats, the cat). Sizes: a character is ~1 unit tall.
import * as T from "./three.js?v=__VERSION__"
import { canvasTex, noiseFill } from "./gfx.js?v=__VERSION__"

const FOOD = 0.32
let packs = null

export async function loadPacks(onProgress) {
  if (packs) return packs
  const loader = new T.GLTFLoader()
  let a = 0, b = 0
  const prog = () => onProgress && onProgress((a + b) / 2)
  // GLTFLoader reads embedded textures with fetch(blob:) when createImageBitmap exists, which the site's CSP
  // (connect-src 'self') blocks; without it the loader uses <img> (img-src allows blob:). Hide it while loading.
  const cib = window.createImageBitmap
  try { window.createImageBitmap = undefined } catch (_) {}
  let props, people
  try {
    [props, people] = await Promise.all([
      loader.loadAsync("/cook/m/props-v1.glb", (e) => { if (e.total) { a = e.loaded / e.total; prog() } }),
      loader.loadAsync("/cook/m/people-v1.glb", (e) => { if (e.total) { b = e.loaded / e.total; prog() } }),
    ])
  } finally { try { window.createImageBitmap = cib } catch (_) {} }
  const P = {}, H = {}
  for (const c of props.scene.children) P[c.name] = c
  for (const c of people.scene.children) {
    // GLTFLoader renames duplicate node names (Hips_1…); the shared clips target the plain names.
    c.traverse((o) => { if (o !== c) o.name = o.name.replace(/_\d+$/, "") })
    const key = c.name.replace(/_\d+$/, "")
    c.updateMatrixWorld(true)
    const size = new T.Box3().setFromObject(c).getSize(new T.Vector3())
    H[key] = { src: c, height: size.y || 1 }
  }
  props.scene.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true; o.receiveShadow = true
      for (const m of [].concat(o.material)) { m.envMapIntensity = 0.6; if (m.map) m.map.anisotropy = 4 }
    }
  })
  people.scene.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false
      for (const m of [].concat(o.material)) { m.flatShading = true; m.metalness = 0; m.roughness = 0.82; m.envMapIntensity = 0.25; m.needsUpdate = true }   // matte: glossy people looked washed out
    }
  })
  packs = { P, H, clips: people.animations }
  return packs
}

// A copy of a Kenney prop, scaled.
export function prop(name, scale = 1) {
  const src = packs.P[name]
  if (!src) return new T.Group()
  const g = src.clone(true)
  g.scale.setScalar(scale)
  return g
}

// ---- materials -----------------------------------------------------------------------------------------
const matCache = new Map()
export function mat(color, { rough = 0.6, metal = 0, emissive = null, ei = 1, opacity = 1, side = null, map = null, flat = false } = {}) {
  const key = [color, rough, metal, emissive, ei, opacity, side, map?.uuid, flat].join("|")
  if (matCache.has(key)) return matCache.get(key)
  const m = new T.MeshStandardMaterial({ color, roughness: rough, metalness: metal, map, flatShading: flat })
  if (emissive !== null) { m.emissive = new T.Color(emissive); m.emissiveIntensity = ei }
  if (opacity < 1) { m.transparent = true; m.opacity = opacity; m.depthWrite = false }
  if (side) m.side = side
  matCache.set(key, m)
  return m
}
export function mesh(geo, m, { shadow = true } = {}) {
  const o = new T.Mesh(geo, m)
  o.castShadow = shadow; o.receiveShadow = true
  return o
}
const box = (w, h, d, m, r = 0) => mesh(r ? roundBox(w, h, d, r) : new T.BoxGeometry(w, h, d), m)
const cyl = (rt, rb, h, m, seg = 20, open = false) => mesh(new T.CylinderGeometry(rt, rb, h, seg, 1, open), m)
const sph = (r, m, ws = 16, hs = 12) => mesh(new T.SphereGeometry(r, ws, hs), m)
export { box, cyl, sph }

// Rounded box (bevelled edges catch the light — looks far richer than a plain box).
const rbCache = new Map()
export function roundBox(w, h, d, r) {
  const key = [w, h, d, r].join(",")
  if (rbCache.has(key)) return rbCache.get(key)
  const s = new T.Shape()
  const x = -w / 2 + r, y = -h / 2 + r, iw = w - 2 * r, ih = h - 2 * r
  s.moveTo(x, y - r); s.lineTo(x + iw, y - r); s.quadraticCurveTo(x + iw + r, y - r, x + iw + r, y)
  s.lineTo(x + iw + r, y + ih); s.quadraticCurveTo(x + iw + r, y + ih + r, x + iw, y + ih + r)
  s.lineTo(x, y + ih + r); s.quadraticCurveTo(x - r, y + ih + r, x - r, y + ih); s.lineTo(x - r, y); s.quadraticCurveTo(x - r, y - r, x, y - r)
  const g = new T.ExtrudeGeometry(s, { depth: d - 2 * r, bevelEnabled: true, bevelSize: r, bevelThickness: r, bevelSegments: 2, curveSegments: 3 })
  g.translate(0, 0, -(d - 2 * r) / 2)
  g.computeVertexNormals()
  rbCache.set(key, g)
  return g
}

// ---- characters: Quaternius CC0 people (one shared rig + animations) -------------------------------------------
export const PERSON_HEIGHT = 1.75
const CLIP = { idle: "idle", walk: "walk", run: "run", yes: "wave", no: "hit", work: "interact", pick: "interact", hold: "idle", sit: "idle" }
const tmpV = new T.Vector3()

// spec: "k-casual" or { m: "n-dress", tint: { Hair: "#d9d9d9", LimeGreen: "#7b4fb3" } }
export class Actor {
  constructor(spec, { hat = null, apron = false, height = PERSON_HEIGHT, tint = null } = {}) {
    const key = typeof spec === "string" ? spec : spec?.m
    const tints = { ...(typeof spec === "object" && spec ? spec.tint : null), ...(tint || {}) }
    const def = packs.H[key] || packs.H["k-casual"]
    this.root = new T.Group()
    this.body = T.cloneSkinned(def.src)
    this.body.scale.setScalar(height / def.height)
    this.root.add(this.body)
    if (Object.keys(tints).length) {
      const done = new Map()
      this.body.traverse((o) => {
        if (!o.isMesh) return
        o.material = [].concat(o.material).map((m) => {
          const short = m.name.split(":").pop()
          const t = tints[short]
          if (!t) return m
          if (!done.has(m)) { const c = m.clone(); c.color = new T.Color(t); done.set(m, c) }
          return done.get(m)
        })
        if (o.material.length === 1) o.material = o.material[0]
      })
    }
    this.mixer = new T.AnimationMixer(this.body)
    this.actions = {}
    for (const clip of packs.clips) this.actions[clip.name] = this.mixer.clipAction(clip)
    this.cur = null
    this.head = this.body.getObjectByName("Head")
    this.height = height
    this.body.updateMatrixWorld(true)
    if (hat) this.wear(hat)
    if (apron) this.addApron(apron)
    this.play("idle")
  }

  play(name, { fade = 0.2, once = false, speed = 1 } = {}) {
    const a = this.actions[CLIP[name] || name]
    if (!a) return
    if (this.cur === a && !once) { a.timeScale = speed; return }
    a.reset()
    a.timeScale = speed
    a.setLoop(once ? T.LoopOnce : T.LoopRepeat, once ? 1 : Infinity)
    a.clampWhenFinished = once
    if (this.cur) a.crossFadeFrom(this.cur, fade, false)
    a.play()
    this.cur = a
    this.curName = name
  }

  // Hats are built for a ~0.45-wide head; the head bone's own scale is undone so they fit any rig.
  wear(kind) {
    if (this.hat) { this.hat.removeFromParent(); this.hat = null }
    const h = hatModel(kind)
    if (!h || !this.head) return
    this.head.getWorldScale(tmpV)
    const k = (this.height * 0.15) / 0.45 / tmpV.y
    const wrap = new T.Group()
    wrap.scale.setScalar(k)
    wrap.position.y = (this.height * 0.025) / tmpV.y
    wrap.add(h)
    this.head.add(wrap)
    this.hat = wrap
  }

  addApron(color) {
    const H = this.height, inv = 1 / this.body.scale.x
    const g = new T.Group()
    const m = mat(color, { rough: 0.85 })
    const a = box(H * 0.2, H * 0.27, 0.012 * H, m, 0.004 * H); a.position.set(0, H * 0.47, H * 0.085)
    const tie = box(H * 0.22, H * 0.018, H * 0.13, m); tie.position.set(0, H * 0.6, 0.02 * H)
    g.add(a, tie)
    g.scale.setScalar(inv)
    this.body.add(g)
  }

  update(dt) { this.mixer.update(dt) }
}

// Hats sit on the Kenney head node (head local space: ~0.75 tall block, top at y≈0.78 in model units).
function hatModel(kind) {
  const g = new T.Group()
  const top = 0.74
  if (kind === "toque") {
    const white = mat(0xfbfaf6, { rough: 0.9 })
    const band = cyl(0.26, 0.26, 0.14, white, 24); band.position.y = top + 0.05
    const puff = sph(0.3, white, 20, 14); puff.scale.set(1, 0.75, 1); puff.position.y = top + 0.26
    for (let i = 0; i < 5; i++) { const b = sph(0.13, white, 12, 10); const a = (i / 5) * Math.PI * 2; b.position.set(Math.cos(a) * 0.2, top + 0.3, Math.sin(a) * 0.2); g.add(b) }
    g.add(band, puff)
  } else if (kind === "bandana") {
    const red = mat(0xd8433b, { rough: 0.8 })
    const b = cyl(0.33, 0.33, 0.16, red, 24); b.position.y = top - 0.04; b.scale.z = 1.05
    const knot = sph(0.07, red); knot.position.set(0, top - 0.02, -0.32)
    g.add(b, knot)
  } else if (kind === "cap") {
    const c = mat(0x2f6fb5, { rough: 0.7 })
    const dome = sph(0.32, c, 20, 10); dome.scale.set(1, 0.55, 1.05); dome.position.y = top - 0.02
    const brim = cyl(0.24, 0.24, 0.03, c, 20); brim.scale.set(1, 1, 0.8); brim.position.set(0, top - 0.04, 0.3)
    g.add(dome, brim)
  } else if (kind === "peci") {
    const p = cyl(0.3, 0.32, 0.2, mat(0x151515, { rough: 0.55 }), 4); p.rotation.y = Math.PI / 4; p.scale.set(1.15, 1, 0.9); p.position.y = top + 0.06
    g.add(p)
  } else if (kind === "crown") {
    const gold = mat(0xf2c14e, { rough: 0.25, metal: 1 })
    const ring = cyl(0.28, 0.28, 0.12, gold, 24, true); ring.position.y = top + 0.06
    ring.material = gold; ring.material.side = T.DoubleSide
    for (let i = 0; i < 6; i++) { const s = mesh(new T.ConeGeometry(0.06, 0.16, 4), gold); const a = (i / 6) * Math.PI * 2; s.position.set(Math.cos(a) * 0.27, top + 0.19, Math.sin(a) * 0.27); g.add(s) }
    const gem = sph(0.05, mat(0xe0245e, { rough: 0.1, emissive: 0xe0245e, ei: 0.6 })); gem.position.set(0, top + 0.08, 0.29)
    g.add(ring, gem)
  } else if (kind === "helmet") {
    const green = mat(0x18a957, { rough: 0.35, metal: 0.1 })
    const dome = mesh(new T.SphereGeometry(0.4, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), green); dome.scale.set(1, 0.75, 1.08); dome.position.y = top - 0.08
    const visor = box(0.46, 0.05, 0.16, mat(0x222831, { rough: 0.1, metal: 0.3 })); visor.position.set(0, top - 0.08, 0.38); visor.rotation.x = 0.2
    g.add(dome, visor)
  } else if (kind === "beret") {
    const b = sph(0.34, mat(0x7a1f2b, { rough: 0.9 }), 18, 10); b.scale.set(1.05, 0.32, 1.05); b.position.set(0.04, top + 0.02, 0); b.rotation.z = -0.2
    const stem = cyl(0.02, 0.02, 0.06, mat(0x7a1f2b)); stem.position.set(0.05, top + 0.12, 0)
    g.add(b, stem)
  } else if (kind === "shades") {
    const blk = mat(0x111111, { rough: 0.15, metal: 0.4 })
    for (const x of [-0.13, 0.13]) { const l = box(0.18, 0.09, 0.03, blk); l.position.set(x, 0.42, 0.32); g.add(l) }
    const br = box(0.1, 0.02, 0.02, blk); br.position.set(0, 0.44, 0.32); g.add(br)
  } else if (kind === "scarf") {
    // kerudung: a cap over the top and back of the head, open at the face
    const cloth = mat(0x6b4a8a, { rough: 0.9, side: T.DoubleSide })
    const capG = new T.SphereGeometry(0.33, 22, 12, Math.PI * 0.2, Math.PI * 1.6, 0, Math.PI * 0.55)
    const cap = mesh(capG, cloth); cap.rotation.y = Math.PI; cap.position.set(0, top - 0.16, -0.04); cap.scale.set(1.0, 0.95, 1.05)
    const back = box(0.5, 0.3, 0.1, cloth, 0.04); back.position.set(0, top - 0.5, -0.33)
    g.add(cap, back)
  } else if (kind === "phone") {
    const p = box(0.12, 0.22, 0.02, mat(0x1b1b1f, { rough: 0.2, metal: 0.5 }), 0.01); p.position.set(0.42, 0.45, 0.25); p.rotation.y = -0.6
    const scr = box(0.1, 0.18, 0.005, mat(0x8fd3ff, { emissive: 0x8fd3ff, ei: 1.4 })); scr.position.set(0.42, 0.45, 0.262); scr.rotation.y = -0.6
    g.add(p, scr)
  } else return null
  g.traverse((o) => { if (o.isMesh) o.castShadow = true })
  // Built for a 0.6-wide head with its top at 0.74; the Kenney head bone sits at the neck (top ≈ 0.43, 0.45 wide).
  g.scale.setScalar(0.75)
  g.position.y = 0.43 - top * 0.75
  return g
}

// ---- food ------------------------------------------------------------------------------------------------
// One merged mound of rice grains (with scallion, chili and egg bits), shared by every plate and wok.
let riceGeo = null
function rice() {
  if (riceGeo) return riceGeo
  const parts = []
  const grain = new T.IcosahedronGeometry(1, 0)
  const cols = [[0xc9772f, 60], [0xd98c3a, 60], [0xb8652a, 45], [0x4f9a3a, 10], [0xd23a2a, 8], [0xf2c94c, 10]]
  const pick = () => { let x = Math.random() * 193; for (const [c, w] of cols) { x -= w; if (x <= 0) return c } return cols[0][0] }
  const m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), col = new T.Color()
  for (let i = 0; i < 230; i++) {
    const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * 0.42
    const h = 0.26 * (1 - (rr / 0.42) ** 2) + Math.random() * 0.03
    const g = grain.clone()
    e.set(Math.random() * 3, Math.random() * 3, Math.random() * 3)
    m4.compose(new T.Vector3(Math.cos(a) * rr, h, Math.sin(a) * rr), q.setFromEuler(e), new T.Vector3(0.045, 0.026, 0.026))
    g.applyMatrix4(m4)
    col.setHex(pick())
    const c = new Float32Array(g.attributes.position.count * 3)
    for (let k = 0; k < c.length; k += 3) { c[k] = col.r; c[k + 1] = col.g; c[k + 2] = col.b }
    g.setAttribute("color", new T.BufferAttribute(c, 3))
    parts.push(g)
  }
  const core = new T.SphereGeometry(0.4, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2).toNonIndexed()   // grains are non-indexed too
  core.scale(1, 0.55, 1)
  const cc = new Float32Array(core.attributes.position.count * 3)
  col.setHex(0xb96a2b)
  for (let k = 0; k < cc.length; k += 3) { cc[k] = col.r; cc[k + 1] = col.g; cc[k + 2] = col.b }
  core.setAttribute("color", new T.BufferAttribute(cc, 3))
  core.deleteAttribute("uv")
  for (const p of parts) p.deleteAttribute("uv")
  riceGeo = T.mergeGeometries([core, ...parts])
  return riceGeo
}
let riceMaterial = null
function riceMesh() {
  riceMaterial = riceMaterial || new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, vertexColors: true })
  const m = new T.Mesh(rice(), riceMaterial)
  m.castShadow = true
  return m
}

function kerupuk(r = 0.15) {
  const g = new T.CylinderGeometry(r, r, 0.012, 12)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, p.getY(i) + Math.sin(x * 40) * 0.008 + Math.cos(z * 37) * 0.008) }
  g.computeVertexNormals()
  return mesh(g, mat(0xf3e2b3, { rough: 0.7 }))
}


// ---- steak: an irregular rounded slab; its look moves from raw to grilled to burnt -----------------------------
let steakGeo = null
function steakGeometry() {
  if (steakGeo) return steakGeo
  const sh = new T.Shape()
  const pts = 14
  for (let i = 0; i <= pts; i++) {
    const a = (i / pts) * Math.PI * 2
    const r = 1 + 0.13 * Math.sin(a * 2 + 0.6) + 0.07 * Math.sin(a * 3 + 1.3)
    const x = Math.cos(a) * 0.17 * r * 1.25, y = Math.sin(a) * 0.17 * r
    if (i === 0) sh.moveTo(x, y); else sh.lineTo(x, y)
  }
  const g = new T.ExtrudeGeometry(sh, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.022, bevelSize: 0.022, bevelSegments: 3, curveSegments: 4 })
  g.rotateX(-Math.PI / 2)
  g.computeVertexNormals()
  // planar UVs from the top so the grill stripes lie across the steak
  const pos = g.attributes.position, uv = g.attributes.uv
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) * 2.2 + 0.5, pos.getZ(i) * 2.2 + 0.5)
  steakGeo = g
  return g
}
const steakTex = {}
function steakMat(kind) {
  if (steakTex[kind]) return steakTex[kind]
  const map = canvasTex(256, 256, (g, w, h) => {
    if (kind === "raw") {
      g.fillStyle = "#b8343a"; g.fillRect(0, 0, w, h)
      g.strokeStyle = "rgba(255,235,225,.75)"; g.lineCap = "round"
      for (let i = 0; i < 14; i++) { g.lineWidth = 2 + Math.random() * 5; g.beginPath(); let x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (Math.random() - 0.5) * 60; y += (Math.random() - 0.5) * 60; g.lineTo(x, y) } g.stroke() }
    } else if (kind === "cooked") {
      const gr = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.6); gr.addColorStop(0, "#9a5228"); gr.addColorStop(1, "#6b3416")
      g.fillStyle = gr; g.fillRect(0, 0, w, h)
      for (let i = 0; i < 1800; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? "60,25,8" : "190,120,60"},${Math.random() * 0.35})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2) }
      g.strokeStyle = "rgba(30,12,4,.85)"; g.lineWidth = 9
      for (let i = -2; i < 7; i++) { g.beginPath(); g.moveTo(i * 44, 0); g.lineTo(i * 44 + 120, h); g.stroke() }
    } else {
      g.fillStyle = "#1c1410"; g.fillRect(0, 0, w, h)
      for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(80,60,50,${Math.random() * 0.4})`; g.fillRect(Math.random() * w, Math.random() * h, 3, 3) }
    }
  })
  steakTex[kind] = new T.MeshStandardMaterial({ map, roughness: kind === "raw" ? 0.45 : 0.55, color: 0xffffff })
  return steakTex[kind]
}
export function steakMesh(kind = "cooked") {
  const m = new T.Mesh(steakGeometry(), steakMat(kind))
  m.castShadow = true; m.receiveShadow = true
  m.userData.steak = true
  return m
}
export const steakLook = (m, kind) => { m.material = steakMat(kind) }

function beans(n = 6) {
  const g = new T.Group()
  const green = mat(0x3f9a3a, { rough: 0.5 })
  for (let i = 0; i < n; i++) {
    const b = new T.Mesh(new T.CapsuleGeometry(0.012, 0.13, 4, 8), green)
    b.rotation.set(Math.PI / 2, 0, (i - n / 2) * 0.12 + 0.4)
    b.position.set((i - n / 2) * 0.018, 0.015 + (i % 2) * 0.012, 0)
    b.castShadow = true
    g.add(b)
  }
  return g
}
function cherryTomatoes(n = 3) {
  const g = new T.Group()
  const red = mat(0xe0352b, { rough: 0.25 }), inside = mat(0xf6b19a, { rough: 0.6 })
  for (let i = 0; i < n; i++) {
    const t = new T.Mesh(new T.SphereGeometry(0.032, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), red)
    const cut = new T.Mesh(new T.CircleGeometry(0.03, 14), inside); cut.rotation.x = -Math.PI / 2; cut.position.y = 0.001
    const h = new T.Group(); h.add(t, cut); h.rotation.x = Math.PI; h.position.set(i * 0.05 - 0.05, 0.032, (i % 2) * 0.03)
    h.rotation.z = 0.3 * i
    t.castShadow = true
    g.add(h)
  }
  return g
}
function wedge() {
  const m = new T.Mesh(new T.CylinderGeometry(0.04, 0.04, 0.12, 3, 1), mat(0xe9b24a, { rough: 0.5 }))
  m.rotation.set(Math.PI / 2, 0, 0.3)
  m.castShadow = true
  return m
}
function sauceBlob() {
  const m = new T.Mesh(new T.SphereGeometry(0.11, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x4a2210, { rough: 0.12 }))
  m.scale.set(1.25, 0.18, 0.9)
  return m
}

// A served dish (what lands on a plate spot / flies to a customer). ~0.35 units wide.
export function dishModel(dish, tops = []) {
  const g = new T.Group()
  if (dish === "steak") {
    const plate = prop("plate", FOOD * 1.05); g.add(plate)
    const st = steakMesh("cooked"); st.position.set(-0.02, 0.035, 0); st.scale.setScalar(0.85); g.add(st)
    const w1 = wedge(); w1.position.set(0.1, 0.05, 0.08); g.add(w1)
    if (tops.includes("saus")) { const sb = sauceBlob(); sb.position.set(-0.02, 0.085, 0); g.add(sb) }
    if (tops.includes("buncis")) { const b = beans(6); b.position.set(-0.08, 0.035, 0.1); g.add(b) }
    if (tops.includes("tomat")) { const t = cherryTomatoes(3); t.position.set(0.1, 0.035, -0.09); g.add(t) }
  } else if (dish === "jusjeruk" || dish === "jusanggur") {
    const glass = cyl(0.055, 0.045, 0.24, mat(0xe8f6ff, { rough: 0.04, opacity: 0.32 }), 18); glass.position.y = 0.12
    const liq = cyl(0.05, 0.041, 0.19, mat(dish === "jusjeruk" ? 0xf7931e : 0x7a1f4f, { rough: 0.08, opacity: 0.9 }), 18); liq.position.y = 0.1
    g.add(liq, glass)
    if (dish === "jusjeruk") { const l = prop("orange", FOOD * 0.55); l.position.set(0.05, 0.22, 0); g.add(l) }
    else { const gr = sph(0.022, mat(0x5a1a6a, { rough: 0.3 })); gr.position.set(0.045, 0.235, 0); g.add(gr) }
    const straw = cyl(0.007, 0.007, 0.28, mat(dish === "jusjeruk" ? 0x34a853 : 0xe94f64), 6); straw.position.set(-0.015, 0.22, 0); straw.rotation.z = 0.2; g.add(straw)
  } else if (dish === "nasgor") {
    const plate = prop("plate", FOOD * 1.05); g.add(plate)
    const r = riceMesh(); r.scale.setScalar(0.42); r.position.y = 0.02; g.add(r)
    if (tops.includes("telur")) { const e = prop("egg-cooked", FOOD * 0.62); e.position.set(0.02, 0.135, 0.01); e.rotation.x = -0.25; g.add(e) }
    if (tops.includes("kerupuk")) for (let i = 0; i < 2; i++) { const k = kerupuk(0.07); k.position.set(-0.11 + i * 0.03, 0.07 + i * 0.02, 0.07); k.rotation.set(0.9, 0, 0.3 * i); g.add(k) }
  } else if (dish === "esteh" || dish === "esjeruk") {
    const glass = cyl(0.065, 0.055, 0.2, mat(0xdff3ff, { rough: 0.05, opacity: 0.35 }), 18)
    glass.position.y = 0.1
    const liq = cyl(0.058, 0.05, 0.16, mat(dish === "esteh" ? 0x8a3b12 : 0xf59a1b, { rough: 0.1, opacity: 0.85 }), 18)
    liq.position.y = 0.085
    g.add(liq, glass)
    for (let i = 0; i < 3; i++) { const ice = box(0.04, 0.04, 0.04, mat(0xffffff, { rough: 0.05, opacity: 0.6 })); ice.position.set(-0.02 + i * 0.02, 0.15 + (i % 2) * 0.015, (i - 1) * 0.015); ice.rotation.set(i, i * 2, 0); g.add(ice) }
    if (dish === "esjeruk") { const l = prop("lemon-half", FOOD * 0.6); l.position.set(0.06, 0.18, 0); l.rotation.z = 1.2; g.add(l) }
    const straw = cyl(0.008, 0.008, 0.26, mat(dish === "esteh" ? 0xe94f64 : 0x34a853), 6); straw.position.set(0.02, 0.2, 0); straw.rotation.z = -0.25; g.add(straw)
  } else if (dish === "sate") {
    const plate = prop("plate-rectangle", FOOD * 0.9) || prop("plate", FOOD); g.add(plate.children.length ? plate : prop("plate", FOOD))
    for (let i = 0; i < 3; i++) { const s = prop("skewer", FOOD * 0.95); s.position.set(0, 0.03, -0.06 + i * 0.06); g.add(s) }
    if (tops.includes("kacang")) { const k = mesh(new T.SphereGeometry(0.08, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x7b4a1e, { rough: 0.35 })); k.scale.set(1.3, 0.35, 1); k.position.set(0.02, 0.05, 0); g.add(k) }
  } else if (dish === "bakso") {
    const bowl = prop("bowl-broth", FOOD * 0.85); g.add(bowl)
    for (let i = 0; i < 3; i++) { const b = sph(0.045, mat(0x8a6040, { rough: 0.8 }), 12, 10); b.position.set(Math.cos(i * 2.1) * 0.05, 0.085, Math.sin(i * 2.1) * 0.05); g.add(b) }
    const leaf = box(0.06, 0.004, 0.03, mat(0x4f9a3a)); leaf.position.set(0, 0.092, 0.05); g.add(leaf)
  } else if (dish === "telur") {
    const e = prop("egg-cooked", FOOD * 0.62); g.add(e)
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true })
  return g
}

// ---- stations ----------------------------------------------------------------------------------------------
// Each returns {group, food (shown while cooking/ready), fx: [x,y,z] emitter point, ...}
const steel = () => mat(0xb9bec4, { rough: 0.28, metal: 0.9 })
const iron = () => mat(0x2a2b2f, { rough: 0.38, metal: 0.85 })

function burner() {
  const g = new T.Group()
  const base = cyl(0.22, 0.24, 0.1, mat(0x3b3d42, { rough: 0.5, metal: 0.6 }), 22); base.position.y = 0.05
  const ring = mesh(new T.TorusGeometry(0.16, 0.02, 8, 24), iron()); ring.rotation.x = Math.PI / 2; ring.position.y = 0.11
  g.add(base, ring)
  for (let i = 0; i < 3; i++) { const leg = box(0.03, 0.06, 0.12, iron()); leg.position.set(Math.cos(i * 2.09) * 0.17, 0.13, Math.sin(i * 2.09) * 0.17); leg.rotation.y = -i * 2.09; g.add(leg) }
  return g
}

export function stationModel(kind) {
  const g = new T.Group()
  const res = { group: g, food: null, fx: [0, 0.3, 0] }
  if (kind === "wok") {
    g.add(burner())
    const prof = []
    for (let i = 0; i <= 12; i++) { const a = (i / 12) * Math.PI * 0.45; prof.push(new T.Vector2(Math.sin(a) * 0.42 + 0.001, (1 - Math.cos(a)) * 0.42)) }
    const wok = mesh(new T.LatheGeometry(prof, 32), mat(0x26262a, { rough: 0.32, metal: 0.9, side: T.DoubleSide }))
    wok.position.y = 0.14
    const handle = cyl(0.025, 0.025, 0.3, mat(0x3a2a1c, { rough: 0.7 }), 8); handle.rotation.x = Math.PI / 2; handle.position.set(0, 0.3, 0.55)
    const pan = new T.Group(); pan.add(wok, handle)
    g.add(pan)
    const food = riceMesh(); food.scale.set(0.62, 0.5, 0.62); food.position.y = 0.16
    pan.add(food)
    res.food = food; res.pan = pan; res.fx = [0, 0.32, 0]; res.fire = [0, 0.12, 0]
  } else if (kind === "eggpan") {
    g.add(burner())
    const pan = new T.Group()
    const p = cyl(0.21, 0.18, 0.05, mat(0x2b2c30, { rough: 0.35, metal: 0.8 }), 26); p.position.y = 0.16
    const h = cyl(0.02, 0.02, 0.24, mat(0x111111, { rough: 0.6 }), 8); h.rotation.x = Math.PI / 2; h.position.set(0, 0.18, 0.32)
    pan.add(p, h)
    const egg = prop("egg-cooked", FOOD * 0.85); egg.position.y = 0.19
    pan.add(egg)
    g.add(pan)
    res.food = egg; res.pan = pan; res.fx = [0, 0.26, 0]; res.fire = [0, 0.12, 0]
  } else if (kind === "cooler") {
    const blue = mat(0x2c6fc4, { rough: 0.35 }), white = mat(0xf2f2ee, { rough: 0.4 })
    const body = cyl(0.17, 0.17, 0.4, blue, 26); body.position.set(0, 0.36, -0.08)
    const lid = cyl(0.18, 0.18, 0.07, white, 26); lid.position.set(0, 0.59, -0.08)
    const knob = cyl(0.05, 0.05, 0.04, mat(0xd8433b, { rough: 0.4 }), 12); knob.position.set(0, 0.64, -0.08)
    const band = cyl(0.172, 0.172, 0.05, white, 26); band.position.set(0, 0.3, -0.08)
    const stand = box(0.36, 0.16, 0.36, mat(0x9a6b3e, { rough: 0.8 }), 0.02); stand.position.set(0, 0.08, -0.08)
    const tap = box(0.05, 0.05, 0.1, mat(0xd8433b, { rough: 0.4 })); tap.position.set(0, 0.22, 0.1)
    g.add(body, lid, knob, band, stand, tap)
    const glass = dishModel("esteh"); glass.position.set(0, 0, 0.17); glass.scale.setScalar(1.15)
    g.add(glass)
    res.fx = [0, 0.7, 0]; res.food = glass; res.cup = glass
  } else if (kind === "juicer") {
    const base = box(0.4, 0.08, 0.36, mat(0xe8a33d, { rough: 0.6 }), 0.02); base.position.y = 0.04
    const press = cyl(0.11, 0.14, 0.22, mat(0xb9bec4, { rough: 0.28, metal: 0.9 }), 18); press.position.set(0, 0.32, -0.08)
    const arm = box(0.04, 0.3, 0.04, mat(0xb9bec4, { rough: 0.28, metal: 0.9 })); arm.position.set(0, 0.24, -0.14)
    const lever = cyl(0.02, 0.02, 0.3, mat(0x333333), 8); lever.position.set(0, 0.48, -0.02); lever.rotation.x = 1.0
    g.add(base, press, arm, lever)
    for (let i = 0; i < 4; i++) { const o = prop("orange", FOOD * 0.85); o.position.set(-0.15 + (i % 2) * 0.3, 0.08, -0.12 + Math.floor(i / 2) * 0.05); g.add(o) }
    const glass = dishModel("esjeruk"); glass.position.set(0, 0.08, 0.1); glass.scale.setScalar(1.1); g.add(glass)
    res.fx = [0, 0.6, 0]; res.food = glass; res.cup = glass
  } else if (kind === "kaleng") {
    const tin = mat(0xc9ccd1, { rough: 0.3, metal: 0.85 })
    const body = box(0.36, 0.38, 0.34, tin); body.position.y = 0.19
    const win = box(0.26, 0.24, 0.01, mat(0xdff3ff, { rough: 0.05, opacity: 0.35 })); win.position.set(0, 0.19, 0.175)
    const lid = cyl(0.11, 0.11, 0.05, mat(0x2b62c9, { rough: 0.35 }), 24); lid.position.y = 0.41
    g.add(body, win, lid)
    for (let i = 0; i < 9; i++) { const k = kerupuk(0.05); k.position.set(-0.08 + (i % 3) * 0.08, 0.08 + Math.floor(i / 3) * 0.08, 0.1); k.rotation.set(1.3, 0, i); g.add(k) }
    for (let i = 0; i < 3; i++) { const k = kerupuk(0.07); k.position.set(-0.08 + i * 0.08, 0.43 + i * 0.01, 0.02); k.rotation.set(0.3, 0, i); g.add(k) }
    res.fx = [0, 0.5, 0]
  } else if (kind === "kacang") {
    const bowl = prop("bowl", FOOD * 1.2); g.add(bowl)
    const sauce = mesh(new T.CylinderGeometry(0.14, 0.14, 0.02, 22), mat(0x7b4a1e, { rough: 0.3 })); sauce.position.y = 0.08
    const spoon = prop("utensil-spoon", FOOD * 0.9); spoon.position.set(0.06, 0.1, 0); spoon.rotation.z = 0.5
    g.add(sauce, spoon)
    res.fx = [0, 0.25, 0]
  } else if (kind === "ricebin") {
    // bakul: a woven bamboo rice basket, heaped with white rice and a paddle
    const weave = mat(0xc49a5c, { rough: 0.9, side: T.DoubleSide })
    const b = cyl(0.24, 0.18, 0.18, weave, 22, true); b.position.y = 0.09
    const bottom = cyl(0.18, 0.18, 0.02, weave, 22); bottom.position.y = 0.01
    const rim = mesh(new T.TorusGeometry(0.24, 0.022, 6, 26), mat(0x8a5a2a, { rough: 0.8 })); rim.rotation.x = Math.PI / 2; rim.position.y = 0.18
    for (let i = 0; i < 5; i++) { const band = mesh(new T.TorusGeometry(0.19 + i * 0.012, 0.006, 4, 22), mat(0x9a6b3e, { rough: 0.9 })); band.rotation.x = Math.PI / 2; band.position.y = 0.03 + i * 0.033; g.add(band) }
    const rice = mesh(new T.SphereGeometry(0.23, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xfbf8f0, { rough: 0.95 })); rice.scale.y = 0.5; rice.position.y = 0.16
    const grains = riceMesh(); grains.scale.set(0.5, 0.25, 0.5); grains.position.y = 0.2
    grains.material = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 })
    const paddle = box(0.07, 0.015, 0.24, mat(0xe8dcc0, { rough: 0.6 }), 0.005); paddle.position.set(0.07, 0.3, 0.02); paddle.rotation.set(0.6, 0.4, 0)
    g.add(b, bottom, rim, rice, grains, paddle)
    res.fx = [0, 0.3, 0]
  } else if (kind === "eggbasket") {
    const weave = mat(0xb07a3e, { rough: 0.9 })
    const b = cyl(0.23, 0.18, 0.13, weave, 20, true); b.position.y = 0.065; b.material = mat(0xb07a3e, { rough: 0.9, side: T.DoubleSide })
    const bottom = cyl(0.18, 0.18, 0.02, weave, 20); bottom.position.y = 0.01
    const rim = mesh(new T.TorusGeometry(0.23, 0.018, 6, 24), mat(0x8a5a2a, { rough: 0.8 })); rim.rotation.x = Math.PI / 2; rim.position.y = 0.13
    g.add(b, bottom, rim)
    for (let i = 0; i < 7; i++) { const e = prop("egg", FOOD * 1.1); const a = i * 0.9; e.position.set(Math.cos(a) * 0.1 * (i ? 1 : 0), 0.04 + (i ? 0 : 0.04), Math.sin(a) * 0.1 * (i ? 1 : 0)); e.rotation.z = (i % 3) * 0.3; g.add(e) }
    res.fx = [0, 0.25, 0]
  } else if (kind === "satetray") {
    const tray = box(0.5, 0.04, 0.34, mat(0xdfe3e7, { rough: 0.3, metal: 0.8 }), 0.012); tray.position.y = 0.02
    g.add(tray)
    const meat = mat(0xe58a8a, { rough: 0.6 }), stick = mat(0xd9c49a, { rough: 0.8 })
    for (let i = 0; i < 6; i++) {
      const z = -0.12 + i * 0.048
      const st = cyl(0.006, 0.006, 0.44, stick, 5); st.rotation.z = Math.PI / 2; st.position.set(0, 0.06, z); g.add(st)
      for (let k = 0; k < 4; k++) { const m = box(0.045, 0.035, 0.035, meat, 0.008); m.position.set(-0.1 + k * 0.055, 0.06, z); g.add(m) }
    }
    res.fx = [0, 0.2, 0]
  } else if (kind === "trash") {
    const green = mat(0x2f8f5b, { rough: 0.45 })
    const bin = cyl(0.17, 0.14, 0.36, green, 20); bin.position.y = 0.18
    const lid = cyl(0.185, 0.185, 0.04, mat(0x256f47, { rough: 0.4 }), 20); lid.position.set(0, 0.38, -0.02); lid.rotation.x = -0.35
    const rim = mesh(new T.TorusGeometry(0.17, 0.015, 6, 20), mat(0x256f47, { rough: 0.4 })); rim.rotation.x = Math.PI / 2; rim.position.y = 0.36
    const mark = mesh(new T.CircleGeometry(0.07, 3), mat(0xffffff, { rough: 0.6 })); mark.position.set(0, 0.2, 0.172)
    g.add(bin, lid, rim, mark)
    res.fx = [0, 0.5, 0]
  } else if (kind === "grill" || kind === "grillslot") {
    const trough = box(0.46, 0.14, 0.32, mat(0x2a2b2f, { rough: 0.45, metal: 0.8 }), 0.02); trough.position.y = 0.07
    g.add(trough)
    const coalMat = mat(0x1a0d06, { rough: 0.9, emissive: 0xff5a1a, ei: 1.4 })
    const coals = new T.InstancedMesh(new T.DodecahedronGeometry(0.035, 0), coalMat, 16)
    const m4 = new T.Matrix4()
    for (let i = 0; i < 16; i++) { m4.makeRotationFromEuler(new T.Euler(i, i * 2, i * 3)); m4.setPosition(-0.18 + (i % 8) * 0.052, 0.14, -0.07 + Math.floor(i / 8) * 0.13); coals.setMatrixAt(i, m4) }
    g.add(coals)
    for (let i = 0; i < 6; i++) { const bar = cyl(0.006, 0.006, 0.44, mat(0x9aa0a6, { metal: 0.9, rough: 0.3 }), 4); bar.rotation.z = Math.PI / 2; bar.position.set(0, 0.165, -0.125 + i * 0.05); g.add(bar) }
    const food = new T.Group()
    for (let i = 0; i < 3; i++) { const sk = prop("skewer", FOOD * 0.8); sk.position.set(0, 0.17, -0.08 + i * 0.08); food.add(sk) }
    g.add(food)
    res.food = food; res.coals = coalMat; res.fx = [0, 0.25, 0]; res.fire = [0, 0.15, 0]
  } else if (kind === "steakslot") {
    // one cell of the big grill: dark grate + bars; the steak changes look as it cooks
    const grate = box(0.56, 0.05, 0.5, mat(0x2a2a2e, { rough: 0.5, metal: 0.7 }), 0.01); grate.position.y = 0.025
    g.add(grate)
    for (let i = 0; i < 7; i++) { const bar = box(0.5, 0.018, 0.022, mat(0x55575c, { rough: 0.35, metal: 0.9 })); bar.position.set(0, 0.06, -0.2 + i * 0.066); g.add(bar) }
    const st = steakMesh("raw"); st.position.y = 0.075; st.scale.setScalar(1.1)
    g.add(st)
    res.food = st; res.steak = st; res.fx = [0, 0.2, 0]; res.fire = [0, 0.06, 0]
  } else if (kind === "fridge") {
    // red chiller drawer in front of the grill, glass lid, raw steaks inside
    const red = mat(0xcf2a2a, { rough: 0.28, metal: 0.15 }), chrome = mat(0xd9dde2, { rough: 0.15, metal: 1 })
    const body = box(1.3, 0.16, 0.5, red, 0.03); body.position.y = 0.08
    const tray = box(1.18, 0.02, 0.4, mat(0xf2f2f2, { rough: 0.4 })); tray.position.y = 0.165
    const handle = box(0.5, 0.025, 0.03, chrome, 0.01); handle.position.set(0, 0.09, 0.27)
    g.add(body, tray, handle)
    for (let i = 0; i < 4; i++) { const st = steakMesh("raw"); st.position.set(-0.42 + i * 0.28, 0.17, (i % 2) * 0.06 - 0.03); st.rotation.y = i * 0.7; st.scale.setScalar(0.85); g.add(st) }
    const lid = box(1.2, 0.012, 0.42, mat(0xe8f6ff, { rough: 0.04, opacity: 0.25 })); lid.position.y = 0.235
    g.add(lid)
    res.fx = [0, 0.3, 0]
  } else if (kind === "saucepan") {
    const pan = cyl(0.17, 0.15, 0.12, mat(0xf3c623, { rough: 0.3, metal: 0.2 }), 24, true); pan.position.y = 0.06
    pan.material = mat(0xf3c623, { rough: 0.3, metal: 0.2, side: T.DoubleSide })
    const bottom = cyl(0.15, 0.15, 0.01, mat(0xf3c623, { rough: 0.3 }), 24); bottom.position.y = 0.005
    const sauce = cyl(0.16, 0.16, 0.01, mat(0x4a2210, { rough: 0.1 }), 24); sauce.position.y = 0.1
    const handle = box(0.04, 0.03, 0.22, mat(0x222222, { rough: 0.5 })); handle.position.set(0, 0.1, 0.27)
    const ladle = cyl(0.008, 0.008, 0.3, mat(0xd9dde2, { rough: 0.2, metal: 1 }), 6); ladle.position.set(0.06, 0.2, -0.02); ladle.rotation.set(0.5, 0, -0.4)
    g.add(pan, bottom, sauce, handle, ladle)
    res.fx = [0, 0.25, 0]
  } else if (kind === "beantray" || kind === "tomatotray") {
    const ceramic = mat(kind === "beantray" ? 0x2f5d9c : 0x3c7a8a, { rough: 0.25 })
    const dish = box(0.44, 0.08, 0.34, ceramic, 0.035); dish.position.y = 0.04
    const inner = box(0.38, 0.02, 0.28, mat(0xf4efe6, { rough: 0.3 }), 0.01); inner.position.y = 0.075
    g.add(dish, inner)
    if (kind === "beantray") for (let i = 0; i < 9; i++) { const b = beans(8); b.position.set(-0.13 + (i % 3) * 0.13, 0.08 + Math.floor(i / 3) * 0.012, -0.08 + Math.floor(i / 3) * 0.08); b.rotation.y = i * 0.7; g.add(b) }
    else for (let i = 0; i < 6; i++) { const t = cherryTomatoes(3); t.position.set(-0.12 + (i % 3) * 0.12, 0.08, -0.07 + Math.floor(i / 3) * 0.12); t.rotation.y = i; g.add(t) }
    res.fx = [0, 0.2, 0]
  } else if (kind === "juice-orange" || kind === "juice-grape") {
    // red juice machine: glass tank on top, chrome tap, the glass sits under the tap
    const red = mat(0xd02b2b, { rough: 0.25, metal: 0.15 }), chrome = mat(0xdfe3e8, { rough: 0.12, metal: 1 })
    const base = box(0.62, 0.14, 0.5, red, 0.04); base.position.set(0, 0.07, -0.02)
    const tower = box(0.62, 0.5, 0.3, red, 0.05); tower.position.set(0, 0.39, -0.12)
    const tank = cyl(0.2, 0.2, 0.42, mat(0xe8f6ff, { rough: 0.03, opacity: 0.14 }), 24); tank.position.set(0, 0.86, -0.1)
    tank.renderOrder = 2
    const juice = cyl(0.185, 0.185, 0.32, mat(kind === "juice-orange" ? 0xf7931e : 0x8a2257, { rough: 0.15 }), 24); juice.position.set(0, 0.82, -0.1)
    const lid = cyl(0.21, 0.21, 0.05, red, 24); lid.position.set(0, 1.09, -0.1)
    const tap = box(0.08, 0.06, 0.12, chrome, 0.015); tap.position.set(0, 0.5, 0.06)
    const drip = box(0.3, 0.02, 0.2, chrome, 0.01); drip.position.set(0, 0.15, 0.12)
    const label = mesh(new T.CircleGeometry(0.09, 20), mat(kind === "juice-orange" ? 0xffb347 : 0xa04a8c, { rough: 0.4 })); label.position.set(0, 0.42, 0.031)
    g.add(base, tower, tank, juice, lid, tap, drip, label)
    const glass = dishModel(kind === "juice-orange" ? "jusjeruk" : "jusanggur"); glass.position.set(0, 0.16, 0.12); glass.scale.setScalar(1.15)
    g.add(glass)
    res.fx = [0, 1.15, 0]; res.food = glass; res.cup = glass
  } else if (kind === "recycle") {
    const green = mat(0x2c9a52, { rough: 0.35 })
    const bin = box(0.42, 0.62, 0.4, green, 0.05); bin.position.y = 0.31
    const lid = box(0.46, 0.06, 0.44, mat(0x23804a, { rough: 0.3 }), 0.025); lid.position.y = 0.64
    const hole = box(0.24, 0.02, 0.12, mat(0x123f24, { rough: 0.8 })); hole.position.set(0, 0.675, 0.04)
    const sym = mesh(new T.RingGeometry(0.06, 0.09, 3), mat(0xffffff, { rough: 0.5 })); sym.position.set(0, 0.33, 0.201)
    g.add(bin, lid, hole, sym)
    res.fx = [0, 0.7, 0]
  } else if (kind === "pot") {
    g.add(burner())
    const p = cyl(0.3, 0.27, 0.42, mat(0xc5c9ce, { rough: 0.22, metal: 0.95, side: T.DoubleSide }), 30, true); p.position.y = 0.33
    const bottom = cyl(0.27, 0.27, 0.02, steel(), 30); bottom.position.y = 0.13
    const broth = cyl(0.285, 0.285, 0.01, mat(0xc79a5b, { rough: 0.15, opacity: 0.92 }), 30); broth.position.y = 0.48
    for (const x of [-0.32, 0.32]) { const h = mesh(new T.TorusGeometry(0.05, 0.015, 6, 12, Math.PI), steel()); h.position.set(x, 0.5, 0); h.rotation.set(0, Math.PI / 2, x < 0 ? Math.PI / 2 : -Math.PI / 2); g.add(h) }
    g.add(p, bottom, broth)
    const balls = []
    for (let i = 0; i < 4; i++) { const b = sph(0.06, mat(0x8a6040, { rough: 0.8 }), 12, 10); b.position.set(Math.cos(i * 1.6) * 0.14, 0.5, Math.sin(i * 1.6) * 0.14); g.add(b); balls.push(b) }
    res.balls = balls; res.broth = broth; res.fx = [0, 0.55, 0]; res.fire = [0, 0.12, 0]
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true } })
  // counter pieces are drawn big so they're easy to tap (fx/fire points are local, so they scale along)
  g.scale.setScalar({ wok: 0.95, eggpan: 1.1, pot: 1.05, trash: 1.1, steakslot: 1, fridge: 1, "juice-orange": 1, "juice-grape": 1, recycle: 1, saucepan: 1.2, beantray: 1.15, tomatotray: 1.15 }[kind] ?? 1.35)
  return res
}

// ---- Oyen the cat: blocky orange tabby to match the characters, animated in code ---------------------------
export function catModel() {
  const g = new T.Group()
  const fur = mat(0xf08a2c, { rough: 0.85 }), stripe = mat(0xc4611a, { rough: 0.85 }), white = mat(0xfff4e6, { rough: 0.85 })
  const body = box(0.24, 0.2, 0.42, fur, 0.05); body.position.y = 0.24
  for (let i = 0; i < 3; i++) { const s = box(0.245, 0.04, 0.05, stripe); s.position.set(0, 0.33, -0.1 + i * 0.1); g.add(s) }
  const head = new T.Group(); head.position.set(0, 0.38, 0.24)
  const hb = box(0.26, 0.22, 0.22, fur, 0.05)
  const muzzle = box(0.14, 0.08, 0.06, white, 0.02); muzzle.position.set(0, -0.05, 0.11)
  const nose = box(0.04, 0.03, 0.02, mat(0xe56b8a)); nose.position.set(0, -0.02, 0.145)
  const eyeM = mat(0x1a1a1a, { rough: 0.2, emissive: 0x6dff8f, ei: 0.25 })
  for (const x of [-0.06, 0.06]) { const e = box(0.04, 0.05, 0.02, eyeM); e.position.set(x, 0.03, 0.115); head.add(e) }
  for (const x of [-0.08, 0.08]) { const ear = mesh(new T.ConeGeometry(0.05, 0.1, 4), fur); ear.position.set(x, 0.14, 0); ear.rotation.y = Math.PI / 4; head.add(ear) }
  head.add(hb, muzzle, nose)
  const legs = []
  for (const [x, z] of [[-0.08, 0.13], [0.08, 0.13], [-0.08, -0.13], [0.08, -0.13]]) {
    const l = new T.Group(); l.position.set(x, 0.16, z)
    const lm = box(0.07, 0.16, 0.07, fur, 0.02); lm.position.y = -0.08
    const paw = box(0.075, 0.03, 0.08, white); paw.position.set(0, -0.15, 0.01)
    l.add(lm, paw); g.add(l); legs.push(l)
  }
  const tail = new T.Group(); tail.position.set(0, 0.3, -0.21)
  let parent = tail
  const segs = []
  for (let i = 0; i < 5; i++) { const s = new T.Group(); s.position.set(0, i ? 0.07 : 0, 0); const sm = box(0.05, 0.08, 0.05, i % 2 ? stripe : fur); sm.position.y = 0.04; s.add(sm); parent.add(s); parent = s; segs.push(s) }
  tail.rotation.x = -0.6
  g.add(body, head, tail)
  g.traverse((o) => { if (o.isMesh) o.castShadow = true })
  g.scale.setScalar(1.25)
  let ph = 0
  return {
    group: g,
    update(dt, moving, alarmed) {
      ph += dt * (moving ? 11 : 2)
      const sw = moving ? 0.6 : 0
      legs.forEach((l, i) => { l.rotation.x = Math.sin(ph + (i === 0 || i === 3 ? 0 : Math.PI)) * sw })
      segs.forEach((s, i) => { s.rotation.z = Math.sin(ph * 0.5 + i * 0.6) * (alarmed ? 0.05 : 0.22); s.rotation.x = alarmed ? 0.25 : 0.12 })
      head.rotation.y = moving ? 0 : Math.sin(ph * 0.3) * 0.4
      body.position.y = 0.24 + (moving ? Math.abs(Math.sin(ph)) * 0.015 : 0)
    },
  }
}

// Little textures used across the scene.
export function checkerTex(a = "#d8433b", b = "#f7f1e6") {
  return canvasTex(128, 128, (g) => {
    g.fillStyle = b; g.fillRect(0, 0, 128, 128); g.fillStyle = a
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if ((x + y) % 2) g.fillRect(x * 16, y * 16, 16, 16)
    g.globalAlpha = 0.08; noiseFill(g, 128, 128, "rgba(0,0,0,0)", 0.3, 800)
  }, { repeat: [4, 1] })
}
