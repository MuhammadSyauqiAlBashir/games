// Builds the Wok & Roll 3D model packs from Kenney's CC0 kits:
//   web/cook/m/props-<V>.glb  food, kitchen, furniture, market props (one named node per model)
// Meshes are quantized (KHR_mesh_quantization). No meshopt: its decoder needs WebAssembly, which the site's CSP
// (no wasm-unsafe-eval) blocks. ~1.3 MB in total, downloaded once (service-worker asset cache).
//
// Run (needs @gltf-transform/* + meshoptimizer for reading, Node 22; installed in ~/work/cook-tools):
//   cp tools/build_cook_assets.mjs ~/work/cook-tools/ && cd ~/work/cook-tools && node build_cook_assets.mjs ~/work/cook-assets ~/bashgames/web/cook/m
import { NodeIO, Document } from "@gltf-transform/core"
import { ALL_EXTENSIONS } from "@gltf-transform/extensions"
import { dedup, prune, quantize, weld, mergeDocuments, unpartition } from "@gltf-transform/functions"
import { MeshoptEncoder, MeshoptDecoder } from "meshoptimizer"
import path from "node:path"
import fs from "node:fs"

export const V = "v1"
const [SRC, OUT] = process.argv.slice(2)

const FOOD = `plate-dinner plate plate-deep bowl bowl-broth bowl-soup egg-cooked egg frying-pan pot pot-stew pan skewer
meat-cooked meat-raw glass cup-tea cup-coffee mug lemon-half orange onion tomato paprika carrot cabbage leek chopstick
utensil-spoon utensil-fork cooking-spatula cooking-knife cutting-board bottle-oil bottle-ketchup soy shaker-salt
shaker-pepper mortar-pestle barrel bag can carton rice-ball mushroom chinese styrofoam soda-bottle watermelon banana
coconut pineapple plate-broken fish honey pancakes bread loaf sausage meat-sausage`.split(/\s+/)
const FURN = `table tableCloth tableRound chair stoolBar stoolBarSquare bench kitchenBar kitchenBarEnd kitchenCabinet
kitchenCabinetDrawer kitchenStove kitchenSink kitchenFridgeSmall kitchenFridge kitchenBlender kitchenCoffeeMachine
kitchenMicrowave toaster trashcan pottedPlant plantSmall1 plantSmall2 plantSmall3 lampRoundTable lampSquareCeiling
lampWall radio rugRectangle rugDoormat ceilingFan cardboardBoxClosed cardboardBoxOpen speaker televisionVintage
sideTable`.split(/\s+/)
const MARKET = "cash-register display-bread display-fruit freezer shelf-boxes shopping-basket bottle-return".split(" ")
const CHARS = ["female-a", "female-b", "female-c", "female-d", "female-e", "female-f",
  "male-a", "male-b", "male-c", "male-d", "male-e", "male-f"].map((c) => `character-${c}`)
const CLIPS = new Set(["idle", "walk", "sprint", "sit", "pick-up", "emote-yes", "emote-no", "holding-both",
  "interact-right", "jump", "die", "crouch"])

await MeshoptEncoder.ready
await MeshoptDecoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder })

// Load one model; its scene's root nodes are put under one node named after the model.
async function load(file, name) {
  const doc = await io.read(file)
  const root = doc.getRoot()
  const scene = root.getDefaultScene() || root.listScenes()[0]
  const wrap = doc.createNode(name)
  for (const n of scene.listChildren()) { scene.removeChild(n); wrap.addChild(n) }
  scene.addChild(wrap)
  return doc
}

async function pack(list, out, { keepAnims = null } = {}) {
  const target = new Document()
  target.createBuffer()
  let first = true
  for (const [file, name] of list) {
    const doc = await load(file, name)
    for (const a of doc.getRoot().listAnimations()) {
      if (keepAnims && first && CLIPS.has(a.getName())) continue
      // Samplers hold their accessors; dispose them too or prune keeps the keyframe data.
      for (const c of a.listChannels()) c.dispose()
      for (const s of a.listSamplers()) { s.getInput()?.dispose(); s.getOutput()?.dispose(); s.dispose() }
      a.dispose()
    }
    mergeDocuments(target, doc)
    first = false
  }
  // One scene with every model's node.
  const root = target.getRoot()
  const scenes = root.listScenes()
  const main = scenes[0]
  for (const s of scenes.slice(1)) { for (const n of s.listChildren()) { s.removeChild(n); main.addChild(n) } s.dispose() }
  root.setDefaultScene(main)
  await target.transform(unpartition(), weld(), dedup(), prune({ keepLeaves: true }), quantize())
  await io.write(out, target)
  console.log(path.basename(out), Math.round(fs.statSync(out).size / 1024) + " KB")
}

fs.mkdirSync(OUT, { recursive: true })
const g = (kit, sub, n) => [path.join(SRC, kit, "Models", sub, `${n}.glb`), n]
await pack([
  ...FOOD.map((n) => g("kenney_food-kit", "GLB format", n)),
  ...FURN.map((n) => g("kenney_furniture-kit", "GLTF format", n)),
  ...MARKET.map((n) => g("kenney_mini-market", "GLB format", n)),
], path.join(OUT, `props-${V}.glb`))
// (the Kenney mini characters were replaced by realistic people: tools/build_people.mjs)
