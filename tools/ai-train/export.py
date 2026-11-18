# tools/ai-train/export.py
"""Export du réseau en JSON pour l'inférence TypeScript, avec un bloc de parité."""
from __future__ import annotations  # annotations évaluées paresseusement (Python 3.9)

import argparse  # arguments de la ligne de commande
import json  # format JSON
import os  # remplacement atomique
import sys  # sortie d'erreur
from datetime import datetime, timezone  # date d'entraînement
from pathlib import Path  # chemins
from typing import List, Optional  # types (compatibles Python 3.9)

import torch  # tenseurs

from dataset import Meta, Sample, collate, load_samples, sample_files, to_compact
from model import ValueNet

LAYERS = ["card1", "card2", "head1", "head2", "out"]  # couches linéaires, dans l'ordre
PARITY_POSITIONS = 50  # positions figées pour la vérification TS / PyTorch


def round6(v: float) -> float:
    """6 chiffres significatifs : fichier plus petit, précision largement suffisante."""
    return float(f"{v:.6g}")  # formatage puis relecture


def _layer(linear: torch.nn.Linear) -> dict:
    """Poids et biais d'une couche linéaire, arrondis."""
    return {"w": [[round6(v) for v in row] for row in linear.weight.tolist()],  # [sortie][entrée]
            "b": [round6(v) for v in linear.bias.tolist()]}  # biais


def model_from_json(data: dict, meta: Meta) -> ValueNet:
    """Reconstruit le réseau, en double précision comme TypeScript, à partir du JSON."""
    model = ValueNet(torch.from_numpy(meta.static_x), meta.global_dim, meta.set_scale).double()
    model.set_scale = torch.tensor(meta.set_scale, dtype=torch.float64)  # 0,1 exact, comme en TS
    with torch.no_grad():  # copie de poids, pas d'apprentissage
        model.emb.weight.copy_(torch.tensor(data["layers"]["emb"], dtype=torch.float64))  # embeddings
        for name in LAYERS:  # chaque couche linéaire
            layer = getattr(model, name)  # couche du modèle
            layer.weight.copy_(torch.tensor(data["layers"][name]["w"], dtype=torch.float64))  # poids
            layer.bias.copy_(torch.tensor(data["layers"][name]["b"], dtype=torch.float64))  # biais
    return model.eval()  # mode évaluation


def export_weights(model: ValueNet, meta: Meta, *, generation: int, positions: int, val_loss: float,
                   parity_samples: List[Sample], path: Optional[Path] = None) -> dict:
    """Construit le fichier de poids ; les valeurs de parité sont calculées sur les poids arrondis."""
    data = {
        "encodingVersion": meta.encoding_version,  # version de l'encodage
        "generation": generation,  # numéro de génération
        "trainedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),  # date
        "positions": positions,  # taille du jeu d'entraînement
        "valLoss": round6(val_loss),  # perte de validation
        "cardIndex": {str(card_id): row for row, card_id in enumerate(meta.card_ids, start=1)},  # id -> ligne
        "layers": {"emb": [[round6(v) for v in row] for row in model.emb.weight.tolist()],  # embeddings
                   **{name: _layer(getattr(model, name)) for name in LAYERS}},  # couches
    }
    samples = parity_samples[:PARITY_POSITIONS]  # positions de référence
    with torch.no_grad():  # sorties de référence pour TypeScript
        values = model_from_json(data, meta)(collate(samples, meta, dtype=torch.float64)).tolist()
    compact = [to_compact(s, meta) for s in samples]  # positions au format compact
    used = sorted({c["i"] for p in compact for cards in p["sets"].values() for c in cards if "x" not in c})
    data["parity"] = {"cards": {str(i): meta.static_x[meta.row_of[i]].tolist() for i in used},
                      "positions": compact, "values": values}  # bloc de parité
    if path is not None:  # écriture atomique
        path = Path(path)  # normalise
        tmp = path.with_name(path.name + ".tmp")  # fichier temporaire
        tmp.write_text(json.dumps(data), encoding="utf-8")  # écriture complète
        os.replace(tmp, path)  # remplacement atomique
    return data


def main() -> None:
    """Génère la fixture de parité : réseau non entraîné, positions réelles."""
    parser = argparse.ArgumentParser(description="Fixture de parité : réseau non entraîné, positions réelles")
    parser.add_argument("--fixture", nargs=2, metavar=("DONNEES", "SORTIE"), required=True)
    args = parser.parse_args()  # lit les arguments
    data_dir, out = Path(args.fixture[0]), Path(args.fixture[1])  # dossier source, fichier cible
    meta = Meta.load(data_dir / "meta.json")  # métadonnées
    samples = load_samples(sample_files([data_dir]), meta)[:PARITY_POSITIONS]  # positions réelles
    if len(samples) < PARITY_POSITIONS:  # pas assez de données
        sys.exit(f"{len(samples)} positions seulement, il en faut {PARITY_POSITIONS}")
    torch.manual_seed(0)  # poids reproductibles
    model = ValueNet(torch.from_numpy(meta.static_x), meta.global_dim, meta.set_scale)  # réseau non entraîné
    export_weights(model, meta, generation=0, positions=0, val_loss=0.0, parity_samples=samples, path=out)
    print(f"Fixture écrite : {out}")


if __name__ == "__main__":
    main()
