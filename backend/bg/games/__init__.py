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
from .poker import Poker
from .quiz import Matematika, Rebus, Trivia
from .sequence import Sequence
from .snake import Snake
from .sos import SOS
from .tictactoe import TicTacToe
from .ulartangga import UlarTangga
from .uno import Uno

ORDER = [Ludo, UlarTangga, Uno, Monopoly, Sequence, Poker, Gaple, Congklak, Checkers, Connect4, SOS, TicTacToe,
         Trivia, Matematika, Rebus, Anagrams, DrawGuess, DrawJudge, Penalty, Snake, Pesta, *MINIS, *MINIS2]
GAMES: dict[str, type[Game]] = {g.key: g for g in ORDER}

CATEGORIES = {
    "mario": ("Minigame Mario", "Mario minigames", ["mp_pesta"] + [m.key for m in MINIS]),
    "mario2": ("Minigame Mario lainnya", "More Mario minigames", [m.key for m in MINIS2]),
    "board": ("Papan & dadu", "Board & dice", ["ludo", "ulartangga", "monopoly", "congklak", "checkers", "connect4", "sos", "tictactoe"]),
    "cards": ("Kartu", "Cards", ["uno", "sequence", "poker", "gaple"]),
    "party": ("Kuis & pesta", "Quiz & party", ["trivia", "math", "rebus", "anagrams", "drawguess", "drawjudge"]),
    "action": ("Aksi", "Action", ["penalty", "snake"]),
}

__all__ = ["GAMES", "ORDER", "CATEGORIES", "Game", "IllegalMove"]
