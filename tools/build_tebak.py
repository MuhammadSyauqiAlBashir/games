"""Builds data/tebak.json: tricky picture riddles in the style of the Indonesian "Tebak Gambar" app.

Each riddle is written as a small picture formula:
  "👅 + 🐊"      tiles in a row with plus signs
  "🦶x5"         repeated picture
  "big:🧀"       style prefix (big, small, mirror, up, down)
  "🦐<🪨"        A hidden behind B
  "🐸@🥥"        A inside B
  "🪜^🤕"        A on top of B
  "🐟!💧"        A jumping out of B
Run:  python tools/build_tebak.py
"""

import json
import os

ID = [
    # answer, formula, hint, explanation, level, alts
    ("lidah buaya", "👅 + 🐊", "tanaman obat", "Lidah (👅) + buaya (🐊) = tanaman lidah buaya", 1),
    ("telur mata sapi", "🥚 + 👁️ + 🐄", "lauk sarapan", "Telur + mata + sapi = telur ceplok", 1),
    ("kaki lima", "🦶x5", "pedagang pinggir jalan", "Lima kaki = (pedagang) kaki lima", 1),
    ("buah tangan", "🍎 + ✋", "dibawa pulang dari liburan", "Buah + tangan = oleh-oleh", 1),
    ("kambing hitam", "🐐 + ⬛", "yang disalahkan", "Kambing + hitam = orang yang dijadikan sasaran kesalahan", 1),
    ("buaya darat", "🐊 + 🏜️", "suka gonta-ganti pacar", "Buaya + darat", 1),
    ("otak udang", "🧠 + 🦐", "lambat berpikir", "Otak + udang = bodoh", 1),
    ("mata duitan", "👁️ + 💵", "cinta uang", "Mata + duit(an)", 1),
    ("muka tembok", "😐 + 🧱", "tidak tahu malu", "Muka + tembok", 2),
    ("cuci mata", "🧼 + 👁️", "jalan-jalan lihat yang indah", "Cuci + mata", 2),
    ("makan angin", "🍽️ + 🌬️", "jalan-jalan santai", "Makan + angin", 2),
    ("naik darah", "⬆️ + 🩸", "marah", "Naik + darah", 2),
    ("kabar burung", "📰 + 🐦", "gosip yang belum pasti", "Kabar + burung", 2),
    ("kabar angin", "📰 + 🌬️", "berita belum jelas", "Kabar + angin", 2),
    ("hidung belang", "👃 + 🦓", "suka menggoda", "Hidung + belang (zebra)", 2),
    ("tangan kanan", "✋ + ➡️", "orang kepercayaan", "Tangan + kanan", 2),
    ("mata air", "👁️ + 💧", "sumber air", "Mata + air", 1),
    ("kaki gunung", "🦶 + ⛰️", "bagian bawah gunung", "Kaki + gunung", 1),
    ("angkat kaki", "🏋️ + 🦶", "pergi", "Angkat + kaki = pergi", 2),
    ("patah hati", "✂️ + ❤️", "putus cinta", "Patah + hati", 1),
    ("kuping gajah", "👂 + 🐘", "kue kering cokelat", "Kuping + gajah = nama kue", 2),
    ("rambut nenek", "💇 + 👵", "jajanan manis berserabut", "Rambut + nenek = kembang gula rambut nenek", 3),
    ("kumis kucing", "🥸 + 🐱", "tanaman herbal", "Kumis + kucing", 3),
    ("lidah kucing", "🍪 + 👅 + 🐱", "kue lebaran", "Kue + lidah + kucing", 2),
    ("lampu merah", "💡 + 🟥", "berhenti!", "Lampu + merah", 1),
    ("lampu hijau", "💡 + 🟩", "diberi izin", "Lampu + hijau = izin", 2),
    ("jalan tikus", "🛣️ + 🐭", "jalan pintas", "Jalan + tikus", 2),
    ("uang muka", "💰 + 😀", "DP", "Uang + muka = DP", 2),
    ("uang saku", "💰 + 👖", "jajan anak sekolah", "Uang + saku", 2),
    ("kepala dua", "👦x2", "umur 20-an", "Dua kepala = berkepala dua", 3),
    ("tangan dingin", "✋ + 🥶", "selalu berhasil merawat/mengurus", "Tangan + dingin", 3),
    ("darah biru", "🩸 + 🟦", "keturunan bangsawan", "Darah + biru", 2),
    ("anak emas", "👶 + 🪙", "anak kesayangan", "Anak + emas", 2),
    ("kaki tangan", "🦶 + ✋", "komplotan", "Kaki + tangan", 2),
    ("tikus kantor", "🐭 + 🏢", "koruptor", "Tikus + kantor", 2),
    ("banting tulang", "💥 + 🦴", "kerja keras", "Banting + tulang", 3),
    ("ada udang di balik batu", "🦐<🪨", "ada maksud tersembunyi", "Udangnya ada di balik batu", 2),
    ("sudah jatuh tertimpa tangga", "🪜^🤕", "sial berturut-turut", "Jatuh, lalu tertimpa tangga", 3),
    ("katak dalam tempurung", "🐸@🥥", "pengetahuannya sempit", "Katak di dalam tempurung kelapa", 3),
    ("nasi sudah menjadi bubur", "🍚 + ➡️ + 🥣", "sudah terlambat menyesal", "Nasi → bubur", 2),
    ("air mata buaya", "💧 + 👁️ + 🐊", "pura-pura sedih", "Air + mata + buaya", 3),
    ("musuh dalam selimut", "😈@🛌", "pengkhianat dari dalam", "Musuh di dalam selimut", 3),
    ("bagai pinang dibelah dua", "🥥 + 🔪 + 2️⃣", "mirip sekali", "Pinang dibelah dua", 4),
    ("anjing dan kucing", "🐶 + ⚔️ + 🐱", "selalu bertengkar", "Seperti anjing dan kucing", 2),
    ("gajah di pelupuk mata", "🐘<👁️", "kesalahan sendiri tak terlihat", "Gajah di pelupuk mata tak tampak", 4),
    ("bunga desa", "🌸 + 🏘️", "gadis tercantik di kampung", "Bunga + desa", 2),
    ("sapi perah", "🐄 + 🥛", "dimanfaatkan terus", "Sapi + perah", 2),
    ("kursi panas", "🪑 + 🔥", "jabatan yang rawan", "Kursi + panas", 2),
    ("lepas tangan", "🔓 + ✋", "tak mau bertanggung jawab", "Lepas + tangan", 3),
    ("rumah makan", "🏠 + 🍽️", "restoran", "Rumah + makan", 1),
    ("kereta api", "🚃 + 🔥", "kendaraan di atas rel", "Kereta + api", 1),
    ("bom waktu", "💣 + ⏰", "masalah yang bisa meledak nanti", "Bom + waktu", 2),
    ("ringan tangan", "🪶 + ✋", "suka menolong", "Ringan + tangan", 3),
    ("muka dua", "😀 + 😠", "tidak tulus", "Dua muka = bermuka dua", 2, ["bermuka dua"]),
    ("tinggi hati", "🦒 + ❤️", "sombong", "Tinggi (jerapah) + hati", 3),
    ("keras kepala", "🪨 + 👦", "susah dinasihati", "Keras (batu) + kepala", 2, ["kepala batu"]),
    ("besar kepala", "🔍 + 👦", "sombong", "Kepala diperbesar", 3),
    ("panjang tangan", "📏 + ✋", "suka mencuri", "Panjang + tangan", 2),
    ("tangan besi", "✋ + 🔩", "pemimpin yang keras", "Tangan + besi", 3),
    ("mata keranjang", "👁️ + 🧺", "suka melirik lawan jenis", "Mata + keranjang", 2),
    ("buah bibir", "🍎 + 👄", "bahan omongan orang", "Buah + bibir", 2),
    ("naik daun", "⬆️ + 🍃", "sedang populer", "Naik + daun", 2),
    ("jatuh hati", "⬇️ + ❤️", "mulai suka", "Jatuh + hati", 2),
    ("buang air", "🗑️ + 💧", "ke toilet", "Buang + air", 1),
    ("telinga tipis", "👂 + 📄", "mudah tersinggung", "Telinga + tipis (kertas)", 3),
    ("harga mati", "🏷️ + 💀", "tidak bisa ditawar", "Harga + mati", 3),
    ("tangan kosong", "✋ + 0️⃣", "tidak membawa apa-apa", "Tangan + kosong (nol)", 2),
    ("batu loncatan", "🪨 + 🦘", "langkah awal menuju tujuan", "Batu + loncat(an)", 3),
    ("cari muka", "🔍 + 😀", "mengambil hati atasan", "Cari + muka", 3),
    ("adu domba", "🥊 + 🐑x2", "memecah belah", "Adu + domba", 3),
    ("kepala keluarga", "👦 + 👨‍👩‍👧", "ayah", "Kepala + keluarga", 2),
    ("ayam jago", "🐓 + 🏆", "andalan", "Ayam + jago (juara)", 2),
    ("orang dalam", "🧍@🏢", "koneksi di dalam", "Orang di dalam (kantor)", 3),
    ("cuci tangan", "🧼 + ✋", "tak mau ikut bertanggung jawab", "Cuci + tangan", 3),
    ("si jago merah", "🐓 + 🔴", "kebakaran", "Jago + merah = api", 3, ["jago merah"]),
    ("kuda hitam", "🐴 + ⬛", "pemenang tak terduga", "Kuda + hitam", 3),
    ("macan kertas", "🐯 + 📄", "galak di luar, lemah di dalam", "Macan + kertas", 3),
    ("bintang lapangan", "⭐ + 🏟️", "pemain terbaik", "Bintang + lapangan", 2),
    ("bulan madu", "🌙 + 🍯", "liburan pengantin baru", "Bulan + madu", 1),
    ("mata pelajaran", "👁️ + 📚", "di sekolah", "Mata + pelajaran", 2),
    ("tanggal tua", "📅 + 👴", "akhir bulan, dompet tipis", "Tanggal + tua", 2),
    ("kepala dingin", "👦 + 🧊", "tenang menghadapi masalah", "Kepala + dingin", 2),
    ("darah daging", "🩸 + 🥩", "anak kandung", "Darah + daging", 3),
    ("anak bawang", "👶 + 🧅", "tidak dianggap dalam permainan", "Anak + bawang", 3),
    ("telur busuk", "🥚 + 🤢", "", "Telur + busuk", 1),
    ("kaki bukit", "🦶 + 🏞️", "bawah bukit", "Kaki + bukit", 2),
    ("bunga tidur", "🌸 + 😴", "mimpi", "Bunga + tidur = mimpi", 3),
    ("kupu-kupu malam", "🦋 + 🌙", "", "Kupu-kupu + malam", 4, ["kupu kupu malam"]),
]

EN = [
    ("piece of cake", "🧩 + 🍰", "very easy", "Piece + cake", 1),
    ("raining cats and dogs", "🌧️ + 🐱 + 🐶", "heavy rain", "Rain + cats + dogs", 1),
    ("break the ice", "🔨 + 🧊", "start a conversation", "Break + ice", 1),
    ("couch potato", "🛋️ + 🥔", "lazy at home", "Couch + potato", 1),
    ("cold feet", "🥶 + 🦶", "nervous before a big step", "Cold + feet", 2),
    ("spill the beans", "💦 + 🫘", "tell the secret", "Spill + beans", 2),
    ("elephant in the room", "🐘@🏠", "the obvious problem nobody mentions", "An elephant in the room", 2),
    ("night owl", "🌙 + 🦉", "stays up late", "Night + owl", 1),
    ("early bird", "⏰ + 🐦", "up early", "Early + bird", 1),
    ("apple of my eye", "🍎 + 👁️", "someone you love most", "Apple + eye", 2),
    ("time flies", "⏰ + 🪰", "it goes by fast", "Time + flies", 2),
    ("bookworm", "📚 + 🪱", "loves reading", "Book + worm", 1),
    ("brainstorm", "🧠 + ⛈️", "share ideas", "Brain + storm", 1),
    ("butterfly", "🧈 + 🪰", "it flutters", "Butter + fly", 2),
    ("starfish", "⭐ + 🐟", "lives in the sea", "Star + fish", 1),
    ("sunflower", "☀️ + 🌸", "tall and yellow", "Sun + flower", 1),
    ("earring", "👂 + 💍", "jewellery", "Ear + ring", 1),
    ("hot dog", "🔥 + 🐶", "food", "Hot + dog", 1),
    ("top dog", "🔝 + 🐶", "the boss", "Top + dog", 2),
    ("big cheese", "big:🧀", "an important person", "A BIG cheese", 3),
    ("cat nap", "🐱 + 😴", "a short sleep", "Cat + nap", 1),
    ("love birds", "❤️ + 🐦x2", "a couple", "Love + birds", 1, ["lovebirds"]),
    ("cash cow", "💵 + 🐄", "makes lots of money", "Cash + cow", 2),
    ("fish out of water", "🐟!💧", "feels out of place", "A fish out of the water", 3),
    ("under the weather", "⛈️^🙂", "feeling ill", "Someone under the weather", 3),
    ("once in a blue moon", "1️⃣ + 🔵 + 🌙", "very rarely", "Once + blue + moon", 3),
    ("penny for your thoughts", "🪙 + 💭", "what are you thinking?", "Penny + thoughts", 3, ["a penny for your thoughts"]),
    ("when pigs fly", "🐷 + ✈️", "never", "Pigs + fly", 2),
    ("piggy bank", "🐷 + 🏦", "save coins", "Piggy + bank", 1),
    ("two birds one stone", "2️⃣ + 🐦 + 1️⃣ + 🪨", "two things at once", "Kill two birds with one stone", 3, ["kill two birds with one stone"]),
    ("smart cookie", "🧠 + 🍪", "a clever person", "Smart + cookie", 2),
    ("cool cat", "😎 + 🐱", "a stylish person", "Cool + cat", 2),
    ("dragonfly", "🐉 + 🪰", "an insect", "Dragon + fly", 2),
    ("snowman", "❄️ + 👨", "built in winter", "Snow + man", 1),
    ("rainbow", "🌧️ + 🎀", "after the rain", "Rain + bow", 2),
    ("pineapple", "🌲 + 🍎", "a fruit", "Pine + apple", 2),
    ("eye candy", "👁️ + 🍬", "nice to look at", "Eye + candy", 2),
    ("sweet tooth", "🍬 + 🦷", "loves sugar", "Sweet + tooth", 2),
    ("green thumb", "🟩 + 👍", "good with plants", "Green + thumb", 2),
    ("sleep like a log", "😴 + 🪵", "sleep deeply", "Sleep + log", 2),
    ("on cloud nine", "☁️ + 9️⃣", "very happy", "Cloud + nine", 2, ["cloud nine"]),
    ("butterfingers", "🧈 + 👉", "keeps dropping things", "Butter + fingers", 2, ["butter fingers"]),
    ("cupcake", "🏆 + 🍰", "a small treat", "Cup (trophy) + cake", 2),
    ("horsepower", "🐴 + ⚡", "engine strength", "Horse + power", 2),
    ("keyboard", "🔑 + 🛹", "you type on it", "Key + board", 3),
    ("deadline", "💀 + 📏", "the last moment", "Dead + line", 3),
    ("handbag", "✋ + 👜", "carry it", "Hand + bag", 1),
]


def slot(tok, x, y, s):
    """Elements for one picture token centred at (x, y) with size s."""
    style = ""
    if ":" in tok and not tok.startswith("http"):
        style, tok = tok.split(":", 1)
    for sep, kind in (("<", "behind"), ("@", "in"), ("^", "on"), ("!", "out")):
        if sep in tok:
            a, b = tok.split(sep, 1)
            if kind == "behind":
                return [{"t": a, "x": x - s * 0.12, "y": y - s * 0.18, "size": s * 0.7, "color": "", "rotate": -8, "style": ""},
                        {"t": b, "x": x + s * 0.08, "y": y + s * 0.08, "size": s, "color": "", "rotate": 0, "style": ""}]
            if kind == "in":
                return [{"t": b, "x": x, "y": y, "size": s * 1.15, "color": "", "rotate": 0, "style": ""},
                        {"t": a, "x": x, "y": y + s * 0.05, "size": s * 0.42, "color": "", "rotate": 0, "style": ""}]
            if kind == "on":
                return [{"t": b, "x": x, "y": y + s * 0.32, "size": s * 0.8, "color": "", "rotate": 0, "style": ""},
                        {"t": a, "x": x, "y": y - s * 0.32, "size": s * 0.75, "color": "", "rotate": -18, "style": ""}]
            return [{"t": b, "x": x + s * 0.18, "y": y + s * 0.25, "size": s * 0.85, "color": "", "rotate": 0, "style": ""},
                    {"t": a, "x": x - s * 0.22, "y": y - s * 0.28, "size": s * 0.6, "color": "", "rotate": -25, "style": ""},
                    {"t": "💨", "x": x + s * 0.05, "y": y - s * 0.02, "size": s * 0.3, "color": "", "rotate": 0, "style": ""}]
    if "x" in tok and tok.split("x")[-1].isdigit():
        e, n = tok.rsplit("x", 1)
        n = int(n)
        out = []
        for k in range(n):
            ang = (k - (n - 1) / 2) * (0.45 if n > 2 else 0.6)
            out.append({"t": e, "x": x + ang * s * 0.55, "y": y + abs(ang) * s * 0.2, "size": s * (0.62 if n > 3 else 0.72),
                        "color": "", "rotate": ang * 25, "style": ""})
        return out
    size = s * (1.35 if style == "big" else 0.6 if style == "small" else 1)
    return [{"t": tok, "x": x, "y": y, "size": size, "color": "", "rotate": 0, "style": "mirror" if style == "mirror" else ""}]


def layout(formula):
    toks = [t.strip() for t in formula.split(" + ")]
    n = len(toks)
    s = {1: 46, 2: 32, 3: 23, 4: 18}.get(n, 15)
    span = 84
    els = []
    for i, tok in enumerate(toks):
        x = 8 + span * (i + 0.5) / n
        els += slot(tok, x, 52, s)
        if i < n - 1:
            els.append({"t": "+", "x": 8 + span * (i + 1) / n, "y": 54, "size": s * 0.5, "color": "#c9a227", "rotate": 0, "style": "bold"})
    return els


def build():
    out = []
    for lang, rows in (("id", ID), ("en", EN)):
        for row in rows:
            ans, formula, hint, explain, level = row[:5]
            alts = row[5] if len(row) > 5 else []
            out.append({"answer": ans, "alts": alts, "hint": hint, "explain": explain, "level": level, "lang": lang,
                        "elements": layout(formula), "formula": formula})
    path = os.path.join(os.path.dirname(__file__), "..", "backend", "bg", "data", "tebak.json")
    with open(path, "w") as f:
        json.dump(out, f, ensure_ascii=False, indent=0)
    print(len(out), "riddles →", path)


if __name__ == "__main__":
    build()
