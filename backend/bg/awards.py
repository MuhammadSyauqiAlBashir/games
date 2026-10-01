"""End-of-game fun: awards from the game's stats, a (kind) roast for the last place,
an optional loser dare, and records for history, leaderboards and monthly titles."""

from __future__ import annotations

import logging
import random

from . import util
from .pb import PBError, pb, q

log = logging.getLogger("bg.awards")

# stat key → (emoji, title id, title en, higher is better)
AWARDS = {
    "sixes": ("🍀", "Si Paling Hoki", "Lucky Sixes", True),
    "captures": ("🥾", "Tukang Tendang", "The Kicker", True),
    "captured": ("😵", "Langganan Balik Kandang", "Frequent Flyer Home", True),
    "snakes": ("🐍", "Digigit Ular Terus", "Snake Magnet", True),
    "ladders": ("🪜", "Raja Tangga", "Ladder King", True),
    "kings": ("👑", "Pencetak Raja", "Kingmaker", True),
    "sos": ("🆘", "Mesin SOS", "SOS Machine", True),
    "plus4": ("😈", "Paling Tega (+4)", "No Mercy (+4)", True),
    "caught": ("🕵️", "Mata Elang UNO", "UNO Hawk-eye", True),
    "drawn": ("🃏", "Kolektor Kartu", "Card Collector", True),
    "nyangkul": ("⛏️", "Tukang Nyangkul", "Master Digger", True),
    "biggest_pot": ("💰", "Pot Terbesar", "Biggest Pot", True),
    "allins": ("🔥", "Nekat All-in", "All-in Daredevil", True),
    "best_streak": ("⚡", "Beruntun", "On a Streak", True),
    "fastest": ("🏎️", "Paling Cepat", "Fastest Answer", False),
    "words": ("📚", "Kamus Berjalan", "Walking Dictionary", True),
    "longest": ("📏", "Kata Terpanjang", "Longest Word", True),
    "guessed": ("🔎", "Penebak Jitu", "Sharp Guesser", True),
    "drawn_guessed": ("🎨", "Pelukis Jelas", "Clear Artist", True),
    "ai_wins": ("🤖", "Favorit Juri AI", "AI Judge's Pet", True),
    "saves": ("🧤", "Kiper Tembok", "Brick-Wall Keeper", True),
    "goals": ("🎯", "Penendang Tajam", "Sharp Shooter", True),
    "kills": ("🗡️", "Pemburu Ular", "Snake Hunter", True),
    "max_length": ("🐉", "Ular Terpanjang", "Longest Snake", True),
    "rent_got": ("🏠", "Juragan Kos", "Landlord", True),
    "built": ("🏗️", "Developer", "Developer", True),
    "jailed": ("🚔", "Langganan Penjara", "Jailbird", True),
    "trades": ("🤝", "Makelar", "Deal Maker", True),
    "sequences": ("🔗", "Sequence Master", "Sequence Master", True),
    "removed": ("✂️", "Si Penghapus", "The Eraser", True),
    "rounds_won": ("🏅", "Juara Ronde", "Round Winner", True),
    "correct": ("✅", "Paling Banyak Benar", "Most Correct", True),
    "mini_wins": ("🏆", "Raja Minigame", "Minigame Champ", True),
    "normal_answers": ("🤓", "Terlalu Normal", "Way Too Normal", True),
    "first": ("👀", "Mata Elang", "Eagle Eye", True),
    "buzz": ("🔔", "Tercepat Pencet Bel", "Fastest Buzzer", True),
    "boomed": ("💥", "Langganan Meledak", "Bob-omb Magnet", True),
    "bombs": ("💣", "Dapat Bom Terus", "Bomb Collector", True),
    "pounds": ("🔨", "Palu Jitu", "Hammer Time", True),
    "dodges": ("🫥", "Ahli Sembunyi", "Hide-and-Seek Pro", True),
    "closest": ("🛷", "Rem Paling Pas", "Perfect Stop", True),
    "splash": ("💦", "Nyebur Terus", "Splash Zone", True),
    "reaction": ("⚡", "Refleks Kilat", "Lightning Reflexes", False),
    "snapped": ("🥫", "Dapat Kaleng", "Tin-Can Catcher", True),
    "oops": ("🌺", "Salah Gerak", "Wrong Move", True),
    "pairs": ("🚪", "Ingatan Gajah", "Elephant Memory", True),
}

ROASTS_ID = [
    "Tenang, kalah itu cuma menang yang tertunda… lamaaa banget tertundanya. 😅",
    "Juara bertahan… di posisi terakhir. 🏅",
    "Yang penting ikut main. Iya kan? Iya kan?? 🙃",
    "Hari ini bukan harimu. Besok juga belum tentu. 😜",
    "Strategi rahasia: bikin lawan kasihan. Berhasil? Belum. 😂",
    "Tidak apa-apa, kekalahan ini sudah dicatat sejarah (dan leaderboard). 📜",
    "Kamu bukan kalah, kamu memberi kesempatan orang lain bahagia. 💝",
]
ROASTS_EN = [
    "Losing is just winning that's been delayed… by a lot. 😅",
    "Reigning champion… of last place. 🏅",
    "It's about taking part. Right? Right?? 🙃",
    "Not your day. Tomorrow's not looking great either. 😜",
    "Secret strategy: make everyone feel sorry for you. Working? Not yet. 😂",
    "Don't worry, this defeat has been recorded in history (and the leaderboard). 📜",
    "You didn't lose — you let others be happy. 💝",
]

DEFAULT_DARES = [
    ("Traktir kopi/boba untuk pemenang ☕", "Buy the winner a coffee/boba ☕"),
    ("Pijat bahu pemenang 5 menit 💆", "Give the winner a 5-minute shoulder massage 💆"),
    ("Cuci piring malam ini 🍽️", "Do the dishes tonight 🍽️"),
    ("Nyanyi reff lagu pilihan pemenang 🎤", "Sing a chorus of the winner's choice 🎤"),
    ("Pakai status WA pilihan pemenang selama 1 jam 📱", "Use a WhatsApp status the winner picks for 1 hour 📱"),
    ("Pemenang pilih menu makan malam 🍜", "The winner picks dinner 🍜"),
    ("Joget 15 detik di video call berikutnya 💃", "Dance for 15 seconds on the next video call 💃"),
    ("Buatkan minuman untuk semua pemain 🧋", "Make drinks for everyone 🧋"),
    ("Kirim pujian tulus ke pemenang lewat chat 💌", "Send the winner a sincere compliment 💌"),
    ("Pemenang pilih film yang ditonton berikutnya 🎬", "The winner picks the next movie 🎬"),
    ("Bawa camilan untuk main berikutnya 🍿", "Bring snacks for the next game night 🍿"),
    ("Bilang 'kamu memang hebat' ke pemenang, serius 😌", "Tell the winner 'you really are the best', seriously 😌"),
]


def fmt_stat(key: str, v) -> str:
    if key == "biggest_pot" or key == "rent_got":
        return "Rp" + f"{int(v):,}".replace(",", ".")
    if key == "fastest":
        return f"{v:.1f} s"
    if key == "reaction":
        return f"{int(v * 1000)} ms"
    return str(v)


def compute_awards(players: list[dict], stats: dict) -> list[dict]:
    names = {p["id"]: p for p in players}
    out = []
    for key, vals in (stats or {}).items():
        meta = AWARDS.get(key)
        if not meta or not vals:
            continue
        emoji, t_id, t_en, higher = meta
        vals = {p: v for p, v in vals.items() if p in names and v}
        if not vals:
            continue
        best = max(vals.values()) if higher else min(vals.values())
        winners = [p for p, v in vals.items() if v == best]
        if len(winners) > 2:
            continue
        for p in winners:
            out.append({"id": p, "emoji": emoji, "title_id": t_id, "title_en": t_en, "value": fmt_stat(key, best)})
    return out[:8]


async def dare_for(room, loser: dict) -> dict | None:
    items = await pb.all("bg_dares", filter="active = true")
    pool = [(d["text"], d["text"]) for d in items] or DEFAULT_DARES
    text_id, text_en = random.choice(pool)
    return {"id": loser["id"], "name": loser["name"], "text_id": text_id, "text_en": text_en}


async def on_finish(room, players: list[dict], stats: dict) -> dict:
    ranked = sorted(players, key=lambda p: p["rank"])
    winners = [p["id"] for p in ranked if p["rank"] == 1]
    info = {"awards": compute_awards(players, stats), "roast_id": "", "roast_en": "", "dare": None}
    if len(ranked) >= 2 and ranked[-1]["rank"] > 1:
        info["roast_id"] = random.choice(ROASTS_ID)
        info["roast_en"] = random.choice(ROASTS_EN)
        loser = ranked[-1]
        if room.options.get("_dare"):
            info["dare"] = await dare_for(room, loser)
    try:
        started = room.started_at
        rec = await pb.create("bg_matches", {
            "game": room.game_key, "room": room.code, "mode": room.mode, "players": players, "winners": winners,
            "started": util.pb_now() if not started else _iso(started), "ended": util.pb_now(),
            "duration": int(room.clock()), "stats": {"stats": stats, "awards": info["awards"]}})
        if info["dare"]:
            d = info["dare"]
            await pb.create("bg_dare_log", {"match": rec["id"], "user": d["id"], "game": room.game_key,
                                            "text": d["text_id"], "done": False})
    except PBError as e:
        log.warning("record match: %s", e)
    return info


def _iso(ts: float) -> str:
    from datetime import datetime, timezone  # noqa: PLC0415
    return datetime.fromtimestamp(ts, timezone.utc).strftime("%Y-%m-%d %H:%M:%S.000Z")


# ---------------------------------------------------------------------------------------------------------
# History, leaderboards, titles
# ---------------------------------------------------------------------------------------------------------

TITLES = {
    "ludo": ("Raja Ludo", "Ludo Royalty"), "ulartangga": ("Pawang Ular", "Snake Charmer"), "uno": ("Sultan UNO", "UNO Sultan"),
    "monopoly": ("Juragan Properti", "Property Tycoon"), "sequence": ("Ahli Strategi", "Grand Strategist"),
    "poker": ("Bandar Poker", "Poker Shark"), "gaple": ("Jagoan Gaple", "Domino Boss"), "congklak": ("Ratu/Raja Congklak", "Congklak Champ"),
    "checkers": ("Grandmaster Dam", "Checkers Grandmaster"), "connect4": ("Si Empat Sejajar", "Four-in-a-Row Pro"),
    "sos": ("Mesin SOS", "SOS Machine"), "tictactoe": ("Si Paling XO", "XO Legend"), "trivia": ("Profesor Trivia", "Trivia Professor"),
    "math": ("Profesor Matematika", "Math Professor"), "rebus": ("Detektif Kata", "Word Detective"),
    "anagrams": ("Kamus Berjalan", "Walking Dictionary"), "drawguess": ("Picasso Gagal", "Almost-Picasso"),
    "drawjudge": ("Kesayangan Juri AI", "AI Judge's Darling"), "penalty": ("Algojo Penalti", "Penalty King"),
    "snake": ("Naga Arena", "Arena Dragon"),
}


async def matches(since: str = "", game: str = "") -> list[dict]:
    parts = []
    if since:
        parts.append(f"ended >= {q(since)}")
    if game:
        parts.append(f"game = {q(game)}")
    return await pb.all("bg_matches", filter=" && ".join(parts), sort="-ended",
                        fields="id,game,players,winners,ended,duration,mode,room")


def leaderboard(items: list[dict]) -> list[dict]:
    rows: dict[str, dict] = {}
    for m in items:
        for p in m.get("players") or []:
            r = rows.setdefault(p["id"], {"id": p["id"], "name": p["name"], "avatar": p.get("avatar"), "color": p.get("color"),
                                          "played": 0, "wins": 0, "podium": 0})
            r["name"], r["avatar"], r["color"] = p["name"], p.get("avatar"), p.get("color")
            r["played"] += 1
            if p["id"] in (m.get("winners") or []):
                r["wins"] += 1
            if p.get("rank", 9) <= 2:
                r["podium"] += 1
    for r in rows.values():
        r["rate"] = round(100 * r["wins"] / r["played"]) if r["played"] else 0
    return sorted(rows.values(), key=lambda r: (-r["wins"], -r["rate"], -r["played"]))


async def titles_this_month() -> list[dict]:
    since = util.now_local().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    items = await matches(since.astimezone(__import__("datetime").timezone.utc).strftime("%Y-%m-%d %H:%M:%S.000Z"))
    by_game: dict[str, list] = {}
    for m in items:
        by_game.setdefault(m["game"], []).append(m)
    out = []
    for game, ms in by_game.items():
        lb = leaderboard(ms)
        if lb and lb[0]["wins"] > 0 and (len(lb) == 1 or lb[0]["wins"] > lb[1]["wins"]):
            t_id, t_en = TITLES.get(game, ("Juara", "Champion"))
            out.append({"game": game, "id": lb[0]["id"], "name": lb[0]["name"], "avatar": lb[0]["avatar"],
                        "title_id": t_id, "title_en": t_en, "wins": lb[0]["wins"]})
    return out
