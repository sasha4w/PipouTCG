import {
  ActionType,
  CardEffect,
  EffectTrigger,
  Rarity,
} from '@pipou/shared';
import { ForgeCardInfo, validateForge } from './forge-rules';

const card = (
  id: number,
  rarity: Rarity = Rarity.COMMON,
  setId: number | null = 1,
  effects: CardEffect[] | null = null,
): ForgeCardInfo => ({ id, rarity, setId, effects });

const input = (c: ForgeCardInfo, quantity: number, usable = quantity) => ({
  card: c,
  quantity,
  usable,
});

const target = () => card(100, Rarity.UNCOMMON, 1);
const tenCommons = () => [input(card(1), 5), input(card(2), 5)];

describe('validateForge', () => {
  it('accepte 10 communes du même set vers une peu commune', () => {
    expect(validateForge(tenCommons(), target())).toBeNull();
  });

  it('refuse un total différent du coût', () => {
    expect(
      validateForge([input(card(1), 5), input(card(2), 4)], target()),
    ).toContain('10');
    expect(
      validateForge([input(card(1), 5), input(card(2), 6)], target()),
    ).toContain('10');
  });

  it('refuse de mélanger raretés ou sets', () => {
    expect(
      validateForge(
        [input(card(1), 5), input(card(2, Rarity.UNCOMMON), 5)],
        target(),
      ),
    ).not.toBeNull();
    expect(
      validateForge(
        [input(card(1), 5), input(card(2, Rarity.COMMON, 2), 5)],
        target(),
      ),
    ).not.toBeNull();
  });

  it('refuse si usable < quantity', () => {
    expect(
      validateForge([input(card(1), 5, 3), input(card(2), 5)], target()),
    ).not.toBeNull();
  });

  it('refuse une quantité invalide ou une liste vide', () => {
    expect(validateForge([], target())).not.toBeNull();
    expect(
      validateForge([input(card(1), 0), input(card(2), 10)], target()),
    ).not.toBeNull();
    expect(
      validateForge([input(card(1), -5), input(card(2), 15)], target()),
    ).not.toBeNull();
    expect(
      validateForge([input(card(1), 2.5), input(card(2), 7.5)], target()),
    ).not.toBeNull();
  });

  it('refuse une cible de mauvaise rareté, de autre set ou sans set', () => {
    expect(
      validateForge(tenCommons(), card(100, Rarity.RARE, 1)),
    ).not.toBeNull();
    expect(
      validateForge(tenCommons(), card(100, Rarity.COMMON, 1)),
    ).not.toBeNull();
    expect(
      validateForge(tenCommons(), card(100, Rarity.UNCOMMON, 2)),
    ).not.toBeNull();
    expect(
      validateForge(tenCommons(), card(100, Rarity.UNCOMMON, null)),
    ).not.toBeNull();
  });

  it('refuse une cible à invocation tous éléments', () => {
    const effects = [
      {
        trigger: EffectTrigger.PASSIVE,
        actions: [{ type: ActionType.SUMMON_IF_ALL_ELEMENTS }],
      },
    ] as unknown as CardEffect[];
    expect(
      validateForge(tenCommons(), card(100, Rarity.UNCOMMON, 1, effects)),
    ).not.toBeNull();
  });

  it('refuse des entrées légendaires', () => {
    const leg = (id: number) => card(id, Rarity.LEGENDARY, 1);
    expect(
      validateForge(
        [input(leg(1), 5), input(leg(2), 5)],
        card(100, Rarity.SECRET, 1),
      ),
    ).not.toBeNull();
  });

  it('additionne les lignes de même carte pour usable', () => {
    const c = card(1);
    expect(
      validateForge(
        [input(c, 6, 10), input(c, 6, 10), input(card(2), 0)],
        target(),
      ),
    ).not.toBeNull();
    expect(
      validateForge([input(c, 6, 10), input(c, 4, 10)], target()),
    ).toBeNull();
  });
});
