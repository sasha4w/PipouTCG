# tools/ai-train/dataset.py
"""Lecture des positions d'auto-jeu (JSONL.gz) et mise en lots pour PyTorch.

Une position contient 7 ensembles de cartes. Une carte « statique » (hors
plateau) n'est écrite que par son id : ses caractéristiques sont dans
meta.json. Pour aller vite, ces cartes sont comptées (combien de fois chaque
carte dans chaque ensemble) ; les cartes « dynamiques » (sur le plateau) gardent
leur vecteur x complet.
"""
from __future__ import annotations  # annotations de type modernes

import gzip  # lecture des fichiers .gz
import json  # format JSON
from dataclasses import dataclass  # classes de données simples
from pathlib import Path  # chemins de fichiers
from typing import Union  # union de types compatible Python 3.9

import numpy as np  # tableaux numériques
import torch  # tenseurs PyTorch


@dataclass
class Meta:
    """Ce que l'auto-jeu dit de l'encodage : dimensions et cartes connues."""

    encoding_version: int  # doit égaler ENCODING_VERSION côté TypeScript
    global_dim: int  # taille du vecteur global (22)
    card_dim: int  # taille du vecteur d'une carte (32)
    set_names: list[str]  # noms des 7 ensembles, dans l'ordre
    set_scale: list[float]  # poids de chaque ensemble dans la somme
    card_ids: list[int]  # id de carte de chaque ligne (ligne r = card_ids[r - 1])
    row_of: dict[int, int]  # id de carte -> ligne de l'embedding (0 = inconnue)
    static_x: np.ndarray  # x statique de chaque ligne, ligne 0 à zéro

    @staticmethod
    def from_json(data: dict) -> "Meta":
        ids = sorted(int(k) for k in data["cards"])  # ordre stable des cartes
        static_x = np.zeros((len(ids) + 1, data["cardDim"]), dtype=np.float32)  # +1 : ligne 0
        for row, card_id in enumerate(ids, start=1):  # les lignes commencent à 1
            static_x[row] = data["cards"][str(card_id)]  # copie le vecteur de la carte
        return Meta(
            encoding_version=data["encodingVersion"],
            global_dim=data["globalDim"],
            card_dim=data["cardDim"],
            set_names=list(data["sets"]),
            set_scale=[float(s) for s in data["setScale"]],
            card_ids=ids,
            row_of={card_id: row for row, card_id in enumerate(ids, start=1)},
            static_x=static_x,
        )

    @staticmethod
    def load(path: Union[Path, str]) -> "Meta":
        return Meta.from_json(json.loads(Path(path).read_text(encoding="utf-8")))  # lit meta.json


@dataclass
class Sample:
    """Une position prête pour le réseau."""

    g: int  # rang de la partie (séparation entraînement / validation)
    glob: np.ndarray  # vecteur global, float32 [global_dim]
    counts: np.ndarray  # cartes statiques : lignes (ensemble, ligne, nombre), int64 [k, 3]
    dyn_set: np.ndarray  # ensemble de chaque carte dynamique, int64 [d]
    dyn_row: np.ndarray  # ligne d'embedding de chaque carte dynamique, int64 [d]
    dyn_id: np.ndarray  # id d'origine de chaque carte dynamique, int64 [d]
    dyn_x: np.ndarray  # vecteur de chaque carte dynamique, float32 [d, card_dim]
    y: float  # résultat : +1 victoire, -1 défaite, 0 nul


def parse(obj: dict, meta: Meta) -> Sample:
    """Convertit une ligne JSON en Sample."""
    if obj["v"] != meta.encoding_version:  # données d'un autre encodage : inutilisables
        raise ValueError(f"position encodée en version {obj['v']}, attendu {meta.encoding_version}")
    counts: dict[tuple[int, int], int] = {}  # (ensemble, ligne) -> nombre de cartes
    dyn_set, dyn_row, dyn_id, dyn_x = [], [], [], []  # cartes dynamiques, colonne par colonne
    for s, name in enumerate(meta.set_names):  # pour chaque ensemble, dans l'ordre
        for card in obj["sets"][name]:  # pour chaque carte de l'ensemble
            row = meta.row_of.get(card["i"])  # sa ligne d'embedding, None si inconnue
            if "x" in card:  # carte dynamique : vecteur fourni
                dyn_set.append(s)
                dyn_row.append(row or 0)  # inconnue -> ligne 0, comme en TypeScript
                dyn_id.append(card["i"])
                dyn_x.append(card["x"])
            elif row is None:  # statique mais absente de meta.json : impossible à encoder
                raise ValueError(f"carte {card['i']} absente de meta.json")
            else:  # statique : on compte
                counts[(s, row)] = counts.get((s, row), 0) + 1
    return Sample(
        g=int(obj["g"]),
        glob=np.asarray(obj["global"], dtype=np.float32),
        counts=np.asarray([(s, r, c) for (s, r), c in counts.items()], dtype=np.int64).reshape(-1, 3),
        dyn_set=np.asarray(dyn_set, dtype=np.int64),
        dyn_row=np.asarray(dyn_row, dtype=np.int64),
        dyn_id=np.asarray(dyn_id, dtype=np.int64),
        dyn_x=np.asarray(dyn_x, dtype=np.float32).reshape(-1, meta.card_dim),
        y=float(obj["y"]),
    )


def sample_files(dirs: list[Path]) -> list[Path]:
    """Tous les fichiers de positions des dossiers de générations donnés."""
    return [p for d in dirs for p in sorted(Path(d).glob("part-*.jsonl.gz"))]


def load_samples(paths: list[Path], meta: Meta) -> list[Sample]:
    """Lit toutes les positions des fichiers .jsonl.gz."""
    out: list[Sample] = []
    for path in paths:  # un fichier par processus d'auto-jeu
        with gzip.open(path, "rt", encoding="utf-8") as f:  # décompression à la volée
            for line in f:  # une position par ligne
                if line.strip():  # ignore les lignes vides
                    out.append(parse(json.loads(line), meta))
    return out


def split_by_game(samples: list[Sample]) -> tuple[list[Sample], list[Sample]]:
    """Une partie sur dix en validation, entière : jamais une même partie des deux côtés."""
    train = [s for s in samples if s.g % 10 != 0]
    val = [s for s in samples if s.g % 10 == 0]
    return train, val


def collate(samples: list[Sample], meta: Meta, dtype: torch.dtype = torch.float32) -> dict[str, torch.Tensor]:
    """Assemble des positions en un lot de tenseurs."""
    b = len(samples)  # taille du lot
    n_sets = len(meta.set_names)  # 7 ensembles
    n_rows = meta.static_x.shape[0]  # cartes connues + ligne 0
    d = max(1, max(len(s.dyn_row) for s in samples))  # cartes dynamiques max (au moins 1)
    glob = torch.tensor(np.stack([s.glob for s in samples]), dtype=dtype)  # [B, 22]
    counts = torch.zeros((b, n_sets, n_rows), dtype=dtype)  # [B, 7, R]
    dyn_x = torch.zeros((b, d, meta.card_dim), dtype=dtype)  # [B, D, 32]
    dyn_row = torch.zeros((b, d), dtype=torch.long)  # [B, D]
    dyn_set = torch.zeros((b, d), dtype=torch.long)  # [B, D]
    dyn_mask = torch.zeros((b, d), dtype=dtype)  # 1 = vraie carte, 0 = remplissage
    for k, s in enumerate(samples):  # remplit position par position
        if len(s.counts):  # cartes statiques
            c = torch.from_numpy(s.counts)
            counts[k, c[:, 0], c[:, 1]] = c[:, 2].to(dtype)
        n = len(s.dyn_row)  # cartes dynamiques de cette position
        if n:
            dyn_x[k, :n] = torch.from_numpy(s.dyn_x).to(dtype)
            dyn_row[k, :n] = torch.from_numpy(s.dyn_row)
            dyn_set[k, :n] = torch.from_numpy(s.dyn_set)
            dyn_mask[k, :n] = 1
    y = torch.tensor([s.y for s in samples], dtype=dtype)  # cibles [B]
    return {"global": glob, "counts": counts, "dyn_x": dyn_x, "dyn_row": dyn_row,
            "dyn_set": dyn_set, "dyn_mask": dyn_mask, "y": y}


def to_compact(sample: Sample, meta: Meta) -> dict:
    """Retour au format compact (celui de CompactPosition en TypeScript), pour la parité."""
    sets: dict[str, list[dict]] = {name: [] for name in meta.set_names}
    for s, row, count in sample.counts.tolist():  # cartes statiques : répétées count fois
        sets[meta.set_names[s]].extend({"i": meta.card_ids[row - 1]} for _ in range(count))
    for s, card_id, x in zip(sample.dyn_set.tolist(), sample.dyn_id.tolist(), sample.dyn_x):
        sets[meta.set_names[s]].append({"i": card_id, "x": x.tolist()})  # vecteur complet
    return {"global": sample.glob.tolist(), "sets": sets}
