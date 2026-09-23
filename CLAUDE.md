# PipouTCG — monorepo

pnpm workspaces, Node 22.

| Chemin | Contenu |
|---|---|
| `apps/backend` | API NestJS 11 + TypeORM (MySQL Aiven) + Socket.io — déployée sur Render (Docker) |
| `apps/frontend` | React 18 + Vite PWA — déployé sur Netlify |
| `packages/shared` | `@pipou/shared` : enums, types de jeu, événements Socket, corps de requêtes |
| `packages/tsconfig` | options TypeScript communes |

## Règles
- Tout type ou enum échangé entre front et back vit dans `@pipou/shared`. Ne jamais le redéfinir dans une app.
- Le backend est la source de vérité des valeurs d'enums (elles sont en BDD).
- `@pipou/shared` n'a aucune dépendance runtime.
- Après modification de `packages/shared` : `pnpm build:shared` (ou `pnpm dev`, qui le fait en watch).

## Commandes
- `pnpm dev` — shared en watch + back + front
- `pnpm typecheck` / `pnpm test` / `pnpm lint` / `pnpm build`
- `pnpm --filter @pipou/backend <script>` pour une seule app

## Déploiement
Uniquement via la CI (`.github/workflows/ci.yml`) sur `main`, après succès des jobs.

Règles spécifiques : `apps/frontend/CLAUDE.md`, `apps/backend/.cursorrules`.
