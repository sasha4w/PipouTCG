# Refonte des récompenses journalières — design

Date : 2026-10-16

## Problème

Le système actuel est trop indulgent et la modal est mal proportionnée :

- Les paliers de fidélité et la semaine de récompense se basent sur `totalDays` (cumul all-time, jamais remis à zéro) : rater des jours ne fait rien perdre.
- Bug : racheter 1 jour remet `lastClaimDate` à hier, ce qui efface **tous** les jours manqués (`rescueStreak`).
- Le rachat coûte peu (50g/jour − remise, minimum 10g).
- Le calendrier de la modal est faux : il reconstitue `totalDays` jours consécutifs en remontant depuis `lastClaimDate` au lieu de lire l'historique.
- Emojis dans l'UI (✓, ⭐, 🏆) et dans les labels en BDD (ex. « 💎 Semaine 6 - Jour 2 »).
- Modal d'environ 840px de haut (calendrier à bulles de 50px), frise de paliers à 8 nœuds serrés avec des labels qui se chevauchent.

## Décisions

1. Jour manqué → **reset complet** : streak, cycle, semaine de récompense et progression des paliers.
2. Rachat possible pour **1 seul jour manqué**, **le jour du retour uniquement**, au prix de `100 + 10 × currentStreak` gold.
3. Les paliers sont **regagnables** après un reset (ils récompensent une série de jours consécutifs).
4. Paliers affichés sous forme de **carte « prochain palier »** + pastilles.
5. Calendrier **mensuel compact** (cases de 24px), avec les données réelles de l'historique.
6. Uniquement des icônes SVG (`components/Icons.tsx`), aucun emoji.

## Backend (`apps/backend/src/daily-reward`)

### Règles

Tout dérive de `currentStreak`. `totalDays` reste un compteur all-time, utilisé uniquement pour les stats.

- `weekNumber = floor((currentStreak_après_claim − 1) / 7) + 1`, calculé avec le streak du jour réclamé (J1-J7 → semaine 1, J8 → semaine 2).
- Palier déclenché quand `currentStreak === dayThreshold` (après incrément), à chaque fois que ce seuil est atteint.

Claim, selon `diff = jours UTC entre lastClaimDate et aujourd'hui` :

| diff | Résultat |
|---|---|
| 0 | `409` déjà réclamé (inchangé) |
| 1 | claim normal, streak +1 |
| 2 | `status: 'rescue_required'`, `rescue: { cost }` — rien n'est distribué |
| ≥ 3 | reset automatique puis claim de J1 dans la même requête ; la réponse contient `streakLost: <ancien streak>` |

Premier claim (`lastClaimDate` null) : streak = 1.

`rescueStreak(userId)` :
- valide uniquement si `diff === 2`, sinon `400` ;
- coût `100 + 10 × currentStreak` ; `400` si le gold est insuffisant ;
- débite le gold, écrit un `StreakRescue` (`daysMissed: 1`), puis met `lastClaimDate` à hier (UTC). Le front enchaîne ensuite avec `/claim`.
- `maxRescuableDays`, `calculateRescueCost` et les rachats de plusieurs jours sont supprimés.

`resetStreak` : `currentStreak = 0`, `cycleDay = 1`, `lastClaimDate = null` ; `longestStreak` et `totalDays` sont conservés. Le claim suivant donne streak = 1.

Le calcul de la date « hier » se fait en UTC (`todayStr` décalé d'un jour en UTC), pour corriger l'usage actuel de `setDate` en heure locale.

### Contrat

`@pipou/shared` : `RescueStreakRequest` est supprimé (`/rescue` n'a plus de body), ainsi que `RescueStreakDto`.

`GET /daily-reward/status` renvoie en plus / à la place :

```ts
{
  streak: { current, longest, totalDays, cycleDay, weekNumber, lastClaimDate },
  alreadyClaimed: boolean,
  rescueAvailable: boolean,      // diff === 2
  rescueCost: number | null,     // 100 + 10 × streak si rescueAvailable
  streakAtRisk: boolean,         // diff >= 3 : le prochain claim va reset
  nextReward: { type, value, quantity, label } | null,
  milestones: Array<{ dayThreshold, type, value, quantity, label }>, // actifs, triés ASC
  claimedDates: string[],        // YYYY-MM-DD (UTC) des claims non-milestone du mois courant
}
```

`daysMissed`, `maxRescuable` et `nextMilestone` sont retirés (le front dérive le prochain palier de `milestones` et `streak.current`).

Réponse de `POST /claim` :

```ts
| { status: 'claimed', streak, rewards: DailyReward[], streakLost?: number }
| { status: 'rescue_required', streak, rescue: { cost: number } }
```

### Labels

Les emojis sont retirés des labels à l'enregistrement (create/update des définitions et des paliers), avec `/\p{Extended_Pictographic}️?/gu` et un trim. Les données déjà en BDD ne sont pas modifiées ; le front applique le même nettoyage à l'affichage.

### Tests (`daily-reward.service.spec.ts`)

- diff 1 / 2 / ≥ 3 / premier claim ;
- `streakLost` renvoyé et streak = 1 après un reset automatique ;
- la semaine de récompense redescend à 1 après un reset ;
- un palier redonné quand le streak repasse le seuil ;
- rescue : coût exact, refusé si diff ≠ 2, refusé si gold insuffisant ;
- `claimedDates` limité au mois courant et sans milestones ;
- nettoyage des emojis dans les labels.

## Frontend (`apps/frontend/src`)

### Fichiers

- `components/DailyRewardModal.tsx` : orchestration des phases (idle / claiming / rescue / lost / result).
- `components/daily-reward/MonthCalendar.tsx` : nouveau composant extrait.
- `components/daily-reward/MilestoneCard.tsx` : nouveau.
- `components/daily-reward/rewardDisplay.tsx` : icône, texte de quantité, nettoyage des labels.
- `services/dailyReward.service.ts` : types alignés sur le nouveau contrat ; `rescueStreak()` sans argument.
- `components/DailyStreakWidget.tsx` : utilise `claimedDates` au lieu de reconstruire les dates.
- `hooks/Usedailyrewardmodal.ts` : ouvre la modal si `!alreadyClaimed` (la condition sur `daysMissed` disparaît).

### Modal — écran idle (cible ~540px de haut, sans scroll à 430px)

1. Header : `IconCalendar` + « Octobre 2026 » sur une ligne ; stats en dessous (`IconFire` + streak · total · record).
2. `MonthCalendar` : grille de 7 colonnes, cases arrondies de 24px, sans légende. Vert = réclamé (`claimedDates`), rose = manqué (date passée non réclamée, postérieure au premier claim visible du mois), contour or = aujourd'hui, jours futurs atténués.
3. Carte « Aujourd'hui » : icône du type de récompense, quantité réelle (« 150 gold », « 1× Booster »), « Semaine N · Jour X » en petit ; label nettoyé en sous-titre s'il existe.
4. `MilestoneCard` : icône du type, « J21 · <label ou type> », barre `streak / seuil`, pastilles des paliers (vert si `≤ streak`, or pour le prochain, atténué sinon). Pas de prochain palier → message « Tous les paliers atteints ».
5. Bouton « Réclamer » ; une fois réclamé, désactivé avec `IconCheck` + « Réclamée aujourd'hui ».

Si `streakAtRisk` : un bandeau discret au-dessus du bouton prévient que la série de N jours sera perdue au claim.

### Écran rachat

`IconSkull`, « Série de N jours en danger », calendrier (jour manqué en rose), puis deux boutons : « Sauver pour X gold » (désactivé avec le montant manquant si le gold est insuffisant ; gold lu depuis le profil en cache) et « Repartir à J1 » (appelle `/reset` puis `/claim`).

### Écran série perdue

Quand `streakLost` est présent : `IconSkull` + « Série de N jours perdue », puis l'écran de résultat de J1 (même vue, avec le bandeau en tête).

### Écran résultat

`IconPartyHorn`, récompenses (icône + quantité), badge palier avec `IconTrophy`, streak, `MilestoneCard`, bouton de fermeture. Pas de calendrier. Le spinner de chargement utilise une icône au lieu de ⭐.

### Tests

- Vitest : `MonthCalendar` (réclamé / manqué / aujourd'hui) ; `MilestoneCard` (prochain palier, tous atteints, progression) ; nettoyage des labels.
- Captures Playwright à 430px des écrans idle, rachat, série perdue et résultat avant la remise.

## Bascule

Pas de migration de schéma. Les joueurs gardent leur `currentStreak` ; la semaine de récompense est recalculée à partir de celui-ci (souvent en baisse, c'est voulu). Les paliers déjà touchés via le cumul seront redonnés quand le streak atteindra exactement le seuil. `MILESTONE_THRESHOLDS`, codé en dur côté front, est supprimé.

## Hors périmètre

- Changement de fuseau horaire (le jour reste en UTC).
- Modification des définitions de récompenses ou des paliers en BDD.
