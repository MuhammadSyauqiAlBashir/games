"""Karaoke scoring: how close a sung pitch line is to the melody.

The phone sends the sung pitch every 50 ms as MIDI note numbers (float, None = silence/noise). We compare it with
the melody note by note, but fairly:
- any key: the best transposition (0–11 semitones) is used and octaves don't matter (kids and dads sing differently);
- a little early/late: the best overall shift (±0.6 s); only the middle 70 % of each note counts;
- near is good: a median within half a semitone = full credit, fading to nothing at 2 semitones off.
Silence where the melody has notes earns nothing, so humming one note or staying quiet scores low."""

from __future__ import annotations

DT = 0.05


def melody_frames(notes: list, bpm: float, dt: float = DT) -> list[float | None]:
    """[[midi, beats, syllable], …] → pitch per frame (None for the last 8 % of each note, so repeats separate)."""
    out: list[float | None] = []
    t = 0.0
    for midi, beats, *_ in notes:
        dur = beats * 60 / bpm
        n0, n1 = round(t / dt), round((t + dur) / dt)
        gap = max(1, round((n1 - n0) * 0.08))
        out += [float(midi)] * max(0, n1 - n0 - gap) + [None] * min(gap, n1 - n0)
        t += dur
    return out


def _credit(d: float) -> float:
    """Distance in semitones → 0..1 credit."""
    return 1.0 if d <= 0.5 else 0.0 if d >= 2.0 else (2.0 - d) / 1.5


def note_spans(notes: list, bpm: float) -> list[tuple[float, float, float]]:
    """[(start s, end s, midi)] for every note."""
    out, t = [], 0.0
    for midi, beats, *_ in notes:
        dur = beats * 60 / bpm
        out.append((t, t + dur, float(midi)))
        t += dur
    return out


def score(notes: list, bpm: float, sung: list, dt: float = DT) -> dict:
    """Judge note by note: the middle 70 % of each melody note must be sung, and its median pitch must be close.
    (Per-note medians stop random warbling from collecting lucky frames.)"""
    spans = note_spans(notes, bpm)
    sung = [None if v is None else float(v) for v in sung[:600]]
    voiced = sum(1 for v in sung if v is not None)
    base = {"score": 0, "pitch": 0, "cover": 0, "shift": 0, "late": 0.0, "flat": 0.0, "voiced": round(voiced * dt, 1)}
    if voiced < 5:
        return base
    total_w = sum(e - s for s, e, _ in spans)
    best = None
    for shift in sorted(range(-12, 13, 2), key=abs):   # whole-line timing offset ±0.6 s (prefer on time)
        for k in range(12):                            # key: the best transposition, octaves ignored
            got = covered = 0.0
            signed = []
            for s0, s1, midi in spans:
                dur = s1 - s0
                j0 = round((s0 + dur * 0.15) / dt) + shift
                j1 = max(j0 + 1, round((s1 - dur * 0.15) / dt) + shift)
                vals = [sung[j] for j in range(max(0, j0), min(len(sung), j1)) if sung[j] is not None]
                frames = max(1, j1 - j0)
                if not vals:
                    continue
                diffs = [((v + k - midi + 6) % 12) - 6 for v in vals]
                far = sorted(abs(x) for x in diffs)[len(diffs) // 2]  # median distance: random warbling stays far
                cov = min(1.0, len(vals) / frames / 0.5)
                got += _credit(far) * cov * dur
                covered += min(1.0, len(vals) / frames) * dur
                near = sorted(x for x in diffs if abs(x) <= 2)
                if near:
                    signed.append(near[len(near) // 2])
            if best is None or got > best[0] + 1e-9:
                best = (got, covered, k, shift, signed)
    got, covered, k, shift, signed = best
    pitch = got / total_w
    flat = sum(signed) / len(signed) if signed else 0.0
    key = -(((k + 6) % 12) - 6)  # the voice needed +k semitones, so it was sung k lower (folded to ±6)
    return {"score": round(100 * pitch ** 0.85), "pitch": round(pitch * 100), "cover": round(100 * covered / total_w),
            "shift": key, "late": round(-shift * dt, 2), "flat": round(flat, 2), "voiced": base["voiced"]}


def comment(st: dict, lang: str) -> str:
    """A short, friendly verdict from the numbers (instant, no AI needed)."""
    L = (lambda a, b: b if lang == "en" else a)
    s = st.get("score", 0)
    if st.get("voiced", 0) < 1:
        return L("Mikrofonnya nggak dengar suaramu… malu-malu ya? 🙈", "The mic didn't hear you… shy? 🙈")
    if s >= 90:
        head = L("Bintang panggung! 🌟 Nadanya nempel banget.", "Superstar! 🌟 Spot on.")
    elif s >= 75:
        head = L("Mantap! 🎤 Hampir semua nada pas.", "Great! 🎤 Nearly every note.")
    elif s >= 55:
        head = L("Lumayan! Masih ada nada yang meleset.", "Not bad! A few notes wandered off.")
    elif s >= 35:
        head = L("Semangatnya juara, nadanya… masih nyari jalan pulang 😅", "Great energy, the notes are still finding their way 😅")
    else:
        head = L("Ini lagu yang sama kan? 🤔😂", "Was that the same song? 🤔😂")
    tips = []
    if st.get("cover", 100) < 70:
        tips.append(L("banyak bagian yang kelewat", "you skipped parts"))
    if st.get("flat", 0) <= -0.35:
        tips.append(L("agak fals ke bawah", "a bit flat"))
    elif st.get("flat", 0) >= 0.35:
        tips.append(L("agak ketinggian", "a bit sharp"))
    if abs(st.get("late", 0)) >= 0.35:
        tips.append(L("masuknya telat", "came in late") if st["late"] > 0 else L("masuknya kecepetan", "came in early"))
    return head + (f" ({', '.join(tips)})" if tips else "")
