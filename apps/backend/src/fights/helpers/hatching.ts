import { CardType } from '@pipou/shared';
import type { DrakonStage } from '@pipou/shared';
import type {
  GameState,
  MonsterOnBoard,
  PlayerGameState,
} from '../interfaces/game-state.interface';
import { queueChoice, sendToGraveyard } from './game-state.helper';

/**
 * L'œuf quitte le terrain sans être détruit (pas d'ON_DEATH) ; le propriétaire
 * choisit dans son deck une carte du stade visé, invoquée dans la zone libérée.
 */
export function hatchEgg(
  game: GameState,
  owner: PlayerGameState,
  egg: MonsterOnBoard,
  log: string[],
): void {
  const zoneIndex = owner.monsterZones.indexOf(egg);
  if (zoneIndex === -1) return;
  owner.monsterZones[zoneIndex] = null;
  sendToGraveyard(owner, ...egg.equipments, egg.card);

  const stage: DrakonStage | undefined = egg.hatchStage;
  const candidates = owner.deck
    .filter(
      (c) => c.baseCard.type === CardType.MONSTER && c.baseCard.stage === stage,
    )
    .map((c) => ({
      instanceId: c.instanceId,
      baseCard: c.baseCard,
      source: 'deck' as const,
    }));
  if (candidates.length === 0) {
    log.push(`🥚 ${egg.card.baseCard.name} éclot… mais aucun Drakon ne répond`);
    return;
  }
  queueChoice(game, {
    forUserId: owner.userId,
    candidates,
    count: 1,
    prompt: 'Choisis le Drakon qui éclot',
    promptKey: 'hatch',
    resolution: 'summon_to_zone',
    fromEgg: true,
    zoneIndex,
  });
  log.push(`🥚 ${egg.card.baseCard.name} éclot !`);
}
