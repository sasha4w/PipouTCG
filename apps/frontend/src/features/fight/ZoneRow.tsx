import { useState, useEffect, useRef } from "react";
import "./ZoneRow.css";
import "./BuffDebuffList.css";
import { QUENOUILLE_CARD_ID, RARITY_COLOR } from "./fight.types";
import BuffDebuffList, { type BuffEntry } from "./BuffDebuffList";
import {
  TRIGGER_LABEL,
  TARGET_SUFFIX,
  ACTION_META,
  type RawEffect,
} from "./fight.effects";

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
  /** Highlight filled zones (monsters) — used when an EQUIPMENT card is selected */
  highlightFilled?: boolean;
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

// RawAction/RawEffect importés depuis fight.effects-utils

// ── Helper : lit les effets d'une carte support posée ────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSupportBuffEntries(zone: any): BuffEntry[] {
  if (!zone) return [];
  const entries: BuffEntry[] = [];

  const supportType: string | undefined = zone.baseCard?.supportType;
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
  if (supportType === "EQUIPMENT")
    entries.push({ icon: "🔧", label: "Équipement", type: "neutral" });

  const rawEffects: RawEffect[] = Array.isArray(zone.baseCard?.effects)
    ? zone.baseCard.effects
    : [];

  for (const eff of rawEffects) {
    // Condition polymorphe
    const condition = (eff as any).condition;
    let conditionLabel: string | null = null;
    if (condition?.type === "SPECIFIC_CARD_ON_BOARD") {
      conditionLabel = `Si ${condition.value} est sur le terrain`;
    }

    const trigger = eff.trigger
      ? (TRIGGER_LABEL[eff.trigger] ?? eff.trigger)
      : null;
    for (const action of eff.actions ?? []) {
      const meta = action.type ? ACTION_META[action.type] : undefined;
      if (!meta) continue;
      const targetSuffix = action.target
        ? (TARGET_SUFFIX[action.target] ?? action.target)
        : null;
      const parts = [
        conditionLabel ?? trigger,
        meta.label(action.value),
        targetSuffix,
      ].filter(Boolean);
      entries.push({
        icon: meta.icon,
        label: parts.join(" · "),
        type: meta.type,
      });
    }
  }

  const desc = zone.baseCard?.description;
  if (desc && typeof desc === "string")
    entries.push({ icon: "📖", label: desc, type: "neutral" });

  return entries;
}

// ── Helper : effets d'un équipement (CardInstance) ────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getEquipmentEntries(eq: any): BuffEntry[] {
  const entries: BuffEntry[] = [];
  const rawEffects: RawEffect[] = Array.isArray(eq.baseCard?.effects)
    ? eq.baseCard.effects
    : [];

  for (const eff of rawEffects) {
    // Condition polymorphe
    const condition = (eff as any).condition;
    let conditionLabel: string | null = null;
    if (condition?.type === "SPECIFIC_CARD_ON_BOARD") {
      conditionLabel = `Si ${condition.value} présent`;
    }

    const trigger = eff.trigger
      ? (TRIGGER_LABEL[eff.trigger] ?? eff.trigger)
      : null;
    for (const action of eff.actions ?? []) {
      const meta = action.type ? ACTION_META[action.type] : undefined;
      if (!meta) continue;
      const targetSuffix = action.target
        ? (TARGET_SUFFIX[action.target] ?? action.target)
        : null;
      const parts = [
        conditionLabel ?? trigger,
        meta.label(action.value),
        targetSuffix,
      ].filter(Boolean);
      entries.push({
        icon: meta.icon,
        label: parts.join(" · "),
        type: meta.type,
      });
    }
  }

  const desc = eq.baseCard?.description;
  if (desc) entries.push({ icon: "📖", label: desc, type: "neutral" });
  return entries;
}

/** Calcule la décomposition ATK/HP pour le récap stats */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildStatRecap(zone: any): { atkLine: string; hpLine: string } | null {
  if (!zone) return null;
  const baseAtk: number = zone.card?.baseCard?.atk ?? 0;
  const baseHp: number = zone.card?.baseCard?.hp ?? 0;
  const atkBuff: number = zone.atkBuff ?? 0;
  const hpBuff: number = zone.hpBuff ?? 0;
  const tempAtk: number = zone.tempAtkBuff ?? 0;
  const totalAtk = baseAtk + atkBuff + tempAtk;
  const totalHp = baseHp + hpBuff;

  // Construire les parties ATK
  const atkParts: string[] = [`${baseAtk} base`];
  if (atkBuff !== 0) atkParts.push(`${atkBuff > 0 ? "+" : ""}${atkBuff} buff`);
  if (tempAtk !== 0) atkParts.push(`+${tempAtk} temp`);
  const atkLine =
    atkParts.length > 1
      ? `${atkParts.join(" ")} = ${totalAtk} ⚔`
      : `${totalAtk} ⚔`;

  const hpParts: string[] = [`${baseHp} base`];
  if (hpBuff !== 0) hpParts.push(`${hpBuff > 0 ? "+" : ""}${hpBuff} buff`);
  const hpLine =
    hpParts.length > 1
      ? `${hpParts.join(" ")} = ${totalHp} ❤  (actuel : ${zone.currentHp})`
      : `${zone.currentHp}/${totalHp} ❤`;

  return { atkLine, hpLine };
}

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

  // ── Récap stats calculé (toujours en tête) ───────────────────────────────
  const recap = buildStatRecap(zone);
  if (recap) {
    entries.push({
      icon: "⚔️",
      label: recap.atkLine,
      type: "neutral",
      variant: "recap",
    });
    entries.push({
      icon: "❤️",
      label: recap.hpLine,
      type: "neutral",
      variant: "recap",
    });
  }

  // ── Séparateur visuel ─────────────────────────────────────────────────────
  if (
    rawEffects.length > 0 ||
    (Array.isArray(zone.equipments) && zone.equipments.length > 0)
  ) {
    entries.push({
      icon: "─",
      label: "Effets de la carte",
      type: "neutral",
      variant: "separator",
    });
  }

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
  if (zone.atkBuff && zone.atkBuff !== 0 && !effectActionTypes.has("BUFF_ATK"))
    entries.push({
      icon: "⚔️",
      label: `${zone.atkBuff > 0 ? "+" : ""}${zone.atkBuff} ATK (buff actif)`,
      type: zone.atkBuff > 0 ? "buff" : "debuff",
    });
  if (zone.hpBuff && zone.hpBuff !== 0 && !effectActionTypes.has("BUFF_HP"))
    entries.push({
      icon: "❤️",
      label: `${zone.hpBuff > 0 ? "+" : ""}${zone.hpBuff} HP max (buff actif)`,
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

  // ── Équipements : nom + leurs effets détaillés ────────────────────────────
  if (Array.isArray(zone.equipments) && zone.equipments.length > 0) {
    for (const eq of zone.equipments) {
      entries.push({
        icon: "🔧",
        label: eq.baseCard?.name ?? "Équipement",
        type: "neutral",
        variant: "separator",
      });
      const eqEntries = getEquipmentEntries(eq);
      if (eqEntries.length === 0)
        entries.push({
          icon: "  ",
          label: "Aucun effet listé",
          type: "neutral",
        });
      else entries.push(...eqEntries);
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
  highlightFilled = false,
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

          // Badge buff/info : visible sur toutes les zones occupées (monstre ET support)
          const showBuffBadge = !!zone;
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
                highlightFilled && !!zone ? "zr-zone--pulse-equipment" : "",
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
                      {zone.blockAttackTurns !== undefined &&
                        zone.blockAttackTurns > 0 && (
                          <span
                            className="zr-badge zr-badge--sleep"
                            title={`Ne peut pas attaquer encore ${zone.blockAttackTurns} tour(s)`}
                          >
                            🧊{zone.blockAttackTurns}
                          </span>
                        )}
                      {zone.guardLocked && (
                        <span
                          className="zr-badge zr-badge--taunt"
                          title="Verrouillé en mode Garde jusqu'à être attaqué"
                        >
                          🔒
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

                    {/* ── Équipements — chips subtils ───────────────────── */}
                    {Array.isArray(zone.equipments) &&
                      zone.equipments.length > 0 && (
                        <div className="zr-equipment-list">
                          {(zone.equipments as any[]).map((eq, eIdx) => {
                            const eqEffects = getEquipmentEntries(eq);
                            const effectSummary = eqEffects
                              .map((e) => e.label)
                              .join(" | ");
                            // Nom court : max 10 chars
                            const shortName =
                              (eq.baseCard?.name ?? "?").length > 10
                                ? (eq.baseCard?.name ?? "?").slice(0, 9) + "…"
                                : (eq.baseCard?.name ?? "?");
                            return (
                              <span
                                key={eIdx}
                                className="zr-equipment-chip"
                                title={`${eq.baseCard?.name ?? "?"}\n${effectSummary}`}
                              >
                                🔧 {shortName}
                              </span>
                            );
                          })}
                        </div>
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
      {openBuffIdx !== null && anchorRect && zones[openBuffIdx] && (
        <BuffDebuffList
          entries={
            isSupport
              ? getSupportBuffEntries(zones[openBuffIdx])
              : getMonsterBuffEntries(zones[openBuffIdx])
          }
          cardName={
            isSupport
              ? (zones[openBuffIdx]?.baseCard?.name ?? "")
              : (zones[openBuffIdx]?.card?.baseCard?.name ?? "")
          }
          supportType={
            isSupport ? zones[openBuffIdx]?.baseCard?.supportType : undefined
          }
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
