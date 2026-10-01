// Nyanyi Lagu Hits: bring the real song (a clip), everyone sings it, the AI compares each singer with the original.
import { mountVoice } from "./voicegame.js?v=__VERSION__"

export function mount(stage, ctx) {
  return mountVoice(stage, ctx, {
    task: (v) => ({
      label: v.phase === "prep" ? ctx.L(`🎧 DJ ronde ini: ${ctx.name(v.dj)}`, `🎧 This round's DJ: ${ctx.name(v.dj)}`) : ctx.L("🌟 Nyanyikan:", "🌟 Sing:"),
      text: v.title || ctx.L("(lagu misteri)", "(mystery song)"),
      doIt: v.ref ? ctx.L("Nyanyikan bagian yang tadi diputar!", "Sing the part you just heard!") : ctx.L("Nyanyikan reff-nya dari ingatan!", "Sing the chorus from memory!"),
    }),
  })
}
