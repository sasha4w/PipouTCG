# IA à réseau de neurones — design

Date : 2026-11-18 · Branche : `feat/ai-neural` (depuis `main` `c980017`)

## But

Une IA forte au sommet, dont les niveaux d'aventure sont dérivés. Sa note des
positions est apprise par auto-jeu, sur un seul PC, hors ligne, sans aucun appel
à un LLM. Le planificateur beam existant est gardé ; seule la note change.

Remplace le non-objectif « pas d'apprentissage automatique » de
`2026-10-22-ai-better-brain-design.md`.

## Critères de réussite

1. Le champion bat `evaluate.ts` (note manuelle de `main`) à au moins 60 % sur
   400 parties en arène, decks miroirs, à temps de réflexion égal.
2. Chaque niveau bat le niveau du dessous à environ 70 % (`ai:bench`).
3. En prod (Render gratuit, 0,1 CPU, 512 Mo), le niveau 5 répond en 2,5 s
   d'horloge au plus et le serveur Socket.io reste réactif pendant la réflexion.
4. Une session d'entraînement s'interrompt (Ctrl+C, coupure) et reprend à la
   même commande sans perte autre que l'étape en cours.
5. La console d'entraînement reste courte (une ligne par étape) ; les détails
   vont dans des fichiers.

## Non-objectifs

- Pas de tête de politique (le réseau ne propose pas de coups) ni d'ISMCTS : le
  CPU de Render ne le permet pas.
- Pas d'entraînement sur plusieurs machines.
- Pas de Python en CI ni en prod : seuls les poids JSON sont déployés.
- Pas de promotion automatique en prod : le champion est commité à la main.

## Architecture

```
┌──────────────────────┐  parties JSONL   ┌──────────────────────┐
│ 1. Auto-jeu (Node)   │ ───────────────► │ 2. Entraîneur        │
│ multi-processus      │                  │ (Python, PyTorch CPU)│
└──────────▲───────────┘                  └──────────┬───────────┘
           │ champion                                │ poids JSON
┌──────────┴───────────┐  promu si gagne  ┌──────────▼───────────┐
│ 4. Arène (Node)      │ ◄─────────────── │ 3. Note réseau (TS)  │
└──────────────────────┘                  └──────────────────────┘
```

Point d'insertion : le type `Evaluator` de `evaluate.ts` et `evaluatorOf(note)`.
Le planificateur, le tournoi et les outils de revue acceptent déjà une note
quelconque.

### Fichiers

Nouveaux, dans `apps/backend/src/fights/ai/nn/` :

| Fichier | Rôle |
|---|---|
| `encode.ts` | Position → entrée du réseau. Seul encodeur du projet. `ENCODING_VERSION`. |
| `mlp.ts` | Inférence pure TS (encodeur de carte, sommes DeepSets, MLP, tanh). |
| `weights.ts` | Chargement et validation d'un fichier de poids. |
| `nn-eval.ts` | `nnEvaluator(weights): Evaluator`, valeur × 1000. |
| `selfplay.ts` + `selfplay.cli.ts` | Parties d'auto-jeu → `data/genN/<graine>.jsonl.gz`. |
| `arena.cli.ts` | Challenger contre champion, verdict JSON. |
| `ai-worker.ts` | `worker_thread` de prod. |
| `weights/champion.json` | Poids déployés. |

Nouveaux, dans `tools/ai-train/` : `loop.py`, `model.py`, `dataset.py`,
`train.py`, `export.py`, `tests/`, `README.md`, `COURS.md`, `explore.ipynb`,
`requirements.txt`. `runs/` et `data/` sont ignorés par git.

Remplacés puis supprimés : `features.ts`, `learned-eval.ts`,
`learned-weights.ts`, `train.ts`, `train.cli.ts`, `selfplay-data.ts`,
`selfplay-data.cli.ts` et leurs specs (régression linéaire jamais entraînée),
ainsi que les scripts `ai:train` et `ai:selfplay-data`. `Note` devient
`'legacy' | 'nn' | <chemin .json>`.

Gardés : moteur, `planner.ts`, `determinize.ts`, `candidate-actions.ts`,
tournoi, `rollout.ts`, `regret.ts`, outils de revue. `evaluate.ts` de `main`
est gardé tel quel : génération 0, repli et jauge fixe. Les modifications non
commitées de `BETTER-AI` ne sont pas reprises.

## Encodage (`nn/encode.ts`)

- **Un seul encodeur, en TypeScript.** Il produit les données d'entraînement et
  l'entrée en prod. Python lit des vecteurs prêts et ne réimplémente pas le jeu.
- **Point de vue du joueur qui doit jouer** : blocs « moi » et « adversaire »,
  jamais p1/p2.
- **Information publique seulement.** Ma main est connue ; de l'adversaire, on
  connaît le nombre de cartes en main et au deck. Les ensembles de cartes
  restantes suivent la règle de `determinize.ts` : on connaît le multiensemble
  des cartes cachées, pas leur répartition entre main, deck et Primes.

Contenu :

- **Global** : primes des deux camps, tailles de main, deck et cimetière,
  `recycleEnergy`, numéro du tour, archétype des deux camps (one-hot), phase.
- **Carte** (même encodage partout) : stats de base (type, ATK, PV, coût,
  élément, stade, type de support) et, sur le plateau, état courant (ATK
  effective, PV actuels et max, mode, provocation, perçant, réduction de
  dégâts, nombre d'immunités, attaques restantes, invoqué ce tour, nombre
  d'équipements, compteurs de Charge) ; plus l'index de carte pour
  l'embedding. Les champs sans objet valent 0.
- **Ensembles** : mes monstres, monstres adverses, mes supports, supports
  adverses, ma main, mon deck restant, cartes cachées de l'adversaire
  (« menace cachée » : sa decklist moins les cartes vues sur le plateau, au
  cimetière ou bannies). Chaque ensemble est une liste de cartes de taille
  variable.
- **Index de carte** : table `cardId → index` figée dans le fichier de poids.
  Carte absente de la table → index 0 (« inconnue ») ; le réseau se rabat sur
  ses stats.

Format d'un échantillon JSONL : `{ g, v, global: number[], sets: { <nom>:
[{ i: number, x: number[] }] }, y }`, où `g` est le rang de la partie, `v`
`ENCODING_VERSION`, `y` le résultat (+1, −1, 0 nul).

## Réseau (`tools/ai-train/model.py`, `nn/mlp.ts`)

```
carte : [x, embedding(i) de 8] ─► Linéaire 64 ─► ReLU ─► Linéaire 32 ─► ReLU
ensemble : somme des cartes (32), un encodeur de carte partagé
tête : concat(global, 7 sommes) ─► 128 ─► ReLU ─► 128 ─► ReLU ─► 1 ─► tanh
```

Environ 40 000 paramètres. Sortie dans [−1, +1] ; `nnEvaluator` la multiplie
par 1000 pour garder l'échelle de `evaluate.ts`. États terminaux : ±Infinity
comme la note manuelle ; nul : −10 000.

Fichier de poids : `{ encodingVersion, generation, trainedAt, positions,
valLoss, cardIndex, layers: { <nom>: { w: number[][], b: number[] } } }`,
nombres arrondis à 6 chiffres.

## Entraînement

- **Cible** : résultat final de la partie vu par le joueur de la position.
  Perte MSE, optimiseur Adam.
- **Validation par partie** (`g % 10 == 0`), jamais par position.
- **Arrêt précoce** sur la perte de validation.
- **Buffer** : données des 4 dernières générations.
- **Génération 1** : parties jouées avec `evaluate.ts`.
- **Checkpoint** à chaque epoch ; reprise depuis le dernier.
- **Parité** : 50 positions fixes passées dans PyTorch et dans `mlp.ts` ; écart
  max 1e-5, sinon l'export est refusé. Les sorties PyTorch sont figées dans
  `nn/parity-fixture.json` pour le test Jest.

## Boucle (`python tools/ai-train/loop.py --hours N`)

Une génération :

1. **Auto-jeu** : `pnpm --filter @pipou/backend ai:selfplay` avec le champion,
   sur (cœurs logiques − 1) processus. Decks tirés de `generated-entries` et des
   decks d'aventure. Les 8 premiers coups de chaque joueur sont tirés par
   softmax avec température ; graine de déterminisation propre à chaque
   partie. Positions gardées par échantillonnage réservoir, comme
   `selfplay-data.ts` aujourd'hui.
2. **Entraînement** → challenger.
3. **Parité**.
4. **Arène** : `ai:arena`, 400 parties ; chaque paire de decks est jouée dans
   les deux sens avec la même graine. Promotion si taux de victoire ≥ 55 % et
   borne basse de Wilson à 95 % > 50 %.
5. Match de jauge du champion contre `evaluate.ts` (score suivi dans le
   rapport).

Reprise : `runs/<run>/state.json` garde génération et dernière étape terminée.
Toute sortie est écrite en `.tmp` puis renommée. Relancer la même commande
reprend. La limite `--hours` est vérifiée entre deux étapes ; une étape en cours
se termine.

Sorties : une ligne console par étape (ex. `gen 4 · arène 58.2 % → promu`) ;
`runs/<run>/report.md` avec courbes PNG de perte, taux de victoire par
génération et score de jauge.

Le nombre de parties par génération est mesuré sur le Ryzen 5 5600 dans la
première tâche du plan, puis fixé dans `loop.py`.

Mise en prod : copier le champion dans `nn/weights/champion.json`, commiter,
la CI déploie.

## Prod

- **`worker_thread`** unique (`ai-worker.ts`), poids chargés une fois. Il
  reçoit l'état et le niveau, renvoie l'action. Le tour de l'IA dans
  `fights.service.ts` devient asynchrone.
- **Plafond dur 4 s** ou worker mort → le thread principal joue le coup
  glouton de `evaluate.ts` ; le worker est relancé.
- **Niveaux** (point de départ, réglé par `ai:bench`) :

| Niveau | Temps max | Recherche | Température |
|---|---|---|---|
| 1 | 300 ms | glouton | haute |
| 2 | 300 ms | glouton | moyenne |
| 3 | 800 ms | beam 3, profondeur 6 | basse |
| 4 | 1 500 ms | beam 6, profondeur 9 | très basse |
| 5 | 2 500 ms | `STRONGEST` | 0 |

  Tous les niveaux utilisent la note réseau. `mistakeRate` disparaît : le coup
  final est tiré par softmax sur la valeur des candidats à la racine, divisée
  par la température. Température 0 → meilleur coup.
- **Temps d'horloge** : le planificateur rend son meilleur coup à l'échéance ;
  plusieurs combats simultanés se partagent le CPU sans allonger l'attente.
- **Retour arrière** : `AI_EVAL=nn|legacy` (défaut `nn`). Repli automatique sur
  `legacy` si le fichier de poids manque ou si `encodingVersion` diffère de
  `ENCODING_VERSION`, avec un log d'avertissement.

## Tests

TypeScript (Jest, CI) :

- `encode.spec.ts` : vecteur attendu sur une position fixe ; symétrie p1/p2
  (camps inversés) ; la main adverse n'influe pas sur l'encodage ; carte
  inconnue → index 0.
- `mlp.spec.ts` : petits poids écrits à la main, sortie calculée à la main.
- `parity.spec.ts` : `parity-fixture.json`, écart < 1e-5.
- `weights.spec.ts` : version différente ou fichier absent → repli `legacy`.
- `ai-worker.spec.ts` : coup légal ; worker tué → coup glouton de repli.
- `level-brains.spec.ts` : températures et temps ; niveau 5 déterministe à
  graine fixe.
- `selfplay.spec.ts`, `arena.spec.ts` : format JSONL, decks miroirs, verdict.

Python (`pytest`, local) : forme du réseau, export JSON relu à l'identique,
reprise depuis checkpoint, séparation train/validation par partie sans fuite.

## Guide (`tools/ai-train/`)

- `README.md` : installer Python 3.12, créer un `venv`, installer PyTorch CPU,
  lancer `loop.py`, lire `report.md`, promouvoir un champion, revenir en
  arrière.
- `COURS.md` : neurone, couche, activation, descente de gradient, MSE, Adam,
  sur-apprentissage, validation, embeddings, DeepSets, boucle AlphaZero-lite ;
  chaque notion renvoie au fichier et à la ligne qui l'applique.
- `explore.ipynb` : charger des parties, entraîner sur un petit échantillon en
  regardant la perte, inspecter les embeddings (cartes jugées proches).
- Code Python commenté ligne par ligne, en français.

## Risques

- **Trop peu de parties par heure** sur le 5600 : le réseau apprend lentement.
  Mesure en tâche 1 ; si besoin, auto-jeu avec un budget de planificateur
  réduit (la qualité de la cible vient du résultat, pas de la recherche).
- **Coût d'inférence** plus élevé que `evaluate.ts` : moins de nœuds explorés
  dans le même temps. Mesuré par `ai:bench` à temps égal ; c'est le temps égal
  qui décide, pas le budget égal.
- **Nouvelles cartes** après entraînement : index 0 + stats ; réentraîner après
  chaque ajout de cartes notable.
