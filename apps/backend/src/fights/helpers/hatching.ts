import { CardType } from '@pipou/shared';
import type { DrakonStage } from '@pipou/shared';
import type {
  CardInstance,
  ChoiceCandidate,
  GameState,
  MonsterOnBoard,
  PlayerGameState,
} from '../interfaces/game-state.interface';
import { queueChoice, sendToGraveyard } from './game-state.helper';

/** Stade visé, puis les stades inférieurs : un œuf ne se perd jamais pour rien. */
const FALLBACK: Partial<Record<DrakonStage, DrakonStage[]>> = {
  adult: ['adult', 'young', 'baby'],
  young: ['young', 'baby'],
  baby: ['baby'],
};

function hatchCandidates(
  owner: PlayerGameState,
  stage: DrakonStage | undefined,
): ChoiceCandidate[] {
  const of = (
    pile: CardInstance[],
    source: 'deck' | 'graveyard',
    s: DrakonStage,
  ): ChoiceCandidate[] =>
    pile
      .filter(
        (c) => c.baseCard.type === CardType.MONSTER && c.baseCard.stage === s,
      )
      .map((c) => ({ instanceId: c.instanceId, baseCard: c.baseCard, source }));
  for (const s of stage ? (FALLBACK[stage] ?? [stage]) : []) {
    const found = [
      ...of(owner.deck, 'deck', s),
      ...of(owner.graveyard, 'graveyard', s),
    ];
    if (found.length > 0) return found;
  }
  return [];
}

/**
 * L'œuf quitte le terrain sans être détruit (pas d'ON_DEATH) ; le propriétaire
 * choisit dans son deck ou son cimetière une carte du stade visé (à défaut d'un
 * stade inférieur), invoquée dans la zone libérée.
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
  // Calculé avant l'envoi au cimetière : l'œuf ne se propose pas lui-même
  const candidates = hatchCandidates(owner, egg.hatchStage);
  sendToGraveyard(owner, ...egg.equipments, egg.card);

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
