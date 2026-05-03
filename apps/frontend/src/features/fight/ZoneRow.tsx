import { useState, useEffect, useRef } from "react";
import "./ZoneRow.css";
import "./BuffDebuffList.css";
import { QUENOUILLE_CARD_ID, RARITY_COLOR } from "./fight.types";
import BuffDebuffList, { type BuffEntry } from "./Buffdebufflist";

interface Props {
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  zones: (any | null)[];
  isSupport?: boolean;
  isOpponent?: boolean;
  dim?: boolean;
  onZoneClick?: (idx: number) => void;
  onMonsterClick?: (instanceId: string) => void;
  onModeChange?: (instanceId: string, mode: "attack" | "guard") => void;
  highlightEmpty?: boolean;
  /** Highlight empty opponent zones (for Noyau Zeta placement) */
  highlightOpponentEmpty?: boolean;
  onSupportRecycle?: (idx: number) => void;
  selectedZone?: number | null;
  recycleEnergy?: number;
  attackingZone?: number | null;
  damagedZones?: Set<number>;
}

function isBlockedFromAttacking(zone: any): boolean {
  if (!zone) return false;
  if (zone.summonedThisTurn && zone.card?.baseCard?.id === QUENOUILLE_CARD_ID)
    return true;
  return false;
}

function getRarityBorderColor(
  zone: any,
  isSupport: boolean,
): string | undefined {
  if (!zone) return undefined;
  const rarity = isSupport
    ? zone.baseCard?.rarity
    : zone.card?.baseCard?.rarity;
  return rarity ? RARITY_COLOR[rarity] : undefined;
}

// ── Helper : extrait les effets affichables d'une carte support ───────────
// ── Tables de traduction (miroir des enums backend, sans import) ──────────

const TRIGGER_LABEL: Record<string, string> = {
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

const TARGET_SUFFIX: Record<string, string> = {
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
const ACTION_META: Record<string, ActionMeta> = {
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
};

interface RawAction {
  type?: string;
  target?: string;
  value?: number;
}
interface RawEffect {
  trigger?: string;
  actions?: RawAction[];
}

// ── Helper : lit les buffs/debuffs d'un MonsterOnBoard ───────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getMonsterBuffEntries(zone: any): BuffEntry[] {
  if (!zone) return [];
  const entries: BuffEntry[] = [];

  // ── Effets de la carte de base (CardEffect[]) — d'abord pour déduplication ─
  const rawEffects: RawEffect[] = Array.isArray(zone.card?.baseCard?.effects)
    ? zone.card.baseCard.effects
    : [];

  const effectActionTypes = new Set(
    rawEffects.flatMap((e) => e.actions ?? []).map((a) => a.type),
  );

  for (const eff of rawEffects) {
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

  // ── Buffs de stats actifs (seulement si pas déjà couvert par CardEffect[]) ─
  if (zone.atkBuff && zone.atkBuff !== 0)
    entries.push({
      icon: "⚔️",
      label: `${zone.atkBuff > 0 ? "+" : ""}${zone.atkBuff} ATK`,
      type: zone.atkBuff > 0 ? "buff" : "debuff",
    });
  if (zone.hpBuff && zone.hpBuff !== 0)
    entries.push({
      icon: "❤️",
      label: `${zone.hpBuff > 0 ? "+" : ""}${zone.hpBuff} HP max`,
      type: zone.hpBuff > 0 ? "buff" : "debuff",
    });
  if (zone.tempAtkBuff && zone.tempAtkBuff !== 0)
    entries.push({
      icon: "⚡",
      label: `+${zone.tempAtkBuff} ATK (ce tour)`,
      type: "buff",
    });
  if (
    zone.damageReduction &&
    zone.damageReduction > 1 &&
    !effectActionTypes.has("SET_DAMAGE_REDUCTION")
  )
    entries.push({
      icon: "🛡",
      label: `Réduction dégâts ×${zone.damageReduction}`,
      type: "buff",
    });

  // ── Traits actifs (seulement si pas déjà couverts par CardEffect[]) ───────
  if (!effectActionTypes.has("SET_TAUNT") && zone.hasTaunt)
    entries.push({ icon: "🛡", label: "Provocation", type: "buff" });
  if (!effectActionTypes.has("SET_PIERCING") && zone.hasPiercing)
    entries.push({ icon: "🗡", label: "Perçant", type: "buff" });
  if (!effectActionTypes.has("SET_DEBUFF_IMMUNITY") && zone.isImmuneToDebuffs)
    entries.push({ icon: "✨", label: "Immunité débuffs", type: "buff" });
  if (!effectActionTypes.has("SET_DELAY_DOUBLE_ATK") && zone.doubleAtkNextTurn)
    entries.push({
      icon: "⚡",
      label: "Double attaque (prochain tour)",
      type: "buff",
    });
  if (!effectActionTypes.has("SET_ATTACKS_PER_TURN") && zone.attacksPerTurn > 1)
    entries.push({
      icon: "✖️",
      label: `Attaques ×${zone.attacksPerTurn}`,
      type: "buff",
    });
  if (!effectActionTypes.has("FORCE_ATTACK_MODE") && zone.forcedAttackMode)
    entries.push({ icon: "😈", label: "Mode Attaque forcé", type: "debuff" });

  // ── Équipements attachés ──────────────────────────────────────────────────
  if (Array.isArray(zone.equipments) && zone.equipments.length > 0) {
    for (const eq of zone.equipments as { baseCard?: { name?: string } }[]) {
      entries.push({
        icon: "🔧",
        label: `Équipé : ${eq.baseCard?.name ?? "?"}`,
        type: "neutral",
      });
    }
  }

  // ── Description texte libre ───────────────────────────────────────────────
  const desc = zone.card?.baseCard?.description;
  if (desc && typeof desc === "string")
    entries.push({ icon: "📖", label: desc, type: "neutral" });

  return entries;
}

export default function ZoneRow({
  label,
  zones,
  isSupport = false,
  isOpponent = false,
  dim = false,
  highlightEmpty = false,
  highlightOpponentEmpty = false,
  onZoneClick,
  onMonsterClick,
  onModeChange,
  selectedZone,
  recycleEnergy,
  attackingZone,
  damagedZones,
}: Props) {
  // ── Summon detection ──────────────────────────────────────────────────────
  const prevZonesRef = useRef<(unknown | null)[]>(zones.map(() => null));
  const [summoningZones, setSummoningZones] = useState<Set<number>>(new Set());

  // ── Mode change detection ─────────────────────────────────────────────────
  const prevModesRef = useRef<(string | undefined)[]>(
    zones.map((z) => z?.mode as string | undefined),
  );
  const [flippingZones, setFlippingZones] = useState<Set<number>>(new Set());

  // ── Destruction detection ─────────────────────────────────────────────────
  const [dyingZones, setDyingZones] = useState<Map<number, any>>(new Map());

  // ── Buff tooltip ──────────────────────────────────────────────────────────
  const [openBuffIdx, setOpenBuffIdx] = useState<number | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  const handleBadgeClick = (
    e: React.MouseEvent<HTMLButtonElement>,
    idx: number,
  ) => {
    e.stopPropagation();
    if (openBuffIdx === idx) {
      setOpenBuffIdx(null);
      setAnchorRect(null);
    } else {
      setOpenBuffIdx(idx);
      setAnchorRect(e.currentTarget.getBoundingClientRect());
    }
  };

  useEffect(() => {
    const prevZones = prevZonesRef.current;
    const prevModes = prevModesRef.current;

    const newSummoning = new Set<number>();
    const newFlipping = new Set<number>();

    zones.forEach((zone, idx) => {
      if (!prevZones[idx] && zone) newSummoning.add(idx);

      if (prevZones[idx] && !zone) {
        const snapshot = prevZones[idx];
        setDyingZones((prev) => new Map([...prev, [idx, snapshot]]));
        // Fermer le tooltip si la zone meurt
        setOpenBuffIdx((cur) => (cur === idx ? null : cur));
        setTimeout(() => {
          setDyingZones((prev) => {
            const next = new Map(prev);
            next.delete(idx);
            return next;
          });
        }, 900);
      }

      if (!isSupport && prevZones[idx] && zone) {
        const prevMode = prevModes[idx];
        const curMode = zone.mode as string | undefined;
        if (prevMode && curMode && prevMode !== curMode) newFlipping.add(idx);
      }
    });

    if (newSummoning.size > 0) {
      setSummoningZones(newSummoning);
      setTimeout(() => setSummoningZones(new Set()), 500);
    }

    if (newFlipping.size > 0) {
      setFlippingZones(newFlipping);
      setTimeout(() => setFlippingZones(new Set()), 450);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zones]);

  useEffect(() => {
    prevZonesRef.current = [...zones];
    prevModesRef.current = zones.map((z) => z?.mode as string | undefined);
  });

  return (
    <div className="zr-wrap">
      <div className="zr-label">
        {label}{" "}
        {recycleEnergy !== undefined && recycleEnergy > 0 && (
          <span className="zr-energy">⚡×{recycleEnergy}</span>
        )}
      </div>
      <div className="zr-row">
        {zones.map((zone, idx) => {
          const isAttacking = attackingZone === idx;
          const isDamaged = damagedZones?.has(idx) ?? false;
          const isSummoning = summoningZones.has(idx);
          const isFlipping = flippingZones.has(idx);
          const blocked = !isSupport && isBlockedFromAttacking(zone);

          const dyingData = dyingZones.get(idx);
          const effectiveZone = zone ?? null;
          const isShattering = !zone && !!dyingData;

          const rarityColor =
            getRarityBorderColor(effectiveZone, isSupport) ??
            getRarityBorderColor(dyingData, isSupport);

          const isZetaTarget = highlightOpponentEmpty && !zone && !isShattering;

          // Badge buff : visible sur toutes les zones monstre occupées
          const showBuffBadge = !isSupport && !!zone;
          const isBuffOpen = openBuffIdx === idx;

          return (
            <div
              key={idx}
              className={[
                "zr-zone",
                dim ? "zr-zone--dim" : "",
                zone
                  ? "zr-zone--filled"
                  : isShattering
                    ? "zr-zone--shattering"
                    : "zr-zone--empty",
                selectedZone === idx ? "zr-zone--selected" : "",
                onZoneClick || (zone && onMonsterClick)
                  ? "zr-zone--clickable"
                  : "",
                highlightEmpty && !zone && !isShattering
                  ? "zr-zone--pulse-target"
                  : "",
                isZetaTarget
                  ? "zr-zone--pulse-target zr-zone--zeta-target"
                  : "",
                isSummoning ? "zr-zone--summon-in" : "",
                isFlipping ? "zr-zone--mode-flip" : "",
                isAttacking ? "zr-zone--attacking" : "",
                isDamaged ? "zr-zone--damaged" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={rarityColor ? { borderColor: rarityColor } : undefined}
              onClick={() => {
                if (zone && onMonsterClick && zone.instanceId)
                  onMonsterClick(zone.instanceId);
                else if (onZoneClick) onZoneClick(idx);
              }}
            >
              {/* ── Badge buff/debuff sur cartes support ────────────────── */}
              {showBuffBadge && (
                <button
                  className={`bdl-trigger${isBuffOpen ? " bdl-trigger--active" : ""}`}
                  onClick={(e) => handleBadgeClick(e, idx)}
                  title="Voir les effets"
                >
                  i
                </button>
              )}

              {zone ? (
                isSupport ? (
                  <div className="zr-support">
                    <div className="zr-support-name">{zone.baseCard.name}</div>
                    <div className="zr-support-type">
                      {zone.baseCard.supportType ?? ""}
                    </div>
                  </div>
                ) : (
                  <div className="zr-monster">
                    <div className="zr-monster-badges">
                      {zone.hasTaunt && (
                        <span
                          className="zr-badge zr-badge--taunt"
                          title="Provocation"
                        >
                          🛡
                        </span>
                      )}
                      {zone.hasPiercing && (
                        <span
                          className="zr-badge zr-badge--piercing"
                          title="Perçant"
                        >
                          🗡
                        </span>
                      )}
                      {zone.isImmuneToDebuffs && (
                        <span
                          className="zr-badge zr-badge--immune"
                          title="Immunité débuffs"
                        >
                          ✨
                        </span>
                      )}
                      {blocked && (
                        <span
                          className="zr-badge zr-badge--sleep"
                          title="Ne peut pas attaquer ce tour"
                        >
                          💤
                        </span>
                      )}
                      {zone.doubleAtkNextTurn && (
                        <span
                          className="zr-badge zr-badge--charge"
                          title="Double attaque au prochain tour"
                        >
                          ⚡
                        </span>
                      )}
                      {zone.attacksPerTurn > 1 && !blocked && (
                        <span
                          className="zr-badge zr-badge--multi"
                          title="Double attaque"
                        >
                          ×{zone.attacksPerTurn - zone.attacksUsedThisTurn}
                        </span>
                      )}
                      {zone.turnCounter !== undefined && (
                        <span
                          className={[
                            "zr-badge zr-badge--counter",
                            zone.turnCounter <= 1
                              ? "zr-badge--counter-urgent"
                              : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          title={`S'autodétruit dans ${zone.turnCounter} tour(s)`}
                        >
                          ⏳{zone.turnCounter}
                        </span>
                      )}
                    </div>

                    <div className={`zr-mode-chip zr-mode-chip--${zone.mode}`}>
                      {zone.mode === "attack" ? "⚔️" : "🛡️"}
                    </div>

                    <div className="zr-monster-name">
                      {zone.card.baseCard.name}
                    </div>

                    <div className="zr-monster-stats">
                      {zone.card.baseCard.atk +
                        zone.atkBuff +
                        (zone.tempAtkBuff ?? 0)}
                      ⚔ {zone.currentHp}/{zone.card.baseCard.hp + zone.hpBuff}❤
                    </div>

                    {zone.hasAttackedThisTurn &&
                      zone.attacksUsedThisTurn >= zone.attacksPerTurn && (
                        <div className="zr-attacked">attaqué</div>
                      )}

                    {!isOpponent && onModeChange && !zone.forcedAttackMode && (
                      <div className="zr-mode-btns">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onModeChange(zone.instanceId, "attack");
                          }}
                          className={`zr-mode-btn${zone.mode === "attack" ? " zr-mode-btn--active" : ""}`}
                        >
                          ⚔️
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onModeChange(zone.instanceId, "guard");
                          }}
                          className={`zr-mode-btn${zone.mode === "guard" ? " zr-mode-btn--active" : ""}`}
                        >
                          🛡️
                        </button>
                      </div>
                    )}
                  </div>
                )
              ) : isShattering && dyingData ? (
                isSupport ? (
                  <div className="zr-support zr-dying-content">
                    <div className="zr-support-name">
                      {dyingData.baseCard?.name}
                    </div>
                    <div className="zr-support-type">
                      {dyingData.baseCard?.supportType ?? ""}
                    </div>
                  </div>
                ) : (
                  <div className="zr-monster zr-dying-content">
                    <div
                      className={`zr-mode-chip zr-mode-chip--${dyingData.mode}`}
                    >
                      {dyingData.mode === "attack" ? "⚔️" : "🛡️"}
                    </div>
                    <div className="zr-monster-name">
                      {dyingData.card?.baseCard?.name}
                    </div>
                    <div className="zr-monster-stats">
                      {dyingData.card?.baseCard?.atk}⚔ 0/
                      {dyingData.card?.baseCard?.hp}❤
                    </div>
                  </div>
                )
              ) : isZetaTarget ? (
                <span className="zr-zeta-hint">🦠 Poser Zeta</span>
              ) : (
                <span className="zr-empty-plus">+</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Tooltip rendu hors du flux pour éviter overflow:hidden ────────── */}
      {!isSupport &&
        openBuffIdx !== null &&
        anchorRect &&
        zones[openBuffIdx] && (
          <BuffDebuffList
            entries={getMonsterBuffEntries(zones[openBuffIdx])}
            cardName={zones[openBuffIdx]?.card?.baseCard?.name ?? ""}
            supportType={undefined}
            anchorRect={anchorRect}
            onClose={() => {
              setOpenBuffIdx(null);
              setAnchorRect(null);
            }}
          />
        )}
    </div>
  );
}
