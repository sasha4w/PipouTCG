import type React from "react";
import { useState, useEffect, useRef } from "react";
import "./FightBoard.css";
import type { GameState, MonsterOnBoard } from "./fight.types";
import { FREE_SUMMON_CARD_ID } from "./fight.types";
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

  // ── Modal invocation rapide ───────────────────────────────────────────────
  const [showSummonModal, setShowSummonModal] = useState(false);

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

  // ── Helpers ───────────────────────────────────────────────────────────────

  const selectedHandCard =
    selectedCard !== null ? mappedHand[selectedCard] : null;

  // La carte sélectionnée est-elle un terrain ?
  const isTerrain =
    selectedHandCard?.type === "support" &&
    selectedHandCard.supportType === "TERRAIN";

  // La carte sélectionnée est-elle un monstre qui nécessite un paiement ?
  const monsterNeedsPayment = (card: HandCard): boolean => {
    const cost = card.cost ?? 0;
    if (cost === 0) return false;
    const needToPay = Math.max(0, cost - gs.me.recycleEnergy);
    return needToPay > 0;
  };

  // ── Event handlers ────────────────────────────────────────────────────────

  const handleCardClick = (idx: number, _card: HandCard) => {
    if (!gs.isMyTurn) return;

    if (phase === "main") {
      // Désélectionner si déjà sélectionné
      if (selectedCard === idx) {
        onSetSelectedCard(null);
        onSetPayIndices([]);
        return;
      }
      // Première sélection → carte principale
      if (selectedCard === null) {
        onSetSelectedCard(idx);
        return;
      }
      // Deuxième sélection → toggle comme carte de paiement
      onSetPayIndices((prev) =>
        prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx],
      );
    } else if (phase === "end") {
      if (gs.me.hand.length > 7) onDiscardCard(idx);
    }
  };

  // Clic sur zone monstre
  const handleZoneClick = (idx: number) => {
    if (phase === "main") {
      if (selectedCard !== null) {
        const card = mappedHand[selectedCard];

        // Les terrains utilisent les zones support — ignorer les zones monstres
        if (isTerrain) return;
        // Dans les helpers, après isTerrain
        const isFreeCard =
          gs.me.freeSummonAvailable === true &&
          selectedHandCard?.id === FREE_SUMMON_CARD_ID;

        // Dans handleZoneClick, remplace le bloc monster
        if (card?.type === "monster") {
          onSetSelectedZone(idx);
          if (!isFreeCard && monsterNeedsPayment(card)) {
            onSetPayIndices([]);
            setShowSummonModal(true);
          }
          // si isFreeCard ou coût 0 → pas de modal, ActionBar gère directement
        } else {
          // Équipement → sélectionner le monstre cible
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

  // ── Feature 1 — Clic sur zone support (terrain uniquement) ───────────────
  const handleSupportZoneClick = (idx: number) => {
    if (!gs.isMyTurn || phase !== "main" || selectedCard === null) return;
    if (!isTerrain) return;
    // Zone déjà occupée → refus côté backend de toute façon, mais on bloque ici
    if (gs.me.supportZones[idx]) return;

    onPlaySupport(selectedCard, idx);
    onSetSelectedCard(null);
    onSetSelectedZone(null);
    onSetPayIndices([]);
  };

  // ── Feature 3 — Modal confirm/cancel ─────────────────────────────────────
  const handleModalConfirm = () => {
    setShowSummonModal(false);
    onSummon();
  };

  const handleModalClose = () => {
    setShowSummonModal(false);
    onSetSelectedZone(null);
    onSetPayIndices([]);
  };

  const handleTogglePay = (idx: number) => {
    onSetPayIndices((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx],
    );
  };

  // ── Attack animation ──────────────────────────────────────────────────────
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

      <div className="fb-side-row">
        <div className="fb-zones-col">
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
            // ✨ Ajout de la prop pour clignoter si on a sélectionné un monstre
            highlightEmpty={
              gs.isMyTurn &&
              phase === "main" &&
              selectedHandCard?.type === "monster"
            }
          />

          {/* Feature 1 — zone support cliquable si terrain sélectionné */}
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
            // ✨ Ajout de la prop pour clignoter si on a sélectionné un terrain
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
        selectedZone={selectedZone}
        hand={mappedHand}
        monsterZones={gs.me.monsterZones}
        onSummon={() => {
          // This is the fallback for monsters with 0 cost or already paid
          onSummon();
        }}
        // Add this line to fix the error:
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

      {/* Feature 3 — Modal d'invocation rapide */}
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
