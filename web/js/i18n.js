// UI language (Bahasa Indonesia by default, English switch). Game renderers use L("id text", "en text").

let lang = "id"
export const setLang = (l) => { lang = l === "en" ? "en" : "id"; document.documentElement.lang = lang }
export const getLang = () => lang
export const L = (id, en) => (lang === "en" ? en : id)
export const gname = (g) => (g ? (lang === "en" ? g.name_en : g.name_id) : "")

export const RULES = {
  ludo: ["Lempar dadu; butuh 6 untuk keluar kandang. Angka 6, memakan bidak lawan, atau masuk rumah = lempar lagi. Kotak bintang & kotak start aman. Harus pas untuk masuk rumah. Semua bidak masuk rumah = menang!",
    "Roll the dice; you need a 6 to leave the yard. A 6, capturing, or reaching home = roll again. Star and start squares are safe. Exact roll to get home. All pieces home = win!"],
  ulartangga: ["Lempar dadu dan jalan. Tangga naik, ular turun. Harus pas di 100 — kalau lebih, diam di tempat.",
    "Roll and move. Ladders go up, snakes go down. You need the exact roll to reach 100 — overshoot and you stay put."],
  uno: ["Cocokkan warna, angka, atau simbol. Tidak bisa? Ambil kartu. Sisa satu kartu: tekan UNO! Kalau ketahuan lupa, ambil 2. Habiskan kartu duluan untuk menang.",
    "Match colour, number or symbol. Can't? Draw. On your last card press UNO! — get caught and draw 2. Empty your hand first to win."],
  monopoly: ["Lempar dadu, beli kota, tagih sewa. Punya satu warna penuh = boleh bangun rumah & hotel. Kesempatan & Dana Umum bisa menolong atau menjebak. Yang tidak bangkrut terakhir (atau terkaya saat waktu habis) menang.",
    "Roll, buy cities, collect rent. Own a full colour set to build houses and hotels. Chance and Community Chest can help or hurt. Last one not bankrupt (or richest when time's up) wins."],
  sequence: ["Mainkan kartu, taruh chip di gambar kartu yang sama di papan. Jack mata dua = bebas taruh; jack mata satu = buang chip lawan. Buat 5 berderet (2 deret untuk 2 tim, 1 deret untuk 3 pemain).",
    "Play a card and place a chip on a matching board space. Two-eyed jacks are wild; one-eyed jacks remove an opponent's chip. Make rows of 5 (2 rows with 2 sides, 1 row with 3 players)."],
  poker: ["Texas Hold'em: 2 kartu di tangan + 5 kartu bersama. Check, call, raise, atau fold. Tangan terbaik (atau yang terakhir tidak fold) menang pot. Rp1.000.000 per hari, blind naik tiap 10 menit.",
    "Texas Hold'em: 2 cards in hand + 5 shared. Check, call, raise or fold. Best hand (or the last one standing) wins the pot. Rp1,000,000 per day; blinds rise every 10 minutes."],
  gaple: ["Sambungkan kartu domino yang angkanya sama di ujung. Tidak bisa jalan? Nyangkul (ambil) dari tumpukan, atau pas kalau habis. Habiskan kartu duluan — kalau buntu, total titik terkecil menang.",
    "Match domino ends with the same number. Can't play? Draw (nyangkul) from the boneyard, or pass when it's empty. Empty your hand first — if blocked, the lowest total wins."],
  congklak: ["Ambil semua biji dari lubangmu, sebar satu-satu. Berhenti di lumbungmu = jalan lagi. Berhenti di lubang berisi = ambil dan lanjut. Berhenti di lubang kosongmu = tembak biji lawan di seberang. Biji terbanyak menang.",
    "Take all seeds from one of your holes and sow them one by one. End in your store = go again. End in a hole with seeds = pick them up and keep going. End in your own empty hole = capture the hole opposite. Most seeds wins."],
  checkers: ["Aturan internasional 10×10: jalan miring ke depan, makan boleh mundur. Wajib makan, dan harus yang paling banyak. Sampai ujung = raja (jalan jauh). Lawan habis atau tidak bisa jalan = menang.",
    "International 10×10: move diagonally forward, capture forwards or backwards. Capturing is compulsory — take the most pieces. Reach the far row = king (flies far). Opponent has no pieces or moves = win."],
  connect4: ["Jatuhkan koin ke kolom. Empat berderet (datar, tegak, miring) menang.", "Drop discs into columns. Four in a row (across, down or diagonal) wins."],
  sos: ["Tulis S atau O di kotak kosong. Bikin S-O-S = 1 poin dan jalan lagi. Poin terbanyak saat papan penuh menang.",
    "Write S or O in an empty square. Make S-O-S = 1 point and another turn. Most points when the board is full wins."],
  tictactoe: ["Isi kotak bergiliran. Deret sepanjang target (datar, tegak, miring) menang.", "Take turns filling squares. A line of the target length (across, down or diagonal) wins."],
  trivia: ["Jawab secepatnya! Makin cepat benar, makin banyak poin. Soal makin sulit tiap fase (×1 → ×5). Soal aneh? Tekan ⚑ untuk melaporkan.",
    "Answer fast! Faster correct answers score more. Questions get harder each phase (×1 → ×5). Something wrong? Tap ⚑ to report it."],
  math: ["Ketik jawaban (angka) secepatnya. Maksimal 3 kali coba per soal.", "Type the answer (a number) as fast as you can. Up to 3 tries per question."],
  rebus: ["Tebak kata atau ungkapan dari susunan tulisan, warna, posisi, dan emoji. Petunjuk muncul saat waktu menipis.",
    "Guess the word or phrase from how the text, colours, positions and emoji are arranged. Hints appear as time runs out."],
  anagrams: ["Susun kata bahasa Inggris (min. 3 huruf) dari huruf yang tersedia. Kata makin panjang, poin makin besar.",
    "Make English words (3+ letters) from the letters. Longer words score much more."],
  drawguess: ["Satu orang menggambar kata rahasia, yang lain menebak lewat ketikan. Cepat menebak = poin besar; penggambar dapat poin untuk tiap tebakan benar.",
    "One player draws a secret word, the others type guesses. Guess fast for more points; the drawer scores for every correct guess."],
  drawjudge: ["Semua menggambar kata yang sama. Setelah waktu habis, Juri AI menilai gambar mana paling mirip — lengkap dengan komentarnya!",
    "Everyone draws the same word. When time's up the AI judge ranks which drawing shows it best — with comments!"],
  penalty: ["Penendang dan kiper memilih kiri, tengah, atau kanan bersamaan. Sama = ditepis, beda = gol! 5 tendangan, lalu sudden death.",
    "Shooter and keeper choose left, middle or right at the same time. Same = saved, different = goal! 5 kicks each, then sudden death."],
  snake: ["Arahkan ularmu (geser jari), makan titik untuk memanjang, tahan 🚀 untuk ngebut. Menabrak badan ular lain atau tepi arena = kalah. Arena menyempit — ular terakhir yang hidup menang!",
    "Steer your snake (drag), eat dots to grow, hold 🚀 to boost. Hitting another snake's body or the edge = out. The arena shrinks — last snake alive wins!"],
}

export const TINT = {
  ludo: "#e07a5f", ulartangga: "#7cb87a", uno: "#d9534f", monopoly: "#3d8b7a", sequence: "#4f8fcb", poker: "#2f6b58",
  gaple: "#8d6e63", congklak: "#c9a227", checkers: "#5f6b7a", connect4: "#e3a93b", sos: "#8e6c9e", tictactoe: "#d9667e",
  trivia: "#4f8fcb", math: "#3d8b7a", rebus: "#e3a93b", anagrams: "#8e6c9e", drawguess: "#e07a5f", drawjudge: "#5f7a8c",
  penalty: "#3b8c5a", snake: "#7cb87a",
}
