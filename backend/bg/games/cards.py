"""Standard 52-card deck helpers (Sequence, Poker). Cards are strings like "AS", "TD", "9H"."""

from __future__ import annotations

from collections import Counter
from itertools import combinations

RANKS = "23456789TJQKA"
SUITS = "SHDC"  # spades, hearts, diamonds, clubs


def deck() -> list[str]:
    return [r + s for s in SUITS for r in RANKS]


# ---- poker hand evaluation ---------------------------------------------------------------
CATEGORY = ["High card", "Pair", "Two pair", "Three of a kind", "Straight", "Flush", "Full house", "Four of a kind",
            "Straight flush"]
CATEGORY_ID = ["Kartu tinggi", "Satu pasang", "Dua pasang", "Three of a kind", "Straight", "Flush", "Full house",
               "Four of a kind", "Straight flush"]


def _rank5(cards: tuple[str, ...]) -> tuple:
    vals = sorted((RANKS.index(c[0]) + 2 for c in cards), reverse=True)
    suits = [c[1] for c in cards]
    counts = Counter(vals)
    by = sorted(counts.items(), key=lambda kv: (-kv[1], -kv[0]))
    flush = len(set(suits)) == 1
    uniq = sorted(set(vals), reverse=True)
    straight_hi = None
    if len(uniq) == 5:
        if uniq[0] - uniq[4] == 4:
            straight_hi = uniq[0]
        elif uniq == [14, 5, 4, 3, 2]:
            straight_hi = 5
    if straight_hi and flush:
        return (8, straight_hi)
    if by[0][1] == 4:
        return (7, by[0][0], by[1][0])
    if by[0][1] == 3 and by[1][1] == 2:
        return (6, by[0][0], by[1][0])
    if flush:
        return (5, *vals)
    if straight_hi:
        return (4, straight_hi)
    if by[0][1] == 3:
        return (3, by[0][0], *[v for v, _ in by[1:]])
    if by[0][1] == 2 and by[1][1] == 2:
        return (2, by[0][0], by[1][0], by[2][0])
    if by[0][1] == 2:
        return (1, by[0][0], *[v for v, _ in by[1:]])
    return (0, *vals)


def best_hand(cards: list[str]) -> tuple[tuple, list[str]]:
    best, best_cards = None, []
    for combo in combinations(cards, 5):
        r = _rank5(combo)
        if best is None or r > best:
            best, best_cards = r, list(combo)
    return best, best_cards
