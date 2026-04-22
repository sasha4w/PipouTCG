import type React from "react";
import { useState, useEffect, useRef } from "react";
import "./FightBoard.css";
import type { GameState, MonsterOnBoard } from "./fight.types";
import FightHUD from "./FightHUD";
import ZoneRow from "./ZoneRow";
import FightHand from "./FightHand";
import type { HandCard } from "./FightHand";
import FightActionBar from "./FightActionBar";
import FightLog from "./FightLog";

interface Props {
  gs: GameState;
  selectedCard: number | null;
  selectedZone: number | null;
  payIndices: number[];
  timeLeft: number;
  onSetSelectedCard: React.Dispatch<React.SetStateAction<number | null>>;
  onSetSelectedZone: React.Dispatch<React.SetStateAction<number | null>>;
  onSetPayIndices: React.Dispatch<React.SetStateAction<number[]>>;
  onAttackMonster: (instanceId: string) => void;
  onDirectAttack: () => void;
  onSummon: () => void;
  onPlaySupport: (
    handIndex: number,
    zoneIndex?: number,
    targetInstanceId?: string,
  ) => void;
  onChangeMode: (instanceId: string, mode: "attack" | "guard") => void;
  onRecycleSupport: (handIndex: number) => void;
  onDiscardCard: (handIndex: number) => void;
  onEndPhase: () => void;
  onSurrender: () => void;
}

export default function FightBoard({
  gs,
  selectedCard,
  selectedZone,
  payIndices,
  timeLeft,
  onSetSelectedCard,
  onSetSelectedZone,
  onSetPayIndices,
  onAttackMonster,
  onDirectAttack,
  onSummon,
  onPlaySupport,
  onChangeMode,
  onRecycleSupport,
  onDiscardCard,
  onEndPhase,
  onSurrender,
}: Props) {
  const phase = gs.phase;

  // ── Attack animation ──────────────────────────────────────────────────────
  // Tracks which of MY zone indices is currently lunging
  const [attackingZoneIdx, setAttackingZoneIdx] = useState<number | null>(null);
  const attackTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ── Damage detection ──────────────────────────────────────────────────────
  const prevOppZonesRef = useRef<(MonsterOnBoard | null)[]>(
    gs.opponent.monsterZones,
  );
  const prevMyZonesRef = useRef<(MonsterOnBoard | null)[]>(gs.me.monsterZones);
  const [damagedOppZones, setDamagedOppZones] = useState<Set<number>>(
    new Set(),
  );
  const [damagedMyZones, setDamagedMyZones] = useState<Set<number>>(new Set());

  useEffect(() => {
    const prevOpp = prevOppZonesRef.current;
    const prevMy = prevMyZonesRef.current;
    const newOppDamaged = new Set<number>();
    const newMyDamaged = new Set<number>();

    gs.opponent.monsterZones.forEach((zone, idx) => {
      const prev = prevOpp[idx];
      if (prev && zone && prev.currentHp > zone.currentHp)
        newOppDamaged.add(idx);
    });
    gs.me.monsterZones.forEach((zone, idx) => {
      const prev = prevMy[idx];
      if (prev && zone && prev.currentHp > zone.currentHp)
        newMyDamaged.add(idx);
    });

    if (newOppDamaged.size > 0) {
      setDamagedOppZones(newOppDamaged);
      setTimeout(() => setDamagedOppZones(new Set()), 700);
    }
    if (newMyDamaged.size > 0) {
      setDamagedMyZones(newMyDamaged);
      setTimeout(() => setDamagedMyZones(new Set()), 700);
    }

    prevOppZonesRef.current = gs.opponent.monsterZones;
    prevMyZonesRef.current = gs.me.monsterZones;
  }, [gs.opponent.monsterZones, gs.me.monsterZones]);

  // ── Hand mapping ──────────────────────────────────────────────────────────

  const mappedHand: HandCard[] = gs.me.hand.map((ci) => ({
    id: ci.baseCard.id,
    name: ci.baseCard.name,
    type: ci.baseCard.type,
    atk: ci.baseCard.atk,
    hp: ci.baseCard.hp,
    cost: ci.baseCard.cost,
    rarity: ci.baseCard.rarity,
    supportType: ci.baseCard.supportType ?? undefined,
  }));

  // ── Event handlers ────────────────────────────────────────────────────────

  const handleCardClick = (idx: number, _card: HandCard) => {
    if (!gs.isMyTurn) return;

    if (phase === "main") {
      if (selectedCard === idx) {
        onSetSelectedCard(null);
        onSetPayIndices([]);
        return;
      }
      if (selectedCard === null) {
        onSetSelectedCard(idx);
      } else {
        onSetPayIndices((prev) =>
          prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx],
        );
      }
    } else if (phase === "end") {
      if (gs.me.hand.length > 7) onDiscardCard(idx);
    }
  };

  const handleZoneClick = (idx: number) => {
    if (phase === "main") {
      if (selectedCard !== null) onSetSelectedZone(idx);
      else if (gs.me.monsterZones[idx]) onSetSelectedZone(idx);
    } else if (phase === "battle") {
      const m = gs.me.monsterZones[idx];
      if (m && m.mode === "attack" && !m.hasAttackedThisTurn)
        onSetSelectedZone(idx);
    }
  };

  // Attack with lunge animation
  const triggerAttackAnim = (zoneIdx: number) => {
    if (attackTimerRef.current) clearTimeout(attackTimerRef.current);
    setAttackingZoneIdx(zoneIdx);
    attackTimerRef.current = setTimeout(() => setAttackingZoneIdx(null), 700);
  };

  const handleAttackMonster = (targetInstanceId: string) => {
    if (selectedZone !== null) triggerAttackAnim(selectedZone);
    onAttackMonster(targetInstanceId);
  };

  const handleDirectAttack = () => {
    if (selectedZone !== null) triggerAttackAnim(selectedZone);
    onDirectAttack();
  };

  return (
    <div className="fb-wrap">
      <FightHUD
        me={gs.me}
        opponent={gs.opponent}
        phase={phase}
        turnNumber={gs.turnNumber}
        isMyTurn={gs.isMyTurn}
        timeLeft={timeLeft}
      />

      <ZoneRow
        label="Adversaire — Supports"
        zones={gs.opponent.supportZones}
        isSupport
        dim
      />
      <ZoneRow
        label="Adversaire — Monstres"
        zones={gs.opponent.monsterZones}
        isOpponent
        damagedZones={damagedOppZones}
        onMonsterClick={
          phase === "battle" && gs.isMyTurn && selectedZone !== null
            ? handleAttackMonster
            : undefined
        }
      />

      {phase === "battle" && gs.isMyTurn && selectedZone !== null && (
        <div className="fb-direct-atk">
          <button onClick={handleDirectAttack} className="fb-btn-direct-atk">
            ⚡ Attaque Directe
          </button>
        </div>
      )}

      <ZoneRow
        label="Mes Monstres"
        zones={gs.me.monsterZones}
        onZoneClick={gs.isMyTurn ? handleZoneClick : undefined}
        onModeChange={
          phase === "main" && gs.isMyTurn ? onChangeMode : undefined
        }
        selectedZone={selectedZone}
        attackingZone={attackingZoneIdx}
        damagedZones={damagedMyZones}
      />
      <ZoneRow
        label="Mes Supports"
        zones={gs.me.supportZones}
        isSupport
        recycleEnergy={gs.me.recycleEnergy}
      />

      <FightHand
        hand={mappedHand}
        phase={phase}
        isMyTurn={gs.isMyTurn}
        selectedCard={selectedCard}
        payIndices={payIndices}
        onCardClick={handleCardClick}
      />

      <FightActionBar
        phase={phase}
        isMyTurn={gs.isMyTurn}
        selectedCard={selectedCard}
        selectedZone={selectedZone}
        hand={mappedHand}
        monsterZones={gs.me.monsterZones}
        onSummon={onSummon}
        onPlaySupport={onPlaySupport}
        onEndPhase={onEndPhase}
        onSurrender={onSurrender}
        onRecycleFromHand={(idx) => {
          onRecycleSupport(idx);
          onSetSelectedCard(null);
          onSetPayIndices([]);
        }}
      />

      <FightLog log={gs.log} />
    </div>
  );
}
