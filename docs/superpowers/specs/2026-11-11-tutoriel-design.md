# Tutoriel jouable dans l'onglet Règles — design

## Intention

L'onglet Règles (`FightRules.tsx`) n'est qu'une liste de textes, en partie périmée par rapport au moteur. Un nouveau joueur n'a aucun moyen d'apprendre en jouant. Objectif : des **leçons courtes jouables et strictement guidées** sur le vrai moteur, plus une **référence de règles corrigée**.

## Décisions

- L'onglet Règles a deux sous-onglets : **Tutoriel** (par défaut) et **Référence**.
- 9 leçons courtes par thème : plateau préparé, **une seule action acceptée par étape**, adversaire scripté (pas l'IA).
- Récompense **une seule fois par leçon** : 100 gold + 50 XP (`ADVENTURE_LEVEL_DEFAULTS[1]`). Famille de succès `TUTORIAL_LESSONS`, paliers 1 / 4 / 9 leçons, récompenses standard.
- Pas de minuteur de tour dans une leçon. Abandonner = quitter sans récompense.
- Destruction par effet : aucune Prime (voulu). Zeta : carte parasite posée chez l'adversaire ; Prime à son poseur si le compte à rebours arrive à 0, aucune si l'hôte la détruit avant.
- Pioche à la destruction : le texte des règles a raison (combat ou effet adverse). L'écart du moteur (pioche aussi sur son propre effet / 0 PV) est hors périmètre ; les leçons n'utilisent pas ce cas.
- Il n'existe pas de statut « sleep » : on ne l'invente pas.

## Étape 1 — Référence corrigée (front seul)

- Sous-onglets Tutoriel / Référence dans `FightRules` (état local).
- Phase 4 devient **Phase de contrôle** : supports, Relève, Drakon des Origines, évolution autorisés ; invocation normale, recyclage, Transformer, changement de mode interdits ; 7 cartes max.
- Garde : `GUARD_MAX_TURNS` tours adverses, contre-offensive `COUNTER_OFFENSIVE_PER_TURN` par tour tenu, pas de retour en Garde le tour de la sortie. Valeurs lues dans `@pipou/shared`.
- Primes : une destruction par effet ne rapporte rien ; tué par Renvoi d'un monstre en Garde : rien.
- Nouvelle étape « Invocations spéciales » : évolution, Transformer, Relève, Zeta implanté + désinfection, Drakon des Origines.
- Supports : un seul Terrain (remplacé), pas deux Persistants du même nom, un support qui exige une carte se dissipe sans elle.
- Statuts classés en trois groupes (entraves, statuts de combat, immunités).
- Emoji des étapes remplacés par des icônes SVG.

## Étape 2 — Contrat partagé (`@pipou/shared`)

- `game/tutorial.ts` : `TUTORIAL_LESSONS`, `TUTORIAL_REWARD`, `TutorialHint`, `TutorialStepView`.
- `game/state.ts` : `ClientGameState.tutorial?`.
- `socket/fight.ts` : `tutorial:start`, `tutorial:ack`, `MatchFoundPayload.tutorialLessonId?`, `GameOverPayload.tutorial?`.
- `api/tutorial.ts` : `TutorialOverview`.
- `enums/achievement.ts` + `game/achievements.ts` : famille `TUTORIAL_LESSONS`.

## Étape 3 — Backend

Module `apps/backend/src/tutorial/` : leçons (plateau par nom de carte + étapes `info` / `player` / `opponent`), `lesson-runner.ts` pur, `tutorial.service.ts` (fin de leçon en transaction, insertion gardée par index unique → pas de double paiement), entité `user_tutorial_lesson` + migration `1791000000028-Tutorial.ts`, `GET /tutorial`.

Branchements : constructeur de plateau extrait de `testing/scenario.ts` ; session tutoriel à côté de `PveSession` via jeton `TUTORIAL_HOOKS` ; action refusée si hors étape ; coups adverses scriptés après `AI_ACTION_DELAY_MS` ; reprise à la reconnexion ; `client-state.builder` expose `tutorial` ; succès : compte des leçons.

Garde-fou : `lessons.spec.ts` rejoue chaque leçon de bout en bout sur le vrai moteur avec les cartes réelles. Une immunité/entrave qu'aucune carte réelle ne porte est présentée en étape `info`.

## Étape 4 — Frontend

`features/tutorial/` : `TutorialHome`, `TutorialFight` (route `/tutorial/:lessonId`), `TutorialCoach`, `TutorialResult`. Prop optionnelle `coach?: TutorialHint` sur `FightBoard` / `FightHand` / `PhaseMenu` / `FightActionBar` (classe CSS sur la cible, aucun changement sans la prop). Reprise après rechargement. Invalidation `tutorial`, `profile`, `achievements`. Textes fr / en / ko, icônes SVG.

## Leçons

1. Premier tour — pioche, recyclage → Énergie, invocation, paiement par défausse, phases.
2. Combat et Primes — ATK contre ATK et riposte, double K.O., attaque directe, dernière Prime = victoire.
3. La Garde — Garde, pas de Prime, 2 tours max, contre-offensive, Perçant.
4. Les Supports — Éphémère ciblé, Équipement et emplacements, Persistant / Terrain, Charge.
5. Phase de contrôle — support après le combat, limite de 7 cartes, défausse.
6. Pipou — vagues, invocation gratuite, Provocation, Relève, Tactique Gang Gang.
7. Drakon — Œuf et éclosion, évolution, Incubation Rapide, Transformer.
8. Pixelman — Noyaux, équipements, Force Plasma, Zeta implanté et désinfection.
9. Statuts, entraves et immunités — entraves subies (Gel, Garde verrouillée, attaque forcée, virus Zeta, pas d'attaque le tour d'invocation), statuts de combat, 6 immunités du moteur. Joué quand une carte réelle le permet, sinon étape `info`.

## Vérification

`pnpm build:shared && pnpm typecheck && pnpm lint && pnpm test`, puis leçon 1 jouée dans le navigateur (mauvaise action refusée, récompense une seule fois, reprise après rechargement).

## Hors périmètre

- Corriger la pioche du moteur sur destruction par son propre effet.
- Proposer le tutoriel automatiquement aux nouveaux comptes.
