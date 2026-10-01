"""Survei 100 (Family 100): "Survei membuktikan…" — a question with the 5–6 most popular answers hidden on a board.
Everyone types answers at the same time; the first player to find an answer opens it and gets its points.
3 wrong guesses and you're locked for the round. The last round counts double.

Boards come from Gemini (fresh, with the categories/theme the players want, "surveyed" by the AI — not a real
survey) with a built-in bank as fallback. Answers match leniently: aliases, small typos, Indonesian word roots."""

from __future__ import annotations

import asyncio
import json
import logging
import os

from .. import ai, content, lexicon, util
from .base import Game, ch, opt, rank_by_score

log = logging.getLogger("bg.survei")
DATA = os.path.join(os.path.dirname(__file__), "..", "data")
STRIKES = 3
S = {"type": "string"}
SURVEY_SCHEMA = {"type": "object", "properties": {"surveys": {"type": "array", "items": {
    "type": "object", "properties": {
        "q": S, "answers": {"type": "array", "items": {"type": "object", "properties": {
            "a": S, "pts": {"type": "integer"}, "alias": {"type": "array", "items": S}},
            "required": ["a", "pts", "alias"], "propertyOrdering": ["a", "pts", "alias"]}}},
    "required": ["q", "answers"], "propertyOrdering": ["q", "answers"]}}},
    "required": ["surveys"], "propertyOrdering": ["surveys"]}


def bank(lang: str) -> list[dict]:
    with open(os.path.join(DATA, "survei.json")) as f:
        return json.load(f)[lang]


def _stem(lang: str, w: str) -> str:
    if lang != "id":
        return w[:-1] if w.endswith("s") and len(w) > 3 else w
    for suf in ("nya", "lah", "kah", "pun"):  # particles the stemmer keeps on words it doesn't know ("ponselnya")
        if w.endswith(suf) and len(w) - len(suf) >= 3:
            w = w[: -len(suf)]
            break
    try:
        return lexicon._stem(w)
    except Exception:  # noqa: BLE001
        return w


def matches(lang: str, guess: str, ans: dict) -> bool:
    g = util.norm(guess)
    if not g:
        return False
    gs = " ".join(_stem(lang, w) for w in g.split())
    for c in [ans["a"]] + list(ans.get("alias") or []):
        c = util.norm(c)
        if not c:
            continue
        if util.close_enough(g, c)[0]:
            return True
        if gs == " ".join(_stem(lang, w) for w in c.split()):
            return True
        # "motor matic" for "motor", "nasi padang enak" for "nasi padang" — the answer is the core of the guess
        if len(c) >= 4 and len(g.split()) <= len(c.split()) + 1 and (f" {c} " in f" {g} "):
            return True
    return False


def tidy(sv: dict) -> dict | None:
    ans = [a for a in sv.get("answers", []) if str(a.get("a", "")).strip()][:6]
    if len(ans) < 4 or not str(sv.get("q", "")).strip():
        return None
    total = sum(max(1, int(a.get("pts", 1))) for a in ans)
    out = [{"a": str(a["a"]).strip()[:40], "pts": max(1, round(max(1, int(a.get("pts", 1))) * 100 / total)),
            "alias": [str(x).strip()[:40] for x in (a.get("alias") or [])][:8]} for a in ans]
    out.sort(key=lambda a: -a["pts"])
    return {"q": str(sv["q"]).strip()[:140], "answers": out}


class Survei(Game):
    key, name_id, name_en, icon = "survei", "Survei 100", "Survey Says", "📋"
    kind = "timed"
    min_players, max_players = 1, 8
    default_timer = 0
    options = [
        opt("lang", "Bahasa", "Language", "select", "id", [ch("id", "Indonesia"), ch("en", "English")]),
        opt("rounds", "Ronde", "Rounds", "select", 4, [ch(n, str(n)) for n in (3, 4, 5, 6)]),
        opt("seconds", "Waktu per ronde", "Time per round", "select", 60, [ch(n, f"{n} dtk", f"{n} s") for n in (45, 60, 75, 90)]),
        opt("theme", "Tema (opsional)", "Theme (optional)", "text", "",
            help_id="Mis. kehidupan kantor, sekolah, liburan keluarga — AI membuat survei bertema ini.",
            help_en="E.g. office life, school, family holidays — the AI makes surveys about it."),
    ]

    @classmethod
    async def prepare(cls, seats, options, rng):
        lang, n, theme = options.get("lang", "id"), int(options.get("rounds", 4)), str(options.get("theme", ""))[:200]
        recent = set(await recent_qs(lang))
        out: list[dict] = []
        language = "Bahasa Indonesia (santai, sehari-hari)" if lang == "id" else "English"
        prompt = (f"Create {n + 2} 'Family 100' (Family Feud) survey boards in {language} for an Indonesian family party game. "
                  "Each: a question like 'Sebutkan …' / 'Name something …' that has many possible answers everyone knows, "
                  "and the 6 most popular answers as if 100 Indonesians were asked, with points (sum 100, most popular first). "
                  "For each answer give 3-6 aliases: synonyms, short forms, brand names, slang and common misspellings people "
                  "would type for the same answer. Keep answers short (1-3 words). Fun, family friendly, no politics or religion."
                  + (f" Theme from the players: {theme}." if theme else "")
                  + (f" Do not reuse these questions: {'; '.join(list(recent)[:30])}." if recent else ""))
        try:
            data = await asyncio.wait_for(ai.generate([prompt], schema=SURVEY_SCHEMA), timeout=14)
            for sv in data.get("surveys", []):
                t = tidy(sv)
                if t and t["q"] not in recent:
                    out.append(t)
        except (ai.AIUnavailable, asyncio.TimeoutError) as e:
            log.info("survei: AI not used (%s)", e)
        if len(out) < n:
            pool = [b for b in bank(lang) if b["q"] not in recent] or bank(lang)
            rng.shuffle(pool)
            out += pool[: n - len(out)]
        rng.shuffle(out)
        return {"boards": out[:n]}

    @classmethod
    async def refresh(cls, prepared, options):
        await remember_qs(options.get("lang", "id"), [b["q"] for b in (prepared or {}).get("boards", [])])
        return prepared

    @classmethod
    def setup(cls, players, options, rng, now):
        boards = (options.get("__content") or {}).get("boards") or bank(options.get("lang", "id"))[:int(options.get("rounds", 4))]
        return {"players": players, "boards": boards, "r": 0, "phase": "show", "deadline": 3.5, "lang": options.get("lang", "id"),
                "limit": int(options.get("seconds", 60)), "open": {}, "strikes": {}, "scores": {p["id"]: 0 for p in players},
                "turn_no": 0, "found": {}}

    def turn(self):
        return []

    def view(self, pid):
        s = self.s
        b = s["boards"][s["r"]]
        reveal = s["phase"] in ("reveal",) or self.over
        board = [{"n": i + 1, "a": a["a"] if (str(i) in s["open"] or reveal) else None, "pts": a["pts"] if (str(i) in s["open"] or reveal) else None,
                  "by": s["open"].get(str(i))} for i, a in enumerate(b["answers"])]
        return {**self.base_view(), "phase": s["phase"], "deadline": s["deadline"], "round": s["r"] + 1, "rounds": len(s["boards"]),
                "q": b["q"], "board": board, "scores": s["scores"], "double": s["r"] == len(s["boards"]) - 1 and len(s["boards"]) > 1,
                "strikes": s["strikes"].get(pid, 0) if pid else 0, "max_strikes": STRIKES, "limit": s["limit"]}

    def _mult(self) -> int:
        s = self.s
        return 2 if s["r"] == len(s["boards"]) - 1 and len(s["boards"]) > 1 else 1

    def tick(self, now):
        s = self.s
        if self.over or now < s["deadline"]:
            return []
        if s["phase"] == "show":
            s["phase"], s["deadline"] = "play", now + s["limit"]
            s["turn_no"] += 1
            return [{"e": "go"}]
        if s["phase"] == "play":
            s["phase"], s["deadline"] = "reveal", now + 7
            s["turn_no"] += 1
            return [{"e": "reveal"}]
        if s["phase"] == "reveal":
            if s["r"] + 1 >= len(s["boards"]):
                self.finish(rank_by_score(self.ids(), s["scores"]))
                return [{"e": "end"}]
            s["r"] += 1
            s["open"], s["strikes"] = {}, {}
            s["phase"], s["deadline"] = "show", now + 3.5
            s["turn_no"] += 1
            return [{"e": "round"}]
        return []

    def act(self, pid, a, now):
        s = self.s
        if s["phase"] != "play" or a.get("do") != "guess":
            return []
        text = str(a.get("text", "")).strip()[:50]
        if not text:
            return []
        if s["strikes"].get(pid, 0) >= STRIKES:
            return [{"e": "locked", "to": pid}]
        answers = s["boards"][s["r"]]["answers"]
        for i, ans in enumerate(answers):
            if matches(s["lang"], text, ans):
                if str(i) in s["open"]:
                    return [{"e": "already", "to": pid, "n": i + 1, "text": text}]
                pts = ans["pts"] * self._mult()
                s["open"][str(i)] = pid
                s["scores"][pid] += pts
                self.bump("answers", pid)
                if i == 0:
                    self.bump("top_answer", pid)
                ev = [{"e": "hit", "who": pid, "n": i + 1, "a": ans["a"], "pts": pts, "text": text}]
                if len(s["open"]) == len(answers):
                    s["phase"], s["deadline"] = "reveal", now + 7
                    ev.append({"e": "clear"})
                s["turn_no"] += 1
                return ev
        s["strikes"][pid] = s["strikes"].get(pid, 0) + 1
        return [{"e": "x", "who": pid, "to": pid, "text": text, "n": s["strikes"][pid]}]


async def recent_qs(lang: str) -> list[str]:
    try:
        return list(await content.pb.kv_get(f"survei_recent:{lang}", []) or [])
    except Exception:  # noqa: BLE001
        return []


async def remember_qs(lang: str, qs: list[str]):
    try:
        old = await recent_qs(lang)
        keep = [q for q in old if q not in set(qs)] + qs
        await content.pb.kv_set(f"survei_recent:{lang}", keep[-60:])
    except Exception as e:  # noqa: BLE001
        log.info("survei remember: %s", e)
