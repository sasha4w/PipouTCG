import { Injectable } from '@nestjs/common';
import {
  CardEffect,
  EffectTrigger,
  ConditionType,
  ActionType,
  EffectTarget,
} from '../cards/interfaces/card-effect.interface';
import { Archetype } from '../cards/enums/archetype.enum';
import {
  GameState,
  PlayerGameState,
  MonsterOnBoard,
  CardInstance,
} from './interfaces/game-state.interface';

// ─── Context ─────────────────────────────────────────

export interface EffectContext {
  game: GameState;
  ownerUserId: number;
  sourceMonster?: MonsterOnBoard;
  targetMonster?: MonsterOnBoard;
  log: string[];
}

@Injectable()
export class EffectsResolverService {
  resolve(
    card: CardInstance,
    trigger: EffectTrigger,
    ctx: EffectContext,
  ): boolean {
    const effects = card.baseCard.effects;
    if (!effects?.length) return false;

    let changed = false;

    for (const effect of effects) {
      if (effect.trigger !== trigger) continue;

      if (this.checkCondition(effect, ctx)) {
        this.applyActions(effect, card, ctx);
        changed = true;
      }
    }

    return changed;
  }

  // ═══════════════════════════════════════════════════
  // CONDITIONS
  // ═══════════════════════════════════════════════════

  private checkCondition(effect: CardEffect, ctx: EffectContext): boolean {
    if (!effect.condition) return true;

    const owner = this.owner(ctx);
    const opponent = this.opponent(ctx);

    switch (effect.condition.type) {
      case ConditionType.ARCHETYPE_ON_BOARD: {
        const arch = effect.condition.value as Archetype;
        return owner.monsterZones.some(
          (m) => m && m.card.baseCard.archetype === arch,
        );
      }

      case ConditionType.HP_BELOW:
        return (
          !!ctx.sourceMonster &&
          ctx.sourceMonster.currentHp < (effect.condition.value as number)
        );

      case ConditionType.HAND_SIZE_MIN:
        return owner.hand.length >= (effect.condition.value as number);

      case ConditionType.OPPONENT_HAS_NO_MONSTERS:
        return opponent.monsterZones.every((z) => z === null);

      default:
        return true;
    }
  }

  // ═══════════════════════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════════════════════

  private applyActions(
    effect: CardEffect,
    card: CardInstance,
    ctx: EffectContext,
  ): void {
    for (const action of effect.actions) {
      const targets = this.resolveTargets(action.target, ctx);

      switch (action.type) {
        case ActionType.DEAL_DAMAGE: {
          const dmg = action.value ?? 0;

          for (const target of targets.monsters) {
            target.currentHp -= dmg;

            ctx.log.push(
              `✨ ${card.baseCard.name} inflige ${dmg} à ${target.card.baseCard.name}`,
            );

            if (target.currentHp <= 0) {
              this.killMonster(
                target.instanceId,
                targets.ownerOfMonster(target),
                ctx,
              );
            }
          }

          for (const p of targets.players) {
            if (p.primes > 0 && p.primeDeck.length > 0) {
              const prime = p.primeDeck.shift()!;
              p.primes--;
              p.banished.push(prime);

              ctx.log.push(
                `💥 ${card.baseCard.name} détruit une Prime de ${p.username}`,
              );
            }
          }

          break;
        }

        case ActionType.HEAL: {
          const value = action.value ?? 0;

          for (const target of targets.monsters) {
            const maxHp = target.card.baseCard.hp + target.hpBuff;

            target.currentHp = Math.min(target.currentHp + value, maxHp);

            ctx.log.push(
              `💚 ${card.baseCard.name} soigne ${target.card.baseCard.name}`,
            );
          }

          break;
        }

        case ActionType.BUFF_ATK:
          for (const target of targets.monsters) {
            target.atkBuff += action.value ?? 0;
          }
          break;

        case ActionType.BUFF_HP:
          for (const target of targets.monsters) {
            const v = action.value ?? 0;
            target.hpBuff += v;
            target.currentHp += v;
          }
          break;

        case ActionType.DRAW:
          for (const p of targets.players) {
            const draw = p.deck.shift();
            if (draw) p.hand.push(draw);
          }
          break;

        case ActionType.DESTROY_MONSTER:
          for (const target of targets.monsters) {
            this.killMonster(
              target.instanceId,
              targets.ownerOfMonster(target),
              ctx,
            );
          }
          break;

        case ActionType.STEAL_PRIME: {
          const owner = this.owner(ctx);
          const opp = this.opponent(ctx);

          if (opp.primes > 0 && opp.primeDeck.length > 0) {
            const prime = opp.primeDeck.shift()!;
            opp.primes--;
            owner.hand.push(prime);

            ctx.log.push(`🏆 ${card.baseCard.name} vole une Prime`);
          }
          break;
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════
  // TARGETS
  // ═══════════════════════════════════════════════════

  private resolveTargets(target: EffectTarget, ctx: EffectContext) {
    const owner = this.owner(ctx);
    const opponent = this.opponent(ctx);

    const allies = owner.monsterZones.filter(
      (m): m is MonsterOnBoard => m !== null,
    );
    const enemies = opponent.monsterZones.filter(
      (m): m is MonsterOnBoard => m !== null,
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
    }

    return {
      monsters,
      players,
      ownerOfMonster: (m: MonsterOnBoard) => map.get(m.instanceId) ?? owner,
    };
  }

  // ═══════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════

  private owner(ctx: EffectContext): PlayerGameState {
    return ctx.game.player1.userId === ctx.ownerUserId
      ? ctx.game.player1
      : ctx.game.player2;
  }

  private opponent(ctx: EffectContext): PlayerGameState {
    return ctx.game.player1.userId === ctx.ownerUserId
      ? ctx.game.player2
      : ctx.game.player1;
  }

  private killMonster(
    instanceId: string,
    owner: PlayerGameState,
    ctx: EffectContext,
  ) {
    const idx = owner.monsterZones.findIndex(
      (m) => m?.instanceId === instanceId,
    );
    if (idx === -1) return;

    const monster = owner.monsterZones[idx]!;

    owner.graveyard.push(...monster.equipments, monster.card);
    owner.monsterZones[idx] = null;

    // draw
    const draw = owner.deck.shift();
    if (draw) owner.hand.push(draw);

    // trigger death
    this.resolve(monster.card, EffectTrigger.ON_DEATH, {
      ...ctx,
      ownerUserId: owner.userId,
      sourceMonster: monster,
    });
  }
}
