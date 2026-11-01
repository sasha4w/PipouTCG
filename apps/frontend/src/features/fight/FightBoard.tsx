import type React from "react";
import { useState, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import "./FightBoard.css";
import {
  RARITY_COLOR,
  type GameState,
  type MonsterOnBoard,
} from "./fight.types";
import FightHUD from "./FightHUD";
import FightFxLayer from "./FightFxLayer";
import { boardFxFromEvents } from "./fightEvents";
import { useFightSfx } from "./useFightSfx";
import TerrainBackground from "./TerrainBackground";
import { pickActiveTerrain, terrainWaveZone } from "./terrainSelection";
import { useAnimationPrefs } from "../../contexts/useAnimationPrefs";
import ZoneRow from "./Zonerow/ZoneRow";
import FightHand from "./FightHand";
import { IconVirus } from "../../components/Icons";
import { toHandCard, type HandCard } from "./handCard";
import FightActionBar from "./FightActionBar";
import FightLog from "./FightLog";
import GraveyardPile from "./GraveyardPile";
import EnergyCounter from "./EnergyCounter";
import type { PhaseOption } from "./phaseOptions";
import SummonCostModal from "./SummonCostModal";
import CardPickModal from "./CardPickModal";
import { releveOptions } from "./releve";
import type { PendingChoice, ClientChoiceCandidate } from "./fight.types";
import {
  HAND_LIMIT,
  canEvolveNow,
  canEvolveOnto,
  canImplantOn,
  canSummonFromHand,
  canSummonOnEnemySide,
  evolutionCost,
  ephemeralTargetSide,
  isImplanted,
  isPlantedBy,
  isTargetableByEphemeral,
  type CardEffect,
  type CombatMode,
} from "@pipou/shared";

interface Props {
  gs: GameState;
  selectedCard: number | null;
  selectedZone: number | null;
  payIndices: number[];
  /** null : pas de timer (sandbox sans timer). */
  timeLeft: number | null;
  onSetSelectedCard: React.Dispatch<React.SetStateAction<number | null>>;
  onSetSelectedZone: React.Dispatch<React.SetStateAction<number | null>>;
  onSetPayIndices: React.Dispatch<React.SetStateAction<number[]>>;
  onAttackMonster: (instanceId: string) => void;
  onDirectAttack: () => void;
  onSummon: () => void;
  /** Invoque Noyau Zeta sur la zone adverse zoneIndex */
  onSummonZeta: (zoneIndex: number) => void;
  onSummonReleve: (zoneIndex: number, releveInstanceIds: string[]) => void;
  /** Fait évoluer la carte sélectionnée sur le monstre allié visé */
  onEvolve: (targetInstanceId: string, paymentIndices?: number[]) => void;
  onPlaySupport: (
    handIndex: number,
    zoneIndex?: number,
    targetInstanceId?: string,
  ) => void;
  onChangeMode: (instanceId: string, mode: CombatMode) => void;
  onRecycleSupport: (handIndex: number) => void;
  onTransform: (handIndex: number) => void;
  onDiscardCard: (handIndex: number) => void;
  onEndPhase: () => void;
  /** Absent : pas de bouton d'abandon. */
  onSurrender?: () => void;
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
  onSummonReleve,
  onEvolve,
  onPlaySupport,
  onChangeMode,
  onRecycleSupport,
  onTransform,
  onDiscardCard,
  onEndPhase,
  onSurrender,
}: Props) {
  const { t } = useTranslation();
  const phase = gs.phase;

  const { reduced } = useAnimationPrefs();
  const fx = useMemo(
    // `?? []` : état envoyé par un backend pas encore redéployé
    () => boardFxFromEvents(gs.events ?? [], gs.me.userId),
    [gs.events, gs.me.userId],
  );
  useFightSfx(gs);
  const myTerrain = pickActiveTerrain(gs.me.supportZones);
  const oppTerrain = pickActiveTerrain(gs.opponent.supportZones);

  // ── Invocation légendaire / secrète : flash + secousse ───────────────────
  const [flash, setFlash] = useState<{ key: number; color: string } | null>(
    null,
  );
  const [shaking, setShaking] = useState(false);
  useEffect(() => {
    const top = fx.topSummon;
    if (reduced || !top || top.tier < 3) return;
    // Déclenchement d'un effet visuel ponctuel en réaction à de nouveaux événements
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFlash((f) => ({
      key: (f?.key ?? 0) + 1,
      color: RARITY_COLOR[top.rarity],
    }));
    setShaking(true);
  }, [fx, reduced]);

  const [showSummonModal, setShowSummonModal] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [graveyardSide, setGraveyardSide] = useState<
    "me" | "opponent" | null
  >(null);
  // Relève sur une zone occupée : l'allié de cette zone est sacrifié d'office
  const [releveLockedId, setReleveLockedId] = useState<string | null>(null);
  // Monstre visé par une évolution en attente de paiement
  const [evolveTargetId, setEvolveTargetId] = useState<string | null>(null);
  // Une évolution en attente ne survit pas à un changement de carte sélectionnée
  const [evolveCard, setEvolveCard] = useState(selectedCard);
  if (evolveCard !== selectedCard) {
    setEvolveCard(selectedCard);
    if (evolveTargetId !== null) {
      setEvolveTargetId(null);
      setShowSummonModal(false);
    }
  }

  // ── Support ciblé sur monstre (CardPickModal interne) ────────────────────
  const [targetSupportHandIdx, setTargetSupportHandIdx] = useState<
    number | null
  >(null);
  const [targetSupportChoice, setTargetSupportChoice] =
    useState<PendingChoice | null>(null);

  // Zone adverse choisie pour Zeta (distinct de selectedZone qui est côté allié)
  // Zone adverse choisie pour Noyau Zeta, liée à la carte de la main sélectionnée
  const [oppZoneChoice, setOppZoneChoice] = useState<{
    card: number | null;
    zone: number;
  } | null>(null);

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

  const mappedHand: HandCard[] = gs.me.hand.map(toHandCard);

  const selectedHandCard =
    selectedCard !== null ? mappedHand[selectedCard] : null;

  const isTerrain =
    selectedHandCard?.type === "support" &&
    selectedHandCard.supportType === "TERRAIN";

  const isEquipment =
    selectedHandCard?.type === "support" &&
    selectedHandCard.supportType === "EQUIPMENT";

  // Carte invocable sur le terrain adverse (passif SUMMONABLE_ON_ENEMY_SIDE)
  const isZeta =
    selectedHandCard?.type === "monster" &&
    selectedCard !== null &&
    canSummonOnEnemySide(gs.me.hand[selectedCard]?.baseCard.effects);

  // Un seul Zeta implanté par poseur chez l'adversaire
  const myId = gs.me.userId;
  const canImplant = canImplantOn(gs.opponent.monsterZones, myId);

  // Zeta adverse implanté sur mon terrain : inutilisable par moi, désinfectable
  const implantedIds = new Set(
    gs.me.monsterZones
      .filter((m): m is MonsterOnBoard => !!m && isImplanted(m, myId))
      .map((m) => m.instanceId),
  );
  // Mon Zeta implanté chez l'adversaire : équipable, jamais attaquable par moi
  const plantedByMeIds = new Set(
    gs.opponent.monsterZones
      .filter((m): m is MonsterOnBoard => !!m && isPlantedBy(m, myId))
      .map((m) => m.instanceId),
  );
  const isMyBattle = gs.isMyTurn && phase === "battle";
  const isMyMain = gs.isMyTurn && phase === "main";
  const attackerSelected = isMyBattle && selectedZone !== null;
  const disinfectableIds = new Set<string>();
  const lockedZetas = new Map<string, string>();
  if (attackerSelected) {
    for (const m of gs.me.monsterZones) {
      if (!m || !implantedIds.has(m.instanceId)) continue;
      if (m.disinfectImmune)
        lockedZetas.set(m.instanceId, t("fight.zetaProtected"));
      else disinfectableIds.add(m.instanceId);
    }
  }
  // Cibles d'un équipement : mes monstres (hors Zeta implanté) ou mon Zeta implanté
  const equippableIds = new Set(
    isEquipment && isMyMain
      ? gs.me.monsterZones
          .filter(
            (m): m is MonsterOnBoard => !!m && !implantedIds.has(m.instanceId),
          )
          .map((m) => m.instanceId)
      : [],
  );

  // Valable seulement tant que la même carte Zeta reste sélectionnée
  const selectedOppZone =
    isZeta && oppZoneChoice?.card === selectedCard ? oppZoneChoice.zone : null;
  const setSelectedOppZone = (zone: number | null) =>
    setOppZoneChoice(zone === null ? null : { card: selectedCard, zone });

  // Monstres alliés sur lesquels la carte sélectionnée peut évoluer maintenant
  const selectedInstance =
    selectedCard !== null ? gs.me.hand[selectedCard] : undefined;
  // Jeune / Adulte Drakon : jamais posé sur une zone vide, seulement par évolution
  // Relève possible pour la carte sélectionnée (alliés Pipou en nombre suffisant)
  const releve =
    selectedInstance && canSummonFromHand(selectedInstance.baseCard)
      ? releveOptions(selectedInstance.baseCard, gs.me.monsterZones, myId)
      : null;
  const evolvesOnly =
    !!selectedInstance && !canSummonFromHand(selectedInstance.baseCard);
  const evolvableTargets: MonsterOnBoard[] =
    gs.isMyTurn && phase === "main" && selectedInstance
      ? gs.me.monsterZones.filter(
          (m): m is MonsterOnBoard =>
            !!m &&
            canEvolveOnto(selectedInstance.baseCard, m) &&
            canEvolveNow(m),
        )
      : [];
  const evolvableIds = new Set(evolvableTargets.map((m) => m.instanceId));
  const myHighlightIds = new Set([...evolvableIds, ...equippableIds]);
  const evolveTarget =
    evolveTargetId !== null
      ? gs.me.monsterZones.find((m) => m?.instanceId === evolveTargetId)
      : undefined;

  const monsterNeedsPayment = (card: HandCard): boolean => {
    const cost = card.cost ?? 0;
    if (cost === 0) return false;
    return Math.max(0, cost - gs.me.recycleEnergy) > 0;
  };

  /** Monstres qu'un Éphémère peut viser dans ce camp (immunisés exclus). */
  const targetableZones = (
    side: "ally" | "enemy",
    effects: CardEffect[] | null | undefined,
  ): MonsterOnBoard[] =>
    (side === "ally" ? gs.me.monsterZones : gs.opponent.monsterZones).filter(
      (z): z is MonsterOnBoard =>
        z !== null && isTargetableByEphemeral(z, side, effects),
    );

  /** Ouvre le CardPickModal pour choisir la cible d'un support éphémère */
  const openTargetPick = (
    handIdx: number,
    cardName: string,
    targetSide: "ally" | "enemy",
    effects: CardEffect[] | null | undefined,
  ) => {
    const candidates: ClientChoiceCandidate[] = targetableZones(
      targetSide,
      effects,
    ).map((z) => ({
      instanceId: z.instanceId,
      baseCard: {
        id: z.card.baseCard.id,
        name: z.card.baseCard.name,
        type: z.card.baseCard.type,
        atk: z.card.baseCard.atk,
        hp: z.card.baseCard.hp,
        rarity: z.card.baseCard.rarity,
        supportType: z.card.baseCard.supportType,
        cost: z.card.baseCard.cost,
        image: z.card.baseCard.image,
        description: z.card.baseCard.description,
        element: z.card.baseCard.element,
        stage: z.card.baseCard.stage,
      },
      source: "board" as const,
    }));

    // Aucune cible : la barre d'action désactive déjà le bouton
    if (candidates.length === 0) return;

    setTargetSupportHandIdx(handIdx);
    setTargetSupportChoice({
      candidates,
      count: 1,
      prompt:
        targetSide === "ally"
          ? t("fight.targetAlly", { name: cardName })
          : t("fight.targetEnemy", { name: cardName }),
      resolution: "pick_to_hand",
    });
  };

  // ── Event handlers ────────────────────────────────────────────────────────

  const handleCardClick = (idx: number) => {
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
      if (gs.me.hand.length > HAND_LIMIT) onDiscardCard(idx);
    }
  };

  // Clic sur zone monstre ALLIÉE
  const handleZoneClick = (idx: number) => {
    if (phase === "main") {
      if (selectedCard !== null) {
        if (isTerrain || isZeta) return; // ces cartes ne vont pas en zone alliée monstre
        const occupant = gs.me.monsterZones[idx];
        if (occupant && implantedIds.has(occupant.instanceId)) return; // Zeta adverse : intouchable
        if (
          occupant &&
          evolvableIds.has(occupant.instanceId) &&
          selectedInstance
        ) {
          const cost = evolutionCost(selectedInstance.baseCard, occupant);
          if (Math.max(0, cost - gs.me.recycleEnergy) > 0) {
            onSetPayIndices([]);
            setEvolveTargetId(occupant.instanceId);
            setShowSummonModal(true);
          } else {
            onEvolve(occupant.instanceId, []);
          }
          return;
        }
        // Relève : la zone d'un allié Pipou accueille le monstre à sa place
        if (
          occupant &&
          releve?.allies.some((a) => a.instanceId === occupant.instanceId)
        ) {
          onSetSelectedZone(idx);
          setReleveLockedId(occupant.instanceId);
          setShowSummonModal(true);
          return;
        }
        if (evolvesOnly) return;
        const card = mappedHand[selectedCard];
        const isFreeCard =
          selectedHandCard !== null &&
          gs.me.freeSummonInstanceIds.includes(selectedHandCard.instanceId);

        if (card?.type === "monster") {
          onSetSelectedZone(idx);
          if (!isFreeCard && monsterNeedsPayment(card)) {
            onSetPayIndices([]);
            setShowSummonModal(true);
          }
        } else if (
          card?.type === "support" &&
          card.supportType === "EQUIPMENT"
        ) {
          // EQUIPMENT : équiper directement le monstre sur cette zone
          const target = gs.me.monsterZones[idx];
          if (!target) return; // zone vide, pas de cible
          onPlaySupport(selectedCard, undefined, target.instanceId);
          onSetSelectedCard(null);
          onSetSelectedZone(null);
          onSetPayIndices([]);
        } else {
          onSetSelectedZone(idx);
        }
      } else if (
        gs.me.monsterZones[idx] &&
        !implantedIds.has(gs.me.monsterZones[idx].instanceId)
      ) {
        onSetSelectedZone(idx);
      }
    } else if (phase === "battle") {
      const m = gs.me.monsterZones[idx];
      if (!m) return;
      if (implantedIds.has(m.instanceId)) {
        // Désinfecter : l'attaquant choisi frappe le Zeta posé chez moi
        if (selectedZone !== null && disinfectableIds.has(m.instanceId))
          handleAttackMonster(m.instanceId);
        return;
      }
      if (m.mode === "attack" && !m.hasAttackedThisTurn) onSetSelectedZone(idx);
    }
  };

  // Clic sur zone monstre ADVERSE
  const handleOpponentZoneClick = (idx: number) => {
    if (!gs.isMyTurn || phase !== "main") return;

    // Équipement sur mon Zeta implanté chez l'adversaire
    const occupant = gs.opponent.monsterZones[idx];
    if (isEquipment && selectedCard !== null) {
      if (!occupant || !plantedByMeIds.has(occupant.instanceId)) return;
      onPlaySupport(selectedCard, undefined, occupant.instanceId);
      onSetSelectedCard(null);
      onSetSelectedZone(null);
      onSetPayIndices([]);
      return;
    }

    // Zeta : placement sur zone adverse vide (un seul implanté à la fois)
    if (
      isZeta &&
      canImplant &&
      selectedCard !== null &&
      !gs.opponent.monsterZones[idx]
    ) {
      setSelectedOppZone(idx);
      const card = mappedHand[selectedCard];
      const isFreeCard = gs.me.freeSummonInstanceIds.includes(card.instanceId);

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
    if (evolveTargetId !== null) {
      onEvolve(evolveTargetId, payIndices);
      setEvolveTargetId(null);
    } else if (isZeta && selectedOppZone !== null) {
      onSummonZeta(selectedOppZone);
      onSetSelectedCard(null);
      setSelectedOppZone(null);
    } else {
      onSummon();
    }
  };

  const handleModalClose = () => {
    setReleveLockedId(null);
    setShowSummonModal(false);
    setEvolveTargetId(null);
    onSetSelectedZone(null);
    setSelectedOppZone(null);
    onSetPayIndices([]);
  };

  const handleTogglePay = (idx: number) => {
    onSetPayIndices((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx],
    );
  };

  const clearHandSelection = () => {
    onSetSelectedCard(null);
    onSetSelectedZone(null);
    onSetPayIndices([]);
  };

  /** Recycler (phase principale) ou défausser (phase de contrôle) la carte sélectionnée. */
  const handleBarRecycle = () => {
    if (selectedCard === null) return;
    if (phase === "end") onDiscardCard(selectedCard);
    else onRecycleSupport(selectedCard);
    onSetSelectedCard(null);
    onSetPayIndices([]);
  };

  /** Action de l'emplacement principal : transformer, jouer un Éphémère ou attaquer. */
  const handleBarMain = () => {
    if (phase === "battle") {
      handleDirectAttack();
      return;
    }
    if (selectedCard === null || !selectedHandCard) return;
    if (selectedHandCard.type === "monster") {
      onTransform(selectedCard);
      onSetSelectedCard(null);
      onSetPayIndices([]);
      return;
    }
    // Éphémère ciblé : choisir la cible avant de jouer
    const instance = gs.me.hand[selectedCard];
    const side = ephemeralTargetSide(instance?.baseCard.effects);
    if (instance && side) {
      openTargetPick(
        selectedCard,
        instance.baseCard.name,
        side,
        instance.baseCard.effects,
      );
      return;
    }
    onPlaySupport(selectedCard);
    clearHandSelection();
  };

  /** Change de phase : un `end_phase` par étape, sans jamais revenir en arrière. */
  const handlePickPhase = (option: PhaseOption) => {
    if (option.disabledReason) return;
    for (let i = 0; i < option.steps; i++) onEndPhase();
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

  // Mon propre Zeta, implanté chez l'adversaire, n'est pas une cible
  const handleAttackOpponent = (targetInstanceId: string) => {
    if (plantedByMeIds.has(targetInstanceId)) return;
    handleAttackMonster(targetInstanceId);
  };

  const handleDirectAttack = () => {
    if (selectedZone !== null) triggerAttackAnim(selectedZone);
    onDirectAttack();
  };

  // Éphémère ciblé sans cible possible : bouton « Jouer » désactivé
  const selectedTargetSide =
    selectedCard !== null
      ? ephemeralTargetSide(gs.me.hand[selectedCard]?.baseCard.effects)
      : null;
  const playBlockedReason =
    selectedTargetSide !== null &&
    targetableZones(
      selectedTargetSide,
      gs.me.hand[selectedCard ?? 0]?.baseCard.effects,
    ).length === 0
      ? t("fight.noTarget")
      : undefined;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className={[
        "fb-wrap",
        reduced ? "fb--reduced-motion" : "",
        shaking ? "fb-wrap--shake" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget && e.animationName === "fb-shake")
          setShaking(false);
      }}
    >
      <FightFxLayer flash={flash} />
      <FightHUD
        me={gs.me}
        opponent={gs.opponent}
        phase={phase}
        turnNumber={gs.turnNumber}
        isMyTurn={gs.isMyTurn}
        timeLeft={timeLeft}
        handSize={gs.me.hand.length}
        onPickPhase={handlePickPhase}
        onOpenLog={() => setLogOpen(true)}
        onOpenGraveyard={setGraveyardSide}
        onSurrender={onSurrender}
      />
      <EnergyCounter value={gs.me.recycleEnergy} />

      <div className="fb-side-row">
        <TerrainBackground
          terrain={oppTerrain}
          side="opponent"
          waveFromZone={terrainWaveZone(
            oppTerrain,
            gs.opponent.supportZones,
            fx.opponent.supports,
          )}
          reduced={reduced}
        />
        <div className="fb-zones-col">
          <ZoneRow
            label={t("fight.zone.oppSupports")}
            zones={gs.opponent.supportZones}
            fx={fx.opponent.supports}
            isSupport
            dim
          />
          <ZoneRow
            label={t("fight.zone.oppMonsters")}
            zones={gs.opponent.monsterZones}
            fx={fx.opponent.monsters}
            isOpponent
            damagedZones={damagedOppZones}
            highlightOpponentEmpty={isMyMain && isZeta && canImplant}
            highlightInstanceIds={
              isEquipment && isMyMain ? plantedByMeIds : undefined
            }
            onZoneClick={
              isMyMain && (isZeta || isEquipment)
                ? handleOpponentZoneClick
                : undefined
            }
            onMonsterClick={attackerSelected ? handleAttackOpponent : undefined}
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

      {isZeta && isMyMain && (
        <div className="fb-zeta-hint">
          <IconVirus size={14} />{" "}
          {canImplant
            ? t("fight.zetaImplantHint", { name: selectedHandCard?.name })
            : t("fight.zetaAlreadyImplanted")}
        </div>
      )}

      {attackerSelected && disinfectableIds.size > 0 && (
        <div className="fb-zeta-hint">
          <IconVirus size={14} /> {t("fight.zetaDisinfectHint")}
        </div>
      )}

      <div className="fb-side-row">
        <TerrainBackground
          terrain={myTerrain}
          side="me"
          waveFromZone={terrainWaveZone(
            myTerrain,
            gs.me.supportZones,
            fx.me.supports,
          )}
          reduced={reduced}
        />
        <div className="fb-zones-col">
          <ZoneRow
            label={t("fight.zone.myMonsters")}
            zones={gs.me.monsterZones}
            fx={fx.me.monsters}
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
              !isZeta &&
              !evolvesOnly
            }
            highlightInstanceIds={myHighlightIds}
            attackTargetIds={disinfectableIds}
            lockedInstances={lockedZetas}
            noModeChangeIds={implantedIds}
          />

          <ZoneRow
            label={t("fight.zone.mySupports")}
            zones={gs.me.supportZones}
            fx={fx.me.supports}
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
      </div>

      <FightHand
        hand={mappedHand}
        phase={phase}
        isMyTurn={gs.isMyTurn}
        selectedCard={selectedCard}
        payIndices={payIndices}
        freeSummonInstanceIds={gs.me.freeSummonInstanceIds}
        onCardClick={handleCardClick}
      />

      <FightActionBar
        phase={phase}
        isMyTurn={gs.isMyTurn}
        selectedCard={selectedHandCard}
        attackerSelected={attackerSelected}
        transformUsed={gs.me.transformUsedThisTurn}
        overHandLimit={gs.me.hand.length > HAND_LIMIT}
        canEvolve={evolvableTargets.length > 0}
        playBlockedReason={playBlockedReason}
        onRecycle={handleBarRecycle}
        onMain={handleBarMain}
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
            costOverride={
              evolveTarget && selectedInstance
                ? evolutionCost(selectedInstance.baseCard, evolveTarget)
                : undefined
            }
            releve={
              releve && !evolveTarget && !isZeta
                ? {
                    needed: releve.needed,
                    allies: releve.allies.map((m) => ({
                      instanceId: m.instanceId,
                      name: m.card.baseCard.name,
                      atk: m.card.baseCard.atk ?? 0,
                      hp: m.currentHp,
                    })),
                    lockedId: releveLockedId ?? undefined,
                    onConfirm: (ids) => {
                      setShowSummonModal(false);
                      setReleveLockedId(null);
                      if (selectedZone !== null)
                        onSummonReleve(selectedZone, ids);
                    },
                  }
                : undefined
            }
          />
        )}

      {/* Modal de choix de cible pour support éphémère ciblé ──────────── */}
      {targetSupportChoice !== null && targetSupportHandIdx !== null && (
        <CardPickModal
          choice={targetSupportChoice}
          confirmLabel={`🎯 ${t("fight.target")}`}
          onConfirm={(instanceIds) => {
            const [targetId] = instanceIds;
            onPlaySupport(targetSupportHandIdx, undefined, targetId);
            onSetSelectedCard(null);
            onSetSelectedZone(null);
            onSetPayIndices([]);
            setTargetSupportChoice(null);
            setTargetSupportHandIdx(null);
          }}
          onCancel={() => {
            setTargetSupportChoice(null);
            setTargetSupportHandIdx(null);
          }}
        />
      )}

      {logOpen && <FightLog log={gs.log} onClose={() => setLogOpen(false)} />}
      {graveyardSide && (
        <GraveyardPile
          graveyard={
            graveyardSide === "me" ? gs.me.graveyard : gs.opponent.graveyard
          }
          label={
            graveyardSide === "me" ? t("fight.zone.me") : gs.opponent.username
          }
          onClose={() => setGraveyardSide(null)}
        />
      )}
    </div>
  );
}
