"""All BashGames games, in lobby order."""

from .anagrams import Anagrams
from .base import Game, IllegalMove
from .checkers import Checkers
from .congklak import Congklak
from .connect4 import Connect4
from .drawing import DrawGuess, DrawJudge
from .gaple import Gaple
from .ludo import Ludo
from .monopoly import Monopoly
from .pesta import MINIS, MINIS2, Pesta
from .penalty import Penalty
from .photo import Ekspresi, FotoHunt
from .poker import Poker
from .quiz import Lontong, Matematika, Rebus, Trivia
from .sequence import Sequence
from .sing import Karaoke, NyanyiHits, TiruSuara
from .snake import Snake
from .speed import BomKata, Kembar, Ketik, Refleks
from .sos import SOS
from .survei import Survei
from .tictactoe import TicTacToe
from .ulartangga import UlarTangga
from .uno import Uno

ORDER = [Ludo, UlarTangga, Uno, Monopoly, Sequence, Poker, Gaple, Congklak, Checkers, Connect4, SOS, TicTacToe,
         Trivia, Matematika, Rebus, Lontong, Anagrams, DrawGuess, DrawJudge, BomKata, Survei, Kembar, Refleks, Ketik,
         FotoHunt, Ekspresi, Karaoke, NyanyiHits, TiruSuara, Penalty, Snake, Pesta, *MINIS, *MINIS2]
GAMES: dict[str, type[Game]] = {g.key: g for g in ORDER}

CATEGORIES = {
    "mario": ("Minigame Mario", "Mario minigames", ["mp_pesta"] + [m.key for m in MINIS]),
    "mario2": ("Minigame Mario lainnya", "More Mario minigames", [m.key for m in MINIS2]),
    "board": ("Papan & dadu", "Board & dice", ["ludo", "ulartangga", "monopoly", "congklak", "checkers", "connect4", "sos", "tictactoe"]),
    "cards": ("Kartu", "Cards", ["uno", "sequence", "poker", "gaple"]),
    "speed": ("Adu cepat", "Speed challenges", ["bomkata", "survei", "kembar", "refleks", "ketik"]),
    "ai": ("Dinilai AI", "Judged by AI", ["fotohunt", "ekspresi", "drawjudge"]),
    "voice": ("Nyanyi & suara", "Sing & sounds", ["karaoke", "nyanyihits", "tirusuara"]),
    "party": ("Kuis & pesta", "Quiz & party", ["trivia", "lontong", "math", "rebus", "anagrams", "drawguess"]),
    "action": ("Aksi", "Action", ["penalty", "snake"]),
}

__all__ = ["GAMES", "ORDER", "CATEGORIES", "Game", "IllegalMove"]
