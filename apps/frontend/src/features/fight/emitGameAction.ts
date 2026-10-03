import type { GameAction } from "@pipou/shared";
import type { FightClientSocket } from "./fight.types";

/** Traduit une action de jeu en événement du namespace /fight. */
export function emitGameAction(
  socket: Pick<FightClientSocket, "emit">,
  matchId: number,
  action: GameAction,
): void {
  switch (action.type) {
    case "mulligan":
      socket.emit("fight:mulligan", { matchId, redraw: action.redraw });
      return;
    case "end_phase":
      socket.emit("fight:end_phase", { matchId });
      return;
    case "summon":
      socket.emit("fight:summon", {
        matchId,
        handIndex: action.handIndex,
        zoneIndex: action.zoneIndex,
        paymentHandIndices: action.paymentHandIndices,
        ...(action.onOpponentSide && { onOpponentSide: true }),
      });
      return;
    case "play_support":
      socket.emit("fight:play_support", {
        matchId,
        handIndex: action.handIndex,
        ...(action.zoneIndex !== undefined && { zoneIndex: action.zoneIndex }),
        ...(action.targetInstanceId !== undefined && {
          targetInstanceId: action.targetInstanceId,
        }),
      });
      return;
    case "recycle":
      socket.emit("fight:recycle_support", {
        matchId,
        handIndex: action.handIndex,
      });
      return;
    case "change_mode":
      socket.emit("fight:change_mode", {
        matchId,
        instanceId: action.instanceId,
        mode: action.mode,
      });
      return;
    case "attack":
      socket.emit("fight:attack", {
        matchId,
        attackerInstanceId: action.attackerInstanceId,
        ...(action.targetInstanceId !== undefined && {
          targetInstanceId: action.targetInstanceId,
        }),
        ...(action.direct && { direct: true }),
      });
      return;
    case "discard":
      socket.emit("fight:discard", { matchId, handIndex: action.handIndex });
      return;
    case "pick_cards":
      socket.emit("fight:pick_cards", {
        matchId,
        instanceIds: action.instanceIds,
      });
      return;
  }
}
