import { ActionType, EffectTarget, EffectTrigger } from "../enums/effect";
import type { DrakonStage } from "../enums/card";
import type { CardEffect } from "./effect";

/** Règles de construction d'un deck (création et lancement de match). */
export const DECK_RULES = { MIN_CARDS: 30, MAX_CARDS: 40, MAX_COPIES: 3 } as const;

/** Primes mises de côté en début de partie. */
export const STARTING_PRIMES = 6;

/** Taille de la main de départ. */
export const STARTING_HAND = 5;

/** Nombre maximum de cartes en main à la fin du tour. */
export const HAND_LIMIT = 7;

/**
 * Camp de la cible à choisir avant de jouer un Éphémère (null : carte non
 * ciblée). Lu sur les actions ON_PLAY : ENEMY_MONSTER → adverse,
 * ALLY_MONSTER / TARGET_ALLY → alliée.
 */
export function ephemeralTargetSide(
  effects: readonly CardEffect[] | null | undefined,
): "ally" | "enemy" | null {
  for (const eff of effects ?? []) {
    if (eff.trigger !== EffectTrigger.ON_PLAY) continue;
    for (const action of eff.actions) {
      if (action.target === EffectTarget.ENEMY_MONSTER) return "enemy";
      if (
        action.target === EffectTarget.ALLY_MONSTER ||
        action.target === EffectTarget.TARGET_ALLY
      )
        return "ally";
    }
  }
  return null;
}

/** La carte peut être invoquée sur une zone adverse libre (effet passif). */
export function canSummonOnEnemySide(
  effects: readonly CardEffect[] | null | undefined,
): boolean {
  return (effects ?? []).some(
    (e) =>
      e.trigger === EffectTrigger.PASSIVE &&
      e.actions.some((a) => a.type === ActionType.SUMMONABLE_ON_ENEMY_SIDE),
  );
}

/** Un effet adverse peut-il viser ce monstre ? (Maître Magouille : non.) */
export function isTargetableByEnemyEffects(monster: {
  isImmuneToDebuffs: boolean;
}): boolean {
  return !monster.isImmuneToDebuffs;
}

/**
 * L'Éphémère détruit-il le monstre qu'on lui désigne ? (DESTROY_MONSTER sur
 * ENEMY_MONSTER / ALLY_MONSTER / TARGET_ALLY dans ses actions ON_PLAY.)
 */
export function ephemeralDestroysChosenTarget(
  effects: readonly CardEffect[] | null | undefined,
): boolean {
  return (effects ?? []).some(
    (e) =>
      e.trigger === EffectTrigger.ON_PLAY &&
      e.actions.some(
        (a) =>
          a.type === ActionType.DESTROY_MONSTER &&
          (a.target === EffectTarget.ENEMY_MONSTER ||
            a.target === EffectTarget.ALLY_MONSTER ||
            a.target === EffectTarget.TARGET_ALLY),
      ),
  );
}

/** Un Éphémère aux effets donnés peut-il choisir ce monstre ? */
export function isTargetableByEphemeral(
  monster: { isImmuneToDebuffs: boolean; supportDestroyImmune?: boolean },
  side: "ally" | "enemy",
  effects: readonly CardEffect[] | null | undefined,
): boolean {
  if (side === "enemy" && !isTargetableByEnemyEffects(monster)) return false;
  if (ephemeralDestroysChosenTarget(effects) && monster.supportDestroyImmune)
    return false;
  return true;
}

const NEXT_STAGE: Partial<Record<DrakonStage, DrakonStage>> = {
  baby: "young",
  young: "adult",
};

interface EvolvingCard {
  stage: DrakonStage | null;
  lineage: string | null;
  cost: number;
}
interface EvolutionBase {
  card: { baseCard: EvolvingCard };
  evolutionJoker?: boolean;
}

/** `card` (en main) peut-il évoluer sur `base` (en jeu) ? */
export function canEvolveOnto(card: EvolvingCard, base: EvolutionBase): boolean {
  if (card.stage !== "young" && card.stage !== "adult") return false;
  if (base.evolutionJoker && card.stage === "young") return true;
  const b = base.card.baseCard;
  return (
    !!b.stage &&
    NEXT_STAGE[b.stage] === card.stage &&
    !!b.lineage &&
    b.lineage === card.lineage
  );
}

/** Coût restant à payer pour évoluer. */
export function evolutionCost(card: EvolvingCard, base: EvolutionBase): number {
  return Math.max(0, card.cost - base.card.baseCard.cost);
}

/** Délai : une base posée ce tour n'évolue pas, sauf accélérateur. */
export function canEvolveNow(base: {
  summonedThisTurn: boolean;
  instantEvolution?: boolean;
  canEvolveThisTurn?: boolean;
}): boolean {
  return !base.summonedThisTurn || !!base.instantEvolution || !!base.canEvolveThisTurn;
}
