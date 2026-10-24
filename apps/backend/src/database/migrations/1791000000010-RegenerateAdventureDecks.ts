import { Logger } from '@nestjs/common';
import { MigrationInterface, QueryRunner } from 'typeorm';
import { generateDeck } from '../../adventure/deck-generator';
import { AdventureOpponent } from '../../adventure/entities/adventure-opponent.entity';
import { AdventureOpponentCard } from '../../adventure/entities/adventure-opponent-card.entity';
import type { Signature } from '../../adventure/signatures';
import { Card } from '../../cards/card.entity';

/**
 * Régénère les decks des adversaires Drakon et Pixelman pour qu'ils portent
 * les cartes du rééquilibrage (Mont Drakon, Appel des ancêtres, Mise à jour
 * .patch, Restauration .bak, DuplicateX). Les adversaires Pipou ne bougent pas.
 */
export class RegenerateAdventureDecks1791000000010 implements MigrationInterface {
  name = 'RegenerateAdventureDecks1791000000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const logger = new Logger('RegenerateAdventureDecks');
    const m = queryRunner.manager;
    const opponents = await m.find(AdventureOpponent, {
      relations: { world: true },
      // Colonnes présentes dès la migration 008 : l'entité actuelle en a
      // d'autres (farm_card_*, migration 014) que la prod n'a pas encore ici
      select: {
        id: true,
        position: true,
        signature: true,
        world: { id: true, cardSetId: true },
      },
    });
    const setCache = new Map<number, Card[]>();

    for (const opponent of opponents) {
      let signature: Signature;
      try {
        signature = JSON.parse(opponent.signature) as Signature;
      } catch {
        logger.warn(`Adversaire ${opponent.id} : signature illisible, ignoré`);
        continue;
      }
      if (
        signature.archetype !== 'dragon' &&
        signature.archetype !== 'pixelman'
      )
        continue;

      const setId = opponent.world.cardSetId;
      let setCards = setCache.get(setId);
      if (!setCards) {
        setCards = await m.find(Card, { where: { cardSet: { id: setId } } });
        setCache.set(setId, setCards);
      }

      let deck;
      try {
        deck = generateDeck(
          setCards,
          opponent.position as 1 | 2 | 3 | 4 | 5,
          signature,
          Math.random,
        );
      } catch (err) {
        // Génération impossible : on garde l'ancien deck de cet adversaire
        logger.warn(
          `Adversaire ${opponent.id} : deck conservé (${err instanceof Error ? err.message : String(err)})`,
        );
        continue;
      }
      // Une erreur d'écriture remonte : toute la migration est annulée
      await m.delete(AdventureOpponentCard, { opponentId: opponent.id });
      await m.save(
        AdventureOpponentCard,
        deck.map((d) =>
          m.create(AdventureOpponentCard, {
            opponentId: opponent.id,
            cardId: d.cardId,
            quantity: d.quantity,
          }),
        ),
      );
      logger.log(
        `Adversaire ${opponent.id} (${signature.cardName}, niveau ${opponent.position}) : deck régénéré`,
      );
    }
  }

  public async down(): Promise<void> {
    new Logger('RegenerateAdventureDecks').log(
      'decks régénérés, pas de retour arrière',
    );
    await Promise.resolve();
  }
}
