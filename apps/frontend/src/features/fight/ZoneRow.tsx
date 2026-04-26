import { useState, useEffect, useRef } from "react";
import "./ZoneRow.css";
import { QUENOUILLE_CARD_ID } from "./fight.types";

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
  onSupportRecycle?: (idx: number) => void;
  selectedZone?: number | null;
  recycleEnergy?: number;
  /** Index of my attacking zone (lunge animation) */
  attackingZone?: number | null;
  /** Set of zone indices that took damage this tick */
  damagedZones?: Set<number>;
}

/**
 * Returns true if this monster CANNOT attack this turn.
 *
 * Two cases:
 *  1. Commandant Quenouille (id=9): blocked the turn it's summoned.
 *  2. Any other monster: summonedThisTurn has NO bearing — standard monsters
 *     CAN attack the turn they are summoned. The flag is only kept for
 *     Quenouille's special rule and for the doubleAtkNextTurn mechanic.
 */
function isBlockedFromAttacking(zone: any): boolean {
  if (!zone) return false;
  // Quenouille specifically cannot attack the turn it's summoned
  if (zone.summonedThisTurn && zone.card?.baseCard?.id === QUENOUILLE_CARD_ID) {
    return true;
  }
  return false;
}

export default function ZoneRow({
  label,
  zones,
  isSupport = false,
  isOpponent = false,
  dim = false,
  highlightEmpty = false,
  onZoneClick,
  onMonsterClick,
  onModeChange,
  selectedZone,
  recycleEnergy,
  attackingZone,
  damagedZones,
}: Props) {
  // ── Summon detection (null → filled) ──────────────────────────────────────
  const prevZonesRef = useRef<(unknown | null)[]>(zones.map(() => null));
  const [summoningZones, setSummoningZones] = useState<Set<number>>(new Set());

  // ── Mode change detection ─────────────────────────────────────────────────
  const prevModesRef = useRef<(string | undefined)[]>(
    zones.map((z) => z?.mode as string | undefined),
  );
  const [flippingZones, setFlippingZones] = useState<Set<number>>(new Set());

  useEffect(() => {
    const prevZones = prevZonesRef.current;
    const prevModes = prevModesRef.current;

    const newSummoning = new Set<number>();
    const newFlipping = new Set<number>();

    zones.forEach((zone, idx) => {
      if (!prevZones[idx] && zone) newSummoning.add(idx);

      if (!isSupport && prevZones[idx] && zone) {
        const prevMode = prevModes[idx];
        const curMode = zone.mode as string | undefined;
        if (prevMode && curMode && prevMode !== curMode) newFlipping.add(idx);
      }
    });

    if (newSummoning.size > 0) {
      setSummoningZones(newSummoning);
      const t = setTimeout(() => setSummoningZones(new Set()), 500);
      return () => clearTimeout(t);
    }

    if (newFlipping.size > 0) {
      setFlippingZones(newFlipping);
      const t = setTimeout(() => setFlippingZones(new Set()), 450);
      return () => clearTimeout(t);
    }

    prevZonesRef.current = [...zones];
    prevModesRef.current = zones.map((z) => z?.mode as string | undefined);
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

          return (
            <div
              key={idx}
              className={[
                "zr-zone",
                dim ? "zr-zone--dim" : "",
                zone ? "zr-zone--filled" : "zr-zone--empty",
                selectedZone === idx ? "zr-zone--selected" : "",
                onZoneClick || (zone && onMonsterClick)
                  ? "zr-zone--clickable"
                  : "",
                highlightEmpty && !zone ? "zr-zone--pulse-target" : "",
                isSummoning ? "zr-zone--summon-in" : "",
                isFlipping ? "zr-zone--mode-flip" : "",
                isAttacking ? "zr-zone--attacking" : "",
                isDamaged ? "zr-zone--damaged" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => {
                if (zone && onMonsterClick && zone.instanceId)
                  onMonsterClick(zone.instanceId);
                else if (onZoneClick) onZoneClick(idx);
              }}
            >
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
                      {/* 💤 uniquement sur Quenouille invoqué ce tour */}
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
              ) : (
                <span className="zr-empty-plus">+</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
