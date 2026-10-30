import type { TFunction } from "i18next";
import {
  EffectTarget,
  EffectTrigger,
  type CardEffect,
  type EffectAction,
  type EffectCondition,
  type EffectFilter,
} from "@pipou/shared";

// ── Mots-clés (glossaire partagé avec les règles) ──────────────────────────

export const KEYWORD_ICON = {
  taunt: "🛡",
  piercing: "🗡",
  debuffImmunity: "✨",
  combatImmunity: "🌀",
  supportShield: "🧱",
  // Icônes SVG fournies par KeywordIcon
  combatEndure: "",
  supportDebuffImmunity: "",
  monsterDebuffImmunity: "",
  monsterStatusImmunity: "",
  ignoreTaunt: "🎯",
  doubleAttack: "⚡",
  multiAttack: "✖️",
  forcedAttack: "😈",
  guardLock: "🔒",
  freeze: "🧊",
  damageReduction: "🛡",
  tempAtk: "⚡",
  countdown: "⏳",
  // Icône SVG fournie par KeywordIcon (pas d'emoji pour les nouveaux mots-clés)
  hatch: "",
  evolutionJoker: "",
  instantEvolution: "",
  reflect: "",
  releve: "",
} as const;
export type KeywordId = keyof typeof KEYWORD_ICON;
export const KEYWORD_IDS = Object.keys(KEYWORD_ICON) as KeywordId[];

// ── Types ──────────────────────────────────────────────────────────────────

export type EffectTone = "buff" | "debuff" | "neutral";

/** Sous-ensemble de ClientCard nécessaire pour rédiger ses effets. */
export interface EffectSourceCard {
  type: string;
  supportType?: string | null;
  archetype?: string | null;
  effects?: readonly CardEffect[] | null;
  /** Stade Drakon : Jeune et Adulte n'arrivent que par évolution. */
  stage?: string | null;
}

/** Une phrase ; les mots-clés sont entourés de `**`. */
export interface EffectLine {
  text: string;
  tone: EffectTone;
}

export interface EffectRule {
  icon: string;
  trigger: string;
  condition: string | null;
  lines: EffectLine[];
}

export interface CardEffectText {
  rules: EffectRule[];
  keywords: KeywordId[];
}

type CardKind = "monster" | "equipment" | "terrain" | "ephemeral";

// ── Tables (miroir du moteur : effect-actions.applier, buffs-calculator) ──

const TRIGGER_ICON: Record<string, string> = {
  ON_SUMMON: "✨",
  ON_DEATH: "💀",
  ON_ATTACK: "⚔️",
  ON_DEFEND: "🛡",
  ON_PLAY: "🃏",
  ON_TURN_START: "🌅",
  ON_TURN_END: "🌙",
  ON_ALLY_SUMMON: "🤝",
  PASSIVE: "♾️",
  ON_RECYCLE: "♻️",
  ON_BATTLE_PHASE_START: "📯",
};

interface ActionSpec {
  tone: EffectTone;
  /** Qui fait l'action : un monstre ciblé, un joueur, ou la carte elle-même. */
  subject: "monster" | "player" | "card";
  keyword?: KeywordId;
  /** Valeur appliquée par le moteur quand `value` est absent. */
  defaultValue?: number;
  /** Valeur imposée par le moteur, quelle que soit `value`. */
  fixedValue?: number;
  /** La valeur commande un pluriel (cartes, tours, fois). */
  plural?: boolean;
}

const ACTIONS: Record<string, ActionSpec> = {
  DEAL_DAMAGE: { tone: "debuff", subject: "monster", defaultValue: 0 },
  HEAL: { tone: "buff", subject: "monster", defaultValue: 0 },
  BUFF_ATK: { tone: "buff", subject: "monster", defaultValue: 0 },
  BUFF_HP: { tone: "buff", subject: "monster", defaultValue: 0 },
  BUFF_ATK_TEMP: { tone: "buff", subject: "monster", defaultValue: 0 },
  BUFF_HP_PER_ADJACENT_ALLY: {
    tone: "buff",
    subject: "monster",
    defaultValue: 0,
  },
  DRAW: { tone: "neutral", subject: "player", defaultValue: 1, plural: true },
  DISCARD: { tone: "debuff", subject: "player", defaultValue: 1, plural: true },
  DESTROY_MONSTER: { tone: "debuff", subject: "monster" },
  RETURN_TO_HAND: { tone: "neutral", subject: "monster" },
  SET_TAUNT: { tone: "buff", subject: "monster", keyword: "taunt" },
  SET_PIERCING: { tone: "buff", subject: "monster", keyword: "piercing" },
  SET_ATTACKS_PER_TURN: {
    tone: "buff",
    subject: "monster",
    keyword: "multiAttack",
    defaultValue: 1,
    plural: true,
  },
  SET_DEBUFF_IMMUNITY: {
    tone: "buff",
    subject: "monster",
    keyword: "debuffImmunity",
  },
  SET_COMBAT_IMMUNITY: {
    tone: "buff",
    subject: "monster",
    keyword: "combatImmunity",
  },
  SET_SUPPORT_DESTROY_IMMUNITY: {
    tone: "buff",
    subject: "monster",
    keyword: "supportShield",
  },
  SET_COMBAT_DESTRUCTION_IMMUNITY: {
    tone: "buff",
    subject: "monster",
    keyword: "combatEndure",
  },
  SET_SUPPORT_DEBUFF_IMMUNITY: {
    tone: "buff",
    subject: "monster",
    keyword: "supportDebuffImmunity",
  },
  SET_MONSTER_DEBUFF_IMMUNITY: {
    tone: "buff",
    subject: "monster",
    keyword: "monsterDebuffImmunity",
  },
  SET_MONSTER_STATUS_IMMUNITY: {
    tone: "buff",
    subject: "monster",
    keyword: "monsterStatusImmunity",
  },
  IGNORE_TAUNT: { tone: "buff", subject: "monster", keyword: "ignoreTaunt" },
  SET_DELAY_DOUBLE_ATK: {
    tone: "buff",
    subject: "monster",
    keyword: "doubleAttack",
  },
  SET_DAMAGE_REDUCTION: {
    tone: "buff",
    subject: "monster",
    keyword: "damageReduction",
    defaultValue: 2,
  },
  FORCE_ATTACK_MODE: {
    tone: "debuff",
    subject: "monster",
    keyword: "forcedAttack",
  },
  FORCE_ATTACK_MODE_ENEMY: {
    tone: "debuff",
    subject: "monster",
    keyword: "forcedAttack",
  },
  FORCE_GUARD_LOCK_ENEMY: {
    tone: "debuff",
    subject: "monster",
    keyword: "guardLock",
  },
  BLOCK_ATTACK: {
    tone: "debuff",
    subject: "monster",
    keyword: "freeze",
    defaultValue: 1,
    plural: true,
  },
  SET_HATCH_COUNTER: {
    tone: "neutral",
    subject: "monster",
    keyword: "hatch",
    defaultValue: 2,
    plural: true,
  },
  ADVANCE_HATCH: {
    tone: "buff",
    subject: "monster",
    defaultValue: 1,
    plural: true,
  },
  SUMMON_FROM_DECK: { tone: "buff", subject: "player", fixedValue: 1 },
  EVOLUTION_JOKER: {
    tone: "buff",
    subject: "monster",
    keyword: "evolutionJoker",
  },
  INSTANT_EVOLUTION: {
    tone: "buff",
    subject: "monster",
    keyword: "instantEvolution",
  },
  ALLOW_EVOLUTION_THIS_TURN: { tone: "buff", subject: "monster" },
  SET_TURN_COUNTER: {
    tone: "neutral",
    subject: "monster",
    keyword: "countdown",
    defaultValue: 3,
    plural: true,
  },
  CANNOT_ATTACK_ON_SUMMON_TURN: { tone: "debuff", subject: "monster" },
  RETURN_FROM_GRAVEYARD: {
    tone: "neutral",
    subject: "player",
    defaultValue: 1,
    plural: true,
  },
  RETURN_FROM_GRAVEYARD_OR_DECK: {
    tone: "neutral",
    subject: "player",
    fixedValue: 1,
  },
  SEARCH_DECK: { tone: "neutral", subject: "player", fixedValue: 1 },
  GAIN_RECYCLE_ENERGY: {
    tone: "buff",
    subject: "player",
    defaultValue: 0,
    plural: true,
  },
  DUPLICATE_MONSTER: {
    tone: "buff",
    subject: "monster",
    defaultValue: 2,
    plural: true,
  },
  // Le virus pèse sur les monstres de l'hôte : la cible (SELF) n'est pas citée.
  VIRUS_ATK_DEBUFF: { tone: "debuff", subject: "card", defaultValue: 0 },
  RESET_TURN_COUNTER: { tone: "buff", subject: "player", defaultValue: 3 },
  SET_DISINFECT_IMMUNITY: { tone: "buff", subject: "monster" },
  SET_FREE_SUMMON: { tone: "buff", subject: "card" },
  SUMMONABLE_ON_ENEMY_SIDE: { tone: "neutral", subject: "card" },
  REFLECT_DAMAGE: {
    tone: "buff",
    subject: "monster",
    keyword: "reflect",
    defaultValue: 0,
  },
  RELEVE: { tone: "neutral", subject: "card", keyword: "releve", defaultValue: 2 },
  SUMMON_IF_ALL_ELEMENTS: { tone: "neutral", subject: "card" },
  COPY_GRAVEYARD_EFFECTS: { tone: "buff", subject: "player" },
};

/** Cibles qui désignent plusieurs monstres (accord du verbe). */
const MANY_TARGETS = new Set<string>([
  EffectTarget.ALL_ALLIES,
  EffectTarget.ALL_ENEMIES,
  EffectTarget.ALLIES_EXCEPT_SELF,
  EffectTarget.ARCHETYPE_ALLIES,
  EffectTarget.ADJACENT_ALLIES,
]);

const KNOWN_TRIGGERS = new Set<string>(Object.values(EffectTrigger));
const KNOWN_TARGETS = new Set<string>(Object.values(EffectTarget));

// ── Rédaction ──────────────────────────────────────────────────────────────

function cardKind(card: EffectSourceCard): CardKind {
  if (card.type.toLowerCase() !== "support") return "monster";
  if (card.supportType === "EQUIPMENT") return "equipment";
  if (card.supportType === "TERRAIN") return "terrain";
  return "ephemeral";
}

/** Minuscule à la première lettre (condition insérée dans une parenthèse). */
function lowerFirst(s: string): string {
  return s.replace(/^\p{L}/u, (letter) => letter.toLowerCase());
}

/** Majuscule à la première lettre, même derrière un marqueur `**`. */
function capitalize(s: string): string {
  return s.replace(
    /^(\*\*)?(\p{L})/u,
    (_m, stars = "", letter: string) => `${stars}${letter.toUpperCase()}`,
  );
}

function archetypeLabel(t: TFunction, archetype: string): string {
  return t(`effects.archetype.${archetype.toLowerCase()}`, {
    defaultValue: archetype,
  });
}

function describeFilter(t: TFunction, filter?: EffectFilter): string {
  if (!filter) return "";
  const parts: string[] = [];
  if (filter.archetype) parts.push(archetypeLabel(t, filter.archetype));
  if (filter.type) parts.push(t(`filter.${filter.type}`));
  if (filter.rarities?.length)
    parts.push(filter.rarities.map((r) => t(`rarity.${r}`)).join(" / "));
  if (filter.stage) parts.push(t(`effects.stage.${filter.stage}`));
  if (filter.element) parts.push(t(`effects.element.${filter.element}`));
  if (filter.name) parts.push(t("effects.filter.name", { name: filter.name }));
  return parts.length ? ` (${parts.join(" · ")})` : "";
}

function drakonDetail(t: TFunction, c: EffectCondition): string {
  return [
    c.stage ? t(`effects.stage.${c.stage}`) : "",
    c.element ? t(`effects.element.${c.element}`) : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

function describeCondition(
  t: TFunction,
  condition: EffectCondition | null | undefined,
): string | null {
  if (!condition) return null;
  if (condition.type === "EQUIPPED_ON" && condition.value === undefined)
    return t("effects.condition.EQUIPPED_ON_drakon", {
      detail: drakonDetail(t, condition),
    });
  const name = String(condition.value ?? "");
  const context = condition.match === "contains" ? "contains" : undefined;
  switch (condition.type) {
    case "ARCHETYPE_ON_BOARD":
      return t("effects.condition.ARCHETYPE_ON_BOARD", {
        archetype: archetypeLabel(t, name),
      });
    case "HP_BELOW":
      return t("effects.condition.HP_BELOW", {
        value: Number(condition.value),
      });
    case "HAND_SIZE_MIN":
      return t("effects.condition.HAND_SIZE_MIN", {
        count: Number(condition.value),
      });
    case "OPPONENT_HAS_NO_MONSTERS":
      return t("effects.condition.OPPONENT_HAS_NO_MONSTERS");
    case "DRAKON_ON_BOARD":
      return t("effects.condition.DRAKON_ON_BOARD", {
        detail: drakonDetail(t, condition),
      });
    case "SPECIFIC_CARD_ON_BOARD":
    case "EQUIPPED_ON":
      return t(`effects.condition.${condition.type}`, { name, context });
    default:
      return t("effects.condition.unknown", { type: String(condition.type) });
  }
}

function describeTarget(
  t: TFunction,
  target: string,
  kind: CardKind,
  trigger: string,
  action: EffectAction,
  card: EffectSourceCard,
): string {
  if (!KNOWN_TARGETS.has(target))
    return t("effects.target.unknown", { type: target });

  let context: string | undefined;
  if (target === EffectTarget.SELF && kind === "equipment")
    context = "equipment";
  if (target === EffectTarget.ENEMY_MONSTER && trigger === "ON_DEFEND")
    context = "defend";
  // Passif d'un monstre : le moteur exclut la source de ses alliés d'archétype.
  if (
    target === EffectTarget.ARCHETYPE_ALLIES &&
    kind === "monster" &&
    trigger === "PASSIVE"
  )
    context = "others";

  const archetype = action.archetype ?? card.archetype ?? "";
  return t(`effects.target.${target}`, {
    context,
    archetype: archetype ? archetypeLabel(t, archetype) : "",
  }).trim();
}

function describeAction(
  t: TFunction,
  action: EffectAction,
  kind: CardKind,
  trigger: string,
  card: EffectSourceCard,
): { line: EffectLine; keyword?: KeywordId } {
  const spec = ACTIONS[action.type];
  if (!spec)
    return {
      line: {
        text: t("effects.action.unknown", { type: String(action.type) }),
        tone: "neutral",
      },
    };

  const value = spec.fixedValue ?? action.value ?? spec.defaultValue ?? 0;
  const target = String(action.target);
  let context: string | undefined;
  if (spec.subject === "monster" && MANY_TARGETS.has(target)) context = "many";
  if (spec.subject === "player" && target === EffectTarget.PLAYER)
    context = "you";

  const text = t(`effects.action.${action.type}`, {
    context,
    target:
      spec.subject === "card"
        ? ""
        : describeTarget(t, target, kind, trigger, action, card),
    value,
    signed: `${value >= 0 ? "+" : ""}${value}`,
    kw: spec.keyword ? t(`keywords.${spec.keyword}.name`) : "",
    filter: describeFilter(t, action.filter),
    ...(spec.plural ? { count: value } : {}),
  });

  const conditional = action.valueIf
    ? t("effects.valueIf", {
        value: action.valueIf.value,
        condition: lowerFirst(
          describeCondition(t, action.valueIf.condition) ?? "",
        ),
      })
    : "";
  const stripped = text.replace(/[.。]$/, "");
  const fullText = conditional
    ? `${stripped} ${conditional}${stripped === text ? "" : "."}`
    : text;

  const negative = value < 0 && action.type.startsWith("BUFF");
  return {
    line: {
      text: capitalize(fullText),
      tone: negative ? "debuff" : spec.tone,
    },
    keyword: spec.keyword,
  };
}

/** Retranscrit les effets d'une carte (format du moteur) en texte de règle. */
export function describeCardEffects(
  card: EffectSourceCard,
  t: TFunction,
): CardEffectText {
  const kind = cardKind(card);
  const keywords: KeywordId[] = [];
  const rules: EffectRule[] = [];

  // Règle de pose (miroir de canSummonFromHand) : pas un effet, mais à connaître
  if (
    card.stage === "young" ||
    card.stage === "adult" ||
    card.stage === "ancestral"
  )
    rules.push({
      icon: "",
      trigger: t("effects.ui.summonRule"),
      condition: null,
      lines: [
        {
          text: t(
            card.stage === "ancestral"
              ? "effects.ui.evolutionOnlyAncestral"
              : "effects.ui.evolutionOnly",
          ),
          tone: "neutral",
        },
      ],
    });

  for (const effect of card.effects ?? []) {
    const trigger = String(effect.trigger);
    const lines: EffectLine[] = [];
    for (const action of effect.actions ?? []) {
      const { line, keyword } = describeAction(t, action, kind, trigger, card);
      lines.push(line);
      if (keyword && !keywords.includes(keyword)) keywords.push(keyword);
    }
    if (lines.length === 0) continue;

    rules.push({
      icon: TRIGGER_ICON[trigger] ?? "✦",
      trigger: KNOWN_TRIGGERS.has(trigger)
        ? t(`effects.trigger.${trigger}`, { context: kind })
        : t("effects.trigger.unknown", { type: trigger }),
      condition: describeCondition(t, effect.condition),
      lines,
    });
  }

  return { rules, keywords };
}

/** Texte brut (sans marqueurs de mots-clés), pour un `title` ou un aria-label. */
export function effectPlainText(text: string): string {
  return text.replace(/\*\*/g, "");
}
