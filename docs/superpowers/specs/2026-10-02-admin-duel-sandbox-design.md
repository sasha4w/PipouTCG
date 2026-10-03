# Sandbox de duel pour les admins — Design

Date : 2026-10-02
Statut : validé en brainstorming, en attente de relecture
Prérequis : `2026-10-02-duel-engine-audit-design.md` (façade `GameEngine`, `seat`, `ScenarioBuilder`, RNG injecté)

## Objectif

Donner aux admins un environnement pour tester les duels. L'admin compose les deux decks, joue les deux rôles, prépare sa main et l'ordre de ses pioches, met en place un état de jeu précis, puis le rejoue, l'annule ou le sauvegarde pour tester des combos et des interactions.

## Contexte actuel

- Le backend contient un mode « test match » inachevé : `fight:test_match` et `fight:submit_deck_test_p2`. Il n'est utilisé nulle part et sera retiré par le chantier moteur.
- L'admin est déterminé par `user.is_admin`, transmis dans le JWT. `AdminGuard` le vérifie en HTTP, mais le gateway `/fight` ne le lit pas.
- `/admin` (`pages/Admin.tsx`) propose des onglets de gestion : sets, cartes, boosters, bundles, quêtes, bannières.

## Parcours

1. Dans `/admin`, l'onglet « Sandbox » liste les scénarios sauvegardés et propose « Nouveau sandbox ».
2. La configuration s'affiche sur la route plein écran `/admin/sandbox` :
   - deck J1 et deck J2, composés à partir de **tout le catalogue**, sans condition de possession mais avec les règles de deck (30 à 40 cartes, 3 exemplaires max) ;
   - un raccourci pour pré-remplir un deck depuis un deck existant de l'admin ;
   - le choix du joueur qui commence ;
   - le timer (désactivé par défaut).
3. Au lancement, le moteur prépare la partie comme un vrai match : mélange, Primes, main de 5, puis mulligan.
4. L'admin joue, avec les outils décrits plus bas.

## Jouer les deux rôles

- Un seul plateau, réutilisant les composants de `features/fight/`.
- **La vue suit automatiquement** le joueur actif, ou le joueur qui doit résoudre un choix en attente. Un bouton « Voir comme J1 / J2 » force la vue.
- Une option affiche la main adverse face visible.
- Chaque action envoie le `seat` concerné. Le serveur vérifie que l'action est légale **pour ce seat** avec les règles normales : le sandbox ne contourne pas les règles, sauf avec les outils de mise en place.

## Main et pioche

- Un **panneau deck** par joueur montre le deck dans l'ordre. On peut monter une carte tout en haut ou réordonner le deck par glisser-déposer. Toutes les pioches suivent cet ordre, qu'elles viennent du début de tour, d'un effet ou d'une destruction.
- **Composer la main** : on échange une carte de la main avec une carte du deck, ou on déplace une carte du deck vers la main. Les cartes viennent **toujours du deck** du joueur, jamais du catalogue.

## Outils de mise en place (« mode dieu »)

Ces outils sont des actions propres au sandbox, traitées par `SandboxService`, jamais par le moteur des matchs classés. Ils ne déclenchent **aucun effet** et n'ont **aucun coût**.

| Outil | Détail |
|---|---|
| Placer une carte | Une carte du deck ou de la main va sur une zone monstre (mode ATK ou Garde), une zone support (terrain), un monstre (équipement) ou le cimetière. Les passifs sont recalculés ensuite. |
| Éditer les valeurs | PV courants, buff d'ATK et de PV d'un monstre, Primes restantes, énergie de recyclage, phase, numéro du tour, joueur actif, statuts (Provocation, Perçant, gel…). |
| Annuler | Un snapshot (`structuredClone` du `GameState`) est pris avant chaque action, de jeu ou de mise en place. La pile garde au maximum 50 étapes. Une nouvelle action vide la pile « refaire ». |
| Sauver un scénario | Le `GameState` courant est sérialisé, avec un nom et une description, et partagé entre **tous les admins**. |
| Charger un scénario | Le sandbox repart de l'état sauvegardé. Les cartes sont rechargées depuis la BDD par leur id, pour tester les effets à jour. |

## Backend

- **Gateway `/fight`.** `handleConnection` lit aussi `is_admin` dans le JWT et le place dans `client.data.isAdmin`. Tous les événements `sandbox:*` exigent `isAdmin`.
- **Événements** (dans `@pipou/shared`, `socket/sandbox.ts`) :
  - `sandbox:create` : decks, premier joueur, timer.
  - `sandbox:action` : `{ sandboxId, seat, action }` ; l'action est la même union que celle du moteur.
  - `sandbox:setup` : outils de mise en place.
  - `sandbox:undo`, `sandbox:redo`.
  - `sandbox:load`.
  - `sandbox:close`.
  - Le serveur répond par `sandbox:state`, qui contient la vue complète des deux joueurs : decks ordonnés, les deux mains, et la taille de la pile d'annulation.
- **`SandboxService`**
  - Les sandboxes sont gardés en mémoire, séparés de `games`, un par admin.
  - Il gère les snapshots et applique les outils de mise en place.
  - Il délègue les actions de jeu à `GameEngine.dispatch`.
  - Il n'écrit rien en BDD : pas de match, pas d'ELO, pas de stats, pas de quêtes.
  - Une fin de partie est affichée, mais l'admin peut annuler pour revenir en arrière.
- **RNG.** Le mélange initial est aléatoire. L'ordre du deck est ensuite entièrement contrôlé par l'admin.
- **Scénarios** : une entité `SandboxScenario` (`id`, `name`, `description`, `state` JSON, `createdBy`, `createdAt`, `updatedAt`), créée par une migration, avec un CRUD HTTP protégé par `JwtAuthGuard` et `AdminGuard`. Le JSON stocke des **ids de carte** et non les cartes complètes. Le `ScenarioBuilder` reconstruit l'état au chargement.
- **Nettoyage.** Le sandbox est supprimé à la déconnexion de l'admin, après un délai de 10 minutes.

## Frontend

- Route `/admin/sandbox` dans `App.tsx`, protégée côté client par `is_admin` et côté serveur par le gateway.
- `features/sandbox/` contient :
  - `SandboxSetup` (decks et options) ;
  - `SandboxPage` (socket, état) ;
  - `SandboxToolbar` (vue, annuler et refaire, sauver) ;
  - `DeckPanel` (deck ordonnable) ;
  - `SetupDrawer` (placer une carte, éditer les valeurs) ;
  - `ScenarioList` (dans l'onglet admin).
- Il réutilise `FightBoard` et ses sous-composants. Si ceux-ci supposent « moi contre l'adversaire », on ajoute une prop `perspective` plutôt que de les dupliquer.
- Les données serveur passent par TanStack Query avec des clés dans `QUERY_KEYS` (catalogue, scénarios), suivant les conventions de `apps/frontend/CLAUDE.md`.

## Tests

- Backend :
  - `SandboxService` : chaque outil de mise en place, annuler et refaire, pile limitée ;
  - accès refusé sans `isAdmin` ;
  - aucune écriture en BDD ;
  - sérialisation et rechargement d'un scénario ;
  - actions de jeu par seat.
- Frontend : tests Vitest des composants à logique (`DeckPanel` pour le réordonnancement, bascule de vue automatique).

## Hors périmètre

- Mode spectateur et partage d'un sandbox en direct entre plusieurs admins.
- Injection de cartes hors deck depuis le catalogue.
- IA adverse.

## Vérification

- `pnpm build:shared && pnpm typecheck && pnpm lint && pnpm test` au vert.
- Migration du scénario testée en local (`migration:run` puis `migration:revert`), jamais sur Aiven.
- Test manuel en local :
  1. créer un sandbox ;
  2. placer Noyau Alpha, Module .v2 et Firewall ;
  3. vérifier Provocation et la réduction de dégâts ;
  4. attaquer ;
  5. annuler ;
  6. sauvegarder ;
  7. recharger.
- Vérifier aussi qu'un compte non admin est refusé, à la fois sur la route et sur le socket.
