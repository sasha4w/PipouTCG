import {
  CardType,
  DrakonStage,
  SupportType,
  canEvolveOnto,
  ephemeralTargetSide,
  evolutionCost,
  isImplanted,
  isPlantedBy,
} from '@pipou/shared';
import type { AdventureArchetype, GameAction, Seat } from '@pipou/shared';
import type { Card } from '../../cards/card.entity';
import type {
  CardInstance,
  GameState,
  MonsterOnBoard,
  PlayerGameState,
} from '../interfaces/game-state.interface';
import { seatPlayer } from '../helpers/game-state.helper';
import type { AiLevel } from './ai-player';
import { activeChoice } from './candidate-actions';

/** Pourquoi une carte en main ne pouvait pas être jouée. */
export type BlockReason = 'paiement' | 'zone' | 'cible' | 'condition';
const BLOCK_REASONS: BlockReason[] = ['paiement', 'zone', 'cible', 'condition'];

/** Compteurs d'une carte de base, pour un archétype contre un autre. */
export interface CardStats {
  card: string;
  archetype: AdventureArchetype;
  vs: AdventureArchetype;
  /** Parties où elle a été jouée. */
  playedGames: number;
  playedWins: number;
  /** Parties où elle a été en main sans jamais être jouée. */
  heldGames: number;
  heldWins: number;
  phasesInHand: number;
  phasesPlayable: number;
  phasesChosen: number;
  blocked: Record<BlockReason, number>;
  /** Observé dans les 2 tours qui suivent chaque fois qu'elle est jouée. */
  oppDestroyed: number;
  primesTaken: number;
  oppDiscarded: number;
  oppBlocked: number;
}

export type IdleReason = 'main_vide' | BlockReason;

export interface DeckStats {
  name: string;
  archetype: AdventureArchetype;
  level: AiLevel;
  mainPhases: number;
  /** Phases principales sans coup utile. */
  idlePhases: number;
  idleReasons: Record<IdleReason, number>;
  /** Phases principales où un coup utile existait mais où l'IA n'en a joué aucun. */
  passivePhases: number;
  /** Défaites, par `game.endReason`. */
  endReasons: Record<string, number>;
  turns: number;
  games: number;
}

export interface Telemetry {
  cards: CardStats[];
  decks: DeckStats[];
}

export interface RecordedEntry {
  name: string;
  archetype: AdventureArchetype;
  level: AiLevel;
}

/** Coups qui ne font rien avancer : une phase qui n'a que ça est « sans coup utile ». */
const USELESS = new Set<GameAction['type']>([
  'end_phase',
  'recycle',
  'change_mode',
]);

/** Fenêtre d'observation de l'impact : jusqu'à la fin du tour T + 2. */
const IMPACT_TURNS = 2;

const zeroReasons = (): Record<BlockReason, number> => ({
  paiement: 0,
  zone: 0,
  cible: 0,
  condition: 0,
});

export function emptyTelemetry(): Telemetry {
  return { cards: [], decks: [] };
}

/** Somme champ à champ de deux objets de compteurs (les textes viennent de `a`). */
function sum<T>(a: T, b: T): T {
  const out = { ...a } as Record<string, unknown>;
  for (const [k, v] of Object.entries(b as Record<string, unknown>)) {
    const cur = out[k];
    if (typeof v === 'number') out[k] = ((cur as number) ?? 0) + v;
    else if (v && typeof v === 'object')
      out[k] = sum((cur ?? {}) as Record<string, unknown>, v);
    else if (cur === undefined) out[k] = v;
  }
  return out as T;
}

export function mergeTelemetry(a: Telemetry, b: Telemetry): Telemetry {
  const merge = <T>(xs: T[], ys: T[], key: (x: T) => string): T[] => {
    const map = new Map(xs.map((x) => [key(x), x]));
    for (const y of ys) {
      const k = key(y);
      const x = map.get(k);
      map.set(k, x ? sum(x, y) : y);
    }
    return [...map.values()];
  };
  return {
    cards: merge(a.cards, b.cards, (c) => `${c.card}|${c.archetype}|${c.vs}`),
    decks: merge(a.decks, b.decks, (d) => d.name),
  };
}

/** Raison principale pour laquelle `card` (en main) n'est pas jouable. */
export function blockReason(
  card: Card,
  me: PlayerGameState,
  opp: PlayerGameState,
): BlockReason {
  const allies = me.monsterZones.filter(
    (m): m is MonsterOnBoard => m !== null && !isImplanted(m, me.userId),
  );
  const tooExpensive = (cost: number) =>
    cost - me.recycleEnergy > me.hand.length - 1;

  if (card.type === CardType.MONSTER) {
    if (
      card.stage === DrakonStage.YOUNG ||
      card.stage === DrakonStage.ADULT ||
      card.stage === DrakonStage.ANCESTRAL
    ) {
      const bases = allies.filter((m) => canEvolveOnto(card, m));
      if (bases.length === 0) return 'cible';
      return bases.every((m) => tooExpensive(evolutionCost(card, m)))
        ? 'paiement'
        : 'condition';
    }
    if (me.monsterZones.every(Boolean)) return 'zone';
    return tooExpensive(card.cost ?? 0) ? 'paiement' : 'condition';
  }
  if (card.supportType === SupportType.EQUIPMENT) {
    const planted = opp.monsterZones.some(
      (m) => m !== null && isPlantedBy(m, me.userId),
    );
    return allies.length === 0 && !planted ? 'cible' : 'condition';
  }
  if (card.supportType === SupportType.TERRAIN)
    return me.supportZones.every(Boolean) ? 'zone' : 'condition';
  const side = ephemeralTargetSide(card.effects);
  if (side === 'ally' && allies.length === 0) return 'cible';
  if (side === 'enemy' && !opp.monsterZones.some(Boolean)) return 'cible';
  return 'condition';
}

/** Carte de la main que le coup utilise (ni le paiement, ni recycler, ni défausser). */
function usedCard(
  game: GameState,
  seat: Seat,
  action: GameAction,
): CardInstance | undefined {
  switch (action.type) {
    case 'summon':
    case 'evolve':
    case 'play_support':
    case 'transform':
      return seatPlayer(game, seat).hand[action.handIndex];
    default:
      return undefined;
  }
}

const other = (seat: Seat): Seat => (seat === 'p1' ? 'p2' : 'p1');
const SEATS: Seat[] = ['p1', 'p2'];

interface Snapshot {
  primes: Record<Seat, number>;
  hand: Record<Seat, Set<string>>;
  graveyard: Record<Seat, Set<string>>;
  blocked: Record<Seat, Set<string>>;
}

function snapshot(game: GameState): Snapshot {
  const per = <T>(f: (p: PlayerGameState) => T): Record<Seat, T> => ({
    p1: f(game.player1),
    p2: f(game.player2),
  });
  return {
    primes: per((p) => p.primes),
    hand: per((p) => new Set(p.hand.map((c) => c.instanceId))),
    graveyard: per((p) => new Set(p.graveyard.map((c) => c.instanceId))),
    blocked: per(
      (p) =>
        new Set(
          p.monsterZones
            .filter(
              (m) =>
                m !== null && ((m.blockAttackTurns ?? 0) > 0 || m.guardLocked),
            )
            .map((m) => m!.instanceId),
        ),
    ),
  };
}

interface Phase {
  key: string;
  seat: Seat;
  inHand: Set<string>;
  playable: Set<string>;
  chosen: Set<string>;
  /** Dernière raison de blocage vue, par carte. */
  reasons: Map<string, BlockReason>;
  useful: boolean;
  /** L'IA a joué au moins un coup utile. */
  acted: boolean;
  handEmpty: boolean;
}

/**
 * Observe une partie de tournoi, coup par coup, sans toucher au moteur :
 * `beforeAction` avec les coups valides et le coup choisi, `afterAction`
 * une fois le coup joué, `finish` à la fin.
 */
export class GameRecorder {
  private readonly rows = new Map<string, CardStats>();
  private readonly decks: Record<Seat, DeckStats>;
  private readonly seen: Record<Seat, Set<string>> = {
    p1: new Set(),
    p2: new Set(),
  };
  private readonly played: Record<Seat, Set<string>> = {
    p1: new Set(),
    p2: new Set(),
  };
  private phase: Phase | null = null;
  private windows: { seat: Seat; card: string; until: number }[] = [];
  private snap: Snapshot | null = null;
  private eventIndex = 0;
  /** Auteur et type du dernier coup, pour attribuer les défausses. */
  private last: { seat: Seat; type: GameAction['type'] } | null = null;

  constructor(private readonly entries: Record<Seat, RecordedEntry>) {
    const deck = (e: RecordedEntry): DeckStats => ({
      name: e.name,
      archetype: e.archetype,
      level: e.level,
      mainPhases: 0,
      idlePhases: 0,
      idleReasons: { main_vide: 0, ...zeroReasons() },
      passivePhases: 0,
      endReasons: {},
      turns: 0,
      games: 0,
    });
    this.decks = { p1: deck(entries.p1), p2: deck(entries.p2) };
  }

  beforeAction(
    game: GameState,
    seat: Seat,
    valid: GameAction[],
    chosen: GameAction,
  ): void {
    this.snap ??= snapshot(game);
    this.last = { seat, type: chosen.type };
    const me = seatPlayer(game, seat);
    if (
      game.phase !== 'main' ||
      game.currentTurnUserId !== me.userId ||
      activeChoice(game)
    )
      return;

    const key = `${game.turnNumber}|${seat}`;
    if (this.phase?.key !== key) {
      this.flush();
      this.phase = {
        key,
        seat,
        inHand: new Set(),
        playable: new Set(),
        chosen: new Set(),
        reasons: new Map(),
        useful: false,
        acted: false,
        handEmpty: true,
      };
    }
    const phase = this.phase;
    phase.handEmpty &&= me.hand.length === 0;
    if (!USELESS.has(chosen.type)) phase.acted = true;

    const playableNow = new Set<string>();
    for (const a of valid) {
      if (!USELESS.has(a.type)) phase.useful = true;
      const c = usedCard(game, seat, a);
      if (c) playableNow.add(c.baseCard.name);
    }
    const opp = seatPlayer(game, other(seat));
    for (const c of me.hand) {
      const name = c.baseCard.name;
      phase.inHand.add(name);
      this.seen[seat].add(name);
      if (playableNow.has(name)) phase.playable.add(name);
      else phase.reasons.set(name, blockReason(c.baseCard, me, opp));
    }

    const used = usedCard(game, seat, chosen);
    if (used) {
      const name = used.baseCard.name;
      phase.chosen.add(name);
      this.played[seat].add(name);
      this.windows.push({
        seat,
        card: name,
        until: game.turnNumber + IMPACT_TURNS,
      });
    }
  }

  afterAction(game: GameState): void {
    const prev = this.snap ?? snapshot(game);
    const now = snapshot(game);
    // Le tournoi ne vide pas pendingEvents : on ne lit que les nouveaux
    if (game.pendingEvents.length < this.eventIndex) this.eventIndex = 0;
    const events = game.pendingEvents.slice(this.eventIndex);
    this.eventIndex = game.pendingEvents.length;

    const delta = (seat: Seat) => {
      const userId = seatPlayer(game, seat).userId;
      return {
        destroyed: events.filter(
          (e) => e.kind === 'monster_destroyed' && e.ownerId === userId,
        ).length,
        primes: Math.max(0, prev.primes[seat] - now.primes[seat]),
        discarded: [...prev.hand[seat]].filter((id) =>
          now.graveyard[seat].has(id),
        ).length,
        blocked: [...now.blocked[seat]].filter(
          (id) => !prev.blocked[seat].has(id),
        ).length,
      };
    };
    const d = { p1: delta('p1'), p2: delta('p2') };

    for (const w of this.windows) {
      const r = this.row(w.seat, w.card);
      const opp = d[other(w.seat)];
      r.oppDestroyed += opp.destroyed;
      r.primesTaken += d[w.seat].primes;
      // Paiements, recyclage, défausse de fin de tour : l'adversaire dépense
      // lui-même. Seuls comptent mes coups et les choix qu'il résout (ex. une
      // défausse imposée par mon effet).
      if (this.last?.seat === w.seat || this.last?.type === 'pick_cards')
        r.oppDiscarded += opp.discarded;
      r.oppBlocked += opp.blocked;
    }
    this.windows = this.windows.filter((w) => game.turnNumber <= w.until);
    this.snap = now;
  }

  finish(game: GameState, winner: Seat | null): Telemetry {
    this.flush();
    for (const seat of SEATS) {
      const won = winner === seat ? 1 : 0;
      for (const name of new Set([...this.seen[seat], ...this.played[seat]])) {
        const r = this.row(seat, name);
        if (this.played[seat].has(name)) {
          r.playedGames += 1;
          r.playedWins += won;
        } else {
          r.heldGames += 1;
          r.heldWins += won;
        }
      }
      const deck = this.decks[seat];
      deck.games += 1;
      deck.turns += game.turnNumber;
      if (winner === other(seat)) {
        const reason = game.endReason ?? 'inconnue';
        deck.endReasons[reason] = (deck.endReasons[reason] ?? 0) + 1;
      }
    }
    return {
      cards: [...this.rows.values()],
      decks: [this.decks.p1, this.decks.p2],
    };
  }

  private row(seat: Seat, card: string): CardStats {
    const archetype = this.entries[seat].archetype;
    const vs = this.entries[other(seat)].archetype;
    const key = `${card}|${archetype}|${vs}`;
    let r = this.rows.get(key);
    if (!r) {
      r = {
        card,
        archetype,
        vs,
        playedGames: 0,
        playedWins: 0,
        heldGames: 0,
        heldWins: 0,
        phasesInHand: 0,
        phasesPlayable: 0,
        phasesChosen: 0,
        blocked: zeroReasons(),
        oppDestroyed: 0,
        primesTaken: 0,
        oppDiscarded: 0,
        oppBlocked: 0,
      };
      this.rows.set(key, r);
    }
    return r;
  }

  /** Clôt la phase principale en cours : compteurs de cartes et du deck. */
  private flush(): void {
    const phase = this.phase;
    if (!phase) return;
    this.phase = null;
    const deck = this.decks[phase.seat];
    deck.mainPhases += 1;
    const counts = zeroReasons();
    for (const name of phase.inHand) {
      const r = this.row(phase.seat, name);
      r.phasesInHand += 1;
      if (phase.chosen.has(name)) r.phasesChosen += 1;
      if (phase.playable.has(name)) {
        r.phasesPlayable += 1;
        continue;
      }
      const reason = phase.reasons.get(name) ?? 'condition';
      r.blocked[reason] += 1;
      counts[reason] += 1;
    }
    if (phase.useful) {
      if (!phase.acted) deck.passivePhases += 1;
      return;
    }
    deck.idlePhases += 1;
    const reason: IdleReason = phase.handEmpty
      ? 'main_vide'
      : BLOCK_REASONS.reduce(
          (a, b) => (counts[b] > counts[a] ? b : a),
          'condition',
        );
    deck.idleReasons[reason] += 1;
  }
}
