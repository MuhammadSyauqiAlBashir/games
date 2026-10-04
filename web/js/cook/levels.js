// Wok & Roll — game data: dishes, customers, kitchen layouts, chapters, levels, story, upgrades.
// Prices are in thousands of Rupiah ("rb"). Positions are world units (a character is ~1.3 units tall);
// the camera looks across the counter from the cook's side (+z), customers stand behind it (−z).

export const DISHES = {
  steak: { id: "Steak Sapi", en: "Beef Steak", price: 30, tops: ["saus", "buncis", "tomat"] },
  jusjeruk: { id: "Jus Jeruk", en: "Orange Juice", price: 10, tops: [], drink: true },
  jusanggur: { id: "Jus Anggur", en: "Grape Juice", price: 12, tops: [], drink: true },
  nasgor: { id: "Nasi Goreng", en: "Fried Rice", price: 15, tops: ["telur", "kerupuk"] },
  esteh: { id: "Es Teh Manis", en: "Iced Sweet Tea", price: 5, tops: [], drink: true },
  sate: { id: "Sate Ayam", en: "Chicken Satay", price: 20, tops: ["kacang"] },
  bakso: { id: "Bakso", en: "Meatball Soup", price: 18, tops: [] },
  esjeruk: { id: "Es Jeruk", en: "Iced Orange", price: 8, tops: [], drink: true },
}
export const TOPS = {
  saus: { id: "Saus Lada Hitam", en: "Black Pepper Sauce", price: 5 },
  buncis: { id: "Buncis", en: "Green Beans", price: 4 },
  tomat: { id: "Tomat", en: "Tomatoes", price: 3 },
  telur: { id: "Telur Ceplok", en: "Fried Egg", price: 5 },
  kerupuk: { id: "Kerupuk", en: "Crackers", price: 2 },
  kacang: { id: "Bumbu Kacang", en: "Peanut Sauce", price: 3 },
}

// Customer types. P = seconds for 5 hearts to run out, tip = tip multiplier, eat = seconds eating.
export const CUSTOMERS = {
  ankos: { model: "b-beach", id: "Anak Kos", en: "Student", P: 44, tip: 0.5, eat: 4, cheap: true },
  pakrt: { model: "f-farmer", id: "Pak RT", en: "Pak RT", P: 40, tip: 0.8, eat: 8 },
  warga: { model: ["k-casual", "g-purple", "o-woman", { m: "q-blonde", tint: { White: "#f2a7b8" } }], id: "Warga", en: "Neighbour", P: 34, tip: 1, eat: 5 },
  ojol: { model: { m: "w-worker", tint: { Worker_Yellow: "#1faa59", Worker_Vest: "#139447" } }, id: "Mas Ojol", en: "Delivery rider", P: 21, tip: 1.6, eat: 0, takeaway: true },
  tante: { model: "n-dress", id: "Tante Rempong", en: "Fussy Auntie", P: 27, tip: 1, eat: 6, fussy: true },
  infl: { model: "d-punk", hat: "phone", id: "Mbak Influencer", en: "Influencer", P: 30, tip: 1, eat: 5, influencer: true },
  critic: { model: "h-beard", hat: "beret", id: "Kritikus", en: "Food Critic", P: 30, tip: 2.2, eat: 7, critic: true },
  bos: { model: "j-suit", id: "Pak Bos", en: "The Boss", P: 30, tip: 1.4, eat: 6 },
  kantor: { model: ["s-suitw", "o-woman"], id: "Mbak Kantoran", en: "Office Worker", P: 32, tip: 1.1, eat: 5 },
}

// Story cast (who can speak in the dialogue scenes).
export const CAST = {
  nenek: { model: { m: "n-dress", tint: { Red: "#d9d6d0", LimeGreen: "#7b4fb3" } }, id: "Nenek Ijah", en: "Grandma Ijah" },
  gilang: { model: { m: "j-suit", tint: { Suit: "#7a1f2b", Tie: "#f2c94c" } }, hat: "shades", id: "Chef Gilang", en: "Chef Gilang" },
  ojol: { model: { m: "w-worker", tint: { Worker_Yellow: "#1faa59", Worker_Vest: "#139447" } }, id: "Mas Ojol", en: "Delivery rider" },
  tante: { model: "n-dress", id: "Tante Rempong", en: "Fussy Auntie" },
  pakrt: { model: "f-farmer", id: "Pak RT", en: "Pak RT" },
  infl: { model: "d-punk", hat: "phone", id: "Mbak Influencer", en: "Influencer" },
  critic: { model: "h-beard", hat: "beret", id: "Kritikus", en: "Food Critic" },
  oyen: { cat: true, id: "Oyen", en: "Oyen" },
  narrator: { id: "", en: "" },
}

// Counter layouts — landscape, laid out like the owner's reference picture (Cooking-Madness style). The camera looks
// across the counter from the cook's side (+z); customers stand behind it (−z).
// Kinds: src (tap → into a free cooker it feeds), cook (one slot), pot (portions), top (topping jar),
// drink (dispenser with its cup), trash. g = the level group that enables it (level.stations).
// extra: only with that kit flag (an upgrade). Plates are filled in this order.
export const LAYOUTS = {
  bistro: {
    scene: "bistro", y: 0.62, custZ: -0.3,
    counter: { w: 6.4, z0: 0.1, z1: 2.75 },
    pieces: [
      { id: "grill1", g: "grill", kind: "cook", makes: "steak", cook: 5, burn: 6.5, model: "steakslot", at: [-2.42, 0.98] },
      { id: "grill2", g: "grill", kind: "cook", makes: "steak", cook: 5, burn: 6.5, model: "steakslot", at: [-1.72, 0.98] },
      { id: "grill3", g: "grill", kind: "cook", makes: "steak", cook: 5, burn: 6.5, model: "steakslot", at: [-2.42, 1.62] },
      { id: "grill4", g: "grill", kind: "cook", makes: "steak", cook: 5, burn: 6.5, model: "steakslot", extra: "wok2", at: [-1.72, 1.62] },
      { id: "meat", g: "grill", kind: "src", feeds: ["grill1", "grill2", "grill3", "grill4"], model: "fridge", at: [-2.07, 2.38] },
      { id: "saus", g: "saus", kind: "top", adds: "saus", model: "saucepan", at: [-0.95, 2.4] },
      { id: "buncis", g: "buncis", kind: "top", adds: "buncis", model: "beantray", at: [-0.25, 2.4] },
      { id: "tomat", g: "tomat", kind: "top", adds: "tomat", model: "tomatotray", at: [0.45, 2.4] },
      { id: "jusjeruk", g: "jusjeruk", kind: "drink", makes: "jusjeruk", prep: 1.8, model: "juice-orange", at: [1.75, 1.15] },
      { id: "jusanggur", g: "jusanggur", kind: "drink", makes: "jusanggur", prep: 1.8, model: "juice-grape", at: [2.5, 1.15] },
      { id: "trash", g: "trash", kind: "trash", model: "recycle", at: [2.75, 2.4] },
    ],
    plates: [[-0.62, 0.98], [0.2, 0.98], [-0.62, 1.66], [0.2, 1.66], [1.0, 1.66]],
    slots: [-1.95, -0.45, 1.05],
    slots4: [-2.2, -1.05, 0.1, 1.25],
  },
  tenda: {
    scene: "tent", y: 0.62, custZ: -0.3,
    counter: { w: 6.0, z0: 0.1, z1: 2.6 },
    pieces: [
      { id: "wok1", g: "wok", kind: "cook", makes: "nasgor", cook: 4.4, burn: 6.5, model: "wok", at: [-2.4, 1.3] },
      { id: "wok2", g: "wok", kind: "cook", makes: "nasgor", cook: 4.4, burn: 6.5, model: "wok", at: [-1.74, 1.3] },
      { id: "wok3", g: "wok", kind: "cook", makes: "nasgor", cook: 4.4, burn: 6.5, model: "wok", extra: "wok2", at: [-1.08, 1.3] },
      { id: "egg1", g: "egg", kind: "cook", makes: "telur", topping: true, cook: 3, burn: 6, model: "eggpan", at: [-0.38, 1.3] },
      { id: "grill1", g: "grill", kind: "cook", makes: "sate", cook: 5.2, burn: 6, model: "grill", at: [0.3, 1.3] },
      { id: "grill2", g: "grill", kind: "cook", makes: "sate", cook: 5.2, burn: 6, model: "grillslot", at: [0.82, 1.3] },
      { id: "pot", g: "pot", kind: "pot", makes: "bakso", portions: 4, refill: 6, model: "pot", at: [1.65, 1.3] },
      { id: "rice", g: "wok", kind: "src", feeds: ["wok1", "wok2", "wok3"], model: "ricebin", at: [-2.05, 2.1] },
      { id: "eggs", g: "egg", kind: "src", feeds: ["egg1"], model: "eggbasket", at: [-1.38, 2.1] },
      { id: "satemen", g: "grill", kind: "src", feeds: ["grill1", "grill2"], model: "satetray", at: [-0.7, 2.1] },
      { id: "kacang", g: "kacang", kind: "top", adds: "kacang", model: "kacang", at: [0.0, 2.1] },
      { id: "kerupuk", g: "kerupuk", kind: "top", adds: "kerupuk", model: "kaleng", at: [1.22, 2.1] },
      { id: "teh", g: "teh", kind: "drink", makes: "esteh", prep: 1.6, model: "cooler", at: [2.45, 2.02] },
      { id: "jeruk", g: "jeruk", kind: "drink", makes: "esjeruk", prep: 2, model: "juicer", at: [2.5, 0.85] },
      { id: "trash", g: "trash", kind: "trash", model: "trash", at: [-2.8, 2.08] },
    ],
    plates: [[0, 0.6], [-0.66, 0.6], [0.66, 0.6], [-1.32, 0.6], [1.32, 0.6]],
    slots: [-2.0, -0.67, 0.67, 2.0],
    slots4: [-2.3, -1.15, 0, 1.15, 2.3],
  },
}
export const CHEF_MODELS = ["q-blonde", "s-suitw", "n-dress", "d-punk", "k-casual", "g-purple", "j-suit", "b-beach"]

const S = (who, id, en, extra = {}) => ({ who, id, en, ...extra })

export const CHAPTERS = [
  {
    n: 1, layout: "bistro", id: "Bistro Steak Nenek", en: "Grandma's Steak Bistro", icon: "🥩",
    intro: [
      S("narrator", "Jakarta Selatan, jam makan malam. Di ujung jalan ada bistro tua bercat pink: 'Steak Nenek Ijah, sejak 1985'.", "South Jakarta, dinner time. At the end of the street stands an old pink bistro: 'Grandma Ijah's Steaks, since 1985'."),
      S("nenek", "Cu, Nenek sudah 40 tahun memanggang steak di sini. Lutut Nenek sekarang lebih 'well done' daripada steaknya.", "Dear, I've grilled steaks here for 40 years. My knees are now more 'well done' than the steaks."),
      S("nenek", "Mulai malam ini bistro ini punyamu. Termasuk saus lada hitam rahasia… yang resepnya Nenek simpan di kepala. Jadi jangan tanya.", "From tonight this bistro is yours. Including the secret black pepper sauce… whose recipe I keep in my head. So don't ask."),
      S("me", "Nek, aku belum pernah masak buat orang banyak…", "Grandma, I've never cooked for a crowd…"),
      S("nenek", "Gampang. Ambil daging dari kulkas, panggang, taruh di piring, kasih ke pembeli. Kalau gosong, bilang saja 'extra smoky'.", "Easy. Take meat from the fridge, grill it, plate it, give it to the customer. If it burns, call it 'extra smoky'.", { emote: "emote-yes" }),
    ],
    outro: [
      S("critic", "Steaknya… punya jiwa. Sausnya… punya masalah hidup. Bintang empat setengah.", "The steak… has a soul. The sauce… has life problems. Four and a half stars."),
      S("gilang", "EMPAT SETENGAH?! Aku saja cuma dapat empat! Ini belum selesai!", "FOUR AND A HALF?! I only got four! This isn't over!", { emote: "emote-no" }),
      S("nenek", "Cu, kita libur dulu. Pulang kampung, buka warung tenda di pasar malam. Nenek kangen nasi goreng.", "Dear, let's take a break. Back to the village to open a tent warung at the night market. I miss fried rice.", { emote: "emote-yes" }),
      S("narrator", "BAB 2: WARUNG TENDA — terbuka!", "CHAPTER 2: THE TENT WARUNG — unlocked!"),
    ],
    levels: [
      {
        key: "1-1", id: "Steak Pertama", en: "The First Steak", tutorial: true,
        menu: { steak: 1 }, topProb: 0, items: [1], customers: 6, gap: [6, 8], first: 2,
        types: { kantor: 2, pakrt: 1, warga: 2 }, stations: ["grill", "trash"], slots: 3,
        after: [S("nenek", "Lumayan! Cuma satu orang yang minta saus tomat buat steak. Itu dosa, tapi dia bayar.", "Not bad! Only one person asked for ketchup on a steak. That's a sin, but he paid.", { emote: "emote-yes" })],
      },
      {
        key: "1-2", id: "Saus Rahasia", en: "The Secret Sauce",
        menu: { steak: 1 }, topProb: 0.55, tops: ["saus"], items: [1], customers: 8, gap: [5, 7],
        types: { kantor: 1, pakrt: 1, warga: 2, ojol: 2 }, stations: ["grill", "saus", "trash"], slots: 3, hint: "saus",
        before: [
          S("ojol", "Mbak! Steak satu, PAKAI SAUS, dibungkus, cepetan, orderan saya mau di-cancel!", "Miss! One steak WITH SAUCE, to go, quick, my order is about to get cancelled!"),
          S("nenek", "Saus lada hitam ada di panci kuning. Tap sausnya waktu steaknya sudah di piring.", "The black pepper sauce is in the yellow pan. Tap it once the steak is on a plate."),
          S("nenek", "Mas Ojol bawa pulang, jadi langsung bayar. Tapi sabarnya setipis irisan daging.", "Delivery riders take it away and pay at once. But their patience is thin as a slice of beef."),
        ],
        after: [S("ojol", "Bintang lima, Mbak! Eh, saya yang dikasih bintang ya… ya sudah, bintang lima di hati.", "Five stars, miss! Oh wait, I'm the one who gets stars… fine, five stars in my heart.", { emote: "emote-yes" })],
      },
      {
        key: "1-3", id: "Jus Segar", en: "Fresh Juice",
        menu: { steak: 3, jusjeruk: 2 }, topProb: 0.5, tops: ["saus"], items: [1, 2], customers: 10, gap: [4.5, 6.5],
        types: { kantor: 1, pakrt: 1, warga: 2, ojol: 1, tante: 2 }, stations: ["grill", "saus", "jusjeruk", "trash"], slots: 3, hint: "drink",
        before: [
          S("tante", "Permisiii… Tante mau jus jeruk, manisnya setengah, esnya jangan banyak, gelasnya yang cantik ya.", "Excuuuse me… Auntie wants orange juice, half sweet, not too much ice, and a pretty glass please."),
          S("me", "…Siap, Tante.", "…Right away, Auntie."),
          S("nenek", "Tante Rempong tipnya besar. Kalau dia senang. KALAU dia senang.", "Fussy Auntie tips big. If she's happy. IF she's happy."),
        ],
        after: [
          S("tante", "Hmm. Lumayan. Nanti Tante cerita ke teman arisan.", "Hmm. Not bad. I'll tell my arisan friends.", { emote: "emote-yes" }),
          S("nenek", "Artinya tiga puluh pelanggan baru. Atau tiga puluh komplain baru.", "That means thirty new customers. Or thirty new complaints."),
        ],
      },
      {
        key: "1-4", id: "Si Oyen", en: "Oyen the Cat",
        menu: { steak: 3, jusjeruk: 2 }, topProb: 0.55, tops: ["saus", "buncis"], items: [1, 2], customers: 11, gap: [4, 6],
        types: { kantor: 1, pakrt: 1, warga: 2, ojol: 2, tante: 1 }, stations: ["grill", "saus", "buncis", "jusjeruk", "trash"], slots: 3,
        events: [{ at: 18, kind: "cat" }, { at: 52, kind: "cat" }], hint: "cat",
        before: [
          S("narrator", "Malam itu, sepasang mata oranye mengintip dari balik pintu dapur…", "That night, two orange eyes peeked in through the kitchen door…"),
          S("oyen", "Meong.", "Meow."),
          S("nenek", "Itu Oyen. Kucing paling bandel se-RT. Kalau dia naik ke meja, TAP dia sebelum steakmu dicuri! Oh, dan sekarang ada buncis. Sehat. Pembeli pura-pura suka.", "That's Oyen, the naughtiest cat in the neighbourhood. If he jumps on the counter, TAP him before he steals a steak! Oh, and we have green beans now. Healthy. Customers pretend to like them."),
        ],
        after: [S("oyen", "Meong… (aku akan kembali).", "Meow… (I'll be back).")],
      },
      {
        key: "1-5", id: "Mati Lampu!", en: "Power Cut!",
        menu: { steak: 3, jusjeruk: 2 }, topProb: 0.6, tops: ["saus", "buncis", "tomat"], items: [1, 2], customers: 12, gap: [3.8, 5.5],
        types: { kantor: 1, pakrt: 1, warga: 1, ojol: 2, tante: 1, infl: 1, bos: 1 }, stations: ["grill", "saus", "buncis", "tomat", "jusjeruk", "trash"], slots: 3,
        events: [{ at: 30, kind: "blackout", dur: 14 }, { at: 60, kind: "cat" }],
        before: [
          S("gilang", "Oh, jadi ini bistro yang katanya viral? Lucu. Kayak museum.", "Oh, so this is the bistro that's supposedly viral? Cute. Like a museum."),
          S("me", "Kamu siapa?", "And you are?"),
          S("gilang", "Chef Gilang. Dua juta followers. Tempat ini sebentar lagi jadi Gilang Viral Kitchen cabang ke-47.", "Chef Gilang. Two million followers. This place will soon be Gilang Viral Kitchen, branch #47."),
          S("gilang", "Semoga malam ini lancar… ya.", "Hope tonight goes smoothly… heh."),
        ],
        after: [
          S("me", "Aku curiga dia yang cabut kabel.", "I bet he pulled the plug."),
          S("nenek", "Nenek juga. Tapi makan steak pakai lilin itu romantis, kan?", "So do I. But steak by candlelight is romantic, isn't it?", { emote: "emote-yes" }),
        ],
      },
      {
        key: "1-6", id: "Kritikus Datang", en: "The Critic Arrives",
        menu: { steak: 3, jusjeruk: 1, jusanggur: 1 }, topProb: 0.45, tops: ["saus", "buncis", "tomat"], items: [1, 2], customers: 11, gap: [3.9, 5.4],
        types: { kantor: 1, pakrt: 1, warga: 1, ojol: 2, tante: 1, infl: 2, bos: 1 }, stations: ["grill", "saus", "buncis", "tomat", "jusjeruk", "jusanggur", "trash"], slots: 3,
        events: [{ at: 40, kind: "rush", n: 2 }, { at: 70, kind: "critic" }],
        before: [
          S("infl", "Hai guys! Aku lagi di bistro hidden gem nih. Katanya malam ini ada KRITIKUS makanan mau datang!", "Hi guys! I'm at a hidden-gem bistro. Word is a FOOD CRITIC is coming tonight!"),
          S("nenek", "Tenang, Cu. Masak saja seperti biasa. Kecuali bagian gosongnya. Oh, jus anggurnya juga sudah siap.", "Relax, dear. Cook like you always do. Except the burnt part. Oh, and the grape juice machine is ready too."),
        ],
      },
    ],
  },
  {
    n: 2, layout: "tenda", id: "Warung Tenda", en: "The Tent Warung", icon: "⛺",
    intro: [
      S("narrator", "Pasar malam di kampung Nenek. Tenda biru, lampu kuning, bau bawang goreng di mana-mana.", "The night market in Grandma's village. A blue tent, yellow lights, the smell of fried shallots everywhere."),
      S("nenek", "Di sini menunya beda: nasi goreng, sate, bakso. Pakai wajan, bukan pemanggang!", "The menu's different here: fried rice, satay, meatball soup. Woks, not grills!", { emote: "emote-yes" }),
      S("nenek", "Tap bakul nasi — nasinya masuk wajan. Kalau matang, tap wajannya.", "Tap the rice basket — the rice goes into a wok. When it's done, tap the wok."),
    ],
    outro: [
      S("gilang", "…Nasi gorengmu enak. Jangan bilang siapa-siapa aku bilang begitu.", "…Your fried rice is good. Don't tell anyone I said that."),
      S("nenek", "Cu, Nenek bangga. Mau buka kafe? Anak muda sekarang suka kopi susu gula aren.", "Dear, I'm proud of you. Want to open a café? Young people love palm-sugar iced coffee these days.", { emote: "emote-yes" }),
      S("narrator", "BAB 3: KAFE KEKINIAN — segera hadir!", "CHAPTER 3: THE TRENDY CAFÉ — coming soon!"),
    ],
    levels: [
      {
        key: "2-1", id: "Pulang Kampung", en: "Back to the Village",
        menu: { nasgor: 3, esteh: 2 }, topProb: 0.5, tops: ["telur"], items: [1, 2], customers: 10, gap: [4.5, 6],
        types: { ankos: 2, pakrt: 1, warga: 3, ojol: 1, tante: 1 }, stations: ["wok", "egg", "teh", "trash"], slots: 4, hint: "egg",
      },
      {
        key: "2-2", id: "Asap Sate", en: "Satay Smoke",
        menu: { nasgor: 2, sate: 3, esteh: 2 }, topProb: 0.55, tops: ["telur", "kerupuk", "kacang"], items: [1, 2], customers: 11, gap: [4, 5.5],
        types: { ankos: 1, pakrt: 1, warga: 3, ojol: 1, tante: 1 }, stations: ["wok", "egg", "grill", "kacang", "kerupuk", "teh", "trash"], slots: 4, hint: "grill",
        before: [S("nenek", "Sate dibakar di arang. Kipas arangnya, jangan kipas mukamu sendiri.", "Satay goes on the charcoal. Fan the coals, not your own face.")],
      },
      {
        key: "2-3", id: "Bakso Pak RT", en: "Pak RT's Meatballs",
        menu: { nasgor: 2, sate: 2, bakso: 3, esteh: 2 }, topProb: 0.55, tops: ["telur", "kerupuk", "kacang"], items: [1, 2], customers: 12, gap: [3.8, 5.2],
        types: { ankos: 1, pakrt: 2, warga: 3, ojol: 1, tante: 1 }, stations: ["wok", "egg", "grill", "pot", "kacang", "kerupuk", "teh", "trash"], slots: 4, hint: "pot",
        before: [
          S("pakrt", "Neng, bakso ada? Warga pada nanya. Saya juga nanya. Saya Pak RT, saya berhak nanya.", "Miss, any meatball soup? The residents keep asking. I'm asking too. I'm Pak RT, I'm allowed to ask."),
          S("nenek", "Panci bakso isinya empat mangkok. Kalau habis, tunggu sebentar sampai mendidih lagi.", "The meatball pot holds four bowls. When it's empty, wait for it to boil again."),
        ],
      },
      {
        key: "2-4", id: "Hujan Deras", en: "Downpour",
        menu: { nasgor: 2, sate: 2, bakso: 2, esteh: 1, esjeruk: 2 }, topProb: 0.6, tops: ["telur", "kerupuk", "kacang"], items: [1, 2], customers: 13, gap: [3.6, 5],
        types: { ankos: 1, pakrt: 1, warga: 3, ojol: 3, tante: 1 }, stations: ["wok", "egg", "grill", "pot", "kacang", "kerupuk", "teh", "jeruk", "trash"], slots: 4,
        events: [{ at: 25, kind: "rain", dur: 30 }],
        before: [
          S("narrator", "Musim hujan. Pembeli datang bergerombol sambil bawa payung.", "Rainy season. Customers arrive in clumps, umbrellas and all."),
          S("ojol", "Mbak, hujan begini orderan naik tiga kali lipat! Es jeruknya satu ya, buat semangat.", "Miss, when it rains orders triple! One iced orange please, for morale."),
        ],
      },
      {
        key: "2-5", id: "Ngabuburit", en: "Waiting for Iftar",
        menu: { nasgor: 2, sate: 2, bakso: 2, esteh: 2, esjeruk: 2 }, topProb: 0.55, tops: ["telur", "kerupuk", "kacang"], items: [1, 2], customers: 13, gap: [3.4, 4.8],
        types: { ankos: 1, pakrt: 2, warga: 3, ojol: 1, tante: 1, infl: 1 }, stations: ["wok", "egg", "grill", "pot", "kacang", "kerupuk", "teh", "jeruk", "trash"], slots: 4,
        events: [{ at: 28, kind: "rush", n: 5, bedug: true }, { at: 15, kind: "cat" }, { at: 60, kind: "cat" }],
        before: [
          S("narrator", "Bulan puasa. Jam 17.55. Oyen ikut pulang kampung… dan dia bawa teman.", "Ramadan. 5:55 pm. Oyen came to the village too… and he brought friends."),
          S("pakrt", "Sebentar lagi bedug… semua orang akan datang SEKALIGUS.", "The drum will sound soon… and everyone will come AT ONCE."),
          S("me", "Semuanya??", "Everyone??"),
          S("pakrt", "Semuanya.", "Everyone."),
        ],
      },
      {
        key: "2-6", id: "Tantangan Gilang", en: "Gilang's Challenge",
        menu: { nasgor: 3, sate: 2, bakso: 2, esteh: 2, esjeruk: 2 }, topProb: 0.65, tops: ["telur", "kerupuk", "kacang"], items: [1, 2], customers: 16, gap: [3, 4.4],
        types: { ankos: 1, pakrt: 1, warga: 3, ojol: 2, tante: 2, infl: 2 }, stations: ["wok", "egg", "grill", "pot", "kacang", "kerupuk", "teh", "jeruk", "trash"], slots: 4,
        events: [{ at: 30, kind: "blackout", dur: 10 }, { at: 50, kind: "cat" }, { at: 75, kind: "critic" }],
        before: [
          S("gilang", "Kamu lagi? Kita adu. Malam ini. Siapa yang paling laku, dia yang menang.", "You again? Let's settle this. Tonight. Whoever sells the most wins."),
          S("me", "Deal. Siapkan follower-mu, aku siapkan wajanku.", "Deal. Ready your followers, I'll ready my wok.", { emote: "emote-yes" }),
        ],
      },
    ],
  },
]

export const ALL_LEVELS = CHAPTERS.flatMap((c) => c.levels.map((l) => ({ ...l, chapter: c.n, layout: c.layout })))
export const levelByKey = (k) => ALL_LEVELS.find((l) => l.key === k)

// Duel stages: everything on the menu, steady arrivals, fixed length.
export function duelLevel(chapter, seconds) {
  const c = CHAPTERS.find((x) => x.n === chapter) || CHAPTERS[0]
  const last = c.levels[c.levels.length - 1]
  return {
    ...last, key: `duel-${chapter}`, chapter: c.n, layout: c.layout, duel: true, limit: seconds,
    customers: Math.round(seconds / 4.6), gap: [3.6, 5.6], first: 1.5, events: [], before: null, after: null,
  }
}

// Tutorial hint bubbles (shown once, pointing at a piece of the counter).
export const HINTS = {
  meat: ["Tap kulkas — dagingnya langsung ke pemanggang.", "Tap the fridge — the meat goes onto the grill."],
  take: ["Matang! Tap steaknya untuk memindahkan ke piring.", "Done! Tap the steak to put it on a plate."],
  serve: ["Tap piringnya — otomatis diberikan ke pembeli yang memesan. (Bisa juga digeser ke pembeli.)", "Tap the plate — it goes to the customer who ordered it. (You can also drag it.)"],
  combo: ["Layani cepat berturut-turut untuk COMBO dan tip lebih besar!", "Serve quickly in a row for a COMBO and bigger tips!"],
  burn: ["Gosong? Tap untuk membuang.", "Burnt? Tap it to throw it away."],
  saus: ["Tap panci saus — sausnya mendarat di steak yang butuh.", "Tap the sauce pan — the sauce lands on the steak that needs it."],
  egg: ["Tap keranjang telur untuk menggoreng telur, lalu tap telurnya — otomatis ke nasi goreng di piring.", "Tap the egg basket to fry an egg, then tap the egg — it lands on a fried rice plate."],
  drink: ["Tap mesin jus untuk menuang, tap lagi untuk menyajikan.", "Tap the juice machine to pour, tap it again to serve."],
  cat: ["Oyen naik ke meja! Tap kucingnya sebelum makananmu dicuri!", "Oyen jumped on the counter! Tap the cat before he steals your food!"],
  grill: ["Tap sate mentah untuk dibakar. Bumbu kacang ditambahkan seperti topping.", "Tap the raw satay to grill it. Add peanut sauce like a topping."],
  pot: ["Bakso tinggal diambil dari panci — tap pancinya. Habis? Tunggu mendidih lagi.", "Meatball soup is ready in the pot — tap it. Empty? Wait for it to boil again."],
  trash: ["Salah piring? Geser ke tempat sampah.", "Wrong plate? Drag it to the bin."],
}
