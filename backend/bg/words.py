"""English words for Anagrams: the ENABLE public-domain word list (validity) with
word-frequency scores from wordfreq (commonness), prepared by tools/ at build time."""

from __future__ import annotations

import os
import random
from collections import Counter

_WORDS: dict[str, float] | None = None


def words() -> dict[str, float]:
    global _WORDS
    if _WORDS is None:
        _WORDS = {}
        with open(os.path.join(os.path.dirname(__file__), "data", "words_en.tsv")) as f:
            for line in f:
                w, z = line.rstrip("\n").split("\t")
                _WORDS[w] = float(z)
    return _WORDS


def makeable(letters: str) -> list[str]:
    have = Counter(letters)
    out = []
    for w in words():
        if len(w) <= len(letters) and not (Counter(w) - have):
            out.append(w)
    return out


def pick_letters(n: int, level: int, rng: random.Random) -> tuple[str, str, list[str]]:
    """(shuffled letters, the seed word, all valid words). level 1 = common words only."""
    min_z = {1: 4.0, 2: 3.5, 3: 3.0, 4: 2.5}.get(level, 3.5)
    wd = words()
    seeds = [w for w, z in wd.items() if len(w) == n and z >= min_z and len(set(w)) >= n - 2]
    for _ in range(200):
        seed = rng.choice(seeds)
        valid = makeable(seed)
        common = [w for w in valid if wd[w] >= 2.5]
        if len(common) >= (10 if n == 6 else 14):
            letters = list(seed)
            while "".join(letters) == seed:
                rng.shuffle(letters)
            return "".join(letters), seed, sorted(valid, key=lambda w: (-len(w), w))
    seed = rng.choice(seeds)
    letters = list(seed)
    rng.shuffle(letters)
    return "".join(letters), seed, sorted(makeable(seed), key=lambda w: (-len(w), w))


def points(word: str) -> int:
    return {3: 100, 4: 400, 5: 1200, 6: 2000, 7: 3000, 8: 4000}.get(len(word), 0)
