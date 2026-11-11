import {
  TUTORIAL_LESSONS,
  type Seat,
  type TutorialLessonId,
} from '@pipou/shared';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createEngine } from '../fights/testing/engine';
import { allRealCards } from '../fights/testing/real-cards';
import { seatPlayer } from '../fights/helpers/game-state.helper';
import type {
  GameState,
  MonsterOnBoard,
} from '../fights/interfaces/game-state.interface';
import { buildLessonGame, cardResolver } from './lesson-board';
import { LessonRunner } from './lesson-runner';
import { LESSONS } from './lessons';
import { lessonCardNames, type Lesson } from './lesson.types';

const USER_ID = 7;
const MATCH_ID = -1_000_007;
const card = cardResolver(allRealCards());

/** Vérification faite quand l'étape de cette clé devient l'étape courante. */
type Facts = Record<string, (game: GameState) => void>;

/** Rejoue une leçon de bout en bout sur le vrai moteur, avec les vraies cartes. */
function replay(lesson: Lesson, facts: Facts = {}) {
  const engine = createEngine();
  const game = buildLessonGame(lesson, card, {
    matchId: MATCH_ID,
    userId: USER_ID,
    username: 'Élève',
    opponentId: MATCH_ID,
    opponentName: 'Maître Pipou',
  });
  const runner = new LessonRunner(lesson);

  while (!runner.done) {
    const step = runner.step!;
    const label = `étape ${runner.index} « ${step.key} »`;
    facts[step.key]?.(game);
    if (step.kind === 'info') {
      runner.advance();
      continue;
    }
    const seat: Seat = step.kind === 'player' ? 'p1' : 'p2';
    const action = runner.expectedAction(game, seat);
    if (!action)
      throw new Error(`${label} : action introuvable (carte absente ?)`);
    if (step.kind === 'player' && !runner.matches(game, seat, action))
      throw new Error(
        `${label} : l'action attendue ne se reconnaît pas elle-même`,
      );
    const result = engine.dispatch(game, seat, action);
    if (step.kind === 'player' && step.refused) {
      if (!result.error)
        throw new Error(`${label} : le moteur devait refuser cette action`);
    } else if (result.error) {
      throw new Error(`${label} : action refusée — ${result.error}`);
    }
    runner.advance();
  }
  return { game, runner };
}

const me = (g: GameState) => seatPlayer(g, 'p1');
const opp = (g: GameState) => seatPlayer(g, 'p2');
const names = (cards: { baseCard: { name: string } }[]) =>
  cards.map((c) => c.baseCard.name);
const board = (p: ReturnType<typeof me>) =>
  p.monsterZones.map((m) => m?.card.baseCard.name ?? null);
function monster(p: ReturnType<typeof me>, name: string): MonsterOnBoard {
  const m = p.monsterZones.find((x) => x?.card.baseCard.name === name);
  if (!m) throw new Error(`« ${name} » absent du plateau`);
  return m;
}

/**
 * Ce que les textes de chaque leçon affirment : si un rééquilibrage de carte
 * change l'un de ces faits, la leçon est à réécrire, pas seulement à relire.
 */
const FACTS: Record<TutorialLessonId, Facts> = {
  'first-turn': {
    summonEnergy: (g) => expect(me(g).recycleEnergy).toBe(1),
    summonPay: (g) => {
      expect(me(g).recycleEnergy).toBe(0);
      expect(board(me(g))[1]).toBe('Lieutenant Bidouille');
    },
    board: (g) => {
      expect(board(me(g))).toEqual([
        'Guerrier Bafouille',
        'Lieutenant Bidouille',
        null,
      ]);
      expect(names(me(g).graveyard)).toContain('Caporal Gazouille');
    },
    nextTurn: (g) => {
      expect(g.currentTurnUserId).toBe(USER_ID);
      expect(g.turnNumber).toBe(3);
      expect(g.phase).toBe('main');
      expect(board(opp(g))[1]).toBe('Sentinelle Gargouille');
      expect(names(me(g).hand)).toContain('Archer Crapouille');
    },
  },
  combat: {
    riposte: (g) => {
      expect(monster(opp(g), 'Lieutenant Fripouille').currentHp).toBe(200);
      expect(monster(me(g), 'Chevalier Touille').currentHp).toBe(900);
    },
    prime: (g) => {
      expect(board(opp(g))).not.toContain('Lieutenant Fripouille');
      expect(me(g).primes).toBe(2);
      expect(opp(g).hand).toHaveLength(2);
    },
    doubleKoInfo: (g) => {
      expect(board(me(g))).not.toContain('Éclaireur Nouille');
      expect(board(opp(g))).not.toContain('Archer Crapouille');
      expect(me(g).primes).toBe(1);
      expect(opp(g).primes).toBe(5);
    },
    emptyBoard: (g) => {
      expect(opp(g).monsterZones.every((m) => m === null)).toBe(true);
      expect(g.currentTurnUserId).toBe(USER_ID);
    },
  },
  guard: {
    noPrimeInfo: (g) => {
      expect(board(me(g))).not.toContain('Lieutenant Bidouille');
      expect(opp(g).primes).toBe(6);
    },
    piercingInfo: (g) => {
      expect(board(me(g))).not.toContain('Chevalier Touille');
      expect(opp(g).primes).toBe(5);
    },
    turnHeld: (g) => {
      expect(monster(me(g), 'Prêtre Fouille').mode).toBe('guard');
    },
    counter: (g) => {
      const m = monster(me(g), 'Prêtre Fouille');
      expect(m.mode).toBe('attack');
      expect(m.hasAttackedThisTurn).toBe(false);
    },
    done: (g) => {
      expect(monster(opp(g), 'Archer Crapouille').currentHp).toBeLessThan(400);
    },
  },
  supports: {
    ephemeralDone: (g) =>
      expect(monster(opp(g), 'Archer Crapouille').currentHp).toBe(100),
    slot: (g) => {
      expect(names(monster(me(g), 'Noyau Beta').equipments)).toEqual([
        'Processeur de Calcul .bin',
      ]);
    },
    terrain: (g) => {
      expect(names(monster(me(g), 'Noyau Beta').equipments)).toEqual([
        'Canon à Particules .vxd',
      ]);
      expect(names(me(g).graveyard)).toContain('Processeur de Calcul .bin');
    },
    terrainDone: (g) =>
      expect(me(g).supportZones[0]?.baseCard.name).toBe('Tactique Gang Gang'),
    chargeDone: (g) =>
      expect(me(g).supportZones[1]?.baseCard.name).toBe('Alerte générale'),
  },
  control: {
    controlPhase: (g) => expect(g.phase).toBe('end'),
    handLimit: (g) => expect(me(g).hand.length).toBeGreaterThan(7),
    'common.endTurn': (g) => expect(me(g).hand.length).toBeLessThanOrEqual(7),
    done: (g) => expect(g.currentTurnUserId).toBe(USER_ID),
  },
  pipou: {
    free: (g) => {
      const touille = me(g).hand.find(
        (c) => c.baseCard.name === 'Chevalier Touille',
      )!;
      expect(me(g).freeSummonInstanceIds).toContain(touille.instanceId);
    },
    taunt: (g) =>
      expect(monster(me(g), 'Capitaine Gribouille').hasTaunt).toBe(true),
    releveDone: (g) => {
      expect(board(me(g))).toContain('Général Chatouille');
      expect(names(me(g).graveyard)).toEqual(
        expect.arrayContaining(['Lieutenant Bidouille', 'Chevalier Touille']),
      );
      const general = monster(me(g), 'Général Chatouille');
      expect(general.card.baseCard.atk + general.atkBuff).toBe(1100);
    },
    done: (g) => {
      // Provocation : l'adversaire n'a pu frapper que le Capitaine
      expect(monster(me(g), 'Capitaine Gribouille').currentHp).toBeLessThan(
        1100,
      );
    },
  },
  drakon: {
    eggInfo: (g) =>
      expect(monster(me(g), 'Œuf de la Genèse').hatchCounter).toBe(2),
    stages: (g) => expect(board(me(g))[0]).toBe('Bébé Tempestu'),
    evolveDone: (g) => expect(board(me(g))[0]).toBe('Jeune Tempestu'),
    transformPick: (g) => expect(g.pendingChoices).toHaveLength(1),
    done: (g) => expect(names(me(g).hand)).toContain('Bébé Feros'),
  },
  pixelman: {
    noPrime: (g) => {
      expect(board(opp(g))).not.toContain('Archer Crapouille');
      expect(me(g).primes).toBe(6);
    },
    zetaExplodes: (g) => {
      expect(board(opp(g))).not.toContain('Noyau Zeta');
      expect(me(g).primes).toBe(5);
      expect(g.currentTurnUserId).toBe(USER_ID);
    },
    implantInfo: (g) =>
      expect(monster(opp(g), 'Noyau Zeta').ownerUserId).toBe(USER_ID),
    done: (g) => {
      expect(board(opp(g))).not.toContain('Noyau Zeta');
      expect(me(g).primes).toBe(5);
      expect(opp(g).primes).toBe(6);
    },
  },
  statuses: {
    restraints: (g) => {
      expect(monster(me(g), 'Gardien Ratouile').mode).toBe('guard');
      expect(monster(me(g), 'Chevalier Touille').mode).toBe('attack');
    },
    immuneInfo: (g) =>
      expect(names(me(g).hand)).toContain('Protocole de Gel .frz'),
    immunities: (g) =>
      expect(names(me(g).hand)).not.toContain('Protocole de Gel .frz'),
  },
};

describe('leçons du tutoriel', () => {
  it("couvre les 9 leçons dans l'ordre", () => {
    expect(Object.keys(LESSONS)).toEqual([...TUTORIAL_LESSONS]);
  });

  for (const id of TUTORIAL_LESSONS) {
    const lesson = LESSONS[id];
    if (!lesson) continue;

    describe(id, () => {
      it('ne cite que des cartes réelles', () => {
        for (const name of lessonCardNames(lesson))
          expect(() => card(name)).not.toThrow();
      });

      it('se rejoue de bout en bout, sans action refusée, et dit vrai', () => {
        const facts = FACTS[id];
        const { runner } = replay(lesson, facts);
        expect(runner.done).toBe(true);
        // Chaque fait affirmé doit viser une étape qui existe
        for (const key of Object.keys(facts))
          expect(lesson.steps.map((s) => s.key)).toContain(key);
      });
    });
  }

  it('la leçon Combat se gagne sur la dernière Prime', () => {
    const { game } = replay(LESSONS.combat!);
    expect(game.phase).toBe('finished');
    expect(game.winner).toBe(USER_ID);
    expect(seatPlayer(game, 'p1').primes).toBe(0);
  });

  it('toutes les clés de texte existent en fr, en et ko', () => {
    const dir = join(__dirname, '../../../frontend/src/i18n/locales');
    for (const lang of ['fr', 'en', 'ko']) {
      const tutorial = (
        JSON.parse(readFileSync(join(dir, `${lang}.json`), 'utf8')) as {
          tutorial?: Record<string, Record<string, string>>;
        }
      ).tutorial;
      expect(tutorial).toBeDefined();
      for (const id of TUTORIAL_LESSONS)
        for (const step of LESSONS[id]!.steps) {
          const [scope, key] = step.key.startsWith('common.')
            ? ['common', step.key.slice('common.'.length)]
            : [id, step.key];
          expect({ lang, scope, key, text: tutorial![scope]?.[key] }).toEqual({
            lang,
            scope,
            key,
            text: expect.any(String) as string,
          });
        }
    }
  });
});
