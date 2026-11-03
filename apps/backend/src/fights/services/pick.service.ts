import { Injectable } from '@nestjs/common';
import { isImplanted } from '@pipou/shared';
import {
  GameState,
  MonsterOnBoard,
  PendingChoice,
} from '../interfaces/game-state.interface';
import { finishCharge, type ChargeOutcome } from '../helpers/charges';
import {
  addLog,
  boardMonster,
  currentChoice,
  effectiveAtk,
  freshCandidates,
  getPlayerState,
  shuffle,
} from '../helpers/game-state.helper';
import { matchesFilter } from '../effects/pick-candidates';
import { evolveInPlace } from '../helpers/evolution';
import { nextStageCard } from '../helpers/evolution-catalog';
import { v4 as uuidv4 } from 'uuid';

import { SummonService } from './summon.service';

@Injectable()
export class PickService {
  constructor(private summon: SummonService) {}

  /** Résout le premier choix en attente avec les cartes choisies. */
  pickCards(
    game: GameState,
    userId: number,
    instanceIds: string[],
  ): { error?: string } {
    const choice = currentChoice(game);
    if (!choice || choice.forUserId !== userId)
      return { error: 'Aucun choix de carte en attente' };

    const candidates = freshCandidates(game, choice);
    const expected = Math.min(choice.count, candidates.length);
    const picked = [...new Set(instanceIds)];
    const player = getPlayerState(game, userId);
    // Effet refusé : rien n'est choisi, la Charge se termine sans effet
    if (picked.length === 0 && choice.skippable) {
      game.pendingChoices.shift();
      addLog(game, `🚫 ${player.username} n'applique pas l'effet`);
      this.endCharge(game, choice, 'fizzled');
      return {};
    }
    if (picked.length !== expected)
      return { error: `Sélectionnez exactement ${expected} carte(s)` };
    if (picked.some((id) => !candidates.some((c) => c.instanceId === id)))
      return { error: 'Carte introuvable dans les choix disponibles' };

    if (choice.resolution === 'discard') {
      for (const id of picked) {
        const idx = player.hand.findIndex((c) => c.instanceId === id);
        if (idx === -1) continue;
        const [card] = player.hand.splice(idx, 1);
        player.graveyard.push(card);
        addLog(game, `🗑️ ${player.username} défausse ${card.baseCard.name}`);
      }
    } else if (choice.resolution === 'copy_effects') {
      for (const id of picked) {
        const card = player.graveyard.find((c) => c.instanceId === id);
        if (card)
          this.summon.copyEffects(game, player, choice.sourceInstanceId, card);
      }
    } else if (choice.resolution === 'summon_to_zone') {
      for (const id of picked) {
        const candidate = candidates.find((c) => c.instanceId === id)!;
        const pile =
          candidate.source === 'graveyard' ? player.graveyard : player.deck;
        const idx = pile.findIndex((c) => c.instanceId === id);
        if (idx === -1) continue;
        const [card] = pile.splice(idx, 1);
        if (
          !this.summon.summonFromDeck(game, player, card, choice.zoneIndex, {
            fromEgg: choice.fromEgg,
          })
        ) {
          pile.push(card);
          addLog(
            game,
            `💨 Aucune zone libre : ${card.baseCard.name} reste en place`,
          );
        }
      }
      shuffle(player.deck);
    } else if (choice.resolution === 'transfer_atk_source') {
      const source = boardMonster(game, picked[0]);
      if (source) {
        const amount = Math.floor(effectiveAtk(source) / 2);
        const receivers = player.monsterZones.filter(
          (m): m is MonsterOnBoard =>
            !!m &&
            m !== source &&
            !isImplanted(m, userId) &&
            matchesFilter(m.card, choice.filter),
        );
        if (receivers.length > 0)
          game.pendingChoices.splice(1, 0, {
            chargeInstanceId: choice.chargeInstanceId,
            skippable: choice.skippable,
            forUserId: userId,
            candidates: receivers.map((m) => ({
              instanceId: m.instanceId,
              baseCard: m.card.baseCard,
              source: 'board' as const,
            })),
            count: 1,
            prompt: `Choisis le Noyau qui reçoit ${amount} ATK`,
            promptKey: 'extract_target',
            promptParams: { amount },
            resolution: 'transfer_atk_target',
            amount,
            fromInstanceId: source.instanceId,
          });
      }
    } else if (choice.resolution === 'transfer_atk_target') {
      const source = choice.fromInstanceId
        ? boardMonster(game, choice.fromInstanceId)
        : undefined;
      const target = boardMonster(game, picked[0]);
      if (source && target && choice.amount) {
        source.tempAtkBuff = (source.tempAtkBuff ?? 0) - choice.amount;
        target.tempAtkBuff = (target.tempAtkBuff ?? 0) + choice.amount;
        addLog(
          game,
          `📡 ${target.card.baseCard.name} extrait ${choice.amount} ATK de ${source.card.baseCard.name} ce tour`,
        );
      }
    } else if (choice.resolution === 'force_evolve') {
      const zoneIndex = player.monsterZones.findIndex(
        (m) => m?.instanceId === picked[0],
      );
      const base = player.monsterZones[zoneIndex];
      const next = base ? nextStageCard(base) : undefined;
      if (base && next) {
        // Carte créée de rien : un jeton, ni main ni cimetière à sa mort
        const evolvedCard = {
          instanceId: uuidv4(),
          baseCard: next,
          ownerId: userId,
          token: true,
        };
        const log: string[] = [];
        const evolved = evolveInPlace(
          game,
          player,
          zoneIndex,
          evolvedCard,
          log,
        );
        this.summon.resolveEvolved(game, player, evolved, log);
        log.forEach((l) => addLog(game, l));
      }
    } else {
      let pickedFromDeck = false;
      for (const id of picked) {
        const candidate = candidates.find((c) => c.instanceId === id)!;
        const pile =
          candidate.source === 'graveyard' ? player.graveyard : player.deck;
        const idx = pile.findIndex((c) => c.instanceId === id);
        if (idx === -1) continue;
        const [card] = pile.splice(idx, 1);
        player.hand.push(card);
        if (candidate.source === 'deck') pickedFromDeck = true;
        addLog(
          game,
          candidate.source === 'graveyard'
            ? `📥 ${player.username} récupère ${card.baseCard.name} depuis son cimetière`
            : `🔮 ${player.username} récupère ${card.baseCard.name} depuis son deck`,
        );
      }
      if (pickedFromDeck) shuffle(player.deck);
    }

    game.pendingChoices.shift();
    // Extraction : la Charge attend encore le choix du receveur
    const followUp = game.pendingChoices.some(
      (c) =>
        !!choice.chargeInstanceId &&
        c.chargeInstanceId === choice.chargeInstanceId,
    );
    if (!followUp)
      this.endCharge(
        game,
        choice,
        choice.resolution === 'transfer_atk_source' ? 'fizzled' : 'resolved',
      );
    return {};
  }

  /** Termine la Charge qui a ouvert ce choix (animation, puis cimetière). */
  private endCharge(
    game: GameState,
    choice: PendingChoice,
    outcome: ChargeOutcome,
  ): void {
    if (!choice.chargeInstanceId) return;
    const owner = getPlayerState(game, choice.forUserId);
    const charge = owner.supportZones.find(
      (z) => z?.instanceId === choice.chargeInstanceId,
    );
    if (!charge) return;
    const log: string[] = [];
    finishCharge(game, owner, charge, outcome, log);
    log.forEach((l) => addLog(game, l));
  }
}
