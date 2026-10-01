// Tiru Suara: imitate the sound with your voice (5 s each), everyone hears all of them, the AI picks the best.
import { mountVoice } from "./voicegame.js?v=__VERSION__"

export function mount(stage, ctx) {
  return mountVoice(stage, ctx, {
    task: (v) => ({ label: ctx.L("🐔 Tirukan suara:", "🐔 Imitate:"), text: ctx.L(v.item.id, v.item.en), doIt: ctx.L("Tirukan sekarang! 🎙️", "Do it now! 🎙️") }),
  })
}
