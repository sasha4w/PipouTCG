import {
  ActionType,
  EffectTarget,
  EffectTrigger,
  EquipmentSlot,
} from '@pipou/shared';
import { createEngine } from '../testing/engine';
import { act, effect, equipmentCard, monsterCard } from '../testing/cards';
import { scenario } from '../testing/scenario';

const engine = createEngine();
const off = (n: string) =>
  equipmentCard(n, [], { equipmentSlot: EquipmentSlot.OFFENSIVE });
const acc = (n: string) =>
  equipmentCard(n, [], { equipmentSlot: EquipmentSlot.ACCESSORY });

const setup = (
  hand: ReturnType<typeof off>[],
  equipments: ReturnType<typeof off>[] = [],
) => {
  const game = scenario({
    p1: {
      hand,
      monsters: [
        { card: monsterCard('Alpha', { atk: 100, hp: 1000 }), equipments },
      ],
    },
  });
  const host = game.player1.monsterZones[0]!;
  const equip = (handIndex: number, replaceInstanceId?: string) =>
    engine.dispatch(game, 'p1', {
      type: 'play_support',
      handIndex,
      targetInstanceId: host.instanceId,
      ...(replaceInstanceId && { replaceInstanceId }),
    });
  return { game, host, equip };
};

describe('emplacements d’équipement', () => {
  it('équipe dans un emplacement libre', () => {
    const { host, equip } = setup([off('Canon')]);
    expect(equip(0).error).toBeUndefined();
    expect(host.equipments.map((e) => e.baseCard.name)).toEqual(['Canon']);
  });

  it('emplacement plein sans confirmation : refusé, carte rendue', () => {
    const { game, equip } = setup([off('Canon')], [off('Processeur')]);
    expect(equip(0).error).toBe('Emplacement plein : confirme le remplacement');
    expect(game.player1.hand).toHaveLength(1);
  });

  it('remplacement : l’ancien part au cimetière', () => {
    const { game, host, equip } = setup([off('Canon')], [off('Processeur')]);
    const old = host.equipments[0].instanceId;
    expect(equip(0, old).error).toBeUndefined();
    expect(host.equipments.map((e) => e.baseCard.name)).toEqual(['Canon']);
    expect(game.player1.graveyard.map((c) => c.baseCard.name)).toContain(
      'Processeur',
    );
  });

  it('remplacement d’un équipement d’un autre emplacement : refusé', () => {
    const { equip, host } = setup(
      [off('Canon')],
      [off('Processeur'), acc('Module')],
    );
    const wrong = host.equipments[1].instanceId;
    expect(equip(0, wrong).error).toBe('Équipement à remplacer introuvable');
  });

  it('deux accessoires différents, pas de doublon', () => {
    const { equip } = setup([acc('Module'), acc('Module'), acc('Autre')]);
    expect(equip(0).error).toBeUndefined();
    expect(equip(0).error).toBe('Ce monstre porte déjà cet accessoire');
    expect(equip(1).error).toBeUndefined();
  });

  it('les bonus de l’équipement remplacé disparaissent', () => {
    const buff = (v: number) => [
      effect(EffectTrigger.PASSIVE, [
        act(ActionType.BUFF_ATK, EffectTarget.SELF, { value: v }),
      ]),
    ];
    const proc = equipmentCard('Processeur', buff(100), {
      equipmentSlot: EquipmentSlot.OFFENSIVE,
    });
    const canon = equipmentCard('Canon', buff(250), {
      equipmentSlot: EquipmentSlot.OFFENSIVE,
    });
    const { game, host, equip } = setup([canon], [proc]);
    expect(equip(0, host.equipments[0].instanceId).error).toBeUndefined();
    expect(host.atkBuff).toBe(250);
  });
});
