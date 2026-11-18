# tools/ai-train/train.py
"""Entraînement du réseau de valeur, avec reprise après interruption."""
from __future__ import annotations  # annotations évaluées paresseusement (Python 3.9)

import os  # remplacement atomique de fichiers
from pathlib import Path  # chemins de fichiers
from typing import Callable, List, Tuple, Union  # types (compatibles Python 3.9)

import numpy as np  # tirages aléatoires reproductibles
import torch  # tenseurs, gradients, optimiseurs
import torch.nn.functional as F  # fonctions de perte

from dataset import Meta, Sample, collate  # données
from model import ValueNet  # réseau


def save_atomic(obj, path: Path) -> None:
    """Écrit dans un fichier temporaire puis le renomme : jamais de fichier à moitié écrit."""
    tmp = path.with_name(path.name + ".tmp")  # fichier temporaire voisin
    torch.save(obj, tmp)  # écriture complète
    os.replace(tmp, path)  # remplacement en une seule opération


def evaluate(model: ValueNet, samples: List[Sample], meta: Meta, batch_size: int = 1024) -> float:
    """Perte MSE moyenne sur des positions, sans apprendre."""
    model.eval()  # mode évaluation
    total = 0.0  # somme des erreurs au carré
    with torch.no_grad():  # pas de gradients : plus rapide
        for start in range(0, len(samples), batch_size):  # lot par lot
            batch = collate(samples[start:start + batch_size], meta)  # tenseurs du lot
            total += F.mse_loss(model(batch), batch["y"], reduction="sum").item()  # erreurs cumulées
    return total / len(samples)  # moyenne


def train(
    train_samples: List[Sample],
    val_samples: List[Sample],
    meta: Meta,
    out_dir: Union[Path, str],
    *,
    epochs: int = 30,  # passages complets sur les données, au plus
    patience: int = 3,  # époques sans progrès avant l'arrêt précoce
    batch_size: int = 256,  # positions par pas de gradient
    lr: float = 1e-3,  # taux d'apprentissage d'Adam
    seed: int = 0,  # graine : même entraînement à chaque fois
    log: Callable[[str], None] = print,  # où écrire l'avancement
) -> Tuple[ValueNet, dict]:
    """Entraîne et renvoie le meilleur modèle (perte de validation la plus basse)."""
    if not val_samples:  # sans validation, impossible de savoir quand s'arrêter
        raise ValueError("aucune position de validation : il faut au moins 10 parties")
    out_dir = Path(out_dir)  # normalise le chemin
    out_dir.mkdir(parents=True, exist_ok=True)  # dossier de la génération
    torch.manual_seed(seed)  # poids initiaux reproductibles
    model = ValueNet(torch.from_numpy(meta.static_x), meta.global_dim, meta.set_scale)  # réseau neuf
    # Adam : descente de gradient avec un pas adapté à chaque poids ;
    # weight_decay tire légèrement les poids vers 0 (limite le sur-apprentissage).
    optimizer = torch.optim.Adam(model.parameters(), lr=lr, weight_decay=1e-5)
    progress = {"epoch": 0, "best": float("inf"), "bad": 0}  # état de l'entraînement
    checkpoint = out_dir / "checkpoint.pt"  # sauvegarde complète à chaque époque
    best_path = out_dir / "best.pt"  # meilleurs poids vus jusqu'ici
    if checkpoint.exists():  # entraînement interrompu : on reprend
        saved = torch.load(checkpoint, weights_only=False)  # relit l'état complet
        model.load_state_dict(saved["model"])  # poids
        optimizer.load_state_dict(saved["optimizer"])  # état d'Adam
        progress = saved["progress"]  # compteurs
        log(f"reprise à l'époque {progress['epoch'] + 1}")  # message de reprise
    while progress["epoch"] < epochs and progress["bad"] < patience:  # tant qu'il reste du budget
        epoch = progress["epoch"]  # époque courante (0-based)
        model.train()  # mode apprentissage
        # Ordre aléatoire des positions, différent à chaque époque mais reproductible.
        order = np.random.default_rng(seed + epoch).permutation(len(train_samples))
        total = 0.0  # perte cumulée pondérée
        for start in range(0, len(order), batch_size):  # un pas de gradient par lot
            chunk = [train_samples[k] for k in order[start:start + batch_size]]  # positions du lot
            batch = collate(chunk, meta)  # tenseurs
            loss = F.mse_loss(model(batch), batch["y"])  # erreur moyenne au carré
            optimizer.zero_grad()  # efface les gradients du pas précédent
            loss.backward()  # calcule les gradients (rétropropagation)
            optimizer.step()  # ajuste les poids
            total += loss.item() * len(chunk)  # cumul pondéré par la taille du lot
        train_loss = total / max(1, len(order))  # perte moyenne d'entraînement
        val_loss = evaluate(model, val_samples, meta)  # sur des parties jamais vues
        if val_loss < progress["best"]:  # progrès : on garde ces poids
            progress.update(best=val_loss, bad=0)  # nouveau record
            save_atomic(model.state_dict(), best_path)  # sauvegarde des meilleurs poids
        else:  # pas de progrès : une époque de plus sans amélioration
            progress["bad"] += 1  # compteur de patience
        progress["epoch"] = epoch + 1  # époque terminée
        save_atomic({"model": model.state_dict(), "optimizer": optimizer.state_dict(),
                     "progress": progress}, checkpoint)  # point de reprise
        log(f"époque {epoch + 1} : perte entraînement {train_loss:.4f}, validation {val_loss:.4f}")
    model.load_state_dict(torch.load(best_path, weights_only=True))  # revient aux meilleurs poids
    return model, {"valLoss": progress["best"], "epochs": progress["epoch"]}
