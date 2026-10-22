import { ActionType, EffectTarget, EffectTrigger } from "../enums/effect";
import type { DrakonElement, DrakonStage } from "../enums/card";
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

/** Monstre posé chez `hostUserId` par l'adversaire (Zeta). */
export function isImplanted(
  m: { ownerUserId?: number },
  hostUserId: number,
): boolean {
  return m.ownerUserId !== undefined && m.ownerUserId !== hostUserId;
}

/** Monstre implanté par `posterUserId` (chez son adversaire). */
export function isPlantedBy(
  m: { ownerUserId?: number },
  posterUserId: number,
): boolean {
  return m.ownerUserId === posterUserId;
}

/** Le poseur peut-il implanter un monstre sur ce terrain ? (un seul à la fois) */
export function canImplantOn(
  hostZones: readonly ({ ownerUserId?: number } | null)[],
  posterUserId: number,
): boolean {
  return !hostZones.some((m) => !!m && m.ownerUserId === posterUserId);
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

interface EphemeralTarget {
  isImmuneToDebuffs: boolean;
  supportDestroyImmune?: boolean;
  hatchCounter?: number;
  summonedThisTurn?: boolean;
  instantEvolution?: boolean;
  canEvolveThisTurn?: boolean;
  card?: { baseCard: { stage?: DrakonStage | null } };
}

const CHOSEN_TARGETS = new Set<string>([
  EffectTarget.ENEMY_MONSTER,
  EffectTarget.ALLY_MONSTER,
  EffectTarget.TARGET_ALLY,
]);

/** L'action changerait-elle quelque chose pour ce monstre ? */
function actionBenefits(type: ActionType, monster: EphemeralTarget): boolean {
  switch (type) {
    case ActionType.ADVANCE_HATCH:
      return monster.hatchCounter !== undefined;
    case ActionType.ALLOW_EVOLUTION_THIS_TURN:
      return (
        !!monster.card?.baseCard.stage &&
        !canEvolveNow({ ...monster, summonedThisTurn: !!monster.summonedThisTurn })
      );
    default:
      return true;
  }
}

/** Un Éphémère aux effets donnés peut-il choisir ce monstre ? */
export function isTargetableByEphemeral(
  monster: EphemeralTarget,
  side: "ally" | "enemy",
  effects: readonly CardEffect[] | null | undefined,
): boolean {
  if (side === "enemy" && !isTargetableByEnemyEffects(monster)) return false;
  if (ephemeralDestroysChosenTarget(effects) && monster.supportDestroyImmune)
    return false;
  // Au moins une action sur la cible choisie doit lui servir à quelque chose
  const chosenActions = (effects ?? [])
    .filter((e) => e.trigger === EffectTrigger.ON_PLAY)
    .flatMap((e) => e.actions)
    .filter((a) => CHOSEN_TARGETS.has(a.target));
  return (
    chosenActions.length === 0 ||
    chosenActions.some((a) => actionBenefits(a.type, monster))
  );
}

const NEXT_STAGE: Partial<Record<DrakonStage, DrakonStage>> = {
  baby: "young",
  young: "adult",
  adult: "ancestral",
};

/** Stades qui n'arrivent en jeu que par évolution : Jeune, Adulte, Ancestral. */
function isEvolutionStage(stage: DrakonStage | null): boolean {
  return stage === "young" || stage === "adult" || stage === "ancestral";
}

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
  if (!isEvolutionStage(card.stage)) return false;
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

/**
 * Un Jeune ou un Adulte Drakon n'arrive en jeu que par évolution (ou par
 * l'effet d'un Œuf) : jamais posé directement depuis la main.
 */
export function canSummonFromHand(card: { stage: DrakonStage | null }): boolean {
  return !isEvolutionStage(card.stage);
}

/**
 * Un Jeune ou un Adulte Drakon coincé en main peut être défaussé pour
 * récupérer le Bébé de sa lignée (une fois par tour).
 */
export function canTransform(card: {
  stage: DrakonStage | null;
  lineage?: string | null;
}): boolean {
  return isEvolutionStage(card.stage) && !!card.lineage;
}

/** Délai : une base posée ce tour n'évolue pas, sauf accélérateur. */
export function canEvolveNow(base: {
  summonedThisTurn: boolean;
  instantEvolution?: boolean;
  canEvolveThisTurn?: boolean;
}): boolean {
  return !base.summonedThisTurn || !!base.instantEvolution || !!base.canEvolveThisTurn;
}

/** Les 4 éléments que le Drakon des Origines réclame au cimetière. */
export const ORIGIN_ELEMENTS = ["earth", "fire", "water", "wind"] as const;

/**
 * Le cimetière contient-il un Adulte ou un Ancestral de chacun des 4
 * éléments ? (condition d'invocation du Drakon des Origines)
 */
export function graveyardHasAllElements(
  graveyard: { stage: DrakonStage | null; element: DrakonElement | null }[],
): boolean {
  return ORIGIN_ELEMENTS.every((element) =>
    graveyard.some(
      (c) =>
        c.element === element &&
        (c.stage === "adult" || c.stage === "ancestral"),
    ),
  );
}
