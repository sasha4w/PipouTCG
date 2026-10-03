// Extrait la table `card` du dump local (apps/backend/.e2e/aiven-dump.sql) vers
// src/fights/testing/fixtures/cards.snapshot.json. Seules les données de jeu
// (table card) sont lues : aucune donnée de joueur n'est écrite.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const backendDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const dumpPath = join(backendDir, '.e2e', 'aiven-dump.sql');
const outPath = join(
  backendDir,
  'src',
  'fights',
  'testing',
  'fixtures',
  'cards.snapshot.json',
);

// Ordre des colonnes de la table `card` dans le dump
const COLUMNS = [
  'id',
  'name',
  'rarity',
  'type',
  'atk',
  'hp',
  'cost',
  'supportType',
  'archetype',
  'effects',
  'description',
  'imageId',
  'cardSetId',
];

const line = readFileSync(dumpPath, 'utf8')
  .split(/\r?\n/)
  .find((l) => l.startsWith('INSERT INTO `card` VALUES'));
if (!line) throw new Error('INSERT INTO `card` introuvable dans le dump');

/** Découpe les tuples SQL `(1,'a\'b',NULL),(...)` en tableaux de valeurs. */
function parseTuples(values) {
  const rows = [];
  let row = null;
  let i = 0;
  while (i < values.length) {
    const ch = values[i];
    if (row === null) {
      if (ch === '(') row = [];
      i++;
      continue;
    }
    if (ch === ')') {
      rows.push(row);
      row = null;
      i++;
      continue;
    }
    if (ch === ',') {
      i++;
      continue;
    }
    if (ch === "'") {
      let s = '';
      i++;
      while (values[i] !== "'") {
        if (values[i] === '\\') {
          const next = values[i + 1];
          s += next === 'n' ? '\n' : next;
          i += 2;
        } else {
          s += values[i];
          i++;
        }
      }
      row.push(s);
      i++;
      continue;
    }
    let j = i;
    while (values[j] !== ',' && values[j] !== ')') j++;
    const raw = values.slice(i, j);
    row.push(raw === 'NULL' ? null : Number(raw));
    i = j;
  }
  return rows;
}

const cards = parseTuples(
  line.slice(line.indexOf('VALUES') + 'VALUES'.length),
).map((r) => {
  const c = Object.fromEntries(COLUMNS.map((key, idx) => [key, r[idx]]));
  return {
    id: c.id,
    name: c.name,
    rarity: c.rarity,
    type: c.type,
    atk: c.atk,
    hp: c.hp,
    cost: c.cost,
    supportType: c.supportType,
    archetype: c.archetype,
    effects: c.effects ? JSON.parse(c.effects) : null,
    description: c.description,
  };
});

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(cards, null, 2)}\n`);
console.log(`${cards.length} cartes écrites dans ${outPath}`);
