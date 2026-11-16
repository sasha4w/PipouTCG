import { ActionType, EffectTrigger } from "../enums/effect";
import type { CardEffect, EffectFilter } from "./effect";

type Effects = CardEffect[] | null | undefined;

function passiveAction(effects: Effects, type: ActionType) {
  for (const e of effects ?? [])
    if (e.trigger === EffectTrigger.PASSIVE)
      for (const a of e.actions) if (a.type === type) return a;
  return undefined;
}

/** Condition « N cartes du filtre au cimetière » (Maître Magouille), ou null. */
export function graveyardCountRequirement(
  effects: Effects,
): { value: number; filter?: EffectFilter } | null {
  const a = passiveAction(effects, ActionType.SUMMON_IF_GRAVEYARD_COUNT);
  return a ? { value: a.value ?? 0, filter: a.filter } : null;
}

type GraveCard = {
  type: string;
  archetype: string | null;
  rarity: string;
  name: string;
};

function matches(c: GraveCard, f: EffectFilter | undefined): boolean {
  if (!f) return true;
  if (f.archetype && c.archetype !== f.archetype) return false;
  if (f.type && c.type !== f.type) return false;
  if (f.rarities && !f.rarities.includes(c.rarity as never)) return false;
  return true;
}

/** Vrai si la carte n'a pas de condition de cimetière, ou si elle est remplie. */
export function meetsGraveyardCount(effects: Effects, graveyard: GraveCard[]): boolean {
  const req = graveyardCountRequirement(effects);
  if (!req) return true;
  return graveyard.filter((c) => matches(c, req.filter)).length >= req.value;
}

/** Carte qui n'arrive en jeu que par un effet (Noyau Delta). */
export function summonOnlyByEffect(effects: Effects): boolean {
  return !!passiveAction(effects, ActionType.SUMMON_ONLY_BY_EFFECT);
}

/** Charge qui avance quand son propriétaire pose un équipement, pas au début du tour. */
export function chargesOnEquipment(effects: Effects): boolean {
  return !!passiveAction(effects, ActionType.CHARGE_ON_EQUIPMENT);
}
