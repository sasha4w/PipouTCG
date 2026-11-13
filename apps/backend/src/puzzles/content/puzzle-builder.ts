import { PuzzleObjectiveType } from '@pipou/shared';
import type { CombatMode, PuzzleObjective } from '@pipou/shared';
import { EffectTrigger } from '@pipou/shared';
import type { Card } from '../../cards/card.entity';
import { BuffsCalculatorService } from '../../fights/buffs-calculator.service';
import { EffectsResolverService } from '../../fights/effects-resolver.service';
import {
  buildGameState,
  type MonsterSpec,
  type PlayerSpec,
} from '../../fights/helpers/board-builder';
import type {
  GameState,
  MonsterOnBoard,
  PlayerGameState,
} from '../../fights/interfaces/game-state.interface';

/** Retrouve une carte par son nom (cartes de test pour les specs, base pour l'import). */
export type CardLookup = (name: string) => Card;

export interface MonsterDef {
  name: string;
  mode?: CombatMode;
  /** PV actuels, si le monstre est blessé. */
  hp?: number;
  equipments?: string[];
}

/** Un monstre en jeu : son nom seul suffit (mode Attaque, en jeu depuis un tour précédent). */
export type MonsterEntry = string | MonsterDef | null;

export interface SideDef {
  hand?: string[];
  /** Ordre de pioche : le premier nom est la prochaine carte piochée. */
  deck?: string[];
  graveyard?: string[];
  monsters?: MonsterEntry[];
  supports?: (string | null)[];
  /** Primes restant à prendre (6 par défaut). */
  primes?: number;
  energy?: number;
}

export interface PuzzleDef {
  title: string;
  description: string;
  objective:
    | { type: typeof PuzzleObjectiveType.WIN_GAME }
    | { type: typeof PuzzleObjectiveType.CLEAR_ENEMY_BOARD }
    | { type: typeof PuzzleObjectiveType.DESTROY_MONSTER; target: string }
    | { type: typeof PuzzleObjectiveType.TAKE_PRIMES; primes: number };
  p1: SideDef;
  p2: SideDef;
  /** Graine du hasard (pioche, mélange) : fixe, donc la même partie pour tous. */
  seed: number;
  /** Plus petit nombre d'actions (changements de phase compris) d'une solution. */
  minSteps: number;
  /**
   * Le coup « évident » (passer en combat et attaquer avec ce qu'on a, sans rien
   * jouer en phase principale) échoue : le défi cache un piège.
   */
  trap: boolean;
  /** Nom du ressort, pour le journal de contenu (jamais montré aux joueurs). */
  mechanic: string;
}

/** Carte neutre qui remplit decks et Primes : aucun effet, ne gêne aucun scénario. */
export const FILLER = 'Lieutenant Fripouille';

const resolver = new EffectsResolverService();
const buffs = new BuffsCalculatorService();

function toMonsterSpec(
  e: Exclude<MonsterEntry, null>,
  lookup: CardLookup,
): MonsterSpec {
  const d: MonsterDef = typeof e === 'string' ? { name: e } : e;
  return {
    card: lookup(d.name),
    mode: d.mode,
    currentHp: d.hp,
    equipments: d.equipments?.map(lookup),
  };
}

function toPlayerSpec(s: SideDef, lookup: CardLookup): PlayerSpec {
  const cards = (names?: string[]) => names?.map(lookup);
  return {
    hand: cards(s.hand),
    deck: cards(s.deck) ?? Array.from({ length: 10 }, () => lookup(FILLER)),
    graveyard: cards(s.graveyard),
    primes: s.primes,
    recycleEnergy: s.energy,
    monsters: s.monsters?.map((m) => (m ? toMonsterSpec(m, lookup) : null)),
    supports: s.supports?.map((n) => (n ? lookup(n) : null)),
  };
}

const snapshot = (g: GameState): string =>
  JSON.stringify([
    g.pendingChoices.length,
    [g.player1, g.player2].map((p: PlayerGameState) => [
      p.hand.map((c) => c.instanceId),
      p.deck.length,
      p.graveyard.length,
      p.primes,
      p.monsterZones.map((m) => m?.instanceId ?? null),
    ]),
  ]);

/**
 * Un monstre posé par le décor n'a pas « été invoqué » : on rejoue son effet
 * d'arrivée pour poser ses drapeaux (Provocation, Perçant…). Les dégâts qu'il
 * inflige sont annulés ; un effet qui touche la main, le deck, le cimetière ou
 * la présence des monstres est refusé : il fausserait le plateau dessiné.
 */
function applyArrivalFlags(game: GameState): void {
  for (const player of [game.player1, game.player2]) {
    for (const m of player.monsterZones) {
      if (!m) continue;
      const before = snapshot(game);
      const hps = new Map(
        [game.player1, game.player2].flatMap((p) =>
          p.monsterZones
            .filter((x) => x !== null)
            .map((x) => [x, x.currentHp] as const),
        ),
      );
      resolver.resolve(m.card, EffectTrigger.ON_SUMMON, {
        game,
        ownerUserId: player.userId,
        sourceMonster: m,
        log: [],
      });
      for (const [x, hp] of hps) x.currentHp = hp;
      if (snapshot(game) !== before)
        throw new Error(
          `« ${m.card.baseCard.name} » a un effet d'arrivée à effet de bord : à mettre en main, pas sur le plateau.`,
        );
    }
  }
}

const findEnemy = (game: GameState, name: string): MonsterOnBoard => {
  const found = game.player2.monsterZones.find(
    (m) => m?.card.baseCard.name === name,
  );
  if (!found) throw new Error(`Cible « ${name} » absente du plateau adverse`);
  return found;
};

export function buildPuzzle(
  def: PuzzleDef,
  lookup: CardLookup,
): { game: GameState; objective: PuzzleObjective } {
  const filler = (): ReturnType<CardLookup> => lookup(FILLER);
  const game = buildGameState({
    matchId: 1,
    p1: {
      spec: toPlayerSpec(def.p1, lookup),
      userId: 1,
      username: 'Alice',
      socketId: 'socket-1',
    },
    p2: {
      spec: toPlayerSpec(def.p2, lookup),
      userId: 2,
      username: 'Bob',
      socketId: 'socket-2',
    },
    phase: 'main',
    turn: 'p1',
    turnNumber: 2,
    fillerCard: filler,
  });
  applyArrivalFlags(game);
  buffs.recalculate(game);
  // Les PV de départ suivent les PV maximum (bonus passifs compris)
  for (const [player, side] of [
    [game.player1, def.p1],
    [game.player2, def.p2],
  ] as const)
    player.monsterZones.forEach((m, i) => {
      const spec = side.monsters?.[i];
      const wounded = typeof spec === 'object' && spec?.hp !== undefined;
      if (m && !wounded) m.currentHp = m.card.baseCard.hp + m.hpBuff;
    });

  const o = def.objective;
  const objective: PuzzleObjective =
    o.type === PuzzleObjectiveType.DESTROY_MONSTER
      ? { type: o.type, targetInstanceId: findEnemy(game, o.target).instanceId }
      : o.type === PuzzleObjectiveType.TAKE_PRIMES
        ? { type: o.type, primes: o.primes }
        : { type: o.type };
  return { game, objective };
}
