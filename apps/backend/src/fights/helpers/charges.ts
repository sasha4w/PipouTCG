import { ChargeMode, SupportType } from '@pipou/shared';
import type {
  CardInstance,
  GameState,
  PlayerGameState,
} from '../interfaces/game-state.interface';
import { sendToGraveyard } from './game-state.helper';

export type ChargeOutcome = 'resolved' | 'fizzled';

/**
 * Ajoute des compteurs à une Charge posée par `player`. À `chargeMax`,
 * `resolveCharged` exécute ON_CHARGED ; une Charge CYCLIC repart de 0. Si
 * l'effet ouvre un choix, la carte attend sur sa case qu'il soit résolu
 * (`finishCharge` depuis PickService) ; sinon elle se termine aussitôt.
 */
export function addChargeCounters(
  game: GameState,
  player: PlayerGameState,
  charge: CardInstance,
  amount: number,
  resolveCharged: (card: CardInstance) => ChargeOutcome,
  log: string[],
): void {
  const zoneIndex = player.supportZones.indexOf(charge);
  const max = charge.baseCard.chargeMax ?? 1;
  if (zoneIndex === -1 || charge.baseCard.supportType !== SupportType.CHARGE)
    return;
  // Une Charge pleine qui attend un choix ne se recharge pas
  if (awaitingChoice(game, charge)) return;
  charge.chargeCounters = Math.min(max, (charge.chargeCounters ?? 0) + amount);
  game.pendingEvents.push({
    kind: 'charge_progress',
    ownerId: player.userId,
    zoneIndex,
    instanceId: charge.instanceId,
    counters: charge.chargeCounters,
    max,
  });
  if (charge.chargeCounters < max) return;
  log.push(`⚡ ${charge.baseCard.name} est chargée !`);
  // Cyclique : l'effet se joue, la carte reste et recommence à 0
  if (charge.baseCard.chargeMode === ChargeMode.CYCLIC)
    charge.chargeCounters = 0;
  const outcome = resolveCharged(charge);
  if (awaitingChoice(game, charge)) return;
  finishCharge(game, player, charge, outcome, log);
}

function awaitingChoice(game: GameState, charge: CardInstance): boolean {
  return game.pendingChoices.some(
    (c) => c.chargeInstanceId === charge.instanceId,
  );
}

/**
 * Fin de l'activation : l'événement porte l'issue (animation du client), puis
 * une Charge ONE_SHOT part au cimetière.
 */
export function finishCharge(
  game: GameState,
  player: PlayerGameState,
  charge: CardInstance,
  outcome: ChargeOutcome,
  log: string[],
): void {
  const zoneIndex = player.supportZones.indexOf(charge);
  if (zoneIndex === -1) return;
  const stays = charge.baseCard.chargeMode === ChargeMode.CYCLIC;
  if (outcome === 'fizzled')
    log.push(`💨 ${charge.baseCard.name} se dissipe sans effet`);
  game.pendingEvents.push({
    kind: 'charge_triggered',
    ownerId: player.userId,
    zoneIndex,
    instanceId: charge.instanceId,
    outcome,
    stays,
  });
  if (stays) return;
  player.supportZones[zoneIndex] = null;
  sendToGraveyard(player, charge);
}

export function chargesOf(player: PlayerGameState): CardInstance[] {
  return player.supportZones.filter(
    (z): z is CardInstance =>
      !!z && z.baseCard.supportType === SupportType.CHARGE,
  );
}
