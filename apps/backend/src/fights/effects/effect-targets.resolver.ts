import {
  EffectTarget,
  isImplanted,
  isTargetableByEnemyEffects,
} from '@pipou/shared';
import {
  PlayerGameState,
  MonsterOnBoard,
} from '../interfaces/game-state.interface';
import { effectiveAtk } from '../helpers/game-state.helper';
import { EffectContext } from './effect-context.interface';

export interface ResolvedTargets {
  monsters: MonsterOnBoard[];
  players: PlayerGameState[];
  ownerOfMonster: (m: MonsterOnBoard) => PlayerGameState;
}

export function resolveTargets(
  target: EffectTarget,
  ctx: EffectContext,
  archetype?: string,
): ResolvedTargets {
  const owner =
    ctx.game.player1.userId === ctx.ownerUserId
      ? ctx.game.player1
      : ctx.game.player2;
  const opponent =
    ctx.game.player1.userId === ctx.ownerUserId
      ? ctx.game.player2
      : ctx.game.player1;

  // Un monstre implanté (Zeta) n'est l'allié que de son poseur, jamais de son hôte
  const allies = owner.monsterZones.filter(
    (m): m is MonsterOnBoard => m !== null && !isImplanted(m, owner.userId),
  );
  // Les monstres insensibles aux effets adverses ne sont jamais visés,
  // ni le monstre que le lanceur a lui-même implanté chez l'adversaire
  const enemies = opponent.monsterZones.filter(
    (m): m is MonsterOnBoard =>
      m !== null &&
      isTargetableByEnemyEffects(m) &&
      m.ownerUserId !== owner.userId,
  );

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

    // Cible choisie : monstre visé par un Éphémère, ou attaquant (ON_DEFEND)
    case EffectTarget.ALLY_MONSTER:
    case EffectTarget.TARGET_ALLY:
      if (ctx.targetMonster && allies.includes(ctx.targetMonster)) {
        monsters = [ctx.targetMonster];
        register(monsters, owner);
      }
      break;

    case EffectTarget.ENEMY_MONSTER:
      if (ctx.targetMonster && enemies.includes(ctx.targetMonster)) {
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
      const arch =
        archetype ??
        ctx.sourceMonster?.card.baseCard.archetype ??
        ctx.sourceCard?.baseCard.archetype;
      if (arch) {
        monsters = allies.filter((m) => m.card.baseCard.archetype === arch);
        register(monsters, owner);
      }
      break;
    }

    case EffectTarget.STRONGEST_ENEMY: {
      const strongest = enemies.reduce<MonsterOnBoard | undefined>(
        (best, m) => (!best || effectiveAtk(m) > effectiveAtk(best) ? m : best),
        undefined,
      );
      if (strongest) {
        monsters = [strongest];
        register(monsters, opponent);
      }
      break;
    }

    case EffectTarget.ADJACENT_ALLIES: {
      const idx = ctx.sourceMonster
        ? owner.monsterZones.indexOf(ctx.sourceMonster)
        : -1;
      if (idx !== -1) {
        monsters = [
          owner.monsterZones[idx - 1],
          owner.monsterZones[idx + 1],
        ].filter((m): m is MonsterOnBoard => !!m);
        register(monsters, owner);
      }
      break;
    }

    case EffectTarget.ALLIES_EXCEPT_SELF:
      monsters = allies.filter(
        (m) => m.instanceId !== ctx.sourceMonster?.instanceId,
      );
      register(monsters, owner);
      break;
  }

  return {
    monsters,
    players,
    ownerOfMonster: (m: MonsterOnBoard) => map.get(m.instanceId) ?? owner,
  };
}
