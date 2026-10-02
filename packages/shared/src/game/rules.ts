import { EffectTarget, EffectTrigger } from "../enums/effect";
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
