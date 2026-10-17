import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Card } from '../../cards/card.entity';
import { CARD_EFFECT_PATCHES } from '../../database/card-effect-patches';
import { CARD_REWORK_PATCHES } from '../../database/card-rework-patches';
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

/** Cartes avec les effets attendus après toutes les migrations de cartes. */
export function allRealCards(): Card[] {
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

/** Vraie carte par son nom (comparaison normalisée), effets post-migration. */
export function realCard(name: string): Card {
  const card = allRealCards().find(
    (c) => normalizeCardName(c.name) === normalizeCardName(name),
  );
  if (!card) throw new Error(`Carte « ${name} » absente de l'instantané`);
  return card;
}
