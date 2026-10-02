import { CardEffect, ActionType } from '@pipou/shared';
import {
  CardInstance,
  MonsterOnBoard,
  PlayerGameState,
  ChoiceCandidate,
} from '../interfaces/game-state.interface';
import { EffectContext } from './effect-context.interface';
import { resolveTargets } from './effect-targets.resolver';
import { drawCard, queueChoice } from '../helpers/game-state.helper';

export function applyActions(
  effect: CardEffect,
  card: CardInstance,
  ctx: EffectContext,
  destroy: (host: PlayerGameState, instanceId: string) => void,
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
          ctx.log.push(
            `✨ ${card.baseCard.name} inflige ${dmg} à ${target.card.baseCard.name}`,
          );
          if (target.currentHp <= 0) {
            destroy(targets.ownerOfMonster(target), target.instanceId);
          }
        }
        break;
      }

      // ── Heal ──────────────────────────────────────────────────────────────
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

      // ── Stat buffs ────────────────────────────────────────────────────────
      case ActionType.BUFF_ATK:
        for (const target of targets.monsters) {
          const v = action.value ?? 0;
          target.perm.atk += v;
          target.atkBuff += v;
        }
        break;

      case ActionType.BUFF_HP:
        for (const target of targets.monsters) {
          const v = action.value ?? 0;
          target.perm.hp += v;
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
          for (let i = 0; i < (action.value ?? 1); i++)
            drawCard(ctx.game, p.userId);
        }
        break;

      case ActionType.DESTROY_MONSTER:
        for (const target of targets.monsters)
          destroy(targets.ownerOfMonster(target), target.instanceId);
        break;

      case ActionType.RETURN_TO_HAND:
        for (const target of targets.monsters)
          returnMonsterToHand(
            target,
            targets.ownerOfMonster(target),
            ctx,
            card,
          );
        break;

      // ── Compteur de tour (Noyau Zeta) ─────────────────────────────────────
      // Initialise un countdown sur sourceMonster.
      // La décrémentation + mort se font dans phase.service.ts.
      case ActionType.SET_TURN_COUNTER:
        if (ctx.sourceMonster) {
          ctx.sourceMonster.turnCounter = action.value ?? 3;
          ctx.log.push(
            `⏳ ${card.baseCard.name} s'autodétruira dans ${ctx.sourceMonster.turnCounter} tour(s)`,
          );
        }
        break;

      case ActionType.FORCE_ATTACK_MODE_ENEMY:
        for (const m of targets.monsters) {
          m.forcedAttackMode = true;
          m.mode = 'attack';
          ctx.log.push(
            `🔒 ${card.baseCard.name} force ${m.card.baseCard.name} en mode Attaque`,
          );
        }
        break;

      // ── Flags ─────────────────────────────────────────────────────────────
      case ActionType.SET_TAUNT:
        for (const m of targets.monsters) {
          m.perm.taunt = true;
          m.hasTaunt = true;
          ctx.log.push(`🛡️ ${m.card.baseCard.name} gagne la Provocation`);
        }
        break;

      case ActionType.SET_PIERCING:
        for (const m of targets.monsters) {
          m.perm.piercing = true;
          m.hasPiercing = true;
          ctx.log.push(`⚔️ ${m.card.baseCard.name} gagne l'Attaque Perçante`);
        }
        break;

      case ActionType.SET_ATTACKS_PER_TURN:
        for (const m of targets.monsters) {
          const v = action.value ?? 1;
          m.perm.attacksPerTurn = v;
          m.attacksPerTurn = v;
          ctx.log.push(
            `🏹 ${m.card.baseCard.name} peut attaquer ${v} fois par tour`,
          );
        }
        break;

      case ActionType.SET_DEBUFF_IMMUNITY:
        for (const m of targets.monsters) {
          m.perm.debuffImmune = true;
          m.isImmuneToDebuffs = true;
          ctx.log.push(`✨ ${m.card.baseCard.name} est immunisé aux débuffs`);
        }
        break;

      case ActionType.FORCE_ATTACK_MODE:
        for (const m of targets.monsters) {
          m.forcedAttackMode = true;
          m.mode = 'attack';
          ctx.log.push(`⚔️ ${m.card.baseCard.name} est forcé en mode Attaque`);
        }
        break;

      case ActionType.SET_DELAY_DOUBLE_ATK:
        for (const m of targets.monsters) {
          m.doubleAtkNextTurn = true;
          ctx.log.push(`⏳ ${m.card.baseCard.name} prépare son double assaut`);
        }
        break;

      case ActionType.CANNOT_ATTACK_ON_SUMMON_TURN:
        for (const m of targets.monsters) m.cannotAttackOnSummonTurn = true;
        break;

      case ActionType.SET_DAMAGE_REDUCTION:
        for (const m of targets.monsters) {
          const v = action.value ?? 2;
          m.perm.damageReduction = Math.max(m.perm.damageReduction ?? 1, v);
          m.damageReduction = Math.max(m.damageReduction ?? 1, v);
          ctx.log.push(
            `🛡️ ${m.card.baseCard.name} divise les dégâts reçus par ${v}`,
          );
        }
        break;

      case ActionType.SET_FREE_SUMMON:
        // La carte source (en main) devient invocable gratuitement
        for (const p of targets.players) {
          if (!p.hand.includes(card)) continue;
          if (p.freeSummonInstanceIds.includes(card.instanceId)) continue;
          p.freeSummonInstanceIds.push(card.instanceId);
          ctx.log.push(
            `⚡ ${card.baseCard.name} peut être invoqué gratuitement !`,
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

      // ── Interactive picks ─────────────────────────────────────────────────
      case ActionType.RETURN_FROM_GRAVEYARD: {
        const filter = action.filter;
        const count = action.value ?? 1;
        for (const p of targets.players) {
          const candidates: ChoiceCandidate[] = p.graveyard
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
              if (
                filter?.name &&
                !c.baseCard.name
                  .toLowerCase()
                  .includes(filter.name.toLowerCase())
              )
                return false;
              if (filter?.type && c.baseCard.type !== filter.type) return false;
              return true;
            })
            .map((c) => ({
              instanceId: c.instanceId,
              baseCard: c.baseCard,
              source: 'graveyard' as const,
            }));

          if (candidates.length === 0) {
            ctx.log.push(
              `📥 ${p.username} — cimetière vide, aucune carte récupérable`,
            );
          } else {
            queueChoice(ctx.game, {
              forUserId: p.userId,
              candidates,
              count: Math.min(count, candidates.length),
              prompt: `Choisissez ${Math.min(count, candidates.length)} carte(s) à récupérer du cimetière`,
              resolution: 'pick_to_hand',
            });
            ctx.log.push(
              `📥 ${p.username} doit choisir une carte dans son cimetière…`,
            );
          }
        }
        break;
      }

      case ActionType.RETURN_FROM_GRAVEYARD_OR_DECK: {
        const filter = action.filter;
        for (const p of targets.players) {
          const matchFn = (c: CardInstance) => {
            if (
              filter?.name &&
              !c.baseCard.name.toLowerCase().includes(filter.name.toLowerCase())
            )
              return false;
            if (filter?.archetype && c.baseCard.archetype !== filter.archetype)
              return false;
            if (
              filter?.rarities &&
              !filter.rarities.includes(c.baseCard.rarity)
            )
              return false;
            return true;
          };
          const candidates: ChoiceCandidate[] = [
            ...p.graveyard.filter(matchFn).map((c) => ({
              instanceId: c.instanceId,
              baseCard: c.baseCard,
              source: 'graveyard' as const,
            })),
            ...p.deck.filter(matchFn).map((c) => ({
              instanceId: c.instanceId,
              baseCard: c.baseCard,
              source: 'deck' as const,
            })),
          ];
          if (candidates.length === 0) {
            ctx.log.push(`📥 ${p.username} — aucune carte récupérable`);
          } else {
            queueChoice(ctx.game, {
              forUserId: p.userId,
              candidates,
              count: 1,
              prompt: 'Choisissez une carte à récupérer (cimetière ou deck)',
              resolution: 'pick_to_hand',
            });
            ctx.log.push(
              `📥 ${p.username} doit choisir une carte à récupérer…`,
            );
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
              if (
                filter?.name &&
                !c.baseCard.name
                  .toLowerCase()
                  .includes(filter.name.toLowerCase())
              )
                return false;
              return true;
            })
            .map((c) => ({
              instanceId: c.instanceId,
              baseCard: c.baseCard,
              source: 'deck' as const,
            }));

          if (candidates.length === 0) {
            ctx.log.push(
              `🔮 ${card.baseCard.name} — aucune carte trouvée dans le deck`,
            );
          } else {
            queueChoice(ctx.game, {
              forUserId: p.userId,
              candidates,
              count: 1,
              prompt: 'Cherchez une carte dans votre deck',
              resolution: 'pick_to_hand',
            });
            ctx.log.push(`🔮 ${p.username} cherche dans son deck…`);
          }
        }
        break;
      }

      case ActionType.BLOCK_ATTACK:
        for (const m of targets.monsters) {
          const turns = action.value ?? 1;
          m.blockAttackTurns = turns;
          ctx.log.push(
            `🧊 ${card.baseCard.name} empêche ${m.card.baseCard.name} d'attaquer pendant ${turns} tour(s)`,
          );
        }
        break;

      case ActionType.FORCE_GUARD_LOCK_ENEMY:
        for (const m of targets.monsters) {
          m.guardLocked = true;
          m.mode = 'guard';
          ctx.log.push(
            `🔒 ${card.baseCard.name} verrouille ${m.card.baseCard.name} en mode Garde`,
          );
        }
        break;

      case ActionType.DISCARD: {
        const count = action.value ?? 1;
        for (const p of targets.players) {
          if (p.hand.length <= count) {
            const discarded = p.hand.splice(0);
            p.graveyard.push(...discarded);
            if (discarded.length > 0)
              ctx.log.push(
                `🗑️ ${p.username} défausse toute sa main (${discarded.length})`,
              );
            continue;
          }
          queueChoice(ctx.game, {
            forUserId: p.userId,
            candidates: p.hand.map((c) => ({
              instanceId: c.instanceId,
              baseCard: c.baseCard,
              source: 'hand' as const,
            })),
            count,
            prompt: `Choisissez ${count} carte(s) à défausser`,
            resolution: 'discard',
          });
          ctx.log.push(`🗑️ ${p.username} doit défausser ${count} carte(s)…`);
        }
        break;
      }
    }
  }
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function returnMonsterToHand(
  monster: MonsterOnBoard,
  owner: PlayerGameState,
  ctx: EffectContext,
  sourceCard: CardInstance,
): void {
  const idx = owner.monsterZones.findIndex(
    (m) => m?.instanceId === monster.instanceId,
  );
  if (idx === -1) return;

  for (const eq of monster.equipments) {
    owner.hand.push(eq);
  }
  owner.hand.push(monster.card);
  owner.monsterZones[idx] = null;

  ctx.log.push(
    `↩️ ${sourceCard.baseCard.name} retourne ${monster.card.baseCard.name} en main` +
      (monster.equipments.length > 0
        ? ` (+ ${monster.equipments.length} équipement(s))`
        : ''),
  );
}
