import { Logger } from '@nestjs/common';
import type { EntityManager, MigrationInterface, QueryRunner } from 'typeorm';
import type { DrakonElement } from '@pipou/shared';
import { generateDeck } from '../../adventure/deck-generator';
import { AdventureOpponent } from '../../adventure/entities/adventure-opponent.entity';
import { AdventureOpponentCard } from '../../adventure/entities/adventure-opponent-card.entity';
import type { Signature } from '../../adventure/signatures';
import { Card } from '../../cards/card.entity';

const ORIGINES = 'Drakon des Origines';
const OEUF = 'Œuf Céleste';
/** Ancestral qui tombe en farm, par élément de la signature. */
const ANCESTRAL: Record<DrakonElement, string> = {
  earth: 'Ancestral Teros',
  fire: 'Ancestral Feros',
  water: 'Ancestral Ackos',
  wind: 'Ancestral Tempestu',
};
const ANCESTRAL_PCT = 5;
const ORIGINES_PCT = 1;

interface DragonOpponent {
  opponent: AdventureOpponent;
  signature: Signature;
}

/** Adversaires Drakon (signature lisible), groupés pour un même set. */
async function dragonOpponents(
  m: EntityManager,
  logger: Logger,
): Promise<DragonOpponent[]> {
  const opponents = await m.find(AdventureOpponent, {
    relations: { world: true },
  });
  const out: DragonOpponent[] = [];
  for (const opponent of opponents) {
    try {
      const signature = JSON.parse(opponent.signature) as Signature;
      if (signature.archetype === 'dragon') out.push({ opponent, signature });
    } catch {
      logger.warn(`Adversaire ${opponent.id} : signature illisible, ignoré`);
    }
  }
  return out;
}

/**
 * Monde Drakon de l'extension : le Drakon des Origines devient le boss, chaque
 * niveau d'élément fait tomber son Ancestral, et les decks sont régénérés.
 */
export class DrakonOriginesWorld1791000000015 implements MigrationInterface {
  name = 'DrakonOriginesWorld1791000000015';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const logger = new Logger('DrakonOriginesWorld');
    const m = queryRunner.manager;
    const dragons = await dragonOpponents(m, logger);
    if (dragons.length === 0) {
      logger.log('Aucun adversaire Drakon : rien à faire');
      return;
    }
    const setCache = new Map<number, Card[]>();
    for (const { opponent } of dragons) {
      const setId = opponent.world.cardSetId;
      if (!setCache.has(setId))
        setCache.set(
          setId,
          await m.find(Card, { where: { cardSet: { id: setId } } }),
        );
      const setCards = setCache.get(setId)!;
      const byName = (name: string) => setCards.find((c) => c.name === name);
      const origines = byName(ORIGINES);
      if (!origines) {
        logger.warn(
          `Adversaire ${opponent.id} : « ${ORIGINES} » absent du set ${setId}, ignoré`,
        );
        continue;
      }

      const current = dragons.find((d) => d.opponent === opponent)!.signature;
      const isBoss = opponent.position === 5;
      const signature: Signature = isBoss
        ? { archetype: 'dragon', cardName: ORIGINES }
        : current;
      const farmCard = isBoss
        ? origines
        : current.element
          ? byName(ANCESTRAL[current.element])
          : undefined;
      const changes = {
        signature: JSON.stringify(signature),
        ...(isBoss ? { portraitCardId: origines.id } : {}),
        farmCardId: farmCard?.id ?? null,
        farmCardPct: farmCard ? (isBoss ? ORIGINES_PCT : ANCESTRAL_PCT) : 0,
      };
      await m.update(AdventureOpponent, { id: opponent.id }, changes);

      let deck;
      try {
        deck = generateDeck(
          setCards,
          opponent.position as 1 | 2 | 3 | 4 | 5,
          signature,
          Math.random,
        );
      } catch (err) {
        logger.warn(
          `Adversaire ${opponent.id} : deck conservé (${err instanceof Error ? err.message : String(err)})`,
        );
        continue;
      }
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
        `Adversaire ${opponent.id} (${signature.cardName}, niveau ${opponent.position}) : réglé, deck régénéré`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const logger = new Logger('DrakonOriginesWorld');
    const m = queryRunner.manager;
    for (const { opponent } of await dragonOpponents(m, logger)) {
      const isBoss = opponent.position === 5;
      let portraitCardId: number | undefined;
      if (isBoss) {
        const setCards = await m.find(Card, {
          where: { cardSet: { id: opponent.world.cardSetId } },
        });
        portraitCardId = setCards.find((c) => c.name === OEUF)?.id;
      }
      await m.update(
        AdventureOpponent,
        { id: opponent.id },
        {
          ...(isBoss
            ? {
                signature: JSON.stringify({
                  archetype: 'dragon',
                  cardName: OEUF,
                }),
                ...(portraitCardId ? { portraitCardId } : {}),
              }
            : {}),
          farmCardId: null,
          farmCardPct: 0,
        },
      );
    }
    logger.log('boss et récompenses rétablis ; decks non restaurés');
  }
}
