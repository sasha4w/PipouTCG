# Set Drakon — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** rendre jouable le set Drakon : élément / lignée / stade sur les cartes, évolution posée sur le terrain,
œufs qui éclosent, accélérateurs, 19 cartes mises à jour + 2 œufs créés, interface d'évolution.

**Architecture :** le contrat (enums, types, règle `canEvolveOnto`) vit dans `@pipou/shared`. Le moteur ajoute une
action de jeu `evolve` (nouveau `EvolutionService`), un mécanisme d'éclosion (compteur au début du tour du
propriétaire + choix « invoquer dans la zone »), et des actions/conditions/cibles génériques. Les cartes changent par
deux migrations (schéma puis données, même garde « état attendu » que `CardRework`). Le front ajoute un flux
« évoluer » au plateau, des icônes SVG et les textes d'effets.

**Tech Stack :** NestJS 11 + TypeORM (MySQL) + Jest, React 18 + Vitest, `@pipou/shared`.

**Spec :** `docs/superpowers/specs/2026-10-17-drakon-set-design.md`

## Global Constraints

- Types et enums partagés uniquement dans `@pipou/shared` (`const X = {...} as const`) ; `pnpm build:shared` après
  modification.
- Aucune logique propre à une carte dans le moteur : actions, cibles, conditions, filtres génériques.
- `effects-coverage.spec.ts` : chaque valeur d'`ActionType`, `EffectConditionType`, `EffectTarget` doit être déclarée
  (`supported-effects.ts`) et chaque vraie carte doit se jouer sans erreur.
- Tests d'i18n du front (`__tests__/unit/effectText.test.ts`) : un texte pour chaque action × cible × contexte et
  chaque mot-clé, en fr, en, ko.
- **Aucun emoji dans l'interface ajoutée** : uniquement des icônes SVG ajoutées à
  `apps/frontend/src/components/Icons.tsx` au format existant (`IconProps`, `viewBox="0 0 24 24"`, `currentColor`).
- Jamais de connexion à Aiven (`apps/backend/.env` = prod). Base locale uniquement (`.env.dev.local`,
  `cardcollect_dev`). Ne jamais lancer `migration:*`. Ne pas lancer `nest build` pendant qu'un `nest start --watch`
  tourne (il vide `dist/`) : utiliser `tsc -p tsconfig.build.json --noEmit`.
- Entités = schéma de prod : toute colonne ajoutée à `Card` a sa migration de schéma.
- Branche `drakon-set` (déjà créée). Commits terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

### Valeurs de référence

| Clé | Valeur |
|---|---|
| Éléments | `earth`, `fire`, `wind`, `water` |
| Stades | `egg`, `baby`, `young`, `adult` ; suivant : baby→young, young→adult |
| Coût d'évolution | `max(0, coût(carte) − coût(base))` |
| Éclosion | Genèse 2 tours → baby ; Dualité 2 tours → baby ; Céleste 4 tours → adult |
| Nouvelles actions | `SET_HATCH_COUNTER`, `ADVANCE_HATCH`, `SUMMON_FROM_DECK`, `EVOLUTION_JOKER`, `INSTANT_EVOLUTION`, `ALLOW_EVOLUTION_THIS_TURN` |
| Nouvelle condition | `DRAKON_ON_BOARD` |
| Nouvelle cible | `STRONGEST_ENEMY` |
| Nouvelle résolution de choix | `summon_to_zone` |

---

### Task 1 : Contrat partagé et textes d'effets

**Files :**
- Modify : `packages/shared/src/enums/card.ts`, `packages/shared/src/enums/effect.ts`,
  `packages/shared/src/game/card.ts`, `packages/shared/src/game/effect.ts`, `packages/shared/src/game/instance.ts`,
  `packages/shared/src/game/state.ts`, `packages/shared/src/game/action.ts`, `packages/shared/src/game/rules.ts`,
  `packages/shared/src/socket/fight.ts`, `packages/shared/src/api/requests.ts`
- Modify : `packages/shared/src/enums/enums.test.ts` (snapshot des valeurs d'ActionType si présent)
- Modify : `apps/backend/src/fights/engine/supported-effects.ts`
- Modify : `apps/frontend/src/features/fight/effectText.ts`, `apps/frontend/src/i18n/locales/{fr,en,ko}.json`,
  `apps/frontend/src/__tests__/unit/effectText.test.ts`
- Test : `packages/shared/src/game/rules.test.ts`

**Interfaces :**
- Produces (shared) :
  - `DrakonElement`, `DrakonStage` (const + type) ;
  - `ClientCard.element: DrakonElement | null`, `lineage: string | null`, `stage: DrakonStage | null` ;
  - `EffectCondition.element?`, `EffectCondition.stage?` ; `EffectFilter.element?`, `EffectFilter.stage?` ;
  - `EffectConditionType.DRAKON_ON_BOARD` ; `EffectTarget.STRONGEST_ENEMY` ; les 6 `ActionType` du tableau ;
  - `MonsterOnBoard.hatchCounter?: number`, `hatchStage?: DrakonStage`, `canEvolveThisTurn?: boolean`,
    `evolutionJoker?: boolean`, `instantEvolution?: boolean` ;
  - `PendingChoiceResolution` inclut `"summon_to_zone"` ;
  - `GameAction` : `{ type: "evolve"; handIndex: number; targetInstanceId: string; paymentHandIndices: number[] }` ;
  - `EvolvePayload { matchId: number; handIndex: number; targetInstanceId: string; paymentHandIndices?: number[] }`,
    événement client `"fight:evolve"` ;
  - `CreateCardRequest.element?`, `lineage?`, `stage?` ;
  - `canEvolveOnto(card, base): boolean`, `evolutionCost(card, base): number`, `canEvolveNow(base): boolean`.

- [ ] **Step 1 : tests de la règle d'évolution (échouent)**

Ajouter à `packages/shared/src/game/rules.test.ts` :

```ts
import { canEvolveNow, canEvolveOnto, evolutionCost } from "./rules";

const drakon = (stage: "egg" | "baby" | "young" | "adult", lineage: string | null, cost: number) => ({
  stage,
  lineage,
  cost,
});
const onBoard = (
  card: ReturnType<typeof drakon>,
  flags: { evolutionJoker?: boolean; summonedThisTurn?: boolean; instantEvolution?: boolean; canEvolveThisTurn?: boolean } = {},
) => ({ card: { baseCard: card }, summonedThisTurn: false, ...flags });

describe("évolution des Drakons", () => {
  it("même lignée, stade suivant", () => {
    expect(canEvolveOnto(drakon("young", "feros", 2), onBoard(drakon("baby", "feros", 1)))).toBe(true);
    expect(canEvolveOnto(drakon("adult", "feros", 3), onBoard(drakon("young", "feros", 2)))).toBe(true);
  });

  it("refuse une autre lignée ou un saut de stade", () => {
    expect(canEvolveOnto(drakon("young", "teros", 2), onBoard(drakon("baby", "feros", 1)))).toBe(false);
    expect(canEvolveOnto(drakon("adult", "feros", 3), onBoard(drakon("baby", "feros", 1)))).toBe(false);
    expect(canEvolveOnto(drakon("baby", "feros", 1), onBoard(drakon("baby", "feros", 1)))).toBe(false);
  });

  it("le joker accepte un Jeune de toute lignée, pas un Adulte", () => {
    const egg = onBoard(drakon("egg", null, 1), { evolutionJoker: true });
    expect(canEvolveOnto(drakon("young", "ackos", 2), egg)).toBe(true);
    expect(canEvolveOnto(drakon("adult", "ackos", 3), egg)).toBe(false);
  });

  it("coût = différence, jamais négatif", () => {
    expect(evolutionCost(drakon("young", "feros", 2), onBoard(drakon("baby", "feros", 1)))).toBe(1);
    expect(evolutionCost(drakon("young", "feros", 1), onBoard(drakon("egg", null, 2)))).toBe(0);
  });

  it("délai : pas le tour de pose, sauf accélérateur", () => {
    expect(canEvolveNow({ summonedThisTurn: true })).toBe(false);
    expect(canEvolveNow({ summonedThisTurn: false })).toBe(true);
    expect(canEvolveNow({ summonedThisTurn: true, instantEvolution: true })).toBe(true);
    expect(canEvolveNow({ summonedThisTurn: true, canEvolveThisTurn: true })).toBe(true);
  });
});
```

(adapter l'import de `describe/it/expect` à l'en-tête existant du fichier.)

- [ ] **Step 2 : vérifier l'échec**

Run : `pnpm --filter @pipou/shared test`
Expected : FAIL (fonctions absentes).

- [ ] **Step 3 : contrat partagé**

`enums/card.ts`, à la fin :

```ts
export const DrakonElement = {
  EARTH: "earth",
  FIRE: "fire",
  WIND: "wind",
  WATER: "water",
} as const;
export type DrakonElement = (typeof DrakonElement)[keyof typeof DrakonElement];

export const DrakonStage = {
  EGG: "egg",
  BABY: "baby",
  YOUNG: "young",
  ADULT: "adult",
} as const;
export type DrakonStage = (typeof DrakonStage)[keyof typeof DrakonStage];
```

`enums/effect.ts` :
- `EffectConditionType` : `DRAKON_ON_BOARD: "DRAKON_ON_BOARD",`
- `ActionType` : `SET_HATCH_COUNTER`, `ADVANCE_HATCH`, `SUMMON_FROM_DECK`, `EVOLUTION_JOKER`, `INSTANT_EVOLUTION`,
  `ALLOW_EVOLUTION_THIS_TURN` (valeur = clé)
- `EffectTarget` : `STRONGEST_ENEMY: "STRONGEST_ENEMY",`

`game/card.ts`, `ClientCard` après `archetype` :

```ts
  element: DrakonElement | null;
  lineage: string | null;
  stage: DrakonStage | null;
```

`game/effect.ts` : `EffectCondition` et `EffectFilter` gagnent `element?: DrakonElement;` et `stage?: DrakonStage;`
(doc de `EffectCondition.value` : « absent pour DRAKON_ON_BOARD »).

`game/instance.ts`, `MonsterOnBoard` après `ignoresTaunt?` :

```ts
  /** Tours restants avant éclosion (œuf). */
  hatchCounter?: number;
  /** Stade de la carte tirée du deck à l'éclosion. */
  hatchStage?: DrakonStage;
  /** Peut évoluer ce tour malgré le délai (effet). */
  canEvolveThisTurn?: boolean;
  /** Accepte un Jeune de n'importe quelle lignée (passif). */
  evolutionJoker?: boolean;
  /** Peut évoluer le tour où il est posé (passif). */
  instantEvolution?: boolean;
```

`game/state.ts` : `PendingChoiceResolution = "pick_to_hand" | "discard" | "summon_to_zone";`

`game/action.ts`, dans l'union `GameAction` :

```ts
  | {
      type: "evolve";
      handIndex: number;
      targetInstanceId: string;
      paymentHandIndices: number[];
    }
```

`game/rules.ts`, à la fin :

```ts
const NEXT_STAGE: Partial<Record<DrakonStage, DrakonStage>> = {
  baby: "young",
  young: "adult",
};

interface EvolvingCard {
  stage: DrakonStage | null;
  lineage: string | null;
  cost: number;
}
interface EvolutionBase {
  card: { baseCard: EvolvingCard };
  evolutionJoker?: boolean;
}

/** `card` (en main) peut-il évoluer sur `base` (en jeu) ? */
export function canEvolveOnto(card: EvolvingCard, base: EvolutionBase): boolean {
  if (card.stage !== "young" && card.stage !== "adult") return false;
  if (base.evolutionJoker && card.stage === "young") return true;
  const b = base.card.baseCard;
  return (
    !!b.stage &&
    NEXT_STAGE[b.stage] === card.stage &&
    !!b.lineage &&
    b.lineage === card.lineage
  );
}

/** Coût restant à payer pour évoluer. */
export function evolutionCost(card: EvolvingCard, base: EvolutionBase): number {
  return Math.max(0, card.cost - base.card.baseCard.cost);
}

/** Délai : une base posée ce tour n'évolue pas, sauf accélérateur. */
export function canEvolveNow(base: {
  summonedThisTurn: boolean;
  instantEvolution?: boolean;
  canEvolveThisTurn?: boolean;
}): boolean {
  return !base.summonedThisTurn || !!base.instantEvolution || !!base.canEvolveThisTurn;
}
```

(importer `DrakonStage` en type depuis `../enums/card`.)

`socket/fight.ts` : ajouter

```ts
export interface EvolvePayload {
  matchId: number;
  handIndex: number;
  targetInstanceId: string;
  paymentHandIndices?: number[];
}
```

et dans `ClientToServerEvents` : `"fight:evolve": (payload: EvolvePayload) => void;`.

`api/requests.ts`, `CreateCardRequest` : `element?: DrakonElement; lineage?: string; stage?: DrakonStage;`.

Si `enums/enums.test.ts` contient la liste des valeurs d'`ActionType` (ou des autres enums d'effet), la compléter
avec les nouvelles valeurs, dans le même ordre que l'enum.

Run : `pnpm build:shared && pnpm --filter @pipou/shared test` → PASS.

- [ ] **Step 4 : déclarations moteur**

`apps/backend/src/fights/engine/supported-effects.ts` : ajouter les 6 actions à `SUPPORTED_ACTIONS` et
`EffectConditionType.DRAKON_ON_BOARD` à `SUPPORTED_CONDITIONS` (les cibles sont déjà `Object.values`). Leur
comportement arrive aux tâches 3 à 5.

- [ ] **Step 5 : textes d'effets (front)**

`effectText.ts` :
- `KEYWORD_ICON` : ajouter `hatch: ""`, `evolutionJoker: ""`, `instantEvolution: ""` avec le commentaire
  `// Icône SVG fournie par KeywordIcon (pas d'emoji pour les nouveaux mots-clés)`.
- `ACTIONS` :

```ts
  SET_HATCH_COUNTER: { tone: "neutral", subject: "monster", keyword: "hatch", defaultValue: 2, plural: true },
  ADVANCE_HATCH: { tone: "buff", subject: "monster", defaultValue: 1, plural: true },
  SUMMON_FROM_DECK: { tone: "buff", subject: "player", fixedValue: 1 },
  EVOLUTION_JOKER: { tone: "buff", subject: "monster", keyword: "evolutionJoker" },
  INSTANT_EVOLUTION: { tone: "buff", subject: "monster", keyword: "instantEvolution" },
  ALLOW_EVOLUTION_THIS_TURN: { tone: "buff", subject: "monster" },
```

- `describeFilter` : après `filter.rarities`, ajouter
  `if (filter.stage) parts.push(t(\`effects.stage.${filter.stage}\`));` et
  `if (filter.element) parts.push(t(\`effects.element.${filter.element}\`));`.
- `describeCondition` : nouveau cas

```ts
    case "DRAKON_ON_BOARD":
      return t("effects.condition.DRAKON_ON_BOARD", {
        detail: drakonDetail(t, condition),
      });
```

  et, pour `EQUIPPED_ON` sans `value` mais avec `stage`/`element` :
  `if (condition.type === "EQUIPPED_ON" && condition.value === undefined) return t("effects.condition.EQUIPPED_ON_drakon", { detail: drakonDetail(t, condition) });`
  placé avant le `switch`. Ajouter :

```ts
function drakonDetail(t: TFunction, c: EffectCondition): string {
  return [
    c.stage ? t(`effects.stage.${c.stage}`) : "",
    c.element ? t(`effects.element.${c.element}`) : "",
  ]
    .filter(Boolean)
    .join(" · ");
}
```

Traductions (chaque fichier de langue) :
- `effects.stage` : fr `{ "egg": "Œuf", "baby": "Bébé", "young": "Jeune", "adult": "Adulte" }`,
  en `{ "egg": "Egg", "baby": "Baby", "young": "Young", "adult": "Adult" }`,
  ko `{ "egg": "알", "baby": "아기", "young": "청년", "adult": "성체" }`.
- `effects.element` : fr `{ "earth": "Terre", "fire": "Feu", "wind": "Vent", "water": "Eau" }`,
  en `{ "earth": "Earth", "fire": "Fire", "wind": "Wind", "water": "Water" }`,
  ko `{ "earth": "대지", "fire": "불", "wind": "바람", "water": "물" }`.
- `effects.condition` : fr `"DRAKON_ON_BOARD": "Si tu contrôles un Drakon ({{detail}})"`,
  `"EQUIPPED_ON_drakon": "Si elle est équipée sur un monstre ({{detail}})"` ;
  en `"If you control a Drakon ({{detail}})"`, `"If equipped to a monster ({{detail}})"` ;
  ko `"내 필드에 드라콘({{detail}})이 있으면"`, `"몬스터({{detail}})에 장착되어 있으면"`.
- `effects.target` : fr `"STRONGEST_ENEMY": "le monstre adverse le plus fort"`, en `"the strongest enemy monster"`,
  ko `"가장 강한 상대 몬스터"`.
- `effects.action` — sur le modèle exact des clés existantes de chaque langue :
  - `SET_HATCH_COUNTER` (même jeu de clés que `BLOCK_ATTACK` : `_one`, `_other`, `_many_one`, `_many_other` en fr/en ;
    formes ko comme `BLOCK_ATTACK` en ko) — fr : `"{{target}} éclot dans {{count}} tour en une carte{{filter}} de ton deck."` /
    `"... dans {{count}} tours ..."` (pluriel « éclosent » pour `_many`) ; en : `"{{target}} hatches in {{count}} turn into a card{{filter}} from your deck."` /
    `"turns"` (`hatch` pour `_many`) ; ko : `"{{target}}: {{count}}턴 후 덱의 카드{{filter}}(으)로 부화."`
  - `ADVANCE_HATCH` (même jeu que `BLOCK_ATTACK`) — fr : `"L'éclosion de {{target}} avance de {{count}} tour."` /
    `"tours"` ; en : `"{{target}} hatches {{count}} turn sooner."` / `"turns"` ; ko : `"{{target}}의 부화가 {{count}}턴 빨라짐."`
  - `SUMMON_FROM_DECK` (même jeu que `RETURN_FROM_GRAVEYARD_OR_DECK`) — fr : `"{{target}} invoque gratuitement 1 carte{{filter}} de son deck."` /
    `_you` `"Tu invoques gratuitement 1 carte{{filter}} de ton deck."` ; en : `"{{target}} summons 1 card{{filter}} from their deck for free."` /
    `"You summon 1 card{{filter}} from your deck for free."` ; ko : `"{{target}}: 덱에서 카드{{filter}} 1장을 무료 소환."` / `"덱에서 카드{{filter}} 1장을 무료 소환."`
  - `EVOLUTION_JOKER`, `INSTANT_EVOLUTION` (même jeu que `SET_TAUNT`) — fr `"{{target}} gagne **{{kw}}**."` / `_many`
    `"{{target}} gagnent **{{kw}}**."` ; en `"{{target}} gains **{{kw}}**."` / `"gain"` ; ko `"{{target}}에게 **{{kw}}** 부여."`
  - `ALLOW_EVOLUTION_THIS_TURN` (même jeu que `HEAL`) — fr `"{{target}} peut évoluer ce tour."` / `_many`
    `"{{target}} peuvent évoluer ce tour."` ; en `"{{target}} can evolve this turn."` (même phrase pour `_many`) ;
    ko `"{{target}}: 이번 턴 진화 가능."`
- `keywords` : fr `"hatch": { "name": "Éclosion", "desc": "Après le nombre de tours indiqué, l'œuf quitte le terrain et la carte de ton choix tirée de ton deck est invoquée à sa place." }`,
  `"evolutionJoker": { "name": "Joker d'évolution", "desc": "Un Jeune Drakon de n'importe quelle lignée peut évoluer sur ce monstre." }`,
  `"instantEvolution": { "name": "Évolution immédiate", "desc": "Peut évoluer dès le tour où il est posé." }` ;
  en `"Hatching"` / `"After the given number of turns, the egg leaves the field and the card of your choice from your deck is summoned in its place."`,
  `"Evolution joker"` / `"A Young Drakon of any lineage can evolve onto this monster."`,
  `"Instant evolution"` / `"Can evolve on the turn it is played."` ;
  ko `"부화"` / `"표시된 턴이 지나면 알이 필드를 떠나고 덱에서 고른 카드가 그 자리에 소환됩니다."`,
  `"진화 조커"` / `"어떤 계통의 청년 드라콘이든 이 몬스터 위로 진화할 수 있습니다."`,
  `"즉시 진화"` / `"놓인 턴에 바로 진화할 수 있습니다."`.

Dans `__tests__/unit/effectText.test.ts`, liste `conditions` de la couverture complète, ajouter :
`{ type: EffectConditionType.DRAKON_ON_BOARD, stage: "adult" as const }`,
`{ type: EffectConditionType.DRAKON_ON_BOARD, element: "fire" as const }`,
`{ type: EffectConditionType.EQUIPPED_ON, stage: "egg" as const }`, et dans le `filter` des actions testées
`stage: "baby" as const, element: "water" as const`.

- [ ] **Step 6 : vérifier**

Run : `pnpm build:shared && pnpm --filter @pipou/shared test && pnpm --filter @pipou/backend test -- effects-coverage && pnpm typecheck && pnpm --filter @pipou/frontend test effectText`
Expected : PASS. (`pnpm typecheck` peut signaler des objets `Card`/`ClientCard` construits à la main sans les 3
nouveaux champs : y ajouter `element: null, lineage: null, stage: null` — notamment
`apps/backend/src/fights/testing/cards.ts` (`baseCard`), `apps/frontend/src/__tests__/fixtures/monster.ts`, et
`rawSnapshotCards` dans `apps/backend/src/fights/testing/real-cards.ts` via
`{ element: null, lineage: null, stage: null, ...c, image: null }`.)

- [ ] **Step 7 : commit**

```bash
git add packages/shared apps/backend/src apps/frontend/src
git commit -m "feat(shared): Drakon contract (element, stage, evolution rules, new effect values)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2 : Colonnes de carte (entité, DTO, migration de schéma)

**Files :**
- Modify : `apps/backend/src/cards/card.entity.ts`, `apps/backend/src/cards/dto/create-card.dto.ts`
- Create : `apps/backend/src/database/migrations/1791000000005-DrakonColumns.ts`
- Test : `apps/backend/src/cards/dto/create-card.dto.spec.ts`

**Interfaces :**
- Consumes : `DrakonElement`, `DrakonStage` (Task 1).
- Produces : `Card.element: DrakonElement | null`, `Card.lineage: string | null`, `Card.stage: DrakonStage | null`.

- [ ] **Step 1 : test DTO (échoue)**

```ts
  it('accepte élément, lignée et stade de Drakon', async () => {
    const dto = plainToInstance(CreateCardDto, {
      name: 'Bébé Test',
      rarity: 'common',
      type: 'monster',
      atk: 100,
      hp: 500,
      cardSetId: 3,
      element: 'fire',
      lineage: 'feros',
      stage: 'baby',
    });
    expect(await validate(dto, { whitelist: true, forbidNonWhitelisted: true })).toEqual([]);
  });

  it('refuse un élément inconnu', async () => {
    const dto = plainToInstance(CreateCardDto, {
      name: 'Bébé Test', rarity: 'common', type: 'monster', atk: 0, hp: 1, cardSetId: 3, element: 'lava',
    });
    expect(await validate(dto, { whitelist: true, forbidNonWhitelisted: true })).not.toEqual([]);
  });
```

Run : `pnpm --filter @pipou/backend test -- create-card.dto` → FAIL.

- [ ] **Step 2 : entité et DTO**

`card.entity.ts`, après `archetype` :

```ts
  @Column({ type: 'enum', enum: DrakonElement, nullable: true, default: null })
  element!: DrakonElement | null;

  @Column({ type: 'varchar', length: 50, nullable: true, default: null })
  lineage!: string | null;

  @Column({ type: 'enum', enum: DrakonStage, nullable: true, default: null })
  stage!: DrakonStage | null;
```

`create-card.dto.ts` : dans `EffectConditionDto` et `EffectFilterDto`, ajouter

```ts
  @IsOptional()
  @IsEnum(DrakonElement)
  element?: DrakonElement;

  @IsOptional()
  @IsEnum(DrakonStage)
  stage?: DrakonStage;
```

et dans `CreateCardDto`, après `archetype` : les mêmes deux champs plus

```ts
  @IsOptional()
  @IsString()
  @MaxLength(50)
  lineage?: string;
```

- [ ] **Step 3 : migration de schéma**

`1791000000005-DrakonColumns.ts` :

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

/** Élément, lignée et stade des cartes Drakon (spec 2026-10-17-drakon-set). */
export class DrakonColumns1791000000005 implements MigrationInterface {
  name = 'DrakonColumns1791000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE `card` ADD `element` enum ('earth', 'fire', 'wind', 'water') NULL DEFAULT NULL",
    );
    await queryRunner.query(
      'ALTER TABLE `card` ADD `lineage` varchar(50) NULL DEFAULT NULL',
    );
    await queryRunner.query(
      "ALTER TABLE `card` ADD `stage` enum ('egg', 'baby', 'young', 'adult') NULL DEFAULT NULL",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `card` DROP COLUMN `stage`');
    await queryRunner.query('ALTER TABLE `card` DROP COLUMN `lineage`');
    await queryRunner.query('ALTER TABLE `card` DROP COLUMN `element`');
  }
}
```

- [ ] **Step 4 : vérifier et commit**

Run : `pnpm --filter @pipou/backend test && pnpm --filter @pipou/backend typecheck && pnpm --filter @pipou/backend lint`
Expected : PASS.

```bash
git add apps/backend/src
git commit -m "feat(cards): Drakon element, lineage and stage columns

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3 : Cibles, conditions et filtres Drakon

**Files :**
- Modify : `apps/backend/src/fights/effects/effect-targets.resolver.ts`,
  `apps/backend/src/fights/effects/effect-conditions.ts`, `apps/backend/src/fights/effects/pick-candidates.ts`,
  `apps/backend/src/fights/effects/effect-actions.applier.ts`, `apps/backend/src/fights/effects/effect-resolvability.ts`
- Test : `apps/backend/src/fights/engine/drakon-mechanics.spec.ts` (créé)

**Interfaces :**
- Consumes : Task 1 (enums, champs `element`/`stage` de condition/filtre), Task 2 (`Card.element/stage`).
- Produces : `resolveTargets(target, ctx, archetype?: string)` (3ᵉ paramètre optionnel).

- [ ] **Step 1 : tests (échouent)**

Créer `drakon-mechanics.spec.ts` :

```ts
import {
  ActionType,
  EffectConditionType,
  EffectTarget,
  EffectTrigger,
} from '@pipou/shared';
import { createEngine } from '../testing/engine';
import { act, effect, ephemeralCard, equipmentCard, monsterCard } from '../testing/cards';
import { handNames, monsterNamed, scenario } from '../testing/scenario';

const dragon = (
  name: string,
  extra: Parameters<typeof monsterCard>[1] = {},
) => monsterCard(name, { archetype: 'dragon', ...extra });

describe('mécaniques Drakon', () => {
  const engine = createEngine();

  describe('cibles, conditions, filtres', () => {
    it('STRONGEST_ENEMY vise le monstre adverse de plus grande ATK', () => {
      const renvoi = ephemeralCard('Renvoi', [
        effect(EffectTrigger.ON_PLAY, [
          act(ActionType.RETURN_TO_HAND, EffectTarget.STRONGEST_ENEMY),
        ]),
      ]);
      const game = scenario({
        p1: { hand: [renvoi] },
        p2: {
          monsters: [
            monsterCard('Faible', { atk: 100 }),
            monsterCard('Fort', { atk: 900 }),
          ],
        },
      });
      engine.dispatch(game, 'p1', { type: 'play_support', handIndex: 0 });
      expect(handNames(game, 'p2')).toContain('Fort');
      expect(monsterNamed(game, 'p2', 'Faible')).toBeDefined();
    });

    it('DRAKON_ON_BOARD par stade et par élément (valueIf)', () => {
      const frappe = () =>
        ephemeralCard('Frappe', [
          effect(EffectTrigger.ON_PLAY, [
            act(ActionType.DEAL_DAMAGE, EffectTarget.ALL_ENEMIES, {
              value: 300,
              valueIf: {
                condition: { type: EffectConditionType.DRAKON_ON_BOARD, element: 'fire' },
                value: 600,
              },
            }),
          ]),
        ]);
      const sans = scenario({
        p1: { hand: [frappe()], monsters: [dragon('Eau', { element: 'water' })] },
        p2: { monsters: [monsterCard('Cible', { hp: 2000 })] },
      });
      engine.dispatch(sans, 'p1', { type: 'play_support', handIndex: 0 });
      expect(monsterNamed(sans, 'p2', 'Cible').currentHp).toBe(1700);

      const avec = scenario({
        p1: { hand: [frappe()], monsters: [dragon('Feu', { element: 'fire' })] },
        p2: { monsters: [monsterCard('Cible', { hp: 2000 })] },
      });
      engine.dispatch(avec, 'p1', { type: 'play_support', handIndex: 0 });
      expect(monsterNamed(avec, 'p2', 'Cible').currentHp).toBe(1400);
    });

    it('EQUIPPED_ON par stade (sans nom)', () => {
      const ecaille = equipmentCard('Écaille', [
        effect(
          EffectTrigger.PASSIVE,
          [act(ActionType.SET_DEBUFF_IMMUNITY, EffectTarget.SELF)],
          { type: EffectConditionType.EQUIPPED_ON, stage: 'egg' },
        ),
      ]);
      const game = scenario({
        p1: {
          monsters: [
            { card: dragon('Œuf', { stage: 'egg', atk: 0 }), equipments: [ecaille] },
            { card: dragon('Bébé', { stage: 'baby' }), equipments: [ecaille] },
          ],
        },
      });
      engine.settle(game);
      expect(monsterNamed(game, 'p1', 'Œuf').isImmuneToDebuffs).toBe(true);
      expect(monsterNamed(game, 'p1', 'Bébé').isImmuneToDebuffs).toBe(false);
    });

    it('filtre de recherche par stade', () => {
      const potion = ephemeralCard('Potion', [
        effect(EffectTrigger.ON_PLAY, [
          act(ActionType.SEARCH_DECK, EffectTarget.PLAYER, { filter: { stage: 'young' } }),
        ]),
      ]);
      const game = scenario({
        p1: {
          hand: [potion],
          deck: [dragon('Bébé A', { stage: 'baby' }), dragon('Jeune A', { stage: 'young' })],
        },
      });
      engine.dispatch(game, 'p1', { type: 'play_support', handIndex: 0 });
      expect(game.pendingChoices[0].candidates.map((c) => c.baseCard.name)).toEqual(['Jeune A']);
    });

    it('ARCHETYPE_ALLIES depuis un Éphémère (archetype de l’action)', () => {
      const souffle = ephemeralCard('Souffle', [
        effect(EffectTrigger.ON_PLAY, [
          act(ActionType.BUFF_ATK_TEMP, EffectTarget.ARCHETYPE_ALLIES, { value: 300, archetype: 'dragon' }),
        ]),
      ]);
      const game = scenario({
        p1: { hand: [souffle], monsters: [dragon('Drakon'), monsterCard('Pipou', { archetype: 'pipou' })] },
      });
      engine.dispatch(game, 'p1', { type: 'play_support', handIndex: 0 });
      expect(monsterNamed(game, 'p1', 'Drakon').tempAtkBuff).toBe(300);
      expect(monsterNamed(game, 'p1', 'Pipou').tempAtkBuff).toBe(0);
    });
  });
});
```

Run : `pnpm --filter @pipou/backend test -- drakon-mechanics` → FAIL.

- [ ] **Step 2 : implémenter**

`effect-targets.resolver.ts` :
- signature `resolveTargets(target: EffectTarget, ctx: EffectContext, archetype?: string)` ;
- cas `ARCHETYPE_ALLIES` :

```ts
    case EffectTarget.ARCHETYPE_ALLIES: {
      const arch =
        archetype ??
        ctx.sourceMonster?.card.baseCard.archetype ??
        ctx.sourceCard?.baseCard.archetype;
      if (arch) {
        monsters = allies.filter((m) => m.card.baseCard.archetype === arch);
        register(monsters, owner);
      }
      break;
    }
```

- nouveau cas (importer `effectiveAtk` depuis `../helpers/game-state.helper`) :

```ts
    case EffectTarget.STRONGEST_ENEMY: {
      const strongest = enemies.reduce<MonsterOnBoard | undefined>(
        (best, m) => (!best || effectiveAtk(m) > effectiveAtk(best) ? m : best),
        undefined,
      );
      if (strongest) {
        monsters = [strongest];
        register(monsters, opponent);
      }
      break;
    }
```

`effect-actions.applier.ts` et `effect-resolvability.ts` : appeler
`resolveTargets(action.target, ctx, action.archetype)`.

`effect-conditions.ts` (`conditionMet`) : nouveau cas

```ts
    case ConditionType.DRAKON_ON_BOARD:
      return owner.monsterZones.some(
        (m) =>
          !!m &&
          (!condition.element || m.card.baseCard.element === condition.element) &&
          (!condition.stage || m.card.baseCard.stage === condition.stage),
      );
```

et remplacer le cas `EQUIPPED_ON` par :

```ts
    case ConditionType.EQUIPPED_ON: {
      const host = ctx.sourceMonster?.card.baseCard;
      return (
        ctx.sourceCard?.baseCard.supportType === SupportType.EQUIPMENT &&
        !!host &&
        (condition.value === undefined ||
          cardNameMatches(host.name, expectedName, condition.match)) &&
        (!condition.element || host.element === condition.element) &&
        (!condition.stage || host.stage === condition.stage)
      );
    }
```

`pick-candidates.ts` (`matchesFilter`), avant `return true` :

```ts
  if (filter.element && c.element !== filter.element) return false;
  if (filter.stage && c.stage !== filter.stage) return false;
```

- [ ] **Step 3 : vérifier et commit**

Run : `pnpm --filter @pipou/backend test && pnpm --filter @pipou/backend typecheck && pnpm --filter @pipou/backend lint`
Expected : PASS.

```bash
git add apps/backend/src
git commit -m "feat(fights): Drakon targets, conditions and filters

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4 : Évolution

**Files :**
- Create : `apps/backend/src/fights/services/evolution.service.ts`
- Modify : `apps/backend/src/fights/engine/game-engine.ts`, `apps/backend/src/fights/testing/engine.ts`,
  `apps/backend/src/fights/fights.module.ts`, `apps/backend/src/fights/fights.gateway.ts`,
  `apps/backend/src/fights/effects/effect-actions.applier.ts`, `apps/backend/src/fights/buffs-calculator.service.ts`,
  `apps/backend/src/fights/services/phase.service.ts`, `apps/backend/src/fights/services/battle.service.ts`,
  `apps/frontend/src/features/fight/emitGameAction.ts`
- Test : `apps/backend/src/fights/engine/drakon-mechanics.spec.ts`, `apps/frontend/src/__tests__/unit/emitGameAction.test.ts`

**Interfaces :**
- Consumes : `canEvolveOnto`, `canEvolveNow`, `evolutionCost`, `GameAction` `evolve`, `EvolvePayload` (Task 1).
- Produces : `EvolutionService.evolve(game, userId, handIndex, targetInstanceId, paymentHandIndices): { error?: string }`.

- [ ] **Step 1 : tests (échouent)**

Ajouter dans `drakon-mechanics.spec.ts` (imports : `equipmentCard`, `attackWith`, `graveyardNames`, `passTurn`,
`P1_ID`) :

```ts
  describe('évolution', () => {
    const bebe = (extra = {}) =>
      dragon('Bébé Feros', { stage: 'baby', lineage: 'feros', element: 'fire', cost: 1, atk: 400, hp: 400, ...extra });
    const jeune = (extra = {}) =>
      dragon('Jeune Feros', {
        stage: 'young', lineage: 'feros', element: 'fire', cost: 2, atk: 800, hp: 900,
        effects: [effect(EffectTrigger.ON_SUMMON, [act(ActionType.SET_PIERCING, EffectTarget.SELF)])],
        ...extra,
      });
    const evolve = (game: ReturnType<typeof scenario>, name = 'Bébé Feros', paymentHandIndices: number[] = []) =>
      engine.dispatch(game, 'p1', {
        type: 'evolve',
        handIndex: 0,
        targetInstanceId: monsterNamed(game, 'p1', name).instanceId,
        paymentHandIndices,
      });

    it('remplace la base : équipements et mode gardés, PV pleins, base au cimetière, ON_SUMMON', () => {
      const casque = equipmentCard('Casque', []);
      const game = scenario({
        p1: {
          hand: [jeune()],
          recycleEnergy: 1,
          monsters: [{ card: bebe(), equipments: [casque], mode: 'guard', currentHp: 100 }],
        },
      });
      expect(evolve(game)).toEqual({});
      const evolved = monsterNamed(game, 'p1', 'Jeune Feros');
      expect(game.player1.monsterZones[0]).toBe(evolved);
      expect(evolved.equipments.map((e) => e.baseCard.name)).toEqual(['Casque']);
      expect(evolved.mode).toBe('guard');
      expect(evolved.currentHp).toBe(900);
      expect(evolved.hasPiercing).toBe(true);
      expect(graveyardNames(game, 'p1')).toEqual(['Bébé Feros']);
      expect(game.player1.recycleEnergy).toBe(0);
      expect(game.pendingEvents.at(-1)).toMatchObject({ kind: 'monster_summoned', zoneIndex: 0 });
    });

    it('coût en différence payé par défausse', () => {
      const game = scenario({ p1: { hand: [jeune(), monsterCard('Payeur')], monsters: [bebe()] } });
      expect(evolve(game, 'Bébé Feros', [])).toEqual({
        error: 'Pas assez de cartes défaussées (besoin: 1)',
      });
      expect(evolve(game, 'Bébé Feros', [1])).toEqual({});
      expect(graveyardNames(game, 'p1')).toEqual(['Payeur', 'Bébé Feros']);
    });

    it('refuse le tour de pose, sauf Évolution immédiate ou Peut évoluer ce tour', () => {
      const posé = { card: bebe(), summonedThisTurn: true };
      const refus = scenario({ p1: { hand: [jeune()], recycleEnergy: 1, monsters: [posé] } });
      expect(evolve(refus).error).toBe("Bébé Feros doit attendre un tour avant d'évoluer");

      const rapide = scenario({
        p1: { hand: [jeune()], recycleEnergy: 1, monsters: [{ ...posé, patch: { canEvolveThisTurn: true } }] },
      });
      expect(evolve(rapide)).toEqual({});
    });

    it('refuse une autre lignée', () => {
      const game = scenario({
        p1: { hand: [jeune({ lineage: 'teros' })], recycleEnergy: 1, monsters: [bebe()] },
      });
      expect(evolve(game).error).toBe('Jeune Feros ne peut pas évoluer depuis Bébé Feros');
    });

    it('le joker accepte un Jeune de toute lignée', () => {
      const oeuf = dragon('Œuf', {
        stage: 'egg', atk: 0, hp: 300, cost: 1,
        effects: [effect(EffectTrigger.PASSIVE, [act(ActionType.EVOLUTION_JOKER, EffectTarget.SELF)])],
      });
      const game = scenario({ p1: { hand: [jeune({ lineage: 'ackos' })], recycleEnergy: 1, monsters: [oeuf] } });
      engine.settle(game);
      expect(evolve(game, 'Œuf')).toEqual({});
    });

    it("pas d'attaque supplémentaire en évoluant", () => {
      const game = scenario({
        p1: {
          hand: [jeune()],
          recycleEnergy: 1,
          monsters: [{ card: bebe(), patch: { attacksUsedThisTurn: 1, hasAttackedThisTurn: true } }],
        },
      });
      evolve(game);
      expect(monsterNamed(game, 'p1', 'Jeune Feros').hasAttackedThisTurn).toBe(true);
    });

    it('INSTANT_EVOLUTION (passif) et ALLOW_EVOLUTION_THIS_TURN (effet, expire en fin de tour)', () => {
      const vent = dragon('Bébé Vent', {
        stage: 'baby', lineage: 'tempestu', cost: 1,
        effects: [effect(EffectTrigger.PASSIVE, [act(ActionType.INSTANT_EVOLUTION, EffectTarget.SELF)])],
      });
      const game = scenario({ p1: { monsters: [{ card: vent, summonedThisTurn: true }] } });
      engine.settle(game);
      expect(monsterNamed(game, 'p1', 'Bébé Vent').instantEvolution).toBe(true);

      const accel = ephemeralCard('Accélère', [
        effect(EffectTrigger.ON_PLAY, [act(ActionType.ALLOW_EVOLUTION_THIS_TURN, EffectTarget.TARGET_ALLY)]),
      ]);
      const g2 = scenario({ p1: { hand: [accel], monsters: [bebe()] } });
      const id = monsterNamed(g2, 'p1', 'Bébé Feros').instanceId;
      engine.dispatch(g2, 'p1', { type: 'play_support', handIndex: 0, targetInstanceId: id });
      expect(monsterNamed(g2, 'p1', 'Bébé Feros').canEvolveThisTurn).toBe(true);
      passTurn(engine, g2);
      expect(monsterNamed(g2, 'p1', 'Bébé Feros').canEvolveThisTurn).toBeFalsy();
    });

    it('un Œuf ne peut pas attaquer', () => {
      const game = scenario({
        phase: 'battle',
        p1: { monsters: [dragon('Œuf', { stage: 'egg', atk: 0 })] },
        p2: { monsters: [monsterCard('Cible')] },
      });
      expect(attackWith(engine, game, 'p1', 'Œuf', 'Cible').error).toBe('Un Œuf ne peut pas attaquer');
    });
  });
```

(Note : `P1_ID` n'est utile que si un test le requiert ; ne pas l'importer sinon.)

Ajouter à `apps/frontend/src/__tests__/unit/emitGameAction.test.ts`, sur le modèle des cas existants :

```ts
  it("evolve → fight:evolve", () => {
    const socket = { emit: vi.fn() };
    emitGameAction(socket, 7, {
      type: "evolve",
      handIndex: 2,
      targetInstanceId: "m1",
      paymentHandIndices: [0],
    });
    expect(socket.emit).toHaveBeenCalledWith("fight:evolve", {
      matchId: 7,
      handIndex: 2,
      targetInstanceId: "m1",
      paymentHandIndices: [0],
    });
  });
```

Run : backend `drakon-mechanics`, front `emitGameAction` → FAIL.

- [ ] **Step 2 : `EvolutionService`**

Créer `services/evolution.service.ts` :

```ts
import { Injectable } from '@nestjs/common';
import {
  EffectTrigger,
  canEvolveNow,
  canEvolveOnto,
  evolutionCost,
} from '@pipou/shared';
import { GameState } from '../interfaces/game-state.interface';
import { createMonsterOnBoard } from '../helpers/monster.factory';
import { EffectsResolverService } from '../effects-resolver.service';
import {
  addLog,
  getPlayerState,
  isCurrentPlayer,
} from '../helpers/game-state.helper';

@Injectable()
export class EvolutionService {
  constructor(private effectsResolver: EffectsResolverService) {}

  /** Fait évoluer un monstre allié avec un Drakon de la main (spec Drakon). */
  evolve(
    game: GameState,
    userId: number,
    handIndex: number,
    targetInstanceId: string,
    paymentHandIndices: number[],
  ): { error?: string } {
    if (!isCurrentPlayer(game, userId))
      return { error: "Ce n'est pas ton tour" };
    if (game.phase !== 'main') return { error: 'Phase principale uniquement' };

    const player = getPlayerState(game, userId);
    const card = player.hand[handIndex];
    if (!card) return { error: 'Index main invalide' };
    const zoneIndex = player.monsterZones.findIndex(
      (m) => m?.instanceId === targetInstanceId,
    );
    const base = player.monsterZones[zoneIndex];
    if (!base) return { error: 'Monstre à faire évoluer introuvable' };
    if (!canEvolveOnto(card.baseCard, base))
      return {
        error: `${card.baseCard.name} ne peut pas évoluer depuis ${base.card.baseCard.name}`,
      };
    if (!canEvolveNow(base))
      return {
        error: `${base.card.baseCard.name} doit attendre un tour avant d'évoluer`,
      };

    // Paiement : énergie de recyclage puis défausse (comme une invocation)
    const cost = evolutionCost(card.baseCard, base);
    const uniquePayment = [...new Set(paymentHandIndices)];
    const handPayNeeded = Math.max(0, cost - player.recycleEnergy);
    if (uniquePayment.length < handPayNeeded)
      return {
        error: `Pas assez de cartes défaussées (besoin: ${handPayNeeded})`,
      };
    if (uniquePayment.includes(handIndex))
      return { error: 'La carte qui évolue ne peut pas payer son propre coût' };
    for (const i of uniquePayment)
      if (i < 0 || i >= player.hand.length)
        return { error: `Index de paiement invalide: ${i}` };

    player.recycleEnergy -= Math.min(player.recycleEnergy, cost);
    const paid = [...uniquePayment].sort((a, b) => b - a).slice(0, handPayNeeded);
    for (const i of paid) player.graveyard.push(player.hand.splice(i, 1)[0]);
    const shift = paid.filter((i) => i < handIndex).length;
    const [evolvedCard] = player.hand.splice(handIndex - shift, 1);

    const evolved = createMonsterOnBoard(evolvedCard, {
      ownerUserId: base.ownerUserId,
    });
    evolved.equipments = base.equipments;
    evolved.mode = base.mode;
    // Compte comme posé ce tour : pas de réévolution immédiate (n'empêche pas d'attaquer)
    evolved.summonedThisTurn = true;
    evolved.attacksUsedThisTurn = base.attacksUsedThisTurn;
    evolved.hasAttackedThisTurn = base.hasAttackedThisTurn;

    player.graveyard.push(base.card);
    player.monsterZones[zoneIndex] = evolved;
    game.pendingEvents.push({
      kind: 'monster_summoned',
      ownerId: player.userId,
      zoneIndex,
      instanceId: evolved.instanceId,
      rarity: evolvedCard.baseCard.rarity,
    });
    addLog(
      game,
      `🧬 ${base.card.baseCard.name} évolue en ${evolvedCard.baseCard.name}`,
    );

    const log: string[] = [];
    this.effectsResolver.resolve(evolvedCard, EffectTrigger.ON_SUMMON, {
      game,
      ownerUserId: userId,
      sourceMonster: evolved,
      log,
    });
    for (const handCard of player.hand)
      this.effectsResolver.resolve(handCard, EffectTrigger.ON_ALLY_SUMMON, {
        game,
        ownerUserId: userId,
        log,
      });
    log.forEach((l) => addLog(game, l));
    return {};
  }
}
```

- [ ] **Step 3 : câblage**

- `game-engine.ts` : injecter `private evolution: EvolutionService` (constructeur, après `summon`) et ajouter au
  `switch` de `apply` :

```ts
      case 'evolve':
        return this.evolution.evolve(
          game,
          userId,
          action.handIndex,
          action.targetInstanceId,
          action.paymentHandIndices,
        );
```

- `testing/engine.ts` : `new GameEngine(new PhaseService(effects), new SummonService(effects), new EvolutionService(effects), …)`
  dans l'ordre du constructeur.
- `fights.module.ts` : ajouter `EvolutionService` aux `providers`.
- `fights.gateway.ts` : sur le modèle de `fight:summon` :

```ts
  @SubscribeMessage('fight:evolve')
  async evolveMonster(
    @ConnectedSocket() client: FightSocket,
    @MessageBody() data: EvolvePayload,
  ): Promise<void> {
    await this.play(client, data.matchId, {
      type: 'evolve',
      handIndex: data.handIndex,
      targetInstanceId: data.targetInstanceId,
      paymentHandIndices: data.paymentHandIndices ?? [],
    });
  }
```

- `emitGameAction.ts` (front) :

```ts
    case "evolve":
      socket.emit("fight:evolve", {
        matchId,
        handIndex: action.handIndex,
        targetInstanceId: action.targetInstanceId,
        paymentHandIndices: action.paymentHandIndices,
      });
      return;
```

- [ ] **Step 4 : drapeaux et œufs**

- `effect-actions.applier.ts`, nouveau cas :

```ts
      case ActionType.ALLOW_EVOLUTION_THIS_TURN:
        for (const m of targets.monsters) {
          m.canEvolveThisTurn = true;
          ctx.log.push(`🧬 ${m.card.baseCard.name} peut évoluer ce tour`);
        }
        break;
```

- `buffs-calculator.service.ts` : socle `m.evolutionJoker = false; m.instantEvolution = false;` et dans
  `applyPassive` :

```ts
    case ActionType.EVOLUTION_JOKER:
      m.evolutionJoker = true;
      break;
    case ActionType.INSTANT_EVOLUTION:
      m.instantEvolution = true;
      break;
```

- `phase.service.ts` (`endTurn`, dans la boucle sur `player.monsterZones`) : `m.canEvolveThisTurn = false;`.
- `battle.service.ts`, après `if (!attacker) …` : importer `DrakonStage` et

```ts
    if (attacker.card.baseCard.stage === DrakonStage.EGG)
      return { error: 'Un Œuf ne peut pas attaquer' };
```

- [ ] **Step 5 : vérifier et commit**

Run : `pnpm --filter @pipou/backend test && pnpm --filter @pipou/backend typecheck && pnpm --filter @pipou/backend lint && pnpm --filter @pipou/frontend test emitGameAction && pnpm --filter @pipou/frontend typecheck`
Expected : PASS.

```bash
git add apps/backend/src apps/frontend/src
git commit -m "feat(fights): Drakon evolution action

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5 : Éclosion et invocation depuis le deck

**Files :**
- Create : `apps/backend/src/fights/helpers/hatching.ts`
- Modify : `apps/backend/src/fights/interfaces/game-state.interface.ts` (`PendingChoice.zoneIndex?`),
  `apps/backend/src/fights/effects/effect-actions.applier.ts`, `apps/backend/src/fights/effects/pick-candidates.ts`,
  `apps/backend/src/fights/effects/effect-resolvability.ts`, `apps/backend/src/fights/services/phase.service.ts`,
  `apps/backend/src/fights/services/pick.service.ts`, `apps/backend/src/fights/services/summon.service.ts`,
  `apps/backend/src/fights/testing/engine.ts`
- Test : `apps/backend/src/fights/engine/drakon-mechanics.spec.ts`

**Interfaces :**
- Consumes : `SET_HATCH_COUNTER`, `ADVANCE_HATCH`, `SUMMON_FROM_DECK`, `summon_to_zone`, `MonsterOnBoard.hatchCounter/hatchStage` (Task 1).
- Produces : `hatchEgg(game, owner, egg, log): void` ; `SummonService.summonFromDeck(game, owner, card, preferredZone?): boolean` ;
  `PickService` reçoit `SummonService` au constructeur.

- [ ] **Step 1 : tests (échouent)**

```ts
  describe('éclosion', () => {
    const oeuf = (turns: number, stage: 'baby' | 'adult', extra: CardEffect[] = []) =>
      dragon(`Œuf ${stage}`, {
        stage: 'egg', atk: 0, hp: 300,
        effects: [
          effect(EffectTrigger.ON_SUMMON, [
            act(ActionType.SET_HATCH_COUNTER, EffectTarget.SELF, { value: turns, filter: { stage } }),
          ]),
          ...extra,
        ],
      });
    // Cartes neutres d'abord : la pioche de début de tour ne prend pas les candidats
    const deck = () => [
      ...['F1', 'F2', 'F3', 'F4'].map((n) => monsterCard(n)),
      dragon('Bébé Deck', { stage: 'baby' }),
      dragon('Adulte Deck', { stage: 'adult' }),
    ];
    const pose = (game: ReturnType<typeof scenario>) =>
      engine.dispatch(game, 'p1', { type: 'summon', handIndex: 0, zoneIndex: 1, paymentHandIndices: [] });

    it('éclot après 2 tours du propriétaire en la carte choisie, dans la zone de l’œuf', () => {
      const game = scenario({ p1: { hand: [oeuf(2, 'baby')], deck: deck() } });
      pose(game);
      passTurn(engine, game); // tour p2
      passTurn(engine, game); // début du 2ᵉ tour de p1 : 2 → 1
      expect(game.pendingChoices).toHaveLength(0);
      passTurn(engine, game);
      passTurn(engine, game); // début du 3ᵉ tour de p1 : 1 → 0, éclosion
      const choice = game.pendingChoices[0];
      expect(choice).toMatchObject({ resolution: 'summon_to_zone', zoneIndex: 1 });
      expect(choice.candidates.map((c) => c.baseCard.name)).toEqual(['Bébé Deck']);
      expect(game.player1.monsterZones[1]).toBeNull();
      engine.dispatch(game, 'p1', { type: 'pick_cards', instanceIds: [choice.candidates[0].instanceId] });
      expect(game.player1.monsterZones[1]?.card.baseCard.name).toBe('Bébé Deck');
      expect(graveyardNames(game, 'p1')).toContain('Œuf baby');
    });

    it('éclore ne déclenche pas ON_DEATH', () => {
      const piege = effect(EffectTrigger.ON_DEATH, [act(ActionType.DRAW, EffectTarget.PLAYER, { value: 3 })]);
      const game = scenario({ p1: { hand: [oeuf(1, 'baby', [piege])], deck: deck() } });
      pose(game);
      const handBefore = game.player1.hand.length;
      passTurn(engine, game);
      passTurn(engine, game);
      // seule la pioche de début de tour : pas les 3 cartes d'ON_DEATH
      expect(game.player1.hand.length).toBe(handBefore + 1);
    });

    it('deck sans candidat : l’œuf part au cimetière, pas de choix', () => {
      const game = scenario({ p1: { hand: [oeuf(1, 'adult')], deck: [monsterCard('Rien')] } });
      pose(game);
      passTurn(engine, game);
      passTurn(engine, game);
      expect(game.pendingChoices).toHaveLength(0);
      expect(game.player1.monsterZones[1]).toBeNull();
    });

    it('ADVANCE_HATCH jusqu’à 0 : éclosion immédiate', () => {
      const incub = ephemeralCard('Incubation', [
        effect(EffectTrigger.ON_PLAY, [act(ActionType.ADVANCE_HATCH, EffectTarget.TARGET_ALLY, { value: 2 })]),
      ]);
      const game = scenario({ p1: { hand: [oeuf(2, 'baby'), incub], deck: deck() } });
      pose(game);
      const egg = monsterNamed(game, 'p1', 'Œuf baby');
      engine.dispatch(game, 'p1', { type: 'play_support', handIndex: 0, targetInstanceId: egg.instanceId });
      expect(game.pendingChoices[0]).toMatchObject({ resolution: 'summon_to_zone', zoneIndex: 1 });
    });

    it('SUMMON_FROM_DECK à la destruction : Jeune choisi invoqué dans la zone libérée', () => {
      const dualite = dragon('Dualité', {
        stage: 'egg', atk: 0, hp: 300,
        effects: [effect(EffectTrigger.ON_DEATH, [act(ActionType.SUMMON_FROM_DECK, EffectTarget.PLAYER, { filter: { stage: 'young' } })])],
      });
      const formatage = ephemeralCard('Formatage', [
        effect(EffectTrigger.ON_PLAY, [act(ActionType.DESTROY_MONSTER, EffectTarget.TARGET_ALLY)]),
      ]);
      const game = scenario({
        p1: { hand: [formatage], monsters: [null, dualite], deck: [dragon('Jeune Deck', { stage: 'young' })] },
      });
      engine.dispatch(game, 'p1', {
        type: 'play_support', handIndex: 0, targetInstanceId: monsterNamed(game, 'p1', 'Dualité').instanceId,
      });
      const choice = game.pendingChoices[0];
      expect(choice).toMatchObject({ resolution: 'summon_to_zone', zoneIndex: 1 });
      engine.dispatch(game, 'p1', { type: 'pick_cards', instanceIds: [choice.candidates[0].instanceId] });
      expect(game.player1.monsterZones[1]?.card.baseCard.name).toBe('Jeune Deck');
    });
  });
```

(importer le type `CardEffect` depuis `@pipou/shared`. Les compteurs de tours de passTurn : chaque `passTurn` termine
le tour du joueur actif ; vérifier le nombre exact d'appels en lisant `processTurnCounters` et ajuster les commentaires
si le premier début de tour de p1 suivant la pose est « 1 tour ».)

- [ ] **Step 2 : implémentation**

`interfaces/game-state.interface.ts`, `PendingChoice` : `/** summon_to_zone : zone visée. */ zoneIndex?: number;`

`effects/pick-candidates.ts`, dans `pickCandidates` : `case ActionType.SUMMON_FROM_DECK: return from(player.deck, 'deck');`
`effects/effect-resolvability.ts` : ajouter `ActionType.SUMMON_FROM_DECK` à `PICK_ACTIONS`.

Créer `helpers/hatching.ts` :

```ts
import type { DrakonStage } from '@pipou/shared';
import type {
  GameState,
  MonsterOnBoard,
  PlayerGameState,
} from '../interfaces/game-state.interface';
import { queueChoice } from './game-state.helper';

/**
 * L'œuf quitte le terrain sans être détruit (pas d'ON_DEATH) ; le propriétaire
 * choisit dans son deck une carte du stade visé, invoquée dans la zone libérée.
 */
export function hatchEgg(
  game: GameState,
  owner: PlayerGameState,
  egg: MonsterOnBoard,
  log: string[],
): void {
  const zoneIndex = owner.monsterZones.indexOf(egg);
  if (zoneIndex === -1) return;
  owner.monsterZones[zoneIndex] = null;
  owner.graveyard.push(...egg.equipments, egg.card);

  const stage: DrakonStage | undefined = egg.hatchStage;
  const candidates = owner.deck
    .filter((c) => c.baseCard.stage === stage)
    .map((c) => ({ instanceId: c.instanceId, baseCard: c.baseCard, source: 'deck' as const }));
  if (candidates.length === 0) {
    log.push(`🥚 ${egg.card.baseCard.name} éclot… mais aucun Drakon ne répond`);
    return;
  }
  queueChoice(game, {
    forUserId: owner.userId,
    candidates,
    count: 1,
    prompt: 'Choisis le Drakon qui éclot',
    resolution: 'summon_to_zone',
    zoneIndex,
  });
  log.push(`🥚 ${egg.card.baseCard.name} éclot !`);
}
```

(vérifier la signature de `queueChoice` dans `helpers/game-state.helper.ts` et l'adapter si elle diffère.)

`effects/effect-actions.applier.ts` : importer `hatchEgg` et `queueChoice`, puis :

```ts
      case ActionType.SET_HATCH_COUNTER:
        for (const m of targets.monsters) {
          m.hatchCounter = action.value ?? 2;
          m.hatchStage = action.filter?.stage;
          ctx.log.push(`🥚 ${m.card.baseCard.name} éclora dans ${m.hatchCounter} tour(s)`);
        }
        break;

      case ActionType.ADVANCE_HATCH:
        for (const m of targets.monsters) {
          if (m.hatchCounter === undefined) continue;
          m.hatchCounter -= action.value ?? 1;
          if (m.hatchCounter <= 0)
            hatchEgg(ctx.game, targets.ownerOfMonster(m), m, ctx.log);
        }
        break;

      case ActionType.SUMMON_FROM_DECK:
        for (const p of targets.players) {
          const candidates = pickCandidates(action, p);
          if (candidates.length === 0) continue;
          const zone = ctx.sourceMonster
            ? p.monsterZones.indexOf(ctx.sourceMonster)
            : -1;
          queueChoice(ctx.game, {
            forUserId: p.userId,
            candidates,
            count: 1,
            prompt: 'Choisis la carte à invoquer',
            resolution: 'summon_to_zone',
            zoneIndex: zone === -1 ? undefined : zone,
          });
        }
        break;
```

`services/phase.service.ts`, `startTurn`, juste après `this.processTurnCounters(game, player, log);` :

```ts
    for (const m of [...player.monsterZones]) {
      if (!m || m.hatchCounter === undefined) continue;
      m.hatchCounter -= 1;
      if (m.hatchCounter <= 0) hatchEgg(game, player, m, log);
    }
```

`services/summon.service.ts` : ajouter la méthode publique

```ts
  /** Invocation gratuite d'une carte (éclosion, invocation depuis le deck). */
  summonFromDeck(
    game: GameState,
    owner: PlayerGameState,
    card: CardInstance,
    preferredZone?: number,
  ): boolean {
    const zone =
      preferredZone !== undefined && !owner.monsterZones[preferredZone]
        ? preferredZone
        : owner.monsterZones.findIndex((z) => z === null);
    if (zone === -1) return false;
    const monster = createMonsterOnBoard(card);
    owner.monsterZones[zone] = monster;
    game.pendingEvents.push({
      kind: 'monster_summoned',
      ownerId: owner.userId,
      zoneIndex: zone,
      instanceId: monster.instanceId,
      rarity: card.baseCard.rarity,
    });
    addLog(game, `✨ ${card.baseCard.name} est invoqué gratuitement`);
    const log: string[] = [];
    this.effectsResolver.resolve(card, EffectTrigger.ON_SUMMON, {
      game,
      ownerUserId: owner.userId,
      sourceMonster: monster,
      log,
    });
    log.forEach((l) => addLog(game, l));
    return true;
  }
```

(importer `PlayerGameState`, `CardInstance`.)

`services/pick.service.ts` : constructeur `constructor(private summon: SummonService) {}` ; dans `pickCards`, avant
le `else` de `pick_to_hand` :

```ts
    } else if (choice.resolution === 'summon_to_zone') {
      for (const id of picked) {
        const idx = player.deck.findIndex((c) => c.instanceId === id);
        if (idx === -1) continue;
        const [card] = player.deck.splice(idx, 1);
        if (!this.summon.summonFromDeck(game, player, card, choice.zoneIndex)) {
          player.deck.push(card);
          addLog(game, `💨 Aucune zone libre : ${card.baseCard.name} reste dans le deck`);
        }
      }
      shuffle(player.deck);
```

`testing/engine.ts` : créer `const summon = new SummonService(effects);` et passer `new PickService(summon)` (et
`summon` à la place de `new SummonService(effects)`).

- [ ] **Step 3 : vérifier et commit**

Run : `pnpm --filter @pipou/backend test && pnpm --filter @pipou/backend typecheck && pnpm --filter @pipou/backend lint`
Expected : PASS (dont `choices.spec.ts`, `effects-coverage.spec.ts`).

```bash
git add apps/backend/src
git commit -m "feat(fights): egg hatching and summon from deck

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6 : Données du set et migration `DrakonSet`

**Files :**
- Create : `apps/backend/src/database/drakon-set-patches.ts`, `apps/backend/src/database/drakon-set-patches.spec.ts`,
  `apps/backend/src/database/migrations/1791000000006-DrakonSet.ts`, `apps/backend/src/fights/engine/drakon-cards.spec.ts`
- Modify : `apps/backend/src/fights/testing/real-cards.ts`

**Interfaces :**
- Consumes : tout ce qui précède ; `canonicalEffects`, `PatchDecision` (`database/card-effect-patches.ts`).
- Produces : `DRAKON_PATCHES: DrakonPatch[]`, `DRAKON_NEW_CARDS: DrakonNewCard[]`,
  `planDrakonPatch(current, patch, direction): PatchDecision`.

- [ ] **Step 1 : données**

Créer `drakon-set-patches.ts` :

```ts
import type {
  CardEffect,
  DrakonElement,
  DrakonStage,
  EffectAction,
  EffectCondition,
  Rarity,
} from '@pipou/shared';
import { canonicalEffects, type PatchDecision } from './card-effect-patches';

export interface DrakonFields {
  name: string;
  description: string | null;
  hp: number;
  effects: CardEffect[] | null;
  element: DrakonElement | null;
  lineage: string | null;
  stage: DrakonStage | null;
}

export interface DrakonPatch {
  before: DrakonFields;
  after: DrakonFields;
}

export interface DrakonNewCard {
  name: string;
  rarity: Rarity;
  cost: number;
  hp: number;
  description: string;
  effects: CardEffect[];
}

const fx = (
  trigger: CardEffect['trigger'],
  actions: EffectAction[],
  condition: EffectCondition | null = null,
): CardEffect => ({ trigger, condition, actions });
const a = (
  type: EffectAction['type'],
  target: EffectAction['target'],
  extra: Partial<EffectAction> = {},
): EffectAction => ({ type, target, ...extra });

/** Carte Drakon de l'export (effets vides, sans élément) → nouvel état. */
const rework = (
  name: string,
  hp: number,
  oldDescription: string,
  after: Partial<DrakonFields> & Pick<DrakonFields, 'description' | 'effects'>,
): DrakonPatch => ({
  before: {
    name,
    description: oldDescription,
    hp,
    effects: null,
    element: null,
    lineage: null,
    stage: null,
  },
  after: {
    name,
    hp,
    element: null,
    lineage: null,
    stage: null,
    ...after,
  },
});

export const DRAKON_PATCHES: DrakonPatch[] = [
  rework('Œuf de la Gènese', 0, "Que peut-il bien se cacher à l'intérieur de cet Œuf ?", {
    name: 'Œuf de la Genèse',
    hp: 300,
    stage: 'egg',
    description:
      "Un œuf ancestral. Un Jeune Drakon de n'importe quel élément peut éclore directement de lui ; sinon, après 2 tours, il donne naissance au Bébé Drakon de ton choix.",
    effects: [
      fx('ON_SUMMON', [a('SET_HATCH_COUNTER', 'SELF', { value: 2, filter: { stage: 'baby' } })]),
      fx('PASSIVE', [a('EVOLUTION_JOKER', 'SELF')]),
    ],
  }),
  rework('Bébé Teros', 1000, 'Petit mur de pierre.', {
    element: 'earth', lineage: 'teros', stage: 'baby',
    description: 'Petit mur de pierre. Provocation.',
    effects: [fx('ON_SUMMON', [a('SET_TAUNT', 'SELF')])],
  }),
  rework('Jeune Teros', 1800, 'Rocaille résistante.', {
    element: 'earth', lineage: 'teros', stage: 'young',
    description: 'Rocaille résistante. Provocation, dégâts reçus divisés par 2.',
    effects: [
      fx('ON_SUMMON', [a('SET_TAUNT', 'SELF')]),
      fx('PASSIVE', [a('SET_DAMAGE_REDUCTION', 'SELF', { value: 2 })]),
    ],
  }),
  rework('Adulte Teros', 3000, 'La montagne vivante.', {
    element: 'earth', lineage: 'teros', stage: 'adult',
    description:
      'La montagne vivante. Provocation, dégâts reçus divisés par 2, insensible aux effets adverses.',
    effects: [
      fx('ON_SUMMON', [a('SET_TAUNT', 'SELF'), a('SET_DEBUFF_IMMUNITY', 'SELF')]),
      fx('PASSIVE', [a('SET_DAMAGE_REDUCTION', 'SELF', { value: 2 })]),
    ],
  }),
  rework('Bébé Feros', 400, 'Petite braise.', {
    element: 'fire', lineage: 'feros', stage: 'baby',
    description: 'Petite braise. À son arrivée, inflige 100 dégâts à tous les monstres adverses.',
    effects: [fx('ON_SUMMON', [a('DEAL_DAMAGE', 'ALL_ENEMIES', { value: 100 })])],
  }),
  rework('Jeune Feros', 900, 'Flamme vive.', {
    element: 'fire', lineage: 'feros', stage: 'young',
    description: 'Flamme vive. Attaque Perçante.',
    effects: [fx('ON_SUMMON', [a('SET_PIERCING', 'SELF')])],
  }),
  rework('Adulte Feros', 1400, 'Incendie dévastateur.', {
    element: 'fire', lineage: 'feros', stage: 'adult',
    description:
      'Incendie dévastateur. Attaque Perçante ; à son arrivée, inflige 400 dégâts à tous les monstres adverses.',
    effects: [
      fx('ON_SUMMON', [a('SET_PIERCING', 'SELF'), a('DEAL_DAMAGE', 'ALL_ENEMIES', { value: 400 })]),
    ],
  }),
  rework('Bébé Tempestu', 500, 'Brise légère.', {
    element: 'wind', lineage: 'tempestu', stage: 'baby',
    description: 'Brise légère. Peut évoluer dès le tour où il est posé.',
    effects: [fx('PASSIVE', [a('INSTANT_EVOLUTION', 'SELF')])],
  }),
  rework('Jeune Tempestu', 1000, 'Tourbillon gênant.', {
    element: 'wind', lineage: 'tempestu', stage: 'young',
    description:
      'Tourbillon gênant. Peut évoluer dès son arrivée ; tes autres monstres peuvent évoluer sans attendre ce tour.',
    effects: [
      fx('PASSIVE', [a('INSTANT_EVOLUTION', 'SELF')]),
      fx('ON_SUMMON', [a('ALLOW_EVOLUTION_THIS_TURN', 'ALLIES_EXCEPT_SELF')]),
    ],
  }),
  rework('Adulte Tempestu', 1600, 'Ouragan de contrôle.', {
    element: 'wind', lineage: 'tempestu', stage: 'adult',
    description:
      'Ouragan de contrôle. Attaque 2 fois par tour ; à son arrivée, renvoie en main le monstre adverse le plus fort.',
    effects: [
      fx('PASSIVE', [a('SET_ATTACKS_PER_TURN', 'SELF', { value: 2 })]),
      fx('ON_SUMMON', [a('RETURN_TO_HAND', 'STRONGEST_ENEMY')]),
    ],
  }),
  rework('Bébé Ackos', 600, 'Goutte de vie.', {
    element: 'water', lineage: 'ackos', stage: 'baby',
    description: 'Goutte de vie. Au début de ton tour, soigne tes autres monstres de 100 PV.',
    effects: [fx('ON_TURN_START', [a('HEAL', 'ALLIES_EXCEPT_SELF', { value: 100 })])],
  }),
  rework('Jeune Ackos', 1200, 'Source pure.', {
    element: 'water', lineage: 'ackos', stage: 'young',
    description: 'Source pure. À son arrivée, récupère un Drakon de ton cimetière.',
    effects: [
      fx('ON_SUMMON', [a('RETURN_FROM_GRAVEYARD', 'PLAYER', { value: 1, filter: { archetype: 'dragon' } })]),
    ],
  }),
  rework('Adulte Ackos', 2200, 'Océan de soin.', {
    element: 'water', lineage: 'ackos', stage: 'adult',
    description:
      'Océan de soin. Au début de ton tour, soigne tes autres monstres de 300 PV ; à son arrivée, récupère 2 cartes de ton cimetière.',
    effects: [
      fx('ON_TURN_START', [a('HEAL', 'ALLIES_EXCEPT_SELF', { value: 300 })]),
      fx('ON_SUMMON', [a('RETURN_FROM_GRAVEYARD', 'PLAYER', { value: 2 })]),
    ],
  }),
  rework('Incubation Rapide', 0, "Accélère l'éclosion.", {
    description:
      "Accélère l'éclosion d'un de tes Œufs de 2 tours, ou permet à un de tes Drakons d'évoluer ce tour.",
    effects: [
      fx('ON_PLAY', [
        a('ADVANCE_HATCH', 'TARGET_ALLY', { value: 2 }),
        a('ALLOW_EVOLUTION_THIS_TURN', 'TARGET_ALLY'),
      ]),
    ],
  }),
  rework('Ecaille de Dragon', 400, 'Protection naturelle.', {
    name: 'Écaille de Dragon',
    description:
      'Protection naturelle. Dégâts reçus divisés par 2 ; sur un Œuf, il devient insensible aux effets adverses.',
    effects: [
      fx('PASSIVE', [a('SET_DAMAGE_REDUCTION', 'SELF', { value: 2 })]),
      fx('PASSIVE', [a('SET_DEBUFF_IMMUNITY', 'SELF')], { type: 'EQUIPPED_ON', stage: 'egg' }),
    ],
  }),
  rework('Bouclier de Fortune', 0, 'Protection de fortune.', {
    description: 'Un de tes monstres est insensible aux dégâts de combat jusqu\'à ton prochain tour.',
    effects: [fx('ON_PLAY', [a('SET_COMBAT_IMMUNITY', 'TARGET_ALLY')])],
  }),
  rework('Potion de Lucidité', 0, 'Simple et efficace.', {
    description: 'Cherche un Drakon ou un Œuf dans ton deck.',
    effects: [fx('ON_PLAY', [a('SEARCH_DECK', 'PLAYER', { filter: { archetype: 'dragon' } })])],
  }),
  rework('Souffle Primordial', 0, 'Puissance élémentaire.', {
    description: 'Tes Drakons gagnent +300 ATK ce tour, +600 si tu contrôles un Drakon Adulte.',
    effects: [
      fx('ON_PLAY', [
        a('BUFF_ATK_TEMP', 'ARCHETYPE_ALLIES', {
          value: 300,
          archetype: 'dragon',
          valueIf: { condition: { type: 'DRAKON_ON_BOARD', stage: 'adult' }, value: 600 },
        }),
      ]),
    ],
  }),
  rework('Frappe Préventive', 0, 'Premier coup.', {
    description: 'Inflige 300 dégâts à un monstre adverse, 600 si tu contrôles un Drakon de Feu.',
    effects: [
      fx('ON_PLAY', [
        a('DEAL_DAMAGE', 'ENEMY_MONSTER', {
          value: 300,
          valueIf: { condition: { type: 'DRAKON_ON_BOARD', element: 'fire' }, value: 600 },
        }),
      ]),
    ],
  }),
];

export const DRAKON_NEW_CARDS: DrakonNewCard[] = [
  {
    name: 'Œuf de la Dualité',
    rarity: 'epic',
    cost: 1,
    hp: 300,
    description:
      "Deux destins dans une coquille. S'il est détruit, un Jeune Drakon de ton choix surgit ; s'il survit 2 tours, il éclot en Bébé Drakon.",
    effects: [
      fx('ON_SUMMON', [a('SET_HATCH_COUNTER', 'SELF', { value: 2, filter: { stage: 'baby' } })]),
      fx('ON_DEATH', [a('SUMMON_FROM_DECK', 'PLAYER', { filter: { stage: 'young' } })]),
    ],
  },
  {
    name: 'Œuf Céleste',
    rarity: 'legendary',
    cost: 2,
    hp: 600,
    description:
      'Couvé par les étoiles. Après 4 tours, il éclot directement en Drakon Adulte de ton choix. À protéger à tout prix.',
    effects: [fx('ON_SUMMON', [a('SET_HATCH_COUNTER', 'SELF', { value: 4, filter: { stage: 'adult' } })])],
  },
];

function fingerprint(f: {
  name: string;
  description: string | null;
  hp: number;
  effects: unknown;
  element: string | null;
  lineage: string | null;
  stage: string | null;
}): string {
  return JSON.stringify([
    f.name,
    f.description ?? null,
    Number(f.hp),
    canonicalEffects(f.effects ?? null),
    f.element ?? null,
    f.lineage ?? null,
    f.stage ?? null,
  ]);
}

/** Même garde que planCardRework, champs Drakon inclus. */
export function planDrakonPatch(
  current: Parameters<typeof fingerprint>[0] | undefined,
  patch: DrakonPatch,
  direction: 'up' | 'down',
): PatchDecision {
  if (!current) return 'skip-diverged';
  const [from, to] =
    direction === 'up' ? [patch.before, patch.after] : [patch.after, patch.before];
  const actual = fingerprint(current);
  if (actual === fingerprint(to)) return 'already-done';
  if (actual === fingerprint(from)) return 'apply';
  return 'skip-diverged';
}
```

Notes : `hp` « before » = PV de l'export de prod (supports : 0 sauf Écaille 400). Les types littéraux
(`'ON_SUMMON'`, `'egg'`…) peuvent exiger un `as const` ou les constantes (`EffectTrigger.ON_SUMMON`…) selon la
configuration TS : préférer les constantes importées de `@pipou/shared` si le littéral est refusé.

- [ ] **Step 2 : migration**

Créer `1791000000006-DrakonSet.ts` :

```ts
import { Logger } from '@nestjs/common';
import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  DRAKON_NEW_CARDS,
  DRAKON_PATCHES,
  planDrakonPatch,
} from '../drakon-set-patches';

/** Set Drakon (spec 2026-10-17-drakon-set) : 19 cartes mises à jour, 2 œufs créés. */
export class DrakonSet1791000000006 implements MigrationInterface {
  name = 'DrakonSet1791000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const logger = new Logger('DrakonSet');
    await applyPatches(queryRunner, 'up', logger);
    const [ref] = (await queryRunner.query(
      'SELECT `card_set_id` FROM `card` WHERE `name` = ?',
      ['Bébé Teros'],
    )) as { card_set_id: number }[];
    if (!ref) {
      logger.warn('Bébé Teros introuvable : œufs non créés');
      return;
    }
    for (const c of DRAKON_NEW_CARDS) {
      const exists = (await queryRunner.query(
        'SELECT `id` FROM `card` WHERE `name` = ?',
        [c.name],
      )) as unknown[];
      if (exists.length > 0) continue;
      await queryRunner.query(
        'INSERT INTO `card` (`name`, `rarity`, `type`, `atk`, `hp`, `cost`, `archetype`, `effects`, `description`, `card_set_id`, `stage`) VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)',
        [c.name, c.rarity, 'monster', c.hp, c.cost, 'dragon', JSON.stringify(c.effects), c.description, ref.card_set_id, 'egg'],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const logger = new Logger('DrakonSet');
    for (const c of DRAKON_NEW_CARDS) {
      const rows = (await queryRunner.query(
        'SELECT `id` FROM `card` WHERE `name` = ?',
        [c.name],
      )) as { id: number }[];
      for (const { id } of rows) {
        const [{ used }] = (await queryRunner.query(
          'SELECT (SELECT COUNT(*) FROM `user_card` WHERE `card_id` = ?) + (SELECT COUNT(*) FROM `booster_open_card` WHERE `card_id` = ?) + (SELECT COUNT(*) FROM `bundle_content` WHERE `card_id` = ?) AS used',
          [id, id, id],
        )) as { used: number | string }[];
        if (Number(used) > 0) {
          logger.warn(`« ${c.name} » est référencée : non supprimée`);
          continue;
        }
        await queryRunner.query('DELETE FROM `card` WHERE `id` = ?', [id]);
      }
    }
    await applyPatches(queryRunner, 'down', logger);
  }
}

async function applyPatches(
  queryRunner: QueryRunner,
  direction: 'up' | 'down',
  logger: Logger,
): Promise<void> {
  for (const patch of DRAKON_PATCHES) {
    const [from, to] =
      direction === 'up' ? [patch.before, patch.after] : [patch.after, patch.before];
    const rows = (await queryRunner.query(
      'SELECT `id`, `name`, `description`, `hp`, `effects`, `element`, `lineage`, `stage` FROM `card` WHERE `name` IN (?, ?)',
      [from.name, to.name],
    )) as {
      id: number;
      name: string;
      description: string | null;
      hp: number;
      effects: unknown;
      element: string | null;
      lineage: string | null;
      stage: string | null;
    }[];
    const current = rows.find((r) => r.name === from.name || r.name === to.name);
    const decision = planDrakonPatch(current, patch, direction);
    if (decision === 'apply' && current) {
      await queryRunner.query(
        'UPDATE `card` SET `name` = ?, `description` = ?, `hp` = ?, `effects` = ?, `element` = ?, `lineage` = ?, `stage` = ? WHERE `id` = ?',
        [
          to.name,
          to.description,
          to.hp,
          to.effects === null ? null : JSON.stringify(to.effects),
          to.element,
          to.lineage,
          to.stage,
          current.id,
        ],
      );
    } else if (decision === 'skip-diverged') {
      logger.warn(
        `Carte « ${from.name} » : absente ou différente de l'attendu, non modifiée — à corriger via l'admin`,
      );
    }
  }
}
```

(Vérifier dans `InitSchema` que les colonnes s'appellent bien `card_id` dans `user_card`, `booster_open_card`,
`bundle_content` — c'est le cas à la date du plan.)

- [ ] **Step 3 : vraies cartes**

`fights/testing/real-cards.ts` : dans `allRealCards`, après l'application des patchs `CARD_REWORK_PATCHES`, appliquer
`DRAKON_PATCHES` (par `before.name`, en recopiant `name`, `description`, `hp`, `effects`, `element`, `lineage`,
`stage`), puis ajouter les cartes de `DRAKON_NEW_CARDS` :

```ts
  const drakonSet = cards.find((c) => c.name === 'Bébé Teros')?.cardSet;
  const created = DRAKON_NEW_CARDS.map(
    (c, i) =>
      ({
        id: 90_001 + i,
        name: c.name,
        rarity: c.rarity,
        type: 'monster',
        atk: 0,
        hp: c.hp,
        cost: c.cost,
        supportType: null,
        archetype: 'dragon',
        effects: c.effects,
        description: c.description,
        element: null,
        lineage: null,
        stage: 'egg',
        image: null,
        cardSet: drakonSet,
      }) as Card,
  );
  return [...cards, ...created];
```

- [ ] **Step 4 : tests (patchs + vraies cartes)**

`drakon-set-patches.spec.ts` :

```ts
import { DRAKON_PATCHES, DRAKON_NEW_CARDS, planDrakonPatch } from './drakon-set-patches';
import { canonicalEffects } from './card-effect-patches';
import { allRealCardsBeforeRework } from '../fights/testing/real-cards';

describe('drakon-set-patches', () => {
  it('chaque « before » correspond à l’instantané (export de prod)', () => {
    const cards = allRealCardsBeforeRework();
    for (const p of DRAKON_PATCHES) {
      const card = cards.find((c) => c.name === p.before.name);
      expect({
        name: p.before.name,
        description: card?.description ?? null,
        hp: card?.hp,
        effects: canonicalEffects(card?.effects ?? null),
      }).toEqual({
        name: p.before.name,
        description: p.before.description,
        hp: p.before.hp,
        effects: canonicalEffects(p.before.effects),
      });
    }
  });

  it.each(DRAKON_PATCHES.map((p) => [p.before.name, p] as const))('%s : up puis down', (_n, p) => {
    expect(planDrakonPatch(p.before, p, 'up')).toBe('apply');
    expect(planDrakonPatch(p.after, p, 'up')).toBe('already-done');
    expect(planDrakonPatch(p.after, p, 'down')).toBe('apply');
    expect(planDrakonPatch({ ...p.before, description: 'modifiée' }, p, 'up')).toBe('skip-diverged');
  });

  it('les 2 œufs créés sont des œufs Drakon', () => {
    expect(DRAKON_NEW_CARDS.map((c) => c.name)).toEqual(['Œuf de la Dualité', 'Œuf Céleste']);
  });
});
```

`fights/engine/drakon-cards.spec.ts` (vraies cartes ; `recycleEnergy` suffisant pour les coûts) :

```ts
import { createEngine } from '../testing/engine';
import { monsterCard } from '../testing/cards';
import { realCard } from '../testing/real-cards';
import { handNames, monsterNamed, passTurn, scenario } from '../testing/scenario';

describe('cartes Drakon', () => {
  const engine = createEngine();

  it('Bébé → Jeune Feros, puis délai avant l’Adulte', () => {
    const game = scenario({
      p1: {
        hand: [realCard('Jeune Feros'), realCard('Adulte Feros')],
        monsters: [realCard('Bébé Feros')],
        recycleEnergy: 3,
      },
      p2: { monsters: [monsterCard('Cible', { hp: 3000 })] },
    });
    const evolveTo = (target: string) =>
      engine.dispatch(game, 'p1', {
        type: 'evolve',
        handIndex: 0,
        targetInstanceId: monsterNamed(game, 'p1', target).instanceId,
        paymentHandIndices: [],
      });
    expect(evolveTo('Bébé Feros')).toEqual({});
    expect(evolveTo('Jeune Feros').error).toBe("Jeune Feros doit attendre un tour avant d'évoluer");
  });

  it('Adulte Tempestu renvoie le monstre adverse le plus fort', () => {
    const game = scenario({
      p1: { hand: [realCard('Adulte Tempestu')], monsters: [realCard('Jeune Tempestu')], recycleEnergy: 3 },
      p2: { monsters: [monsterCard('Faible', { atk: 100 }), monsterCard('Fort', { atk: 900 })] },
    });
    engine.dispatch(game, 'p1', {
      type: 'evolve',
      handIndex: 0,
      targetInstanceId: monsterNamed(game, 'p1', 'Jeune Tempestu').instanceId,
      paymentHandIndices: [],
    });
    expect(handNames(game, 'p2')).toContain('Fort');
  });

  it('Œuf Céleste : éclot en Adulte après 4 tours', () => {
    const game = scenario({
      p1: { hand: [realCard('Œuf Céleste')], deck: [monsterCard('A'), monsterCard('B'), monsterCard('C'), monsterCard('D'), monsterCard('E'), realCard('Adulte Teros')], recycleEnergy: 3 },
    });
    engine.dispatch(game, 'p1', { type: 'summon', handIndex: 0, zoneIndex: 0, paymentHandIndices: [] });
    for (let i = 0; i < 8 && game.pendingChoices.length === 0; i++) passTurn(engine, game);
    expect(game.pendingChoices[0]?.candidates.map((c) => c.baseCard.name)).toEqual(['Adulte Teros']);
  });

  it('Œuf de la Genèse : joker pour un Jeune Ackos', () => {
    const game = scenario({
      p1: { hand: [realCard('Jeune Ackos')], monsters: [realCard('Œuf de la Genèse')], recycleEnergy: 3 },
    });
    engine.settle(game);
    expect(
      engine.dispatch(game, 'p1', {
        type: 'evolve',
        handIndex: 0,
        targetInstanceId: monsterNamed(game, 'p1', 'Œuf de la Genèse').instanceId,
        paymentHandIndices: [],
      }),
    ).toEqual({});
  });
});
```

Run : `pnpm --filter @pipou/backend test -- drakon` → PASS (si un « before » échoue, signaler l'écart exact sans
modifier `before` : il doit correspondre à la prod).

- [ ] **Step 5 : vérifier et commit**

Run : `pnpm --filter @pipou/backend test && pnpm --filter @pipou/backend typecheck && pnpm --filter @pipou/backend lint`
Expected : PASS (dont `effects-coverage` : chaque vraie carte, y compris les œufs, se joue sans erreur).

```bash
git add apps/backend/src
git commit -m "feat(db): DrakonSet migration (19 cards reworked, 2 eggs added)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7 : Front — icônes SVG, pastille d'élément, statuts, admin

**Files :**
- Modify : `apps/frontend/src/components/Icons.tsx`, `apps/frontend/src/features/cards/CardFace.tsx` (+ `.css`),
  `apps/frontend/src/features/fight/BuffDebuffSections.tsx`, `apps/frontend/src/features/fight/Zonerow/zoneRow.effects.ts`,
  `apps/frontend/src/features/fight/FightRules.tsx`, `apps/frontend/src/features/fight/CardEffectSheet.tsx`,
  `apps/frontend/src/features/cards/CardManager.tsx`, `apps/frontend/src/i18n/locales/{fr,en,ko}.json`
- Create : `apps/frontend/src/features/fight/KeywordIcon.tsx`
- Test : `apps/frontend/src/__tests__/components/CardFace.test.tsx`, `apps/frontend/src/__tests__/unit/zoneRow.effects.test.ts`

**Interfaces :**
- Consumes : `ClientCard.element`, `MonsterOnBoard.hatchCounter/canEvolveThisTurn/evolutionJoker/instantEvolution`,
  mots-clés `hatch`, `evolutionJoker`, `instantEvolution` (Task 1).
- Produces : `IconEarth`, `IconWind`, `IconWater`, `IconEgg`, `IconEvolve`, `IconJoker` ;
  `<KeywordIcon id={KeywordId} size?={number} />` ; `BuffEntry.icon: ReactNode`.

- [ ] **Step 1 : tests (échouent)**

`CardFace.test.tsx` :

```tsx
  it("affiche la pastille d'élément d'un Drakon", () => {
    render(
      <CardFace
        card={{ id: 1, name: "Bébé Feros", rarity: "uncommon", type: "monster", atk: 400, hp: 400, element: "fire" }}
        size="md"
      />,
    );
    expect(screen.getByRole("img", { name: /feu|fire/i })).toBeInTheDocument();
  });
```

`zoneRow.effects.test.ts` :

```ts
  it("statuts Drakon", () => {
    const labels = getMonsterStatusEntries(
      monster({ hatchCounter: 2, canEvolveThisTurn: true, evolutionJoker: true, instantEvolution: true }),
      t,
    ).map((e) => e.label);
    expect(labels).toEqual(
      expect.arrayContaining([
        fr.keywords.evolutionJoker.name,
        fr.keywords.instantEvolution.name,
        "Éclot dans 2 tours",
        "Peut évoluer ce tour",
      ]),
    );
  });
```

Run : `pnpm --filter @pipou/frontend test CardFace zoneRow.effects` → FAIL.

- [ ] **Step 2 : icônes**

Ajouter à `Icons.tsx`, au format des icônes existantes (même signature `IconProps`, `viewBox="0 0 24 24"`,
`fill="none"`, trait `stroke={color}` `strokeWidth="2"` `strokeLinecap="round"` `strokeLinejoin="round"`) :

```tsx
export function IconEarth({ size = 24, color = "currentColor", className, style }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <path d="M3 19L9 8L13 14L16 10L21 19H3Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconWind({ size = 24, color = "currentColor", className, style }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <path d="M3 8H14A3 3 0 1 0 11 5M3 12H19A3 3 0 1 1 16 15M3 16H10" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconWater({ size = 24, color = "currentColor", className, style }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <path d="M12 3C12 3 6 10 6 14A6 6 0 0 0 18 14C18 10 12 3 12 3Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconEgg({ size = 24, color = "currentColor", className, style }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <path d="M12 3C8.5 3 5.5 9 5.5 14A6.5 6.5 0 0 0 18.5 14C18.5 9 15.5 3 12 3Z" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      <path d="M8 13L10 11L12 13L14 11L16 13" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconEvolve({ size = 24, color = "currentColor", className, style }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <path d="M12 20V8M7 12L12 7L17 12M7 5H17" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconJoker({ size = 24, color = "currentColor", className, style }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <path d="M12 3L14.5 9H21L15.8 12.8L17.8 19L12 15.2L6.2 19L8.2 12.8L3 9H9.5L12 3Z" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
```

(`IconFire` existe déjà.) Puis passer le fichier au formateur (`npx prettier --write`).

- [ ] **Step 3 : `KeywordIcon` et statuts**

Créer `features/fight/KeywordIcon.tsx` :

```tsx
import { IconEgg, IconEvolve, IconJoker } from "../../components/Icons";
import { KEYWORD_ICON, type KeywordId } from "./effectText";

const SVG_KEYWORDS: Partial<Record<KeywordId, typeof IconEgg>> = {
  hatch: IconEgg,
  evolutionJoker: IconJoker,
  instantEvolution: IconEvolve,
};

/** Icône d'un mot-clé : SVG pour les mots-clés récents, symbole historique sinon. */
export default function KeywordIcon({ id, size = 14 }: { id: KeywordId; size?: number }) {
  const Svg = SVG_KEYWORDS[id];
  if (Svg) return <Svg size={size} />;
  return <>{KEYWORD_ICON[id]}</>;
}
```

- `BuffDebuffSections.tsx` : `BuffEntry.icon: ReactNode` (au lieu de `string`).
- `FightRules.tsx` et `CardEffectSheet.tsx` : remplacer chaque affichage `{KEYWORD_ICON[id]}` (ou équivalent) par
  `<KeywordIcon id={id} />`.
- `zoneRow.effects.ts` → renommer en `zoneRow.effects.tsx` si du JSX y devient nécessaire (mettre à jour les imports),
  puis ajouter après les statuts existants :

```tsx
  if (zone.hatchCounter !== undefined && zone.hatchCounter > 0)
    entries.push({
      icon: <IconEgg size={14} />,
      label: t("effects.status.hatch", { count: zone.hatchCounter }),
      type: "neutral",
    });
  if (zone.canEvolveThisTurn)
    entries.push({ icon: <IconEvolve size={14} />, label: t("effects.status.canEvolve"), type: "buff" });
  if (zone.evolutionJoker)
    entries.push({ icon: <KeywordIcon id="evolutionJoker" />, label: t("keywords.evolutionJoker.name"), type: "buff" });
  if (zone.instantEvolution)
    entries.push({ icon: <KeywordIcon id="instantEvolution" />, label: t("keywords.instantEvolution.name"), type: "buff" });
```

- i18n `effects.status` : fr `"hatch_one": "Éclot dans {{count}} tour"`, `"hatch_other": "Éclot dans {{count}} tours"`,
  `"canEvolve": "Peut évoluer ce tour"` ; en `"Hatches in {{count}} turn"` / `"turns"`, `"Can evolve this turn"` ;
  ko `"hatch_other": "{{count}}턴 후 부화"`, `"canEvolve": "이번 턴 진화 가능"`.

- [ ] **Step 4 : pastille d'élément**

`CardFace.tsx` : `CardFaceCard` accepte `element?: DrakonElement | null`. Ajouter, dans l'en-tête de la carte (à
côté du coût), quand `card.element` est renseigné :

```tsx
const ELEMENT_ICON = { earth: IconEarth, fire: IconFire, wind: IconWind, water: IconWater } as const;
// …
{card.element && (() => {
  const Icon = ELEMENT_ICON[card.element];
  return (
    <span
      className={`card-face__element card-face__element--${card.element}`}
      role="img"
      aria-label={t(`effects.element.${card.element}`)}
    >
      <Icon size={size === "xs" ? 10 : 14} />
    </span>
  );
})()}
```

(si `CardFace` n'a pas `useTranslation`, l'ajouter ; ne pas déclarer de composant dans le composant : l'IIFE ci-dessus
est une expression, ou extraire une fonction de module `elementBadge(element, size, t)`.)

`CardFace.css` :

```css
.card-face__element {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  color: #fff;
}
.card-face__element--earth { background: #8d6e4a; }
.card-face__element--fire { background: #d9482b; }
.card-face__element--wind { background: #4fa3a5; }
.card-face__element--water { background: #3a78c9; }
```

- [ ] **Step 5 : admin**

`CardManager.tsx` : dans le formulaire (même motif que le `<select>` de rareté), ajouter un `<select>` « Élément »
(vide + 4 valeurs de `DrakonElement`), un `<input>` « Lignée » (texte, 50 max) et un `<select>` « Stade » (vide + 4
valeurs de `DrakonStage`). La valeur vide n'envoie pas le champ. Pré-remplir à l'édition depuis la carte.

- [ ] **Step 6 : vérifier et commit**

Run : `pnpm --filter @pipou/frontend test && pnpm --filter @pipou/frontend lint && pnpm --filter @pipou/frontend typecheck`
Expected : PASS.

```bash
git add apps/frontend/src
git commit -m "feat(front): Drakon element badge, SVG keyword icons, statuses and admin fields

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8 : Front — flux d'évolution sur le plateau

**Files :**
- Modify : `apps/frontend/src/features/fight/useBoardControls.ts`, `apps/frontend/src/features/fight/FightBoard.tsx`,
  `apps/frontend/src/features/fight/FightActionBar.tsx`, `apps/frontend/src/features/fight/SummonCostModal.tsx`,
  `apps/frontend/src/features/fight/Zonerow/useZoneAnimations.ts`, `apps/frontend/src/features/fight/CardPickModal.tsx`
  (ou l'appelant de `pendingChoice` dans `FightPage.tsx` / `SandboxPage.tsx`)
- Test : `apps/frontend/src/__tests__/unit/useBoardControls.test.ts`, `apps/frontend/src/__tests__/components/ZoneRow.test.tsx`

**Interfaces :**
- Consumes : `canEvolveOnto`, `canEvolveNow`, `evolutionCost` (shared), `GameAction` `evolve`.
- Produces : `board.onEvolve(targetInstanceId: string, paymentIndices?: number[])` dans `useBoardControls`.

- [ ] **Step 1 : tests (échouent)**

`useBoardControls.test.ts` (sur le modèle des tests existants du fichier) : avec une carte sélectionnée en main,
`result.current.board.onEvolve("m1", [2])` envoie
`{ type: "evolve", handIndex: <sélection>, targetInstanceId: "m1", paymentHandIndices: [2] }` et vide la sélection.

`ZoneRow.test.tsx` : remplacement d'un monstre par un autre dans la même zone (évolution) :

```tsx
  it("évolution (autre monstre dans la même zone) : animation d'invocation", () => {
    const { container, rerender } = render(<ZoneRow label="M" zones={[monster()]} />);
    rerender(
      <ZoneRow label="M" zones={[monster({ instanceId: "m2" })]} fx={new Map([[0, { summonTier: 2 }]])} />,
    );
    expect(container.querySelector(".zr-zone")).toHaveClass("zr-zone--summon-t2");
  });
```

Run : `pnpm --filter @pipou/frontend test useBoardControls ZoneRow` → FAIL.

- [ ] **Step 2 : implémenter**

`useBoardControls.ts`, dans `board` :

```ts
      onEvolve: (targetInstanceId: string, paymentIndices: number[] = payIndices) => {
        if (selectedCard === null) return;
        send({
          type: "evolve",
          handIndex: selectedCard,
          targetInstanceId,
          paymentHandIndices: paymentIndices,
        });
        clearSelection();
      },
```

`useZoneAnimations.ts` : dans la boucle de comparaison, traiter `prev && zone && prev.instanceId !== zone.instanceId`
comme une invocation (même branche que `!prev && zone`, palier issu de `fx` ou de la rareté de `zone`).

`FightBoard.tsx` :
- `onEvolve` ajouté aux props (passé par `{...controls.board}`).
- `const evolvableTargets = selectedHandCard && selectedCard !== null ? gs.me.monsterZones.filter((m): m is MonsterOnBoard => !!m && canEvolveOnto(gs.me.hand[selectedCard].baseCard, m) && canEvolveNow(m)) : []` ;
- passer à la rangée « Mes Monstres » `highlightFilled={… || evolvableTargets.length > 0}` (surligne les monstres) ;
- dans `handleZoneClick` (phase `main`, carte sélectionnée) : si la zone contient un monstre de `evolvableTargets`,
  calculer `evolutionCost(...)` ; si `max(0, coût − recycleEnergy) > 0`, ouvrir `SummonCostModal` en mode évolution
  (état `evolveTargetId`), sinon appeler `onEvolve(target.instanceId, [])` ; ne pas sélectionner de zone.
- confirmation de la fenêtre de paiement : si `evolveTargetId` est défini, `onEvolve(evolveTargetId, payIndices)`.

`SummonCostModal.tsx` : prop optionnelle `costOverride?: number` (coût d'évolution) utilisée à la place de
`card.cost` ; titre « Évolution » quand elle est fournie.

`FightActionBar.tsx` : quand la carte sélectionnée a un `stage` young/adult et qu'au moins une cible d'évolution existe,
afficher l'indication « Touche un de tes monstres pour évoluer » (texte i18n `fight.evolveHint` fr/en/ko) avec
`<IconEvolve size={14} />`.

Fenêtre de choix : quand `pendingChoice.resolution === "summon_to_zone"`, le bouton de confirmation affiche
« Invoquer » (i18n `fight.summonPick`) au lieu du libellé de récupération.

- [ ] **Step 3 : vérifier et commit**

Run : `pnpm --filter @pipou/frontend test && pnpm --filter @pipou/frontend lint && pnpm --filter @pipou/frontend typecheck`
Expected : PASS.

```bash
git add apps/frontend/src
git commit -m "feat(front): evolve Drakons from the board

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9 : Base locale, vérification complète et visuelle

- [ ] **Step 1 : monorepo** — `pnpm build:shared && pnpm typecheck && pnpm test && pnpm lint && pnpm --filter @pipou/frontend build`
  et `pnpm --filter @pipou/backend exec tsc -p tsconfig.build.json --noEmit`. Expected : PASS (hors test flaky
  connu InboxWidget, à relancer seul).
- [ ] **Step 2 : base locale (jamais Aiven)** — le backend local en `synchronize` ajoute les colonnes au démarrage ;
  sinon appliquer `ALTER TABLE` de `DrakonColumns` par script gardé (refus si l'hôte n'est pas 127.0.0.1 ou la base
  n'est pas `cardcollect_dev`). Puis rejouer `DRAKON_PATCHES` + insertion des 2 œufs avec la logique exacte de la
  migration, par script gardé (même modèle que `apply-card-rework-local.ts` du scratchpad). Attendu : 19 `apply`,
  2 insertions.
- [ ] **Step 3 : visuel** — sandbox local, Playwright 430 px : fiche d'effets de chaque type de carte (un Œuf, un Bébé,
  un Adulte, un support), pastille d'élément, une évolution complète Bébé → Jeune (surbrillance des cibles, paiement,
  animation), une éclosion (fenêtre « Invoquer »), statuts (Éclot dans N tours, Peut évoluer, Joker). Aucun emoji
  ajouté dans ces écrans. Ne pas arrêter les serveurs de l'utilisateur.
