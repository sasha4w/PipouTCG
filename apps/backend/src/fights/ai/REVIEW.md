# Revue des décisions de l'IA

Boucle : **journaliser → relire → annoter → exporter**. Le journal est désactivé par défaut et ne change aucune décision.

## 1. Journaliser

- Combat PvE réel : lancer le backend avec `AI_DECISION_LOG=/chemin/journal.jsonl`. Chaque coup de l'IA y est ajouté.
- IA contre IA, avec le cerveau du niveau comme en aventure :
  `pnpm --filter @pipou/backend ai:selfplay-log journal.jsonl --a "pipou niveau 3" --b "dragon niveau 3" --games 4 --seed 1`
  (`--brain greedy|plan|level`, `level` par défaut. Le fichier est écrasé.)

Une ligne = un `DecisionRecord` (`decision-log.ts`) : tour, phase, siège, archétype, niveau, source du choix
(`greedy`, `plan`, `mistake`, `mulligan`, `fallback`), coup choisi, candidats acceptés par le moteur avec leur
score `evaluate`, plantages de simulation, et `state` : copie profonde de l'état **complet** (mains et decks
adverses compris). C'est une donnée de débogage pour rejouer le cas. L'IA, elle, décide toujours sur
`determinize`.

Score ±Infinity (victoire/défaite) : écrit ±1e9 (`TERMINAL_SCORE`).

## 2. Relire

```
pnpm --filter @pipou/backend ai:review list     journal.jsonl
pnpm --filter @pipou/backend ai:review suspects journal.jsonl --min 5
pnpm --filter @pipou/backend ai:review show     journal.jsonl <id>
```

`regret` = meilleur score candidat − score du coup choisi. **Indicateur approximatif** : `evaluate` ne voit qu'un
coup, et le planificateur (`source=plan`) choisit pour des suites que ce score ne voit pas. Pour `end_phase`, le
glouton compare à la base `baseline` (état avant de jouer) : le regret l'utilise. Un regret élevé dit « à
regarder », pas « erreur ».

## 3. Annoter

```
pnpm --filter @pipou/backend ai:review annotate journal.jsonl <id> \
  --verdict better_action --prefer <n° de candidat vu avec show> \
  --category threat_priority --comment "B est une menace létale" --outcome loss
```

Verdicts : `good`, `better_action` (demande `--prefer`), `tactical_error`, `missing_candidate`, `uncertain`.
Catégories : `candidate_generation`, `heuristic_evaluation`, `lookahead`, `combat_calculation`,
`threat_priority`, `card_synergy`, `opportunity_cost`, `other`.
Un coup absent des candidats (`missing_candidate`) s'écrit en éditant le JSONL : `preferred` y est une action libre.

Les annotations vont dans `journal.jsonl.annotations.jsonl`.

## 4. Exporter

`pnpm --filter @pipou/backend ai:review export journal.jsonl > revue.jsonl` : une ligne par décision, avec ses
annotations (`{ decision, annotations }`). Les annotations sans décision sont comptées sur stderr.

## Expliquer une décision

`pnpm --filter @pipou/backend ai:explain journal.jsonl <id>` rejoue chaque coup candidat sur l'état enregistré
(vrai moteur) et affiche, pour chacun, l'écart avec le coup choisi morceau par morceau du score : `primes`, `hand`,
`myBoard`, `oppBoard`, `threat` (menace au tour adverse), `potential`, `archetype`… Exemple : « menace −1825 » dit
que ce coup expose un monstre que l'adversaire peut tuer. Le détail vient de `evaluate(…, parts)`, qui ne change
pas le score.

## Partie complète

Avec `AI_DECISION_LOG`, les coups du joueur et la fin de partie vont dans `<journal>.human.jsonl` (`MatchEvent`) :
le journal de l'IA seul ne voit ni les coups adverses ni le résultat.

## Revue dans l'appli (admin)

Sans `AI_DECISION_LOG`, les combats d'aventure d'un compte admin sont journalisés en base (`ai_decision`,
`ai_annotation`) et relus dans l'onglet Admin « Revue IA ». `GET /admin/ai-review/export` sort les annotations
avec le contexte de leur décision.

## Limites connues

- Le journal est lourd : environ 3 Mo par partie, car chaque décision garde l'état complet.
- Les ids sont `${run}:${matchId}:${siège}:${n}`. En self-play, `run` = `seed<graine>` : un journal ne doit pas
  contenir deux fois la même graine.
- Pas encore : transformer une annotation en test de régression, ni comparer un champion à un challenger.
