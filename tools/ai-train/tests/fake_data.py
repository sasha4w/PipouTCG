# Petites données inventées, de la même forme que celles écrites par ai:selfplay.
import numpy as np  # calcul sur tableaux

from dataset import Meta  # description des données (dimensions, cartes)

# Les 7 ensembles, dans l'ordre de nn/encode.ts.
SETS = ["myMonsters", "oppMonsters", "mySupports", "oppSupports", "myHand", "myRemaining", "oppHidden"]


def fake_meta() -> Meta:
    # Trois cartes (ids 10, 20, 30) aux caractéristiques simples.
    cards = {}
    for k, card_id in enumerate([10, 20, 30]):
        x = [0.0] * 32  # 32 caractéristiques, toutes à 0
        x[0] = 1.0  # c'est un monstre
        x[2] = 0.1 * (k + 1)  # ATK / 1000 différente pour chaque carte
        cards[str(card_id)] = x
    # Même structure que meta.json.
    return Meta.from_json({
        "encodingVersion": 1,
        "globalDim": 22,
        "cardDim": 32,
        "sets": SETS,
        "setScale": [1, 1, 1, 1, 1, 0.1, 0.1],
        "cards": cards,
    })


def fake_line(g: int, y: int, *, dyn: bool = False) -> dict:
    # Une position : 2 cartes en main, 3 cartes cachées adverses.
    sets = {name: [] for name in SETS}
    sets["myHand"] = [{"i": 10}, {"i": 20}]
    sets["oppHidden"] = [{"i": 30}, {"i": 30}, {"i": 10}]
    if dyn:
        # Un monstre sur le plateau : x complet (état en jeu non nul).
        x = [0.0] * 32
        x[0], x[2], x[18], x[20] = 1.0, 0.2, 1.0, 0.5
        sets["myMonsters"] = [{"i": 20, "x": x}]
    glob = list(np.linspace(0, 1, 22))  # 22 valeurs globales quelconques
    return {"g": g, "v": 1, "global": glob, "sets": sets, "y": y}
