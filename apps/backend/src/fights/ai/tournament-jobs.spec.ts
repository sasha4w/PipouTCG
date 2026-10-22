import { allRealCards } from '../testing/real-cards';
import { buildGeneratedEntries } from './generated-entries';
import { mergeResults, planGames } from './tournament';
import { SCALES, planJobs, runJob, runJobs } from './tournament-jobs';

jest.setTimeout(120_000);

describe('tournoi par jobs', () => {
  it('échelles du design', () => {
    expect(SCALES).toEqual({
      rapide: { deckSeeds: 3, games: 4 },
      standard: { deckSeeds: 10, games: 10 },
      complet: { deckSeeds: 30, games: 20 },
    });
  });

  it('un job par graine de decks et par paire, graines du tournoi complet', () => {
    const jobs = planJobs([1, 2], 1, 42);
    expect(jobs).toHaveLength(210);
    expect(jobs.every((j) => j.games.length === 1)).toBe(true);
    const seeds = jobs
      .filter((j) => j.deckSeed === 1)
      .map((j) => j.games[0].seed);
    expect(new Set(seeds).size).toBe(105);
    const entries = buildGeneratedEntries(allRealCards(), 1);
    expect(seeds).toEqual(planGames(entries, 1, 42).map((g) => g.seed));
  });

  it("fusion indépendante de l'ordre et du nombre de processus", async () => {
    const jobs = planJobs([1], 1, 42).slice(0, 4);
    const exec = (j: (typeof jobs)[number]) => Promise.resolve(runJob(j));
    const one = await runJobs(jobs, 1, exec);
    const three = await runJobs(jobs, 3, exec);
    expect(three).toEqual(one);

    const reversed = [...jobs].reverse().map(runJob).reverse();
    expect(reversed.reduce(mergeResults)).toEqual(one);
  });
});
