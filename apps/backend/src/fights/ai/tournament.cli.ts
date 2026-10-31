import 'reflect-metadata';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AdventureArchetype } from '@pipou/shared';
import { AdventureOpponent } from '../../adventure/entities/adventure-opponent.entity';
import dataSource from '../../database/data-source';
import type { AiLevel } from './ai-player';
import { formatTournament, runTournament } from './tournament';
import type { TournamentEntry } from './tournament';

/** Tournoi sur les decks d'aventure des mondes actifs (base lue en lecture seule). */
async function main(): Promise<void> {
  await dataSource.initialize();
  let opponents: AdventureOpponent[];
  try {
    opponents = await dataSource
      .getRepository(AdventureOpponent)
      .createQueryBuilder('o')
      .innerJoinAndSelect('o.world', 'w')
      .leftJoinAndSelect('o.cards', 'oc')
      .leftJoinAndSelect('oc.card', 'c')
      .where('w.is_active = 1')
      .orderBy('w.sort_order', 'ASC')
      .addOrderBy('o.position', 'ASC')
      .getMany();
  } finally {
    await dataSource.destroy();
  }

  const entries: TournamentEntry[] = opponents.map((o) => {
    const { archetype } = JSON.parse(o.signature) as {
      archetype: AdventureArchetype;
    };
    return {
      name: `${o.name} (${o.world.name} ${o.position})`,
      archetype,
      level: o.position as AiLevel,
      deck: o.cards.flatMap((oc) =>
        Array.from({ length: oc.quantity }, () => oc.card),
      ),
      // Le cerveau de l'aventure (erreurs des niveaux faciles comprises) :
      // sans lui, le tournoi joue glouton sans erreur
      brain: 'level' as const,
    };
  });

  const pairs = (entries.length * (entries.length - 1)) / 2;
  console.log(`${entries.length} decks, ${pairs} paires, 10 parties par paire`);
  const result = runTournament(entries, 10, 42);
  const table = formatTournament(result);
  console.log(table);

  const dir = join(__dirname, '..', '..', '..', '.e2e');
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = join(dir, `tournament-${stamp}.json`);
  writeFileSync(file, JSON.stringify(result, null, 2));
  console.log(`Résultats : ${file}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
