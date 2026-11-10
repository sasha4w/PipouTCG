import { appendFileSync, writeFileSync } from 'node:fs';
import type { AdventureArchetype, Seat } from '@pipou/shared';
import { createGameState } from '../helpers/game-factory';
import { seatPlayer } from '../helpers/game-state.helper';
import { createEngine } from '../testing/engine';
import { fixedRng } from '../testing/fixed-rng';
import { allRealCards } from '../testing/real-cards';
import { AiPlayer, aiMustAct } from './ai-player';
import { buildGeneratedEntries } from './generated-entries';
import { LEVEL_BRAINS } from './level-brains';
import type { ThinkingProfile } from './planner';
import type { BenchPosition } from './regret';
import { judge, withRandom } from './rollout';
import { MAX_ACTIONS, instances, seeded } from './tournament';

/**
 * Banc de positions jugées par fins de partie. Sur des positions tirées de
 * parties entre decks de niveau 5 (graine de decks 1), chaque coup candidat
 * est joué puis la partie est finie en glouton. Une ligne = une `BenchPosition`.
 *
 *   pnpm --filter @pipou/backend ai:rollout <sortie.jsonl> <part> <parts> [parties par paire] [rollouts]
 *
 * Lancer une commande par part (0 à parts − 1) en parallèle, puis concaténer.
 */
const SAMPLE_RATE = 0.2;

const PLANNER: ThinkingProfile = {
  ...(LEVEL_BRAINS[3].thinking as ThinkingProfile),
  timeLimitMs: undefined,
};

function main(argv: string[]): void {
  const [out, shardArg, shardsArg, gamesArg, rollArg] = argv;
  if (!out || shardArg === undefined || shardsArg === undefined)
    throw new Error(
      'Usage : ai:rollout <sortie.jsonl> <part> <parts> [parties par paire] [rollouts]',
    );
  const shard = Number(shardArg);
  const shards = Number(shardsArg);
  const games = Number(gamesArg ?? 3);
  const rollouts = Number(rollArg ?? 24);
  writeFileSync(out, '');
  const decks = buildGeneratedEntries(allRealCards(), 1).filter(
    (e) => e.level === 5,
  );
  let g = 0;
  for (const da of decks)
    for (const db of decks)
      for (let k = 0; k < games; k++, g++) {
        if (g % shards !== shard) continue;
        const seed = 5000 + g;
        const random = seeded(seed);
        const sampler = seeded(seed + 77);
        const archetypes: Record<Seat, AdventureArchetype> = {
          p1: da.archetype,
          p2: db.archetype,
        };
        withRandom(seed ^ 0x9e3779b9, () => {
          const engine = createEngine(fixedRng());
          const game = createGameState(
            1,
            { userId: 1, username: da.name, socketId: 's1' },
            { userId: 2, username: db.name, socketId: 's2' },
          );
          engine.setupDeck(game, 'p1', instances(da.deck, 1, random));
          engine.setupDeck(game, 'p2', instances(db.deck, 2, random));
          const ai = new AiPlayer(engine, seeded(seed * 3), PLANNER);
          for (let n = 0; game.phase !== 'finished' && n < MAX_ACTIONS; n++) {
            const seat = (['p1', 'p2'] as Seat[]).find((s) =>
              aiMustAct(game, seatPlayer(game, s).userId),
            );
            if (!seat) break;
            if (
              (game.phase === 'main' || game.phase === 'battle') &&
              sampler() < SAMPLE_RATE
            ) {
              // Le juge fige Math.random : on le remet pour la suite de la partie
              const frozen = Math.random;
              const rows = judge(
                game,
                seat,
                archetypes,
                rollouts,
                seed * 100 + n,
              );
              Math.random = frozen;
              if (rows) {
                const position: BenchPosition = {
                  id: `g${g}:${n}`,
                  seat,
                  archetype: archetypes[seat],
                  state: structuredClone(game),
                  rows,
                };
                appendFileSync(out, JSON.stringify(position) + '\n');
              }
            }
            engine.dispatch(
              game,
              seat,
              ai.chooseAction(game, seat, {
                archetype: archetypes[seat],
                level: 3,
              }),
            );
          }
        });
        console.log(`partie ${g} finie`);
      }
}

main(process.argv.slice(2));
