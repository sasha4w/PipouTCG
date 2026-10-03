# Audit des cartes du duel

Date : 2026-10-02. Source : le dump de production du 23/09, extrait dans
`apps/backend/src/fights/testing/fixtures/cards.snapshot.json` (69 cartes).

Ce rapport liste les écarts entre la description et les effets d'une carte,
ainsi que les données suspectes. **Le moteur ne les corrige pas** : chaque
correction se fait carte par carte dans l'admin. Les effets se modifient avec
l'éditeur d'effets, qui fera l'objet d'un chantier séparé.

Les cartes #7, #9, #17, #32, #97, #99, #122, #127 et #128 sont déjà corrigées
automatiquement au déploiement, par la migration `GenericCardEffects`.

## Comportements à trancher

| Carte | Constat | À décider |
|---|---|---|
| #4 Œuf de la Gènese | Monstre à **0 PV** sans effet : il est détruit dès son invocation. | Lui donner des PV, ou un effet d'éclosion. |
| Tous les Supports | Le moteur **n'applique pas le coût des Supports**. Pourtant, #115 Incubation Rapide (coût 1), #116 Écaille de Dragon (1) et #117 Souffle Primordial (2) en affichent un. | Supports toujours gratuits (mettre leur coût à 0), ou coût payant (à ajouter au moteur). |
| Supports avec ATK/PV | #95 (0/400), #96 (100/0), #97 (400/0), #98 (0/600), #101 (500/0), #116 (0/400) affichent des statistiques que le moteur ignore. Seuls les effets comptent. | Remettre ces statistiques à 0 pour ne pas induire en erreur. |

## Écarts entre description et effets

| Carte | Description | Effets actuels | À décider |
|---|---|---|---|
| #13 Soin d'urgence | « 30 % des PV max, ou 60 % avec un pipouman médecin » | +600 PV, puis +200 avec Médecin Citrouille (valeurs fixes) | Garder les valeurs fixes et corriger le texte, ou ajouter un soin en pourcentage au moteur |
| #14 Ouille au rapport | « récupérer **un** ouille commun ou non commun ; invocation gratuite si Capitaine présent » | Récupère **3** cartes pipou commune/peu commune du cimetière ; aucune invocation gratuite | Nombre de cartes (1 ou 3) et effet « Capitaine » |
| #94 Noyau Delta | « ignore la Garde » | Perçant : Prime en détruisant une Garde, et réduction de dégâts ignorée | Texte à aligner sur Perçant |
| #123 Noyau Omega | « Booste tous les **Noyaux** alliés » | +300/+300 à tous les alliés **Pixelman** (sauf lui) | Filtrer sur les Noyaux, ou corriger le texte |
| #9 Commandant Quenouille | Texte d'ambiance seulement | N'attaque pas le tour de son invocation, puis 2 attaques au tour suivant | Ajouter l'effet au texte |
| #29 Chevalier Touille | « Arrive en courant. » | Gratuit après l'invocation d'un pipou | Ajouter l'effet au texte |

## Cartes sans effet ni description

| Cartes | Constat |
|---|---|
| #115 Incubation Rapide, #116 Écaille de Dragon, #117 Souffle Primordial, #118 Potion de Lucidité, #119 Bouclier de Fortune, #120 Frappe Préventive | `effects` vide : jouables, mais sans effet |
| #11 Guerrier Bafouille, #16 Canouille le Bleu, #20 Tactique Gang Gang, #21 Sentinelle Gargouille | Description vide |
| #18 Vice Capitaine Patouille | Effet présent (récupère Capitaine Gribouille à sa mort), **description vide** |

## Noms à nettoyer

| Carte | Constat |
|---|---|
| #22 « Noyau Alpha␣ » | Espace final. Sans conséquence depuis la normalisation des noms, mais à nettoyer. |
| #30 « Sorcier Ratatouille␣ » | Espace final |

## Rappel des règles appliquées par le moteur

Voir `docs/superpowers/specs/2026-10-02-duel-engine-audit-design.md`, section « Règles de référence ».
