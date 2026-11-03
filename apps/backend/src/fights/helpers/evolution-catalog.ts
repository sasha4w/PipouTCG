import { canEvolveOnto } from '@pipou/shared';
import type { Card } from '../../cards/card.entity';
import type { MonsterOnBoard } from '../interfaces/game-state.interface';

/**
 * Cartes d'évolution utilisables sans les posséder (Méditation céleste).
 * Chargé au démarrage par EvolutionCatalogLoader ; vide hors de Nest.
 */
let catalog: Card[] = [];

export function setEvolutionCatalog(cards: Card[]): void {
  catalog = cards.filter((c) => c.stage && c.lineage);
}

/** Carte du stade suivant de la lignée du monstre, s'il existe. */
export function nextStageCard(base: MonsterOnBoard): Card | undefined {
  return catalog.find((c) =>
    canEvolveOnto(c, { ...base, evolutionJoker: false }),
  );
}
