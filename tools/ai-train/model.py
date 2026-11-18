# tools/ai-train/model.py
"""Réseau de valeur : même calcul que apps/backend/src/fights/ai/nn/mlp.ts.

carte : [x (32), embedding (8)] -> Linéaire 64 -> ReLU -> Linéaire 32 -> ReLU
ensemble : somme des vecteurs de ses cartes (DeepSets), multipliée par son échelle
tête : [global (22), 7 sommes (7 x 32)] -> 128 -> ReLU -> 128 -> ReLU -> 1 -> tanh
"""
import torch  # tenseurs et calcul de gradients
from torch import nn  # couches de réseaux de neurones

EMBED_DIM = 8  # taille de l'embedding d'une carte
CARD_HIDDEN = 64  # couche cachée de l'encodeur de carte
CARD_OUT = 32  # vecteur d'une carte après encodage
HEAD_HIDDEN = 128  # couches cachées de la tête


class ValueNet(nn.Module):
    """Prédit le résultat de la partie (entre -1 et +1) pour le joueur de la position."""

    def __init__(self, static_x: torch.Tensor, global_dim: int, set_scale: list[float]):
        super().__init__()  # initialisation obligatoire d'un module PyTorch
        n_rows, card_dim = static_x.shape  # cartes connues (+ ligne 0) et taille de x
        # Tampons : sauvegardés avec le modèle mais jamais entraînés.
        self.register_buffer("static_x", static_x.clone())
        self.register_buffer("set_scale", torch.tensor(set_scale, dtype=static_x.dtype))
        # Une ligne de 8 nombres appris par carte ; ligne 0 = carte inconnue, figée à 0.
        self.emb = nn.Embedding(n_rows, EMBED_DIM, padding_idx=0)
        self.card1 = nn.Linear(card_dim + EMBED_DIM, CARD_HIDDEN)  # 40 -> 64
        self.card2 = nn.Linear(CARD_HIDDEN, CARD_OUT)  # 64 -> 32
        n_sets = len(set_scale)  # 7 ensembles
        self.head1 = nn.Linear(global_dim + n_sets * CARD_OUT, HEAD_HIDDEN)  # 246 -> 128
        self.head2 = nn.Linear(HEAD_HIDDEN, HEAD_HIDDEN)  # 128 -> 128
        self.out = nn.Linear(HEAD_HIDDEN, 1)  # 128 -> 1

    def encode_cards(self, x: torch.Tensor, rows: torch.Tensor) -> torch.Tensor:
        """Encodeur de carte partagé : même poids pour toutes les cartes."""
        h = torch.cat([x, self.emb(rows)], dim=-1)  # colle x et l'embedding
        return torch.relu(self.card2(torch.relu(self.card1(h))))  # deux couches + ReLU

    def forward(self, batch: dict[str, torch.Tensor]) -> torch.Tensor:
        # 1. Vecteur de chaque carte connue, calculé une fois pour tout le lot.
        rows = torch.arange(self.static_x.shape[0], device=self.static_x.device)
        phi = self.encode_cards(self.static_x, rows)  # [R, 32]
        # 2. Somme des cartes statiques : nombre de chaque carte x son vecteur.
        static_sum = batch["counts"] @ phi  # [B, 7, R] @ [R, 32] -> [B, 7, 32]
        # 3. Cartes dynamiques : encodées une à une, remplissage annulé par le masque.
        dyn = self.encode_cards(batch["dyn_x"], batch["dyn_row"]) * batch["dyn_mask"].unsqueeze(-1)
        index = batch["dyn_set"].unsqueeze(-1).expand(-1, -1, CARD_OUT)  # ensemble de chaque carte
        dyn_sum = torch.zeros_like(static_sum).scatter_add(1, index, dyn)  # ajoute à son ensemble
        # 4. Échelle de chaque ensemble (les decks pèsent 0,1 par carte).
        sets = (static_sum + dyn_sum) * self.set_scale.view(1, -1, 1)
        # 5. Tête : global + 7 sommes, deux couches cachées, sortie tanh.
        z = torch.cat([batch["global"], sets.flatten(1)], dim=1)  # [B, 246]
        h = torch.relu(self.head2(torch.relu(self.head1(z))))
        return torch.tanh(self.out(h)).squeeze(-1)  # [B], entre -1 et +1
