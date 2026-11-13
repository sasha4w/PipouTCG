import { SupportType, validateEffects } from '@pipou/shared';
import {
  allRealCardsBeforePixelmanNerf,
  realCard,
} from '../fights/testing/real-cards';
import { CHARGE_NEW_CARDS, NOVEMBER_PATCHES } from './cartes-2026-11-patches';

/** Carte telle que la laisse ce patch, avant le nerf Pixelman qui le suit. */
const patched = (name: string) =>
  allRealCardsBeforePixelmanNerf().find((c) => c.name === name)!;

describe('patch de textes 2026-11', () => {
  it('chaque `before` décrit les effets de la carte à ce patch', () => {
    for (const p of NOVEMBER_PATCHES)
      expect(patched(p.after.name).effects).toEqual(p.before.effects);
  });

  it('Bluetooth : le texte précise « une seule fois » sur Beta', () => {
    expect(patched('Module Bluetooth .v2').description).toContain(
      "Sur Beta : à l'équipement, inflige une seule fois 600 dégâts à tous les monstres adverses",
    );
  });

  it('Œuf Céleste : le texte annonce le repli', () => {
    expect(realCard('Œuf Céleste').description).toContain('deck ou cimetière');
  });

  it('les cartes Charge sont valides pour le schéma d’effets', () => {
    expect(CHARGE_NEW_CARDS.map((c) => c.name)).toEqual([
      'Alerte générale',
      'Extraction de données',
      'Méditation céleste',
    ]);
    for (const c of CHARGE_NEW_CARDS)
      expect(validateEffects(SupportType.CHARGE, c.effects)).toEqual([]);
  });
});
