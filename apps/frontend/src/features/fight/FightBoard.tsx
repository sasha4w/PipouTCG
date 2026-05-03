import type React from "react";
import { useState, useEffect, useRef } from "react";
import "./FightBoard.css";
import type { GameState, MonsterOnBoard } from "./fight.types";
import { FREE_SUMMON_CARD_ID, NOYAU_ZETA_CARD_ID } from "./fight.types";
import FightHUD from "./FightHUD";
import ZoneRow from "./ZoneRow";
import FightHand from "./FightHand";
import type { HandCard } from "./FightHand";
import FightActionBar from "./FightActionBar";
import FightLog from "./FightLog";
import GraveyardPile from "./GraveyardPile";
import SummonCostModal from "./SummonCostModal";

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
  /** Invoque Noyau Zeta sur la zone adverse zoneIndex */
  onSummonZeta: (zoneIndex: number) => void;
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
  onSummonZeta,
  onPlaySupport,
  onChangeMode,
  onRecycleSupport,
  onDiscardCard,
  onEndPhase,
  onSurrender,
}: Props) {
  const phase = gs.phase;

  const [showSummonModal, setShowSummonModal] = useState(false);

  // Zone adverse choisie pour Zeta (distinct de selectedZone qui est côté allié)
  const [selectedOppZone, setSelectedOppZone] = useState<number | null>(null);

  // ── Attack animation ──────────────────────────────────────────────────────
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

  const selectedHandCard =
    selectedCard !== null ? mappedHand[selectedCard] : null;

  const isTerrain =
    selectedHandCard?.type === "support" &&
    selectedHandCard.supportType === "TERRAIN";

  // Zeta sélectionné → mode placement sur zone adverse
  const isZeta =
    selectedHandCard?.type === "monster" &&
    selectedHandCard.id === NOYAU_ZETA_CARD_ID;

  // Reset selectedOppZone quand Zeta est désélectionné
  useEffect(() => {
    if (!isZeta) setSelectedOppZone(null);
  }, [isZeta]);

  const monsterNeedsPayment = (card: HandCard): boolean => {
    const cost = card.cost ?? 0;
    if (cost === 0) return false;
    return Math.max(0, cost - gs.me.recycleEnergy) > 0;
  };

  // ── Event handlers ────────────────────────────────────────────────────────

  const handleCardClick = (idx: number, _card: HandCard) => {
    if (!gs.isMyTurn) return;

    if (phase === "main") {
      if (selectedCard === idx) {
        onSetSelectedCard(null);
        onSetPayIndices([]);
        setSelectedOppZone(null);
        return;
      }
      if (selectedCard === null) {
        onSetSelectedCard(idx);
        return;
      }
      onSetPayIndices((prev) =>
        prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx],
      );
    } else if (phase === "end") {
      if (gs.me.hand.length > 7) onDiscardCard(idx);
    }
  };

  // Clic sur zone monstre ALLIÉE
  const handleZoneClick = (idx: number) => {
    if (phase === "main") {
      if (selectedCard !== null) {
        if (isTerrain || isZeta) return; // ces cartes ne vont pas en zone alliée
        const card = mappedHand[selectedCard];
        const isFreeCard =
          gs.me.freeSummonAvailable === true &&
          selectedHandCard?.id === FREE_SUMMON_CARD_ID;

        if (card?.type === "monster") {
          onSetSelectedZone(idx);
          if (!isFreeCard && monsterNeedsPayment(card)) {
            onSetPayIndices([]);
            setShowSummonModal(true);
          }
        } else {
          onSetSelectedZone(idx);
        }
      } else if (gs.me.monsterZones[idx]) {
        onSetSelectedZone(idx);
      }
    } else if (phase === "battle") {
      const m = gs.me.monsterZones[idx];
      if (m && m.mode === "attack" && !m.hasAttackedThisTurn)
        onSetSelectedZone(idx);
    }
  };

  // Clic sur zone monstre ADVERSE
  const handleOpponentZoneClick = (idx: number) => {
    if (!gs.isMyTurn || phase !== "main") return;

    // Zeta : placement sur zone adverse vide
    if (isZeta && selectedCard !== null && !gs.opponent.monsterZones[idx]) {
      setSelectedOppZone(idx);
      const card = mappedHand[selectedCard];
      const isFreeCard =
        gs.me.freeSummonAvailable === true && card.id === FREE_SUMMON_CARD_ID;

      if (!isFreeCard && monsterNeedsPayment(card)) {
        onSetPayIndices([]);
        setShowSummonModal(true);
      } else {
        onSummonZeta(idx);
        onSetSelectedCard(null);
        setSelectedOppZone(null);
      }
    }
  };

  const handleSupportZoneClick = (idx: number) => {
    if (!gs.isMyTurn || phase !== "main" || selectedCard === null) return;
    if (!isTerrain) return;
    if (gs.me.supportZones[idx]) return;

    onPlaySupport(selectedCard, idx);
    onSetSelectedCard(null);
    onSetSelectedZone(null);
    onSetPayIndices([]);
  };

  // Modal confirm : selon contexte, invocation normale ou Zeta adverse
  const handleModalConfirm = () => {
    setShowSummonModal(false);
    if (isZeta && selectedOppZone !== null) {
      onSummonZeta(selectedOppZone);
      onSetSelectedCard(null);
      setSelectedOppZone(null);
    } else {
      onSummon();
    }
  };

  const handleModalClose = () => {
    setShowSummonModal(false);
    onSetSelectedZone(null);
    setSelectedOppZone(null);
    onSetPayIndices([]);
  };

  const handleTogglePay = (idx: number) => {
    onSetPayIndices((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx],
    );
  };

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

  // ── Render ────────────────────────────────────────────────────────────────

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

      <div className="fb-side-row">
        <GraveyardPile
          graveyard={gs.opponent.graveyard}
          label={gs.opponent.username}
        />
        <div className="fb-zones-col">
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
            highlightOpponentEmpty={gs.isMyTurn && phase === "main" && isZeta}
            onZoneClick={
              gs.isMyTurn && phase === "main" && isZeta
                ? handleOpponentZoneClick
                : undefined
            }
            onMonsterClick={
              phase === "battle" && gs.isMyTurn && selectedZone !== null
                ? handleAttackMonster
                : undefined
            }
          />
        </div>
      </div>

      {phase === "battle" && gs.isMyTurn && selectedZone !== null && (
        <div className="fb-direct-atk">
          <button onClick={handleDirectAttack} className="fb-btn-direct-atk">
            ⚡ Attaque Directe
          </button>
        </div>
      )}

      {isZeta && gs.isMyTurn && phase === "main" && (
        <div className="fb-zeta-hint">
          🦠 Sélectionne une zone adverse vide pour implanter Noyau Zeta
        </div>
      )}

      <div className="fb-side-row">
        <div className="fb-zones-col">
          <ZoneRow
            label="Mes Monstres"
            zones={gs.me.monsterZones}
            onZoneClick={gs.isMyTurn && !isZeta ? handleZoneClick : undefined}
            onModeChange={
              phase === "main" && gs.isMyTurn ? onChangeMode : undefined
            }
            selectedZone={selectedZone}
            attackingZone={attackingZoneIdx}
            damagedZones={damagedMyZones}
            highlightEmpty={
              gs.isMyTurn &&
              phase === "main" &&
              selectedHandCard?.type === "monster" &&
              !isZeta
            }
          />

          <ZoneRow
            label="Mes Supports"
            zones={gs.me.supportZones}
            isSupport
            recycleEnergy={gs.me.recycleEnergy}
            onZoneClick={
              gs.isMyTurn && phase === "main" && isTerrain
                ? handleSupportZoneClick
                : undefined
            }
            highlightEmpty={gs.isMyTurn && phase === "main" && isTerrain}
            dim={
              gs.isMyTurn &&
              phase === "main" &&
              selectedHandCard?.type === "support" &&
              !isTerrain
            }
          />
        </div>
        <GraveyardPile graveyard={gs.me.graveyard} label="Moi" />
      </div>

      <FightHand
        hand={mappedHand}
        phase={phase}
        isMyTurn={gs.isMyTurn}
        selectedCard={selectedCard}
        payIndices={payIndices}
        freeSummonAvailable={gs.me.freeSummonAvailable}
        onCardClick={handleCardClick}
      />

      <FightActionBar
        phase={phase}
        isMyTurn={gs.isMyTurn}
        selectedCard={selectedCard}
        selectedZone={isZeta ? selectedOppZone : selectedZone}
        hand={mappedHand}
        monsterZones={gs.me.monsterZones}
        onSummon={onSummon}
        onOpenSummonModal={() => {
          onSetPayIndices([]);
          setShowSummonModal(true);
        }}
        onPlaySupport={onPlaySupport}
        onEndPhase={onEndPhase}
        onSurrender={onSurrender}
        onRecycleFromHand={(idx) => {
          onRecycleSupport(idx);
          onSetSelectedCard(null);
          onSetPayIndices([]);
        }}
        freeSummonAvailable={gs.me.freeSummonAvailable}
      />

      {showSummonModal &&
        selectedHandCard !== null &&
        selectedCard !== null && (
          <SummonCostModal
            card={selectedHandCard}
            hand={mappedHand}
            selectedCardIdx={selectedCard}
            recycleEnergy={gs.me.recycleEnergy}
            payIndices={payIndices}
            onTogglePay={handleTogglePay}
            onConfirm={handleModalConfirm}
            onClose={handleModalClose}
          />
        )}

      <FightLog log={gs.log} />
    </div>
  );
}
