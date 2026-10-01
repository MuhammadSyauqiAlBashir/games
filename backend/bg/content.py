"""Questions for Trivia and Rebus, and words for the drawing games.

Trivia questions are written by Gemini (free) and kept in a bank (bg_questions) so
rooms start fast and questions don't repeat. Safeguards against wrong questions:
1. Topics with exact answers (flags, capitals, countries) come from a real data set,
   not from the AI.
2. Every AI question is double-checked by a second, independent AI call; if the
   checker disagrees with the answer, isn't sure, or thinks it's off-topic or at the
   wrong difficulty, the question is thrown away.
3. No time-sensitive facts ("the current president…") unless the year is in the question.
4. Players can report a question (⚑). It's removed from the bank at once, doesn't
   count in that game, and the reason becomes a "lesson": the latest lessons for that
   topic are added to the next generation prompt so the same kind of mistake isn't
   repeated. Reports can be reviewed in the admin page.
5. Duplicates are rejected by a hash of the normalised question."""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import random

from . import ai, util
from .pb import PBError, pb, q

log = logging.getLogger("bg.content")
DATA = os.path.join(os.path.dirname(__file__), "data")

TOPICS = {
    "general": ("Pengetahuan umum", "General knowledge"),
    "indonesia": ("Indonesia", "Indonesia"),
    "film": ("Film & serial", "Film & TV"),
    "music": ("Musik", "Music"),
    "sport": ("Olahraga", "Sport"),
    "science": ("Sains", "Science"),
    "history": ("Sejarah", "History"),
    "geography": ("Geografi", "Geography"),
    "flags": ("Bendera", "Flags"),
    "capitals": ("Negara & ibu kota", "Countries & capitals"),
    "trick": ("Pertanyaan jebakan", "Trick questions"),
    "food": ("Makanan & kuliner", "Food & cuisine"),
    "animals": ("Hewan & alam", "Animals & nature"),
    "space": ("Luar angkasa", "Space"),
    "body": ("Tubuh manusia", "The human body"),
    "tech": ("Teknologi", "Technology"),
    "kpop": ("K-pop & K-drama", "K-pop & K-drama"),
    "anime": ("Anime & game", "Anime & games"),
    "bahasa": ("Bahasa Indonesia", "Bahasa Indonesia"),
    "mythology": ("Mitologi", "Mythology"),
    "islam": ("Pengetahuan Islam", "Islamic knowledge"),
    "logic": ("Teka-teki logika", "Logic riddles"),
}
DATA_TOPICS = {"flags", "capitals"}
LEVELS = {1: ("Mudah", "Easy"), 2: ("Sedang", "Medium"), 3: ("Sulit", "Hard"), 4: ("Ahli", "Expert")}
LEVEL_GUIDE = {
    1: "EASY: most adults know it; very famous facts.",
    2: "MEDIUM: an interested fan or a good student knows it.",
    3: "HARD: needs real knowledge of the topic; a typical person would guess.",
    4: "EXPERT: specialist / deep-cut knowledge, still a single clear verifiable fact.",
}
TOPIC_GUIDE = {
    "indonesia": "Indonesian culture, history, geography, food, traditions, famous people and places.",
    "trick": "Fun 'jebakan' questions that sound easy but have a surprising, strictly correct answer "
             "(e.g. wordplay on the question itself, common misconceptions). Never ambiguous.",
    "bahasa": "Bahasa Indonesia: kata baku, peribahasa and their meaning, sinonim/antonim, EYD spelling.",
    "islam": "Well-established Islamic knowledge (pillars, prophets, Quran basics, history). Respectful and uncontroversial.",
    "logic": "Short logic riddles with one numeric or clear answer, solvable in 15 seconds.",
    "kpop": "K-pop groups, members, songs, K-drama titles and actors (only stable facts, no rumours).",
    "anime": "Anime, manga and video games: characters, studios, famous titles.",
}


def qhash(text: str) -> str:
    return hashlib.sha256(util.norm(text).encode()).hexdigest()[:40]


# ---------------------------------------------------------------------------------------------
# Country data (flags, capitals)
# ---------------------------------------------------------------------------------------------

_countries: list[dict] | None = None


def countries() -> list[dict]:
    global _countries
    if _countries is None:
        with open(os.path.join(DATA, "countries.json")) as f:
            _countries = json.load(f)
    return _countries


FAMOUS = {"id", "my", "sg", "th", "vn", "ph", "jp", "kr", "cn", "in", "sa", "us", "gb", "fr", "de", "it", "es", "br",
          "ar", "au", "ca", "mx", "ru", "eg", "tr", "nl", "pt", "za", "ng", "nz", "ch", "se", "no", "gr", "ie", "be", "pk",
          "bd", "ae", "qa", "ma", "ke", "pl", "ua", "fi", "dk", "at", "cz", "cu", "jm", "co", "cl", "pe", "ir", "iq", "il"}


def country_level(c: dict) -> int:
    if c["code"] in FAMOUS:
        return 1 if c["code"] in {"id", "my", "sg", "jp", "kr", "cn", "us", "gb", "fr", "de", "it", "br", "sa", "au", "in",
                                  "th", "es", "ca"} else 2
    return 3 if c["region"] in ("Asia", "Europe", "Americas") and c["area"] > 50000 else 4


def data_question(topic: str, level: int, lang: str, rng: random.Random) -> dict:
    pool = [c for c in countries() if country_level(c) == level] or countries()
    c = rng.choice(pool)
    name = c[lang] if lang in c else c["en"]
    same_region = [x for x in countries() if x["region"] == c["region"] and x["code"] != c["code"]]
    others = rng.sample(same_region if len(same_region) >= 3 else countries(), 3)
    if topic == "flags":
        choices = [name] + [o[lang] for o in others]
        rng.shuffle(choices)
        return {"qid": f"flag:{c['code']}", "topic": topic, "level": level, "flag": c["code"],
                "q": "Bendera negara mana ini?" if lang == "id" else "Which country's flag is this?",
                "choices": choices, "answer": choices.index(name), "explain": "", "source": "data"}
    choices = [c["capital"]] + [o["capital"] for o in others if o["capital"]]
    choices = list(dict.fromkeys(choices))[:4]
    while len(choices) < 4:
        extra = rng.choice(countries())["capital"]
        if extra and extra not in choices:
            choices.append(extra)
    rng.shuffle(choices)
    return {"qid": f"cap:{c['code']}", "topic": topic, "level": level, "flag": c["code"],
            "q": f"Apa ibu kota {name}?" if lang == "id" else f"What is the capital of {name}?",
            "choices": choices, "answer": choices.index(c["capital"]), "explain": "", "source": "data"}


# ---------------------------------------------------------------------------------------------
# AI trivia bank
# ---------------------------------------------------------------------------------------------

S = {"type": "string"}


def obj(props: dict) -> dict:
    return {"type": "object", "properties": props, "required": list(props), "propertyOrdering": list(props)}


GEN_SCHEMA = obj({"questions": {"type": "array", "items": obj({
    "level": {"type": "integer"}, "question": S, "choices": {"type": "array", "items": S},
    "answer_index": {"type": "integer"}, "explanation": S})}})
CHECK_SCHEMA = obj({"checks": {"type": "array", "items": obj({
    "n": {"type": "integer"}, "my_answer_index": {"type": "integer"}, "certain": {"type": "boolean"},
    "fits_topic": {"type": "boolean"}, "level_ok": {"type": "boolean"}, "problem": S})}})

_gen_locks: dict[tuple[str, str], asyncio.Lock] = {}


async def lessons(topic: str) -> list[str]:
    try:
        reps = (await pb.list("bg_reports", filter=f"topic = {q(topic)}", sort="-created", per_page=10)).get("items", [])
    except PBError:
        return []
    return [r["reason"] for r in reps if r.get("reason")]


async def recent_texts(topic: str, lang: str) -> list[str]:
    try:
        items = (await pb.list("bg_questions", filter=f"kind = 'trivia' && topic = {q(topic)} && lang = {q(lang)}",
                               sort="-created", per_page=40, fields="q")).get("items", [])
    except PBError:
        return []
    return [(i.get("q") or {}).get("q", "") for i in items]


async def generate_trivia(topic: str, lang: str, levels: list[int], per_level: int = 3) -> int:
    """Ask Gemini for new questions, double-check them, store the good ones. Returns how many were kept."""
    async with _gen_locks.setdefault((topic, lang), asyncio.Lock()):
        tname = TOPICS[topic][1]
        language = "Bahasa Indonesia" if lang == "id" else "English"
        avoid = await recent_texts(topic, lang)
        learned = await lessons(topic)
        spec = "\n".join(f"- {per_level} questions at level {lv}: {LEVEL_GUIDE[lv]}" for lv in levels)
        prompt = (
            f"Write multiple-choice trivia questions in {language} about the topic \"{tname}\"."
            f" {TOPIC_GUIDE.get(topic, '')}\n{spec}\n"
            "Rules:\n- Each question has exactly 4 short choices and exactly ONE correct answer; the other three must be "
            "plausible but definitely wrong.\n- Only facts you are completely sure of. No opinions, no 'best/most popular' "
            "unless it's an official record.\n- No facts that change over time (current office holders, latest records, "
            "prices, 'this year') unless the question names the year.\n- The question must really be about the topic and "
            "match its level.\n- Short questions (max 25 words) that read naturally for a party game.\n"
            "- explanation: one short sentence with the fact.\n"
            + ("- Do NOT repeat or paraphrase these existing questions:\n" + "\n".join(f"  * {t}" for t in avoid[:40] if t) + "\n"
               if avoid else "")
            + ("- Players reported these problems before; avoid the same kind of mistake:\n" +
               "\n".join(f"  * {t}" for t in learned) + "\n" if learned else "")
        )
        try:
            data = await ai.generate([prompt], schema=GEN_SCHEMA, smart=True)
        except ai.AIUnavailable as e:
            log.warning("trivia generation failed: %s", e)
            return 0
        cands = []
        for item in data.get("questions", []):
            ch_ = [str(c).strip() for c in item.get("choices", [])][:4]
            ai_ = int(item.get("answer_index", -1))
            lv = int(item.get("level", 0))
            if len(ch_) != 4 or len(set(util.norm(c) for c in ch_)) != 4 or not 0 <= ai_ < 4 or lv not in levels:
                continue
            cands.append({"q": str(item.get("question", "")).strip(), "choices": ch_, "answer": ai_,
                          "explain": str(item.get("explanation", "")).strip(), "level": lv})
        if not cands:
            return 0
        # Second opinion, blind to the intended answer.
        listing = "\n".join(f"{n}. [level {c['level']}] {c['q']}\n" + "\n".join(f"   {k}) {x}" for k, x in enumerate(c["choices"]))
                            for n, c in enumerate(cands))
        check_prompt = (
            f"You are a strict fact-checker for a {language} trivia game about \"{tname}\". For each question pick the "
            "correct choice index yourself (0-3). certain=false if you are not completely sure, if more than one choice "
            "could be right, or if the fact may be outdated. fits_topic=false if it isn't really about the topic. "
            "level_ok=false if the difficulty clearly doesn't match the level (1 easy … 4 expert). problem: short reason or ''.\n\n"
            + listing)
        try:
            checks = await ai.generate([check_prompt], schema=CHECK_SCHEMA, smart=True)
        except ai.AIUnavailable as e:
            log.warning("trivia check failed: %s", e)
            return 0
        verdict = {int(c.get("n", -1)): c for c in checks.get("checks", [])}
        kept = 0
        for n, c in enumerate(cands):
            v = verdict.get(n)
            if not v or not v.get("certain") or not v.get("fits_topic") or not v.get("level_ok") \
                    or int(v.get("my_answer_index", -1)) != c["answer"]:
                continue
            try:
                await pb.create("bg_questions", {
                    "kind": "trivia", "topic": topic, "level": c["level"], "lang": lang,
                    "q": {"q": c["q"], "choices": c["choices"], "answer": c["answer"], "explain": c["explain"]},
                    "hash": qhash(c["q"]), "status": "ok", "source": "ai", "used": 0, "reports": 0})
                kept += 1
            except PBError:
                pass  # duplicate
        log.info("trivia %s/%s: kept %d of %d", topic, lang, kept, len(cands))
        return kept


_background: set[asyncio.Task] = set()


def keep(task: asyncio.Task) -> asyncio.Task:
    """Keep a reference to background work so it finishes even if nobody waits for it."""
    _background.add(task)
    task.add_done_callback(_background.discard)
    return task


async def trivia_questions(topics: list[str], lang: str, plan: list[int], rng: random.Random,
                           budget: float = 6.0) -> list[dict]:
    """plan: the level of each question in order. Returns ready-to-play questions.

    Never waits more than `budget` seconds for the AI: slots the bank can't fill yet get a stand-in
    question (marked "fallback" with the wanted topic/level). Generation keeps running in the
    background, and the game swaps the stand-ins for real ones before they're shown (see trivia_fill)."""
    topics = [t for t in topics if t in TOPICS] or ["general"]
    order = [topics[i % len(topics)] for i in range(len(plan))]
    rng.shuffle(order)
    need: dict[tuple[str, int], int] = {}
    for t, lv in zip(order, plan):
        if t not in DATA_TOPICS:
            need[(t, lv)] = need.get((t, lv), 0) + 1
    pools: dict[tuple[str, int], list[dict]] = {}
    for (t, lv), n in need.items():
        pools[(t, lv)] = await pick_from_bank(t, lv, lang, n)
    # Top up missing buckets (one generation per topic covers all its levels).
    missing_topics = {t for (t, lv), n in need.items() if len(pools[(t, lv)]) < n}

    async def top_up(t):
        lvls = sorted({lv for (tt, lv), n in need.items() if tt == t and len(pools[(tt, lv)]) < n})
        await generate_trivia(t, lang, lvls, per_level=max(3, max(need[(t, lv)] for lv in lvls) + 1))
        for lv in lvls:
            pools[(t, lv)] = await pick_from_bank(t, lv, lang, need[(t, lv)])

    tasks = [keep(asyncio.create_task(top_up(t))) for t in missing_topics]
    if tasks:
        await asyncio.wait(tasks, timeout=budget)
    out = []
    used_ids = set()
    for t, lv in zip(order, plan):
        if t in DATA_TOPICS:
            for _ in range(20):
                qd = data_question(t, lv, lang, rng)
                if qd["qid"] not in used_ids:
                    break
            used_ids.add(qd["qid"])
            out.append(qd)
            continue
        pool = pools.get((t, lv)) or []
        if not pool:
            # Nearest level fallback, then any topic we have.
            for alt in (lv - 1, lv + 1, lv - 2, lv + 2):
                if 1 <= alt <= 4:
                    extra = await pick_from_bank(t, alt, lang, 1, exclude=used_ids)
                    if extra:
                        pool = extra
                        break
        if not pool:
            # Stand-in until the AI catches up: a data question at the same level.
            qd = data_question(rng.choice(["capitals", "flags"]), lv, lang, rng)
            qd.update({"fallback": True, "want": {"topic": t, "level": lv}})
        else:
            rec = pool.pop(0)
            qd = {"qid": rec["id"], "topic": t, "level": rec["level"], **rec["q"], "source": "ai"}
            if rec["level"] != lv:
                qd.update({"fallback": True, "want": {"topic": t, "level": lv}})
        used_ids.add(qd["qid"])
        out.append(qd)
    # Mark as used.
    for qd in out:
        if qd.get("source") == "ai":
            try:
                await pb.update("bg_questions", qd["qid"], {"used+": 1, "last_used": util.pb_now()})
            except PBError:
                pass
    return out


async def trivia_fill(slots: list[dict], lang: str, exclude: list[str], wait: bool = True) -> dict[int, dict]:
    """Real questions for stand-in slots, once the background generation is done.
    slots: [{i, topic, level}] → {i: question}. wait=False: only what the bank has right now."""
    for t in ({sl["topic"] for sl in slots} if wait else ()):
        lock = _gen_locks.setdefault((t, lang), asyncio.Lock())
        try:  # wait for a running generation of this topic (bounded)
            await asyncio.wait_for(lock.acquire(), timeout=90)
            lock.release()
        except asyncio.TimeoutError:
            pass
    used = set(exclude)
    out: dict[int, dict] = {}
    missing: list[dict] = []
    for sl in slots:
        got = await pick_from_bank(sl["topic"], sl["level"], lang, 1, exclude=used)
        if got:
            rec = got[0]
            used.add(rec["id"])
            out[sl["i"]] = {"qid": rec["id"], "topic": sl["topic"], "level": rec["level"], **rec["q"], "source": "ai"}
        else:
            missing.append(sl)
    if missing and wait:  # one more try: generate exactly what's still missing
        for t in {sl["topic"] for sl in missing}:
            lvls = sorted({sl["level"] for sl in missing if sl["topic"] == t})
            await generate_trivia(t, lang, lvls, per_level=3)
        for sl in missing:
            got = await pick_from_bank(sl["topic"], sl["level"], lang, 1, exclude=used)
            if got:
                used.add(got[0]["id"])
                out[sl["i"]] = {"qid": got[0]["id"], "topic": sl["topic"], "level": got[0]["level"], **got[0]["q"], "source": "ai"}
    for qd in out.values():
        try:
            await pb.update("bg_questions", qd["qid"], {"used+": 1, "last_used": util.pb_now()})
        except PBError:
            pass
    return out


async def pick_from_bank(topic, level, lang, n, exclude=None, kind="trivia") -> list[dict]:
    items = await pb.all("bg_questions", filter=f"kind = {q(kind)} && topic = {q(topic)} && level = {level} && "
                                                f"lang = {q(lang)} && status = 'ok'", sort="used,@random")
    items = [i for i in items if not exclude or i["id"] not in exclude]
    return items[:n]


async def report(qid: str, uid: str, reason: str, room: str):
    """A player flagged a question: remove it from the bank and remember why."""
    kind = topic = ""
    rec = None
    if util.PB_ID.match(qid or ""):
        try:
            rec = await pb.get("bg_questions", qid)
            kind, topic = rec["kind"], rec["topic"]
            await pb.update("bg_questions", qid, {"status": "reported", "reports+": 1})
        except PBError:
            rec = None
    await pb.create("bg_reports", {"question": rec["id"] if rec else "", "user": uid if util.PB_ID.match(uid) else "",
                                   "reason": (reason or "")[:1000] or f"reported ({qid})", "room": room,
                                   "kind": kind or qid.split(":")[0], "topic": topic, "status": "open"})


# ---------------------------------------------------------------------------------------------
# Background top-up (slow, to stay far inside the free quota)
# ---------------------------------------------------------------------------------------------

async def filler():
    await asyncio.sleep(120)
    while True:
        try:
            day_key = f"gen:{util.today()}"
            done = int(await pb.kv_get(day_key, 0) or 0)
            if done < 30:
                best = None
                for t in TOPICS:
                    if t in DATA_TOPICS:
                        continue
                    for lang in ("id", "en"):
                        n = len(await pb.all("bg_questions", filter=f"kind = 'trivia' && topic = {q(t)} && "
                                                                    f"lang = {q(lang)} && status = 'ok' && used = 0",
                                             fields="id"))
                        if best is None or n < best[0]:
                            best = (n, t, lang)
                if best and best[0] < 24:
                    await generate_trivia(best[1], best[2], [1, 2, 3, 4], per_level=3)
                    await pb.kv_set(day_key, done + 1)
        except Exception as e:  # noqa: BLE001
            log.warning("filler: %s", e)
        await asyncio.sleep(15 * 60)


# ---------------------------------------------------------------------------------------------
# Drawing words
# ---------------------------------------------------------------------------------------------

WORDS_SCHEMA = obj({"words": {"type": "array", "items": S}})


def builtin_words(lang: str, level: int) -> list[str]:
    with open(os.path.join(DATA, "draw_words.json")) as f:
        d = json.load(f)
    return list(d[lang][str(level)])


async def draw_words(lang: str, level: int, n: int, theme: str, rng: random.Random) -> list[str]:
    language = "Bahasa Indonesia" if lang == "id" else "English"
    guide = {1: "very easy everyday objects/animals a child can draw",
             2: "common things, actions and places",
             3: "harder: compound ideas, activities, professions, famous landmarks",
             4: "tricky: idioms, abstract-but-drawable ideas, movie or song titles"}[level]
    prompt = (f"Give {n + 6} different words or short phrases (max 3 words) in {language} for a Pictionary drawing game. "
              f"Difficulty: {guide}. Everything must be drawable and guessable. No offensive words. "
              + (f"Personal theme from the players (use it for about half of the words): {theme[:300]}." if theme else ""))
    words: list[str] = []
    try:
        data = await asyncio.wait_for(ai.generate([prompt], schema=WORDS_SCHEMA), timeout=10)
        words = [w.strip() for w in data.get("words", []) if 1 <= len(w.strip()) <= 30]
    except (ai.AIUnavailable, asyncio.TimeoutError) as e:
        log.info("draw words fallback: %s", e)
    seen, out = set(), []
    for w in words:
        k = util.norm(w)
        if k and k not in seen:
            seen.add(k)
            out.append(w)
    if len(out) < n:
        extra = builtin_words(lang, level)
        rng.shuffle(extra)
        for w in extra:
            if util.norm(w) not in seen:
                out.append(w)
                seen.add(util.norm(w))
            if len(out) >= n:
                break
    rng.shuffle(out)
    return out[:n]


# ---------------------------------------------------------------------------------------------
# Rebus puzzles
# ---------------------------------------------------------------------------------------------

REBUS_EL = obj({"t": S, "x": {"type": "number"}, "y": {"type": "number"}, "size": {"type": "number"}, "color": S,
                "rotate": {"type": "number"}, "style": S})
REBUS_SCHEMA = obj({"puzzles": {"type": "array", "items": obj({
    "answer": S, "hint": S, "level": {"type": "integer"}, "elements": {"type": "array", "items": REBUS_EL},
    "explanation": S})}})
REBUS_CHECK = obj({"checks": {"type": "array", "items": obj({
    "n": {"type": "integer"}, "my_answer": S, "solvable": {"type": "boolean"}})}})


def builtin_rebus() -> list[dict]:
    with open(os.path.join(DATA, "tebak.json")) as f:
        return json.load(f)


async def generate_rebus(lang: str, n: int = 6) -> int:
    language = "Bahasa Indonesia" if lang == "id" else "English"
    examples = [p for p in builtin_rebus() if p["lang"] == lang][:4]
    prompt = (
        f"Create {n} tricky picture riddles in {language} in the style of the Indonesian 'Tebak Gambar' app: a picture "
        "built ONLY from emoji (no words) whose parts combine into a well-known idiom, expression, compound word or food "
        "name — the fun is that the literal pictures mislead (e.g. 👅 + 🐊 = 'lidah buaya', 🦐 behind 🪨 = 'ada udang di "
        "balik batu'). Elements are placed on a 100×100 canvas (x, y = centre): t (an emoji, or '+' between parts), x, y, "
        "size (10-50), color ('' for emoji), rotate (degrees), style ('' or 'big', 'small', 'mirror'). Use positions for "
        "behind / inside / on top. The answer must be solvable by clever adults. level 1-4. hint: a short clue to the "
        "meaning. explanation: how to read it.\nExamples (JSON): " + json.dumps(examples, ensure_ascii=False))
    try:
        data = await ai.generate([prompt], schema=REBUS_SCHEMA, smart=True)
    except ai.AIUnavailable:
        return 0
    cands = [p for p in data.get("puzzles", []) if p.get("answer") and p.get("elements")]
    if not cands:
        return 0
    listing = "\n".join(f"{i}. " + json.dumps(p["elements"], ensure_ascii=False) for i, p in enumerate(cands))
    try:
        chk = await ai.generate([f"Solve these rebus puzzles ({language}). Each is a list of text/emoji elements with "
                                 f"positions and styles on a 100×100 canvas. Give your answer and whether it's fairly "
                                 f"solvable.\n{listing}"], schema=REBUS_CHECK)
    except ai.AIUnavailable:
        return 0
    verdict = {int(c.get("n", -1)): c for c in chk.get("checks", [])}
    kept = 0
    for i, p in enumerate(cands):
        v = verdict.get(i)
        if not v or not v.get("solvable") or not util.close_enough(v.get("my_answer", ""), p["answer"])[0]:
            continue
        try:
            await pb.create("bg_questions", {"kind": "rebus", "topic": "tebak", "level": max(1, min(4, int(p.get("level", 2)))),
                                             "lang": lang, "q": {"answer": p["answer"], "hint": p.get("hint", ""),
                                                                 "elements": p["elements"], "explain": p.get("explanation", "")},
                                             "hash": qhash("rebus " + p["answer"]), "status": "ok", "source": "ai",
                                             "used": 0, "reports": 0})
            kept += 1
        except PBError:
            pass
    return kept


async def rebus_puzzles(lang: str, n: int, use_ai: bool, rng: random.Random) -> list[dict]:
    out: list[dict] = []
    if use_ai:
        bank = await pb.all("bg_questions", filter=f"kind = 'rebus' && topic = 'tebak' && lang = {q(lang)} && status = 'ok'",
                            sort="used,@random")
        if len(bank) < n:
            # New AI puzzles for next time; wait a little, the built-in bank fills the rest now.
            await asyncio.wait([keep(asyncio.create_task(generate_rebus(lang, max(6, n))))], timeout=8)
            bank = await pb.all("bg_questions", filter=f"kind = 'rebus' && topic = 'tebak' && lang = {q(lang)} && status = 'ok'",
                                sort="used,@random")
        for rec in bank[: n // 2]:
            out.append({"qid": rec["id"], "level": rec["level"], **rec["q"], "source": "ai"})
            try:
                await pb.update("bg_questions", rec["id"], {"used+": 1, "last_used": util.pb_now()})
            except PBError:
                pass
    builtin = [p for p in builtin_rebus() if p["lang"] == lang]
    rng.shuffle(builtin)
    for p in builtin:
        if len(out) >= n:
            break
        out.append({"qid": f"b:{p['answer']}", **p, "source": "builtin"})
    rng.shuffle(out)
    out.sort(key=lambda p: p.get("level", 2))
    return out[:n]

