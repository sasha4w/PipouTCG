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
            const reduced = target.damageReduction
              ? Math.ceil(dmg / target.damageReduction)
              : dmg;
            target.currentHp -= reduced;

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
        case ActionType.SET_TAUNT:
          if (ctx.sourceMonster) {
            ctx.sourceMonster.hasTaunt = true;
            ctx.log.push(`🛡️ ${card.baseCard.name} active la Provocation`);
          }
          break;

        case ActionType.SET_PIERCING:
          if (ctx.sourceMonster) {
            ctx.sourceMonster.hasPiercing = true;
            ctx.log.push(`⚔️ ${card.baseCard.name} gagne l'Attaque Perçante`);
          }
          break;

        case ActionType.SET_ATTACKS_PER_TURN:
          if (ctx.sourceMonster) {
            ctx.sourceMonster.attacksPerTurn = action.value ?? 1;
            ctx.log.push(
              `🏹 ${card.baseCard.name} peut attaquer ${action.value} fois par tour`,
            );
          }
          break;

        case ActionType.SET_DEBUFF_IMMUNITY:
          if (ctx.sourceMonster) {
            ctx.sourceMonster.isImmuneToDebuffs = true;
            ctx.log.push(`✨ ${card.baseCard.name} est immunisé aux débuffs`);
          }
          break;

        case ActionType.FORCE_ATTACK_MODE:
          if (ctx.sourceMonster) {
            ctx.sourceMonster.forcedAttackMode = true;
            ctx.sourceMonster.mode = 'attack';
            ctx.log.push(`⚔️ ${card.baseCard.name} est forcé en mode Attaque`);
          }
          break;

        case ActionType.SET_DELAY_DOUBLE_ATK:
          if (ctx.sourceMonster) {
            ctx.sourceMonster.summonedThisTurn = true;
            ctx.sourceMonster.doubleAtkNextTurn = true;
            ctx.log.push(`⏳ ${card.baseCard.name} prépare son double assaut`);
          }
          break;

        case ActionType.BUFF_ATK_TEMP:
          for (const target of targets.monsters) {
            if (target.isImmuneToDebuffs && (action.value ?? 0) < 0) continue;
            target.tempAtkBuff =
              (target.tempAtkBuff ?? 0) + (action.value ?? 0);
            ctx.log.push(
              `⚡ ${card.baseCard.name} booste temporairement ${target.card.baseCard.name} (+${action.value} ATK)`,
            );
          }
          break;

        case ActionType.GAIN_RECYCLE_ENERGY:
          for (const p of targets.players) {
            p.recycleEnergy += action.value ?? 0;
            ctx.log.push(
              `♻️ ${p.username} gagne ${action.value} énergie de recyclage`,
            );
          }
          break;

        case ActionType.RETURN_FROM_GRAVEYARD: {
          const filter = action.filter;
          const count = action.value ?? 1;
          for (const p of targets.players) {
            const candidates = p.graveyard
              .filter((c) => {
                if (
                  filter?.archetype &&
                  c.baseCard.archetype !== filter.archetype
                )
                  return false;
                if (
                  filter?.rarities &&
                  !filter.rarities.includes(c.baseCard.rarity)
                )
                  return false;
                if (filter?.name && c.baseCard.name !== filter.name)
                  return false;
                if (filter?.type && c.baseCard.type !== filter.type)
                  return false;
                return true;
              })
              .slice(0, count);
            for (const c of candidates) {
              p.graveyard.splice(p.graveyard.indexOf(c), 1);
              p.hand.push(c);
            }
            ctx.log.push(
              `📥 ${p.username} récupère ${candidates.length} carte(s) du cimetière`,
            );
          }
          break;
        }

        case ActionType.RETURN_FROM_GRAVEYARD_OR_DECK: {
          const filter = action.filter;
          for (const p of targets.players) {
            const matchFn = (c: CardInstance) => {
              if (filter?.name && c.baseCard.name !== filter.name) return false;
              if (
                filter?.archetype &&
                c.baseCard.archetype !== filter.archetype
              )
                return false;
              if (
                filter?.rarities &&
                !filter.rarities.includes(c.baseCard.rarity)
              )
                return false;
              return true;
            };
            // Cherche d'abord dans le cimetière, sinon dans le deck
            const fromGrave = p.graveyard.find(matchFn);
            if (fromGrave) {
              p.graveyard.splice(p.graveyard.indexOf(fromGrave), 1);
              p.hand.push(fromGrave);
              ctx.log.push(
                `📥 ${p.username} récupère ${fromGrave.baseCard.name} du cimetière`,
              );
            } else {
              const fromDeck = p.deck.find(matchFn);
              if (fromDeck) {
                p.deck.splice(p.deck.indexOf(fromDeck), 1);
                p.hand.push(fromDeck);
                ctx.log.push(
                  `📥 ${p.username} récupère ${fromDeck.baseCard.name} du deck`,
                );
              }
            }
          }
          break;
        }

        case ActionType.SEARCH_DECK: {
          const filter = action.filter;
          for (const p of targets.players) {
            const idx = p.deck.findIndex((c) => {
              if (filter?.type && c.baseCard.type !== filter.type) return false;
              if (
                filter?.archetype &&
                c.baseCard.archetype !== filter.archetype
              )
                return false;
              if (
                filter?.rarities &&
                !filter.rarities.includes(c.baseCard.rarity)
              )
                return false;
              if (filter?.name && c.baseCard.name !== filter.name) return false;
              return true;
            });
            if (idx !== -1) {
              const [found] = p.deck.splice(idx, 1);
              p.hand.push(found);
              p.deck = this.shuffle([...p.deck]);
              ctx.log.push(
                `🔮 ${card.baseCard.name} cherche une carte dans le deck de ${p.username}`,
              );
            }
          }
          break;
        }
        case ActionType.SET_FREE_SUMMON:
          for (const p of targets.players) {
            p.freeSummonAvailable = true;
            ctx.log.push(
              `⚡ Chevalier Touille peut être invoqué gratuitement !`,
            );
          }
          break;
        case ActionType.SET_DAMAGE_REDUCTION:
          if (ctx.sourceMonster) {
            ctx.sourceMonster.damageReduction = action.value ?? 1;
            ctx.log.push(
              `🛡️ ${card.baseCard.name} réduit les dégâts de moitié`,
            );
          }
          break;
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
      case EffectTarget.ALLIES_EXCEPT_SELF:
        monsters = allies.filter(
          (m) => m.instanceId !== ctx.sourceMonster?.instanceId,
        );
        register(monsters, owner);
        break;

      case EffectTarget.TARGET_ALLY:
        // Pour l'instant prend le premier allié disponible
        // À terme : sélection côté client
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
  private shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}
