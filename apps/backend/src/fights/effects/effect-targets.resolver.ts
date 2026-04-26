import {
  EffectTarget,
} from '../../cards/interfaces/card-effect.interface';
import {
  PlayerGameState,
  MonsterOnBoard,
} from '../interfaces/game-state.interface';
import { EffectContext } from './effect-context.interface';

export interface ResolvedTargets {
  monsters: MonsterOnBoard[];
  players: PlayerGameState[];
  ownerOfMonster: (m: MonsterOnBoard) => PlayerGameState;
}

export function resolveTargets(target: EffectTarget, ctx: EffectContext): ResolvedTargets {
  const owner =
    ctx.game.player1.userId === ctx.ownerUserId ? ctx.game.player1 : ctx.game.player2;
  const opponent =
    ctx.game.player1.userId === ctx.ownerUserId ? ctx.game.player2 : ctx.game.player1;

  const allies = owner.monsterZones.filter((m): m is MonsterOnBoard => m !== null);
  const enemies = opponent.monsterZones.filter((m): m is MonsterOnBoard => m !== null);

  const map = new Map<string, PlayerGameState>();
  const register = (list: MonsterOnBoard[], p: PlayerGameState) =>
    list.forEach((m) => map.set(m.instanceId, p));

  let monsters: MonsterOnBoard[] = [];
  let players: PlayerGameState[] = [];

  switch (target) {
    case EffectTarget.SELF:
      if (ctx.sourceMonster) {
        monsters = [ctx.sourceMonster];
        register(monsters, owner);
      }
      break;

    case EffectTarget.ALL_ALLIES:
      monsters = allies;
      register(monsters, owner);
      break;

    case EffectTarget.ALL_ENEMIES:
      monsters = enemies;
      register(monsters, opponent);
      break;

    case EffectTarget.ENEMY_MONSTER:
      if (ctx.targetMonster) {
        monsters = [ctx.targetMonster];
        register(monsters, opponent);
      }
      break;

    case EffectTarget.PLAYER:
      players = [owner];
      break;

    case EffectTarget.OPPONENT:
      players = [opponent];
      break;

    case EffectTarget.ARCHETYPE_ALLIES: {
      const arch = ctx.sourceMonster?.card.baseCard.archetype;
      if (arch) {
        monsters = allies.filter((m) => m.card.baseCard.archetype === arch);
        register(monsters, owner);
      }
      break;
    }

    case EffectTarget.ALLIES_EXCEPT_SELF:
      monsters = allies.filter((m) => m.instanceId !== ctx.sourceMonster?.instanceId);
      register(monsters, owner);
      break;

    case EffectTarget.TARGET_ALLY:
      if (allies.length > 0) {
        monsters = [allies[0]];
        register(monsters, owner);
      }
      break;
  }

  return {
    monsters,
    players,
    ownerOfMonster: (m: MonsterOnBoard) => map.get(m.instanceId) ?? owner,
  };
}
