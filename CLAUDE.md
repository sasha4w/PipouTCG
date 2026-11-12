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

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.
