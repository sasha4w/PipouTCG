import { validateEffects } from '@pipou/shared';
import {
  allRealCards,
  allRealCardsBeforePixelmanNerf,
  realCard,
} from '../fights/testing/real-cards';
import { PIXELMAN_NERF_PATCHES } from './pixelman-2026-11-nerf-patches';

describe('nerf Pixelman 2026-11', () => {
  it('chaque `before` décrit la carte actuelle', () => {
    for (const p of PIXELMAN_NERF_PATCHES) {
      const card = allRealCardsBeforePixelmanNerf().find(
        (c) => c.name === p.before.name,
      )!;
      expect({
        description: card.description,
        atk: card.atk,
        hp: card.hp,
        cost: card.cost,
        effects: card.effects,
      }).toEqual({
        description: p.before.description,
        atk: p.before.atk,
        hp: p.before.hp,
        cost: p.before.cost,
        effects: p.before.effects,
      });
    }
  });

  it('les effets patchés sont valides et portés par les vraies cartes', () => {
    for (const p of PIXELMAN_NERF_PATCHES) {
      const card = realCard(p.after.name);
      expect(card.effects).toEqual(p.after.effects);
      expect(card.description).toBe(p.after.description);
      expect(
        validateEffects(card.supportType ?? 'monster', card.effects ?? []),
      ).toEqual([]);
    }
    expect(allRealCards().filter((c) => c.name === 'Noyau Beta')).toHaveLength(
      1,
    );
  });

  it('Module Bluetooth .v2 : seul le coup sur Beta baisse, à 300', () => {
    const [before, after] = [
      PIXELMAN_NERF_PATCHES.find(
        (p) => p.before.name === 'Module Bluetooth .v2',
      )!.before.effects!,
      realCard('Module Bluetooth .v2').effects!,
    ];
    expect(after.map((e) => e.actions[0].value)).toEqual([2, 300, 600, 600]);
    expect(after.map((e) => e.condition)).toEqual(
      before.map((e) => e.condition),
    );
  });
});
