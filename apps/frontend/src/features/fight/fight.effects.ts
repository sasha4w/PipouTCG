import type { BuffEntry } from "./BuffDebuffList";

// ── Tables de traduction (miroir des enums backend) ───────────────────────

export const TRIGGER_LABEL: Record<string, string> = {
  ON_SUMMON: "Invocation",
  ON_DEATH: "Destruction",
  ON_ATTACK: "Attaque",
  ON_DEFEND: "Défense",
  ON_PLAY: "Jeu",
  ON_TURN_START: "Début de tour",
  ON_TURN_END: "Fin de tour",
  ON_ALLY_SUMMON: "Invocation alliée",
  PASSIVE: "Passif",
};

export const TARGET_SUFFIX: Record<string, string> = {
  SELF: "sur soi",
  ALLY_MONSTER: "sur un allié",
  ALL_ALLIES: "sur tous les alliés",
  ALLIES_EXCEPT_SELF: "sur les alliés",
  ENEMY_MONSTER: "sur un ennemi",
  ALL_ENEMIES: "sur tous les ennemis",
  PLAYER: "au joueur",
  OPPONENT: "à l'adversaire",
  ARCHETYPE_ALLIES: "sur les alliés (archétype)",
  TARGET_ALLY: "sur l'allié ciblé",
};

interface ActionMeta {
  icon: string;
  label: (value?: number) => string;
  type: BuffEntry["type"];
}

export const ACTION_META: Record<string, ActionMeta> = {
  BUFF_ATK: { icon: "⚔️", label: (v) => `+${v ?? "?"} ATK`, type: "buff" },
  BUFF_HP: { icon: "❤️", label: (v) => `+${v ?? "?"} HP`, type: "buff" },
  BUFF_ATK_TEMP: {
    icon: "⚡",
    label: (v) => `+${v ?? "?"} ATK (ce tour)`,
    type: "buff",
  },
  DEAL_DAMAGE: {
    icon: "💥",
    label: (v) => `${v ?? "?"} dégâts`,
    type: "debuff",
  },
  HEAL: { icon: "💊", label: (v) => `+${v ?? "?"} HP (soin)`, type: "buff" },
  DRAW: {
    icon: "🃏",
    label: (v) => `Pioche ${v ?? "?"} carte(s)`,
    type: "neutral",
  },
  STEAL_PRIME: { icon: "🏆", label: () => "Vole une Prime", type: "debuff" },
  DESTROY_MONSTER: { icon: "💀", label: () => "Détruit", type: "debuff" },
  RETURN_TO_HAND: {
    icon: "↩️",
    label: () => "Retour en main",
    type: "neutral",
  },
  DISCARD: {
    icon: "🗑️",
    label: (v) => `Défausse ${v ?? "?"} carte(s)`,
    type: "debuff",
  },
  SET_TAUNT: { icon: "🛡", label: () => "Donne Provocation", type: "buff" },
  SET_PIERCING: { icon: "🗡", label: () => "Donne Perçant", type: "buff" },
  SET_ATTACKS_PER_TURN: {
    icon: "✖️",
    label: (v) => `Attaques ×${v ?? "?"}`,
    type: "buff",
  },
  SET_DEBUFF_IMMUNITY: {
    icon: "✨",
    label: () => "Immunité débuffs",
    type: "buff",
  },
  SET_DELAY_DOUBLE_ATK: {
    icon: "⚡",
    label: () => "Double attaque (prochain tour)",
    type: "buff",
  },
  FORCE_ATTACK_MODE: {
    icon: "⚔️",
    label: () => "Force mode Attaque",
    type: "debuff",
  },
  FORCE_ATTACK_MODE_ENEMY: {
    icon: "😈",
    label: () => "Force l'ennemi en Attaque",
    type: "debuff",
  },
  RETURN_FROM_GRAVEYARD: {
    icon: "♻️",
    label: () => "Récupère depuis le cimetière",
    type: "neutral",
  },
  RETURN_FROM_GRAVEYARD_OR_DECK: {
    icon: "🔍",
    label: () => "Récupère cimetière/deck",
    type: "neutral",
  },
  SEARCH_DECK: {
    icon: "🔍",
    label: () => "Cherche dans le deck",
    type: "neutral",
  },
  GAIN_RECYCLE_ENERGY: {
    icon: "⚡",
    label: (v) => `+${v ?? "?"} Énergie recycle`,
    type: "buff",
  },
  SET_FREE_SUMMON: {
    icon: "🎁",
    label: () => "Invocation gratuite",
    type: "buff",
  },
  SET_DAMAGE_REDUCTION: {
    icon: "🛡",
    label: (v) => `Réduction dégâts ×${v ?? "?"}`,
    type: "buff",
  },
  BUFF_HP_PER_ADJACENT_ALLY: {
    icon: "❤️",
    label: (v) => `+${v ?? "?"} HP par allié adjacent`,
    type: "buff",
  },
  SET_TURN_COUNTER: {
    icon: "⏳",
    label: (v) => `Compteur ${v ?? "?"} tours`,
    type: "neutral",
  },
  BLOCK_ATTACK: {
    icon: "🧊",
    label: (v) => `Bloque les attaques ${v ?? "?"} tour(s)`,
    type: "debuff",
  },
  FORCE_GUARD_LOCK_ENEMY: {
    icon: "🔒",
    label: () => "Verrouille en mode Garde",
    type: "debuff",
  },
};

export interface RawAction {
  type?: string;
  target?: string;
  value?: number;
}
export interface RawEffect {
  trigger?: string;
  actions?: RawAction[];
}

/**
 * Convertit un tableau CardEffect[] (format backend) en BuffEntry[] lisibles.
 * Utilisé dans FightHand (carte en main) et ZoneRow (carte sur plateau).
 */
export function getCardEffectEntries(
  effects: RawEffect[] | null | undefined,
  description?: string | null,
  supportType?: string | null,
): BuffEntry[] {
  const entries: BuffEntry[] = [];

  // ── Chip contextuel selon supportType ────────────────────────────────────
  if (supportType === "TERRAIN")
    entries.push({
      icon: "🗺️",
      label: "Terrain — affecte les deux camps",
      type: "neutral",
    });
  if (supportType === "EPHEMERAL")
    entries.push({
      icon: "⏳",
      label: "Éphémère — s'épuise après usage",
      type: "neutral",
    });

  // ── CardEffect[] → entrées lisibles ──────────────────────────────────────
  for (const eff of effects ?? []) {
    const trigger = eff.trigger
      ? (TRIGGER_LABEL[eff.trigger] ?? eff.trigger)
      : null;
    for (const action of eff.actions ?? []) {
      const meta = action.type ? ACTION_META[action.type] : undefined;
      if (!meta) continue;
      const targetSuffix = action.target
        ? (TARGET_SUFFIX[action.target] ?? action.target)
        : null;
      const parts = [trigger, meta.label(action.value), targetSuffix].filter(
        Boolean,
      );
      entries.push({
        icon: meta.icon,
        label: parts.join(" · "),
        type: meta.type,
      });
    }
  }

  // ── Description texte libre ───────────────────────────────────────────────
  if (description)
    entries.push({ icon: "📖", label: description, type: "neutral" });

  return entries;
}
