import type {
  CardInstance,
  GameState,
  MonsterOnBoard,
  PlayerGameState,
} from '../interfaces/game-state.interface';
import { createMonsterOnBoard } from './monster.factory';
import { boardCard, sendToGraveyard } from './game-state.helper';

/** Part minimale des PV max qu'un monstre garde en évoluant, même très blessé. */
export const EVOLUTION_MIN_HP_RATIO = 0.5;

/**
 * PV du monstre évolué : la même part de ses PV max que l'ancien, au moins
 * EVOLUTION_MIN_HP_RATIO. Les PV de l'ancien compris les bonus de PV du moment.
 */
export function evolvedHp(base: MonsterOnBoard, evolvedMaxHp: number): number {
  const baseMax = base.card.baseCard.hp + base.hpBuff;
  const ratio = baseMax > 0 ? base.currentHp / baseMax : 1;
  return Math.ceil(
    Math.min(1, Math.max(EVOLUTION_MIN_HP_RATIO, ratio)) * evolvedMaxHp,
  );
}

/**
 * Remplace le monstre de la zone par son évolution, en gardant équipements,
 * Garde et attaques du tour. L'ancien monstre rejoint le cimetière.
 */
export function evolveInPlace(
  game: GameState,
  player: PlayerGameState,
  zoneIndex: number,
  evolvedCard: CardInstance,
  log: string[],
): MonsterOnBoard {
  const base = player.monsterZones[zoneIndex]!;
  const evolved = createMonsterOnBoard(evolvedCard, {
    ownerUserId: base.ownerUserId,
  });
  evolved.equipments = base.equipments;
  evolved.currentHp = evolvedHp(base, evolvedCard.baseCard.hp);
  evolved.mode = base.mode;
  // La Garde continue : même compteur, même verrou, même délai de retour
  evolved.guardTurns = base.guardTurns;
  evolved.guardLocked = base.guardLocked;
  evolved.guardCooldown = base.guardCooldown;
  // Compte comme posé ce tour : pas de réévolution immédiate (n'empêche pas d'attaquer)
  evolved.summonedThisTurn = true;
  evolved.attacksUsedThisTurn = base.attacksUsedThisTurn;
  evolved.hasAttackedThisTurn = base.hasAttackedThisTurn;

  sendToGraveyard(player, boardCard(base));
  player.monsterZones[zoneIndex] = evolved;
  game.pendingEvents.push({
    kind: 'monster_summoned',
    ownerId: player.userId,
    zoneIndex,
    instanceId: evolved.instanceId,
    rarity: evolvedCard.baseCard.rarity,
  });
  log.push(
    `🧬 ${base.card.baseCard.name} évolue en ${evolvedCard.baseCard.name}`,
  );
  return evolved;
}
