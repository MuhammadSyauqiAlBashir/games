// Builds web/cook/m/people-<V>.glb: 12 human-proportioned Quaternius characters (CC0, from poly.pizza) that share one
// rig ("CharacterArmature"), simplified for phones, with ONE shared set of the few animations the game uses.
// Run (Node 22, in ~/work/cook-tools): node build_people.mjs ~/work/people ~/bashgames/web/cook/m
import { NodeIO, Document } from "@gltf-transform/core"
import { ALL_EXTENSIONS } from "@gltf-transform/extensions"
import { dedup, prune, quantize, weld, mergeDocuments, unpartition, simplify } from "@gltf-transform/functions"
import { MeshoptSimplifier, MeshoptDecoder } from "meshoptimizer"
import path from "node:path"
import fs from "node:fs"

export const V = "v1"
const [SRC, OUT] = process.argv.slice(2)
// key used by the game → poly.pizza model id
export const PEOPLE = {
  "q-blonde": "qJ2gsTUBHL", "s-suitw": "sOUciDsoVV", "n-dress": "nIItLV9nxS", "d-punk": "djXoqejw6w", "o-woman": "oAArCNHjFB",
  "k-casual": "kZ3DmIoGip", "g-purple": "gKLBoRsyKe", "j-suit": "JFrLIKqvCH", "b-beach": "DojKLcO34E", "f-farmer": "7pn3R6hPvE",
  "h-beard": "5EGWBMpuXq", "w-worker": "Yg2bQZO6Hj",
}
const CLIPS = { "CharacterArmature|Idle": "idle", "CharacterArmature|Walk": "walk", "CharacterArmature|Wave": "wave",
  "CharacterArmature|Interact": "interact", "CharacterArmature|HitRecieve": "hit", "CharacterArmature|Run": "run" }

await MeshoptSimplifier.ready
await MeshoptDecoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder })

const target = new Document()
target.createBuffer()
let first = true
for (const [key, id] of Object.entries(PEOPLE)) {
  const doc = await io.read(path.join(SRC, `${id}.glb`))
  const root = doc.getRoot()
  for (const a of root.listAnimations()) {
    if (first && CLIPS[a.getName()]) { a.setName(CLIPS[a.getName()]); continue }
    for (const c of a.listChannels()) c.dispose()
    for (const s of a.listSamplers()) { s.getInput()?.dispose(); s.getOutput()?.dispose(); s.dispose() }
    a.dispose()
  }
  const scene = root.getDefaultScene() || root.listScenes()[0]
  const wrap = doc.createNode(key)
  for (const n of scene.listChildren()) { scene.removeChild(n); wrap.addChild(n) }
  scene.addChild(wrap)
  // materials get the model key as a prefix so recolouring one character never touches another
  for (const m of root.listMaterials()) m.setName(`${key}:${m.getName()}`)
  // flat-shaded low-poly: normals are per triangle, so drop them (three.js draws these materials with flatShading)
  // — vertices then weld together and the simplifier can actually reduce the mesh.
  for (const m of root.listMeshes()) for (const p of m.listPrimitives()) p.setAttribute("NORMAL", null)
  await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: 0.7, error: 0.002, lockBorder: true }))
  mergeDocuments(target, doc)
  first = false
}
const root = target.getRoot()
const scenes = root.listScenes()
for (const s of scenes.slice(1)) { for (const n of s.listChildren()) { s.removeChild(n); scenes[0].addChild(n) } s.dispose() }
root.setDefaultScene(scenes[0])
await target.transform(unpartition(), dedup({ propertyTypes: ["Accessor"] }), prune({ keepLeaves: true }), quantize())
fs.mkdirSync(OUT, { recursive: true })
const out = path.join(OUT, `people-${V}.glb`)
await io.write(out, target)
console.log(path.basename(out), Math.round(fs.statSync(out).size / 1024) + " KB")
