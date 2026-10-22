import type { AdventureArchetype } from '@pipou/shared';
import type {
  BlockReason,
  CardStats,
  IdleReason,
  Telemetry,
} from './telemetry';
import type { TournamentResult } from './tournament';

/** Parties minimales (jouée et gardée) avant de juger une carte. */
export const MIN_SAMPLE = 30;
/** Valeur ajoutée, en points, au-delà de laquelle une carte est « trop forte ». */
export const TOO_STRONG_POINTS = 15;
/** Part des phases en main où elle est jouable, sous laquelle elle est « morte ». */
export const DEAD_PLAYABLE = 0.2;
/** Part des phases jouables où elle est choisie, sous laquelle elle est « morte ». */
export const DEAD_CHOSEN = 0.1;
/** Part des phases principales sans coup utile au-delà de laquelle un deck manque de quelque chose. */
export const IDLE_SHARE = 0.25;
/** Alertes affichées dans le résumé. */
const SUMMARY_ALERTS = 10;

const ARCHETYPES: AdventureArchetype[] = ['pipou', 'pixelman', 'dragon'];

const REASON_TEXT: Record<IdleReason, string> = {
  main_vide: 'main vide',
  paiement: 'pas assez de cartes pour payer',
  zone: 'pas de zone libre',
  cible: 'pas de cible',
  condition: 'condition non remplie',
};

/** Intervalle de Wilson à 95 % d'une proportion (bornes entre 0 et 1). */
export function wilson(wins: number, n: number): { low: number; high: number } {
  if (n === 0) return { low: 0, high: 1 };
  const z = 1.96;
  const p = wins / n;
  const denom = 1 + (z * z) / n;
  const center = p + (z * z) / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return {
    low: Math.max(0, (center - margin) / denom),
    high: Math.min(1, (center + margin) / denom),
  };
}

export type AlertKind = 'trop_forte' | 'morte' | 'manque_deck';

export interface Alert {
  kind: AlertKind;
  /** Carte, ou archétype pour un manque du deck. */
  subject: string;
  archetype: AdventureArchetype;
  detail: string;
  strength: number;
}

/** Valeur ajoutée en points, ou null si pas assez de données. */
export function addedValue(c: CardStats): number | null {
  if (c.playedGames < MIN_SAMPLE || c.heldGames < MIN_SAMPLE) return null;
  return 100 * (c.playedWins / c.playedGames - c.heldWins / c.heldGames);
}

const pct = (x: number) => `${(100 * x).toFixed(0)} %`;

/** Lignes d'une même carte de base d'un archétype, tous adversaires. */
function byCard(t: Telemetry): Map<string, CardStats[]> {
  const out = new Map<string, CardStats[]>();
  for (const c of t.cards) {
    const key = `${c.card}|${c.archetype}`;
    out.set(key, [...(out.get(key) ?? []), c]);
  }
  return out;
}

/** Alertes calculées sur la télémétrie, les plus marquées d'abord. */
export function alerts(t: Telemetry): Alert[] {
  const out: Alert[] = [];

  for (const rows of byCard(t).values()) {
    const { card, archetype } = rows[0];
    const others = ARCHETYPES.filter((a) => a !== archetype);
    const values = others.map((vs) => {
      const r = rows.find((x) => x.vs === vs);
      return r ? addedValue(r) : null;
    });
    if (values.every((v) => v !== null && v > TOO_STRONG_POINTS)) {
      const v = values as number[];
      out.push({
        kind: 'trop_forte',
        subject: card,
        archetype,
        detail: others
          .map((vs, i) => `+${v[i].toFixed(0)} pts contre ${vs}`)
          .join(', '),
        strength: Math.min(...v),
      });
    }

    const inHand = rows.reduce((n, r) => n + r.phasesInHand, 0);
    if (inHand >= MIN_SAMPLE) {
      const playable = rows.reduce((n, r) => n + r.phasesPlayable, 0);
      const chosen = rows.reduce((n, r) => n + r.phasesChosen, 0);
      const playRate = playable / inHand;
      const chooseRate = playable === 0 ? 0 : chosen / playable;
      if (playRate < DEAD_PLAYABLE)
        out.push({
          kind: 'morte',
          subject: card,
          archetype,
          detail: `jouable ${pct(playRate)} du temps en main`,
          strength: 100 * (DEAD_PLAYABLE - playRate),
        });
      else if (chooseRate < DEAD_CHOSEN)
        out.push({
          kind: 'morte',
          subject: card,
          archetype,
          detail: `choisie ${pct(chooseRate)} du temps quand elle est jouable`,
          strength: 100 * (DEAD_CHOSEN - chooseRate),
        });
    }
  }

  for (const archetype of ARCHETYPES) {
    const decks = t.decks.filter((d) => d.archetype === archetype);
    const main = decks.reduce((n, d) => n + d.mainPhases, 0);
    const idle = decks.reduce((n, d) => n + d.idlePhases, 0);
    if (main === 0 || idle / main <= IDLE_SHARE) continue;
    const reasons = Object.keys(REASON_TEXT) as IdleReason[];
    const count = (r: IdleReason) =>
      decks.reduce((n, d) => n + d.idleReasons[r], 0);
    const top = reasons.reduce((a, b) => (count(b) > count(a) ? b : a));
    out.push({
      kind: 'manque_deck',
      subject: archetype,
      archetype,
      detail: `${pct(idle / main)} des phases principales sans coup utile (surtout : ${REASON_TEXT[top]}, ${top})`,
      strength: 100 * (idle / main - IDLE_SHARE),
    });
  }

  return out.sort((a, b) => b.strength - a.strength);
}

const KIND_TEXT: Record<AlertKind, string> = {
  trop_forte: 'trop forte',
  morte: 'morte',
  manque_deck: 'manque du deck',
};

const rate = (wins: number, n: number): string => {
  if (n === 0) return '-';
  const { low, high } = wilson(wins, n);
  return `${((100 * wins) / n).toFixed(1)} % [${(100 * low).toFixed(1)}–${(100 * high).toFixed(1)}]`;
};

/** Résumé court : archétypes avec intervalles, decks, 10 alertes. */
export function formatSummary(r: TournamentResult, label: string): string {
  const list = alerts(r.telemetry);
  const decks = [...r.byEntry].sort(
    (a, b) =>
      ARCHETYPES.indexOf(a.archetype) - ARCHETYPES.indexOf(b.archetype) ||
      a.level - b.level,
  );
  return [
    `# Tournoi — ${label}`,
    '',
    `${r.games} parties. Taux [intervalle de confiance à 95 %].`,
    '',
    '## Archétype contre archétype',
    '',
    `| Ligne contre colonne | ${ARCHETYPES.join(' | ')} |`,
    `|---|${ARCHETYPES.map(() => '---').join('|')}|`,
    ...ARCHETYPES.map(
      (a) =>
        `| ${a} | ${ARCHETYPES.map((b) => rate(r.byArchetype[a][b].wins, r.byArchetype[a][b].played)).join(' | ')} |`,
    ),
    '',
    '## Par deck',
    '',
    '| Deck | Victoires | Parties | Taux |',
    '|---|---|---|---|',
    ...decks.map(
      (e) =>
        `| ${e.name} | ${e.wins} | ${e.played} | ${rate(e.wins, e.played)} |`,
    ),
    '',
    `## Alertes (${Math.min(SUMMARY_ALERTS, list.length)} sur ${list.length})`,
    '',
    ...list
      .slice(0, SUMMARY_ALERTS)
      .map(
        (a) =>
          `- ${a.subject} (${a.archetype}) — ${KIND_TEXT[a.kind]} : ${a.detail}`,
      ),
  ].join('\n');
}

const perGame = (x: number, games: number) =>
  games === 0 ? '-' : (x / games).toFixed(2);

const BLOCK_SHORT: Record<BlockReason, string> = {
  paiement: 'paie',
  zone: 'zone',
  cible: 'cible',
  condition: 'cond',
};

/** Détail complet : une ligne par carte et par adversaire, puis les decks. */
export function formatDetail(r: TournamentResult): string {
  const lines: string[] = ['# Détail par carte', ''];
  for (const archetype of ARCHETYPES) {
    const rows = r.telemetry.cards
      .filter((c) => c.archetype === archetype)
      .sort((a, b) => a.card.localeCompare(b.card) || a.vs.localeCompare(b.vs));
    if (rows.length === 0) continue;
    lines.push(
      `## ${archetype}`,
      '',
      '| Carte | Contre | Jouée | Gagnées (jouée) | En main seule | Gagnées (main) | Valeur ajoutée | Jouable | Choisie | Blocages | Détruits / partie | Primes / partie | Défausses / partie | Bloqués / partie |',
      '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
      ...rows.map((c) => {
        const v = addedValue(c);
        const blocks = (Object.keys(BLOCK_SHORT) as BlockReason[])
          .filter((k) => c.blocked[k] > 0)
          .map((k) => `${BLOCK_SHORT[k]} ${c.blocked[k]}`)
          .join(', ');
        return [
          '',
          c.card,
          c.vs,
          c.playedGames,
          c.playedWins,
          c.heldGames,
          c.heldWins,
          v === null ? 'données insuffisantes' : `${v.toFixed(1)} pts`,
          c.phasesInHand === 0 ? '-' : pct(c.phasesPlayable / c.phasesInHand),
          c.phasesPlayable === 0 ? '-' : pct(c.phasesChosen / c.phasesPlayable),
          blocks || '-',
          perGame(c.oppDestroyed, c.playedGames),
          perGame(c.primesTaken, c.playedGames),
          perGame(c.oppDiscarded, c.playedGames),
          perGame(c.oppBlocked, c.playedGames),
          '',
        ]
          .join(' | ')
          .trim();
      }),
      '',
    );
  }
  lines.push(
    '## Decks',
    '',
    '| Deck | Parties | Tours / partie | Phases sans coup utile | Raisons | Défaites par cause |',
    '|---|---|---|---|---|---|',
    ...r.telemetry.decks.map((d) => {
      const reasons = (Object.keys(REASON_TEXT) as IdleReason[])
        .filter((k) => d.idleReasons[k] > 0)
        .map((k) => `${REASON_TEXT[k]} ${d.idleReasons[k]}`)
        .join(', ');
      const ends = Object.entries(d.endReasons)
        .map(([k, n]) => `${k} ${n}`)
        .join(', ');
      return `| ${d.name} | ${d.games} | ${perGame(d.turns, d.games)} | ${d.mainPhases === 0 ? '-' : pct(d.idlePhases / d.mainPhases)} | ${reasons || '-'} | ${ends || '-'} |`;
    }),
  );
  return lines.join('\n');
}

/** Taux minimal du nouveau cerveau contre l'ancien, dans chaque archétype. */
export const MIRROR_MIN_RATE = 0.6;
/** Écart maximal, en points, entre le meilleur et le moins bon archétype. */
export const MIRROR_MAX_GAP = 10;

/**
 * Résumé d'un miroir : taux du nouveau cerveau contre l'ancien par archétype,
 * écart entre archétypes et verdict de force égale.
 */
export function formatMirror(r: TournamentResult): string {
  const rows = ARCHETYPES.map((archetype) => {
    const mine = r.byEntry.filter(
      (e) => e.archetype === archetype && e.name.endsWith(' nouveau'),
    );
    const wins = mine.reduce((n, e) => n + e.wins, 0);
    const played = mine.reduce((n, e) => n + e.played, 0);
    return { archetype, wins, played, rate: played === 0 ? 0 : wins / played };
  });
  const rates = rows.map((x) => 100 * x.rate);
  const gap = Math.max(...rates) - Math.min(...rates);
  const ok =
    rows.every((x) => x.rate >= MIRROR_MIN_RATE) && gap < MIRROR_MAX_GAP;
  return [
    '# Miroir : nouveau cerveau contre ancien',
    '',
    `${r.games} parties.`,
    '',
    '| Archétype | Victoires du nouveau | Parties | Taux |',
    '|---|---|---|---|',
    ...rows.map(
      (x) =>
        `| ${x.archetype} | ${x.wins} | ${x.played} | ${rate(x.wins, x.played)} |`,
    ),
    '',
    `Écart entre archétypes : ${gap.toFixed(1)} points.`,
    '',
    `Verdict : ${ok ? 'critère atteint' : 'critère non atteint'} (au moins ${100 * MIRROR_MIN_RATE} % partout, écart sous ${MIRROR_MAX_GAP} points).`,
  ].join('\n');
}
