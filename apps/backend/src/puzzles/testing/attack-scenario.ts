import type { GameAction } from '@pipou/shared';
import type { GameState } from '../../fights/interfaces/game-state.interface';
import { monsterCard } from '../../fights/testing/cards';
import { scenario } from '../../fights/testing/scenario';

export interface AttackScenarioOptions {
  /** Phase de départ : 'battle' (défaut, attaque directe possible) ou 'main' (main -> battle -> attaque). */
  phase?: 'main' | 'battle';
  /** PV du « Mur » adverse (500 par défaut). Au-dessus de 1000 (ATK de « Bélier »), il est indestructible. */
  wallHp?: number;
}

/**
 * Fixture partagée des tests du défi du jour : le joueur 1 a un « Bélier »
 * (1000 ATK, en mode attaque, en jeu depuis un tour précédent), l'adversaire
 * un seul « Mur ». En phase 'main', il faut passer en combat (`end_phase`)
 * avant d'attaquer ; avec un mur trop solide, aucune suite de coups ne gagne.
 */
export function attackScenario(opts: AttackScenarioOptions = {}): GameState {
  return scenario({
    phase: opts.phase ?? 'battle',
    p1: {
      monsters: [
        { card: monsterCard('Bélier', { atk: 1000, hp: 500 }), mode: 'attack' },
      ],
    },
    p2: { monsters: [monsterCard('Mur', { atk: 0, hp: opts.wallHp ?? 500 })] },
  });
}

/** Attaque du Bélier contre le Mur, telle que le moteur l'attend. */
export function attackWall(game: GameState): GameAction {
  return {
    type: 'attack',
    attackerInstanceId: game.player1.monsterZones[0]!.instanceId,
    targetInstanceId: game.player2.monsterZones[0]!.instanceId,
  };
}
