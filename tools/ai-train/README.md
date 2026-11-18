# Entraînement de l'IA (réseau de valeur)

## 1. Ce que fait ce dossier

Ce dossier entraîne le réseau de neurones qui note les positions de combat pour l'IA du jeu. Le planificateur TypeScript (`apps/backend/src/fights/ai`) explore les coups possibles ; le réseau remplace la note manuelle `evaluate.ts` pour dire « cette position est bonne ou mauvaise pour moi ». L'entraînement se fait ici, sur ton PC, en Python (PyTorch). La production n'utilise que le fichier de poids exporté en JSON, lu par du TypeScript pur : aucun Python n'est nécessaire sur Render.

```
auto-jeu (TS)  ->  entraîneur (Python)  ->  note réseau (TS)  ->  arène (TS)
 parties de         apprend à prédire        exportée en JSON,     challenger contre
 l'IA contre        le résultat depuis       lue par mlp.ts        champion : promu
 elle-même          chaque position                                s'il gagne assez
```

Le script `loop.py` enchaîne ces étapes en boucle : une « génération » = auto-jeu, entraînement, vérification de parité TS / PyTorch, arène, et (si promu) jauge contre `evaluate.ts`. Pour comprendre les notions, lire `COURS.md` ; pour explorer les données, ouvrir `explore.ipynb`.

## 2. Installation (une fois)

Python 3.9 ou plus récent (testé en 3.9.2), depuis python.org (cocher « py launcher »). Les versions des paquets sont figées dans `requirements.txt` (PyTorch version CPU, numpy, matplotlib, pytest, jupyter).

```powershell
cd tools/ai-train
py -3 -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt
.venv/Scripts/python -m pytest -q   # tout doit passer
```

Il faut aussi avoir fait `pnpm install` à la racine du dépôt : `loop.py` appelle les commandes `pnpm --filter @pipou/backend ai:...`. Sous Windows, il cherche tout seul `pnpm.cmd` puis `pnpm.exe` dans le PATH.

## 3. Lancer un entraînement

```powershell
.venv/Scripts/python loop.py --hours 8
```

Options :

| Option | Rôle | Défaut |
|---|---|---|
| `--hours` | durée avant de s'arrêter, entre deux étapes (obligatoire) | |
| `--run` | nom de l'entraînement : dossiers `runs/<run>` et `data/<run>` | `main` |
| `--games` | parties d'auto-jeu par génération | 1500 |
| `--budget` | nœuds du planificateur par décision | 2000 |
| `--workers` | processus parallèles | nombre de cœurs − 1 |
| `--arena-games` | parties de l'arène | 400 |
| `--gauge-games` | parties de la jauge contre `evaluate.ts` | 100 |

Ctrl+C à tout moment : l'état est sauvé après chaque étape terminée, l'étape interrompue est refaite entièrement. Relancer la même commande reprend. Pour garder le PC utilisable pendant l'entraînement, ajouter `--workers 6` (ou moins). Un nouveau `--run` repart de zéro.

## 4. Lire le résultat

Ouvrir `runs/main/report.md` (et `runs/main/progression.png` si présent) :

- **perte de validation** : elle doit baisser, puis se stabiliser. Si elle remonte, c'est du sur-apprentissage (voir `COURS.md`) ;
- **arène** : score du challenger contre le champion. Il faut au moins 55 % (et une borne basse de Wilson au-dessus de 50 %) pour qu'un challenger soit promu ;
- **jauge** : score du champion contre `evaluate.ts` à temps égal (200 ms par coup). Le but est de dépasser 60 %.

Le détail des époques est dans `runs/main/train.log`. Le champion courant est `runs/main/champion.json`.

## 5. Mettre un champion en prod

```powershell
Copy-Item runs/main/champion.json ../../apps/backend/src/fights/ai/nn/weights/champion.json
cd ../..
pnpm --filter @pipou/backend ai:check-weights src/fights/ai/nn/weights/champion.json
pnpm --filter @pipou/backend test -- nn/parity.spec level-brains.spec
pnpm --filter @pipou/backend ai:bench           # vérifie que le niveau 5 reste sous sa limite de 2,5 s
git add apps/backend/src/fights/ai/nn/weights/champion.json
git commit -m "feat(ia): champion génération N"
```

La CI déploie après fusion sur `main`.

## 6. Revenir en arrière

Deux possibilités :

- variable d'environnement `AI_EVAL=legacy` sur Render : les niveaux d'aventure reviennent à `evaluate.ts`, sans redéploiement de code ;
- `git revert` du commit du champion.

## 7. Comparer deux IA à la main

La commande `ai:arena` oppose deux côtés (`legacy`, `nn`, un fichier de poids `.json`, ou `level:1` à `level:5`), sur des decks miroirs :

```powershell
# un challenger entraîné contre evaluate.ts, à temps égal
pnpm --filter @pipou/backend ai:arena --challenger ../../tools/ai-train/runs/main/gen-007/weights.json --champion legacy --time-ms 200
# deux niveaux de l'aventure
pnpm --filter @pipou/backend ai:arena --challenger level:4 --champion level:3
```

Autres options : `--games` (400), `--seed`, `--budget`, `--workers`, `--json sortie.json`. Attention : `pnpm --filter` s'exécute dans `apps/backend`, donc un chemin relatif se lit depuis ce dossier (d'où le `../../tools/ai-train/...`).

## 8. Dépannage

- **`pnpm introuvable ou inutilisable dans le PATH`** : ouvrir le terminal à la racine du dépôt (ou vérifier que `pnpm --version` répond), puis relancer.
- **`position encodée en version X, attendu Y`** : l'encodage des positions a changé depuis la génération des données. Les anciennes données et poids sont inutilisables : repartir avec un nouveau `--run`.
- **parité refusée** (`ai:check-weights` échoue, écart > 1e-5 entre TypeScript et PyTorch) : ne pas promouvoir, ouvrir un ticket.
- **un nouveau `champion.json` n'est pas pris en compte** : le backend le met en cache une fois par processus, il faut le redémarrer après le remplacement.
- **PC trop lent** : baisser `--games` ou `--budget`, ou réduire `--workers`.
