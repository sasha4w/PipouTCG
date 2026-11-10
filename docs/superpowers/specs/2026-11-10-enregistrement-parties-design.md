# Enregistrement des parties — design

Date : 2026-11-10 · Branche : BETTER-AI

## But

Enregistrer en production chaque partie, JcJ et PvE, pour deux usages :

1. **Apprentissage de l'IA** (plan ultérieur) : imiter les coups des joueurs et apprendre la valeur des positions à partir de vraies parties.
2. **Suivi de la méta** (page de stats ultérieure) : cartes les plus jouées (monstres et supports), cartes qui tuent le plus, decks et archétypes les plus utilisés, taux de victoire.

Hors périmètre : l'entraînement, la page de graphes. Ce design ne livre que la collecte, le stockage et l'export.

Décisions prises avec l'utilisateur :
- enregistrement en prod, toutes les parties, coups humains **et** coups de l'IA ;
- pas besoin de prévenir les joueurs (pas de mention CGU) ;
- un résumé interrogeable en SQL (colonne JSON) en plus de la trace brute.

## Données

### Table `game_record` (une ligne par partie terminée)

| Colonne | Type | Rôle |
|---|---|---|
| `id` | int auto | clé |
| `match_id` | int | id en mémoire (`match.id` en JcJ, `-adventureMatchId` en PvE) |
| `mode` | varchar(8) | `pvp` ou `pve` |
| `player1_id` | int | humain du siège p1 |
| `player2_id` | int null | humain du siège p2 ; null en PvE |
| `winner_seat` | varchar(4) null | `p1`, `p2` ou null (nul / non terminé) |
| `end_reason` | varchar(32) null | `GameEndReason` |
| `turns` | int | `turnNumber` final |
| `moves` | int | nombre d'entrées de la trace |
| `summary` | json | résumé pour les stats (voir plus bas) |
| `trace` | longblob null | trace brotli ; null si trace abandonnée (plafond) |
| `trace_bytes` | int | taille du blob, pour le plafond global |
| `format_version` | smallint | 1 |
| `started_at` / `ended_at` | datetime | |

Index : `ended_at`, `mode`. Migration `1791000000028-GameRecord`, appliquée par `start:prod:migrate` au déploiement CI. L'entité n'a pas de clé étrangère vers `user` (une ligne doit survivre à la suppression d'un compte).

### Trace (`trace`)

NDJSON compressé en brotli, une ligne par entrée :

1. En-tête : `{ "v": 1, "mode", "seats": { "p1": { "kind": "human"|"ai", "userId", "archetype"?, "level"?, "opponentId"? }, "p2": … } }`.
2. Une entrée par coup **accepté** : `{ "i", "seat", "by": "human"|"ai", "state", "action" }`. `state` est l'état **avant** le coup.
3. Une entrée par timeout appliqué (`engine.timeout`) : `{ "i", "seat", "by": "timeout", "state" }`.
4. Fin : `{ "end": { "winner": "p1"|"p2"|null, "endReason", "primes": { "p1", "p2" } } }`.

`state` est le `GameState` complet, cartes de base comprises (on garde les cartes telles qu'elles étaient au moment de la partie : les patchs d'équilibrage ne cassent pas les anciennes traces). On en retire `log`, `pendingEvents` et, pour chaque joueur, `socketId` et `username`. Un coup refusé par le moteur n'est pas enregistré. Les coups légaux ne sont pas stockés : l'entraînement les recalcule depuis l'état.

Mesure sur le banc : un état ≈ 58 Ko en JSON, 8 Ko en gzip seul ; des états proches compressés ensemble en brotli tombent à quelques centaines d'octets chacun. Estimation : 30 à 80 Ko par partie, à confirmer sur les premières parties réelles.

### Résumé (`summary`)

```ts
interface GameRecordSummary {
  v: 1;
  mode: 'pvp' | 'pve';
  seats: Record<Seat, {
    kind: 'human' | 'ai';
    archetype: AdventureArchetype | null; // archétype dominant du deck, ou celui de l'IA
    deck: { cardId: number; count: number }[];
    level?: number;      // PvE : niveau de l'IA
    opponentId?: number; // PvE : adversaire d'aventure
  }>;
  /** Par carte (id de carte de base) et par siège. */
  cards: Record<Seat, Record<number, {
    summoned?: number;   // invoqué (y compris depuis un œuf ou un choix)
    supported?: number;  // support posé (terrain, équipement, charge…)
    evolved?: number;    // évolution jouée sur cette carte
    recycled?: number;
    kills?: number;      // monstres adverses détruits, attribués à la carte qui agit
    destroyed?: number;  // fois où ce monstre a été détruit
  }>>;
}
```

Attribution des kills : après chaque coup accepté, les événements `monster_destroyed` d'un monstre adverse sont crédités à la carte qui agit — l'attaquant pour `attack`, la carte jouée pour `summon`, `play_support`, `evolve`. Les autres destructions (charges déclenchées en fin de phase, timeouts) ne sont créditées à personne mais comptent dans `destroyed`. C'est une approximation assumée, documentée dans le code.

Les noms de cartes ne sont pas stockés : la page de stats les joindra depuis la table `card`. Taille attendue : 1 à 2 Ko.

Le type `GameRecordSummary` et les types d'export vivent dans `@pipou/shared`.

## Collecte

Nouveau service `GameRecorder` (module `fights`), injecté dans `FightsService` :

- `start(game, meta)` au lancement d'une partie (JcJ après création, PvE après préparation de l'IA) : écrit l'en-tête.
- `beforeMove(game)` → renvoie l'état sérialisé (chaîne JSON) ; `afterMove(game, seat, by, action, snapshot)` appelé seulement si le moteur a accepté le coup : écrit l'entrée et met à jour le résumé à partir de `game.pendingEvents`.
- `timeout(game, seat, snapshot)` pour `engine.timeout`.
- `finish(game)` dans `finish()` de `FightsService`, avant `cleanupGame` : écrit la fin, ferme le flux, insère la ligne.
- `discard(matchId)` si la partie disparaît sans fin (nettoyage).

Les points d'appel sont les `engine.dispatch` et `engine.timeout` de `fights.service.ts` : coup humain (`dispatch`), coup IA (`tryAiAction`), timeouts (`onTimeout`, `forceAiProgress`).

Compression en flux : un `zlib.createBrotliCompress` par partie (`quality` 5, `lgwin` 20) ; seuls les morceaux compressés restent en mémoire. Coût estimé : quelques Mo par partie en cours, compatible avec les 512 Mo de Render.

## Sécurité et limites

- **Jamais bloquant** : chaque appel du `GameRecorder` est enveloppé dans un try/catch qui journalise un avertissement et abandonne l'enregistrement de cette partie. L'insertion en fin de partie n'est pas attendue par la partie (fire-and-forget avec capture d'erreur).
- **Interrupteur** : `GAME_RECORDING=off` désactive toute collecte. Par défaut activé.
- **Plafond global** : `GAME_RECORD_MAX_MB` (défaut 500). Somme de `trace_bytes` relue au démarrage puis tenue à jour en mémoire ; au-delà, les nouvelles parties gardent leur `summary` mais `trace` vaut null.
- **Plafond par partie** : au-delà de 3 000 entrées, la trace est abandonnée (summary conservé).
- **Parties concurrentes** : au-delà de 30 traces ouvertes, les nouvelles parties n'ont que le résumé.
- Une partie en cours est perdue si le serveur redémarre : accepté.

## Export (admin)

Contrôleur `admin/game-records`, gardé par `JwtAuthGuard` + `AdminGuard` comme `ai-review` :

- `GET admin/game-records?from&to&mode&page` : liste paginée (métadonnées + `summary`).
- `GET admin/game-records/:id/trace` : le blob brut, `Content-Type: application/x-ndjson`, `Content-Encoding: br` (le navigateur ou `curl --compressed` décompresse).

La récupération pour l'entraînement passe par ces routes, jamais par un accès direct à Aiven.

## Tests

- `GameRecorder` : aller-retour (états écrits → blob → décompression → mêmes états, champs retirés absents) ; coup refusé non enregistré ; résumé (invocation, support, évolution, recyclage, kill d'attaque, kill d'effet, destruction non attribuée) ; plafonds (entrées, global, concurrence) ; interrupteur ; une exception interne n'atteint pas l'appelant.
- `FightsService` : une partie PvE de test jusqu'à la fin produit une ligne avec coups humains et IA ; une partie JcJ abandonnée (`surrender`) produit une ligne.
- Contrôleur : refus sans admin, liste filtrée, trace servie avec les bons en-têtes.
- Migration : colonnes alignées sur l'entité (`migrations-columns.spec.ts`).
