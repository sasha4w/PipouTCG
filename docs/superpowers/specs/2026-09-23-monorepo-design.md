# Migration PipouTCG vers un monorepo — Design

Date : 2026-09-23
Statut : validé en brainstorming, en attente de relecture

## Objectif

Fusionner `sasha4w/tcg-backend` et `sasha4w/tcg-frontend` dans un seul dépôt `sasha4w/PipouTCG` pour :

1. mutualiser le code dupliqué entre front et back (enums, types de jeu, contrat d'API, événements Socket) ;
2. mutualiser l'outillage (TypeScript, ESLint, Prettier, versions Node) ;
3. fiabiliser les déploiements : on ne déploie que ce qui a passé lint, typecheck, tests et build.

## Contexte actuel

| | Backend | Frontend |
|---|---|---|
| Stack | NestJS 11, TypeORM, MySQL, Socket.io | React 18, Vite 7, PWA, Zustand, TanStack Query |
| Hébergement | Render (Docker), `tcg-backend-3lez.onrender.com` | Netlify (site statique) |
| BDD | MySQL Aiven (SSL via `DB_SSL_CA_BASE64`) | — |
| CI | aucune | GitHub Actions, Node 18/20 |
| Tests | Jest (+ Cucumber/Playwright e2e, hors CI) | Vitest |
| Package manager | npm | npm |
| Module | CommonJS (`module: nodenext`) | ESM |

Le runtime de prod est Node 22 (image `node:22-alpine`).

### Doublons constatés

- Enums : `Rarity`, `CardType`, `SupportType`, `ProductType`, `TransactionStatus`, `RewardType`, `MatchStatus` définis des deux côtés.
- Types de jeu : `CardInstance`, `MonsterOnBoard`, `PendingChoice`, `ClientChoiceCandidate`, `CardEffect`, état client.
- Contrat d'API : DTOs backend vs `*Request` / interfaces de réponse frontend.
- Événements Socket (`fight:state`, `fight:summon`, …) en chaînes littérales des deux côtés.
- Outillage : deux configs ESLint/Prettier/tsconfig, TypeScript 5.7 vs 5.9, `@types/node` 22 vs 24.

### Trois copies des types côté front

Les types réellement utilisés par le front vivent dans `src/services/*.service.ts` et `src/features/fight/fight.types.ts` ; ils sont alignés sur le backend. Une troisième copie, `src/types/` (`common.ts`, `fight.ts`, `api.ts`, `index.ts`, `schemas.ts`), contient des valeurs fausses :

| Enum | Backend (vérité, en BDD) | `src/types/common.ts` |
|---|---|---|
| `TransactionStatus` | `PENDING` / `COMPLETED` / `CANCELLED` | minuscules |
| `MatchStatus` | `in_progress` / `finished` / `abandoned` | `pending` / `active` / `finished` / `abandoned` |
| `SupportType` | `EPHEMERAL` / `EQUIPMENT` / `TERRAIN` | `continuous` / `quick_play` / `ritual` |
| `ProductType` | `CARD` / `BOOSTER` / `BUNDLE` | minuscules |
| `CardType` | `monster` / `support` | + `spell` |

Seuls `stores/gameStore.ts` et `features/fight/hooks/useGameSession.ts` importent `src/types` (pour `GameState` et `PlayerStats`), et `api/api.ts` importe `types/schemas.ts`. C'est un piège pour tout nouveau code, pas un bug actif. Cette copie est supprimée.

### Noms en collision dans le backend

- `RewardType` existe deux fois : daily-reward (`gold`, `card`, `booster`, `bundle`) et quêtes (`GOLD`, `BOOSTER`, `BUNDLE`).
- `ConditionType` existe deux fois : quêtes et effets de cartes.

Dans shared, ils deviennent `DailyRewardType`, `QuestRewardType`, `QuestConditionType` et `EffectConditionType`.

## Décisions

| Sujet | Décision |
|---|---|
| Historique Git | Conservé : chaque dépôt réécrit sous `apps/<nom>` puis fusionné ; anciens dépôts archivés |
| Outil monorepo | pnpm workspaces (sans Turborepo) |
| Périmètre du partage | Contrat typé (enums, types, événements Socket, constantes). Pas de schémas de validation partagés |
| Consommation de `shared` | Package compilé par tsup (CJS + ESM + `.d.ts`) |
| Déclenchement des deploys | Par la CI GitHub Actions, après succès ; auto-deploy des plateformes désactivé |

## Structure

```
PipouTCG/
├── apps/
│   ├── backend/              @pipou/backend (ex tcg-backend)
│   │   ├── Dockerfile        réécrit pour le monorepo
│   │   └── .env.example
│   └── frontend/             @pipou/frontend (ex tcg-frontend)
│       └── .env.example
├── packages/
│   ├── shared/               @pipou/shared
│   └── tsconfig/             @pipou/tsconfig (base.json, node.json, react.json)
├── docs/
├── .github/workflows/ci.yml  unique, remplace celle du frontend
├── docker-compose.yml        MySQL local + api
├── .prettierrc  .gitignore  .nvmrc (22)
├── pnpm-workspace.yaml       workspaces + catalog
├── CLAUDE.md                 vue d'ensemble du monorepo (les CLAUDE.md/.cursorrules des apps restent en place)
└── package.json              scripts racine : dev, build, lint, typecheck, test
```

### Outillage mutualisé

- Versions uniques via le `catalog:` pnpm : `typescript` 5.9, `@types/node` 22, `eslint`, `typescript-eslint`, `@eslint/js`, `globals`, `prettier`, `vitest`.
- Les configs ESLint restent dans chaque app : elles n'ont presque rien en commun (règles type-checked Node côté back, règles React côté front). Seules les versions sont mutualisées.
- Prettier : une config racine qui reproduit le style actuel de chaque app (guillemets simples pour le back, doubles pour le front) pour éviter un reformatage massif.
- Pas de `pnpm import` : il ne sait pas fusionner deux lockfiles. Les dépendances sont résolues à neuf dans les plages `^` existantes, puis vérifiées par les tests.
- Node 22 partout (`.nvmrc`, `engines`, CI, Docker).
- Supprimés : `coverage/`, `dev-dist/`, les deux `package-lock.json` (remplacés par `pnpm-lock.yaml`).
- `.env` par app, non versionnés ; `.env.example` versionnés.
- Script racine `pnpm dev` : lance `tsup --watch` de shared, le back et le front en parallèle.

## `@pipou/shared`

### Contenu

```
packages/shared/src/
├── enums/      Rarity, CardType, SupportType, Archetype, ProductType, TransactionStatus,
│               BannerItemType, CardNumber, DailyRewardType, QuestType, QuestResetType,
│               QuestRewardType, QuestConditionType, ConditionOperator, MatchStatus,
│               MatchEndReason, EffectTrigger, EffectConditionType, ActionType, EffectTarget
├── game/       ClientCard, CardEffect (+ condition/filter/action), CardInstance<C>,
│               MonsterOnBoard<C>, CombatMode, GamePhase, GameEndReason,
│               PendingChoiceResolution, ClientChoiceCandidate, ClientPendingChoice,
│               MyClientState, OpponentClientState, ClientGameState
├── api/        corps de requête (Login/Register/…, Create*/Update*Request),
│               PaginationQuery, PaginationMeta, PaginatedResponse<T>
├── socket/     FIGHT_NAMESPACE, payloads, ClientToServerEvents, ServerToClientEvents
└── index.ts
```

Les **types de réponse** (User, Deck, Booster…) restent dans les services du front. Ils sont construits à partir d'entités TypeORM avec relations et dates sérialisées, et le backend ne peut pas les `implements`. Les partager ne vérifierait rien.

`CardInstance` et `MonsterOnBoard` sont génériques sur le type de carte : le front utilise `ClientCard` (valeur par défaut) et le back `Card` (l'entité). Le back garde ainsi ses types internes exacts, tandis que `buildClientState` est vérifié contre `ClientGameState`.

### Règles

1. **Le backend est la source de vérité.** Ses valeurs actuelles sont reprises à l'identique ; aucune migration BDD.
2. **Enums en objets `as const` + type homonyme** :
   ```ts
   export const Rarity = { COMMON: 'common', /* … */ } as const;
   export type Rarity = (typeof Rarity)[keyof typeof Rarity];
   ```
   Compatible TypeORM (`enum: Rarity`), class-validator (`@IsEnum(Rarity)`) et Vite. `Rarity.COMMON` reste valide partout.
3. **Seul l'état client du jeu est partagé.** `GameState`, `PlayerGameState`, `QueueEntry` (état serveur, contenant deck et main adverse) restent dans le backend.
4. **Zéro dépendance runtime** : pas de Nest, TypeORM, React ni Zod dans shared.
5. Build tsup : `dist/index.cjs`, `dist/index.js`, `dist/index.d.ts`, exposés via `exports` dans `package.json`.

### Usage backend

- Suppression de `*/enums/*.ts` et de la partie client de `fights/interfaces/game-state.interface.ts` ; imports depuis `@pipou/shared`.
- Les DTOs gardent class-validator et déclarent `implements <XxxRequest>` pour casser à la compilation si le contrat diverge.
- Gateway Socket typé : `Server<ClientToServerEvents, ServerToClientEvents>`.

### Usage frontend

- Les services (`card.service.ts`, `transaction.service.ts`, `quest.service.ts`…) remplacent leurs définitions locales par des ré-exports de `@pipou/shared` sous les **mêmes noms** : les composants qui les importent ne changent pas.
- `features/fight/fight.types.ts` ré-exporte les types de jeu partagés sous ses noms actuels (`GameState`, `MyState`, `OppState`, `PendingChoice`, `Phase`…) et garde ce qui est propre à l'UI (`Tab`, couleurs, libellés, IDs de cartes spéciales).
- Suppression de `src/types/common.ts`, `fight.ts`, `api.ts`, `index.ts`. `gameStore.ts` et `useGameSession.ts` importent depuis shared et `fight.service.ts`.
- `types/schemas.ts` (Zod) reste, mais utilise les enums partagés (`z.enum(Rarity)`) au lieu de `z.string()`.
- Socket client typé : `Socket<ServerToClientEvents, ClientToServerEvents>`.

## CI et déploiements

### Workflow unique `.github/workflows/ci.yml`

Node 22, pnpm avec cache. Déclenché sur push et PR vers `main`.

1. **changes** — `dorny/paths-filter` :
   - `apps/backend/**` → backend
   - `apps/frontend/**` → frontend
   - `packages/**`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, config racine → backend et frontend
2. **backend** (si concerné) : build shared → lint → typecheck → test (Jest) → build → `docker build` de validation.
3. **frontend** (si concerné) : build shared → lint → typecheck → test (Vitest) → build (avec `VITE_API_URL` de prod) → contrôle de taille du bundle → artefact `dist/`.
4. **deploy** — uniquement sur push `main`, `needs` des jobs précédents :
   - backend concerné : `curl -X POST "$RENDER_DEPLOY_HOOK_URL"`.
   - frontend concerné : `netlify deploy --prod --dir apps/frontend/dist` avec l'artefact testé.
   - Chaque étape est ignorée si son secret est absent.

Secrets GitHub : `RENDER_DEPLOY_HOOK_URL`, `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID`, `VITE_API_URL`.

### Render (backend)

- Même service (URL et variables d'env conservées) ; dépôt lié changé vers `sasha4w/PipouTCG`.
- Dockerfile path : `apps/backend/Dockerfile` ; Docker context : racine du dépôt.
- Auto-deploy désactivé.
- Dockerfile multi-stage :
  1. `pnpm fetch` (cache des dépendances à partir du lockfile seul)
  2. `pnpm install --frozen-lockfile --offline`, build `@pipou/shared` puis `@pipou/backend`
  3. `pnpm deploy --filter @pipou/backend --prod /prod`
  4. runtime `node:22-alpine` avec uniquement `/prod` ; `CMD ["node", "dist/main"]` inchangé
- Commande de démarrage et gestion des migrations inchangées.

### Netlify (frontend)

- Builds Netlify désactivés ; déploiement uniquement via la CLI depuis la CI.
- `public/_redirects` et `public/_headers` copiés dans `dist/` : routage SPA et en-têtes inchangés.

### Aiven

Aucun changement.

### Correctifs URL d'API

- `vite.config.ts` : le motif `runtimeCaching` de l'API est construit à partir de `VITE_API_URL` au lieu de l'URL Render codée en dur.
- `api/api.ts` : `baseURL` lit `VITE_API_URL` (comme le socket le fait déjà) au lieu de l'URL codée en dur. Le `.env` local pointe déjà sur Render, donc le comportement ne change pas.

## Ordre de migration

Chaque étape laisse le dépôt dans un état qui build et passe les tests. La prod n'est modifiée qu'à l'étape 7.

0. **Baseline** : lint, typecheck, tests, build dans les deux dépôts actuels ; noter les échecs préexistants. Résoudre la modification non commitée `tcg-backend/.vscode/settings.json`.
1. **Création du dépôt** : clones frais, `git filter-repo --to-subdirectory-filter apps/<nom>` (repli : commit de `git mv`), fusion `--allow-unrelated-histories`. Vérifier `git log`/`git blame`. Copier les `.env` manuellement. Remplacer les dossiers `tcg-backend/` et `tcg-frontend/` locaux par le monorepo.
2. **pnpm workspace** : racine, `pnpm-workspace.yaml`, catalog ; résolution à neuf dans les plages existantes. Vérifier build et tests identiques à la baseline.
3. **Outillage mutualisé** : `@pipou/tsconfig`, Prettier, `.gitignore`, `.nvmrc`, `CLAUDE.md` racine. Vérifier lint et typecheck.
4. **`@pipou/shared`**, un commit par sous-étape, typecheck + tests des deux apps après chacune :
   - a. enums (back puis front) ;
   - b. types de jeu client, suppression de `src/types/` sauf `schemas.ts` ;
   - c. événements Socket typés ;
   - d. types d'API + `implements` sur les DTOs.
5. **Docker** : nouveau Dockerfile, `docker-compose.yml` racine ; `docker compose up` local, API démarrée et connectée à MySQL.
6. **CI** : création de `sasha4w/PipouTCG`, push, CI verte (deploy inactif faute de secrets).
7. **Bascule** (avec l'utilisateur, sur ses comptes) : secrets GitHub ; Render (dépôt, Dockerfile path, auto-deploy off) ; Netlify (builds off) ; push `main` ; vérification prod : API répond, front charge, connexion, partie de test via WebSocket, cache PWA.
8. **Archivage** des dépôts `tcg-backend` et `tcg-frontend`.

### Retour arrière

Jusqu'à l'étape 7, anciens dépôts et prod intacts. Après : repointer Render sur `tcg-backend` et réactiver les builds Netlify.

## Vérification

- Tests existants (Jest, Vitest) verts à chaque étape, comparés à la baseline.
- Typecheck des deux apps : c'est lui qui garantit la cohérence du contrat partagé.
- `docker build` en CI ; `docker compose up` en local à l'étape 5.
- Vérification manuelle de la prod après bascule (étape 7).

## Hors périmètre

- Schémas Zod partagés et remplacement de class-validator (`nestjs-zod`).
- Turborepo.
- Tests e2e Cucumber/Playwright en CI (nécessitent une BDD).
- Modification de la gestion des migrations en prod.
- Upload Codecov et commentaire de couverture sur les PR (non repris de l'ancienne CI du front).
- Partage des types de réponse d'API.
