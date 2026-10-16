# Visuel des cartes en duel — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afficher en duel (main, terrain, modale de choix, cimetière, mulligan) le visuel de carte de la collection, adapté au combat, avec inspection par appui long.

**Architecture:** On extrait de `CardDisplay` un composant purement visuel `CardFace` (palette de rareté, en-tête, illustration, stats, états de combat). `CardDisplay` le rend dans sa couche 3D ; le duel l'utilise via `InspectableCard` (CardFace + hook `useLongPress`), qui ouvre `CardInspect` (grande carte + effets). Côté serveur, seuls les candidats de `pendingChoice` gagnent `cost`, `image`, `description`.

**Tech Stack:** React 18 + TypeScript strict, Vite, Vitest + Testing Library (jsdom 23), NestJS + Jest, `@pipou/shared`.

**Spec:** `docs/superpowers/specs/2026-10-16-duel-card-visuals-design.md`

## Global Constraints

- Tout type échangé front/back vit dans `@pipou/shared` ; après modification de `packages/shared` : `pnpm build:shared`.
- Front : pas de `any`, pas de composant déclaré dans un composant, état dérivé calculé au rendu (pas de `useEffect` qui recopie une valeur).
- Ne jamais lancer le backend, des migrations ou des e2e avec `apps/backend/.env` (il pointe sur la BDD de prod Aiven). Ce plan n'en a pas besoin : tests unitaires uniquement, vérification visuelle via une page Vite autonome.
- Textes d'interface en français.
- Couleurs : ATK/PV en hausse `#1e8f4e`, en baisse `#d63031` ; variantes rareté `secret` `#5ee08f` / `#ff7b7b` ; garde : voile `rgba(60,120,220,.35)`, bordure `#3c78dc`.
- Appui long : 400 ms, annulé au-delà de 8px de déplacement.
- Éventail : ±15° (30° au total).
- Commits : style `feat(fight): …`, terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Structure des fichiers

| Fichier | Rôle |
|---|---|
| `packages/shared/src/game/state.ts` | `ClientChoiceCandidate.baseCard` + `cost`, `image`, `description` |
| `apps/backend/src/fights/helpers/client-state.builder.ts` | recopie ces champs dans les candidats |
| `apps/frontend/src/features/cards/CardFace.tsx` / `.css` | recto de carte, visuel pur (nouveau) |
| `apps/frontend/src/features/cards/CardDisplay.tsx` / `.css` | garde 3D/flip/shine, rend `CardFace` |
| `apps/frontend/src/hooks/useLongPress.ts` | appui long pointer events (nouveau) |
| `apps/frontend/src/features/fight/fanLayout.ts` | géométrie de l'éventail (nouveau, fonction pure) |
| `apps/frontend/src/features/fight/BuffDebuffSections.tsx` / `.css` | liste d'effets en ligne (extraite de `BuffDebuffList`) |
| `apps/frontend/src/features/fight/CardInspect.tsx` / `.css` | overlay grande carte + effets (nouveau) |
| `apps/frontend/src/features/fight/InspectableCard.tsx` / `.css` | CardFace + appui long + clavier (nouveau) |
| `apps/frontend/src/features/fight/FightHand.tsx` / `.css` | main en éventail |
| `apps/frontend/src/features/fight/Zonerow/*` | zones avec `CardFace xs` |
| `CardPickModal`, `GraveyardPile`, `MulliganPanel` | grilles de `CardFace sm` |
| `BuffDebuffList.tsx` / `.css` | supprimés (tâche 7) |
| `apps/frontend/src/__tests__/fixtures/monster.ts` | fabrique de `MonsterOnBoard` pour les tests (nouveau, tâche 7) |

---

### Task 1: Candidats de choix avec coût, illustration et description

**Files:**
- Modify: `packages/shared/src/game/state.ts:23-30`
- Modify: `apps/backend/src/fights/helpers/client-state.builder.ts:17-27`
- Modify: `apps/frontend/src/features/fight/FightBoard.tsx:176-184`
- Test: `apps/backend/src/fights/helpers/client-state.builder.spec.ts` (nouveau)

**Interfaces:**
- Produces: `ClientChoiceCandidate.baseCard` de type `Pick<ClientCard, "id" | "name" | "type" | "atk" | "hp" | "rarity" | "supportType" | "cost" | "image" | "description">`.

- [ ] **Step 1: Écrire le test qui échoue**

`apps/backend/src/fights/helpers/client-state.builder.spec.ts` :

```ts
import { buildClientState } from './client-state.builder';
import { instanceOf, P1_ID, scenario } from '../testing/scenario';
import { monsterCard } from '../testing/cards';
import type { Card } from '../../cards/card.entity';

describe('buildClientState — candidats de choix', () => {
  it('transmet le coût, l’illustration et la description', () => {
    const card = monsterCard('Gobelin', {
      cost: 3,
      description: 'Un gobelin',
      image: { id: 9, url: 'https://cdn.test/gobelin.png' } as Card['image'],
    });
    const game = scenario();
    game.pendingChoices.push({
      forUserId: P1_ID,
      candidates: [{ ...instanceOf(card, P1_ID), source: 'graveyard' }],
      count: 1,
      prompt: 'Choisir',
    });

    const state = buildClientState(game, P1_ID);

    expect(state.pendingChoice?.candidates[0].baseCard).toEqual({
      id: card.id,
      name: 'Gobelin',
      type: 'monster',
      atk: 100,
      hp: 500,
      rarity: 'common',
      supportType: null,
      cost: 3,
      image: { url: 'https://cdn.test/gobelin.png' },
      description: 'Un gobelin',
    });
  });

  it('envoie image null quand la carte n’a pas d’illustration', () => {
    const card = monsterCard('Ogre');
    const game = scenario();
    game.pendingChoices.push({
      forUserId: P1_ID,
      candidates: [{ ...instanceOf(card, P1_ID), source: 'deck' }],
      count: 1,
      prompt: 'Choisir',
    });

    const state = buildClientState(game, P1_ID);

    expect(state.pendingChoice?.candidates[0].baseCard.image).toBeNull();
  });
});
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run: `pnpm --filter @pipou/backend exec jest src/fights/helpers/client-state.builder.spec.ts`
Expected: FAIL — `cost`, `image`, `description` absents de l'objet reçu.

- [ ] **Step 3: Étendre le contrat partagé**

Dans `packages/shared/src/game/state.ts`, remplacer :

```ts
  baseCard: Pick<
    ClientCard,
    "id" | "name" | "type" | "atk" | "hp" | "rarity" | "supportType"
  >;
```

par :

```ts
  baseCard: Pick<
    ClientCard,
    | "id"
    | "name"
    | "type"
    | "atk"
    | "hp"
    | "rarity"
    | "supportType"
    | "cost"
    | "image"
    | "description"
  >;
```

Run: `pnpm build:shared`

- [ ] **Step 4: Remplir les champs côté serveur**

Dans `apps/backend/src/fights/helpers/client-state.builder.ts`, l'objet `baseCard` des candidats devient :

```ts
            baseCard: {
              id: c.baseCard.id,
              name: c.baseCard.name,
              type: c.baseCard.type,
              atk: c.baseCard.atk,
              hp: c.baseCard.hp,
              rarity: c.baseCard.rarity,
              supportType: c.baseCard.supportType,
              cost: c.baseCard.cost,
              image: c.baseCard.image ? { url: c.baseCard.image.url } : null,
              description: c.baseCard.description ?? null,
            },
```

- [ ] **Step 5: Adapter les candidats construits côté front**

Dans `apps/frontend/src/features/fight/FightBoard.tsx`, fonction `openTargetPick`, l'objet `baseCard` devient :

```ts
        baseCard: {
          id: z.card.baseCard.id,
          name: z.card.baseCard.name,
          type: z.card.baseCard.type,
          atk: z.card.baseCard.atk,
          hp: z.card.baseCard.hp,
          rarity: z.card.baseCard.rarity,
          supportType: z.card.baseCard.supportType,
          cost: z.card.baseCard.cost,
          image: z.card.baseCard.image,
          description: z.card.baseCard.description,
        },
```

- [ ] **Step 6: Vérifier**

Run: `pnpm --filter @pipou/backend exec jest src/fights/helpers/client-state.builder.spec.ts`
Expected: PASS (2 tests).
Run: `pnpm typecheck`
Expected: aucune erreur.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/game/state.ts apps/backend/src/fights/helpers/client-state.builder.ts apps/backend/src/fights/helpers/client-state.builder.spec.ts apps/frontend/src/features/fight/FightBoard.tsx
git commit -m "feat(fight): send cost, image and description with choice candidates

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Extraire `CardFace` de `CardDisplay`

**Files:**
- Create: `apps/frontend/src/features/cards/CardFace.tsx`
- Create: `apps/frontend/src/features/cards/CardFace.css`
- Modify: `apps/frontend/src/features/cards/CardDisplay.tsx`
- Modify: `apps/frontend/src/features/cards/CardDisplay.css`
- Test: `apps/frontend/src/__tests__/components/CardFace.test.tsx` (nouveau)

**Interfaces:**
- Produces (exportés par `features/cards/CardFace.tsx`) :
  ```ts
  export type CardFaceCard = Pick<ClientCard, "id" | "name" | "rarity" | "type" | "atk" | "hp"> & {
    supportType?: SupportType | null; cost?: number; description?: string | null; image?: { url: string } | null;
  };
  export type StatState = "up" | "down";
  export interface CardFaceStats { atk: number; hp: number; atkState?: StatState; hpState?: StatState }
  export type CardFaceSize = "xs" | "sm" | "md" | "lg";
  export interface CardFaceProps { card: CardFaceCard; size: CardFaceSize; showDescription?: boolean; stats?: CardFaceStats; guard?: boolean; spent?: boolean; badges?: ReactNode }
  export default function CardFace(props: CardFaceProps): JSX.Element
  ```
- Classes CSS stables : racine `.card-face` avec `data-rarity`, `.card-face--{size}`, `.card-face--guard`, `.card-face--spent`, `.card-face__stat-badge--up|--down`.

- [ ] **Step 1: Écrire les tests qui échouent**

`apps/frontend/src/__tests__/components/CardFace.test.tsx` :

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import CardFace, { type CardFaceCard } from "../../features/cards/CardFace";

const gobelin: CardFaceCard = {
  id: 7,
  name: "Gobelin",
  rarity: "epic",
  type: "monster",
  atk: 100,
  hp: 500,
  cost: 2,
  description: "Frappe fort",
  image: null,
};

describe("CardFace", () => {
  it("porte la rareté et les stats de base", () => {
    const { container } = render(<CardFace card={gobelin} size="xs" />);

    expect(container.querySelector(".card-face")).toHaveAttribute(
      "data-rarity",
      "epic",
    );
    expect(screen.getByText("Gobelin")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("500")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("colore les stats courantes en hausse et en baisse", () => {
    render(
      <CardFace
        card={gobelin}
        size="xs"
        stats={{ atk: 300, hp: 200, atkState: "up", hpState: "down" }}
      />,
    );

    expect(screen.getByText("300").closest(".card-face__stat-badge")).toHaveClass(
      "card-face__stat-badge--up",
    );
    expect(screen.getByText("200").closest(".card-face__stat-badge")).toHaveClass(
      "card-face__stat-badge--down",
    );
  });

  it("affiche la garde et l'état « a attaqué »", () => {
    const { container } = render(
      <CardFace card={gobelin} size="xs" guard spent />,
    );

    const root = container.querySelector(".card-face");
    expect(root).toHaveClass("card-face--guard");
    expect(root).toHaveClass("card-face--spent");
    expect(screen.getByText("a attaqué")).toBeInTheDocument();
  });

  it("montre l'illustration, ou le placeholder sans image", () => {
    const { rerender } = render(<CardFace card={gobelin} size="sm" />);
    expect(screen.getByText("✦")).toBeInTheDocument();

    rerender(
      <CardFace
        card={{ ...gobelin, image: { url: "https://cdn.test/g.png" } }}
        size="sm"
      />,
    );
    expect(screen.getByRole("img", { name: "Gobelin" })).toHaveAttribute(
      "src",
      "https://cdn.test/g.png",
    );
  });

  it("n'affiche la description qu'en md/lg avec showDescription", () => {
    const { rerender } = render(
      <CardFace card={gobelin} size="xs" showDescription />,
    );
    expect(screen.queryByText("Frappe fort")).not.toBeInTheDocument();

    rerender(<CardFace card={gobelin} size="md" />);
    expect(screen.queryByText("Frappe fort")).not.toBeInTheDocument();

    rerender(<CardFace card={gobelin} size="md" showDescription />);
    expect(screen.getByText("Frappe fort")).toBeInTheDocument();
  });

  it("affiche le type d'une carte support sans stats", () => {
    render(
      <CardFace
        card={{ ...gobelin, type: "support", supportType: "EQUIPMENT" }}
        size="xs"
      />,
    );

    expect(screen.getByText("Équipement")).toBeInTheDocument();
    expect(screen.queryByText("ATK")).not.toBeInTheDocument();
  });

  it("place les badges sur l'illustration", () => {
    render(<CardFace card={gobelin} size="xs" badges={<span>🛡</span>} />);

    expect(screen.getByText("🛡").closest(".card-face__badges")).not.toBeNull();
  });
});
```

- [ ] **Step 2: Lancer les tests, vérifier l'échec**

Run: `pnpm --filter @pipou/frontend exec vitest run src/__tests__/components/CardFace.test.tsx`
Expected: FAIL — `Failed to resolve import "../../features/cards/CardFace"`.

- [ ] **Step 3: Créer `CardFace.tsx`**

```tsx
import type { ReactNode } from "react";
import type { ClientCard, SupportType } from "@pipou/shared";
import "./CardFace.css";

const SUPPORT_TYPE_LABELS: Record<string, string> = {
  EPHEMERAL: "Éphémère",
  EQUIPMENT: "Équipement",
  TERRAIN: "Terrain",
};

/** Forme minimale : satisfaite par Card (card.service) et par ClientCard (@pipou/shared). */
export type CardFaceCard = Pick<
  ClientCard,
  "id" | "name" | "rarity" | "type" | "atk" | "hp"
> & {
  supportType?: SupportType | null;
  cost?: number;
  description?: string | null;
  image?: { url: string } | null;
};

export type StatState = "up" | "down";

export interface CardFaceStats {
  atk: number;
  hp: number;
  atkState?: StatState;
  hpState?: StatState;
}

export type CardFaceSize = "xs" | "sm" | "md" | "lg";

export interface CardFaceProps {
  card: CardFaceCard;
  /** xs = taille duel (main, terrain), sans pied de carte. */
  size: CardFaceSize;
  /** Pied de carte avec description. Ignoré en xs/sm. */
  showDescription?: boolean;
  /** Stats courantes ; absent = stats de base de la carte. */
  stats?: CardFaceStats;
  guard?: boolean;
  spent?: boolean;
  /** Pastilles d'état, posées en haut à gauche de l'illustration. */
  badges?: ReactNode;
}

function statBadgeClass(state: StatState | undefined): string {
  return state
    ? `card-face__stat-badge card-face__stat-badge--${state}`
    : "card-face__stat-badge";
}

/** Recto d'une carte, sans aucune interaction. */
export default function CardFace({
  card,
  size,
  showDescription = false,
  stats,
  guard = false,
  spent = false,
  badges,
}: CardFaceProps) {
  const isSupport = card.type.toLowerCase() === "support";
  const supportLabel = card.supportType
    ? (SUPPORT_TYPE_LABELS[card.supportType] ?? card.supportType)
    : null;
  const current = stats ?? { atk: card.atk, hp: card.hp };
  const withFooter = showDescription && (size === "md" || size === "lg");

  return (
    <div
      className={[
        "card-face",
        `card-face--${size}`,
        guard ? "card-face--guard" : "",
        spent ? "card-face--spent" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-rarity={card.rarity.toLowerCase()}
    >
      <div className="card-face__header">
        <div className="card-face__name">{card.name}</div>
        {card.cost !== undefined && (
          <div className="card-face__cost">{card.cost}</div>
        )}
      </div>

      <div className="card-face__image-wrap">
        {card.image?.url ? (
          <img
            className="card-face__image"
            src={card.image.url}
            alt={card.name}
            loading="lazy"
            decoding="async"
            draggable={false}
          />
        ) : (
          <div className="card-face__image-placeholder" aria-hidden="true">
            ✦
          </div>
        )}

        {badges && <div className="card-face__badges">{badges}</div>}

        {guard && (
          <div className="card-face__guard-shield" aria-hidden="true">
            🛡️
          </div>
        )}

        {spent && <div className="card-face__spent-label">a attaqué</div>}

        {!isSupport && (
          <div className="card-face__stats-overlay">
            <div className={statBadgeClass(current.atkState)}>
              <span className="card-face__stat-label">ATK</span>
              <span className="card-face__stat-value">{current.atk}</span>
            </div>
            <div className={statBadgeClass(current.hpState)}>
              <span className="card-face__stat-label">HP</span>
              <span className="card-face__stat-value">{current.hp}</span>
            </div>
          </div>
        )}

        {isSupport && supportLabel && (
          <div className="card-face__support-badge">{supportLabel}</div>
        )}
      </div>

      {withFooter && (
        <div className="card-face__footer">
          {card.description ? (
            <div className="card-face__description">{card.description}</div>
          ) : (
            <div className="card-face__description" style={{ opacity: 0.3 }}>
              —
            </div>
          )}
          <div className="card-face__id-row">
            <span className="card-face__id">#{card.id}</span>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Créer `CardFace.css`**

Les règles reprennent celles de `CardDisplay.css` (renommées `pipou-card__*` → `card-face__*`) et ajoutent la taille `xs` et les états de combat.

```css
/* ══ CardFace — recto de carte, sans interaction ══ */
.card-face {
  --card-color: #7caa6a;
  --card-border: #4a7a3a;
  --card-header: #a8c890;
  --card-footer: #d8ecc0;
  --card-text: #2a3a1a;
  --stat-up: #1e8f4e;
  --stat-down: #d63031;

  position: relative;
  width: 100%;
  display: flex;
  flex-direction: column;
  border-radius: 6%;
  overflow: hidden;
  border: 3px solid var(--card-border);
  background: var(--card-color);
  aspect-ratio: 2 / 3;
  box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.25);
  isolation: isolate;
}

/* ── Header : nom + coût ── */
.card-face__header {
  position: relative;
  padding: 6% 18% 4% 6%;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 18%;
  background: var(--card-header);
  border-bottom: 2px solid rgba(0, 0, 0, 0.08);
}

.card-face__name {
  font-family: "Lilita One", cursive;
  font-size: clamp(0.42rem, 2.2cqi, 0.85rem);
  color: var(--card-text);
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  line-height: 1.25;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.4);
  word-break: break-word;
}

.card-face__cost {
  position: absolute;
  top: 6%;
  right: 4%;
  width: 16%;
  aspect-ratio: 1;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.85);
  border: 1.5px solid var(--card-border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: "Lilita One", cursive;
  font-size: clamp(0.4rem, 1.9cqi, 0.78rem);
  color: var(--card-text);
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.6);
}

/* ── Illustration ── */
.card-face__image-wrap {
  margin: 2% 4%;
  border-radius: 5%;
  overflow: hidden;
  border: 2px solid var(--card-border);
  position: relative;
  flex: 1;
  background: rgba(255, 255, 255, 0.2);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.3);
}

.card-face__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  pointer-events: none;
}

.card-face__image-placeholder {
  width: 100%;
  height: 100%;
  min-height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: clamp(1.2rem, 8cqi, 2.5rem);
  color: var(--card-text);
  opacity: 0.35;
}

/* ── Badges d'état ── */
.card-face__badges {
  position: absolute;
  top: 3%;
  left: 3%;
  right: 3%;
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  z-index: 2;
  pointer-events: none;
}

.card-face__badges > * {
  background: rgba(255, 255, 255, 0.9);
}

/* ── ATK/HP ── */
.card-face__stats-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  padding: 0 2% 3%;
  pointer-events: none;
  z-index: 2;
}

.card-face__stat-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgba(255, 255, 255, 0.92);
  border: 1.5px solid var(--card-border);
  border-radius: 6px;
  padding: 1% 4%;
  min-width: 28%;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.card-face__stat-label {
  font-family: "Lilita One", cursive;
  font-size: clamp(0.28rem, 1.3cqi, 0.48rem);
  color: var(--card-text);
  opacity: 0.75;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.card-face__stat-value {
  font-family: "Lilita One", cursive;
  font-size: clamp(0.5rem, 2.8cqi, 1rem);
  color: var(--card-text);
  line-height: 1;
}

.card-face__stat-badge--up .card-face__stat-value {
  color: var(--stat-up);
}
.card-face__stat-badge--down .card-face__stat-value {
  color: var(--stat-down);
}

/* ── Badge type support ── */
.card-face__support-badge {
  position: absolute;
  bottom: 5%;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(255, 255, 255, 0.92);
  border: 1.5px solid var(--card-border);
  border-radius: 20px;
  padding: 1.5% 8%;
  font-family: "Lilita One", cursive;
  font-size: clamp(0.28rem, 1.5cqi, 0.55rem);
  color: var(--card-text);
  letter-spacing: 0.3px;
  text-transform: uppercase;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  white-space: nowrap;
  pointer-events: none;
  z-index: 2;
}

/* ── Footer ── */
.card-face__footer {
  background: var(--card-footer);
  border-top: 2px solid var(--card-border);
  padding: 4% 5% 3%;
  display: flex;
  flex-direction: column;
  gap: 3%;
  min-height: 24%;
}

.card-face__description {
  font-family: "Comfortaa", system-ui, sans-serif;
  font-size: clamp(0.28rem, 1.6cqi, 0.58rem);
  color: var(--card-text);
  line-height: 1.5;
  flex: 1;
}

.card-face__id-row {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 3%;
}

.card-face__id {
  font-family: "Comfortaa", sans-serif;
  font-size: clamp(0.22rem, 1.2cqi, 0.44rem);
  color: var(--card-text);
  opacity: 0.45;
}

/* ══ ÉTATS DE COMBAT ══ */
.card-face--guard {
  --card-border: #3c78dc;
  box-shadow:
    inset 0 0 0 2px rgba(255, 255, 255, 0.25),
    0 0 0 2px rgba(60, 120, 220, 0.4);
}

.card-face--guard .card-face__image-wrap::after {
  content: "";
  position: absolute;
  inset: 0;
  background: rgba(60, 120, 220, 0.35);
  pointer-events: none;
  z-index: 1;
}

.card-face__guard-shield {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 1.6em;
  z-index: 1;
  opacity: 0.9;
  pointer-events: none;
}

.card-face--spent {
  filter: grayscale(0.7) brightness(0.85);
}

.card-face__spent-label {
  position: absolute;
  top: 42%;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 9px;
  padding: 2px 6px;
  border-radius: 99px;
  white-space: nowrap;
  z-index: 3;
  pointer-events: none;
}

/* ══ TAILLES ══ */
.card-face--sm .card-face__image-wrap {
  flex: 1;
  margin-bottom: 4%;
}

/* xs : main et terrain du duel (~84–100px de large), polices fixes */
.card-face--xs {
  border-width: 2px;
  border-radius: 8px;
}
.card-face--xs .card-face__header {
  padding: 4px 17px 3px 4px;
  min-height: 0;
}
.card-face--xs .card-face__name {
  font-size: 8px;
  line-height: 1.1;
}
.card-face--xs .card-face__cost {
  top: 3px;
  right: 3px;
  width: 14px;
  font-size: 8px;
}
.card-face--xs .card-face__image-wrap {
  margin: 2px 3px 3px;
  border-width: 1.5px;
  border-radius: 5px;
}
.card-face--xs .card-face__image-placeholder {
  min-height: 0;
  font-size: 18px;
}
.card-face--xs .card-face__badges {
  font-size: 9px;
}
.card-face--xs .card-face__stat-badge {
  padding: 0 3px;
  min-width: 0;
  border-radius: 4px;
  border-width: 1px;
}
.card-face--xs .card-face__stat-label {
  font-size: 6px;
}
.card-face--xs .card-face__stat-value {
  font-size: 10px;
}
.card-face--xs .card-face__support-badge {
  font-size: 6px;
  padding: 1px 5px;
}
.card-face--xs .card-face__guard-shield {
  font-size: 22px;
}

/* ══ PALETTES DE RARETÉ ══ */
.card-face[data-rarity="common"] {
  --card-color: #b0b8b0;
  --card-border: #707870;
  --card-header: #c0c8c0;
  --card-footer: #e0e4e0;
  --card-text: #2a302a;
}
.card-face[data-rarity="uncommon"] {
  --card-color: #70b870;
  --card-border: #3a783a;
  --card-header: #98c898;
  --card-footer: #d0ecd0;
  --card-text: #1a301a;
}
.card-face[data-rarity="rare"] {
  --card-color: #6898d8;
  --card-border: #2858a8;
  --card-header: #90aee0;
  --card-footer: #c8dcf8;
  --card-text: #0a1a3a;
}
.card-face[data-rarity="epic"] {
  --card-color: #9860c8;
  --card-border: #581888;
  --card-header: #b888d8;
  --card-footer: #e8d0f8;
  --card-text: #1a0830;
}
.card-face[data-rarity="legendary"] {
  --card-color: #c8860a;
  --card-border: #b87808;
  --card-header: #b87808;
  --card-footer: #d4a020;
  --card-text: #0a0800;
}
.card-face[data-rarity="legendary"] .card-face__cost {
  background: rgba(255, 245, 200, 0.95);
  border-color: #f5d060;
  color: #0a0800;
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
}
.card-face[data-rarity="legendary"] .card-face__stat-badge {
  background: rgba(255, 245, 200, 0.95);
  border-color: #f5d060;
  box-shadow:
    0 2px 6px rgba(0, 0, 0, 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.7);
}
.card-face[data-rarity="secret"] {
  --card-color: #0a0a0f;
  --card-border: #2a0a2a;
  --card-header: #12121e;
  --card-footer: #0f0f1a;
  --card-text: #f0e8ff;
  --stat-up: #5ee08f;
  --stat-down: #ff7b7b;
}
.card-face[data-rarity="secret"] .card-face__stat-badge {
  background: rgba(10, 10, 15, 0.85);
  border-color: #6a0a6a;
}
.card-face[data-rarity="secret"] .card-face__stat-label {
  color: #a080c0;
}
.card-face[data-rarity="secret"] .card-face__stat-value {
  color: #f0e8ff;
}
.card-face[data-rarity="secret"] .card-face__stat-badge--up .card-face__stat-value {
  color: var(--stat-up);
}
.card-face[data-rarity="secret"] .card-face__stat-badge--down .card-face__stat-value {
  color: var(--stat-down);
}
.card-face[data-rarity="secret"] .card-face__cost {
  background: rgba(10, 10, 15, 0.85);
  border-color: #6a0a6a;
  color: #f0e8ff;
}
```

- [ ] **Step 5: Lancer les tests `CardFace`**

Run: `pnpm --filter @pipou/frontend exec vitest run src/__tests__/components/CardFace.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 6: Faire rendre `CardFace` par `CardDisplay`**

Dans `apps/frontend/src/features/cards/CardDisplay.tsx` :

1. Ajouter l'import `import CardFace from "./CardFace";`.
2. Supprimer la constante `SUPPORT_TYPE_LABELS` et les variables `isSupport` / `supportLabel` (plus utilisées).
3. Remplacer tout le bloc `{/* ══ RECTO ══ */} <div className="pipou-card__front"> … </div>` par :

```tsx
          {/* ══ RECTO ══ */}
          <div className="pipou-card__front">
            <CardFace card={card} size={size} showDescription />
            <div className="pipou-card__shine" />
            <div className="pipou-card__glare" />
          </div>
```

- [ ] **Step 7: Retirer de `CardDisplay.css` ce qui a déménagé**

Dans `apps/frontend/src/features/cards/CardDisplay.css` :

1. Dans `.pipou-card` (variables), supprimer `--card-color`, `--card-border`, `--card-bg`, `--card-header`, `--card-footer`, `--card-text` ; garder `--card-shadow`.
2. Supprimer les règles `.pipou-card--sm .pipou-card__footer` et `.pipou-card--sm .pipou-card__image-wrap`.
3. Remplacer la règle `.pipou-card__front { … }` par :

```css
.pipou-card__front {
  position: relative;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  border-radius: 6%;
  overflow: hidden;
  isolation: isolate;
}
```

4. Supprimer intégralement les blocs `/* ── Header : nom + cost ── */`, `/* ── Illustration ── */`, `/* ── ATK/HP ── */`, `/* ── Badge type support ── */` et `/* ── Footer ── */` (règles `.pipou-card__header`, `__name`, `__cost`, `__image-wrap`, `__image`, `__image-placeholder`, `__stats-overlay`, `__stat-badge`, `__stat-label`, `__stat-value`, `__support-badge`, `__footer`, `__description`, `__id-row`, `__id`).
5. Remplacer tout le bloc `/* ══ RARITY PALETTES ══ */` (jusqu'à la règle `.pipou-card[data-rarity="secret"] .pipou-card__cost` incluse) par :

```css
/* ══ RARITY GLOW (palettes de la face : CardFace.css) ══ */
.pipou-card[data-rarity="common"] {
  --card-shadow: rgba(120, 130, 120, 0.5);
}
.pipou-card[data-rarity="uncommon"] {
  --card-shadow: rgba(60, 160, 60, 0.5);
}
.pipou-card[data-rarity="rare"] {
  --card-shadow: rgba(40, 100, 220, 0.6);
}
.pipou-card[data-rarity="epic"] {
  --card-shadow: rgba(120, 40, 200, 0.6);
}
.pipou-card[data-rarity="legendary"] {
  --card-shadow: rgba(255, 200, 50, 0.8);
}
.pipou-card[data-rarity="secret"] {
  --card-shadow: rgba(200, 50, 255, 0.6);
}
```

Les blocs verso (`.pipou-card__back*`), shine, glare, rotator, tailles `.pipou-card--sm|md|lg` et le hint mobile restent tels quels.

- [ ] **Step 8: Vérifier la non-régression**

Run: `pnpm --filter @pipou/frontend test`
Expected: PASS, y compris `ListingPreview.test.tsx` (qui cherche `.pipou-card`).
Run: `pnpm --filter @pipou/frontend typecheck && pnpm --filter @pipou/frontend lint`
Expected: aucune erreur.

- [ ] **Step 9: Commit**

```bash
git add apps/frontend/src/features/cards/CardFace.tsx apps/frontend/src/features/cards/CardFace.css apps/frontend/src/features/cards/CardDisplay.tsx apps/frontend/src/features/cards/CardDisplay.css apps/frontend/src/__tests__/components/CardFace.test.tsx
git commit -m "refactor(cards): extract CardFace from CardDisplay with combat states

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Hook `useLongPress`

**Files:**
- Create: `apps/frontend/src/hooks/useLongPress.ts`
- Modify: `apps/frontend/src/__tests__/setup.ts` (polyfill `PointerEvent`, absent de jsdom 23)
- Test: `apps/frontend/src/__tests__/unit/useLongPress.test.tsx` (nouveau)

**Interfaces:**
- Produces :
  ```ts
  export const LONG_PRESS_MS = 400;
  export const LONG_PRESS_MOVE_PX = 8;
  export interface LongPressOptions { onLongPress: () => void; onLongPressEnd?: () => void }
  export interface LongPressHandlers {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => void;
    onPointerUp: () => void;
    onPointerCancel: () => void;
    onClickCapture: (e: React.MouseEvent<HTMLElement>) => void;
    onContextMenu: (e: React.MouseEvent<HTMLElement>) => void;
  }
  export function useLongPress(options: LongPressOptions): LongPressHandlers
  ```
  `onLongPressEnd` est appelé au relâchement d'un appui long déclenché. Un clic droit ou la touche menu (événement `contextmenu`) déclenche `onLongPress` sans `onLongPressEnd`.

- [ ] **Step 1: Ajouter le polyfill `PointerEvent` au setup de test**

À la fin de `apps/frontend/src/__tests__/setup.ts` :

```ts
/**
 * jsdom 23 n'a pas PointerEvent : sans lui, fireEvent.pointerDown perd clientX/clientY.
 */
if (typeof window.PointerEvent === "undefined") {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
      this.pointerType = init.pointerType ?? "mouse";
    }
  }
  Object.defineProperty(window, "PointerEvent", {
    writable: true,
    value: PointerEventPolyfill,
  });
}
```

- [ ] **Step 2: Écrire les tests qui échouent**

`apps/frontend/src/__tests__/unit/useLongPress.test.tsx` :

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useLongPress } from "../../hooks/useLongPress";

interface ProbeProps {
  onLongPress: () => void;
  onLongPressEnd?: () => void;
  onClick: () => void;
}

function Probe({ onLongPress, onLongPressEnd, onClick }: ProbeProps) {
  const longPress = useLongPress({ onLongPress, onLongPressEnd });
  return (
    <button {...longPress} onClick={onClick}>
      carte
    </button>
  );
}

function setup() {
  const props = {
    onLongPress: vi.fn(),
    onLongPressEnd: vi.fn(),
    onClick: vi.fn(),
  };
  render(<Probe {...props} />);
  return { ...props, el: screen.getByText("carte") };
}

describe("useLongPress", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("déclenche après 400 ms, prévient au relâchement et avale le clic", () => {
    const { el, onLongPress, onLongPressEnd, onClick } = setup();

    fireEvent.pointerDown(el, { clientX: 10, clientY: 10, button: 0 });
    act(() => vi.advanceTimersByTime(399));
    expect(onLongPress).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onLongPress).toHaveBeenCalledTimes(1);

    fireEvent.pointerUp(el);
    fireEvent.click(el);

    expect(onLongPressEnd).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("un tap court reste un clic", () => {
    const { el, onLongPress, onLongPressEnd, onClick } = setup();

    fireEvent.pointerDown(el, { clientX: 10, clientY: 10, button: 0 });
    act(() => vi.advanceTimersByTime(100));
    fireEvent.pointerUp(el);
    fireEvent.click(el);

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onLongPress).not.toHaveBeenCalled();
    expect(onLongPressEnd).not.toHaveBeenCalled();
  });

  it("un déplacement de plus de 8px annule l'appui long", () => {
    const { el, onLongPress } = setup();

    fireEvent.pointerDown(el, { clientX: 10, clientY: 10, button: 0 });
    fireEvent.pointerMove(el, { clientX: 25, clientY: 10 });
    act(() => vi.advanceTimersByTime(500));

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("un petit déplacement ne l'annule pas", () => {
    const { el, onLongPress } = setup();

    fireEvent.pointerDown(el, { clientX: 10, clientY: 10, button: 0 });
    fireEvent.pointerMove(el, { clientX: 14, clientY: 13 });
    act(() => vi.advanceTimersByTime(400));

    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it("le menu contextuel (clic droit, touche menu) ouvre aussi", () => {
    const { el, onLongPress } = setup();

    fireEvent.contextMenu(el);

    expect(onLongPress).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: Lancer, vérifier l'échec**

Run: `pnpm --filter @pipou/frontend exec vitest run src/__tests__/unit/useLongPress.test.tsx`
Expected: FAIL — `Failed to resolve import "../../hooks/useLongPress"`.

- [ ] **Step 4: Implémenter le hook**

`apps/frontend/src/hooks/useLongPress.ts` :

```ts
import { useEffect, useRef } from "react";
import type { MouseEvent, PointerEvent } from "react";

/** Durée d'appui avant déclenchement (ms). */
export const LONG_PRESS_MS = 400;
/** Déplacement au-delà duquel l'appui long est annulé (px). */
export const LONG_PRESS_MOVE_PX = 8;

export interface LongPressOptions {
  onLongPress: () => void;
  /** Relâchement d'un appui long déclenché (pas appelé pour le menu contextuel). */
  onLongPressEnd?: () => void;
}

export interface LongPressHandlers {
  onPointerDown: (e: PointerEvent<HTMLElement>) => void;
  onPointerMove: (e: PointerEvent<HTMLElement>) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  onClickCapture: (e: MouseEvent<HTMLElement>) => void;
  onContextMenu: (e: MouseEvent<HTMLElement>) => void;
}

/** Appui long tactile ou souris ; le clic qui suit un appui long est avalé. */
export function useLongPress({
  onLongPress,
  onLongPressEnd,
}: LongPressOptions): LongPressHandlers {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const firedRef = useRef(false);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // Nettoyage au démontage (même motif que CardDisplay)
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const release = () => {
    clearTimer();
    if (firedRef.current) onLongPressEnd?.();
  };

  return {
    onPointerDown: (e) => {
      if (e.button !== 0) return;
      firedRef.current = false;
      startRef.current = { x: e.clientX, y: e.clientY };
      // Le relâchement revient à cet élément même si un overlay s'ouvre dessus
      e.currentTarget.setPointerCapture?.(e.pointerId);
      clearTimer();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        firedRef.current = true;
        onLongPress();
      }, LONG_PRESS_MS);
    },
    onPointerMove: (e) => {
      if (!timerRef.current || !startRef.current) return;
      const moved = Math.hypot(
        e.clientX - startRef.current.x,
        e.clientY - startRef.current.y,
      );
      if (moved > LONG_PRESS_MOVE_PX) clearTimer();
    },
    onPointerUp: release,
    onPointerCancel: release,
    onClickCapture: (e) => {
      if (!firedRef.current) return;
      firedRef.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
    onContextMenu: (e) => {
      e.preventDefault();
      // Pendant un appui tactile, le menu natif arrive en double : le minuteur s'en charge
      if (!firedRef.current && !timerRef.current) onLongPress();
    },
  };
}
```

- [ ] **Step 5: Lancer, vérifier le succès**

Run: `pnpm --filter @pipou/frontend exec vitest run src/__tests__/unit/useLongPress.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/hooks/useLongPress.ts apps/frontend/src/__tests__/unit/useLongPress.test.tsx apps/frontend/src/__tests__/setup.ts
git commit -m "feat(fight): add useLongPress hook for card inspection

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Géométrie de l'éventail `fanLayout`

**Files:**
- Create: `apps/frontend/src/features/fight/fanLayout.ts`
- Test: `apps/frontend/src/__tests__/unit/fanLayout.test.ts` (nouveau)

**Interfaces:**
- Produces :
  ```ts
  export interface FanSlot { rotateDeg: number; offsetY: number; marginLeft: number }
  export function fanLayout(count: number, containerWidth: number, cardWidth: number): FanSlot[]
  ```
  `marginLeft` est ≤ 0 (chevauchement) ; la largeur totale `count·cardWidth + Σ marginLeft` ne dépasse jamais `containerWidth` dès qu'il y a plus d'une carte.

- [ ] **Step 1: Écrire les tests qui échouent**

`apps/frontend/src/__tests__/unit/fanLayout.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { fanLayout } from "../../features/fight/fanLayout";

const totalWidth = (n: number, cardWidth: number, W: number) =>
  fanLayout(n, W, cardWidth).reduce((sum, s) => sum + cardWidth + s.marginLeft, 0);

describe("fanLayout", () => {
  it("renvoie un tableau vide sans carte", () => {
    expect(fanLayout(0, 400, 84)).toEqual([]);
  });

  it("pose une carte seule droite, sans décalage", () => {
    expect(fanLayout(1, 400, 84)).toEqual([
      { rotateDeg: 0, offsetY: 0, marginLeft: 0 },
    ]);
  });

  it("ouvre l'éventail de -15° à +15°, symétrique", () => {
    const slots = fanLayout(5, 400, 84);

    expect(slots[0].rotateDeg).toBeCloseTo(-15);
    expect(slots[4].rotateDeg).toBeCloseTo(15);
    expect(slots[2].rotateDeg).toBeCloseTo(0);
    slots.forEach((s, i) => {
      expect(s.rotateDeg).toBeCloseTo(-slots[4 - i].rotateDeg);
      expect(s.offsetY).toBeCloseTo(slots[4 - i].offsetY);
    });
    expect(slots[0].offsetY).toBeGreaterThan(slots[2].offsetY);
  });

  it("chevauche toujours un peu, même quand tout tient", () => {
    const slots = fanLayout(3, 400, 84);

    expect(slots[0].marginLeft).toBe(0);
    expect(slots[1].marginLeft).toBeLessThan(0);
  });

  it.each([5, 7, 10])("tient dans la largeur avec %i cartes", (n) => {
    expect(totalWidth(n, 84, 400)).toBeLessThanOrEqual(400 + 1e-6);
  });
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `pnpm --filter @pipou/frontend exec vitest run src/__tests__/unit/fanLayout.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implémenter**

`apps/frontend/src/features/fight/fanLayout.ts` :

```ts
/** Ouverture totale de l'éventail (degrés) : de -15° à +15°. */
const FAN_SPREAD_DEG = 30;
/** Descente des cartes du bord, par degré de rotation (px). */
const FAN_DROP_PX_PER_DEG = 0.9;
/** Chevauchement minimal, en part de la largeur d'une carte. */
const MIN_OVERLAP_RATIO = 0.2;

export interface FanSlot {
  rotateDeg: number;
  offsetY: number;
  /** Négatif : la carte recouvre la précédente. */
  marginLeft: number;
}

/** Place `count` cartes en éventail dans `containerWidth` px. */
export function fanLayout(
  count: number,
  containerWidth: number,
  cardWidth: number,
): FanSlot[] {
  if (count <= 0) return [];
  if (count === 1) return [{ rotateDeg: 0, offsetY: 0, marginLeft: 0 }];

  const overlapToFit = (count * cardWidth - containerWidth) / (count - 1);
  const overlap = Math.max(cardWidth * MIN_OVERLAP_RATIO, overlapToFit);

  return Array.from({ length: count }, (_, i) => {
    const rotateDeg = -FAN_SPREAD_DEG / 2 + (FAN_SPREAD_DEG * i) / (count - 1);
    return {
      rotateDeg,
      offsetY: Math.abs(rotateDeg) * FAN_DROP_PX_PER_DEG,
      marginLeft: i === 0 ? 0 : -overlap,
    };
  });
}
```

- [ ] **Step 4: Lancer, vérifier le succès**

Run: `pnpm --filter @pipou/frontend exec vitest run src/__tests__/unit/fanLayout.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/features/fight/fanLayout.ts apps/frontend/src/__tests__/unit/fanLayout.test.ts
git commit -m "feat(fight): add fan layout geometry for the hand

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `BuffDebuffSections`, `CardInspect` et `InspectableCard`

**Files:**
- Create: `apps/frontend/src/features/fight/BuffDebuffSections.tsx`
- Create: `apps/frontend/src/features/fight/BuffDebuffSections.css`
- Modify: `apps/frontend/src/features/fight/BuffDebuffList.tsx` (réutilise les sections ; supprimé en tâche 7)
- Modify: `apps/frontend/src/features/fight/BuffDebuffList.css`
- Modify: `apps/frontend/src/features/fight/fight.effects.ts:1`, `apps/frontend/src/features/fight/Zonerow/zoneRow.effects.ts:1`
- Create: `apps/frontend/src/features/fight/CardInspect.tsx`, `CardInspect.css`
- Create: `apps/frontend/src/features/fight/InspectableCard.tsx`, `InspectableCard.css`
- Test: `apps/frontend/src/__tests__/components/CardInspect.test.tsx`, `apps/frontend/src/__tests__/components/InspectableCard.test.tsx` (nouveaux)

**Interfaces:**
- Consumes: `CardFace`, `CardFaceCard`, `CardFaceStats`, `CardFaceProps` (tâche 2) ; `useLongPress` (tâche 3).
- Produces :
  ```ts
  // BuffDebuffSections.tsx
  export interface BuffEntry { icon: string; label: string; type: "buff" | "debuff" | "neutral"; variant?: "recap" | "separator" }
  export default function BuffDebuffSections(props: { entries: BuffEntry[]; defaultOpen?: boolean }): JSX.Element
  // CardInspect.tsx
  export default function CardInspect(props: { card: CardFaceCard; stats?: CardFaceStats; guard?: boolean; entries: BuffEntry[]; onClose: () => void }): JSX.Element
  // InspectableCard.tsx
  export interface InspectableCardProps extends CardFaceProps { onInspect: () => void; onInspectEnd?: () => void; onClick?: () => void; className?: string; style?: CSSProperties; children?: ReactNode }
  export default function InspectableCard(props: InspectableCardProps): JSX.Element
  ```
  `CardInspect` est rendu dans un portail sur `document.body`, rôle `dialog`, nom accessible = nom de la carte. `InspectableCard` est un `role="button"` focusable dont le nom accessible est `"<nom>, <atk> ATK, <hp> PV"` (monstre) ou `"<nom>"` (support).

- [ ] **Step 1: Écrire les tests qui échouent**

`apps/frontend/src/__tests__/components/CardInspect.test.tsx` :

```tsx
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import CardInspect from "../../features/fight/CardInspect";
import type { CardFaceCard } from "../../features/cards/CardFace";

const card: CardFaceCard = {
  id: 3,
  name: "Ogre",
  rarity: "rare",
  type: "monster",
  atk: 200,
  hp: 800,
  cost: 4,
  description: "Écrase tout",
  image: null,
};

describe("CardInspect", () => {
  it("montre la grande carte, sa description et ses effets ouverts", () => {
    render(
      <CardInspect
        card={card}
        stats={{ atk: 250, hp: 600, atkState: "up", hpState: "down" }}
        entries={[
          { icon: "⚔", label: "Effets", type: "neutral", variant: "separator" },
          { icon: "🔥", label: "+50 ATK", type: "buff" },
        ]}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Ogre" })).toBeInTheDocument();
    expect(screen.getByText("Écrase tout")).toBeInTheDocument();
    expect(screen.getByText("250")).toBeInTheDocument();
    expect(screen.getByText("+50 ATK")).toBeInTheDocument();
  });

  it("se ferme sur Échap et sur un tap hors de la carte", () => {
    const onClose = vi.fn();
    render(<CardInspect card={card} entries={[]} onClose={onClose} />);

    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByRole("dialog"));

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("ne se ferme pas sur un tap dans le panneau", () => {
    const onClose = vi.fn();
    render(<CardInspect card={card} entries={[]} onClose={onClose} />);

    fireEvent.click(screen.getByText("Écrase tout"));

    expect(onClose).not.toHaveBeenCalled();
  });
});
```

`apps/frontend/src/__tests__/components/InspectableCard.test.tsx` :

```tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import InspectableCard from "../../features/fight/InspectableCard";
import type { CardFaceCard } from "../../features/cards/CardFace";

const card: CardFaceCard = {
  id: 1,
  name: "Gobelin",
  rarity: "common",
  type: "monster",
  atk: 100,
  hp: 500,
  cost: 1,
  image: null,
};

describe("InspectableCard", () => {
  afterEach(() => vi.useRealTimers());

  it("expose nom et stats courantes comme nom accessible", () => {
    render(
      <InspectableCard
        card={card}
        size="xs"
        stats={{ atk: 150, hp: 300 }}
        onInspect={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Gobelin, 150 ATK, 300 PV" }),
    ).toBeInTheDocument();
  });

  it("clic et Entrée jouent la carte, appui long l'inspecte", () => {
    vi.useFakeTimers();
    const onClick = vi.fn();
    const onInspect = vi.fn();
    render(
      <InspectableCard
        card={card}
        size="xs"
        onClick={onClick}
        onInspect={onInspect}
      />,
    );
    const el = screen.getByRole("button", { name: /Gobelin/ });

    fireEvent.click(el);
    fireEvent.keyDown(el, { key: "Enter" });
    expect(onClick).toHaveBeenCalledTimes(2);

    fireEvent.pointerDown(el, { clientX: 0, clientY: 0, button: 0 });
    act(() => vi.advanceTimersByTime(400));
    fireEvent.pointerUp(el);
    fireEvent.click(el);

    expect(onInspect).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `pnpm --filter @pipou/frontend exec vitest run src/__tests__/components/CardInspect.test.tsx src/__tests__/components/InspectableCard.test.tsx`
Expected: FAIL — modules introuvables.

- [ ] **Step 3: Créer `BuffDebuffSections.tsx`**

Déplacer depuis `BuffDebuffList.tsx` l'interface `BuffEntry` et la fonction `buildSections` (copiées telles quelles), puis :

```tsx
import { useState } from "react";
import "./BuffDebuffSections.css";

export interface BuffEntry {
  icon: string;
  label: string;
  type: "buff" | "debuff" | "neutral";
  /** "recap" = ligne stats calculée, "separator" = début de section accordion */
  variant?: "recap" | "separator";
}

// … buildSections(entries) : copiée à l'identique depuis BuffDebuffList.tsx …

interface Props {
  entries: BuffEntry[];
  /** Toutes les sections ouvertes au montage. */
  defaultOpen?: boolean;
}

/** Récap des stats + sections d'effets repliables. */
export default function BuffDebuffSections({
  entries,
  defaultOpen = false,
}: Props) {
  const { recap, sections } = buildSections(entries);
  const [openSections, setOpenSections] = useState<Set<number>>(() =>
    defaultOpen ? new Set(sections.map((_, i) => i)) : new Set(),
  );

  const toggleSection = (idx: number) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  return (
    <div className="bdl-root">
      {/* ── Récap stats (toujours visible, pas dans un accordion) ── */}
      {recap.length > 0 && (
        <div className="bdl-recap-block">
          {recap.map((e, i) => (
            <div key={i} className="bdl-recap-row">
              <span className="bdl-icon">{e.icon}</span>
              <span className="bdl-label bdl-label--recap">{e.label}</span>
            </div>
          ))}
        </div>
      )}

      {entries.length === 0 || recap.length === entries.length ? (
        <div className="bdl-empty">Aucun effet</div>
      ) : (
        <div className="bdl-sections">
          {sections.map((section, sIdx) => {
            const isOpen = openSections.has(sIdx);
            const hasItems = section.items.length > 0;
            return (
              <div key={sIdx} className="bdl-section">
                <button
                  className={`bdl-section-header ${isOpen ? "bdl-section-header--open" : ""}`}
                  onClick={() => toggleSection(sIdx)}
                  disabled={!hasItems}
                >
                  <span className="bdl-section-title">
                    {section.title.startsWith("🔧")
                      ? section.title
                      : `◆ ${section.title}`}
                  </span>
                  {hasItems && (
                    <span className="bdl-section-chevron">
                      {isOpen ? "▲" : "▼"}
                    </span>
                  )}
                </button>

                {isOpen && hasItems && (
                  <ul className="bdl-list">
                    {section.items.map((e, i) => (
                      <li key={i} className={`bdl-entry bdl-entry--${e.type}`}>
                        <span className="bdl-icon">{e.icon}</span>
                        <span className="bdl-label">{e.label}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Répartir le CSS et brancher `BuffDebuffList` dessus**

1. Créer `BuffDebuffSections.css` en y **déplaçant** depuis `BuffDebuffList.css` toutes les règles sauf : `.bdl-popup`, `@keyframes bdl-appear`, `.bdl-header`, `.bdl-card-name`, `.bdl-type-chip`, `.bdl-trigger`, `.bdl-trigger:hover`, `.bdl-trigger--active` (celles-ci restent dans `BuffDebuffList.css`). Ajouter en tête de `BuffDebuffSections.css` :

```css
.bdl-root {
  background: #fff8f2;
  border: 1.5px solid #e0cfc8;
  border-radius: 12px;
  padding: 10px 12px;
}

.bdl-popup .bdl-root {
  background: none;
  border: none;
  padding: 0;
}
```

2. Dans `BuffDebuffList.tsx` : supprimer `BuffEntry`, `buildSections`, l'état `openSections` et `toggleSection` ; importer `BuffDebuffSections, { type BuffEntry } from "./BuffDebuffSections"` ; réexporter le type (`export type { BuffEntry };`) ; dans le JSX, remplacer tout ce qui suit le bloc `bdl-header` (récap + sections) par `<BuffDebuffSections entries={entries} />`.
3. Dans `fight.effects.ts` et `Zonerow/zoneRow.effects.ts`, l'import du type devient `import type { BuffEntry } from "./BuffDebuffSections";` (resp. `"../BuffDebuffSections"`).

- [ ] **Step 5: Créer `CardInspect.tsx` et `CardInspect.css`**

```tsx
import { useEffect } from "react";
import { createPortal } from "react-dom";
import CardFace, {
  type CardFaceCard,
  type CardFaceStats,
} from "../cards/CardFace";
import BuffDebuffSections, { type BuffEntry } from "./BuffDebuffSections";
import "./CardInspect.css";

interface Props {
  card: CardFaceCard;
  stats?: CardFaceStats;
  guard?: boolean;
  entries: BuffEntry[];
  onClose: () => void;
}

/** Carte en grand + effets actifs, par-dessus tout l'écran. */
export default function CardInspect({
  card,
  stats,
  guard,
  entries,
  onClose,
}: Props) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      className="ci-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={card.name}
      onClick={(e) => {
        // Le portail propage les événements React aux ancêtres : on s'arrête ici
        e.stopPropagation();
        onClose();
      }}
    >
      <div className="ci-panel" onClick={(e) => e.stopPropagation()}>
        <CardFace
          card={card}
          size="lg"
          showDescription
          stats={stats}
          guard={guard}
        />
        {entries.length > 0 && (
          <BuffDebuffSections entries={entries} defaultOpen />
        )}
      </div>
    </div>,
    document.body,
  );
}
```

```css
.ci-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(44, 26, 34, 0.55);
  animation: ci-in 0.15s ease-out;
}

.ci-panel {
  width: min(280px, 100%);
  max-height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

@keyframes ci-in {
  from {
    opacity: 0;
    transform: scale(0.94);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
```

- [ ] **Step 6: Créer `InspectableCard.tsx` et `InspectableCard.css`**

```tsx
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import CardFace, { type CardFaceProps } from "../cards/CardFace";
import { useLongPress } from "../../hooks/useLongPress";
import "./InspectableCard.css";

export interface InspectableCardProps extends CardFaceProps {
  onInspect: () => void;
  onInspectEnd?: () => void;
  onClick?: () => void;
  className?: string;
  style?: CSSProperties;
  /** Pastilles posées autour de la carte (sélection, paiement…). */
  children?: ReactNode;
}

/** Carte de duel : tap = action, appui long / clic droit = inspection. */
export default function InspectableCard({
  onInspect,
  onInspectEnd,
  onClick,
  className,
  style,
  children,
  ...face
}: InspectableCardProps) {
  const longPress = useLongPress({
    onLongPress: onInspect,
    onLongPressEnd: onInspectEnd,
  });
  const stats = face.stats ?? { atk: face.card.atk, hp: face.card.hp };
  const label =
    face.card.type === "support"
      ? face.card.name
      : `${face.card.name}, ${stats.atk} ATK, ${stats.hp} PV`;

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && onClick) {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      {...longPress}
      className={["icard", className].filter(Boolean).join(" ")}
      style={style}
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={onClick}
      onKeyDown={handleKeyDown}
    >
      <CardFace {...face} />
      {children}
    </div>
  );
}
```

```css
.icard {
  position: relative;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  /* Le défilement vertical annule l'appui long (pointercancel) */
  touch-action: pan-y;
}

.icard:focus-visible {
  outline: 2px solid #7a1c3b;
  outline-offset: 2px;
  border-radius: 8px;
}
```

- [ ] **Step 7: Lancer les tests**

Run: `pnpm --filter @pipou/frontend exec vitest run src/__tests__/components/CardInspect.test.tsx src/__tests__/components/InspectableCard.test.tsx`
Expected: PASS (5 tests).
Run: `pnpm --filter @pipou/frontend test && pnpm --filter @pipou/frontend typecheck`
Expected: PASS, aucune erreur (la bulle « i » existante fonctionne toujours via `BuffDebuffSections`).

- [ ] **Step 8: Commit**

```bash
git add apps/frontend/src/features/fight/BuffDebuffSections.tsx apps/frontend/src/features/fight/BuffDebuffSections.css apps/frontend/src/features/fight/BuffDebuffList.tsx apps/frontend/src/features/fight/BuffDebuffList.css apps/frontend/src/features/fight/fight.effects.ts apps/frontend/src/features/fight/Zonerow/zoneRow.effects.ts apps/frontend/src/features/fight/CardInspect.tsx apps/frontend/src/features/fight/CardInspect.css apps/frontend/src/features/fight/InspectableCard.tsx apps/frontend/src/features/fight/InspectableCard.css apps/frontend/src/__tests__/components/CardInspect.test.tsx apps/frontend/src/__tests__/components/InspectableCard.test.tsx
git commit -m "feat(fight): add CardInspect overlay and InspectableCard

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Main en éventail

**Files:**
- Modify: `apps/frontend/src/features/fight/handCard.ts`
- Modify (réécriture): `apps/frontend/src/features/fight/FightHand.tsx`, `apps/frontend/src/features/fight/FightHand.css`
- Test: `apps/frontend/src/__tests__/components/FightHand.test.tsx` (nouveau)

**Interfaces:**
- Consumes: `InspectableCard` (tâche 5), `CardInspect` (tâche 5), `fanLayout` (tâche 4), `getCardEffectEntries(effects, description, supportType)` de `fight.effects.ts`.
- Produces: `HandCard` typé `type: CardType`, `rarity: Rarity`, `supportType?: SupportType`, `image: { url: string } | null`. Props de `FightHand` inchangées.

- [ ] **Step 1: Écrire les tests qui échouent**

`apps/frontend/src/__tests__/components/FightHand.test.tsx` :

```tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import FightHand from "../../features/fight/FightHand";
import type { HandCard } from "../../features/fight/handCard";

const handCard = (name: string): HandCard => ({
  instanceId: `${name}#1`,
  id: 1,
  name,
  type: "monster",
  atk: 100,
  hp: 500,
  cost: 1,
  rarity: "common",
  effects: null,
  description: `Description de ${name}`,
  image: null,
});

function renderHand(overrides: Partial<Parameters<typeof FightHand>[0]> = {}) {
  const onCardClick = vi.fn();
  const hand = [handCard("Gobelin"), handCard("Ogre")];
  render(
    <FightHand
      hand={hand}
      phase="main"
      isMyTurn
      selectedCard={null}
      payIndices={[]}
      freeSummonInstanceIds={[]}
      onCardClick={onCardClick}
      {...overrides}
    />,
  );
  return { hand, onCardClick };
}

describe("FightHand", () => {
  afterEach(() => vi.useRealTimers());

  it("affiche chaque carte avec son visuel", () => {
    renderHand();

    expect(screen.getByRole("button", { name: /Gobelin/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ogre/ })).toBeInTheDocument();
  });

  it("un tap joue la carte pendant mon tour", () => {
    const { hand, onCardClick } = renderHand();

    fireEvent.click(screen.getByRole("button", { name: /Ogre/ }));

    expect(onCardClick).toHaveBeenCalledWith(1, hand[1]);
  });

  it("hors de mon tour, un tap ne fait rien", () => {
    const { onCardClick } = renderHand({ isMyTurn: false });

    fireEvent.click(screen.getByRole("button", { name: /Gobelin/ }));

    expect(onCardClick).not.toHaveBeenCalled();
  });

  it("un appui long ouvre la grande carte sans la jouer, le relâchement la ferme", () => {
    vi.useFakeTimers();
    const { onCardClick } = renderHand();
    const card = screen.getByRole("button", { name: /Gobelin/ });

    fireEvent.pointerDown(card, { clientX: 0, clientY: 0, button: 0 });
    act(() => vi.advanceTimersByTime(400));

    expect(screen.getByRole("dialog", { name: "Gobelin" })).toBeInTheDocument();
    expect(screen.getByText("Description de Gobelin")).toBeInTheDocument();

    fireEvent.pointerUp(card);
    fireEvent.click(card);

    expect(onCardClick).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("marque la carte sélectionnée", () => {
    renderHand({ selectedCard: 0 });

    expect(screen.getByRole("button", { name: /Gobelin/ })).toHaveClass(
      "fhand-card--selected",
    );
  });
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `pnpm --filter @pipou/frontend exec vitest run src/__tests__/components/FightHand.test.tsx`
Expected: FAIL — erreur de type sur `image` dans `HandCard` puis aucun `role="button"` nommé « Gobelin » (la main actuelle n'en a pas).

- [ ] **Step 3: Typer `HandCard` et y ajouter l'illustration**

`apps/frontend/src/features/fight/handCard.ts` :

```ts
import type { CardType, Rarity, SupportType } from "@pipou/shared";
import type { CardInstance } from "./fight.types";
import type { RawEffect } from "./fight.effects";

/** Carte de la main, aplatie pour l'affichage et les actions. */
export interface HandCard {
  instanceId: string;
  id: number;
  name: string;
  type: CardType;
  atk: number;
  hp: number;
  cost: number;
  rarity: Rarity;
  supportType?: SupportType;
  image: { url: string } | null;
  // ── Enrichis pour l'inspection ───────────────────────────────────────────
  effects?: RawEffect[] | null;
  description?: string | null;
}

/** Convertit une CardInstance (envoyée par le serveur) en HandCard. */
export function toHandCard(c: CardInstance): HandCard {
  return {
    instanceId: c.instanceId,
    id: c.baseCard.id,
    name: c.baseCard.name,
    type: c.baseCard.type,
    atk: c.baseCard.atk,
    hp: c.baseCard.hp,
    cost: c.baseCard.cost,
    rarity: c.baseCard.rarity,
    supportType: c.baseCard.supportType ?? undefined,
    image: c.baseCard.image,
    effects: c.baseCard.effects ?? null,
    description: c.baseCard.description ?? null,
  };
}
```

- [ ] **Step 4: Réécrire `FightHand.tsx`**

```tsx
import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import "./FightHand.css";
import type { Phase } from "./fight.types";
import type { HandCard } from "./handCard";
import InspectableCard from "./InspectableCard";
import CardInspect from "./CardInspect";
import { getCardEffectEntries } from "./fight.effects";
import { fanLayout } from "./fanLayout";

/** Largeur d'une carte de la main (px) — doit suivre .fhand-card. */
const HAND_CARD_WIDTH = 84;
/** Largeur utilisée avant la première mesure (coque mobile 430px). */
const DEFAULT_HAND_WIDTH = 400;

interface Props {
  hand: HandCard[];
  phase: Phase;
  isMyTurn: boolean;
  selectedCard: number | null;
  payIndices: number[];
  freeSummonInstanceIds: string[];
  onCardClick: (idx: number, card: HandCard) => void;
}

export default function FightHand({
  hand,
  phase,
  isMyTurn,
  selectedCard,
  payIndices,
  freeSummonInstanceIds,
  onCardClick,
}: Props) {
  const isInteractive = isMyTurn && (phase === "main" || phase === "end");
  const mustDiscard = phase === "end" && isMyTurn && hand.length > 7;

  const [inspectedIdx, setInspectedIdx] = useState<number | null>(null);
  const inspected = inspectedIdx !== null ? hand[inspectedIdx] : undefined;

  // ── Largeur disponible pour l'éventail ────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(DEFAULT_HAND_WIDTH);
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const slots = fanLayout(hand.length, width, HAND_CARD_WIDTH);

  return (
    <div className="fhand" ref={containerRef}>
      {hand.map((card, idx) => {
        const isSelected = selectedCard === idx;
        const isPaying = payIndices.includes(idx);
        const isPayable =
          !isSelected && selectedCard !== null && phase === "main";
        const isFree = freeSummonInstanceIds.includes(card.instanceId);
        const slot = slots[idx];

        return (
          <InspectableCard
            key={card.instanceId}
            card={card}
            size="xs"
            className={[
              "fhand-card",
              isSelected ? "fhand-card--selected" : "",
              isPaying ? "fhand-card--paying" : "",
              isInteractive ? "fhand-card--interactive" : "",
              isPayable && !isPaying ? "fhand-card--payable" : "",
              phase === "end" && isMyTurn ? "fhand-card--discard-hint" : "",
              isFree ? "fhand-card--free" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={
              {
                marginLeft: slot.marginLeft,
                zIndex: idx,
                "--fan-rotate": `${slot.rotateDeg}deg`,
                "--fan-y": `${slot.offsetY}px`,
              } as CSSProperties
            }
            onClick={isInteractive ? () => onCardClick(idx, card) : undefined}
            onInspect={() => setInspectedIdx(idx)}
            onInspectEnd={() => setInspectedIdx(null)}
          >
            {isFree && <span className="fhand-free-label">GRATUIT ⚡</span>}
            {isPaying && (
              <div className="fhand-pay-badge" title="Carte de paiement">
                💰
              </div>
            )}
            {isSelected && <div className="fhand-selected-badge">✓</div>}
            {mustDiscard && (
              <div className="fhand-discard-label">défausser</div>
            )}
          </InspectableCard>
        );
      })}

      {inspected && (
        <CardInspect
          card={inspected}
          entries={getCardEffectEntries(
            inspected.effects,
            inspected.description,
            inspected.supportType,
          )}
          onClose={() => setInspectedIdx(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 5: Réécrire `FightHand.css`**

```css
/* ── Éventail ─────────────────────────────────────────────────────────────── */
.fhand {
  display: flex;
  justify-content: center;
  align-items: flex-end;
  min-height: 170px;
  padding: 28px 8px 12px;
}

/* Pas de défilement dans la main : tout le geste sert à l'appui long */
.fhand .icard {
  touch-action: none;
}

/* ── Carte : largeur fixe = HAND_CARD_WIDTH ───────────────────────────────── */
.fhand-card {
  flex: 0 0 84px;
  width: 84px;
  transform-origin: bottom center;
  transform: translateY(var(--fan-y, 0px)) rotate(var(--fan-rotate, 0deg));
  transition:
    transform 0.18s ease,
    margin-left 0.18s ease;
}

.fhand-card .card-face {
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.3);
}

/* Redressée et au premier plan */
.fhand-card--interactive:hover,
.fhand-card--selected,
.fhand-card--paying {
  transform: translateY(-22px) rotate(0deg);
  z-index: 50 !important;
}

/* ── États (contour autour de la carte) ───────────────────────────────────── */
.fhand-card--selected .card-face {
  box-shadow:
    0 0 0 3px #7a1c3b,
    0 8px 14px rgba(0, 0, 0, 0.3);
}

.fhand-card--paying .card-face {
  box-shadow:
    0 0 0 3px #e67e22,
    0 6px 12px rgba(0, 0, 0, 0.25);
}

.fhand-card--payable:not(.fhand-card--paying) .card-face {
  box-shadow:
    0 0 0 2px rgba(122, 28, 59, 0.35),
    0 3px 8px rgba(0, 0, 0, 0.3);
  opacity: 0.9;
}

.fhand-card--discard-hint .card-face {
  box-shadow:
    0 0 0 2px #e74c3c,
    0 3px 8px rgba(0, 0, 0, 0.3);
}

.fhand-card--free .card-face {
  box-shadow:
    0 0 0 3px #27ae60,
    0 3px 8px rgba(0, 0, 0, 0.3);
}

/* ── Pastilles ────────────────────────────────────────────────────────────── */
.fhand-pay-badge,
.fhand-selected-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  border: 1.5px solid #fff;
  z-index: 3;
}

.fhand-pay-badge {
  background: #e67e22;
}

.fhand-selected-badge {
  background: #7a1c3b;
  color: #fff;
  font-size: 9px;
}

.fhand-free-label {
  position: absolute;
  top: -14px;
  left: 50%;
  transform: translateX(-50%);
  background: #27ae60;
  color: #fff;
  font-size: 8px;
  font-weight: 700;
  border-radius: 99px;
  padding: 1px 5px;
  white-space: nowrap;
  z-index: 3;
}

.fhand-discard-label {
  position: absolute;
  bottom: -14px;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 9px;
  color: #e74c3c;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
```

- [ ] **Step 6: Vérifier**

Run: `pnpm --filter @pipou/frontend exec vitest run src/__tests__/components/FightHand.test.tsx`
Expected: PASS (5 tests).
Run: `pnpm --filter @pipou/frontend test && pnpm --filter @pipou/frontend typecheck && pnpm --filter @pipou/frontend lint`
Expected: aucune erreur (si `typecheck` signale un autre constructeur de `HandCard` — par ex. dans `features/sandbox` —, lui ajouter `image: null` ou la valeur source).

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/src/features/fight/handCard.ts apps/frontend/src/features/fight/FightHand.tsx apps/frontend/src/features/fight/FightHand.css apps/frontend/src/__tests__/components/FightHand.test.tsx
git commit -m "feat(fight): show the hand as a fan of illustrated cards

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Cartes illustrées sur le terrain

**Files:**
- Modify: `apps/frontend/src/features/fight/Zonerow/zoneRow.helpers.ts`
- Modify (réécriture): `apps/frontend/src/features/fight/Zonerow/MonsterZoneContent.tsx`, `SupportZoneContent.tsx`, `SupportZoneContent.css`
- Modify: `apps/frontend/src/features/fight/Zonerow/MonsterZoneContent.css`, `ZoneRow.tsx`, `ZoneRow.css`
- Create: `apps/frontend/src/__tests__/fixtures/monster.ts` (fabrique partagée par les deux tests ; ne jamais importer un fichier `.test.ts` depuis un autre test, ses `describe` seraient rejoués)
- Test: `apps/frontend/src/__tests__/unit/zoneRow.helpers.test.ts`, `apps/frontend/src/__tests__/components/MonsterZoneContent.test.tsx` (nouveaux)

**Interfaces:**
- Consumes: `InspectableCard`, `CardInspect` (tâche 5), `CardFace` + `CardFaceStats` (tâche 2), `getMonsterBuffEntries`, `getSupportBuffEntries` (`zoneRow.effects.ts`).
- Produces :
  ```ts
  export function monsterFaceStats(zone: MonsterOnBoard): CardFaceStats
  export function hasSpentAttacks(zone: MonsterOnBoard): boolean
  // MonsterZoneContent props : { zone; isOpponent; onModeChange?; onInspect: () => void; onInspectEnd: () => void }
  // SupportZoneContent props : { zone: CardInstance; onInspect: () => void; onInspectEnd: () => void }
  ```

- [ ] **Step 1: Écrire les tests qui échouent**

`apps/frontend/src/__tests__/fixtures/monster.ts` :

```ts
import type { MonsterOnBoard } from "@pipou/shared";

/** Gobelin 100 ATK / 500 PV en jeu, sans buff ni état ; `patch` écrase les champs. */
export function monster(patch: Partial<MonsterOnBoard> = {}): MonsterOnBoard {
  return {
    instanceId: "m1",
    card: {
      instanceId: "m1",
      ownerId: 1,
      baseCard: {
        id: 1,
        name: "Gobelin",
        rarity: "common",
        type: "monster",
        atk: 100,
        hp: 500,
        cost: 1,
        supportType: null,
        archetype: null,
        effects: null,
        description: null,
        image: null,
      },
    },
    currentHp: 500,
    mode: "attack",
    equipments: [],
    atkBuff: 0,
    hpBuff: 0,
    tempAtkBuff: 0,
    perm: {
      atk: 0,
      hp: 0,
      taunt: false,
      piercing: false,
      debuffImmune: false,
      attacksPerTurn: 1,
    },
    hasAttackedThisTurn: false,
    attacksPerTurn: 1,
    attacksUsedThisTurn: 0,
    hasTaunt: false,
    hasPiercing: false,
    isImmuneToDebuffs: false,
    forcedAttackMode: false,
    summonedThisTurn: false,
    doubleAtkNextTurn: false,
    extraAttacksThisTurn: 0,
    cannotAttackOnSummonTurn: false,
    ...patch,
  };
}
```

`apps/frontend/src/__tests__/unit/zoneRow.helpers.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import {
  hasSpentAttacks,
  monsterFaceStats,
} from "../../features/fight/Zonerow/zoneRow.helpers";
import { monster } from "../fixtures/monster";

describe("monsterFaceStats", () => {
  it("renvoie les stats de base sans état", () => {
    expect(monsterFaceStats(monster())).toEqual({
      atk: 100,
      hp: 500,
      atkState: undefined,
      hpState: undefined,
    });
  });

  it("additionne buffs permanents et temporaires d'ATK", () => {
    const stats = monsterFaceStats(monster({ atkBuff: 50, tempAtkBuff: 25 }));
    expect(stats.atk).toBe(175);
    expect(stats.atkState).toBe("up");
  });

  it("marque une ATK réduite en baisse", () => {
    expect(monsterFaceStats(monster({ atkBuff: -40 })).atkState).toBe("down");
  });

  it("marque des PV blessés en baisse, même buffés", () => {
    const stats = monsterFaceStats(monster({ hpBuff: 200, currentHp: 600 }));
    expect(stats.hp).toBe(600);
    expect(stats.hpState).toBe("down");
  });

  it("marque des PV buffés intacts en hausse", () => {
    expect(
      monsterFaceStats(monster({ hpBuff: 200, currentHp: 700 })).hpState,
    ).toBe("up");
  });
});

describe("hasSpentAttacks", () => {
  it("vrai quand toutes les attaques du tour sont utilisées", () => {
    expect(
      hasSpentAttacks(
        monster({ hasAttackedThisTurn: true, attacksUsedThisTurn: 1 }),
      ),
    ).toBe(true);
  });

  it("faux s'il reste une attaque", () => {
    expect(
      hasSpentAttacks(
        monster({
          hasAttackedThisTurn: true,
          attacksUsedThisTurn: 1,
          attacksPerTurn: 2,
        }),
      ),
    ).toBe(false);
  });
});
```

`apps/frontend/src/__tests__/components/MonsterZoneContent.test.tsx` :

```tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import MonsterZoneContent from "../../features/fight/Zonerow/MonsterZoneContent";
import { monster } from "../fixtures/monster";

describe("MonsterZoneContent", () => {
  afterEach(() => vi.useRealTimers());

  it("montre la carte avec stats courantes, garde et badges", () => {
    const { container } = render(
      <MonsterZoneContent
        zone={monster({
          mode: "guard",
          currentHp: 300,
          atkBuff: 50,
          hasTaunt: true,
        })}
        isOpponent
        onInspect={vi.fn()}
        onInspectEnd={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Gobelin, 150 ATK, 300 PV" }),
    ).toBeInTheDocument();
    expect(container.querySelector(".card-face")).toHaveClass(
      "card-face--guard",
    );
    expect(screen.getByTitle("Provocation")).toBeInTheDocument();
  });

  it("grise un monstre qui a fini d'attaquer", () => {
    render(
      <MonsterZoneContent
        zone={monster({ hasAttackedThisTurn: true, attacksUsedThisTurn: 1 })}
        isOpponent={false}
        onInspect={vi.fn()}
        onInspectEnd={vi.fn()}
      />,
    );

    expect(screen.getByText("a attaqué")).toBeInTheDocument();
  });

  it("change de mode et s'inspecte par appui long", () => {
    vi.useFakeTimers();
    const onModeChange = vi.fn();
    const onInspect = vi.fn();
    render(
      <MonsterZoneContent
        zone={monster()}
        isOpponent={false}
        onModeChange={onModeChange}
        onInspect={onInspect}
        onInspectEnd={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "🛡️" }));
    expect(onModeChange).toHaveBeenCalledWith("m1", "guard");

    const card = screen.getByRole("button", { name: /Gobelin/ });
    fireEvent.pointerDown(card, { clientX: 0, clientY: 0, button: 0 });
    act(() => vi.advanceTimersByTime(400));
    expect(onInspect).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `pnpm --filter @pipou/frontend exec vitest run src/__tests__/unit/zoneRow.helpers.test.ts src/__tests__/components/MonsterZoneContent.test.tsx`
Expected: FAIL — `monsterFaceStats` / `hasSpentAttacks` non exportés, props `onInspect` inconnues.

- [ ] **Step 3: Ajouter les helpers**

À la fin de `zoneRow.helpers.ts` (et ajouter l'import `import type { CardFaceStats } from "../../cards/CardFace";`) :

```ts
/** Stats affichées sur la carte d'un monstre en jeu, avec leur tendance. */
export function monsterFaceStats(zone: MonsterOnBoard): CardFaceStats {
  const base = zone.card.baseCard;
  const atk = base.atk + zone.atkBuff + (zone.tempAtkBuff ?? 0);
  const maxHp = base.hp + zone.hpBuff;
  return {
    atk,
    hp: zone.currentHp,
    atkState: atk > base.atk ? "up" : atk < base.atk ? "down" : undefined,
    hpState:
      zone.currentHp < maxHp
        ? "down"
        : zone.currentHp > base.hp
          ? "up"
          : undefined,
  };
}

/** Toutes les attaques du tour ont été utilisées. */
export function hasSpentAttacks(zone: MonsterOnBoard): boolean {
  return (
    zone.hasAttackedThisTurn && zone.attacksUsedThisTurn >= zone.attacksPerTurn
  );
}
```

- [ ] **Step 4: Réécrire `MonsterZoneContent.tsx`**

```tsx
import { getEquipmentEntries } from "./zoneRow.effects";
import {
  hasSpentAttacks,
  isBlockedFromAttacking,
  monsterFaceStats,
} from "./zoneRow.helpers";
import InspectableCard from "../InspectableCard";
import type { MonsterOnBoard } from "../fight.types";
import type { CombatMode } from "@pipou/shared";
import "./MonsterZoneContent.css";

interface Props {
  zone: MonsterOnBoard;
  isOpponent: boolean;
  onModeChange?: (instanceId: string, mode: CombatMode) => void;
  onInspect: () => void;
  onInspectEnd: () => void;
}

export default function MonsterZoneContent({
  zone,
  isOpponent,
  onModeChange,
  onInspect,
  onInspectEnd,
}: Props) {
  const blocked = isBlockedFromAttacking(zone);

  const badges = (
    <>
      {zone.hasTaunt && (
        <span className="zr-badge zr-badge--taunt" title="Provocation">
          🛡
        </span>
      )}
      {zone.hasPiercing && (
        <span className="zr-badge zr-badge--piercing" title="Perçant">
          🗡
        </span>
      )}
      {zone.isImmuneToDebuffs && (
        <span className="zr-badge zr-badge--immune" title="Immunité débuffs">
          ✨
        </span>
      )}
      {blocked && (
        <span
          className="zr-badge zr-badge--sleep"
          title="Ne peut pas attaquer ce tour"
        >
          💤
        </span>
      )}
      {zone.doubleAtkNextTurn && (
        <span
          className="zr-badge zr-badge--charge"
          title="Double attaque au prochain tour"
        >
          ⚡
        </span>
      )}
      {zone.attacksPerTurn > 1 && !blocked && (
        <span className="zr-badge zr-badge--multi" title="Double attaque">
          ×{zone.attacksPerTurn - zone.attacksUsedThisTurn}
        </span>
      )}
      {zone.turnCounter !== undefined && (
        <span
          className={[
            "zr-badge zr-badge--counter",
            zone.turnCounter <= 1 ? "zr-badge--counter-urgent" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          title={`S'autodétruit dans ${zone.turnCounter} tour(s)`}
        >
          ⏳{zone.turnCounter}
        </span>
      )}
      {(zone.blockAttackTurns ?? 0) > 0 && (
        <span
          className="zr-badge zr-badge--sleep"
          title={`Ne peut pas attaquer encore ${zone.blockAttackTurns} tour(s)`}
        >
          🧊{zone.blockAttackTurns}
        </span>
      )}
      {zone.guardLocked && (
        <span
          className="zr-badge zr-badge--taunt"
          title="Verrouillé en mode Garde jusqu'à être attaqué"
        >
          🔒
        </span>
      )}
    </>
  );

  return (
    <div className="zr-monster">
      <InspectableCard
        className="zr-card"
        card={zone.card.baseCard}
        size="xs"
        stats={monsterFaceStats(zone)}
        guard={zone.mode === "guard"}
        spent={hasSpentAttacks(zone)}
        badges={badges}
        onInspect={onInspect}
        onInspectEnd={onInspectEnd}
      />

      {Array.isArray(zone.equipments) && zone.equipments.length > 0 && (
        <div className="zr-equipment-list">
          {zone.equipments.map((eq, eIdx) => {
            const effectSummary = getEquipmentEntries(eq)
              .map((e) => e.label)
              .join(" | ");
            const shortName =
              (eq.baseCard?.name ?? "?").length > 10
                ? (eq.baseCard?.name ?? "?").slice(0, 9) + "…"
                : (eq.baseCard?.name ?? "?");
            return (
              <span
                key={eIdx}
                className="zr-equipment-chip"
                title={`${eq.baseCard?.name ?? "?"}\n${effectSummary}`}
              >
                🔧 {shortName}
              </span>
            );
          })}
        </div>
      )}

      {!isOpponent && onModeChange && !zone.forcedAttackMode && (
        <div className="zr-mode-btns">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onModeChange(zone.instanceId, "attack");
            }}
            className={`zr-mode-btn${zone.mode === "attack" ? " zr-mode-btn--active" : ""}`}
          >
            ⚔️
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onModeChange(zone.instanceId, "guard");
            }}
            className={`zr-mode-btn${zone.mode === "guard" ? " zr-mode-btn--active" : ""}`}
          >
            🛡️
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Mettre à jour `MonsterZoneContent.css`**

Remplacer la règle `.zr-monster { … }` par :

```css
.zr-monster {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 100%;
}

.zr-card {
  width: min(100%, 100px);
}
```

Supprimer les blocs `/* Mode chip */` (`.zr-mode-chip`, `--attack`, `--guard`) et `/* Name & stats */` (`.zr-monster-name`, `.zr-monster-stats`, `.zr-attacked`). Dans `.zr-badge`, remplacer `background: rgba(0, 0, 0, 0.08);` par `background: rgba(255, 255, 255, 0.9);` et passer `font-size` à `9px`. Le reste (boutons de mode, couleurs de badges, équipements) ne change pas.

- [ ] **Step 6: Réécrire `SupportZoneContent.tsx` et `.css`**

```tsx
import InspectableCard from "../InspectableCard";
import type { CardInstance } from "../fight.types";
import "./SupportZoneContent.css";

interface Props {
  zone: CardInstance;
  onInspect: () => void;
  onInspectEnd: () => void;
}

export default function SupportZoneContent({
  zone,
  onInspect,
  onInspectEnd,
}: Props) {
  return (
    <div className="zr-support">
      <InspectableCard
        className="zr-card"
        card={zone.baseCard}
        size="xs"
        onInspect={onInspect}
        onInspectEnd={onInspectEnd}
      />
    </div>
  );
}
```

`SupportZoneContent.css` (contenu complet) :

```css
.zr-support {
  display: flex;
  justify-content: center;
  width: 100%;
}
```

- [ ] **Step 7: Brancher l'inspection dans `ZoneRow.tsx`**

1. Imports : retirer `import "../BuffDebuffList.css";` et `import BuffDebuffList from "../BuffDebuffList";` ; ajouter `import CardFace from "../../cards/CardFace";`, `import CardInspect from "../CardInspect";` et `monsterFaceStats` à l'import de `./zoneRow.helpers`.
2. Remplacer l'état `openBuffIdx` / `anchorRect` / `openZone` et la fonction `handleBadgeClick` par :

```tsx
  const [inspectIdx, setInspectIdx] = useState<number | null>(null);
  const inspected = inspectIdx !== null ? zones[inspectIdx] : null;
```

3. Supprimer le bouton `{!!zone && (<button className={`bdl-trigger…`} …>i</button>)}`.
4. Le contenu des zones devient :

```tsx
              {zone ? (
                isMonsterZone(zone) ? (
                  <MonsterZoneContent
                    zone={zone}
                    isOpponent={isOpponent}
                    onModeChange={onModeChange}
                    onInspect={() => setInspectIdx(idx)}
                    onInspectEnd={() => setInspectIdx(null)}
                  />
                ) : (
                  <SupportZoneContent
                    zone={zone}
                    onInspect={() => setInspectIdx(idx)}
                    onInspectEnd={() => setInspectIdx(null)}
                  />
                )
              ) : isShattering && dyingData ? (
                <div className="zr-monster zr-dying-content">
                  <div className="zr-card">
                    {isMonsterZone(dyingData) ? (
                      <CardFace
                        card={dyingData.card.baseCard}
                        size="xs"
                        stats={{
                          atk: dyingData.card.baseCard.atk,
                          hp: 0,
                          hpState: "down",
                        }}
                        guard={dyingData.mode === "guard"}
                      />
                    ) : (
                      <CardFace card={dyingData.baseCard} size="xs" />
                    )}
                  </div>
                </div>
              ) : isZetaTarget ? (
                <span className="zr-zeta-hint">🦠 Poser Zeta</span>
              ) : (
                <span className="zr-empty-plus">+</span>
              )}
```

5. Remplacer le bloc final `{openZone && anchorRect && (<BuffDebuffList … />)}` par :

```tsx
      {inspected && (
        <CardInspect
          card={
            isMonsterZone(inspected)
              ? inspected.card.baseCard
              : inspected.baseCard
          }
          stats={
            isMonsterZone(inspected) ? monsterFaceStats(inspected) : undefined
          }
          guard={isMonsterZone(inspected) && inspected.mode === "guard"}
          entries={
            isMonsterZone(inspected)
              ? getMonsterBuffEntries(inspected)
              : getSupportBuffEntries(inspected)
          }
          onClose={() => setInspectIdx(null)}
        />
      )}
```

- [ ] **Step 8: Agrandir les zones**

Dans `ZoneRow.css`, règle `.zr-zone` : remplacer `min-height: 100px;` par `min-height: 150px;` et `padding: 6px;` par `padding: 4px;`.

- [ ] **Step 9: Supprimer `BuffDebuffList` (plus utilisé)**

```bash
git rm apps/frontend/src/features/fight/BuffDebuffList.tsx apps/frontend/src/features/fight/BuffDebuffList.css
```

Puis retirer de `BuffDebuffSections.css` la règle `.bdl-popup .bdl-root { … }` devenue inutile.
Run: `grep -rn "BuffDebuffList\|bdl-trigger\|bdl-popup" apps/frontend/src`
Expected: aucune occurrence.

- [ ] **Step 10: Vérifier**

Run: `pnpm --filter @pipou/frontend exec vitest run src/__tests__/unit/zoneRow.helpers.test.ts src/__tests__/components/MonsterZoneContent.test.tsx`
Expected: PASS (10 tests).
Run: `pnpm --filter @pipou/frontend test && pnpm --filter @pipou/frontend typecheck && pnpm --filter @pipou/frontend lint`
Expected: aucune erreur.

- [ ] **Step 11: Commit**

```bash
git add -A apps/frontend/src/features/fight apps/frontend/src/__tests__
git commit -m "feat(fight): illustrated cards on the board with guard and combat states

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Modale de choix, cimetière et mulligan illustrés

**Files:**
- Modify: `apps/frontend/src/features/fight/CardPickModal.tsx`, `CardPickModal.css`
- Modify: `apps/frontend/src/features/fight/GraveyardPile.tsx`, `GraveyardPile.css`
- Modify: `apps/frontend/src/features/fight/MulliganPanel.tsx`, `MulliganPanel.css`
- Test: `apps/frontend/src/__tests__/components/CardPickModal.test.tsx` (nouveau), `apps/frontend/src/__tests__/components/MulliganPanel.test.tsx` (complété), `apps/frontend/src/__tests__/components/GraveyardPile.test.tsx` (nouveau)

**Interfaces:**
- Consumes: `InspectableCard`, `CardInspect` (tâche 5), `getCardEffectEntries` (`fight.effects.ts`), `ClientChoiceCandidate` avec `cost`/`image`/`description` (tâche 1).

- [ ] **Step 1: Écrire les tests qui échouent**

`apps/frontend/src/__tests__/components/CardPickModal.test.tsx` :

```tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import CardPickModal from "../../features/fight/CardPickModal";
import type { PendingChoice } from "../../features/fight/fight.types";

const choice: PendingChoice = {
  count: 1,
  prompt: "Récupérer une carte",
  resolution: "pick_to_hand",
  candidates: ["Gobelin", "Ogre"].map((name, i) => ({
    instanceId: `c${i}`,
    source: "graveyard" as const,
    baseCard: {
      id: i + 1,
      name,
      type: "monster" as const,
      atk: 100,
      hp: 500,
      rarity: "rare" as const,
      supportType: null,
      cost: 2,
      image: null,
      description: `Texte de ${name}`,
    },
  })),
};

describe("CardPickModal", () => {
  afterEach(() => vi.useRealTimers());

  it("sélectionne une carte au tap puis confirme", () => {
    const onConfirm = vi.fn();
    render(<CardPickModal choice={choice} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole("button", { name: /Ogre/ }));
    fireEvent.click(screen.getByRole("button", { name: /Récupérer \(1\/1\)/ }));

    expect(onConfirm).toHaveBeenCalledWith(["c1"]);
  });

  it("inspecte une carte par appui long sans la sélectionner", () => {
    vi.useFakeTimers();
    render(<CardPickModal choice={choice} onConfirm={vi.fn()} />);
    const card = screen.getByRole("button", { name: /Gobelin/ });

    fireEvent.pointerDown(card, { clientX: 0, clientY: 0, button: 0 });
    act(() => vi.advanceTimersByTime(400));

    expect(screen.getByRole("dialog", { name: "Gobelin" })).toBeInTheDocument();
    expect(screen.getByText("Texte de Gobelin")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /\(0\/1\)/ })).toBeDisabled();
  });
});
```

`apps/frontend/src/__tests__/components/GraveyardPile.test.tsx` :

```tsx
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { CardInstance } from "@pipou/shared";
import GraveyardPile from "../../features/fight/GraveyardPile";

const dead: CardInstance = {
  instanceId: "d1",
  ownerId: 1,
  baseCard: {
    id: 4,
    name: "Squelette",
    rarity: "uncommon",
    type: "monster",
    atk: 80,
    hp: 200,
    cost: 1,
    supportType: null,
    archetype: null,
    effects: null,
    description: "Revient parfois",
    image: null,
  },
};

describe("GraveyardPile", () => {
  it("ouvre le cimetière avec les cartes illustrées", () => {
    render(<GraveyardPile graveyard={[dead]} label="Moi" />);

    fireEvent.click(screen.getByTitle("Cimetière (1)"));

    expect(
      screen.getByRole("button", { name: "Squelette, 80 ATK, 200 PV" }),
    ).toBeInTheDocument();
  });

  it("le clic droit inspecte la carte", () => {
    render(<GraveyardPile graveyard={[dead]} label="Moi" />);
    fireEvent.click(screen.getByTitle("Cimetière (1)"));

    fireEvent.contextMenu(screen.getByRole("button", { name: /Squelette/ }));

    expect(
      screen.getByRole("dialog", { name: "Squelette" }),
    ).toBeInTheDocument();
  });
});
```

Ajouter à `MulliganPanel.test.tsx` (dans le `describe` existant ; ajouter `fireEvent` à l'import de `@testing-library/react`) :

```tsx
  it("inspecte une carte de la main de départ", () => {
    render(
      <MulliganPanel
        hand={[card("Gobelin")]}
        decided={false}
        opponentDecided={false}
        opponentName="Bob"
        onDecide={vi.fn()}
      />,
    );

    fireEvent.contextMenu(screen.getByRole("button", { name: /Gobelin/ }));

    expect(screen.getByRole("dialog", { name: "Gobelin" })).toBeInTheDocument();
  });
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `pnpm --filter @pipou/frontend exec vitest run src/__tests__/components/CardPickModal.test.tsx src/__tests__/components/GraveyardPile.test.tsx src/__tests__/components/MulliganPanel.test.tsx`
Expected: FAIL — pas de `role="button"` nommé par la carte, pas de `dialog`.

- [ ] **Step 3: `CardPickModal`**

1. Imports : retirer `RARITY_COLOR` ; ajouter `import type { CSSProperties } from "react";`, `import InspectableCard from "./InspectableCard";`, `import CardInspect from "./CardInspect";`.
2. Ajouter l'état après `selected` :

```tsx
  const [inspected, setInspected] = useState<ClientChoiceCandidate | null>(
    null,
  );
```

3. Remplacer le contenu de `<div className="cpm-grid">` par :

```tsx
          {choice.candidates.map((c: ClientChoiceCandidate) => {
            const isSelected = selected.includes(c.instanceId);
            return (
              <InspectableCard
                key={c.instanceId}
                card={c.baseCard}
                size="sm"
                className={[
                  "cpm-card",
                  isSelected ? "cpm-card--selected" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={{ "--cpm-accent": headerColor } as CSSProperties}
                onClick={() => toggle(c.instanceId)}
                onInspect={() => setInspected(c)}
                onInspectEnd={() => setInspected(null)}
              >
                {isSelected && (
                  <span
                    className="cpm-check"
                    style={{ background: headerColor }}
                  >
                    {icon}
                  </span>
                )}
                <div className="cpm-source">{sourceLabel(c.source)}</div>
              </InspectableCard>
            );
          })}
```

4. Juste avant la fermeture de `<div className="cpm-modal">`, ajouter :

```tsx
        {inspected && (
          <CardInspect
            card={inspected.baseCard}
            entries={[]}
            onClose={() => setInspected(null)}
          />
        )}
```

5. Dans `CardPickModal.css`, supprimer toutes les règles `.cpm-card…`, `.cpm-check`, `.cpm-source`, `.cpm-name`, `.cpm-sub` et ajouter :

```css
.cpm-card {
  width: 96px;
}

.cpm-card .card-face {
  transition: box-shadow 0.15s;
}

.cpm-card--selected .card-face {
  box-shadow: 0 0 0 3px var(--cpm-accent, #7a1c3b);
}

.cpm-check {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: #fff;
  border: 1.5px solid #fff;
  z-index: 3;
}

.cpm-source {
  margin-top: 4px;
  text-align: center;
  font-size: 9px;
  color: #888;
}
```

- [ ] **Step 4: `GraveyardPile`**

1. Imports : ajouter `import InspectableCard from "./InspectableCard";`, `import CardInspect from "./CardInspect";`, `import { getCardEffectEntries } from "./fight.effects";`.
2. Ajouter l'état : `const [inspected, setInspected] = useState<CardInstance | null>(null);`.
3. Remplacer le contenu de `<div className="gp-list">` par :

```tsx
              {[...graveyard].reverse().map((c) => (
                <InspectableCard
                  key={c.instanceId}
                  card={c.baseCard}
                  size="sm"
                  onInspect={() => setInspected(c)}
                  onInspectEnd={() => setInspected(null)}
                />
              ))}
```

4. Juste avant la fermeture de `<div className="gp-modal">`, ajouter :

```tsx
            {inspected && (
              <CardInspect
                card={inspected.baseCard}
                entries={getCardEffectEntries(
                  inspected.baseCard.effects,
                  inspected.baseCard.description,
                  inspected.baseCard.supportType,
                )}
                onClose={() => setInspected(null)}
              />
            )}
```

5. Dans `GraveyardPile.css`, remplacer `.gp-list { … }` par la grille ci-dessous et supprimer `.gp-card`, `.gp-card-name`, `.gp-card-type`, `.gp-card-stats` :

```css
.gp-list {
  overflow-y: auto;
  padding: 10px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
  gap: 8px;
}
```

- [ ] **Step 5: `MulliganPanel`**

1. Imports : ajouter `import { useState } from "react";`, `import InspectableCard from "./InspectableCard";`, `import CardInspect from "./CardInspect";`, `import { getCardEffectEntries } from "./fight.effects";`.
2. Ajouter dans le composant : `const [inspected, setInspected] = useState<CardInstance | null>(null);`.
3. Remplacer le contenu de `<div className="mull-hand">` par :

```tsx
        {hand.map((c) => (
          <InspectableCard
            key={c.instanceId}
            className="mull-card"
            card={c.baseCard}
            size="sm"
            onInspect={() => setInspected(c)}
            onInspectEnd={() => setInspected(null)}
          />
        ))}
```

4. Avant la fermeture de `<div className="mull-root">`, ajouter :

```tsx
      {inspected && (
        <CardInspect
          card={inspected.baseCard}
          entries={getCardEffectEntries(
            inspected.baseCard.effects,
            inspected.baseCard.description,
            inspected.baseCard.supportType,
          )}
          onClose={() => setInspected(null)}
        />
      )}
```

5. Dans `MulliganPanel.css`, remplacer `.mull-card { … }` par `.mull-card { width: 96px; }` et supprimer `.mull-card-name` et `.mull-card-sub`.

- [ ] **Step 6: Vérifier**

Run: `pnpm --filter @pipou/frontend exec vitest run src/__tests__/components/CardPickModal.test.tsx src/__tests__/components/GraveyardPile.test.tsx src/__tests__/components/MulliganPanel.test.tsx`
Expected: PASS (7 tests).
Run: `pnpm --filter @pipou/frontend test && pnpm --filter @pipou/frontend typecheck && pnpm --filter @pipou/frontend lint`
Expected: aucune erreur.

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/src/features/fight/CardPickModal.tsx apps/frontend/src/features/fight/CardPickModal.css apps/frontend/src/features/fight/GraveyardPile.tsx apps/frontend/src/features/fight/GraveyardPile.css apps/frontend/src/features/fight/MulliganPanel.tsx apps/frontend/src/features/fight/MulliganPanel.css apps/frontend/src/__tests__/components/CardPickModal.test.tsx apps/frontend/src/__tests__/components/GraveyardPile.test.tsx apps/frontend/src/__tests__/components/MulliganPanel.test.tsx
git commit -m "feat(fight): illustrated cards in pick modal, graveyard and mulligan

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Vérification visuelle et vérification complète

Aucune modification commitée sauf correctifs CSS révélés par les captures. **Ne pas lancer le backend** (`.env` = prod Aiven) : on rend les composants seuls avec des données fictives.

**Files (temporaires, supprimés à la fin de la tâche) :**
- Create: `apps/frontend/duel-preview.html`
- Create: `apps/frontend/src/duel-preview.tsx`

- [ ] **Step 1: Créer la page d'aperçu**

`apps/frontend/duel-preview.html` :

```html
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Aperçu duel</title>
  </head>
  <body>
    <div id="preview" style="width: 430px; margin: 0 auto"></div>
    <script type="module" src="/src/duel-preview.tsx"></script>
  </body>
</html>
```

`apps/frontend/src/duel-preview.tsx` :

```tsx
import { createRoot } from "react-dom/client";
import type { CardInstance, MonsterOnBoard, Rarity } from "@pipou/shared";
import "./index.css";
import FightHand from "./features/fight/FightHand";
import ZoneRow from "./features/fight/Zonerow/ZoneRow";
import { toHandCard } from "./features/fight/handCard";

const rarities: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary", "secret"];

const inst = (i: number, type: "monster" | "support" = "monster"): CardInstance => ({
  instanceId: `c${i}`,
  ownerId: 1,
  baseCard: {
    id: i,
    name: ["Pipou Ninja", "Roi Touille", "Bulle", "Feuille", "Dragonnet", "Pixelman", "Ombre"][i % 7],
    rarity: rarities[i % rarities.length],
    type,
    atk: 100 * (i + 1),
    hp: 150 * (i + 2),
    cost: (i % 5) + 1,
    supportType: type === "support" ? "EQUIPMENT" : null,
    archetype: null,
    effects: null,
    description: "Une description d'exemple pour vérifier le pied de carte.",
    image: null,
  },
});

const mob = (i: number, patch: Partial<MonsterOnBoard>): MonsterOnBoard => ({
  instanceId: `m${i}`,
  card: inst(i),
  currentHp: inst(i).baseCard.hp,
  mode: "attack",
  equipments: [],
  atkBuff: 0,
  hpBuff: 0,
  tempAtkBuff: 0,
  perm: { atk: 0, hp: 0, taunt: false, piercing: false, debuffImmune: false, attacksPerTurn: 1 },
  hasAttackedThisTurn: false,
  attacksPerTurn: 1,
  attacksUsedThisTurn: 0,
  hasTaunt: false,
  hasPiercing: false,
  isImmuneToDebuffs: false,
  forcedAttackMode: false,
  summonedThisTurn: false,
  doubleAtkNextTurn: false,
  extraAttacksThisTurn: 0,
  cannotAttackOnSummonTurn: false,
  ...patch,
});

createRoot(document.getElementById("preview")!).render(
  <div style={{ padding: 8 }}>
    <ZoneRow
      label="Adversaire — Monstres"
      isOpponent
      zones={[mob(4, { mode: "guard", guardLocked: true }), null, mob(5, { currentHp: 100 })]}
    />
    <ZoneRow
      label="Mes Monstres"
      onModeChange={() => {}}
      zones={[
        mob(1, { atkBuff: 300, currentHp: 120, hasTaunt: true, hasPiercing: true }),
        mob(2, { mode: "guard" }),
        mob(3, { hasAttackedThisTurn: true, attacksUsedThisTurn: 1 }),
      ]}
    />
    <ZoneRow label="Mes Supports" isSupport zones={[inst(6, "support"), null, null]} />
    <FightHand
      hand={[0, 1, 2, 3, 4, 5, 6].map((i) => toHandCard(inst(i)))}
      phase="main"
      isMyTurn
      selectedCard={2}
      payIndices={[]}
      freeSummonInstanceIds={[]}
      onCardClick={() => {}}
    />
  </div>,
);
```

- [ ] **Step 2: Lancer Vite seul**

Run (en arrière-plan) : `pnpm --filter @pipou/frontend exec vite --port 5173`
Expected: `Local: http://localhost:5173/`.

- [ ] **Step 3: Capturer avec Playwright**

Script dans le dossier scratchpad (pas dans le repo), avec Playwright de `node_modules/.pnpm/playwright@1.63.0` et `channel: 'chrome'` :

```js
const { chromium } = require("<repo>/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright");
(async () => {
  const browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 });
  await page.goto("http://localhost:5173/duel-preview.html");
  await page.waitForTimeout(800);
  await page.screenshot({ path: "<scratchpad>/duel-board.png", fullPage: true });
  // Appui long sur la 4e carte de la main
  const box = await page.locator(".fhand-card").nth(3).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(600);
  await page.screenshot({ path: "<scratchpad>/duel-inspect.png" });
  await page.mouse.up();
  await browser.close();
})();
```

Vérifier sur les captures : palettes des 6 raretés lisibles ; ATK verte / PV rouges sur le monstre 1 ; voile bleu + 🛡️ sur les monstres en garde ; carte grise « a attaqué » ; badges 🛡 🗡 🔒 lisibles ; éventail de 7 cartes tenant dans 430px avec la carte 3 redressée ; overlay d'inspection (grande carte + description). Corriger le CSS si besoin, relancer les captures.

- [ ] **Step 4: Supprimer la page d'aperçu**

```bash
rm apps/frontend/duel-preview.html apps/frontend/src/duel-preview.tsx
```

Arrêter Vite.

- [ ] **Step 5: Vérification complète**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: tout passe.

- [ ] **Step 6: Commit des éventuels correctifs CSS**

```bash
git status --short
git add apps/frontend/src/features
git commit -m "style(fight): polish duel card visuals after visual check

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(À sauter s'il n'y a aucun correctif.)
