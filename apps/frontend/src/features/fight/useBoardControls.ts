import { useCallback, useState } from "react";
import type { CombatMode, GameAction } from "@pipou/shared";
import type { GameState } from "./fight.types";

/**
 * Sélections du plateau et actions de jeu, partagées par le duel et le
 * sandbox : seul `send` (le transport) diffère.
 */
export function useBoardControls(
  gs: GameState | null,
  send: (action: GameAction) => void,
) {
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const [selectedZone, setSelectedZone] = useState<number | null>(null);
  const [payIndices, setPayIndices] = useState<number[]>([]);

  const clearSelection = useCallback(() => {
    setSelectedCard(null);
    setSelectedZone(null);
    setPayIndices([]);
  }, []);

  const summonAt = (
    zoneIndex: number,
    paymentHandIndices: number[],
    onOpponentSide: boolean,
  ) => {
    if (selectedCard === null) return;
    send({
      type: "summon",
      handIndex: selectedCard,
      zoneIndex,
      paymentHandIndices,
      ...(onOpponentSide && { onOpponentSide: true }),
    });
    clearSelection();
  };

  const attack = (target: { targetInstanceId: string } | { direct: true }) => {
    const attacker =
      selectedZone === null ? null : gs?.me.monsterZones[selectedZone];
    if (!attacker) return;
    send({
      type: "attack",
      attackerInstanceId: attacker.instanceId,
      ...target,
    });
    setSelectedZone(null);
  };

  return {
    board: {
      selectedCard,
      selectedZone,
      payIndices,
      onSetSelectedCard: setSelectedCard,
      onSetSelectedZone: setSelectedZone,
      onSetPayIndices: setPayIndices,
      onAttackMonster: (targetInstanceId: string) =>
        attack({ targetInstanceId }),
      onDirectAttack: () => attack({ direct: true }),
      /** Le paiement passe en argument : l'état payIndices n'est pas encore à jour. */
      /** La zone vient de l'appel quand la sélection n'est pas encore à jour. */
      onSummon: (
        paymentIndices: number[] = payIndices,
        zoneIndex: number | null = selectedZone,
      ) => {
        if (zoneIndex !== null) summonAt(zoneIndex, paymentIndices, false);
      },
      /** Relève : les alliés Pipou envoyés au cimetière remplacent le paiement. */
      onSummonReleve: (zoneIndex: number, releveInstanceIds: string[]) => {
        if (selectedCard === null) return;
        send({
          type: "summon",
          handIndex: selectedCard,
          zoneIndex,
          paymentHandIndices: [],
          releveInstanceIds,
        });
        clearSelection();
      },
      onSummonZeta: (
        zoneIndex: number,
        paymentIndices: number[] = payIndices,
      ) => summonAt(zoneIndex, paymentIndices, true),
      onEvolve: (
        targetInstanceId: string,
        paymentIndices: number[] = payIndices,
      ) => {
        if (selectedCard === null) return;
        send({
          type: "evolve",
          handIndex: selectedCard,
          targetInstanceId,
          paymentHandIndices: paymentIndices,
        });
        clearSelection();
      },
      onPlaySupport: (
        handIndex: number,
        zoneIndex?: number,
        targetInstanceId?: string,
      ) => {
        send({
          type: "play_support",
          handIndex,
          ...(zoneIndex !== undefined && { zoneIndex }),
          ...(targetInstanceId !== undefined && { targetInstanceId }),
        });
        clearSelection();
      },
      onChangeMode: (instanceId: string, mode: CombatMode) =>
        send({ type: "change_mode", instanceId, mode }),
      onRecycleSupport: (handIndex: number) =>
        send({ type: "recycle", handIndex }),
      onTransform: (handIndex: number) =>
        send({ type: "transform", handIndex }),
      onDiscardCard: (handIndex: number) =>
        send({ type: "discard", handIndex }),
      onEndPhase: () => send({ type: "end_phase" }),
    },
    pickCards: (instanceIds: string[]) =>
      send({ type: "pick_cards", instanceIds }),
    decideMulligan: (redraw: boolean) => send({ type: "mulligan", redraw }),
    clearSelection,
  };
}
