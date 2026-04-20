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
} from './interfaces/game-state.interface';
import { Card } from '../cards/card.entity';

// ─── Context fed into each resolution ────────────────────────────────────────

export interface EffectContext {
  game: GameState;
  /** Player who owns the card triggering the effect. */
  ownerUserId: number;
  /** The monster on board that triggered the effect (nullable for supports). */
  sourceMonster?: MonsterOnBoard;
  /** The monster that was targeted / killed (for ON_ATTACK, ON_DEATH etc.). */
  targetMonster?: MonsterOnBoard;
  /** Accumulated log messages to push back into game.log. */
  log: string[];
}

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class EffectsResolverService {
  /**
   * Resolve all effects on `card` that match the given `trigger`.
   * Returns a flag indicating whether the game state changed so the caller
   * can decide whether to re-emit.
   */
  resolve(
    card: Card,
    trigger: EffectTrigger,
    ctx: EffectContext,
  ): boolean {
    if (!card.effects?.length) return false;

    const matching = card.effects.filter((e) => e.trigger === trigger);
    if (!matching.length) return false;

    let changed = false;
    for (const effect of matching) {
      if (this.checkCondition(effect, ctx)) {
        this.applyActions(effect, card, ctx);
        changed = true;
      }
    }
    return changed;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONDITION CHECK
  // ═══════════════════════════════════════════════════════════════════════════

  private checkCondition(effect: CardEffect, ctx: EffectContext): boolean {
    if (!effect.condition) return true;

    const { type, value } = effect.condition;
    const owner = this.owner(ctx);
    const opponent = this.opponent(ctx);

    switch (type) {
      case ConditionType.ARCHETYPE_ON_BOARD: {
        const arch = value as Archetype;
        return owner.monsterZones.some(
          (m) => m !== null && m.card.archetype === arch,
        );
      }

      case ConditionType.HP_BELOW: {
        if (!ctx.sourceMonster) return false;
        return ctx.sourceMonster.currentHp < (value as number);
      }

      case ConditionType.HAND_SIZE_MIN: {
        return owner.hand.length >= (value as number);
      }

      case ConditionType.OPPONENT_HAS_NO_MONSTERS: {
        return opponent.monsterZones.every((z) => z === null);
      }

      default:
        return true;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTION APPLICATION
  // ═══════════════════════════════════════════════════════════════════════════

  private applyActions(
    effect: CardEffect,
    card: Card,
    ctx: EffectContext,
  ): void {
    for (const action of effect.actions) {
      const targets = this.resolveTargets(action.target, ctx);

      switch (action.type) {
        // ── Damage ─────────────────────────────────────────────────────────
        case ActionType.DEAL_DAMAGE: {
          const dmg = action.value ?? 0;
          for (const target of targets.monsters) {
            target.currentHp -= dmg;
            ctx.log.push(
              `✨ ${card.name} inflige ${dmg} dégâts à ${target.card.name} (${target.currentHp}HP)`,
            );
            // Kill if hp <= 0
            if (target.currentHp <= 0) {
              this.killMonster(target.instanceId, targets.ownerOfMonster(target), ctx);
            }
          }
          // Direct damage to player
          for (const pState of targets.players) {
            if (pState.primes > 0 && pState.primeDeck.length > 0) {
              const banished = pState.primeDeck.shift()!;
              pState.banished.push(banished);
              pState.primes -= 1;
              ctx.log.push(
                `✨ ${card.name} bannit 1 Prime de ${pState.username} (${pState.primes} restantes)`,
              );
            }
          }
          break;
        }

        // ── Heal ───────────────────────────────────────────────────────────
        case ActionType.HEAL: {
          const hp = action.value ?? 0;
          for (const target of targets.monsters) {
            const maxHp = target.card.hp + target.hpBuff;
            target.currentHp = Math.min(target.currentHp + hp, maxHp);
            ctx.log.push(
              `💚 ${card.name} soigne ${target.card.name} de ${hp} HP (${target.currentHp}HP)`,
            );
          }
          break;
        }

        // ── Draw ───────────────────────────────────────────────────────────
        case ActionType.DRAW: {
          const count = action.value ?? 1;
          for (const pState of targets.players) {
            for (let i = 0; i < count; i++) {
              const drawn = pState.deck.shift();
              if (drawn) pState.hand.push(drawn);
            }
            ctx.log.push(`✨ ${card.name} → ${pState.username} pioche ${count} carte(s)`);
          }
          break;
        }

        // ── ATK Buff ───────────────────────────────────────────────────────
        case ActionType.BUFF_ATK: {
          const buff = action.value ?? 0;
          for (const target of targets.monsters) {
            target.atkBuff += buff;
            ctx.log.push(
              `⬆️ ${card.name} booste l'ATK de ${target.card.name} de +${buff}`,
            );
          }
          break;
        }

        // ── HP Buff ────────────────────────────────────────────────────────
        case ActionType.BUFF_HP: {
          const buff = action.value ?? 0;
          for (const target of targets.monsters) {
            target.hpBuff += buff;
            target.currentHp += buff;
            ctx.log.push(
              `⬆️ ${card.name} booste les HP de ${target.card.name} de +${buff}`,
            );
          }
          break;
        }

        // ── Steal Prime ────────────────────────────────────────────────────
        case ActionType.STEAL_PRIME: {
          const ownerState = this.owner(ctx);
          const oppState = this.opponent(ctx);
          if (oppState.primes > 0 && oppState.primeDeck.length > 0) {
            const primeCard = oppState.primeDeck.shift()!;
            oppState.primes -= 1;
            ownerState.hand.push(primeCard);
            ctx.log.push(
              `🏆 ${card.name} vole une Prime à ${oppState.username} ! (${oppState.primes} restantes)`,
            );
          }
          break;
        }

        // ── Destroy Monster ────────────────────────────────────────────────
        case ActionType.DESTROY_MONSTER: {
          for (const target of targets.monsters) {
            ctx.log.push(`💀 ${card.name} détruit ${target.card.name} !`);
            this.killMonster(target.instanceId, targets.ownerOfMonster(target), ctx);
          }
          break;
        }

        // ── Return to Hand ─────────────────────────────────────────────────
        case ActionType.RETURN_TO_HAND: {
          for (const target of targets.monsters) {
            const ownerState = targets.ownerOfMonster(target);
            const idx = ownerState.monsterZones.findIndex(
              (m) => m?.instanceId === target.instanceId,
            );
            if (idx !== -1) {
              ownerState.hand.push(target.card);
              target.equipments.forEach((eq) => ownerState.graveyard.push(eq));
              ownerState.monsterZones[idx] = null;
              ctx.log.push(
                `↩️ ${card.name} renvoie ${target.card.name} dans la main de ${ownerState.username}`,
              );
            }
          }
          break;
        }

        // ── Discard ────────────────────────────────────────────────────────
        case ActionType.DISCARD: {
          const count = action.value ?? 1;
          for (const pState of targets.players) {
            for (let i = 0; i < count && pState.hand.length > 0; i++) {
              const discarded = pState.hand.pop()!;
              pState.graveyard.push(discarded);
              ctx.log.push(`🗑️ ${card.name} force ${pState.username} à défausser ${discarded.name}`);
            }
          }
          break;
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TARGET RESOLUTION
  // ═══════════════════════════════════════════════════════════════════════════

  private resolveTargets(
    target: EffectTarget,
    ctx: EffectContext,
  ): {
    monsters: MonsterOnBoard[];
    players: PlayerGameState[];
    ownerOfMonster: (m: MonsterOnBoard) => PlayerGameState;
  } {
    const owner = this.owner(ctx);
    const opponent = this.opponent(ctx);

    const allyMonsters = owner.monsterZones.filter((m): m is MonsterOnBoard => m !== null);
    const enemyMonsters = opponent.monsterZones.filter((m): m is MonsterOnBoard => m !== null);

    let monsters: MonsterOnBoard[] = [];
    let players: PlayerGameState[] = [];
    const monsterOwnerMap = new Map<string, PlayerGameState>();

    const registerMonsters = (list: MonsterOnBoard[], ownerState: PlayerGameState) => {
      list.forEach((m) => monsterOwnerMap.set(m.instanceId, ownerState));
    };

    switch (target) {
      case EffectTarget.SELF:
        if (ctx.sourceMonster) {
          monsters = [ctx.sourceMonster];
          registerMonsters(monsters, owner);
        }
        break;

      case EffectTarget.ALLY_MONSTER:
        // Pick a random ally (excluding self) — for deterministic effects
        // a more complex system would ask the client to choose
        monsters = allyMonsters.filter(
          (m) => m.instanceId !== ctx.sourceMonster?.instanceId,
        );
        registerMonsters(monsters, owner);
        monsters = monsters.slice(0, 1); // first available
        break;

      case EffectTarget.ALL_ALLIES:
        monsters = allyMonsters;
        registerMonsters(monsters, owner);
        break;

      case EffectTarget.ENEMY_MONSTER:
        if (ctx.targetMonster) {
          monsters = [ctx.targetMonster];
          registerMonsters(monsters, opponent);
        } else {
          // Pick first enemy
          const first = enemyMonsters[0];
          if (first) {
            monsters = [first];
            registerMonsters(monsters, opponent);
          }
        }
        break;

      case EffectTarget.ALL_ENEMIES:
        monsters = enemyMonsters;
        registerMonsters(monsters, opponent);
        break;

      case EffectTarget.PLAYER:
        players = [owner];
        break;

      case EffectTarget.OPPONENT:
        players = [opponent];
        break;

      case EffectTarget.ARCHETYPE_ALLIES: {
        // Affects all allies of the same archetype as the source
        const arch = ctx.sourceMonster?.card.archetype;
        if (arch) {
          monsters = allyMonsters.filter((m) => m.card.archetype === arch);
          registerMonsters(monsters, owner);
        }
        break;
      }
    }

    return {
      monsters,
      players,
      ownerOfMonster: (m) => monsterOwnerMap.get(m.instanceId) ?? owner,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private owner(ctx: EffectContext): PlayerGameState {
    const g = ctx.game;
    return g.player1.userId === ctx.ownerUserId ? g.player1 : g.player2;
  }

  private opponent(ctx: EffectContext): PlayerGameState {
    const g = ctx.game;
    return g.player1.userId === ctx.ownerUserId ? g.player2 : g.player1;
  }

  private killMonster(
    instanceId: string,
    ownerState: PlayerGameState,
    ctx: EffectContext,
  ): void {
    const idx = ownerState.monsterZones.findIndex(
      (m) => m?.instanceId === instanceId,
    );
    if (idx === -1) return;
    const monster = ownerState.monsterZones[idx]!;
    ownerState.graveyard.push(...monster.equipments, monster.card);
    ownerState.monsterZones[idx] = null;

    // Survival draw
    const drawn = ownerState.deck.shift();
    if (drawn) {
      ownerState.hand.push(drawn);
      ctx.log.push(`${ownerState.username} pioche une carte (survie)`);
    }

    // Trigger ON_DEATH for the killed monster
    this.resolve(monster.card, EffectTrigger.ON_DEATH, {
      ...ctx,
      ownerUserId: ownerState.userId,
      sourceMonster: monster,
    });
  }
}
