import { CardType, SupportType } from '@pipou/shared';
import type {
  SandboxDestination,
  SandboxMonsterPatch,
  SandboxSetupCommand,
} from '@pipou/shared';
import type {
  CardInstance,
  GameState,
  PlayerGameState,
} from '../fights/interfaces/game-state.interface';
import { seatPlayer } from '../fights/helpers/game-state.helper';
import { createMonsterOnBoard } from '../fights/helpers/monster.factory';

type Result = { error?: string };

interface Located {
  card: CardInstance;
  /** Retire la carte de sa position actuelle. */
  detach: () => void;
}

/**
 * Outils de mise en place du sandbox : déplacent et éditent sans déclencher
 * d'effet ni payer de coût. L'appelant stabilise ensuite l'état (settle).
 */
export function applySetup(
  game: GameState,
  command: SandboxSetupCommand,
): Result {
  switch (command.type) {
    case 'move_card':
      return moveCard(
        seatPlayer(game, command.seat),
        command.instanceId,
        command.to,
      );
    case 'edit_monster':
      return editMonster(
        seatPlayer(game, command.seat),
        command.instanceId,
        command.patch,
      );
    case 'edit_player': {
      const player = seatPlayer(game, command.seat);
      const { primes, recycleEnergy } = command.patch;
      if (primes !== undefined)
        player.primes = clamp(primes, 0, player.primeDeck.length);
      if (recycleEnergy !== undefined)
        player.recycleEnergy = Math.max(0, recycleEnergy);
      return {};
    }
    case 'edit_game': {
      const { phase, turnNumber, activeSeat } = command.patch;
      if (phase !== undefined) {
        if (phase !== 'main' && phase !== 'battle' && phase !== 'end')
          return { error: 'Phase modifiable : principale, combat ou fin' };
        game.phase = phase;
      }
      if (turnNumber !== undefined) game.turnNumber = Math.max(1, turnNumber);
      if (activeSeat !== undefined)
        game.currentTurnUserId = seatPlayer(game, activeSeat).userId;
      return {};
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Trouve une carte du joueur, où qu'elle soit (main, deck, cimetière, terrain). */
function locate(player: PlayerGameState, instanceId: string): Located | null {
  for (const pile of [player.hand, player.deck, player.graveyard]) {
    const card = pile.find((c) => c.instanceId === instanceId);
    if (card) return { card, detach: () => pile.splice(pile.indexOf(card), 1) };
  }

  for (let i = 0; i < player.monsterZones.length; i++) {
    const monster = player.monsterZones[i];
    if (!monster) continue;
    if (monster.instanceId === instanceId) {
      return {
        card: monster.card,
        detach: () => {
          player.graveyard.push(...monster.equipments);
          player.monsterZones[i] = null;
        },
      };
    }
    const equipment = monster.equipments.find(
      (e) => e.instanceId === instanceId,
    );
    if (equipment) {
      return {
        card: equipment,
        detach: () =>
          monster.equipments.splice(monster.equipments.indexOf(equipment), 1),
      };
    }
  }

  const supportIdx = player.supportZones.findIndex(
    (c) => c?.instanceId === instanceId,
  );
  if (supportIdx !== -1) {
    return {
      card: player.supportZones[supportIdx]!,
      detach: () => {
        player.supportZones[supportIdx] = null;
      },
    };
  }
  return null;
}

/** Erreur si la carte ne peut pas aller à cette destination, sinon null. */
function destinationError(
  player: PlayerGameState,
  card: CardInstance,
  to: SandboxDestination,
): string | null {
  switch (to.zone) {
    case 'monster':
      if (card.baseCard.type !== CardType.MONSTER)
        return 'Seul un Monstre va en zone monstre';
      if (to.index < 0 || to.index > 2) return 'Zone invalide (0-2)';
      if (player.monsterZones[to.index]) return 'Zone monstre occupée';
      return null;
    case 'support':
      if (card.baseCard.supportType !== SupportType.TERRAIN)
        return 'Seul un Terrain va en zone support';
      if (to.index < 0 || to.index > 2) return 'Zone invalide (0-2)';
      if (player.supportZones[to.index]) return 'Zone support occupée';
      return null;
    case 'equipment':
      if (card.baseCard.supportType !== SupportType.EQUIPMENT)
        return "Seul un Équipement s'attache à un monstre";
      if (!player.monsterZones.some((m) => m?.instanceId === to.hostInstanceId))
        return 'Monstre porteur introuvable';
      return null;
    default:
      return null;
  }
}

function moveCard(
  player: PlayerGameState,
  instanceId: string,
  to: SandboxDestination,
): Result {
  const located = locate(player, instanceId);
  if (!located) return { error: 'Carte introuvable chez ce joueur' };
  const error = destinationError(player, located.card, to);
  if (error) return { error };

  located.detach();
  const card = located.card;
  switch (to.zone) {
    case 'hand':
      player.hand.push(card);
      break;
    case 'deck':
      player.deck.splice(clamp(to.index, 0, player.deck.length), 0, card);
      break;
    case 'graveyard':
      player.graveyard.push(card);
      break;
    case 'monster': {
      const monster = createMonsterOnBoard(card);
      monster.mode = to.mode;
      monster.summonedThisTurn = false;
      player.monsterZones[to.index] = monster;
      break;
    }
    case 'support':
      player.supportZones[to.index] = card;
      break;
    case 'equipment':
      player.monsterZones
        .find((m) => m?.instanceId === to.hostInstanceId)!
        .equipments.push(card);
      break;
  }
  return {};
}

function editMonster(
  player: PlayerGameState,
  instanceId: string,
  patch: SandboxMonsterPatch,
): Result {
  const m = player.monsterZones.find((z) => z?.instanceId === instanceId);
  if (!m) return { error: 'Monstre introuvable chez ce joueur' };

  if (patch.atkBonus !== undefined) m.perm.atk = patch.atkBonus;
  if (patch.hpBonus !== undefined) m.perm.hp = patch.hpBonus;
  if (patch.taunt !== undefined) m.perm.taunt = patch.taunt;
  if (patch.piercing !== undefined) m.perm.piercing = patch.piercing;
  if (patch.debuffImmune !== undefined)
    m.perm.debuffImmune = patch.debuffImmune;
  if (patch.damageReduction !== undefined)
    m.perm.damageReduction = patch.damageReduction ?? undefined;
  if (patch.attacksPerTurn !== undefined)
    m.perm.attacksPerTurn = Math.max(1, patch.attacksPerTurn);
  if (patch.mode !== undefined) m.mode = patch.mode;
  if (patch.blockAttackTurns !== undefined)
    m.blockAttackTurns = patch.blockAttackTurns ?? undefined;
  if (patch.summonedThisTurn !== undefined)
    m.summonedThisTurn = patch.summonedThisTurn;
  // Les PV courants s'appliquent en dernier ; le recalcul (settle) les borne au max
  if (patch.currentHp !== undefined) m.currentHp = patch.currentHp;
  return {};
}
