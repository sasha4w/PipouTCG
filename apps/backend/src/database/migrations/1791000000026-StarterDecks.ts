import { MigrationInterface, QueryRunner } from 'typeorm';

interface SeedCard {
  name: string;
  quantity: number;
  featured?: boolean;
}

/** Compositions initiales (spec 2026-11-05-starter-decks-design). */
export const STARTER_SEED: { archetype: string; cards: SeedCard[] }[] = [
  {
    archetype: 'pipou',
    cards: [
      { name: 'Chevalier Touille', quantity: 3, featured: true },
      { name: 'Mastodonte Grossebouille', quantity: 3, featured: true },
      { name: 'Maraudeur Friponouille', quantity: 3 },
      { name: 'Tactique Gang Gang', quantity: 2 },
      { name: 'Sentinelle Gargouille', quantity: 3 },
      { name: "Clairon de l'Union", quantity: 2 },
      { name: 'Ouille au rapport', quantity: 3 },
      { name: "Soin d'urgence", quantity: 3 },
      { name: 'Capitaine Gribouille', quantity: 3, featured: true },
      { name: 'Éclaireur Nouille', quantity: 3 },
      { name: 'Général Chatouille', quantity: 1, featured: true },
      { name: 'Alerte générale', quantity: 1 },
    ],
  },
  {
    archetype: 'pixelman',
    cards: [
      { name: 'Noyau Alpha', quantity: 3, featured: true },
      { name: 'Noyau Beta', quantity: 3 },
      { name: 'Force Plasma', quantity: 3 },
      { name: 'Module de Réparation .exe', quantity: 3 },
      { name: 'Canon à Particules .vxd', quantity: 3, featured: true },
      { name: 'Verrou de Position .lock', quantity: 3 },
      { name: 'Protocole de Gel .frz', quantity: 3 },
      { name: 'Drone Éclaireur .log', quantity: 3 },
      { name: 'Firewall de Surcharge .sys', quantity: 2 },
      { name: 'Noyau Omega', quantity: 1, featured: true },
      { name: 'Extraction de données', quantity: 2 },
      { name: 'DuplicateX', quantity: 1, featured: true },
    ],
  },
  {
    archetype: 'dragon',
    cards: [
      { name: 'Potion de Lucidité', quantity: 3 },
      { name: 'Bouclier de Fortune', quantity: 3 },
      { name: 'Œuf de la Genèse', quantity: 2, featured: true },
      { name: 'Œuf de la Dualité', quantity: 1 },
      { name: 'Bébé Ackos', quantity: 2 },
      { name: 'Jeune Ackos', quantity: 2 },
      { name: 'Adulte Ackos', quantity: 2 },
      { name: 'Bébé Feros', quantity: 2 },
      { name: 'Jeune Feros', quantity: 2 },
      { name: 'Adulte Feros', quantity: 2 },
      { name: 'Ancestral Feros', quantity: 1, featured: true },
      { name: 'Ancestral Ackos', quantity: 1, featured: true },
      { name: 'Mont Drakon', quantity: 2, featured: true },
      { name: 'Souffle Primordial', quantity: 2 },
      { name: 'Incubation Rapide', quantity: 3 },
    ],
  },
];

/** Starter decks : tables, marqueur de réclamation sur le compte, compositions. */
export class StarterDecks1791000000026 implements MigrationInterface {
  name = 'StarterDecks1791000000026';

  public async up(q: QueryRunner): Promise<void> {
    // Le DDL MySQL valide implicitement : on résout tous les noms AVANT d'écrire
    // quoi que ce soit, pour qu'un échec (nom absent ou ambigu) reste rejouable.
    const plan: {
      deck: (typeof STARTER_SEED)[number];
      resolved: { id: number; card: SeedCard }[];
    }[] = [];
    for (const deck of STARTER_SEED) {
      const resolved: { id: number; card: SeedCard }[] = [];
      for (const card of deck.cards) {
        const rows = (await q.query(
          'SELECT `id` FROM `card` WHERE TRIM(`name`) = ?',
          [card.name],
        )) as { id: number }[];
        if (rows.length !== 1)
          throw new Error(
            `StarterDecks : carte "${card.name}" ${rows.length === 0 ? 'introuvable' : `ambiguë (${rows.length} résultats)`}`,
          );
        resolved.push({ id: rows[0].id, card });
      }
      plan.push({ deck, resolved });
    }

    await q.query(
      'CREATE TABLE `starter_deck` (`id` int NOT NULL AUTO_INCREMENT, `archetype` varchar(20) NOT NULL, UNIQUE INDEX `UQ_starter_deck_archetype` (`archetype`), PRIMARY KEY (`id`)) ENGINE=InnoDB',
    );
    await q.query(
      'CREATE TABLE `starter_deck_card` (`id` int NOT NULL AUTO_INCREMENT, `starter_deck_id` int NOT NULL, `card_id` int NOT NULL, `quantity` int NOT NULL DEFAULT 1, `is_featured` tinyint NOT NULL DEFAULT 0, UNIQUE INDEX `UQ_starter_deck_card` (`starter_deck_id`, `card_id`), PRIMARY KEY (`id`)) ENGINE=InnoDB',
    );
    await q.query(
      'ALTER TABLE `starter_deck_card` ADD CONSTRAINT `FK_starter_deck_card_deck` FOREIGN KEY (`starter_deck_id`) REFERENCES `starter_deck`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await q.query(
      'ALTER TABLE `starter_deck_card` ADD CONSTRAINT `FK_starter_deck_card_card` FOREIGN KEY (`card_id`) REFERENCES `card`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION',
    );
    await q.query(
      'ALTER TABLE `user` ADD `starter_claimed_at` timestamp NULL DEFAULT NULL',
    );

    for (const { deck, resolved } of plan) {
      await q.query('INSERT INTO `starter_deck` (`archetype`) VALUES (?)', [
        deck.archetype,
      ]);
      const [{ id: deckId }] = (await q.query(
        'SELECT `id` FROM `starter_deck` WHERE `archetype` = ?',
        [deck.archetype],
      )) as { id: number }[];
      for (const { id, card } of resolved)
        await q.query(
          'INSERT INTO `starter_deck_card` (`starter_deck_id`, `card_id`, `quantity`, `is_featured`) VALUES (?, ?, ?, ?)',
          [deckId, id, card.quantity, card.featured ? 1 : 0],
        );
    }
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE `user` DROP COLUMN `starter_claimed_at`');
    await q.query('DROP TABLE `starter_deck_card`');
    await q.query('DROP TABLE `starter_deck`');
  }
}
