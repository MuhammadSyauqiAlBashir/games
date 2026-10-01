"""Word checks for the word games (Bom Kata).

Indonesian: the Sastrawi root-word list (MIT, ~30k words) + its stemmer, so "bermain", "makanan" or
"perpustakaan" count because their roots ("main", "makan", "pustaka") are in the list.
English: the ENABLE list already used by Anagrams (has plurals and verb forms)."""

from __future__ import annotations

import os
import random
import re
from collections import Counter
from functools import lru_cache

from . import words as W

_ROOTS: set[str] | None = None
_STEMMER = None


def roots_id() -> set[str]:
    global _ROOTS
    if _ROOTS is None:
        import Sastrawi
        path = os.path.join(os.path.dirname(Sastrawi.__file__), "Stemmer", "data", "kata-dasar.txt")
        with open(path) as f:
            _ROOTS = {w.strip() for w in f if w.strip().isalpha()}
    return _ROOTS


def _stem(w: str) -> str:
    global _STEMMER
    if _STEMMER is None:
        from Sastrawi.Stemmer.StemmerFactory import StemmerFactory
        _STEMMER = StemmerFactory().create_stemmer()
    return _STEMMER.stem(w)


def clean(w: str) -> str:
    return re.sub(r"[^a-z-]", "", str(w or "").lower()).strip("-")


@lru_cache(maxsize=20000)
def is_word(lang: str, w: str) -> bool:
    w = clean(w)
    if len(w) < 3:
        return False
    if lang == "en":
        return w.replace("-", "") in W.words()
    r = roots_id()
    if w in r:
        return True
    if "-" in w:  # reduplication: "anak-anak", "berlari-lari"
        parts = w.split("-")
        if len(parts) == 2 and (parts[0] == parts[1] or parts[1] in r or _stem(parts[1]) in r) and (parts[0] in r or _stem(parts[0]) in r):
            return True
    st = _stem(w)
    return st != w and st in r


@lru_cache(maxsize=4)
def _chunks(lang: str) -> tuple[list[tuple[str, int]], list[tuple[str, int]]]:
    """(2-letter, 3-letter) chunks with how many everyday words contain them, most common first."""
    pool = roots_id() if lang == "id" else {w for w, z in W.words().items() if z >= 3.0}
    c2, c3 = Counter(), Counter()
    for w in pool:
        if not w.isalpha() or len(w) < 3:
            continue
        c2.update({w[i:i + 2] for i in range(len(w) - 1)})
        c3.update({w[i:i + 3] for i in range(len(w) - 2)})
    return c2.most_common(), c3.most_common()


def syllable(lang: str, level: int, rng: random.Random, avoid: set[str] | None = None) -> str:
    """A 2–3 letter chunk for the bomb: level 1 = very common, 3 = rare (but still many words)."""
    c2, c3 = _chunks(lang)
    ranges = {1: ((0, 45), (0, 60)), 2: ((30, 120), (40, 220)), 3: ((100, 200), (200, 520))}[max(1, min(3, level))]
    pool = [s for s, n in c2[ranges[0][0]:ranges[0][1]] if n >= 20] + [s for s, n in c3[ranges[1][0]:ranges[1][1]] if n >= 15]
    pool = [s for s in pool if not avoid or s not in avoid] or pool
    return rng.choice(pool)
