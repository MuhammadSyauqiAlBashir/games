"""Build backend/bg/data/rebus.json — the built-in rebus (picture-word) puzzles.
Elements: t (text/emoji), x, y (centre on a 100×100 canvas), size, color, rotate, style
(bold, mirror, strike, up, down, small, big, line, box, circle)."""
import json
import os

INK, RED, BLUE, GREEN = "#2b2622", "#c8453a", "#2f6fb0", "#3f8a4f"


def el(t, x=50, y=50, size=16, color=INK, rotate=0, style=""):
    return {"t": t, "x": x, "y": y, "size": size, "color": color, "rotate": rotate, "style": style}


def line(y):
    return el("", 50, y, 0, INK, 0, "line")


def over(top, bottom, answer, hint, level=2, alts=()):
    return {"answer": answer, "alts": list(alts), "hint": hint, "level": level,
            "elements": [el(top, 50, 36, 16, INK, 0, "bold"), line(50), el(bottom, 50, 64, 16)]}


def one(elements, answer, hint, level=2, alts=()):
    return {"answer": answer, "alts": list(alts), "hint": hint, "level": level, "elements": elements}


EN = [
    over("MIND", "MATTER", "mind over matter", "a saying"),
    over("HEAD", "HEELS", "head over heels", "in love", 1),
    over("MAN", "BOARD", "man overboard", "on a ship", 2),
    over("BRIDGE", "WATER", "water under the bridge", "forgive and forget", 3),
    over("COVER", "AGENT", "undercover agent", "a spy", 3),
    over("STAND", "I", "I understand", "you get it", 1),
    over("WEATHER", "🤒", "under the weather", "feeling sick", 2),
    over("ARREST", "YOU", "you are under arrest", "police", 3, ["you're under arrest"]),
    over("SKATING", "ice", "skating on thin ice", "risky", 3),
    over("ESTIMATE", "UNDER", "underestimate", "think too little of", 3),
    one([el("E", 30, 50, 34, RED, 0, "bold"), el("GO GO", 70, 50, 16, INK)], "ready to go", "let's leave!", 2),
    one([el("SEAS " * 1, x, y, 11) for x, y in [(22, 30), (50, 30), (78, 30), (22, 55), (50, 55), (78, 55), (50, 78)]],
        "seven seas", "sailing", 2, ["the seven seas"]),
    one([el("TIME", 32, 50, 18), el("TIME", 68, 50, 18)], "time after time", "again and again", 2),
    one([el("DAY", 32, 50, 18), el("DAY", 68, 50, 18)], "day after day", "every day", 1),
    one([el("SIDE", 32, 50, 18), el("SIDE", 68, 50, 18)], "side by side", "together", 1),
    one([el("DEAL", 50, 50, 40, INK, 0, "bold")], "big deal", "so what?", 1),
    one([el("potatoes", 50, 50, 6)], "small potatoes", "not important", 3),
    one([el("talk", 50, 50, 6)], "small talk", "chit-chat", 2),
    one([el("SHOT", 50, 50, 40, INK, 0, "bold")], "big shot", "an important person", 2),
    one([el("PEDAL", 50, 50, 18, INK, 0, "mirror")], "backpedal", "change your mind", 3, ["back pedal"]),
    one([el("FIRE", 50, 50, 20, RED, 0, "mirror")], "backfire", "plan goes wrong", 2, ["back fire"]),
    one([el("TRACK", 50, 50, 18, INK, 0, "mirror")], "backtrack", "go back", 3, ["back track"]),
    one([el("TOWN", 50, 50, 18, INK, 0, "up")], "uptown", "part of the city", 2),
    one([el("TOWN", 50, 50, 18, INK, 0, "down")], "downtown", "city centre", 1),
    one([el("STAIRS", 50, 50, 16, INK, 0, "down")], "downstairs", "lower floor", 1),
    one([el("HILL", 50, 50, 18, INK, 0, "down")], "downhill", "getting worse", 2),
    one([el("SIDE", 50, 50, 22, INK, 180)], "upside down", "flipped", 1, ["upside-down"]),
    one([el("DATE", 50, 50, 18, INK, 0, "up")], "update", "new version", 1),
    one([el("LOAD", 50, 50, 18, INK, 0, "down")], "download", "get a file", 1),
    one([el("GRADE", 50, 50, 18, INK, 0, "up")], "upgrade", "better model", 2),
    one([el("HE", 38, 44, 18, RED, -12), el("ART", 64, 56, 18, RED, 12)], "broken heart", "sad love", 2),
    one([el("PROM", 34, 46, 16, INK, -10), el("ISE", 66, 56, 16, INK, 10)], "broken promise", "didn't keep your word", 3),
    one([el("ROADS", 50, 50, 16), el("ROADS", 50, 50, 16, INK, 90)], "crossroads", "decide which way", 2),
    one([el("WORD", 50, 50, 16), el("WORD", 50, 50, 16, INK, 90)], "crossword", "a puzzle", 1),
    one([line(28), el("READING", 50, 50, 16), line(72)], "reading between the lines", "hidden meaning", 3),
    one([el("", 50, 50, 0, INK, 0, "box"), el("THINK", 50, 14, 14, INK, 0, "bold")], "think outside the box", "be creative", 2),
    one([el("🌧️", 50, 24, 20), el("🐱", 35, 62, 18), el("🐶", 65, 62, 18)], "raining cats and dogs", "heavy rain", 1,
        ["it's raining cats and dogs"]),
    one([el("🍰", 50, 50, 34)], "piece of cake", "very easy", 1, ["a piece of cake"]),
    one([el("🔨", 35, 50, 24), el("🧊", 65, 50, 24)], "break the ice", "start a conversation", 1),
    one([el("🛋️", 38, 50, 24), el("🥔", 66, 50, 24)], "couch potato", "lazy on the sofa", 1),
    one([el("", 50, 55, 0, INK, 0, "box"), el("🐘", 50, 55, 26), el("ROOM", 50, 14, 12, INK, 0, "bold")],
        "elephant in the room", "the obvious problem nobody mentions", 2, ["the elephant in the room"]),
    one([el("🥶", 50, 30, 20), el("🦶🦶", 50, 66, 20)], "cold feet", "nervous before a big step", 2),
    one([el("⏰", 30, 50, 24), el("=", 50, 50, 20), el("💰", 70, 50, 24)], "time is money", "don't waste it", 1),
    one([el("🍎", 35, 50, 24), el("👁️", 66, 50, 24)], "apple of my eye", "someone you love most", 2,
        ["the apple of my eye", "apple of your eye"]),
    one([el("🐦🐦", 38, 42, 20), el("🪨", 70, 60, 20)], "kill two birds with one stone", "do two things at once", 2,
        ["two birds one stone", "two birds with one stone"]),
    one([el("ONCE", 50, 26, 14, INK, 0, "bold"), el("🌕", 50, 62, 30, BLUE)], "once in a blue moon", "very rarely", 3),
    one([el("🫘", 45, 50, 22, INK, 30), el("BEANS", 58, 70, 10, INK, 25)], "spill the beans", "tell the secret", 2),
    one([el("📖", 50, 44, 30), el("COVER", 50, 78, 10, INK, 0, "strike")], "don't judge a book by its cover",
        "looks can deceive", 3, ["dont judge a book by its cover"]),
    one([el("🌙", 30, 50, 24), el("🚶", 60, 50, 24)], "moonwalk", "Michael Jackson", 2, ["moon walk"]),
    one([el("🐝", 35, 50, 24), el("📍", 66, 50, 24)], "be there", "come on time", 3, ["bee there"]),
    one([el("🧠", 35, 50, 22), el("⛈️", 66, 50, 22)], "brainstorm", "ideas session", 1, ["brain storm"]),
    one([el("⭐", 30, 50, 22), el("🐟", 64, 50, 24)], "starfish", "sea animal", 1, ["star fish"]),
    one([el("🔥", 30, 50, 22), el("🪰", 64, 50, 22)], "firefly", "glowing insect", 1, ["fire fly"]),
    one([el("🌈", 50, 36, 28), el("🐟", 50, 72, 20)], "rainbow fish", "a colourful fish", 2),
    one([el("🍯", 34, 50, 22), el("🌙", 66, 50, 22)], "honeymoon", "after the wedding", 1, ["honey moon"]),
]

ID = [
    one([el("👁️", 32, 50, 26), el("📅", 68, 50, 26)], "matahari", "terbit di timur", 1),
    one([el("🏠", 32, 50, 26), el("🤒", 68, 50, 26)], "rumah sakit", "tempat dokter", 1),
    one([el("🚃", 32, 50, 26), el("🔥", 68, 50, 26)], "kereta api", "naik dari stasiun", 1),
    one([el("💧", 32, 50, 26), el("👁️", 68, 50, 26)], "air mata", "keluar saat sedih", 1),
    one([el("👁️", 32, 50, 26), el("💧", 68, 50, 26)], "mata air", "sumber air", 2),
    one([el("🍎", 32, 50, 26), el("❤️", 68, 50, 26)], "buah hati", "anak tersayang", 2),
    one([el("✋", 32, 50, 26), el("➡️", 68, 50, 26)], "tangan kanan", "orang kepercayaan", 2),
    one([el("🐐", 32, 50, 26), el("⬛", 68, 50, 22)], "kambing hitam", "yang disalahkan", 2),
    one([el("KUTU", 32, 50, 14, INK, 0, "bold"), el("📚", 70, 50, 26)], "kutu buku", "suka membaca", 1),
    one([el("🧼", 32, 50, 26), el("👁️", 68, 50, 26)], "cuci mata", "jalan-jalan lihat yang indah", 2),
    one([el("🏠", 32, 50, 26), el("🍽️", 68, 50, 26)], "rumah makan", "tempat makan", 1),
    one([el("🧹", 32, 50, 26), el("✋", 68, 50, 26)], "sapu tangan", "untuk lap keringat", 2),
    one([el("🟫", 32, 50, 22), el("💧", 68, 50, 26)], "tanah air", "negeri sendiri", 2),
    one([el("⬆️", 32, 50, 24), el("🩸", 68, 50, 26)], "naik darah", "marah", 2),
    one([el("⏰", 32, 50, 26), el("✋", 68, 50, 26)], "jam tangan", "dipakai di pergelangan", 1),
    one([el("⚽", 32, 50, 26), el("👁️", 68, 50, 26)], "bola mata", "bagian mata", 1),
    one([el("MEJA", 50, 50, 26, GREEN, 0, "bold")], "meja hijau", "pengadilan", 3),
    one([el("👶", 32, 50, 26), el("🥇", 68, 50, 26)], "anak emas", "yang paling disayang", 2),
    one([el("KEPALA", 36, 50, 13, INK, 0, "bold"), el("🪨", 74, 50, 24)], "kepala batu", "keras kepala", 2),
    one([el("🦐", 32, 50, 26), el("🧠", 68, 50, 26)], "otak udang", "kurang pintar", 2),
    one([el("🌸", 32, 50, 26), el("🏘️", 68, 50, 26)], "bunga desa", "gadis tercantik di kampung", 3),
    one([el("⏰", 32, 50, 26), el("KARET", 70, 50, 13, INK, 0, "bold")], "jam karet", "suka telat", 2),
    one([el("⬆️", 32, 50, 24), el("🍃", 68, 50, 26)], "naik daun", "sedang terkenal", 2),
    one([el("TANGAN", 50, 50, 26, INK, 0, "big")], "panjang tangan", "suka mencuri", 3),
    one([el("🐊", 32, 50, 26), el("😢", 68, 50, 26)], "air mata buaya", "pura-pura sedih", 2),
    one([el("🏠", 32, 50, 26), el("🪜", 68, 50, 26)], "rumah tangga", "keluarga", 2),
    one([el("🐍", 32, 50, 26), el("🪜", 68, 50, 26)], "ular tangga", "permainan dadu", 1),
    one([el("☕", 32, 50, 26), el("🥛", 68, 50, 26)], "kopi susu", "minuman", 1),
    one([el("🍚", 32, 50, 26), el("🍳", 68, 50, 26)], "nasi goreng", "makanan favorit", 1),
    one([el("🐟", 32, 50, 26), el("🧂", 68, 50, 26)], "ikan asin", "lauk kering", 1),
    one([el("🍌", 32, 50, 26), el("🍳", 68, 50, 26)], "pisang goreng", "gorengan manis", 1),
    one([el("🐔", 32, 50, 26), el("🍳", 68, 50, 26)], "ayam goreng", "lauk renyah", 1),
    one([el("🌙", 32, 50, 26), el("🍯", 68, 50, 26)], "bulan madu", "setelah menikah", 2),
    one([el("🔑", 32, 50, 26), el("✍️", 68, 50, 26)], "kunci jawaban", "contekan", 3, ["kunci tulisan"]),
    one([el("💡", 50, 50, 34), el("TERANG", 50, 82, 10)], "lampu terang", "tidak gelap", 1),
    one([el("TANGAN", 50, 50, 10, INK, 0, "small"), el("🪶", 78, 50, 18)], "ringan tangan", "suka membantu", 3),
]

out = [{**p, "lang": "en"} for p in EN] + [{**p, "lang": "id"} for p in ID]
path = os.path.join(os.path.dirname(__file__), "..", "backend", "bg", "data", "rebus.json")
json.dump(out, open(path, "w"), ensure_ascii=False, indent=0)
print(len(EN), "english,", len(ID), "indonesian")
