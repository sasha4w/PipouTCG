# Système de boutons — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer les ~100 styles de boutons du frontend par un composant `<Button>` à 6 variantes choisies selon le fond.

**Architecture:** Un composant React `components/Button.tsx` (variante, taille, état actif) stylé par `components/Button.css`, qui s'appuie sur des variables CSS déclarées dans `index.css`. Chaque écran remplace ses `<button className="...">` par `<Button variant=… size=…>` et supprime le CSS devenu inutile. Les éléments de jeu ne sont pas touchés.

**Tech Stack:** React 18, TypeScript strict, Vite, Vitest + Testing Library, CSS simple (pas de préprocesseur), i18next.

**Spec:** `docs/superpowers/specs/2026-10-01-button-system-design.md`

## Global Constraints

- Toutes les commandes se lancent depuis la racine du dépôt (`PipouTCG/`). Frontend : `pnpm --filter @pipou/frontend <script>`.
- Pas de `any`. Pas de composant déclaré dans un composant.
- Variantes autorisées, exactement : `primary`, `primary-inverse`, `ghost-gold`, `ghost-bordeaux`, `danger`, `danger-inverse`.
- Tailles autorisées, exactement : `sm`, `md`, `lg`, `icon`. `icon` exige `aria-label`.
- `active` seulement sur `ghost-gold` et `ghost-bordeaux`.
- Fond clair → `primary`, `ghost-bordeaux`, `danger`. Fond foncé → `primary-inverse`, `ghost-gold`, `danger-inverse`.
- Police des boutons : Comfortaa 700. Aucune forme pilule.
- `className` passée à `<Button>` : placement uniquement. Propriétés CSS autorisées dans une classe de placement : `margin*`, `flex`, `flex-grow`, `flex-shrink`, `flex-basis`, `align-self`, `justify-self`, `order`, `width`, `min-width`, `max-width`, `position`, `top`, `right`, `bottom`, `left`, `inset`, `z-index`, `grid-column`, `grid-row`. Exception : onglets en tuile de `Profile` et `Admin`, qui gardent aussi `flex-direction`, `gap`, `padding`.
- Ne jamais modifier les éléments de jeu : `FightBoard`, `FightActionBar`, `FightHand`, `FightTabBar` (sauf la ligne ajoutée à la tâche 3), `ZoneRow`, `MonsterZoneContent`, `GraveyardPile` (idem), `BuffDebuffList`, `Footer` (`cc-footer__item`), `FightHub` (`fh-card`), `marketplace-card-pick`, `marketplace-item-pick`, `opening-selector__thumb`, `bm-stepper__dot` (sauf la ligne de la tâche 3), `fr-bc-step`, `drm-rescue-option`, `cpm-btn-confirm`, `login-password-toggle`.
- Emojis ✏ 🗑 ⏸ ▶ et caractères ✕ × − + ← → `<` `>` dans un bouton migré : remplacés par les icônes SVG de `components/Icons.tsx`.
- Chaque tâche de migration ajoute ses lignes au fichier de vérification `docs/superpowers/specs/2026-10-01-button-system-checklist.md`.
- Commits : messages conventionnels en anglais, terminés par la ligne `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

## Structure des fichiers

| Fichier | Rôle |
|---|---|
| `apps/frontend/src/components/Button.tsx` (créé) | Composant `<Button>` et ses types |
| `apps/frontend/src/components/Button.css` (créé) | Styles `btn`, tailles, variantes, états |
| `apps/frontend/src/__tests__/components/Button.test.tsx` (créé) | Tests du composant |
| `apps/frontend/src/__tests__/components/Icons.test.tsx` (créé) | Tests des nouvelles icônes |
| `apps/frontend/src/__tests__/components/FilterPanel.test.tsx` (créé) | Test de la propriété `tone` |
| `apps/frontend/src/index.css` | Variables `--color-*`, remise à zéro du `button` global |
| `apps/frontend/src/components/Icons.tsx` | 7 nouvelles icônes |
| `apps/frontend/src/i18n/locales/{fr,en,ko}.json` | Clés `pagination.prev` / `pagination.next` |
| `docs/superpowers/specs/2026-10-01-button-system-checklist.md` (créé) | Liste de vérification pour l'utilisateur |
| Fichiers d'écran `*.tsx` / `*.css` | Migration, tâches 4 à 11 |

## Procédure de migration commune (tâches 4 à 11)

Chaque tâche de migration contient une table « Boutons ». Pour **chaque ligne** :

1. Dans le `.tsx`, repérer le `<button>` par son ancienne classe et son contenu (les numéros de ligne bougent, ne pas s'y fier).
2. Le remplacer par le JSX de la colonne « Nouveau JSX ». Conserver **tous** les autres attributs du bouton d'origine (`onClick`, `disabled`, `key`, `title`, `onMouseDown`, `ref`, `type`…) et ses enfants, sauf ce que la table remplace explicitement (emoji, caractère, `className`, `style`).
3. Ajouter les imports nécessaires en haut du fichier : `import Button from "<chemin relatif>/components/Button";` et les icônes depuis `"<chemin relatif>/components/Icons"`.

Puis, pour **chaque ancienne classe** de la table, dans les fichiers CSS indiqués :

4. Supprimer toutes ses règles de pseudo-classe et de modificateur (`:hover`, `:active`, `:disabled`, `:focus`, `--active`, `--disabled`…).
5. Dans sa règle de base, ne garder que les propriétés de placement autorisées (voir Global Constraints). S'il en reste, renommer la classe comme indiqué dans la colonne « Classe de placement » de la table. S'il n'en reste aucune, supprimer la règle et ne pas passer de `className`.
6. Vérifier qu'aucune autre règle ne cible encore l'ancienne classe : `grep -rn "<ancienne-classe>" apps/frontend/src` ne doit plus rien renvoyer.

Enfin :

7. Ajouter les lignes de la table au fichier de vérification, dans la section de la tâche, au format `| [ ] | Écran | Bouton | Ancienne classe | Variante / taille | Fichier |`.
8. Lancer `pnpm --filter @pipou/frontend typecheck`, `pnpm --filter @pipou/frontend lint` et `pnpm --filter @pipou/frontend test` : tout doit passer.
9. Commit.

---

### Task 1: Composant `Button` et variables CSS

**Files:**
- Create: `apps/frontend/src/components/Button.tsx`
- Create: `apps/frontend/src/components/Button.css`
- Create: `apps/frontend/src/__tests__/components/Button.test.tsx`
- Modify: `apps/frontend/src/index.css` (bloc `:root`)

**Interfaces:**
- Produces: `export default Button` (forwardRef vers `HTMLButtonElement`) ; `export type ButtonVariant`, `export type ButtonSize`, `export type ButtonProps`. Classes CSS : `btn`, `btn--<variant>`, `btn--<size>`, `btn--full`, `btn--active`. Variables CSS `--color-bordeaux`, `--color-bordeaux-hover`, `--color-bordeaux-dark`, `--color-cream`, `--color-cream-hover`, `--color-gold`, `--color-pink`, `--color-pink-text`.

- [ ] **Step 1: Écrire les tests (en échec)**

`apps/frontend/src/__tests__/components/Button.test.tsx` :

```tsx
import { describe, it, expect, vi } from "vitest";
import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Button from "../../components/Button";

describe("Button", () => {
  it("rend un bouton primary md de type button par défaut", () => {
    render(<Button>Acheter</Button>);
    const btn = screen.getByRole("button", { name: "Acheter" });
    expect(btn).toHaveAttribute("type", "button");
    expect(btn).toHaveClass("btn", "btn--primary", "btn--md");
    expect(btn).not.toHaveAttribute("aria-pressed");
  });

  it.each([
    "primary",
    "primary-inverse",
    "danger",
    "danger-inverse",
  ] as const)("applique la variante %s", (variant) => {
    render(<Button variant={variant}>x</Button>);
    expect(screen.getByRole("button")).toHaveClass(`btn--${variant}`);
  });

  it.each(["ghost-gold", "ghost-bordeaux"] as const)(
    "applique la variante %s",
    (variant) => {
      render(<Button variant={variant}>x</Button>);
      expect(screen.getByRole("button")).toHaveClass(`btn--${variant}`);
    },
  );

  it.each(["sm", "md", "lg"] as const)("applique la taille %s", (size) => {
    render(<Button size={size}>x</Button>);
    expect(screen.getByRole("button")).toHaveClass(`btn--${size}`);
  });

  it("applique la taille icon avec son aria-label", () => {
    render(
      <Button size="icon" aria-label="Fermer">
        <svg />
      </Button>,
    );
    expect(screen.getByRole("button", { name: "Fermer" })).toHaveClass(
      "btn--icon",
    );
  });

  it("accepte type submit", () => {
    render(<Button type="submit">Envoyer</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });

  it("pose aria-pressed et btn--active quand active est vrai", () => {
    render(
      <Button variant="ghost-gold" active>
        Tous
      </Button>,
    );
    const btn = screen.getByRole("button", { pressed: true });
    expect(btn).toHaveClass("btn--active");
  });

  it("pose aria-pressed=false sans btn--active quand active est faux", () => {
    render(
      <Button variant="ghost-bordeaux" active={false}>
        Vente
      </Button>,
    );
    const btn = screen.getByRole("button", { pressed: false });
    expect(btn).not.toHaveClass("btn--active");
  });

  it("ajoute btn--full avec fullWidth", () => {
    render(<Button fullWidth>x</Button>);
    expect(screen.getByRole("button")).toHaveClass("btn--full");
  });

  it("ajoute la className après les classes du composant", () => {
    render(<Button className="shop-item__buy">x</Button>);
    expect(screen.getByRole("button").className).toBe(
      "btn btn--primary btn--md shop-item__buy",
    );
  });

  it("n'appelle pas onClick quand il est désactivé", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        x
      </Button>,
    );
    await user.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("appelle onClick quand il est actif", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>x</Button>);
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("transmet la ref au <button>", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>x</Button>);
    expect(ref.current).toBe(screen.getByRole("button"));
  });

  it("refuse les combinaisons interdites au typage", () => {
    // @ts-expect-error active n'existe que pour les variantes fantôme
    render(<Button variant="primary" active>x</Button>);
    // @ts-expect-error size="icon" exige aria-label
    render(<Button size="icon">x</Button>);
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Lancer les tests et vérifier l'échec**

Run: `pnpm --filter @pipou/frontend exec vitest run src/__tests__/components/Button.test.tsx`
Expected: FAIL — `Failed to resolve import "../../components/Button"`.

- [ ] **Step 3: Écrire le composant**

`apps/frontend/src/components/Button.tsx` :

```tsx
import { forwardRef } from "react";
import type { ComponentPropsWithoutRef } from "react";
import "./Button.css";

export type ButtonVariant =
  | "primary"
  | "primary-inverse"
  | "ghost-gold"
  | "ghost-bordeaux"
  | "danger"
  | "danger-inverse";

export type ButtonSize = "sm" | "md" | "lg" | "icon";

type NativeProps = Omit<ComponentPropsWithoutRef<"button">, "type">;

type VariantProps =
  | { variant: "ghost-gold" | "ghost-bordeaux"; active?: boolean }
  | {
      variant?: "primary" | "primary-inverse" | "danger" | "danger-inverse";
      active?: never;
    };

type SizeProps =
  | { size?: "sm" | "md" | "lg" }
  | { size: "icon"; "aria-label": string };

export type ButtonProps = NativeProps &
  VariantProps &
  SizeProps & {
    fullWidth?: boolean;
    type?: "button" | "submit" | "reset";
  };

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    active,
    fullWidth = false,
    type = "button",
    className,
    ...rest
  },
  ref,
) {
  const classes = ["btn", `btn--${variant}`, `btn--${size}`];
  if (fullWidth) classes.push("btn--full");
  if (active) classes.push("btn--active");
  if (className) classes.push(className);

  return (
    <button
      ref={ref}
      type={type}
      className={classes.join(" ")}
      aria-pressed={active}
      {...rest}
    />
  );
});

export default Button;
```

- [ ] **Step 4: Écrire le CSS**

`apps/frontend/src/components/Button.css` :

```css
/* ── Base ── */
.btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1.5px solid transparent;
  font-family: "Comfortaa", system-ui, sans-serif;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition:
    background 0.15s,
    border-color 0.15s,
    color 0.15s,
    transform 0.1s;
}
.btn:active:not(:disabled) {
  transform: scale(0.96);
}
.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.btn:focus-visible {
  outline: 2px solid var(--color-bordeaux);
  outline-offset: 2px;
}
.btn--primary-inverse:focus-visible,
.btn--ghost-gold:focus-visible,
.btn--danger-inverse:focus-visible {
  outline-color: var(--color-gold);
}

/* ── Tailles ── */
.btn--sm {
  padding: 3px 10px;
  font-size: 0.75rem;
  border-radius: 8px;
}
.btn--md {
  padding: 0.55rem 1rem;
  font-size: 0.85rem;
  border-radius: 12px;
}
.btn--lg {
  padding: 0.85rem 1.5rem;
  font-size: 1rem;
  border-radius: 14px;
}
.btn--icon {
  width: 30px;
  height: 30px;
  padding: 0;
  font-size: 1rem;
  border-radius: 8px;
  flex-shrink: 0;
}
.btn--full {
  width: 100%;
}

/* ── Variantes — fond clair ── */
.btn--primary {
  background: var(--color-bordeaux);
  color: #fff;
}
.btn--primary:hover:not(:disabled) {
  background: var(--color-bordeaux-hover);
}

.btn--ghost-bordeaux {
  background: rgba(122, 28, 59, 0.08);
  color: var(--color-bordeaux);
}
.btn--ghost-bordeaux:hover:not(:disabled) {
  background: rgba(122, 28, 59, 0.14);
}
.btn--ghost-bordeaux.btn--active,
.btn--ghost-bordeaux.btn--active:hover:not(:disabled) {
  background: var(--color-bordeaux);
  color: #fff;
}

.btn--danger {
  background: rgba(242, 122, 170, 0.15);
  border-color: rgba(242, 122, 170, 0.25);
  color: var(--color-pink-text);
}
.btn--danger:hover:not(:disabled) {
  background: rgba(242, 122, 170, 0.25);
  border-color: rgba(242, 122, 170, 0.45);
}

/* ── Variantes — fond foncé ── */
.btn--primary-inverse {
  background: var(--color-cream);
  color: var(--color-bordeaux);
}
.btn--primary-inverse:hover:not(:disabled) {
  background: var(--color-cream-hover);
}

.btn--ghost-gold {
  background: transparent;
  border-color: rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.6);
}
.btn--ghost-gold:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.85);
}
.btn--ghost-gold.btn--active,
.btn--ghost-gold.btn--active:hover:not(:disabled) {
  background: rgba(238, 188, 119, 0.2);
  border-color: rgba(238, 188, 119, 0.5);
  color: var(--color-gold);
}

.btn--danger-inverse {
  background: rgba(242, 122, 170, 0.15);
  border-color: rgba(242, 122, 170, 0.25);
  color: var(--color-pink);
}
.btn--danger-inverse:hover:not(:disabled) {
  background: rgba(242, 122, 170, 0.25);
  border-color: rgba(242, 122, 170, 0.45);
}
```

- [ ] **Step 5: Ajouter les variables CSS**

Dans `apps/frontend/src/index.css`, à la fin du bloc `:root { … }` (après `-moz-osx-font-smoothing: grayscale;`), ajouter :

```css
  /* Couleurs de marque (utilisées par components/Button.css) */
  --color-bordeaux: #7a1c3b;
  --color-bordeaux-hover: #9b2349;
  --color-bordeaux-dark: #3d1020;
  --color-cream: #fdf6f0;
  --color-cream-hover: #f5efe0;
  --color-gold: #eebc77;
  --color-pink: #f27aaa;
  --color-pink-text: #b03060;
```

- [ ] **Step 6: Lancer les tests et vérifier qu'ils passent**

Run: `pnpm --filter @pipou/frontend exec vitest run src/__tests__/components/Button.test.tsx`
Expected: PASS (tous les tests).

Run: `pnpm --filter @pipou/frontend typecheck`
Expected: aucune erreur. Les deux `@ts-expect-error` doivent être « consommés » : si l'un d'eux signale `Unused '@ts-expect-error' directive`, le typage de `ButtonProps` est faux, il faut le corriger.

Run: `pnpm --filter @pipou/frontend lint`
Expected: aucune erreur.

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/src/components/Button.tsx apps/frontend/src/components/Button.css apps/frontend/src/__tests__/components/Button.test.tsx apps/frontend/src/index.css
git commit -m "feat(frontend): add shared Button component and brand color tokens" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Nouvelles icônes SVG et clés de pagination

**Files:**
- Modify: `apps/frontend/src/components/Icons.tsx` (ajout en fin de fichier)
- Modify: `apps/frontend/src/i18n/locales/fr.json`, `en.json`, `ko.json`
- Create: `apps/frontend/src/__tests__/components/Icons.test.tsx`

**Interfaces:**
- Produces: `IconPencil`, `IconTrash`, `IconClose`, `IconPlus`, `IconMinus`, `IconPause`, `IconPlay`, mêmes props que les icônes existantes (`size?: number`, `color?: string`, `className?: string`, `style?: CSSProperties`). Clés i18n `pagination.prev`, `pagination.next`.
- Existing (déjà dans `Icons.tsx`, réutilisées plus loin) : `IconArrowLeft`, `IconArrowRight`.

- [ ] **Step 1: Écrire le test (en échec)**

`apps/frontend/src/__tests__/components/Icons.test.tsx` :

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import {
  IconPencil,
  IconTrash,
  IconClose,
  IconPlus,
  IconMinus,
  IconPause,
  IconPlay,
} from "../../components/Icons";

const ICONS = {
  IconPencil,
  IconTrash,
  IconClose,
  IconPlus,
  IconMinus,
  IconPause,
  IconPlay,
};

describe("nouvelles icônes", () => {
  it.each(Object.entries(ICONS))(
    "%s rend un svg 24×24 en currentColor à la taille demandée",
    (_name, Icon) => {
      const { container } = render(<Icon size={16} />);
      const svg = container.querySelector("svg")!;
      expect(svg).toHaveAttribute("width", "16");
      expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
      const stroked = container.querySelector("[stroke]")!;
      expect(stroked).toHaveAttribute("stroke", "currentColor");
    },
  );
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `pnpm --filter @pipou/frontend exec vitest run src/__tests__/components/Icons.test.tsx`
Expected: FAIL — `IconPencil` non exporté (élément `undefined`).

- [ ] **Step 3: Ajouter les icônes à la fin de `Icons.tsx`**

```tsx
export function IconPencil({
  size = 24,
  color = "currentColor",
  className,
  style,
}: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={style}
    >
      <path
        d="M4 20H8L18.5 9.5C19.6 8.4 19.6 6.6 18.5 5.5C17.4 4.4 15.6 4.4 14.5 5.5L4 16V20Z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.5 6.5L17.5 10.5"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconTrash({
  size = 24,
  color = "currentColor",
  className,
  style,
}: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={style}
    >
      <path
        d="M4 7H20M9 7V4H15V7M6 7L7 19C7.1 20.1 7.9 21 9 21H15C16.1 21 16.9 20.1 17 19L18 7M10 11V17M14 11V17"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconClose({
  size = 24,
  color = "currentColor",
  className,
  style,
}: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={style}
    >
      <path
        d="M6 6L18 18M18 6L6 18"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconPlus({
  size = 24,
  color = "currentColor",
  className,
  style,
}: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={style}
    >
      <path
        d="M12 5V19M5 12H19"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconMinus({
  size = 24,
  color = "currentColor",
  className,
  style,
}: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={style}
    >
      <path d="M5 12H19" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function IconPause({
  size = 24,
  color = "currentColor",
  className,
  style,
}: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={style}
    >
      <path
        d="M9 5V19M15 5V19"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconPlay({
  size = 24,
  color = "currentColor",
  className,
  style,
}: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={style}
    >
      <path
        d="M7 5L19 12L7 19V5Z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
```

- [ ] **Step 4: Ajouter les clés de pagination**

Dans chaque fichier de langue, ajouter une clé de premier niveau `pagination` juste avant `"marketplace"` (respecter les fins de ligne CRLF du fichier et la virgule finale) :

`fr.json` :
```json
  "pagination": {
    "prev": "Page précédente",
    "next": "Page suivante"
  },
```

`en.json` :
```json
  "pagination": {
    "prev": "Previous page",
    "next": "Next page"
  },
```

`ko.json` :
```json
  "pagination": {
    "prev": "이전 페이지",
    "next": "다음 페이지"
  },
```

Vérifier que les 3 fichiers restent du JSON valide : `node -e "for (const l of ['fr','en','ko']) JSON.parse(require('fs').readFileSync('apps/frontend/src/i18n/locales/'+l+'.json','utf8'))"` ne doit rien afficher.

- [ ] **Step 5: Vérifier que les tests passent**

Run: `pnpm --filter @pipou/frontend exec vitest run src/__tests__/components/Icons.test.tsx`
Expected: PASS (7 cas).

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/components/Icons.tsx apps/frontend/src/__tests__/components/Icons.test.tsx apps/frontend/src/i18n/locales
git commit -m "feat(frontend): add pencil, trash, close, plus, minus, pause and play icons" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Remise à zéro du `button` global et fichier de vérification

**Files:**
- Modify: `apps/frontend/src/index.css` (bloc « Boutons globaux »)
- Modify: `apps/frontend/src/components/manager.css` (`.bm-stepper__dot`)
- Modify: `apps/frontend/src/features/fight/FightTabBar.css` (`.ftb-tab`)
- Modify: `apps/frontend/src/features/fight/GraveyardPile.css` (`.gp-close`)
- Create: `docs/superpowers/specs/2026-10-01-button-system-checklist.md`

**Interfaces:**
- Consumes: rien.
- Produces: le fichier de vérification, avec une section par tâche 4 à 11 que les tâches suivantes complètent.

- [ ] **Step 1: Remplacer le bloc « Boutons globaux » de `index.css`**

Remplacer exactement :

```css
/* ── Boutons globaux ── */
button {
  border-radius: 8px;
  border: 1px solid transparent;
  padding: 0.6em 1.2em;
  font-size: 1em;
  font-weight: 500;
  font-family: inherit;
  background-color: #eebc77;
  cursor: pointer;
  transition: border-color 0.25s;
}
button:hover {
  border-color: #f27aaa;
}
button:focus,
button:focus-visible {
  outline: 4px auto -webkit-focus-ring-color;
}
```

par :

```css
/* ── Boutons globaux ── (le style vient de components/Button.css) */
button {
  font-family: inherit;
  font-size: 1em;
  font-weight: 500;
  cursor: pointer;
}
```

- [ ] **Step 2: Recopier les valeurs héritées dans les 3 boutons de jeu concernés**

- `components/manager.css`, règle `.bm-stepper__dot { … }` : ajouter la ligne `padding: 0.6em 1.2em;` après `height: 28px;`.
- `features/fight/FightTabBar.css`, règle `.ftb-tab { … }` : ajouter `border-radius: 8px;` après `border-bottom: 2px solid transparent;`.
- `features/fight/GraveyardPile.css`, règle `.gp-close { … }` : ajouter `border-radius: 8px;` après `border: none;`.

- [ ] **Step 3: Créer le fichier de vérification**

`docs/superpowers/specs/2026-10-01-button-system-checklist.md` :

```markdown
# Système de boutons — Liste de vérification

À parcourir dans l'appli (`pnpm dev`) : coche chaque ligne après avoir vérifié le bouton (couleur, survol, appui, état désactivé, état actif s'il y en a un).

Rappel des variantes :
- fond clair : `primary` (bordeaux plein), `ghost-bordeaux` (bordeaux léger, plein si actif), `danger` (rose, texte rose soutenu) ;
- fond foncé : `primary-inverse` (crème, texte bordeaux), `ghost-gold` (transparent, doré si actif), `danger-inverse` (rose, texte rose vif).

| ✓ | Écran (chemin dans l'appli) | Bouton | Ancienne classe | Variante / taille | Fichier |
|---|---|---|---|---|---|

## Marché

## Collection

## Quêtes et récompenses

## Boutique et ouverture

## Combat hors plateau

## Profil, réglages, connexion, deck, en-tête

## Admin

## Composants transverses

## Boutons de jeu laissés tels quels

Vérifier qu'ils n'ont **pas** changé d'apparence (seule la bordure rose au survol, qui venait du style global, a disparu).

| ✓ | Écran | Bouton | Classe | Fichier |
|---|---|---|---|---|
| [ ] | Combat → plateau | Invoquer / Jouer / Recycler | `fab-btn` | `features/fight/FightActionBar.tsx` |
| [ ] | Combat → plateau | Fin de phase | `fab-btn-phase` | `features/fight/FightActionBar.tsx` |
| [ ] | Combat → plateau | Abandonner | `fab-btn-surrender` | `features/fight/FightActionBar.tsx` |
| [ ] | Combat → plateau | Attaque directe | `fb-btn-direct-atk` | `features/fight/FightBoard.tsx` |
| [ ] | Combat → plateau | « i » des effets (main et zones) | `bdl-trigger` | `features/fight/FightHand.tsx`, `features/fight/Zonerow/ZoneRow.tsx` |
| [ ] | Combat → plateau | Mode attaque / garde | `zr-mode-btn` | `features/fight/Zonerow/MonsterZoneContent.tsx` |
| [ ] | Combat → plateau | Sections buffs / debuffs | `bdl-section-header` | `features/fight/BuffDebuffList.tsx` |
| [ ] | Combat → plateau | Cimetière (pile et ✕) | `gp-pile`, `gp-close` (arrondi recopié) | `features/fight/GraveyardPile.tsx` |
| [ ] | Combat → onglets du bas | Onglets | `ftb-tab` (arrondi recopié) | `features/fight/FightTabBar.tsx` |
| [ ] | Combat → choix de carte | Confirmer (couleur selon l'effet) | `cpm-btn-confirm` | `features/fight/CardPickModal.tsx` |
| [ ] | Arène (`/arena`) | Cartes Deck Builder / Combat | `fh-card` | `pages/FightHub.tsx` |
| [ ] | Règles du combat | Étapes du fil d'Ariane | `fr-bc-step` | `features/fight/FightRules.tsx` |
| [ ] | Admin → assistants | Points d'étapes | `bm-stepper__dot` (padding recopié) | `features/*/…Manager.tsx` |
| [ ] | Marché → Mettre en vente | Vignettes de cartes / objets | `marketplace-card-pick`, `marketplace-item-pick` | `features/marketplace/CreateListingModal.tsx` |
| [ ] | Accueil → ouverture rapide | Vignettes de boosters | `opening-selector__thumb` | `features/opening/OpeningQuickAccess.tsx` |
| [ ] | Récompense quotidienne | Options de rachat (jours) | `drm-rescue-option` | `components/DailyRewardModal.tsx` |
| [ ] | Toutes les pages | Navigation du pied de page | `cc-footer__item` | `components/Footer.tsx` |
| [ ] | Connexion (`/login`) | Œil du mot de passe | `login-password-toggle` | `pages/Login.tsx` |
```

- [ ] **Step 4: Vérifier**

Run: `pnpm --filter @pipou/frontend test` → PASS.
Run: `pnpm --filter @pipou/frontend build` → succès.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/index.css apps/frontend/src/components/manager.css apps/frontend/src/features/fight/FightTabBar.css apps/frontend/src/features/fight/GraveyardPile.css docs/superpowers/specs/2026-10-01-button-system-checklist.md
git commit -m "refactor(frontend): drop the global gold button style" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Marché et `FilterPanel`

**Files:**
- Create: `apps/frontend/src/__tests__/components/FilterPanel.test.tsx`
- Modify: `apps/frontend/src/components/FilterPanel.tsx`, `FilterPanel.css`
- Modify: `apps/frontend/src/features/marketplace/MarketplaceTabs.tsx`, `MarketplaceTabs.css`
- Modify: `apps/frontend/src/features/marketplace/BuyTab.tsx`, `BuyTab.css`
- Modify: `apps/frontend/src/features/marketplace/SellTab.tsx`, `SellTab.css`
- Modify: `apps/frontend/src/features/marketplace/CreateListingModal.tsx`, `CreateListingModal.css`
- Modify: `apps/frontend/src/features/marketplace/ListingEditForm.tsx`, `ListingEditForm.css`
- Modify: `apps/frontend/src/features/marketplace/TransactionHistory.tsx`, `TransactionHistory.css`
- Modify: `docs/superpowers/specs/2026-10-01-button-system-checklist.md`

**Interfaces:**
- Consumes: `Button` (tâche 1) ; `IconClose`, `IconPlus`, `IconMinus` (tâche 2) ; `IconArrowLeft`, `IconArrowRight` (existantes) ; clés `pagination.prev` / `pagination.next`.
- Produces: `FilterPanelProps.tone?: "light" | "dark"` (défaut `"light"`).

Fonds : page du marché, bas blanc des cartes d'annonce (`.marketplace-listing__bottom`) → **clair**. Haut des cartes d'annonce (sélecteur de quantité), modale de mise en vente, formulaire d'édition d'annonce → **foncé**.

- [ ] **Step 1: Test de `FilterPanel` (en échec)**

Props actuelles de `FilterPanel` : `config: FilterGroupConfig[]` (`{ key, label, options: { value, label }[], defaultValue? }`), `values: Record<string, string>`, `onChange(key, value)`, `onReset?()`. Créer `apps/frontend/src/__tests__/components/FilterPanel.test.tsx` :

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import FilterPanel from "../../components/FilterPanel";
import type { FilterConfig } from "../../components/FilterPanel";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

const config: FilterConfig[] = [
  {
    key: "type",
    label: "Type",
    options: [
      { value: "all", label: "Tous" },
      { value: "monster", label: "Monstre" },
    ],
  },
];

const renderPanel = (tone?: "light" | "dark") =>
  render(
    <FilterPanel
      config={config}
      values={{ type: "all" }}
      onChange={vi.fn()}
      onReset={vi.fn()}
      tone={tone}
    />,
  );

describe("FilterPanel", () => {
  it("utilise ghost-bordeaux sur fond clair par défaut", () => {
    renderPanel();
    expect(screen.getByRole("button", { name: "Tous" })).toHaveClass(
      "btn--ghost-bordeaux",
      "btn--active",
    );
    expect(
      screen.getByRole("button", { name: "Monstre", pressed: false }),
    ).toBeInTheDocument();
  });

  it("utilise ghost-gold sur fond foncé", () => {
    renderPanel("dark");
    expect(screen.getByRole("button", { name: "Tous" })).toHaveClass(
      "btn--ghost-gold",
      "btn--active",
    );
    expect(screen.getByRole("button", { name: "filter.reset" })).toHaveClass(
      "btn--ghost-gold",
    );
  });
});
```

Run: `pnpm --filter @pipou/frontend exec vitest run src/__tests__/components/FilterPanel.test.tsx`
Expected: FAIL (classe `btn--ghost-bordeaux` absente ; `tone` inconnu au typage).

- [ ] **Step 2: Migrer `FilterPanel`**

Dans `FilterPanelProps`, ajouter `tone?: "light" | "dark";` et le déstructurer avec `tone = "light"`. Calculer au rendu `const variant = tone === "dark" ? "ghost-gold" : "ghost-bordeaux";`. Puis :

| Bouton | Ancienne classe | Nouveau JSX |
|---|---|---|
| option de filtre | `filter-panel__btn` (+ `--active`) | `<Button key={opt.value} variant={variant} size="sm" active={isActive} onClick={…}>{opt.label}</Button>` |
| Réinitialiser | `filter-panel__reset` | `<Button variant={variant} size="sm" className="filter-panel__reset" onClick={onReset}>{t("filter.reset")}</Button>` (classe de placement : garder `align-self: flex-start`) |

Dans `FilterPanel.css`, appliquer les étapes 4 à 6 de la procédure commune à `filter-panel__btn` et `filter-panel__reset`.

Run: `pnpm --filter @pipou/frontend exec vitest run src/__tests__/components/FilterPanel.test.tsx` → PASS.

- [ ] **Step 3: Migrer les boutons du marché (procédure commune)**

| Écran | Bouton | Ancienne classe | Nouveau JSX | Classe de placement | Fichier |
|---|---|---|---|---|---|
| Marché (`/marketplace`) | Onglet Achat | `marketplace-tab` (+ `--active`) | `<Button variant="ghost-bordeaux" active={selectedTab === "buy"} className="marketplace-tab" onClick={…}>` | `marketplace-tab` (`flex: 1`) | `MarketplaceTabs.tsx` |
| Marché | Onglet Vente | `marketplace-tab` (+ `--active`) | `<Button variant="ghost-bordeaux" active={selectedTab === "sell"} className="marketplace-tab" onClick={…}>` | idem | `MarketplaceTabs.tsx` |
| Marché → Achat → carte d'annonce (haut foncé) | − quantité | `marketplace-qty-btn` | `<Button variant="ghost-gold" size="icon" aria-label={t("marketplace.qty.reduce")} …><IconMinus size={16} /></Button>` | — | `BuyTab.tsx` |
| Marché → Achat → carte d'annonce | + quantité | `marketplace-qty-btn` | `<Button variant="ghost-gold" size="icon" aria-label={t("marketplace.qty.increase")} …><IconPlus size={16} /></Button>` | — | `BuyTab.tsx` |
| Marché → Achat → carte d'annonce | Max | `marketplace-qty-max` | `<Button variant="ghost-gold" size="sm" …>{t("marketplace.qty.max")}</Button>` | — | `BuyTab.tsx` |
| Marché → Achat → carte d'annonce (bas blanc) | Acheter | `marketplace-buy-btn` | `<Button …>{…}</Button>` (primary md) | — | `BuyTab.tsx` |
| Marché → Achat | Filtres | `filter-panel__btn` | `<FilterPanel … />` sans `tone` (clair) | — | `BuyTab.tsx` |
| Marché → Vente | Mettre en vente | `marketplace-create-listing-btn` | `<Button onClick={onCreateListing}>` (primary md) | — | `SellTab.tsx` |
| Marché → Vente → carte d'annonce (bas blanc) | Modifier | `marketplace-edit-btn` | `<Button variant="ghost-bordeaux" …>` | — | `SellTab.tsx` |
| Marché → Vente → carte d'annonce | Annuler l'annonce | `marketplace-cancel-btn` | `<Button variant="danger" …>` | — | `SellTab.tsx` |
| Marché → Vente → Mettre en vente (modale foncée) | ✕ fermer | `marketplace-modal-close` | `<Button variant="ghost-gold" size="icon" aria-label={t("marketplace.modal.close")} onClick={onClose}><IconClose size={16} /></Button>` | `marketplace-modal-close` si la règle contient un `position` | `CreateListingModal.tsx` |
| Marché → Mettre en vente | Type Carte / Booster / Bundle | `marketplace-type-btn` (+ `--active`) | `<Button key={type} variant="ghost-gold" active={formProductType === type} onClick={…}>` | `marketplace-type-btn` si `flex` | `CreateListingModal.tsx` |
| Marché → Mettre en vente | Filtres | `.marketplace-picker-filters .filter-panel__*` | `<FilterPanel tone="dark" … />` | — | `CreateListingModal.tsx` |
| Marché → Mettre en vente | − quantité | `marketplace-qty-btn` | `<Button variant="ghost-gold" size="icon" aria-label={t("marketplace.qty.reduce")} …><IconMinus size={16} /></Button>` | — | `CreateListingModal.tsx` |
| Marché → Mettre en vente | + quantité | `marketplace-qty-btn` | `<Button variant="ghost-gold" size="icon" aria-label={t("marketplace.qty.increase")} …><IconPlus size={16} /></Button>` | — | `CreateListingModal.tsx` |
| Marché → Mettre en vente | Max | `marketplace-qty-max` | `<Button variant="ghost-gold" size="sm" …>` | — | `CreateListingModal.tsx` |
| Marché → Mettre en vente | Annuler | `.marketplace-modal-actions button[type="button"]` | `<Button variant="danger-inverse" onClick={onClose} disabled={isCreating}>` | — | `CreateListingModal.tsx` |
| Marché → Mettre en vente | Mettre en vente (envoi) | `.marketplace-modal-actions button[type="submit"]` | `<Button variant="primary-inverse" type="submit" disabled={…}>` | — | `CreateListingModal.tsx` |
| Marché → Vente → Modifier une annonce (foncé) | − quantité | `listing-edit__step` | `<Button variant="ghost-gold" size="icon" aria-label={t("marketplace.qty.reduce")} …><IconMinus size={16} /></Button>` | — | `ListingEditForm.tsx` |
| Marché → Modifier une annonce | + quantité | `listing-edit__step` | `<Button variant="ghost-gold" size="icon" aria-label={t("marketplace.qty.increase")} …><IconPlus size={16} /></Button>` | — | `ListingEditForm.tsx` |
| Marché → Modifier une annonce | Max | `listing-edit__max` | `<Button variant="ghost-gold" size="sm" …>` | — | `ListingEditForm.tsx` |
| Marché → Modifier une annonce | Enregistrer | `listing-edit__save` | `<Button variant="primary-inverse" type="submit" …>` | `listing-edit__save` si `flex` | `ListingEditForm.tsx` |
| Marché → Modifier une annonce | Annuler | `marketplace-cancel-btn` | `<Button variant="danger-inverse" …>` | — | `ListingEditForm.tsx` |
| Marché → Achat / Vente → historique | ← page | `.tx-history__pagination button` | `<Button variant="ghost-bordeaux" size="icon" aria-label={t("pagination.prev")} …><IconArrowLeft size={16} /></Button>` | — | `TransactionHistory.tsx` |
| Marché → historique | → page | `.tx-history__pagination button` | `<Button variant="ghost-bordeaux" size="icon" aria-label={t("pagination.next")} …><IconArrowRight size={16} /></Button>` | — | `TransactionHistory.tsx` |

CSS à nettoyer en plus de la procédure commune :
- `CreateListingModal.css` : supprimer toutes les règles `.marketplace-modal-actions button…` et toutes les règles `.marketplace-picker-filters .filter-panel__…`. Garder `.marketplace-modal-actions` (conteneur).
- `TransactionHistory.css` : supprimer les 3 règles `.tx-history__pagination button…`. Garder `.tx-history__pagination`.
- `SellTab.css` : `marketplace-cancel-btn` est aussi utilisée par `ListingEditForm.tsx` ; ne supprimer ses règles qu'une fois les deux fichiers migrés.

- [ ] **Step 4: Vérifier, compléter la liste et commiter**

Appliquer les étapes 6 à 8 de la procédure commune (lignes de la table dans la section « Marché » du fichier de vérification). `CreateListingModal.test.tsx` et `ListingEditForm.test.tsx` doivent passer sans modification.

```bash
git add apps/frontend/src docs/superpowers/specs/2026-10-01-button-system-checklist.md
git commit -m "refactor(marketplace): use the shared Button component" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Collection

**Files:**
- Modify: `apps/frontend/src/features/boosters/OwnerBoosterList.tsx`, `OwnerBoosterList.css`
- Modify: `apps/frontend/src/features/bundles/OwnerBundleList.tsx`, `OwnerBundleList.css`
- Modify: `apps/frontend/src/features/profile/OwnCardList.tsx` (+ son CSS)
- Modify: `apps/frontend/src/features/cards/CardList.tsx`, `CardList.css`
- Modify: `docs/superpowers/specs/2026-10-01-button-system-checklist.md`

**Interfaces:**
- Consumes: `Button`, `IconArrowLeft`, `IconArrowRight`, clés `pagination.*`.

Fonds : profil et accueil → **clair**.

- [ ] **Step 1: Migrer (procédure commune)**

| Écran | Bouton | Ancienne classe | Nouveau JSX | Classe de placement | Fichier |
|---|---|---|---|---|---|
| Profil (`/profile`) → Collection → boosters | Ouvrir | `inv-row__open-btn` | `<Button size="sm" onClick={…}>Ouvrir</Button>` | — | `OwnerBoosterList.tsx` |
| Profil → Collection → bundles | Ouvrir | `inv-row__open-btn` | `<Button size="sm" onClick={…}>Ouvrir</Button>` | — | `OwnerBundleList.tsx` |
| Profil → Collection → cartes | ← page | `own-cardlist__pagination-btn` | `<Button variant="ghost-bordeaux" size="icon" aria-label={t("pagination.prev")} …><IconArrowLeft size={16} /></Button>` | — | `OwnCardList.tsx` |
| Profil → Collection → cartes | → page | `own-cardlist__pagination-btn` | `<Button variant="ghost-bordeaux" size="icon" aria-label={t("pagination.next")} …><IconArrowRight size={16} /></Button>` | — | `OwnCardList.tsx` |
| Accueil (`/`) → un set de cartes | Retour | `cardlist__back` | `<Button variant="ghost-bordeaux" size="icon" aria-label="Retour" onClick={handleBack}>` + garder le `<svg>` existant en remplaçant `fill="#7a1c3b"` par `fill="currentColor"` | `cardlist__back` si `position`/`margin` | `CardList.tsx` |
| Accueil → un set de cartes | ← page | `cardlist__pagination-btn` | `<Button variant="ghost-bordeaux" size="icon" aria-label="Page précédente" …><IconArrowLeft size={16} /></Button>` | — | `CardList.tsx` |
| Accueil → un set de cartes | → page | `cardlist__pagination-btn` | `<Button variant="ghost-bordeaux" size="icon" aria-label="Page suivante" …><IconArrowRight size={16} /></Button>` | — | `CardList.tsx` |

Dans `OwnerBoosterList.css` et `OwnerBundleList.css`, les deux règles `.inv-row__open-btn` (et `:hover`) sont supprimées : c'est la fin du doré plein.

- [ ] **Step 2: Vérifier, compléter la liste (section « Collection ») et commiter**

```bash
git add apps/frontend/src docs/superpowers/specs/2026-10-01-button-system-checklist.md
git commit -m "refactor(collection): use the shared Button component" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Quêtes et récompense quotidienne

**Files:**
- Modify: `apps/frontend/src/features/profile/QuestsPanel.tsx`, `QuestsPanel.css`
- Modify: `apps/frontend/src/features/quests/QuestInboxWidget.tsx`, `QuestInboxWidget.css`
- Modify: `apps/frontend/src/components/DailyRewardModal.tsx`, `DailyRewardModal.css`
- Modify: `docs/superpowers/specs/2026-10-01-button-system-checklist.md`

**Interfaces:**
- Consumes: `Button`, `IconClose`.

Fonds : panneau de quêtes (`#3d1020`), menu déroulant des quêtes (`#3d1020`), modale de récompense (`#1a0a12`) → **foncé**. Bouton trophée de l'en-tête (`#f5efe0`) → **clair**.

- [ ] **Step 1: Migrer (procédure commune)**

| Écran | Bouton | Ancienne classe | Nouveau JSX | Classe de placement | Fichier |
|---|---|---|---|---|---|
| Profil → Quêtes | Onglets Jour / Semaine / … | `quests-panel__tab` (+ `--active`) | `<Button key={tab.key} variant="ghost-gold" size="sm" active={activeTab === tab.key} onClick={…}>` (garder `{t(tab.labelKey)}` et l'`IconBell`) | — | `QuestsPanel.tsx` |
| Profil → Quêtes | Tout récupérer | `quests-panel__claim-all` | `<Button variant="primary-inverse" size="sm" …>` | `quests-panel__claim-all` si `align-self`/`margin` | `QuestsPanel.tsx` |
| Profil → Quêtes → une quête | Récupérer | `quest-item__claim-btn` | `<Button variant="primary-inverse" size="sm" className="quest-item__claim-btn" …>` | `quest-item__claim-btn` (`align-self: flex-end`) | `QuestsPanel.tsx` |
| En-tête (toutes les pages) | Trophée des quêtes | `qi__btn` | `<Button variant="ghost-bordeaux" size="icon" aria-label={t("quests.inbox_label")} onClick={…}>` (garder `IconTrophy` et le badge) | — | `QuestInboxWidget.tsx` |
| En-tête → menu des quêtes | Tout récupérer | `qi__claim-all` | `<Button variant="primary-inverse" size="sm" …>` | — | `QuestInboxWidget.tsx` |
| En-tête → menu des quêtes | Récupérer (une quête) | `qi__item-claim` | `<Button variant="primary-inverse" size="sm" …>` | `qi__item-claim` si `flex-shrink`/`margin` | `QuestInboxWidget.tsx` |
| En-tête → menu des quêtes | Voir tout → | `qi__footer-link` | `<Button variant="ghost-gold" size="sm" …>` | `qi__footer-link` si `width`/`margin` | `QuestInboxWidget.tsx` |
| Récompense quotidienne (à la connexion) | ✕ fermer | `drm-close` | `<Button variant="ghost-gold" size="icon" aria-label="Fermer" onClick={onClose}><IconClose size={16} /></Button>` | `drm-close` (`position`, `top`, `right`) | `DailyRewardModal.tsx` |
| Récompense quotidienne | Réclamer ma récompense | `drm-claim-btn` | `<Button variant="primary-inverse" size="lg" fullWidth …>` | — | `DailyRewardModal.tsx` |
| Récompense quotidienne → série perdue | Racheter | `drm-rescue-btn` | `<Button variant="primary-inverse" …>` (garder l'`IconGold`) | `drm-rescue-btn` si `width`/`flex` | `DailyRewardModal.tsx` |
| Récompense quotidienne → série perdue | Recommencer à J1 | `drm-reset-btn` | `<Button variant="danger-inverse" …>` | `drm-reset-btn` si `width`/`flex` | `DailyRewardModal.tsx` |
| Récompense quotidienne → résultat | Super, merci ! | `drm-close-btn` | `<Button variant="primary-inverse" onClick={onClose}>` | `drm-close-btn` si `width`/`margin` | `DailyRewardModal.tsx` |

`qi__btn` contient un badge en `position: absolute` : `.btn` a déjà `position: relative`, ne pas le redéclarer.

- [ ] **Step 2: Vérifier, compléter la liste (section « Quêtes et récompenses ») et commiter**

```bash
git add apps/frontend/src docs/superpowers/specs/2026-10-01-button-system-checklist.md
git commit -m "refactor(quests): use the shared Button component" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Boutique et ouverture

**Files:**
- Modify: `apps/frontend/src/features/shop/ShopSection.tsx`, `ShopSection.css`
- Modify: `apps/frontend/src/features/shop/BannerCard.tsx`, `BannerCard.css`
- Modify: `apps/frontend/src/features/shop/BannerCarousel.tsx`, `BannerCarousel.css`
- Modify: `apps/frontend/src/features/opening/OpeningModal.tsx`, `OpeningModal.css`
- Modify: `apps/frontend/src/features/opening/OpeningQuickAccess.tsx`, `OpeningQuickAccess.css`
- Modify: `docs/superpowers/specs/2026-10-01-button-system-checklist.md`

**Interfaces:**
- Consumes: `Button`, `IconClose`, `IconPlus`, `IconMinus`, `IconArrowLeft`, `IconArrowRight`.

Fonds : cartes de la boutique et actions du carrousel → **clair**. Bannières (`BannerCard`, dégradé bordeaux foncé), ouverture rapide (dégradé `#2a0a15`), modale d'ouverture (`rgba(10,3,7,.94)`) → **foncé**.

- [ ] **Step 1: Migrer (procédure commune)**

| Écran | Bouton | Ancienne classe | Nouveau JSX | Classe de placement | Fichier |
|---|---|---|---|---|---|
| Accueil → Boutique → booster | − quantité | `shop-item__qty-btn` | `<Button variant="ghost-bordeaux" size="icon" aria-label="Diminuer" …><IconMinus size={16} /></Button>` | — | `ShopSection.tsx` |
| Accueil → Boutique → booster | + quantité | `shop-item__qty-btn` | `<Button variant="ghost-bordeaux" size="icon" aria-label="Augmenter" …><IconPlus size={16} /></Button>` | — | `ShopSection.tsx` |
| Accueil → Boutique → booster | Acheter ×N | `shop-item__btn` | `<Button fullWidth onClick={handleBuy} disabled={buying}>` | — | `ShopSection.tsx` |
| Accueil → Boutique → bannière | − quantité | `banner-card__qty-btn` | `<Button variant="ghost-gold" size="icon" aria-label="Diminuer" …><IconMinus size={16} /></Button>` | — | `BannerCard.tsx` |
| Accueil → Boutique → bannière | + quantité | `banner-card__qty-btn` | `<Button variant="ghost-gold" size="icon" aria-label="Augmenter" …><IconPlus size={16} /></Button>` | — | `BannerCard.tsx` |
| Accueil → Boutique → bannière | Acheter ×N — objet | `banner-card__btn` | `<Button variant="primary-inverse" fullWidth onClick={handleBuy} disabled={buying}>` | — | `BannerCard.tsx` |
| Accueil → Boutique → carrousel | Bannière précédente | `banner-carousel__btn` | `<Button variant="ghost-bordeaux" size="icon" aria-label="Bannière précédente" onClick={prev}><IconArrowLeft size={16} /></Button>` | — | `BannerCarousel.tsx` |
| Accueil → Boutique → carrousel | Bannière suivante | `banner-carousel__btn` | `<Button variant="ghost-bordeaux" size="icon" aria-label="Bannière suivante" onClick={next}><IconArrowRight size={16} /></Button>` | — | `BannerCarousel.tsx` |
| Accueil → ouverture rapide | Ouvrir | `opening-selector__open-btn` | `<Button variant="primary-inverse" size="lg" onClick={…}>Ouvrir</Button>` | `opening-selector__open-btn` (`margin-top`) | `OpeningQuickAccess.tsx` |
| Ouverture d'un booster | ✕ fermer | `opening-modal__close` | `<Button variant="ghost-gold" size="icon" aria-label="Fermer" onClick={handleClose}><IconClose size={16} /></Button>` | `opening-modal__close` (`position`, `top`, `right`, `z-index`) | `OpeningModal.tsx` |
| Ouverture → cartes | Voir les résultats → | `opening-cards__next-btn` | `<Button variant="primary-inverse" size="lg" …>` | `opening-cards__next-btn` si `margin` | `OpeningModal.tsx` |
| Ouverture → cartes une à une | Carte suivante → / Voir les résultats | `opening-cards__next-btn` | `<Button variant="primary-inverse" size="lg" onClick={handleNext}>` | idem | `OpeningModal.tsx` |
| Ouverture → résultats | Fermer | `opening-results__close-btn` | `<Button variant="primary-inverse" size="lg" onClick={handleClose}>` | `opening-results__close-btn` si `margin`/`width` | `OpeningModal.tsx` |

- [ ] **Step 2: Vérifier, compléter la liste (section « Boutique et ouverture ») et commiter**

```bash
git add apps/frontend/src docs/superpowers/specs/2026-10-01-button-system-checklist.md
git commit -m "refactor(shop): use the shared Button component in shop and opening" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Combat hors plateau

**Files:**
- Modify: `apps/frontend/src/features/fight/FightLobby.tsx`, `FightLobby.css`
- Modify: `apps/frontend/src/features/fight/FightRules.tsx`, `FightRules.css`
- Modify: `apps/frontend/src/features/fight/SummonCostModal.tsx`, `SummonCostModal.css`
- Modify: `apps/frontend/src/features/fight/CardPickModal.tsx`, `CardPickModal.css`
- Modify: `docs/superpowers/specs/2026-10-01-button-system-checklist.md`

**Interfaces:**
- Consumes: `Button`, `IconClose`.

Fonds : lobby, règles, modales blanches (`.scm-modal`, `.cpm-modal`) → **clair**. Ne pas toucher `cpm-btn-confirm`.

- [ ] **Step 1: Migrer (procédure commune)**

| Écran | Bouton | Ancienne classe | Nouveau JSX | Classe de placement | Fichier |
|---|---|---|---|---|---|
| Combat (`/fight`) → fin de partie | Rejouer | `lobby-btn-big` | `<Button size="lg" onClick={onReplay}>` | — | `FightLobby.tsx` |
| Combat → lobby | Lancer la partie → | `lobby-btn-big` (+ `--disabled`) | `<Button size="lg" onClick={onSubmitDeck} disabled={!selectedDeck}>` | — | `FightLobby.tsx` |
| Combat → lobby | 🔍 Rechercher une partie | `lobby-btn-big` (+ `--disabled`) | `<Button size="lg" onClick={onJoinQueue} disabled={!selectedDeck}>` | — | `FightLobby.tsx` |
| Combat → file d'attente | Annuler | `lobby-btn-cancel` | `<Button variant="danger" onClick={onLeaveQueue}>` | — | `FightLobby.tsx` |
| Combat → règles | ← Précédent | `fr-nav-btn` | `<Button variant="ghost-bordeaux" …>` | `fr-nav-btn` si `flex` | `FightRules.tsx` |
| Combat → règles | Suivant → | `fr-nav-btn fr-nav-btn--next` | `<Button className="fr-nav-btn" …>` (primary) | idem | `FightRules.tsx` |
| Combat → coût d'invocation | ✕ fermer | `scm-close` | `<Button variant="ghost-bordeaux" size="icon" aria-label="Fermer" onClick={onClose}><IconClose size={16} /></Button>` | `scm-close` si `position` | `SummonCostModal.tsx` |
| Combat → coût d'invocation | Annuler | `scm-btn-cancel` | `<Button variant="danger" className="scm-btn-cancel" onClick={onClose}>` | `scm-btn-cancel` (`flex: 1`) | `SummonCostModal.tsx` |
| Combat → coût d'invocation | ⬆️ Recycler & Invoquer | `scm-btn-confirm` | `<Button className="scm-btn-confirm" disabled={!canConfirm} onClick={onConfirm}>` | `scm-btn-confirm` (`flex: 2`) | `SummonCostModal.tsx` |
| Combat → choix de carte | Annuler | `cpm-btn-cancel` | `<Button variant="danger" className="cpm-btn-cancel" onClick={onCancel}>Annuler</Button>` (le « ✕ » du texte est retiré) | `cpm-btn-cancel` si `flex` | `CardPickModal.tsx` |

- [ ] **Step 2: Vérifier, compléter la liste (section « Combat hors plateau ») et commiter**

```bash
git add apps/frontend/src docs/superpowers/specs/2026-10-01-button-system-checklist.md
git commit -m "refactor(fight): use the shared Button component outside the board" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Profil, réglages, connexion, en-tête, son, decks

**Files:**
- Modify: `apps/frontend/src/pages/Profile.tsx`, `Profile.css`
- Modify: `apps/frontend/src/pages/Settings.tsx`, `Settings.css`
- Modify: `apps/frontend/src/pages/Login.tsx`, `Login.css`
- Modify: `apps/frontend/src/pages/ResetPassword.tsx` (+ son CSS si `login-btn` y est redéfini)
- Modify: `apps/frontend/src/__tests__/pages/Login.test.tsx`
- Modify: `apps/frontend/src/components/PrivacyButton.tsx`, `PrivacyButton.css`
- Modify: `apps/frontend/src/components/SoundButton.tsx`, `SoundButton.css`
- Modify: `apps/frontend/src/components/SoundSettings.tsx`, `SoundSettings.css`
- Modify: `apps/frontend/src/components/Header.tsx`, `Header.css`
- Modify: `apps/frontend/src/features/deck/DeckWidget.tsx`, `DeckWidget.css`
- Modify: `apps/frontend/src/features/deck/DeckBuilder.tsx`, `DeckBuilder.css`
- Modify: `docs/superpowers/specs/2026-10-01-button-system-checklist.md`

**Interfaces:**
- Consumes: `Button`, `IconClose`, `IconPlus`, `IconMinus`, `IconPencil`, `IconTrash`.

Fonds : tout est **clair** (pages crème, en-tête `#f5efe0`, menu du son `#f5efe0`, panneau des decks blanc, modale de deck blanche).

- [ ] **Step 1: Adapter le test de connexion (il doit échouer après la migration sinon)**

Dans `apps/frontend/src/__tests__/pages/Login.test.tsx`, ajouter en haut du fichier, après les `vi.mock` existants :

```tsx
// La bascule garde sa classe (élément non migré) ; Login charge le vrai i18n,
// donc on ne cible pas le libellé traduit.
const eyeButton = () =>
  document.querySelector<HTMLButtonElement>(".login-password-toggle")!;
```

et remplacer les trois `screen.getByRole("button", { pressed: … })` :

```tsx
  it("masque le mot de passe par défaut", () => {
    renderLogin();

    expect(passwordInput()).toHaveAttribute("type", "password");
    expect(eyeButton()).toHaveAttribute("aria-pressed", "false");
  });

  it("bascule entre visible et masqué au clic sur l'œil", async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(eyeButton());
    expect(passwordInput()).toHaveAttribute("type", "text");
    expect(eyeButton()).toHaveAttribute("aria-pressed", "true");

    await user.click(eyeButton());
    expect(passwordInput()).toHaveAttribute("type", "password");
  });
```

Run: `pnpm --filter @pipou/frontend exec vitest run src/__tests__/pages/Login.test.tsx`
Expected: PASS (le test passe déjà avant la migration, et continuera de passer après, alors que l'ancien `getByRole("button", { pressed: false })` aurait trouvé plusieurs boutons une fois les drapeaux de langue migrés).

- [ ] **Step 2: Migrer (procédure commune)**

| Écran | Bouton | Ancienne classe | Nouveau JSX | Classe de placement | Fichier |
|---|---|---|---|---|---|
| Profil (`/profile`) | Onglet Collection | `profile-tab-btn` (+ `--active`) | `<Button variant="ghost-bordeaux" active={tab === "collection"} className="profile-tab-btn" onClick={…}>` ; dans l'`IconCollection`, supprimer la prop `color` (l'icône suit `currentColor`) | `profile-tab-btn` : garder `flex-direction: column`, `gap`, `padding` (exception des tuiles) | `Profile.tsx` |
| Profil | Onglet Stats | `profile-tab-btn` (+ `--active`) | idem avec `tab === "stats"` et `IconStats` sans `color` | idem | `Profile.tsx` |
| Profil | Public / Privé | `privacy-btn` (+ `--private`) | `<Button variant="ghost-bordeaux" size="sm" onClick={onToggle} aria-label={…}>` (garder les icônes et libellés) | `privacy-btn` si `align-self`/`margin` | `PrivacyButton.tsx` |
| Réglages (`/settings`) | Se déconnecter | `settings-logout-btn` | `<Button variant="danger" size="lg" fullWidth onClick={handleLogout}>` | — | `Settings.tsx` |
| Réglages → son | − volume (×2) | `sound-row__btn` | `<Button variant="ghost-bordeaux" size="icon" aria-label={t("sound.decrease")} …><IconMinus size={16} /></Button>` (garder `onMouseDown`, `onMouseUp`, `onMouseLeave`, `onTouchStart`, `onTouchEnd`) | — | `SoundSettings.tsx` |
| Réglages → son | + volume (×2) | `sound-row__btn` | `<Button variant="ghost-bordeaux" size="icon" aria-label={t("sound.increase")} …><IconPlus size={16} /></Button>` (idem) | — | `SoundSettings.tsx` |
| En-tête / connexion | Haut-parleur | `sound-btn` | `<Button variant="ghost-bordeaux" size="icon" aria-label={t("sound.label")} onClick={…}>` (garder les `<svg>` existants) | — | `SoundButton.tsx` |
| En-tête → menu du son | ✕ fermer | `sound-widget__close` | `<Button variant="ghost-bordeaux" size="icon" aria-label="Fermer" onClick={…}><IconClose size={16} /></Button>` | `sound-widget__close` si `position` | `SoundButton.tsx` |
| En-tête (admin connecté) | 👑 Admin | `cc-header__admin-btn` | `<Button variant="ghost-bordeaux" size="sm" onClick={() => navigate("/admin")}>` | — | `Header.tsx` |
| Connexion (`/login`) | Drapeaux de langue | `login-lang-btn` (+ `--active`) | `<Button key={lang.code} variant="ghost-bordeaux" size="sm" active={i18n.language.startsWith(lang.code)} onClick={…}>` | — | `Login.tsx` |
| Connexion | Se connecter / S'inscrire / … | `login-btn` | `<Button size="lg" fullWidth className="login-btn" onClick={handleSubmit}>` | `login-btn` (`margin-top`) | `Login.tsx` |
| Réinitialisation (`/reset-password`) | Réinitialiser | `login-btn` | `<Button size="lg" fullWidth className="login-btn" onClick={handleSubmit}>` | idem | `ResetPassword.tsx` |
| Combat → onglet Deck | Decks ▾ | `dw-trigger` | `<Button variant="ghost-bordeaux" title="Mes decks" onClick={…}>` (garder les spans) | `dw-trigger` si `width`/`position` | `DeckWidget.tsx` |
| Combat → menu des decks | Gérer | `dw-btn-manage` | `<Button variant="ghost-bordeaux" size="sm" …>` | — | `DeckWidget.tsx` |
| Combat → menu des decks | + Créer un deck | `dw-btn-create` | `<Button size="sm" …>` (primary) | `dw-btn-create` si `width` | `DeckWidget.tsx` |
| Combat → menu des decks | Utiliser / ✓ Sélectionné | `dw-btn-select` / `dw-btn-selected` | `<Button variant="ghost-bordeaux" size="sm" active={selected} …>` (classe conditionnelle supprimée) | — | `DeckWidget.tsx` |
| Decks (`/decks`) | + Nouveau | `manager__add-btn` | `<Button size="sm" onClick={openCreate}>+ Nouveau</Button>` | — | `DeckBuilder.tsx` |
| Decks → un deck | Modifier | `deck-btn deck-btn--edit` | `<Button variant="ghost-bordeaux" size="icon" aria-label="Modifier" onClick={() => openEdit(d)}><IconPencil size={16} /></Button>` | — | `DeckBuilder.tsx` |
| Decks → un deck | Supprimer | `deck-btn deck-btn--delete` | `<Button variant="danger" size="icon" aria-label="Supprimer" onClick={() => removeDeck(d.id)}><IconTrash size={16} /></Button>` | — | `DeckBuilder.tsx` |
| Decks → édition | ← Retour | `manager-form__cancel` | `<Button variant="ghost-bordeaux" onClick={back}>← Retour</Button>` | — | `DeckBuilder.tsx` |
| Decks → édition | Inventaire / Mon deck | `deck-tab` (+ `--active`) | `<Button variant="ghost-bordeaux" active={tab === "inventory"} className="deck-tab" …>` / `tab === "deck"` (garder les badges) | `deck-tab` (`flex: 1`) | `DeckBuilder.tsx` |
| Decks → édition → liste | − carte | `deck-icon-btn deck-icon-btn--remove` | `<Button variant="ghost-bordeaux" size="icon" aria-label="Retirer" …><IconMinus size={16} /></Button>` | — | `DeckBuilder.tsx` |
| Decks → édition → liste | + carte | `deck-icon-btn deck-icon-btn--add` | `<Button variant="ghost-bordeaux" size="icon" aria-label="Ajouter" …><IconPlus size={16} /></Button>` | — | `DeckBuilder.tsx` |
| Decks → édition | 💾 Sauvegarder | `manager-form__submit deck-save-btn` | `<Button className="deck-save-btn" onClick={save} disabled={…}>` | `deck-save-btn` si `width`/`margin` | `DeckBuilder.tsx` |
| Decks → détail d'une carte (modale) | ✕ fermer | `deck-modal-close` | `<Button variant="ghost-bordeaux" size="icon" aria-label="Fermer" onClick={() => setSelectedCard(null)}><IconClose size={16} /></Button>` | `deck-modal-close` si `position` | `DeckBuilder.tsx` |
| Decks → détail d'une carte | − | `deck-modal-btn deck-modal-btn--remove` | `<Button variant="ghost-bordeaux" size="icon" aria-label="Retirer" …><IconMinus size={16} /></Button>` | — | `DeckBuilder.tsx` |
| Decks → détail d'une carte | + | `deck-modal-btn deck-modal-btn--add` | `<Button variant="ghost-bordeaux" size="icon" aria-label="Ajouter" …><IconPlus size={16} /></Button>` | — | `DeckBuilder.tsx` |

`manager-form__cancel`, `manager-form__submit` et `manager__add-btn` sont aussi utilisées par les gestionnaires admin : ne pas supprimer leurs règles dans `manager.css` à cette tâche (c'est fait à la tâche 10).

- [ ] **Step 3: Vérifier, compléter la liste (section « Profil, réglages, connexion, deck, en-tête ») et commiter**

```bash
git add apps/frontend/src docs/superpowers/specs/2026-10-01-button-system-checklist.md
git commit -m "refactor(frontend): use the shared Button component in profile, settings, login and decks" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Administration

**Files:**
- Modify: `apps/frontend/src/pages/Admin.tsx`, `Admin.css`
- Modify: `apps/frontend/src/features/boosters/BoosterManager.tsx`
- Modify: `apps/frontend/src/features/bundles/BundleManager.tsx`
- Modify: `apps/frontend/src/features/cards/CardManager.tsx`
- Modify: `apps/frontend/src/features/cards/CardSetManager.tsx`
- Modify: `apps/frontend/src/features/shop/BannerManager.tsx`, `BannerManager.css`
- Modify: `apps/frontend/src/features/quests/QuestManager.tsx`, `QuestManager.css`
- Modify: `apps/frontend/src/components/manager.css`
- Modify: `docs/superpowers/specs/2026-10-01-button-system-checklist.md`

**Interfaces:**
- Consumes: `Button`, `IconPencil`, `IconTrash`, `IconClose`, `IconPause`, `IconPlay`, `IconArrowLeft`, `IconArrowRight`.

Fond : **clair**. Ne pas toucher `bm-stepper__dot`.

- [ ] **Step 1: Migrer les onglets d'administration**

| Écran | Bouton | Ancienne classe | Nouveau JSX | Classe de placement | Fichier |
|---|---|---|---|---|---|
| Admin (`/admin`) | Onglets Card Sets / Cartes / … | `admin-tab-btn` (+ `--active`) | `<Button key={t.key} variant="ghost-bordeaux" active={tab === t.key} className="admin-tab-btn" onClick={…}>` | `admin-tab-btn` : garder `flex-direction`, `gap`, `padding` (exception des tuiles) | `Admin.tsx` |

- [ ] **Step 2: Migrer les gestionnaires**

Ces boutons sont identiques dans `BoosterManager`, `BundleManager`, `CardManager`, `CardSetManager`, `BannerManager`, `QuestManager`. Écran : « Admin → onglet <Boosters | Bundles | Cartes | Card Sets | Bannières | Quêtes> ». Ajouter **une ligne par gestionnaire et par bouton** au fichier de vérification.

| Bouton | Ancienne classe | Nouveau JSX |
|---|---|---|
| + Nouveau / + Nouvelle | `manager__add-btn` | `<Button size="sm" onClick={openCreate}>` (texte inchangé) |
| ✏ modifier | `manager-item__edit-btn` | `<Button variant="ghost-bordeaux" size="icon" aria-label="Modifier" onClick={…}><IconPencil size={16} /></Button>` |
| 🗑 supprimer | `manager-item__delete-btn` | `<Button variant="danger" size="icon" aria-label="Supprimer" onClick={…}><IconTrash size={16} /></Button>` |
| ⏸ / ▶ activer (`BannerManager` : `manager-item__edit-btn` avec `title`) | `manager-item__edit-btn` | `<Button variant="ghost-bordeaux" size="icon" aria-label={b.isActive ? "Désactiver" : "Activer"} onClick={() => handleToggle(b.id)}>{b.isActive ? <IconPause size={16} /> : <IconPlay size={16} />}</Button>` |
| ⏸ / ▶ activer (`QuestManager`) | `manager-item__content-btn` | `<Button variant="ghost-bordeaux" size="icon" aria-label={q.isActive ? "Désactiver" : "Activer"} onClick={() => handleToggle(q.id)}>{q.isActive ? <IconPause size={16} /> : <IconPlay size={16} />}</Button>` |
| ← page | `manager-pagination__btn` | `<Button variant="ghost-bordeaux" size="icon" aria-label="Page précédente" …><IconArrowLeft size={16} /></Button>` |
| → page | `manager-pagination__btn` | `<Button variant="ghost-bordeaux" size="icon" aria-label="Page suivante" …><IconArrowRight size={16} /></Button>` |
| ← Retour / ← Précédent | `manager-form__cancel` | `<Button variant="ghost-bordeaux" onClick={…}>` (texte inchangé) |
| Annuler (`CardSetManager`) | `manager-form__cancel` | `<Button variant="danger" onClick={cancel}>Annuler</Button>` |
| Créer / Modifier / Suivant → / ✓ Terminer / Sauvegarder le contenu | `manager-form__submit` | `<Button className="manager-form__submit" …>` (primary ; classe de placement : `flex: 1`) |
| + Ajouter un item / + Ajouter une condition | `manager-form__add-row` | `<Button variant="ghost-bordeaux" fullWidth onClick={…}>` |
| ✕ retirer une ligne de contenu (`BundleManager`) | `manager-content-row__remove` | `<Button variant="danger" size="icon" aria-label="Retirer" onClick={…}><IconClose size={16} /></Button>` |
| ✕ retirer une condition (`QuestManager`) | `quest-condition-row__remove` | `<Button variant="danger" size="icon" aria-label="Retirer" onClick={…}><IconClose size={16} /></Button>` |
| OK (édition d'une ligne de contenu, `BundleManager`) | `manager-form__submit` + `style={…}` | `<Button size="sm" onClick={handleUpdateContent} disabled={savingEdit}>` (supprimer l'attribut `style`) |
| ✕ annuler l'édition d'une ligne (`BundleManager`) | `manager-form__cancel` + `style={…}` | `<Button variant="danger" size="icon" aria-label="Annuler" onClick={cancelEditContent}><IconClose size={16} /></Button>` (supprimer l'attribut `style`) |

Dans `manager.css` (et `BannerManager.css` / `QuestManager.css` s'ils redéfinissent ces classes), appliquer les étapes 4 à 6 de la procédure commune à : `manager__add-btn`, `manager-item__edit-btn`, `manager-item__delete-btn`, `manager-item__content-btn`, `manager-pagination__btn`, `manager-form__cancel`, `manager-form__submit`, `manager-form__add-row`, `manager-content-row__remove`, `quest-condition-row__remove`. `manager-form__submit` devient une classe de placement (`flex: 1`). Ne pas toucher `.bm-stepper__dot`.

- [ ] **Step 3: Vérifier qu'il ne reste aucun emoji d'action**

Run: `grep -rnE "✏|🗑|⏸|▶" apps/frontend/src --include=*.tsx`
Expected: aucune ligne dans un `<Button>` ou un `<button>` (une occurrence dans un texte qui n'est pas un bouton est acceptable ; la signaler dans le rapport de tâche).

- [ ] **Step 4: Vérifier, compléter la liste (section « Admin ») et commiter**

```bash
git add apps/frontend/src docs/superpowers/specs/2026-10-01-button-system-checklist.md
git commit -m "refactor(admin): use the shared Button component and SVG icons" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Composants transverses

**Files:**
- Modify: `apps/frontend/src/components/Searchbar.tsx`, `Searchbar.css`
- Modify: `apps/frontend/src/components/ErrorBoundary.tsx`, `ErrorBoundary.css`
- Modify: `apps/frontend/src/components/ToastContainer.tsx`, `apps/frontend/src/hooks/useToast.css`
- Modify: `docs/superpowers/specs/2026-10-01-button-system-checklist.md`

**Interfaces:**
- Consumes: `Button`, `IconClose`.

Fonds : barre de recherche (marché, profil, admin) → **clair**. Page d'erreur (dégradé violet, conservé) et toasts (fonds colorés foncés) → **foncé**.

- [ ] **Step 1: Migrer (procédure commune)**

| Écran | Bouton | Ancienne classe | Nouveau JSX | Classe de placement | Fichier |
|---|---|---|---|---|---|
| Marché / Profil / Admin → recherche | Loupe | `search-bar__icon-btn` (+ `--active`) | `<Button variant="ghost-bordeaux" size="icon" active={searchOpen} aria-label={t("search.aria_search")} onClick={toggleSearch}><IconSearch size={16} /></Button>` | — | `Searchbar.tsx` |
| Marché / Profil / Admin → recherche | Filtres | `search-bar__icon-btn` (+ `--active`) | `<Button variant="ghost-bordeaux" size="icon" active={filterOpen} aria-label={t("search.aria_filter")} onClick={…}>` (supprimer `style={{ position: "relative" }}`, garder `IconFilter` et le point) | — | `Searchbar.tsx` |
| Page d'erreur (plantage) | Réessayer | `error-boundary-button error-boundary-button-primary` | `<Button variant="primary-inverse" onClick={this.handleReset}>Réessayer</Button>` | — | `ErrorBoundary.tsx` |
| Page d'erreur | Accueil | `error-boundary-button error-boundary-button-secondary` | `<Button variant="ghost-gold" onClick={() => (window.location.href = "/")}>Accueil</Button>` | — | `ErrorBoundary.tsx` |
| Toutes les pages → notification | × fermer | `toast__close` | `<Button variant="ghost-gold" size="icon" aria-label="Fermer" onClick={() => onRemove(toast.id)}><IconClose size={16} /></Button>` | `toast__close` si `position`/`margin` | `ToastContainer.tsx` |

`ErrorBoundary.test.tsx` cible « Réessayer » et « Accueil » par leur nom : il doit passer sans modification.

- [ ] **Step 2: Vérifier, compléter la liste (section « Composants transverses ») et commiter**

```bash
git add apps/frontend/src docs/superpowers/specs/2026-10-01-button-system-checklist.md
git commit -m "refactor(frontend): use the shared Button component in shared components" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Contrôle final

**Files:**
- Modify: `docs/superpowers/specs/2026-10-01-button-system-checklist.md` (si un oubli est trouvé)

- [ ] **Step 1: Lister les `<button>` restants**

Run: `grep -rn "<button" apps/frontend/src --include=*.tsx | grep -v __tests__ | grep -v "components/Button.tsx"`
Expected: uniquement les fichiers des éléments de jeu listés dans « Boutons de jeu laissés tels quels » du fichier de vérification (`FightActionBar`, `FightBoard`, `FightHand`, `ZoneRow`, `MonsterZoneContent`, `GraveyardPile`, `BuffDebuffList`, `FightTabBar`, `CardPickModal` pour `cpm-btn-confirm`, `FightHub`, `FightRules` pour `fr-bc-step`, les `…Manager.tsx` pour `bm-stepper__dot`, `CreateListingModal` pour les vignettes, `OpeningQuickAccess` pour les vignettes, `DailyRewardModal` pour `drm-rescue-option`, `Footer`, `Login` pour `login-password-toggle`). Tout autre `<button>` est un oubli : le migrer selon les règles de fond et l'ajouter au fichier de vérification.

- [ ] **Step 2: Vérifier qu'aucune ancienne classe ne subsiste**

Run: `grep -rnE "inv-row__open-btn|marketplace-(buy|cancel|edit|create-listing)-btn|manager-form__cancel|manager-item__(edit|delete)-btn|lobby-btn|login-btn|qi__claim-all|quest-item__claim-btn|drm-claim-btn|error-boundary-button" apps/frontend/src`
Expected: seules les classes conservées comme classes de placement (`login-btn`, `quest-item__claim-btn`, `manager-form__submit`…) apparaissent, et leurs règles CSS ne contiennent que des propriétés de placement.

Run: `grep -rn "#eebc77" apps/frontend/src --include=*.css | grep -i "background"`
Expected: aucune règle de bouton (des fonds décoratifs non-boutons peuvent rester).

- [ ] **Step 3: Tout lancer**

Run: `pnpm --filter @pipou/frontend typecheck` → aucune erreur.
Run: `pnpm --filter @pipou/frontend lint` → aucune erreur.
Run: `pnpm --filter @pipou/frontend test` → tous les tests passent.
Run: `pnpm --filter @pipou/frontend build` → succès.

- [ ] **Step 4: Commit (seulement si l'étape 1 ou 2 a donné lieu à des corrections)**

```bash
git add apps/frontend/src docs/superpowers/specs/2026-10-01-button-system-checklist.md
git commit -m "refactor(frontend): migrate the remaining buttons" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
