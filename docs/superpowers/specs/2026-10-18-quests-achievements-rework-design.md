# Refonte des quêtes et des succès — design

Date : 2026-10-18

## Problème

- Les succès sont de simples quêtes `resetType = NONE` créées à la main dans l'admin. Il y en a très peu, ils s'affichent comme une quête (« Permanent » + barre) et n'offrent aucun objectif long terme.
- Toutes les quêtes actives sont données à tous les joueurs : ajouter des daily/hebdos rallonge la liste au lieu de varier le contenu.
- `WIN_FIGHT`, `OWN_CARD` et `REACH_LEVEL` existent dans `QuestConditionType` mais aucun événement ne les alimente : une quête « gagne X duels » ne progresse jamais.
- `user.setsCompleted` n'est jamais incrémenté.
- Le front redéfinit les types de réponse des quêtes dans `services/quest.service.ts` (contraire à la règle « tout type échangé vit dans `@pipou/shared` »).

## Décisions

1. **36 succès** : 12 familles × 3 paliers (bronze / argent / or).
2. Récompenses : bronze = 100 or, argent = 1 booster, or = 1 bundle **+ un titre** affichable.
3. **Rétroactif** : la progression des succès est **calculée** à partir des compteurs existants, rien n'est tracké pour eux.
4. Catalogue des succès **en code** (`@pipou/shared`), pas en BDD ; seuls les paliers réclamés sont stockés.
5. Quêtes daily/hebdo : **pool + tirage de 3** par joueur à chaque reset, **1 relance gratuite par jour**.
6. Pool de quêtes **défini en code et seedé en BDD** au démarrage (clé stable `poolKey`) ; l'admin garde l'activation et peut ajouter des quêtes au pool.
7. UI : onglets **Daily · Hebdo · Succès**, succès en **grille de badges** avec bottom-sheet de détail, titre équipé visible sur le profil et en duel.
8. Icônes SVG uniquement (`components/Icons.tsx`).

## Catalogue des succès

| Famille | Source de la valeur | Bronze | Argent | Or | Titre (or) |
|---|---|---|---|---|---|
| `BOOSTERS_OPENED` | `user.boostersOpened` | 10 | 100 | 500 | Maître Ouvreur |
| `CARDS_BOUGHT` | `user.cardsBought` | 5 | 50 | 250 | Chineur |
| `CARDS_SOLD` | `user.cardsSold` | 5 | 50 | 250 | Marchand |
| `SETS_COMPLETED` | sets dont le joueur possède toutes les cartes distinctes | 1 | 3 | nombre de sets existants | Archiviste |
| `DUELS_WON` | `player_stats.wins` | 1 | 25 | 100 | Champion |
| `DUELS_PLAYED` | `player_stats.wins + losses + draws` | 10 | 50 | 200 | Vétéran |
| `LEVEL` | niveau calculé depuis `user.experience` (`UsersService.calculateLevelData`) | 5 | 15 | 30 | Légende |
| `UNIQUE_CARDS` | `COUNT(DISTINCT card_id)` de `user_card` | 25 | 100 | 250 | Collectionneur |
| `HIGH_RARITY` | cartes possédées de rareté `epic`, `legendary` ou `secret` (quantités comprises) | 1 | 10 | 50 | Chasseur de Reliques |
| `LOGIN_STREAK` | `login_streak.longestStreak` | 7 | 30 | 100 | Fidèle |
| `GOLD_EARNED` | `user.moneyEarned` | 1 000 | 10 000 | 100 000 | Magnat |
| `QUESTS_DONE` | nouveau `user.questsCompleted` | 10 | 50 | 200 | Aventurier |

Le palier or de `SETS_COMPLETED` n'est pas une constante : il vaut le nombre de sets au moment du calcul (le catalogue porte un marqueur `ALL_SETS`, résolu côté back).

### Règles

- Les paliers se réclament **dans l'ordre** (bronze, puis argent, puis or).
- Un palier est réclamable dès que `value >= threshold` ; un palier réclamé est acquis pour toujours, même si la valeur redescend (cartes vendues).
- Un titre est débloqué quand le palier **or** de sa famille est **réclamé**.
- L'id du booster (argent) et du bundle (or) sont des constantes du catalogue. Le plan d'implémentation les choisit d'après le dump local (`apps/backend/.e2e/aiven-dump.sql`, jamais Aiven). Au démarrage, le back journalise une erreur si l'un de ces ids n'existe pas, et le claim correspondant renvoie une erreur 500 explicite plutôt que de distribuer une récompense vide.

## Backend

### Modèle de données (une migration TypeORM)

- **`user_achievement`** : `id`, `user_id` (FK cascade), `family` (varchar 32), `tier` (enum `BRONZE|SILVER|GOLD`), `claimed_at`. Index unique `(user_id, family, tier)`.
- **`user`** :
  - `equipped_title` varchar(32) nullable : une `AchievementFamily` ;
  - `quests_completed` int défaut 0 ;
  - `last_quest_reroll_at` datetime nullable.
- **`quest`** : `pool_key` varchar(64) nullable, unique.
- Données : les quêtes `reset_type = 'NONE'` existantes passent à `is_active = 0` (remplacées par les succès) ; `removeInactiveUserQuests` nettoie les `user_quest` correspondantes.

Les entités restent strictement alignées sur le schéma prod (zéro diff vs le dump), comme pour les migrations précédentes.

### Module `achievements/`

- `AchievementStatsService.getValues(userId)` : renvoie `Record<AchievementFamily, number>` en 5 requêtes au plus :
  - `user` (colonnes de compteurs + `experience`) ;
  - `player_stats` ;
  - `login_streak` ;
  - un agrégat sur `user_card` ⨝ `card` (cartes distinctes, cartes haute rareté) ;
  - un agrégat des sets complétés (par set : cartes distinctes possédées = cartes du set) et du nombre total de sets.
  
  Les lignes absentes (pas de `player_stats`, pas de `login_streak`) comptent pour 0.
- `AchievementsService` :
  - `getAchievements(userId)` → `AchievementsResponse` ;
  - `claim(userId, family)` : détermine le prochain palier non réclamé et vérifie qu'il est atteint (sinon `400`). Il insère ensuite la ligne `user_achievement` ; une violation d'unicité donne `409`, ce qui protège contre le double clic. Il distribue enfin la récompense via `UsersService.addGold / addBoosterToUser / addBundleToUser` et émet `achievement.claimed` pour l'inbox. Insert et distribution se font dans la même transaction.
  - `setTitle(userId, family | null)` : `400` si le palier or de la famille n'est pas réclamé.
- Endpoints (JWT) :
  - `GET /achievements` ;
  - `POST /achievements/:family/claim` (`:family` validé contre l'enum) ;
  - `PUT /users/me/title`, body `{ family: AchievementFamily | null }`.
- Le profil (privé et public) expose `equippedTitle`.

### Quêtes : pool, tirage, relance

**Seed** : `quest-pool.ts` (back) liste les quêtes du pool avec leur `poolKey`. Au démarrage, un upsert par `poolKey` met à jour titre, description, conditions, reset et récompense, **sans toucher `isActive`**.

**Pool** : toutes les quêtes **actives** de `resetType = DAILY` (resp. `WEEKLY`), qu'elles soient seedées ou créées dans l'admin. Les quêtes `MONTHLY`, `EVENT` et les éventuelles `NONE` réactivées restent assignées à tous, comme aujourd'hui.

**Tirage** (dans `syncUserQuests`, pour DAILY puis WEEKLY) :
1. S'il reste au joueur au moins une quête de ce type avec `resetAt > now`, rien ne change.
2. Sinon :
   - les quêtes expirées terminées et non réclamées sont auto-réclamées (comportement actuel, notification comprise) ;
   - toutes les `user_quest` de ce type sont supprimées ;
   - 3 quêtes distinctes sont tirées uniformément dans le pool (moins s'il en contient moins) ;
   - chacune est insérée avec `resetAt` = prochain reset.

Le reset daily est à 4h et le reset hebdo le lundi à 4h, en heure serveur (comme aujourd'hui).

**Relance** : `POST /quests/:id/reroll`.
- `404` si la `user_quest` n'appartient pas au joueur.
- `400` si elle est terminée, si elle n'est pas DAILY/WEEKLY, ou si `lastQuestRerollAt` est postérieur au dernier reset daily (la relance du jour est utilisée).
- `400` si le pool ne contient aucune autre quête que le joueur n'a pas déjà.
- Sinon, la ligne est remplacée par une quête tirée parmi celles du même type que le joueur n'a pas, avec le même `resetAt`, et `lastQuestRerollAt = now`.

La réponse de `GET /quests` expose `rerollAvailable: boolean`, ainsi que `dailyResetAt` et `weeklyResetAt`.

### Nouvelles conditions et événements

| Condition | Émise par | Méta |
|---|---|---|
| `WIN_FIGHT` | `GameEndService.persistResult` → événement `fight.finished` `{ player1Id, player2Id, winnerId }` | — |
| `PLAY_FIGHT` | même événement, pour les deux joueurs | — |
| `OBTAIN_CARD` | ouverture de booster (`booster.opened` enrichi des raretés obtenues) | `amount`, `rarity` |
| `CLAIM_DAILY_REWARD` | claim de la récompense journalière → `daily-reward.claimed` | — |
| `LIST_CARD` | `listing.created` (existant) | `amount` |
| `EARN_GOLD` | vente au marché (`market.card.sold` / `market.booster.sold` / `market.bundle.sold`, enrichis du montant en or) | `amount` = or gagné |
| `COMPLETE_QUEST` | `QuestService` quand une quête DAILY passe à terminée ; incrémente aussi `user.questsCompleted` (toute quête, quel que soit son type) | — |

La condition reçoit un filtre optionnel `minRarity` : la rareté de la carte doit être ≥ selon l'ordre `common < uncommon < rare < epic < legendary < secret`. L'ordre vit dans `@pipou/shared` à côté de `Rarity`.

`OWN_CARD` et `REACH_LEVEL` restent dans l'enum (utilisables plus tard) mais ne sont pas utilisés par le pool.

### Pool initial

**Daily (15)**

| poolKey | Quête | Récompense |
|---|---|---|
| `d_open_1` | Ouvre 1 booster | 100 or |
| `d_open_2` | Ouvre 2 boosters | 150 or |
| `d_open_3` | Ouvre 3 boosters | 200 or |
| `d_play_1` | Joue 1 duel | 100 or |
| `d_play_2` | Joue 2 duels | 150 or |
| `d_play_3` | Joue 3 duels | 200 or |
| `d_win_1` | Gagne 1 duel | 150 or |
| `d_win_2` | Gagne 2 duels | 250 or |
| `d_buy_card_1` | Achète 1 carte au marché | 100 or |
| `d_sell_card_1` | Vends 1 carte au marché | 100 or |
| `d_list_card_1` | Mets 1 carte en vente | 100 or |
| `d_buy_booster_1` | Achète 1 booster | 100 or |
| `d_obtain_10` | Obtiens 10 cartes | 100 or |
| `d_obtain_rare` | Obtiens 1 carte rare ou mieux | 150 or |
| `d_daily_reward` | Réclame ta récompense quotidienne | 100 or |

**Hebdo (10)**

| poolKey | Quête | Récompense |
|---|---|---|
| `w_open_15` | Ouvre 15 boosters | 1 booster |
| `w_play_15` | Joue 15 duels | 500 or |
| `w_win_10` | Gagne 10 duels | 1 booster |
| `w_buy_card_10` | Achète 10 cartes au marché | 500 or |
| `w_sell_card_10` | Vends 10 cartes au marché | 500 or |
| `w_earn_1000` | Gagne 1 000 or au marché | 500 or |
| `w_obtain_100` | Obtiens 100 cartes | 500 or |
| `w_obtain_epic_3` | Obtiens 3 cartes épiques ou mieux | 1 booster |
| `w_daily_reward_5` | Réclame ta récompense quotidienne 5 fois | 500 or |
| `w_quests_10` | Termine 10 quêtes quotidiennes | 1 bundle |

Le booster et le bundle sont les mêmes ids que ceux du catalogue des succès.

## `@pipou/shared`

- `enums/achievement.ts` :
  - `AchievementFamily` (les 12 ids) ;
  - `AchievementTier` (`BRONZE`, `SILVER`, `GOLD`).
- `QuestConditionType` : ajout de `PLAY_FIGHT`, `OBTAIN_CARD`, `CLAIM_DAILY_REWARD`, `LIST_CARD`, `EARN_GOLD`, `COMPLETE_QUEST`.
- `RARITY_ORDER` à côté de `Rarity`.
- `game/achievements.ts` : constante `ACHIEVEMENTS: readonly AchievementDefinition[]`.
  - `{ family, tiers: [{ tier, threshold: number | 'ALL_SETS', reward: { type: QuestRewardType, amount, itemId? } }] }` ;
  - le titre est identifié par la famille (clé i18n `achievements.titles.<family>`).
- `api/achievements.ts` :
  - `AchievementsResponse = { families: AchievementProgress[]; unlocked: number; total: number; equippedTitle: AchievementFamily | null }` ;
  - `AchievementProgress = { family; value; claimedTier: AchievementTier | null; tiers: { tier; threshold: number; reward; claimed: boolean; reached: boolean }[] }` (seuils résolus par le back).
- `api/quests.ts` : `UserQuest`, `UserQuestsResponse` (`{ DAILY, WEEKLY, MONTHLY, EVENT, rerollAvailable, dailyResetAt, weeklyResetAt }`), `SetTitleRequest`. Le front supprime ses définitions locales. Le groupe `ACHIEVEMENT` disparaît de la réponse.

## Frontend

### `QuestsPanel` (Profil)

- Onglets fixes **Daily · Hebdo · Succès `unlocked/total`**. Les onglets Mensuel et Event n'apparaissent que s'ils contiennent des quêtes. Une icône `IconBell` signale un onglet avec quelque chose à réclamer.
- **Daily / Hebdo** :
  - le compte à rebours du reset (`dailyResetAt` / `weeklyResetAt`) est affiché une seule fois dans l'en-tête de l'onglet ; le timer par quête disparaît ;
  - chaque quête affiche titre, récompense, barre et `x/y`, puis **Réclamer** ou « Réclamé » ;
  - le bouton relance (`IconUndo`) est visible sur les quêtes non terminées tant que `rerollAvailable` ;
  - « Tout réclamer » est conservé.
- **Succès** (`features/achievements/`) :
  - `AchievementsHeader` : anneau de progression `unlocked/total` et sélecteur du titre équipé (titres débloqués + « Aucun ») ;
  - `AchievementGrid` : grille 3 colonnes de 12 `AchievementTile` (icône de famille, nom court, 3 pastilles bronze/argent/or remplies si réclamées). Une tuile avec un palier réclamable est mise en avant (bordure dorée + pulsation, désactivée avec `prefers-reduced-motion`) ;
  - `AchievementSheet` : bottom-sheet ouverte au tap, avec la valeur actuelle, la barre vers le prochain palier, les 3 paliers (seuil, récompense, état), le bouton **Réclamer** et le titre débloqué au palier or. On réutilise le pattern de `features/fight/CardEffectSheet.tsx` ; s'il n'est pas assez générique, on extrait un `components/BottomSheet.tsx`.
- Icônes par famille :
  - `BOOSTERS_OPENED` : `IconBooster` ;
  - `CARDS_BOUGHT` : `IconCart` ;
  - `CARDS_SOLD` : `IconTag` ;
  - `SETS_COMPLETED` : `IconCollection` ;
  - `DUELS_WON` : `IconTrophy` ;
  - `DUELS_PLAYED` : **`IconSwords`** (nouvelle) ;
  - `LEVEL` : `IconCrown` ;
  - `UNIQUE_CARDS` : `IconCards` ;
  - `HIGH_RARITY` : **`IconGem`** (nouvelle) ;
  - `LOGIN_STREAK` : `IconFire` ;
  - `GOLD_EARNED` : `IconGold` ;
  - `QUESTS_DONE` : `IconQuest`.

### Données

- `services/achievement.service.ts` et hooks `useAchievements`, `useClaimAchievement`, `useSetTitle`, plus `useRerollQuest` dans `hooks/useGameData.ts`, avec une nouvelle clé `QUERY_KEYS.achievements`.
- Un claim invalide `achievements`, `profile` et l'inbox. Une relance invalide `quests`.

### Titre affiché

- Sous le pseudo dans `HeroCard` (profil privé et public).
- Dans la bannière du joueur adverse en duel : l'état de partie expose `title` pour chaque joueur, chargé au démarrage du match.

### i18n

Toutes les nouvelles chaînes en fr/en/ko : noms de familles, titres, paliers, relance, en-têtes, ainsi que les titres et descriptions des quêtes du pool. Les quêtes seedées stockent une clé i18n dans `title`, et le front la traduit si elle existe, sinon il affiche le texte brut (cas des quêtes admin).

## Tests

**Back**

- `AchievementStatsService` : niveau dérivé de l'XP, sets complétés (set partiel, set complet, set vide), valeurs à 0 sans `player_stats` / `login_streak`.
- `AchievementsService` :
  - claim dans l'ordre ;
  - refus d'un palier non atteint (400) ;
  - double claim (409) ;
  - récompense distribuée une seule fois ;
  - palier réclamable après baisse de la valeur ;
  - `ALL_SETS` résolu ;
  - `setTitle` refusé sans palier or.
- `QuestService` :
  - tirage de 3 quêtes distinctes ;
  - pas de nouveau tirage avant le reset ;
  - auto-claim et purge à l'expiration ;
  - pool plus petit que 3 ;
  - relance : 1 par jour, refusée sur une quête terminée, jamais de doublon, refusée si le pool est épuisé ;
  - nouvelles conditions (`PLAY_FIGHT`/`WIN_FIGHT` pour les deux joueurs, `OBTAIN_CARD` + `minRarity`, `EARN_GOLD`, `COMPLETE_QUEST` + `questsCompleted`).
- Seed du pool : idempotent, ne réactive pas une quête désactivée par l'admin.
- e2e : mise à jour de `test/e2e/features/quests.feature` (tirage, relance, onglets) et ajout d'un scénario succès (claim et titre).

**Shared**

- Catalogue : 12 familles, 3 paliers chacune, seuils strictement croissants, `ALL_SETS` uniquement sur `SETS_COMPLETED`, une clé i18n de titre par famille dans les 3 langues.

**Front**

- `QuestsPanel` : onglets et compteur `unlocked/total`, bouton relance selon `rerollAvailable`.
- `AchievementTile` : pastilles et état réclamable.
- `AchievementSheet` : bouton Réclamer.
- Vérification visuelle Playwright en 430px avant livraison.

## Hors périmètre

- Classement ou comparaison des succès entre joueurs.
- Succès secrets, événements à durée limitée liés aux succès.
- Édition des récompenses des succès dans l'admin (un changement passe par un déploiement).
- Anti-farm des duels entre comptes liés.

## Écarts lors de l'implémentation

- La route du titre devient `PUT /achievements/title`, pour éviter une dépendance circulaire `UsersModule` ↔ `AchievementsModule`.
- Le claim d'un succès ne crée pas de message inbox : le joueur vient de cliquer, le message n'apporterait rien.
- Claim : on insère d'abord `user_achievement` (l'index unique protège contre le double claim), puis on distribue. Si la distribution échoue, la ligne est supprimée et l'erreur remonte. `UsersService` n'accepte pas de `EntityManager`, d'où ce mécanisme plutôt qu'une transaction.
- La migration désactive toutes les quêtes existantes `NONE`/`DAILY`/`WEEKLY` sans `pool_key` (ids 1 à 4 en prod, remplacées par le pool). L'admin peut les réactiver.
- `EARN_GOLD` écoute l'événement existant `listing.sold` (qui porte déjà `sellerId` et `totalPrice`) au lieu d'enrichir trois événements.
- La migration a été vérifiée sur la base locale `cardcollect_local`.
- Le titre équipé du duel est un frère de `.hud-name` (non imbriqué), pour éviter qu'il soit coupé par le clipping du nom.
- La clé i18n `achievements.tab` a été ajoutée lors de la tâche 9 (libellé de l'onglet Succès).
