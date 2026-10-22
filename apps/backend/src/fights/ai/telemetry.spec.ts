import type { GameAction, Seat } from '@pipou/shared';
import type { GameState } from '../interfaces/game-state.interface';
import { createEngine } from '../testing/engine';
import { equipmentCard, monsterCard } from '../testing/cards';
import { scenario } from '../testing/scenario';
import { AiPlayer } from './ai-player';
import type { AiProfile } from './ai-player';
import { GameRecorder, emptyTelemetry, mergeTelemetry } from './telemetry';
import type { CardStats, Telemetry } from './telemetry';

const engine = createEngine();
const ai = new AiPlayer(engine, () => 0.99);
const profile: AiProfile = { archetype: 'pipou', level: 3 };

const recorder = () =>
  new GameRecorder({
    p1: { name: 'Pipou test', archetype: 'pipou', level: 3 },
    p2: { name: 'Dragon test', archetype: 'dragon', level: 3 },
  });

/** Joue pour `seat` le coup valide que `pick` désigne, en l'enregistrant. */
function play(
  rec: GameRecorder,
  game: GameState,
  seat: Seat,
  pick: (valid: GameAction[]) => GameAction | undefined,
): void {
  const { valid } = ai.chooseDetailed(game, seat, profile);
  const action = pick(valid);
  if (!action) throw new Error('coup introuvable');
  rec.beforeAction(game, seat, valid, action);
  const { error } = engine.dispatch(game, seat, action);
  if (error) throw new Error(error);
  rec.afterAction(game);
}

const summon = (valid: GameAction[]) => valid.find((a) => a.type === 'summon');
const endPhase = (valid: GameAction[]) =>
  valid.find((a) => a.type === 'end_phase');
const row = (t: Telemetry, card: string): CardStats | undefined =>
  t.cards.find((c) => c.card === card && c.archetype === 'pipou');

describe('GameRecorder', () => {
  it('compte une carte jouée et sa victoire', () => {
    const game = scenario({ p1: { hand: [monsterCard('Lame')] } });
    const rec = recorder();
    play(rec, game, 'p1', summon);
    const t = rec.finish(game, 'p1');
    expect(row(t, 'Lame')).toMatchObject({
      vs: 'dragon',
      playedGames: 1,
      playedWins: 1,
      heldGames: 0,
    });
  });

  it('une carte gardée en main compte dans heldGames', () => {
    const game = scenario({
      p1: { hand: [monsterCard('Lame'), monsterCard('Gardé')] },
    });
    const rec = recorder();
    play(rec, game, 'p1', (v) =>
      v.find((a) => a.type === 'summon' && a.handIndex === 0),
    );
    const t = rec.finish(game, 'p2');
    expect(row(t, 'Gardé')).toMatchObject({ heldGames: 1, heldWins: 0 });
  });

  it('deux exemplaires en main = une seule phase', () => {
    const lame = monsterCard('Lame');
    const game = scenario({ p1: { hand: [lame, lame] } });
    const rec = recorder();
    play(rec, game, 'p1', endPhase);
    const t = rec.finish(game, 'p1');
    expect(row(t, 'Lame')).toMatchObject({ phasesInHand: 1 });
  });

  it('bloquée faute de cible', () => {
    const game = scenario({ p1: { hand: [equipmentCard('Épée', [])] } });
    const rec = recorder();
    play(rec, game, 'p1', endPhase);
    const t = rec.finish(game, 'p1');
    expect(row(t, 'Épée')).toMatchObject({ phasesPlayable: 0 });
    expect(row(t, 'Épée')!.blocked.cible).toBe(1);
  });

  it('phase sans coup utile, main vide', () => {
    const game = scenario({ p1: { hand: [] } });
    const rec = recorder();
    play(rec, game, 'p1', endPhase);
    const deck = rec
      .finish(game, 'p1')
      .decks.find((d) => d.archetype === 'pipou');
    expect(deck).toMatchObject({ mainPhases: 1, idlePhases: 1 });
    expect(deck!.idleReasons.main_vide).toBe(1);
  });

  it('impact : un monstre adverse détruit dans la fenêtre', () => {
    const game = scenario({
      p1: { hand: [monsterCard('Lame', { atk: 300, hp: 500 })] },
      p2: { monsters: [monsterCard('Moucheron', { atk: 0, hp: 100 })] },
    });
    const rec = recorder();
    play(rec, game, 'p1', summon);
    play(rec, game, 'p1', endPhase);
    play(rec, game, 'p1', (v) =>
      v.find((a) => a.type === 'attack' && !a.direct),
    );
    const t = rec.finish(game, 'p1');
    expect(row(t, 'Lame')).toMatchObject({ oppDestroyed: 1 });
  });

  it("impact : ce que l'adversaire dépense lui-même n'est pas une défausse", () => {
    const game = scenario({
      p1: { hand: [monsterCard('Lame')] },
      p2: { hand: [monsterCard('Recyclée')] },
    });
    const rec = recorder();
    play(rec, game, 'p1', summon);
    while (game.currentTurnUserId === game.player1.userId)
      play(rec, game, 'p1', endPhase);
    play(rec, game, 'p2', (v) => v.find((a) => a.type === 'recycle'));
    const t = rec.finish(game, 'p1');
    expect(row(t, 'Lame')).toMatchObject({ oppDiscarded: 0 });
  });

  it('partie sans vainqueur', () => {
    const game = scenario({ p1: { hand: [monsterCard('Lame')] } });
    const rec = recorder();
    play(rec, game, 'p1', summon);
    const t = rec.finish(game, null);
    expect(row(t, 'Lame')).toMatchObject({ playedGames: 1, playedWins: 0 });
  });

  it('mergeTelemetry additionne ligne à ligne', () => {
    const one = (): Telemetry => {
      const game = scenario({ p1: { hand: [monsterCard('Lame')] } });
      const rec = recorder();
      play(rec, game, 'p1', summon);
      return rec.finish(game, 'p1');
    };
    const other = (): Telemetry => {
      const game = scenario({ p1: { hand: [monsterCard('Autre')] } });
      const rec = recorder();
      play(rec, game, 'p1', summon);
      return rec.finish(game, 'p2');
    };
    const merged = mergeTelemetry(mergeTelemetry(one(), one()), other());
    expect(row(merged, 'Lame')).toMatchObject({
      playedGames: 2,
      playedWins: 2,
    });
    expect(row(merged, 'Autre')).toMatchObject({
      playedGames: 1,
      playedWins: 0,
    });
    expect(mergeTelemetry(emptyTelemetry(), one())).toEqual(one());
  });
});
