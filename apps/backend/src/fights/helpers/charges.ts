import { ChargeMode, SupportType } from '@pipou/shared';
import type {
  CardInstance,
  GameState,
  PlayerGameState,
} from '../interfaces/game-state.interface';
import { sendToGraveyard } from './game-state.helper';

/**
 * Ajoute des compteurs à une Charge posée par `player`. À `chargeMax`, la carte
 * quitte sa case, `resolveCharged` exécute ON_CHARGED puis elle part au
 * cimetière (ONE_SHOT) ; une Charge CYCLIC reste en place et repart de 0.
 */
export function addChargeCounters(
  game: GameState,
  player: PlayerGameState,
  charge: CardInstance,
  amount: number,
  resolveCharged: (card: CardInstance) => void,
  log: string[],
): void {
  const zoneIndex = player.supportZones.indexOf(charge);
  const max = charge.baseCard.chargeMax ?? 1;
  if (zoneIndex === -1 || charge.baseCard.supportType !== SupportType.CHARGE)
    return;
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
  game.pendingEvents.push({
    kind: 'charge_triggered',
    ownerId: player.userId,
    zoneIndex,
    instanceId: charge.instanceId,
  });
  if (charge.baseCard.chargeMode === ChargeMode.CYCLIC) {
    // Cyclique : l'effet se joue, la carte reste et recommence à 0
    charge.chargeCounters = 0;
    resolveCharged(charge);
    return;
  }
  player.supportZones[zoneIndex] = null;
  resolveCharged(charge);
  sendToGraveyard(player, charge);
}

export function chargesOf(player: PlayerGameState): CardInstance[] {
  return player.supportZones.filter(
    (z): z is CardInstance =>
      !!z && z.baseCard.supportType === SupportType.CHARGE,
  );
}
