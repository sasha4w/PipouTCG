import { SupportType, validateEffects } from '@pipou/shared';
import { realCard } from '../fights/testing/real-cards';
import { CHARGE_NEW_CARDS, NOVEMBER_PATCHES } from './cartes-2026-11-patches';

describe('patch de textes 2026-11', () => {
  it('chaque `before` décrit les effets de la carte actuelle', () => {
    for (const p of NOVEMBER_PATCHES)
      expect(realCard(p.after.name).effects).toEqual(p.before.effects);
  });

  it('Bluetooth : le texte précise « une seule fois » sur Beta', () => {
    expect(realCard('Module Bluetooth .v2').description).toContain(
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
