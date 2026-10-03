import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Card } from '../../cards/card.entity';
import { CARD_EFFECT_PATCHES } from '../../database/card-effect-patches';
import { normalizeCardName } from '../effects/card-name';

const SNAPSHOT = JSON.parse(
  readFileSync(join(__dirname, 'fixtures', 'cards.snapshot.json'), 'utf8'),
) as Card[];

/** Cartes telles qu'extraites du dump (avant la migration GenericCardEffects). */
export function rawSnapshotCards(): Card[] {
  return SNAPSHOT.map((c) => ({ ...c, image: null }));
}

/** Cartes avec les effets attendus après la migration GenericCardEffects. */
export function allRealCards(): Card[] {
  return rawSnapshotCards().map((c) => {
    const patch = CARD_EFFECT_PATCHES.find((p) => p.cardId === c.id);
    return patch ? { ...c, effects: patch.after } : c;
  });
}

/** Vraie carte par son nom (comparaison normalisée), effets post-migration. */
export function realCard(name: string): Card {
  const card = allRealCards().find(
    (c) => normalizeCardName(c.name) === normalizeCardName(name),
  );
  if (!card) throw new Error(`Carte « ${name} » absente de l'instantané`);
  return card;
}
