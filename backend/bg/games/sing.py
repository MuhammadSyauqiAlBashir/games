"""Voice games (microphone).

Karaoke Klasik: everyone hears a 10-second synthesized clip of a classic/folk melody, then each player sings it in
turn. The phone tracks the pitch of the voice (every 50 ms) and pitch.py scores it against the melody — any key,
octaves ignored. Nothing is uploaded except the pitch numbers.

Nyanyi Lagu Hits: one player (the DJ, rotating) brings the song — a 10–12 s clip from a music file or recorded from
a speaker, plus the title — or just a title to sing from memory. Everyone hears the original, sings it in turn
(recorded as a small WAV), the recordings are played back, and Gemini compares each singer with the original.

Tiru Suara: "the hen that just laid an egg!" — everyone records 5 seconds in turn, the clips are played back,
Gemini picks the most convincing. If Gemini can't answer within ~30 s, the players vote instead.

Recordings live only in the room's memory (like the photo games) and are sent to Gemini for judging."""

from __future__ import annotations

import json
import logging
import os

from .. import ai, pitch, vision
from .base import Game, IllegalMove, ch, opt, rank_by_score

log = logging.getLogger("bg.sing")
DATA = os.path.join(os.path.dirname(__file__), "..", "data")
LANG_OPT = opt("lang", "Bahasa", "Language", "select", "id", [ch("id", "Indonesia"), ch("en", "English")])
COUNT_IN = 3.0
S = {"type": "string"}
RANK_SCHEMA = {"type": "object", "properties": {"ranking": {"type": "array", "items": {
    "type": "object", "properties": {"label": S, "comment": S, "score": {"type": "integer"}},
    "required": ["label", "comment", "score"], "propertyOrdering": ["label", "comment", "score"]}}},
    "required": ["ranking"], "propertyOrdering": ["ranking"]}
LYRICS_SCHEMA = {"type": "object", "properties": {"lyrics": S}, "required": ["lyrics"]}


def songs() -> list[dict]:
    with open(os.path.join(DATA, "songs.json")) as f:
        return json.load(f)["songs"]


def share_ranks(ids: list[str], score: dict) -> dict[str, int]:
    """Rank 1 = best; equal scores share the rank."""
    return {p: 1 + sum(1 for q in ids if score[q] > score[p]) for p in ids}


# =====================================================================================================
# Karaoke Klasik
# =====================================================================================================

class Karaoke(Game):
    key, name_id, name_en, icon = "karaoke", "Karaoke Klasik", "Classic Karaoke", "🎤"
    kind = "timed"
    min_players, max_players = 1, 6
    default_timer = 0
    options = [
        opt("rounds", "Lagu", "Songs", "select", 3, [ch(n, str(n)) for n in (1, 2, 3, 5)]),
        opt("songs", "Pilihan lagu", "Song choice", "select", "mix", [ch("mix", "Campur", "Mix"), ch("id", "Lagu Indonesia", "Indonesian"),
                                                                      ch("en", "Lagu Inggris", "English")]),
    ]

    @classmethod
    def setup(cls, players, options, rng, now):
        pool = [s for s in songs() if options.get("songs", "mix") in ("mix", s["lang"])] or songs()
        rng.shuffle(pool)
        ids = [p["id"] for p in players]
        return {"players": players, "songs": pool[: int(options.get("rounds", 3))], "r": 0, "order": ids, "k": 0,
                "phase": "intro", "deadline": 3.5, "t0": 0.0, "live": [], "res": {}, "last": None,
                "scores": {p: 0 for p in ids}, "turn": None, "turn_no": 0}

    def turn(self):
        return [self.s["turn"]] if self.s["phase"] == "sing" and self.s["turn"] else []

    def view(self, pid):
        s = self.s
        return {**self.base_view(), "phase": s["phase"], "deadline": s["deadline"], "t0": s["t0"], "round": s["r"] + 1,
                "rounds": len(s["songs"]), "song": s["songs"][s["r"]], "singer": s["turn"], "live": s["live"], "res": s["res"],
                "last": s["last"], "scores": s["scores"], "order": s["order"], "count_in": COUNT_IN}

    def _singer_order(self):
        ids = self.ids()
        r = self.s["r"]
        return ids[r % len(ids):] + ids[: r % len(ids)]

    def _next_singer(self, now):
        s = self.s
        if s["k"] >= len(s["order"]):
            ranks = share_ranks(s["order"], {p: s["res"].get(p, {}).get("score", 0) for p in s["order"]})
            best = [p for p, r in ranks.items() if r == 1 and s["res"].get(p, {}).get("score", 0) > 0]
            for p in best:
                self.bump("best_singer", p)
            s["phase"], s["deadline"], s["turn"] = "result", now + 8, None
            s["turn_no"] += 1
            return [{"e": "result"}]
        s["turn"] = s["order"][s["k"]]
        s["phase"], s["t0"], s["live"] = "sing", now, []
        s["deadline"] = now + COUNT_IN + s["songs"][s["r"]]["seconds"] + 2.5
        s["turn_no"] += 1
        return [{"e": "sing", "who": s["turn"]}]

    def _judge(self, pid, frames, now):
        s = self.s
        song = s["songs"][s["r"]]
        st = pitch.score(song["notes"], song["bpm"], frames)
        st["comment"] = pitch.comment(st, "id")
        st["comment_en"] = pitch.comment(st, "en")
        st["f"] = [None if v is None else round(v, 1) for v in frames[:400]]
        s["res"][pid] = st
        s["scores"][pid] += st["score"]
        s["last"] = {"who": pid, **st}
        s["phase"], s["deadline"] = "score", now + 5
        s["k"] += 1
        s["turn_no"] += 1
        return [{"e": "scored", "who": pid, "score": st["score"]}]

    def tick(self, now):
        s = self.s
        if self.over or now < s["deadline"]:
            return []
        if s["phase"] == "intro":
            s["phase"], s["t0"] = "listen", now + 0.6
            s["deadline"] = s["t0"] + s["songs"][s["r"]]["seconds"] + 1.2
            s["order"], s["k"], s["res"] = self._singer_order(), 0, {}
            s["turn_no"] += 1
            return [{"e": "listen"}]
        if s["phase"] in ("listen", "score"):
            return self._next_singer(now)
        if s["phase"] == "sing":  # nothing arrived: whatever was streamed live counts
            return self._judge(s["turn"], [None if v is None else v for v in s["live"]], now)
        if s["phase"] == "result":
            if s["r"] + 1 >= len(s["songs"]):
                self.finish(rank_by_score(self.ids(), s["scores"]))
                return [{"e": "end"}]
            s["r"] += 1
            s["phase"], s["deadline"] = "intro", now + 3.5
            s["turn_no"] += 1
            return [{"e": "next"}]
        return []

    def act(self, pid, a, now):
        s = self.s
        if s["phase"] != "sing" or pid != s["turn"]:
            return []
        f = a.get("f") or []
        if not isinstance(f, list):
            raise IllegalMove("?")
        clean = [None if (v is None or not isinstance(v, (int, float)) or not 20 <= v <= 100) else float(v) for v in f[:400]]
        if a.get("do") == "live":
            i = max(0, int(a.get("i", 0)))
            live = s["live"]
            if i > len(live) + 40:
                return []
            del live[i:]
            live.extend(clean[:60])
            del live[400:]
            return [{"e": "live"}]
        if a.get("do") == "sung":
            return self._judge(pid, clean, now)
        if a.get("do") == "skip":
            return self._judge(pid, [], now)
        return []


# =====================================================================================================
# Recorded rounds judged by Gemini: Nyanyi Lagu Hits, Tiru Suara
# =====================================================================================================

class VoiceRank(Game):
    """Shared flow: (prep) → (listen to the original) → everyone records in turn → playback → AI verdict / vote."""
    kind = "timed"
    default_timer = 0
    rec_seconds = 5.0
    with_prep = False

    def turn(self):
        s = self.s
        if s["phase"] in ("rec", "prep") and s.get("turn"):
            return [s["turn"]]
        if s["phase"] == "vote":
            return [p for p in self.ids() if p not in s["votes"]]
        return []

    @staticmethod
    def _base_state(players, items, options):
        ids = [p["id"] for p in players]
        return {"players": players, "items": items, "r": 0, "phase": "intro", "deadline": 3.5, "lang": options.get("lang", "id"),
                "order": ids, "k": 0, "turn": None, "t0": 0.0, "clips": {}, "lens": {}, "ref": None, "lyrics": "",
                "verdict": None, "result": None, "votes": {}, "scores": {p: 0 for p in ids}, "turn_no": 0, "ai_need": None,
                "judge_t0": None, "dj": None, "title": ""}

    def item(self) -> dict:
        return self.s["items"][self.s["r"]]

    def rec_len(self) -> float:
        return self.rec_seconds

    def view(self, pid):
        s = self.s
        return {**self.base_view(), "phase": s["phase"], "deadline": s["deadline"], "t0": s["t0"], "round": s["r"] + 1,
                "rounds": len(s["items"]), "item": self.item(), "performer": s["turn"] if s["phase"] == "rec" else None,
                "order": s["order"], "clips": list(s["clips"]), "lens": s["lens"], "ref": s["ref"], "lyrics": s["lyrics"],
                "rec": self.rec_len(), "count_in": COUNT_IN, "result": s["result"] if s["phase"] == "result" else None,
                "votes": {p: True for p in s["votes"]} if s["phase"] == "vote" else {}, "my_vote": s["votes"].get(pid),
                "scores": s["scores"], "judge_t0": s["judge_t0"], "dj": s["dj"], "title": s["title"]}

    # ---- flow ------------------------------------------------------------------------------------
    def _start_round(self, now):
        s = self.s
        ids = self.ids()
        r = s["r"]
        s["order"] = ids[r % len(ids):] + ids[: r % len(ids)]
        s["k"], s["clips"], s["lens"], s["votes"], s["verdict"], s["result"] = 0, {}, {}, {}, None, None
        s["ref"], s["lyrics"], s["judge_t0"] = None, "", None
        if self.with_prep:
            s["dj"] = s["order"][0]
            s["title"] = self.item().get("title", "")
            s["phase"], s["turn"], s["deadline"] = "prep", s["dj"], now + 75
            s["turn_no"] += 1
            return [{"e": "prep", "who": s["dj"]}]
        return self._listen_or_rec(now)

    def _listen_or_rec(self, now):
        s = self.s
        if s["ref"]:
            s["phase"], s["turn"], s["t0"] = "listen", None, now + 0.8
            s["deadline"] = s["t0"] + s["ref"]["secs"] + 1.0
            s["turn_no"] += 1
            return [{"e": "listen"}]
        return self._next_rec(now)

    def _next_rec(self, now):
        s = self.s
        if s["k"] >= len(s["order"]):
            return self._playback(now)
        s["turn"] = s["order"][s["k"]]
        s["phase"], s["t0"] = "rec", now
        s["deadline"] = now + COUNT_IN + self.rec_len() + 6
        s["turn_no"] += 1
        return [{"e": "rec", "who": s["turn"]}]

    def _playback(self, now):
        s = self.s
        s["turn"] = None
        if not s["clips"]:
            s["result"] = []
            s["phase"], s["deadline"] = "result", now + 5
            s["turn_no"] += 1
            return [{"e": "result"}]
        s["phase"], s["t0"] = "play", now + 0.8
        s["deadline"] = s["t0"] + sum(s["lens"][p] + 1.0 for p in s["clips"])
        s["judge_t0"] = now
        s["ai_need"] = {"id": f"judge-{s['r']}", "kind": "judge", "r": s["r"] + 1, "ids": list(s["clips"]), "item": self.item(),
                        "lang": s["lang"], "ref": bool(s["ref"]), "title": s["title"]}
        s["turn_no"] += 1
        return [{"e": "play"}]

    def tick(self, now):
        s = self.s
        if self.over or s["phase"] == "judging" or now < s["deadline"]:
            return []
        ph = s["phase"]
        if ph == "intro":
            return self._start_round(now)
        if ph == "prep":
            return self._listen_or_rec(now)
        if ph == "listen":
            return self._next_rec(now)
        if ph == "rec":
            s["k"] += 1
            return self._next_rec(now)
        if ph == "play":
            if s["verdict"] is None:
                s["phase"], s["deadline"] = "judging", None
                s["turn_no"] += 1
                return [{"e": "judging"}]
            return self._apply_verdict(now)
        if ph == "vote":
            return self._count_votes(now)
        if ph == "result":
            if s["r"] + 1 >= len(s["items"]):
                self.finish(rank_by_score(self.ids(), s["scores"]))
                return [{"e": "end"}]
            s["r"] += 1
            s["phase"], s["deadline"] = "intro", now + 3
            s["turn_no"] += 1
            return [{"e": "next"}]
        return []

    def _apply_verdict(self, now):
        s = self.s
        v = s["verdict"]
        if not v:  # the AI couldn't answer: the players vote
            s["phase"], s["deadline"] = "vote", now + 20
            s["turn_no"] += 1
            return [{"e": "vote"}]
        ids = list(s["clips"])
        by = {r["id"]: r for r in v.get("ranking", [])}
        sc = {p: by.get(p, {}).get("score", 0) for p in ids}
        ranks = share_ranks(ids, sc)
        n = len(ids)
        res = []
        for p in sorted(ids, key=lambda q: ranks[q]):
            pts = 100 * (n - ranks[p] + 1)
            s["scores"][p] += pts
            if ranks[p] == 1:
                self.bump("voice_wins", p)
            res.append({"id": p, "rank": ranks[p], "pts": pts, "score": sc[p], "comment": by.get(p, {}).get("comment", ""), "by": "ai"})
        s["result"] = res
        s["phase"], s["deadline"] = "result", now + 12
        s["turn_no"] += 1
        return [{"e": "result"}]

    def _count_votes(self, now):
        s = self.s
        ids = list(s["clips"])
        got = {p: 0 for p in ids}
        for v in s["votes"].values():
            if v in got:
                got[v] += 1
        ranks = share_ranks(ids, got)
        res = []
        for p in sorted(ids, key=lambda q: ranks[q]):
            pts = 100 * got[p]
            s["scores"][p] += pts
            res.append({"id": p, "rank": ranks[p], "pts": pts, "score": None, "votes": got[p], "comment": "", "by": "vote"})
        s["result"] = res
        s["phase"], s["deadline"] = "result", now + 10
        s["turn_no"] += 1
        return [{"e": "result"}]

    def provide(self, need, result, now):
        s = self.s
        s["ai_need"] = None
        if need.get("kind") == "lyrics":
            s["lyrics"] = str((result or {}).get("lyrics", ""))[:300]
            s["turn_no"] += 1
            return [{"e": "lyrics"}]
        s["verdict"] = result or False
        if s["phase"] == "judging":
            return self._apply_verdict(now)
        return []

    # ---- player actions ------------------------------------------------------------------------------
    def act(self, pid, a, now):
        s = self.s
        do = a.get("do")
        if do == "vote" and s["phase"] == "vote":
            target = a.get("pid")
            if target not in s["clips"] or (target == pid and len(s["clips"]) > 1):
                raise IllegalMove("Pilih rekaman orang lain.")
            s["votes"][pid] = target
            if all(p in s["votes"] for p in self.ids()):
                return self._count_votes(now)
            s["turn_no"] += 1
            return [{"e": "voted", "who": pid}]
        if do == "skip" and s["phase"] == "rec" and pid == s["turn"]:
            s["k"] += 1
            return self._next_rec(now)
        if self.with_prep and s["phase"] == "prep" and pid == s["dj"]:
            if do == "title":
                s["title"] = str(a.get("t", "")).strip()[:80]
                s["turn_no"] += 1
                return [{"e": "title"}]
            if do == "go":
                if not s["title"] and not s["ref"]:
                    raise IllegalMove("Tulis judul lagunya dulu.")
                return self._listen_or_rec(now)
        return []

    def audio_ok(self, pid, r, slot) -> str | None:
        s = self.s
        if r != s["r"] + 1:
            return "Ronde sudah lewat."
        if slot == "ref":
            return None if (self.with_prep and s["phase"] == "prep" and pid == s["dj"]) else "Bukan giliranmu memilih lagu."
        return None if (s["phase"] == "rec" and pid == s["turn"]) else "Bukan giliranmu."

    def server_input(self, pid, d, now):
        s = self.s
        if d.get("do") != "clip" or d.get("r") != s["r"] + 1:
            return []
        secs = max(0.5, min(15.0, float(d.get("secs", 0))))
        if d.get("slot") == "ref":
            if s["phase"] != "prep":
                return []
            s["ref"] = {"secs": round(secs, 2)}
            s["lyrics"] = ""
            s["ai_need"] = {"id": f"lyrics-{s['r']}-{now:.1f}", "kind": "lyrics", "r": s["r"] + 1, "lang": s["lang"]}
            s["turn_no"] += 1
            return [{"e": "ref"}]
        if s["phase"] != "rec" or pid != s["turn"]:
            return []
        s["clips"][pid] = True
        s["lens"][pid] = round(secs, 2)
        s["k"] += 1
        return self._next_rec(now)

    # ---- the AI ------------------------------------------------------------------------------------------
    @classmethod
    def judge_prompt(cls, need, labels) -> str:
        raise NotImplementedError

    @classmethod
    async def fulfil_room(cls, need, options, room):
        r = need["r"]
        if need.get("kind") == "lyrics":
            wav = room.photos.get(f"a{r}:ref")
            if not wav:
                return {"lyrics": ""}
            prompt = ("Write down only the sung lyrics you hear in this short music clip, as one line (no title, no notes). "
                      "If nobody sings, answer an empty string.")
            return await vision.race(lambda: ai.generate([prompt, ai.image_part(wav, "audio/wav")], schema=LYRICS_SCHEMA),
                                     None, budget=15, head_start=15)
        labels, parts = {}, []
        ref = room.photos.get(f"a{r}:ref") if need.get("ref") else None
        if ref:
            parts += ["ORIGINAL song clip:", ai.image_part(ref, "audio/wav")]
        for i, pid in enumerate(need["ids"]):
            wav = room.photos.get(f"a{r}:{pid}")
            if not wav:
                continue
            label = chr(65 + i)
            labels[label] = pid
            parts += [f"Recording {label}:", ai.image_part(wav, "audio/wav")]
        if not labels:
            return {"ranking": []}
        prompt = cls.judge_prompt(need, labels)
        data = await vision.race(lambda: ai.generate([prompt] + parts, schema=RANK_SCHEMA, smart=True), None, budget=30, head_start=30)
        if data is None:
            return None
        out = []
        for row in data.get("ranking", []):
            pid = labels.get(str(row.get("label", "")).strip().upper()[:1])
            if pid:
                out.append({"id": pid, "score": max(0, min(100, int(row.get("score", 0)))), "comment": str(row.get("comment", ""))[:220]})
        return {"ranking": out}


def _language(lang: str) -> str:
    return "Bahasa Indonesia (santai, lucu, sopan)" if lang == "id" else "English (playful, kind)"


class NyanyiHits(VoiceRank):
    key, name_id, name_en, icon = "nyanyihits", "Nyanyi Lagu Hits", "Sing the Hits", "🌟"
    min_players, max_players = 2, 6
    with_prep = True
    options = [LANG_OPT, opt("rounds", "Lagu", "Songs", "select", 3, [ch(n, str(n)) for n in (2, 3, 4, 6)])]

    @classmethod
    def setup(cls, players, options, rng, now):
        n = int(options.get("rounds", 3))
        return cls._base_state(players, [{"title": ""} for _ in range(n)], options)

    def rec_len(self) -> float:
        ref = self.s.get("ref")
        return min(14.0, max(6.0, (ref or {}).get("secs", 10.0) + 1.0))

    @classmethod
    def judge_prompt(cls, need, labels):
        title = need.get("title") or "?"
        base = (f"Family karaoke game. The song is \"{title}\". "
                + ("First you hear the ORIGINAL clip, then each player's recording singing it. " if need.get("ref")
                   else "There is no original clip: judge against how the song really goes (if you know it). ")
                + "Score each recording 0-100 for how close it is to the original: melody/pitch, rhythm and lyrics. "
                "Be fair: confident wrong singing scores lower than shy but accurate singing. Never comment on what the "
                f"voice sounds like as a person (only the singing). One short funny, encouraging comment each in "
                f"{_language(need['lang'])}. Labels: {', '.join(labels)}.")
        return base


class TiruSuara(VoiceRank):
    key, name_id, name_en, icon = "tirusuara", "Tiru Suara", "Sound Mimic", "🐔"
    min_players, max_players = 2, 8
    rec_seconds = 5.0
    options = [LANG_OPT, opt("rounds", "Ronde", "Rounds", "select", 4, [ch(n, str(n)) for n in (3, 4, 6)])]

    @classmethod
    def setup(cls, players, options, rng, now):
        with open(os.path.join(DATA, "suara.json")) as f:
            pool = json.load(f)
        rng.shuffle(pool)
        return cls._base_state(players, pool[: int(options.get("rounds", 4))], options)

    @classmethod
    def judge_prompt(cls, need, labels):
        it = need["item"]
        return (f"Family party game: each player imitates this sound with their voice: \"{it['en']}\" (Indonesian: \"{it['id']}\"). "
                "Score each recording 0-100 for how convincing, recognisable and funny the imitation is (effort counts; "
                "silence or talking about it instead of doing it scores low). Never comment on the person's voice itself. "
                f"One short funny comment each in {_language(need['lang'])}. Labels: {', '.join(labels)}.")
