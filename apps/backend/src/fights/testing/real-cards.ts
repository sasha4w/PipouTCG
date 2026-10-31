import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Card } from '../../cards/card.entity';
import { ANCETRES_PATCHES } from '../../database/ancetres-2026-10-patches';
import { CARD_EFFECT_PATCHES } from '../../database/card-effect-patches';
import { CARD_REWORK_PATCHES } from '../../database/card-rework-patches';
import {
  BALANCE_NEW_CARDS,
  BALANCE_PATCHES,
} from '../../database/balance-2026-10-patches';
import { DRAKON_ORIGINES_CARDS } from '../../database/drakon-origines-cards';
import { GARDE_PATCHES } from '../../database/garde-2026-10-patches';
import {
  DRAKON_NEW_CARDS,
  DRAKON_PATCHES,
} from '../../database/drakon-set-patches';
import { normalizeCardName } from '../effects/card-name';

const SNAPSHOT = JSON.parse(
  readFileSync(join(__dirname, 'fixtures', 'cards.snapshot.json'), 'utf8'),
) as Card[];

/** Cartes telles qu'extraites du dump (avant la migration GenericCardEffects). */
export function rawSnapshotCards(): Card[] {
  return SNAPSHOT.map(
    (c: Omit<Card, 'image' | 'element' | 'lineage' | 'stage'>) => ({
      element: null,
      lineage: null,
      stage: null,
      ...c,
      image: null,
    }),
  );
}

/** Cartes après GenericCardEffects, avant le retravail (état de prod au 2026-10-17). */
export function allRealCardsBeforeRework(): Card[] {
  return rawSnapshotCards().map((c) => {
    const patch = CARD_EFFECT_PATCHES.find((p) => p.cardId === c.id);
    return patch ? { ...c, effects: patch.after } : c;
  });
}

/** Cartes après le set Drakon, avant le rééquilibrage 2026-10. */
export function allRealCardsBeforeBalance(): Card[] {
  const cards = allRealCardsBeforeRework()
    .map((c) => {
      const patch = CARD_REWORK_PATCHES.find((p) => p.before.name === c.name);
      return patch
        ? ({
            ...c,
            name: patch.after.name,
            description: patch.after.description,
            effects: patch.after.effects,
          } as Card)
        : c;
    })
    .map((c) => {
      const patch = DRAKON_PATCHES.find((p) => p.before.name === c.name);
      return patch
        ? ({
            ...c,
            name: patch.after.name,
            description: patch.after.description,
            hp: patch.after.hp,
            effects: patch.after.effects,
            element: patch.after.element,
            lineage: patch.after.lineage,
            stage: patch.after.stage,
          } as Card)
        : c;
    });
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
}

/** Cartes après le rééquilibrage 2026-10, avant le patch Garde / Relève. */
export function allRealCardsBeforeGarde(): Card[] {
  const cards = allRealCardsBeforeBalance().map((c) => {
    const patch = BALANCE_PATCHES.find((p) => p.before.name === c.name);
    return patch
      ? ({
          ...c,
          name: patch.after.name,
          description: patch.after.description,
          atk: patch.after.atk,
          hp: patch.after.hp,
          cost: patch.after.cost,
          effects: patch.after.effects,
        } as Card)
      : c;
  });
  const created = BALANCE_NEW_CARDS.map(
    (c, i) =>
      ({
        id: 91_001 + i,
        name: c.name,
        rarity: c.rarity,
        type: c.type,
        atk: c.atk,
        hp: c.hp,
        cost: c.cost,
        supportType: c.supportType,
        archetype: c.archetype,
        effects: c.effects,
        description: c.description,
        element: null,
        lineage: null,
        stage: null,
        image: null,
        cardSet: cards.find((x) => x.name === c.setOf)?.cardSet,
      }) as Card,
  );
  return [...cards, ...created];
}

/** Vraie carte par son nom (comparaison normalisée), effets post-migration. */
export function realCard(name: string): Card {
  const card = allRealCards().find(
    (c) => normalizeCardName(c.name) === normalizeCardName(name),
  );
  if (!card) throw new Error(`Carte « ${name} » absente de l'instantané`);
  return card;
}

/** Cartes avec les effets attendus après toutes les migrations de cartes. */
export function allRealCards(): Card[] {
  const cards = allRealCardsBeforeGarde().map((c) => {
    const patch = GARDE_PATCHES.find((p) => p.before.name === c.name);
    return patch
      ? ({
          ...c,
          name: patch.after.name,
          description: patch.after.description,
          atk: patch.after.atk,
          hp: patch.after.hp,
          cost: patch.after.cost,
          effects: patch.after.effects,
        } as Card)
      : c;
  });
  return [...withAncetres(cards), ...extensionCards(cards)];
}

/** Nerf d'Appel des ancêtres, après le patch Garde. */
function withAncetres(cards: Card[]): Card[] {
  return cards.map((c) => {
    const patch = ANCETRES_PATCHES.find((p) => p.before.name === c.name);
    return patch
      ? ({
          ...c,
          description: patch.after.description,
          effects: patch.after.effects,
        } as Card)
      : c;
  });
}

/** Extension Drakon (Ancestraux, Drakon des Origines), après le patch Garde. */
function extensionCards(cards: Card[]): Card[] {
  const set = cards.find((c) => c.name === 'Bébé Teros')?.cardSet;
  return DRAKON_ORIGINES_CARDS.map(
    (c, i) =>
      ({
        id: 92_001 + i,
        name: c.name,
        rarity: c.rarity,
        type: 'monster',
        atk: c.atk,
        hp: c.hp,
        cost: c.cost,
        supportType: null,
        archetype: 'dragon',
        effects: c.effects,
        description: c.description,
        element: c.element,
        lineage: c.lineage,
        stage: c.stage,
        image: null,
        cardSet: set,
      }) as Card,
  );
}
