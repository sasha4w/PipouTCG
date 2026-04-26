import {
  CardEffect,
  ActionType,
  EffectTrigger,
} from '../../cards/interfaces/card-effect.interface';
import {
  CardInstance,
  MonsterOnBoard,
  PlayerGameState,
  ChoiceCandidate,
} from '../interfaces/game-state.interface';
import { EffectContext } from './effect-context.interface';
import { resolveTargets } from './effect-targets.resolver';

/**
 * Applies all actions of a single CardEffect.
 * Calls `resolveOnDeath` recursively for kills triggered by effects.
 */
export function applyActions(
  effect: CardEffect,
  card: CardInstance,
  ctx: EffectContext,
  resolveOnDeath: (instanceId: string, owner: PlayerGameState, ctx: EffectContext) => void,
): void {
  for (const action of effect.actions) {
    const targets = resolveTargets(action.target, ctx);

    switch (action.type) {
      // ── Damage ────────────────────────────────────────────────────────────
      case ActionType.DEAL_DAMAGE: {
        const dmg = action.value ?? 0;
        for (const target of targets.monsters) {
          const reduced = target.damageReduction
            ? Math.ceil(dmg / target.damageReduction)
            : dmg;
          target.currentHp -= reduced;
          ctx.log.push(`✨ ${card.baseCard.name} inflige ${dmg} à ${target.card.baseCard.name}`);
          if (target.currentHp <= 0) {
            resolveOnDeath(target.instanceId, targets.ownerOfMonster(target), ctx);
          }
        }
        for (const p of targets.players) {
          if (p.primes > 0 && p.primeDeck.length > 0) {
            const prime = p.primeDeck.shift()!;
            p.primes--;
            p.banished.push(prime);
            ctx.log.push(`💥 ${card.baseCard.name} détruit une Prime de ${p.username}`);
          }
        }
        break;
      }

      // ── Heal ─────────────────────────────────────────────────────────────
      case ActionType.HEAL: {
        const value = action.value ?? 0;
        for (const target of targets.monsters) {
          const maxHp = target.card.baseCard.hp + target.hpBuff;
          target.currentHp = Math.min(target.currentHp + value, maxHp);
          ctx.log.push(`💚 ${card.baseCard.name} soigne ${target.card.baseCard.name}`);
        }
        break;
      }

      // ── Stat buffs ────────────────────────────────────────────────────────
      case ActionType.BUFF_ATK:
        for (const target of targets.monsters) target.atkBuff += action.value ?? 0;
        break;

      case ActionType.BUFF_HP:
        for (const target of targets.monsters) {
          const v = action.value ?? 0;
          target.hpBuff += v;
          target.currentHp += v;
        }
        break;

      case ActionType.BUFF_ATK_TEMP:
        for (const target of targets.monsters) {
          if (target.isImmuneToDebuffs && (action.value ?? 0) < 0) continue;
          target.tempAtkBuff = (target.tempAtkBuff ?? 0) + (action.value ?? 0);
          ctx.log.push(
            `⚡ ${card.baseCard.name} booste temporairement ${target.card.baseCard.name} (+${action.value} ATK)`,
          );
        }
        break;

      // ── Draw ──────────────────────────────────────────────────────────────
      case ActionType.DRAW:
        for (const p of targets.players) {
          const draw = p.deck.shift();
          if (draw) p.hand.push(draw);
        }
        break;

      // ── Destroy ───────────────────────────────────────────────────────────
      case ActionType.DESTROY_MONSTER:
        for (const target of targets.monsters) {
          resolveOnDeath(target.instanceId, targets.ownerOfMonster(target), ctx);
        }
        break;

      // ── Steal prime ───────────────────────────────────────────────────────
      case ActionType.STEAL_PRIME: {
        const owner = ctx.game.player1.userId === ctx.ownerUserId ? ctx.game.player1 : ctx.game.player2;
        const opp = ctx.game.player1.userId === ctx.ownerUserId ? ctx.game.player2 : ctx.game.player1;
        if (opp.primes > 0 && opp.primeDeck.length > 0) {
          const prime = opp.primeDeck.shift()!;
          opp.primes--;
          owner.hand.push(prime);
          ctx.log.push(`🏆 ${card.baseCard.name} vole une Prime`);
        }
        break;
      }

      // ── Flags ─────────────────────────────────────────────────────────────
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
          ctx.log.push(`🏹 ${card.baseCard.name} peut attaquer ${action.value} fois par tour`);
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

      case ActionType.SET_DAMAGE_REDUCTION:
        if (ctx.sourceMonster) {
          ctx.sourceMonster.damageReduction = action.value ?? 1;
          ctx.log.push(`🛡️ ${card.baseCard.name} réduit les dégâts de moitié`);
        }
        break;

      case ActionType.SET_FREE_SUMMON:
        for (const p of targets.players) {
          p.freeSummonAvailable = true;
          ctx.log.push(`⚡ Chevalier Touille peut être invoqué gratuitement !`);
        }
        break;

      case ActionType.GAIN_RECYCLE_ENERGY:
        for (const p of targets.players) {
          p.recycleEnergy += action.value ?? 0;
          ctx.log.push(`♻️ ${p.username} gagne ${action.value} énergie de recyclage`);
        }
        break;

      // ── Interactive picks ─────────────────────────────────────────────────
      case ActionType.RETURN_FROM_GRAVEYARD: {
        const filter = action.filter;
        const count = action.value ?? 1;
        for (const p of targets.players) {
          const candidates: ChoiceCandidate[] = p.graveyard
            .filter((c) => {
              if (filter?.archetype && c.baseCard.archetype !== filter.archetype) return false;
              if (filter?.rarities && !filter.rarities.includes(c.baseCard.rarity)) return false;
              if (filter?.name && c.baseCard.name !== filter.name) return false;
              if (filter?.type && c.baseCard.type !== filter.type) return false;
              return true;
            })
            .map((c) => ({ instanceId: c.instanceId, baseCard: c.baseCard, source: 'graveyard' as const }));

          if (candidates.length === 0) {
            ctx.log.push(`📥 ${p.username} — cimetière vide, aucune carte récupérable`);
          } else {
            ctx.game.pendingChoice = {
              forUserId: p.userId,
              candidates,
              count: Math.min(count, candidates.length),
              prompt: `Choisissez ${Math.min(count, candidates.length)} carte(s) à récupérer du cimetière`,
            };
            ctx.log.push(`📥 ${p.username} doit choisir une carte dans son cimetière…`);
          }
        }
        break;
      }

      case ActionType.RETURN_FROM_GRAVEYARD_OR_DECK: {
        const filter = action.filter;
        for (const p of targets.players) {
          const matchFn = (c: CardInstance) => {
            if (filter?.name && c.baseCard.name !== filter.name) return false;
            if (filter?.archetype && c.baseCard.archetype !== filter.archetype) return false;
            if (filter?.rarities && !filter.rarities.includes(c.baseCard.rarity)) return false;
            return true;
          };
          const candidates: ChoiceCandidate[] = [
            ...p.graveyard.filter(matchFn).map((c) => ({ instanceId: c.instanceId, baseCard: c.baseCard, source: 'graveyard' as const })),
            ...p.deck.filter(matchFn).map((c) => ({ instanceId: c.instanceId, baseCard: c.baseCard, source: 'deck' as const })),
          ];
          if (candidates.length === 0) {
            ctx.log.push(`📥 ${p.username} — aucune carte récupérable`);
          } else {
            ctx.game.pendingChoice = {
              forUserId: p.userId, candidates, count: 1,
              prompt: 'Choisissez une carte à récupérer (cimetière ou deck)',
            };
            ctx.log.push(`📥 ${p.username} doit choisir une carte à récupérer…`);
          }
        }
        break;
      }

      case ActionType.SEARCH_DECK: {
        const filter = action.filter;
        for (const p of targets.players) {
          const candidates: ChoiceCandidate[] = p.deck
            .filter((c) => {
              if (filter?.type && c.baseCard.type !== filter.type) return false;
              if (filter?.archetype && c.baseCard.archetype !== filter.archetype) return false;
              if (filter?.rarities && !filter.rarities.includes(c.baseCard.rarity)) return false;
              if (filter?.name && c.baseCard.name !== filter.name) return false;
              return true;
            })
            .map((c) => ({ instanceId: c.instanceId, baseCard: c.baseCard, source: 'deck' as const }));

          if (candidates.length === 0) {
            ctx.log.push(`🔮 ${card.baseCard.name} — aucune carte trouvée dans le deck`);
          } else {
            ctx.game.pendingChoice = {
              forUserId: p.userId, candidates, count: 1,
              prompt: 'Cherchez une carte dans votre deck',
            };
            ctx.log.push(`🔮 ${p.username} cherche dans son deck…`);
          }
        }
        break;
      }
    }
  }
}
