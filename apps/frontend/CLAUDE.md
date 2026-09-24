# Frontend PipouTCG

React 18 + TypeScript (strict) + Vite PWA, déployé sur Netlify. Voir aussi le `CLAUDE.md` racine (monorepo, `@pipou/shared`).

## Organisation

```
src/
├── api/          instance axios (VITE_API_URL, cookie, 401 → /login, retry 5xx)
├── services/     un service par ressource de l'API + types de réponse
├── features/     écrans par domaine (fight, marketplace, cards, deck, shop, quests…)
├── pages/        pages routées
├── components/   composants réutilisables
├── hooks/        hooks transverses (toast, SSE, données de jeu)
├── contexts/     SoundContext, DailyRewardContext
├── utils/        querykeys.ts, errors.ts
└── i18n/         traductions (fr, en, ko)
```

## Conventions

- **Données serveur : TanStack Query uniquement.** Pas de `useEffect` + `setState` pour charger des données.
  - Clés centralisées dans `utils/querykeys.ts` (`QUERY_KEYS`), jamais de clé écrite en dur ailleurs.
  - Après une mutation : `invalidateQueries` (ou `setQueryData` pour une mise à jour locale), y compris les listes d'options (`cardSetOptions`, `boosterOptions`…).
- **État dérivé plutôt que synchronisé** : ce qui se calcule depuis les props ou une requête se calcule au rendu, sans `useEffect` qui recopie une valeur.
- **Pas de composant déclaré dans un composant** : il serait remonté à chaque rendu. Utiliser une fonction de rendu ou un composant de module.
- **Types** : pas de `any`. Les enums et le contrat avec l'API viennent de `@pipou/shared` ; les types de réponse vivent dans les services.
- **Erreurs d'API** : l'intercepteur rejette une `AppError`. Lire le message du serveur avec `apiErrorMessage(error)` et le statut avec `apiErrorStatus(error)` (`utils/errors.ts`), jamais `error.response`.

## Commandes

```bash
pnpm --filter @pipou/frontend dev        # Vite
pnpm --filter @pipou/frontend test       # Vitest (run)
pnpm --filter @pipou/frontend typecheck  # tsc -b
pnpm --filter @pipou/frontend lint
pnpm --filter @pipou/frontend build
```

Variable d'environnement requise : `VITE_API_URL` (voir `.env.example`).

## Pistes envisagées (non commencées)

Tailwind, Storybook, tests E2E Playwright, Sentry, reconnexion Socket.io avancée.
