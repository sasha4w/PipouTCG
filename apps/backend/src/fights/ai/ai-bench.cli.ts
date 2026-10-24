import { performance } from 'node:perf_hooks';
import type { Seat } from '@pipou/shared';
import { createGameState } from '../helpers/game-factory';
import { createEngine } from '../testing/engine';
import { fixedRng } from '../testing/fixed-rng';
import { allRealCards } from '../testing/real-cards';
import { aiMustAct } from './ai-player';
import type { AiLevel } from './ai-player';
import { buildGeneratedEntries } from './generated-entries';
import { LEVEL_BRAINS, createLevelAi } from './level-brains';
import { MAX_ACTIONS, instances, seeded } from './tournament';
import type { TournamentEntry } from './tournament';

/**
 * Banc de temps de décision en aventure : `createLevelAi` de chaque niveau,
 * avec son plafond de temps, sans processus parallèles. 4 parties par niveau
 * (decks générés, graine 1), entre archétypes différents du même niveau.
 */
const LEVELS: AiLevel[] = [1, 2, 3, 4, 5];
const GAMES_PER_LEVEL = 4;

function playTimed(
  p1: TournamentEntry,
  p2: TournamentEntry,
  seed: number,
  times: number[],
): void {
  const random = seeded(seed);
  const realRandom = Math.random;
  Math.random = seeded(seed ^ 0x9e3779b9);
  try {
    const engine = createEngine(fixedRng());
    const game = createGameState(
      1,
      { userId: 1, username: p1.name, socketId: 's1' },
      { userId: 2, username: p2.name, socketId: 's2' },
    );
    engine.setupDeck(game, 'p1', instances(p1.deck, 1, random));
    engine.setupDeck(game, 'p2', instances(p2.deck, 2, random));
    const seats: { seat: Seat; userId: number; entry: TournamentEntry }[] = [
      { seat: 'p1', userId: 1, entry: p1 },
      { seat: 'p2', userId: 2, entry: p2 },
    ];
    const ais = {
      p1: createLevelAi(engine, p1.level, random),
      p2: createLevelAi(engine, p2.level, random),
    };
    for (let n = 0; game.phase !== 'finished' && n < MAX_ACTIONS; n++) {
      const actor = seats.find((s) => aiMustAct(game, s.userId));
      if (!actor) break;
      const start = performance.now();
      const action = ais[actor.seat].chooseAction(game, actor.seat, {
        archetype: actor.entry.archetype,
        level: actor.entry.level,
      });
      times.push(performance.now() - start);
      engine.dispatch(game, actor.seat, action);
    }
  } finally {
    Math.random = realRandom;
  }
}

const percentile = (sorted: number[], p: number) =>
  sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];

function main(): void {
  const entries = buildGeneratedEntries(allRealCards(), 1);
  const lines = [
    '| Niveau | Décisions | Médiane | 95e centile | Maximum | Au plafond |',
    '|---|---|---|---|---|---|',
  ];
  for (const level of LEVELS) {
    const decks = entries.filter((e) => e.level === level);
    const times: number[] = [];
    for (let g = 0; g < GAMES_PER_LEVEL; g++)
      playTimed(
        decks[g % decks.length],
        decks[(g + 1) % decks.length],
        100 * level + g,
        times,
      );
    const sorted = [...times].sort((a, b) => a - b);
    const brain = LEVEL_BRAINS[level].thinking;
    const limit = brain === 'greedy' ? undefined : brain.timeLimitMs;
    const capped =
      limit === undefined
        ? '-'
        : `${((100 * times.filter((t) => t >= limit).length) / times.length).toFixed(1)} %`;
    const ms = (v: number) => `${v.toFixed(1)} ms`;
    lines.push(
      `| ${level} | ${times.length} | ${ms(percentile(sorted, 0.5))} | ${ms(percentile(sorted, 0.95))} | ${ms(sorted.at(-1) ?? 0)} | ${capped} |`,
    );
  }
  console.log(lines.join('\n'));
}

main();
