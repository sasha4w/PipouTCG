import { PuzzleObjectiveType as T } from '@pipou/shared';
import type { PuzzleObjective } from '@pipou/shared';
import { scenario, P1_ID, P2_ID } from '../fights/testing/scenario';
import { monsterCard } from '../fights/testing/cards';
import {
  objectiveMet,
  puzzleOutcome,
  recordEvents,
  startTrack,
  validateObjective,
  validateStart,
} from './puzzle-objective';

const wall = monsterCard('Mur');
const game = () => scenario({ p1: { primes: 3 }, p2: { monsters: [wall] } });
const targetId = (g: ReturnType<typeof game>) =>
  g.player2.monsterZones[0]!.instanceId;

describe('objectif de défi', () => {
  it('WIN_GAME : atteint quand le joueur 1 est déclaré vainqueur', () => {
    const g = game();
    const track = startTrack(g);
    expect(objectiveMet({ type: T.WIN_GAME }, g, track)).toBe(false);
    g.phase = 'finished';
    g.winner = P1_ID;
    expect(puzzleOutcome({ type: T.WIN_GAME }, g, track)).toBe('solved');
  });

  it('DESTROY_MONSTER : exige l’événement de destruction de la cible', () => {
    const g = game();
    const track = startTrack(g);
    const id = targetId(g);
    const o: PuzzleObjective = {
      type: T.DESTROY_MONSTER,
      targetInstanceId: id,
    };
    g.player2.monsterZones[0] = null; // renvoyé en main : ne compte pas
    expect(objectiveMet(o, g, track)).toBe(false);
    g.pendingEvents.push({
      kind: 'monster_destroyed',
      ownerId: P2_ID,
      zoneIndex: 0,
      instanceId: id,
      cause: 'combat',
    });
    recordEvents(track, g);
    expect(objectiveMet(o, g, track)).toBe(true);
  });

  it('CLEAR_ENEMY_BOARD : plus aucun monstre adverse', () => {
    const g = game();
    const track = startTrack(g);
    expect(objectiveMet({ type: T.CLEAR_ENEMY_BOARD }, g, track)).toBe(false);
    g.player2.monsterZones = [null, null, null];
    expect(objectiveMet({ type: T.CLEAR_ENEMY_BOARD }, g, track)).toBe(true);
  });

  it('TAKE_PRIMES : compte les primes prises depuis le départ', () => {
    const g = game();
    const track = startTrack(g);
    const o: PuzzleObjective = { type: T.TAKE_PRIMES, primes: 2 };
    g.player1.primes = 2;
    expect(objectiveMet(o, g, track)).toBe(false);
    g.player1.primes = 1;
    expect(objectiveMet(o, g, track)).toBe(true);
  });

  it('raté dès que le tour passe à l’adversaire ou que la partie finit sans objectif', () => {
    const g = game();
    const track = startTrack(g);
    const o: PuzzleObjective = { type: T.CLEAR_ENEMY_BOARD };
    expect(puzzleOutcome(o, g, track)).toBe('ongoing');
    g.currentTurnUserId = P2_ID;
    expect(puzzleOutcome(o, g, track)).toBe('failed');
  });

  it('raté quand la partie finit sans objectif atteint', () => {
    const g = game();
    const track = startTrack(g);
    g.phase = 'finished';
    expect(puzzleOutcome({ type: T.CLEAR_ENEMY_BOARD }, g, track)).toBe(
      'failed',
    );
  });

  it('l’objectif atteint prime sur la fin de tour', () => {
    const g = game();
    const track = startTrack(g);
    g.player2.monsterZones = [null, null, null];
    g.currentTurnUserId = P2_ID;
    expect(puzzleOutcome({ type: T.CLEAR_ENEMY_BOARD }, g, track)).toBe(
      'solved',
    );
  });

  it('valide les paramètres', () => {
    const g = game();
    expect(
      validateObjective({ type: T.DESTROY_MONSTER, targetInstanceId: 'x' }, g),
    ).toMatch(/cible/i);
    expect(
      validateObjective(
        { type: T.DESTROY_MONSTER, targetInstanceId: targetId(g) },
        g,
      ),
    ).toBeNull();
    expect(validateObjective({ type: T.TAKE_PRIMES, primes: 4 }, g)).toMatch(
      /primes/i,
    );
    expect(validateObjective({ type: T.TAKE_PRIMES, primes: 3 }, g)).toBeNull();
    expect(
      validateObjective({ type: T.CLEAR_ENEMY_BOARD }, scenario()),
    ).toMatch(/monstre/i);
  });

  it('refuse un départ hors phase principale du joueur 1', () => {
    expect(validateStart(scenario())).toBeNull();
    expect(validateStart(scenario({ phase: 'battle' }))).toMatch(/phase/i);
    expect(validateStart(scenario({ turn: 'p2' }))).toMatch(/joueur 1/i);
  });

  it('refuse un départ avec un choix en attente', () => {
    const g = scenario();
    g.pendingChoices.push({} as (typeof g.pendingChoices)[number]);
    expect(validateStart(g)).toMatch(/choix/i);
  });
});
