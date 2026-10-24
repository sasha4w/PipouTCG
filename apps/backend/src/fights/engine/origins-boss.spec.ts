import { listCandidates } from '../ai/candidate-actions';
import { buildGeneratedEntries } from '../ai/generated-entries';
import { runTournament } from '../ai/tournament';
import { createEngine } from '../testing/engine';
import { allRealCards, realCard } from '../testing/real-cards';
import { scenario } from '../testing/scenario';

jest.setTimeout(120_000);
const engine = createEngine();

describe('boss du monde Drakon', () => {
  it('ses parties se terminent', () => {
    const entries = buildGeneratedEntries(allRealCards(), 1);
    const boss = entries.find((e) => e.name === 'dragon niveau 5')!;
    const rival = entries.find((e) => e.name === 'pipou niveau 3')!;
    const result = runTournament([boss, rival], 2, 1);
    expect(result.byEntry.reduce((n, e) => n + e.wins, 0)).toBe(result.games);
  });

  it("IA : propose d'invoquer le Drakon des Origines quand c'est possible", () => {
    const game = scenario({
      turn: 'p1',
      phase: 'main',
      p1: {
        hand: [realCard('Drakon des Origines')],
        recycleEnergy: 4,
        graveyard: [
          'Adulte Teros',
          'Adulte Feros',
          'Adulte Ackos',
          'Adulte Tempestu',
        ].map(realCard),
      },
    });
    const candidate = listCandidates(game, 'p1').find(
      (a) => a.type === 'summon' && a.handIndex === 0,
    );
    expect(candidate).toBeDefined();
    expect(engine.dispatch(game, 'p1', candidate!).error).toBeUndefined();
  });
});
