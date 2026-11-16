import type { GameAction } from '@pipou/shared';
import { stateSignature } from '../fights/ai/planner';
import { createEngine } from '../fights/testing/engine';
import { playPuzzleAction } from './puzzle-step';
import { startTrack } from './puzzle-objective';
import {
  attackScenario,
  attackWall as attack,
} from './testing/attack-scenario';

const engine = createEngine();

describe('playPuzzleAction', () => {
  it('joue un coup du joueur 1 et consigne les destructions', () => {
    const g = attackScenario();
    const track = startTrack(g);
    const target = g.player2.monsterZones[0]!.instanceId;
    expect(
      playPuzzleAction(engine, g, attack(g), 7, track).error,
    ).toBeUndefined();
    expect(track.destroyed).toContain(target);
    expect(g.pendingEvents.length).toBeGreaterThan(0); // la session publie puis vide
  });

  it('renvoie l’erreur du moteur sans consigner', () => {
    const g = attackScenario();
    const track = startTrack(g);
    const bad = { type: 'summon', handIndex: 99 } as unknown as GameAction;
    const r = playPuzzleAction(engine, g, bad, 7, track);
    expect(r.error).toBeDefined();
    expect(track.destroyed).toEqual([]);
  });

  it('est déterministe : même état, même action, même graine', () => {
    const a = attackScenario();
    const b = structuredClone(a);
    playPuzzleAction(engine, a, attack(a), 7, startTrack(a));
    playPuzzleAction(engine, b, attack(b), 7, startTrack(b));
    expect(stateSignature(a, 'p1')).toBe(stateSignature(b, 'p1'));
  });
});
