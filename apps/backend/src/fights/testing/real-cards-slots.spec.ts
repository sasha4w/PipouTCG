import { SupportType } from '@pipou/shared';
import { allRealCards } from './real-cards';

describe('cartes réelles : emplacements d’équipement', () => {
  it('chaque Équipement a un emplacement (noms de la migration)', () => {
    const missing = allRealCards()
      .filter(
        (c) => c.supportType === SupportType.EQUIPMENT && !c.equipmentSlot,
      )
      .map((c) => c.name);
    expect(missing).toEqual([]);
  });
});
