"""Builds data/lontong.json: Cak Lontong–style quiz questions (twisted logic, TTS letter counts).

Each row: (question, answer, traps, explanation, level, alts)
  traps = the "normal" answers people blurt out — typing one gets a "MIKIR!" instead of a plain "wrong".
Run:  python tools/build_lontong.py
"""

import json
import os

Q = [
    ("Apa yang ada di tengah-tengah laut?", "u", ["pulau", "ikan", "kapal"], "Di tengah kata L-A-U-T ada huruf U. MIKIR!", 1),
    ("Huruf apa yang paling dingin?", "b", ["es"], "B… ku. BEKU! MIKIR!", 1),
    ("Negara apa yang paling banyak bapak-bapaknya?", "pakistan", ["indonesia", "china", "india"], "PAK-PAK-istan. MIKIR!", 1),
    ("Ikan apa yang bisa terbang?", "lele", ["ikan terbang", "pari"], "Lele… lawar! (kelelawar) MIKIR!", 2),
    ("Kenapa Superman bajunya ada huruf S?", "kebesaran", ["superman", "super"], "Kalau ukuran L kebesaran. MIKIR!", 2),
    ("Pintu apa yang didorong-dorong tetap tidak bisa terbuka?", "tarik", ["terkunci", "macet", "rusak"], "Pintu yang ada tulisannya TARIK. MIKIR!", 1),
    ("Kenapa anjing menggonggong kalau kita lewat depan rumah orang?", "bicara", ["galak", "curiga"], "Karena anjing tidak bisa BICARA. MIKIR!", 2),
    ("Gunung apa yang paling tinggi di dunia sebelum Everest ditemukan?", "everest", ["kilimanjaro", "jayawijaya", "k2"], "Everest sudah paling tinggi walau belum ditemukan. MIKIR!", 2),
    ("Ayam jantan bertelur di atas genteng. Telurnya jatuh ke mana?", "tidak ada", ["bawah", "tanah", "kanan", "kiri"], "Ayam jantan tidak bertelur. MIKIR!", 1, ["ga ada", "gak ada", "tidak bertelur"]),
    ("Bulan apa yang paling pendek?", "mei", ["februari"], "Namanya cuma 3 huruf: M-E-I. MIKIR!", 2),
    ("Apa yang bisa naik tapi tidak pernah bisa turun?", "umur", ["harga", "tangga", "lift"], "Umur naik terus. MIKIR!", 1, ["usia"]),
    ("Apa yang punya kaki tapi tidak bisa jalan?", "meja", ["kursi"], "Kaki meja. MIKIR!", 1, ["kursi"]),
    ("Apa yang makin diisi malah makin ringan?", "balon", ["perut", "dompet"], "Balon diisi udara jadi terbang. MIKIR!", 1),
    ("Angka berapa yang kalau dibalik jadi lebih besar?", "enam", ["sembilan", "nol"], "6 dibalik jadi 9. MIKIR!", 2, ["6"]),
    ("Apa yang selalu datang tapi tidak pernah tiba?", "besok", ["jodoh", "gaji", "kereta"], "Besok selalu besok. MIKIR!", 2),
    ("Ada 3 apel, kamu ambil 2. Berapa apel yang kamu punya?", "dua", ["satu", "tiga"], "Yang kamu ambil ya punyamu: DUA. MIKIR!", 1, ["2"]),
    ("Lomba lari: kamu menyalip orang di posisi kedua. Sekarang kamu di posisi berapa?", "kedua", ["pertama", "satu"], "Kamu gantikan posisinya: KEDUA. MIKIR!", 2, ["dua", "2"]),
    ("Bapak Budi punya 4 anak: Ana, Ani, Anu, dan…?", "budi", ["ane", "ano", "ini"], "Anaknya ya Budi — namanya kan Bapak Budi. MIKIR!", 2),
    ("Apa yang punya leher tapi tidak punya kepala?", "botol", ["baju", "jerapah"], "Leher botol. MIKIR!", 1, ["baju"]),
    ("Apa yang punya gigi tapi tidak bisa menggigit?", "sisir", ["gergaji", "resleting"], "Gigi sisir. MIKIR!", 1, ["gergaji", "resleting"]),
    ("Apa yang punya mata tapi tidak bisa melihat?", "jarum", ["kentang", "badai"], "Mata jarum. MIKIR!", 1, ["badai", "kaki"]),
    ("Apa yang semakin dikeringkan malah semakin basah?", "handuk", ["baju", "jemuran"], "Handuk mengeringkan, dia yang basah. MIKIR!", 1),
    ("Kenapa gajah tidak bisa naik sepeda?", "jempol", ["berat", "besar", "gendut"], "Tidak punya jempol buat bunyikan bel. MIKIR!", 3),
    ("Kenapa matahari tidak terbit dari barat?", "terbenam", ["timur", "bumi berputar"], "Kalau dari barat namanya TERBENAM. MIKIR!", 2),
    ("Ayam apa yang paling besar?", "semesta", ["kalkun", "ayam jago", "unta"], "Ayam semesta (alam semesta). MIKIR!", 2),
    ("Di ruangan gelap ada lilin, lampu minyak, dan kayu bakar. Apa yang kamu nyalakan pertama?", "korek", ["lilin", "lampu", "kayu"], "Korek api dulu! MIKIR!", 1, ["korek api"]),
    ("Mana yang lebih berat: 1 kg kapas atau 1 kg besi?", "sama", ["besi", "kapas"], "Dua-duanya 1 kg. MIKIR!", 1),
    ("Berapa bulan dalam setahun yang punya 28 hari?", "semua", ["satu", "februari"], "Semua bulan punya tanggal 28. MIKIR!", 1, ["12", "dua belas"]),
    ("Dokter memberimu 3 pil, diminum tiap setengah jam. Berapa lama sampai habis?", "satu jam", ["satu setengah jam", "90 menit"], "Pil 1 sekarang, 2 di menit 30, 3 di menit 60. MIKIR!", 3, ["60 menit", "1 jam"]),
    ("Ibu Rani punya 3 anak perempuan, masing-masing punya 1 saudara laki-laki. Berapa anak Ibu Rani?", "empat", ["enam", "tiga"], "Saudara laki-lakinya cuma satu, bersama: 4. MIKIR!", 2, ["4"]),
    ("Apa yang harus dipecahkan dulu sebelum bisa dipakai?", "telur", ["piring", "gelas", "masalah"], "Telur! MIKIR!", 1),
    ("Apa yang bisa kamu tangkap tapi tidak bisa kamu lempar?", "pilek", ["bola", "ikan"], "Tangkap pilek, mau lempar ke siapa? MIKIR!", 2, ["flu", "masuk angin"]),
    ("Kata apa yang selalu salah diucapkan?", "salah", ["benar"], "Kata SALAH ya diucapkan 'salah'. MIKIR!", 2),
    ("Apa yang jalan terus tapi tidak pernah pindah tempat?", "jam", ["waktu", "kipas"], "Jam dinding jalan terus. MIKIR!", 1, ["jam dinding"]),
    ("Hewan apa yang kakinya paling banyak?", "kaki seribu", ["lipan", "kelabang", "gurita"], "Namanya saja sudah seribu. MIKIR!", 1),
    ("Kapan sepatu bisa menyanyi?", "sol", ["rusak", "baru"], "Kalau di-SOL: do re mi fa SOL. MIKIR!", 3),
    ("Sesuatu yang dicari-cari, tapi begitu ketemu malah dibuang.", "kutu", ["upil", "uang", "jodoh"], "Kutu rambut. MIKIR!", 2, ["upil"]),
    ("Penyakit yang banyak diderita pegawai di tanggal tua.", "kanker", ["pusing", "maag", "bokek"], "KANtong KERing. MIKIR!", 2),
    ("Bahan makanan yang paling sering bikin orang menangis.", "bawang", ["cabai", "sambal"], "Dikupas bikin mewek. MIKIR!", 1, ["bawang merah", "bawang bombay"]),
    ("Olahraga favorit orang malas.", "rebahan", ["catur", "tidur", "yoga"], "Olah raga paling santai sedunia. MIKIR!", 2),
    ("Kenapa ayam menyeberang jalan?", "seberang", ["takut", "dikejar"], "Mau ke SEBERANG. MIKIR!", 1),
    ("Kenapa air laut asin?", "keringetan", ["garam", "mineral"], "Ikannya keringetan. MIKIR!", 2, ["keringat", "berkeringat"]),
    ("Kenapa burung terbang ke selatan saat musim dingin?", "kejauhan", ["dingin", "hangat", "makan"], "Kalau jalan kaki kejauhan. MIKIR!", 2),
    ("Kenapa pohon kelapa di depan rumah harus ditebang?", "berat", ["bahaya", "roboh", "tinggi"], "Kalau dicabut BERAT. MIKIR!", 2),
    ("Kenapa Doraemon tidak punya telinga?", "tikus", ["robot", "lupa"], "Telinganya digigit tikus! MIKIR!", 2),
    ("Kenapa zebra bajunya belang-belang?", "kuda", ["kamuflase", "gaya"], "Kalau polos namanya KUDA. MIKIR!", 2),
    ("Kenapa naik motor harus pakai helm?", "panci", ["aman", "polisi", "aturan"], "Kalau pakai panci diketawain orang. MIKIR!", 3),
    ("Kenapa ikan bisa hidup di air?", "asin", ["insang"], "Kalau di darat namanya ikan ASIN. MIKIR!", 2),
    ("Kenapa kalau tidur mata kita merem?", "melek", ["ngantuk", "gelap"], "Kalau MELEK namanya bukan tidur. MIKIR!", 2),
    ("Benda yang kalau masih baru justru tidak bisa dipakai, harus dibuka dulu.", "kado", ["sepatu", "hp"], "Kado harus dibuka dulu. MIKIR!", 3, ["hadiah"]),
    ("Hewan apa yang bersaudara?", "katak", ["kucing", "monyet"], "KATAK beradik (kakak beradik). MIKIR!", 2),
    ("Tempat apa yang paling ramai di tanggal muda?", "mall", ["pasar", "bank"], "Gajian langsung ke mall. MIKIR!", 2, ["mal"]),
    ("Kenapa kucing tidak suka main kartu?", "cheetah", ["kalah", "bosan"], "Ada CHEETAH (cheater) di keluarganya. MIKIR!", 4),
    ("Apa yang dimiliki orang miskin, dibutuhkan orang kaya, dan kalau dimakan bisa mati?", "tidak ada", ["racun", "uang"], "Tidak ada! MIKIR!", 3, ["nothing", "ga ada", "gak ada"]),
    ("Makin banyak diambil, makin besar dia.", "lubang", ["utang", "pasir"], "Lubang digali makin besar. MIKIR!", 2),
    ("Benda apa yang punya banyak kunci tapi tidak bisa membuka pintu?", "piano", ["gembok", "lemari"], "Kunci nada piano. MIKIR!", 2, ["keyboard", "gitar"]),
    ("Sesuatu yang milikmu, tapi orang lain lebih sering memakainya.", "nama", ["hp", "motor", "uang"], "Namamu lebih sering dipanggil orang. MIKIR!", 2),
    ("Apa yang naik kalau hujan turun?", "payung", ["air", "banjir", "harga"], "Payungnya naik dibuka. MIKIR!", 2),
]


def build():
    out = []
    for row in Q:
        q, ans, traps, explain, level = row[:5]
        alts = row[5] if len(row) > 5 else []
        out.append({"q": q, "answer": ans, "traps": traps, "explain": explain, "level": level, "alts": alts})
    path = os.path.join(os.path.dirname(__file__), "..", "backend", "bg", "data", "lontong.json")
    with open(path, "w") as f:
        json.dump(out, f, ensure_ascii=False, indent=0)
    print(len(out), "questions →", path)


if __name__ == "__main__":
    build()
