import { CardEffect, ActionType, isPlantedBy } from '@pipou/shared';
import {
  CardInstance,
  MonsterOnBoard,
  PlayerGameState,
} from '../interfaces/game-state.interface';
import { EffectContext } from './effect-context.interface';
import { withConditionalValue } from './effect-conditions';
import { resolveTargets } from './effect-targets.resolver';
import {
  drawCard,
  getOpponentState,
  queueChoice,
} from '../helpers/game-state.helper';
import { pickCandidates } from './pick-candidates';
import { hatchEgg } from '../helpers/hatching';
import { createMonsterOnBoard } from '../helpers/monster.factory';
import { v4 as uuidv4 } from 'uuid';

export type DestroyKind = 'destroy' | 'damage';

export function applyActions(
  effect: CardEffect,
  card: CardInstance,
  ctx: EffectContext,
  destroy: (
    host: PlayerGameState,
    instanceId: string,
    kind: DestroyKind,
  ) => void,
  /** Résout l'ON_SUMMON d'un monstre apparu en jeu (copie). */
  summoned: (owner: PlayerGameState, monster: MonsterOnBoard) => void = () =>
    undefined,
): void {
  for (const rawAction of effect.actions) {
    const action = withConditionalValue(rawAction, ctx);
    const targets = resolveTargets(action.target, ctx, action.archetype);

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
            destroy(
              targets.ownerOfMonster(target),
              target.instanceId,
              'damage',
            );
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
          destroy(targets.ownerOfMonster(target), target.instanceId, 'destroy');
        break;

      case ActionType.DUPLICATE_MONSTER:
        for (const target of targets.monsters) {
          const owner = targets.ownerOfMonster(target);
          const copy = duplicateMonster(target, owner, action.value ?? 2, ctx);
          if (copy) summoned(owner, copy);
        }
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

      // Remet le compteur des monstres que le joueur a implantés chez l'adversaire.
      case ActionType.RESET_TURN_COUNTER: {
        const opponent = getOpponentState(ctx.game, ctx.ownerUserId);
        for (const m of opponent.monsterZones) {
          if (!m || m.turnCounter === undefined) continue;
          if (!isPlantedBy(m, ctx.ownerUserId)) continue;
          m.turnCounter = action.value ?? 3;
          ctx.log.push(
            `⏳ ${m.card.baseCard.name} repart pour ${m.turnCounter} tour(s)`,
          );
        }
        break;
      }

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

      case ActionType.ALLOW_EVOLUTION_THIS_TURN:
        for (const m of targets.monsters) {
          m.canEvolveThisTurn = true;
          ctx.log.push(`🧬 ${m.card.baseCard.name} peut évoluer ce tour`);
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

      case ActionType.SET_COMBAT_IMMUNITY:
        for (const m of targets.monsters) {
          m.combatImmune = true;
          ctx.log.push(
            `🌀 ${m.card.baseCard.name} est insensible aux dégâts de combat jusqu'à son prochain tour`,
          );
        }
        break;

      case ActionType.SET_DISINFECT_IMMUNITY:
        for (const m of targets.monsters) {
          m.disinfectImmune = true;
          ctx.log.push(
            `🛡️ ${m.card.baseCard.name} est protégé de la désinfection jusqu'au prochain tour de son poseur`,
          );
        }
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

      case ActionType.SET_HATCH_COUNTER:
        for (const m of targets.monsters) {
          m.hatchCounter = action.value ?? 2;
          m.hatchStage = action.filter?.stage;
          ctx.log.push(
            `🥚 ${m.card.baseCard.name} éclora dans ${m.hatchCounter} tour(s)`,
          );
        }
        break;

      case ActionType.ADVANCE_HATCH:
        for (const m of targets.monsters) {
          if (m.hatchCounter === undefined) continue;
          m.hatchCounter -= action.value ?? 1;
          if (m.hatchCounter <= 0)
            hatchEgg(ctx.game, targets.ownerOfMonster(m), m, ctx.log);
        }
        break;

      case ActionType.SUMMON_FROM_DECK:
        for (const p of targets.players) {
          const candidates = pickCandidates(action, p, ctx.sourceCard);
          if (candidates.length === 0) continue;
          const zone = ctx.sourceMonster
            ? p.monsterZones.indexOf(ctx.sourceMonster)
            : -1;
          queueChoice(ctx.game, {
            forUserId: p.userId,
            candidates,
            count: 1,
            prompt: 'Choisis la carte à invoquer',
            resolution: 'summon_to_zone',
            zoneIndex: zone === -1 ? undefined : zone,
            fromEgg: ctx.sourceMonster?.card.baseCard.stage === 'egg',
          });
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
      case ActionType.RETURN_FROM_GRAVEYARD:
      case ActionType.RETURN_FROM_GRAVEYARD_OR_DECK:
      case ActionType.SEARCH_DECK: {
        const fromGraveyardOnly =
          action.type === ActionType.RETURN_FROM_GRAVEYARD;
        const count = fromGraveyardOnly ? (action.value ?? 1) : 1;
        for (const p of targets.players) {
          const candidates = pickCandidates(action, p, ctx.sourceCard);
          if (candidates.length === 0) {
            ctx.log.push(
              `📥 ${card.baseCard.name} — aucune carte récupérable pour ${p.username}`,
            );
            continue;
          }
          const picked = Math.min(count, candidates.length);
          queueChoice(ctx.game, {
            forUserId: p.userId,
            candidates,
            count: picked,
            prompt:
              action.type === ActionType.SEARCH_DECK
                ? 'Cherchez une carte dans votre deck'
                : fromGraveyardOnly
                  ? `Choisissez ${picked} carte(s) à récupérer du cimetière`
                  : 'Choisissez une carte à récupérer (cimetière ou deck)',
            resolution: 'pick_to_hand',
          });
          ctx.log.push(`📥 ${p.username} doit choisir une carte…`);
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

/**
 * Copie un monstre (PV, bonus, mode, équipements) dans la première zone libre
 * de son propriétaire. La copie et ses équipements sont des tokens, bloqués
 * en attaque pendant `blockTurns` tours. Retourne null s'il n'y a pas de place.
 */
function duplicateMonster(
  source: MonsterOnBoard,
  owner: PlayerGameState,
  blockTurns: number,
  ctx: EffectContext,
): MonsterOnBoard | null {
  const zone = owner.monsterZones.findIndex((z) => z === null);
  if (zone === -1) return null;

  // Sans ownerUserId : la copie n'est jamais un monstre « implanté »
  const copy = createMonsterOnBoard({
    instanceId: uuidv4(),
    baseCard: source.card.baseCard,
    ownerId: owner.userId,
    token: true,
  });
  copy.perm = { ...source.perm };
  copy.atkBuff = source.atkBuff;
  copy.hpBuff = source.hpBuff;
  copy.currentHp = source.currentHp;
  copy.mode = source.mode;
  copy.equipments = source.equipments.map((eq) => ({
    instanceId: uuidv4(),
    baseCard: eq.baseCard,
    ownerId: owner.userId,
    token: true,
  }));
  copy.blockAttackTurns = blockTurns;
  owner.monsterZones[zone] = copy;

  ctx.game.pendingEvents.push({
    kind: 'monster_summoned',
    ownerId: owner.userId,
    zoneIndex: zone,
    instanceId: copy.instanceId,
    rarity: copy.card.baseCard.rarity,
  });
  ctx.log.push(`🪞 ${source.card.baseCard.name} est copié`);
  return copy;
}

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

  // Les copies token disparaissent au lieu de rejoindre la main
  for (const eq of monster.equipments.filter((e) => !e.token)) {
    owner.hand.push(eq);
  }
  if (!monster.card.token) owner.hand.push(monster.card);
  owner.monsterZones[idx] = null;

  ctx.log.push(
    `↩️ ${sourceCard.baseCard.name} retourne ${monster.card.baseCard.name} en main` +
      (monster.equipments.length > 0
        ? ` (+ ${monster.equipments.length} équipement(s))`
        : ''),
  );
}
