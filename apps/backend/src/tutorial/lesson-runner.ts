import type {
  GameAction,
  Seat,
  TutorialButton,
  TutorialHint,
  TutorialStepView,
} from '@pipou/shared';
import { normalizeCardName } from '../fights/effects/card-name';
import { currentChoice } from '../fights/helpers/game-state.helper';
import type {
  CardInstance,
  GameState,
  MonsterOnBoard,
  PlayerGameState,
} from '../fights/interfaces/game-state.interface';
import type { Expect, Lesson, LessonStep } from './lesson.types';

const same = (a: string, b: string): boolean =>
  normalizeCardName(a) === normalizeCardName(b);

const sideOf = (game: GameState, seat: Seat): PlayerGameState =>
  seat === 'p1' ? game.player1 : game.player2;

const otherSeat = (seat: Seat): Seat => (seat === 'p1' ? 'p2' : 'p1');

function handIndexOf(
  player: PlayerGameState,
  name: string,
  taken: readonly number[] = [],
): number {
  return player.hand.findIndex(
    (c, i) => !taken.includes(i) && same(c.baseCard.name, name),
  );
}

/** Indices de main pour des noms (un même nom deux fois = deux cartes distinctes). */
function handIndicesOf(
  player: PlayerGameState,
  names: readonly string[],
): number[] {
  const out: number[] = [];
  for (const n of names) out.push(handIndexOf(player, n, out));
  return out;
}

function monsterNamed(
  player: PlayerGameState,
  name: string,
): MonsterOnBoard | undefined {
  return (
    player.monsterZones.find((m) => m && same(m.card.baseCard.name, name)) ??
    undefined
  );
}

/** Équipement ou support en jeu que l'on peut remplacer, par son nom. */
function replaceable(
  player: PlayerGameState,
  name: string,
): string | undefined {
  return [
    ...player.supportZones,
    ...player.monsterZones.flatMap((m) => m?.equipments ?? []),
  ].find((c) => c && same(c.baseCard.name, name))?.instanceId;
}

function sameSet<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((x) => b.includes(x));
}

/**
 * Suit une leçon : étape courante, validation de l'action du joueur,
 * résolution du coup scripté de l'adversaire et indication à l'écran.
 * Pur : ne touche jamais à la partie.
 */
export class LessonRunner {
  private cursor = 0;

  constructor(readonly lesson: Lesson) {}

  get index(): number {
    return this.cursor;
  }

  get step(): LessonStep | undefined {
    return this.lesson.steps[this.cursor];
  }

  get done(): boolean {
    return this.cursor >= this.lesson.steps.length;
  }

  advance(): void {
    if (!this.done) this.cursor += 1;
  }

  /** `action` du joueur du siège `seat` est-elle celle que l'étape attend ? */
  matches(game: GameState, seat: Seat, action: GameAction): boolean {
    const step = this.step;
    if (step?.kind !== 'player') return false;
    return this.actionMatches(game, seat, step.expect, action);
  }

  /** Coup de l'adversaire pour l'étape courante, ou null hors étape adverse. */
  scripted(game: GameState, seat: Seat): GameAction | null {
    const step = this.step;
    if (step?.kind !== 'opponent') return null;
    return this.resolve(game, seat, step.do);
  }

  /**
   * L'action exacte que l'étape courante attend (joueur ou adversaire) ; sert
   * aux tests qui rejouent une leçon de bout en bout.
   */
  expectedAction(game: GameState, seat: Seat): GameAction | null {
    const step = this.step;
    if (!step || step.kind === 'info') return null;
    return this.resolve(
      game,
      seat,
      step.kind === 'player' ? step.expect : step.do,
    );
  }

  /** Étape courante telle que l'écran la montre. */
  view(game: GameState, seat: Seat): TutorialStepView | undefined {
    const step = this.step;
    if (!step) return undefined;
    const visible = this.lesson.steps.filter((s) => s.kind !== 'opponent');
    const index = this.lesson.steps
      .slice(0, this.cursor)
      .filter((s) => s.kind !== 'opponent').length;
    const hint =
      step.kind === 'player' ? this.hint(game, seat, step.expect) : undefined;
    const textKey = step.key.startsWith('common.')
      ? `tutorial.${step.key}`
      : `tutorial.${this.lesson.id}.${step.key}`;
    return {
      lessonId: this.lesson.id,
      index,
      total: visible.length,
      kind: step.kind,
      textKey,
      ...(hint && { hint }),
    };
  }

  // ── Interne ──────────────────────────────────────────────────────────────

  private actionMatches(
    game: GameState,
    seat: Seat,
    e: Expect,
    a: GameAction,
  ): boolean {
    const me = sideOf(game, seat);
    const opp = sideOf(game, otherSeat(seat));
    const handName = (i: number): string | undefined =>
      me.hand[i]?.baseCard.name;
    const paymentOk = (pay: readonly string[] | undefined, idx: number[]) => {
      if (!pay) return true;
      const expected = handIndicesOf(me, pay);
      return (
        expected.every((i) => i >= 0) &&
        idx.length === expected.length &&
        // Les noms payés doivent être les noms attendus (homonymes interchangeables)
        sameSet(
          idx.map((i) => normalizeCardName(handName(i) ?? '')).sort(),
          pay.map(normalizeCardName).sort(),
        )
      );
    };

    switch (e.type) {
      case 'end_phase':
        return a.type === 'end_phase';
      case 'recycle':
        return (
          a.type === 'recycle' && same(handName(a.handIndex) ?? '', e.card)
        );
      case 'transform':
        return (
          a.type === 'transform' && same(handName(a.handIndex) ?? '', e.card)
        );
      case 'discard':
        return (
          a.type === 'discard' && same(handName(a.handIndex) ?? '', e.card)
        );
      case 'summon':
        return (
          a.type === 'summon' &&
          same(handName(a.handIndex) ?? '', e.card) &&
          a.zoneIndex === e.zone &&
          !!a.onOpponentSide === !!e.onOpponentSide &&
          paymentOk(e.pay, a.paymentHandIndices) &&
          (!e.releve ||
            sameSet(
              (a.releveInstanceIds ?? []).slice().sort(),
              e.releve.map((n) => monsterNamed(me, n)?.instanceId ?? '').sort(),
            ))
        );
      case 'play_support': {
        if (a.type !== 'play_support') return false;
        if (!same(handName(a.handIndex) ?? '', e.card)) return false;
        if (e.zone !== undefined && a.zoneIndex !== e.zone) return false;
        if (e.target) {
          const owner = e.targetSide === 'me' ? me : opp;
          if (a.targetInstanceId !== monsterNamed(owner, e.target)?.instanceId)
            return false;
        }
        if (e.replace && a.replaceInstanceId !== replaceable(me, e.replace))
          return false;
        return true;
      }
      case 'attack': {
        if (a.type !== 'attack') return false;
        if (a.attackerInstanceId !== monsterNamed(me, e.attacker)?.instanceId)
          return false;
        return e.target
          ? !a.direct &&
              a.targetInstanceId ===
                monsterNamed(e.targetSide === 'me' ? me : opp, e.target)
                  ?.instanceId
          : a.direct === true;
      }
      case 'change_mode':
        return (
          a.type === 'change_mode' &&
          a.mode === e.mode &&
          a.instanceId === monsterNamed(me, e.monster)?.instanceId
        );
      case 'evolve':
        return (
          a.type === 'evolve' &&
          same(handName(a.handIndex) ?? '', e.card) &&
          a.targetInstanceId === monsterNamed(me, e.target)?.instanceId &&
          paymentOk(e.pay, a.paymentHandIndices)
        );
      case 'pick_cards': {
        if (a.type !== 'pick_cards') return false;
        const choice = currentChoice(game);
        if (!choice) return false;
        const names = a.instanceIds.map(
          (id) =>
            choice.candidates.find((c) => c.instanceId === id)?.baseCard.name,
        );
        return (
          names.length === e.cards.length &&
          sameSet(
            names.map((n) => normalizeCardName(n ?? '')).sort(),
            e.cards.map(normalizeCardName).sort(),
          )
        );
      }
    }
  }

  /** Action du moteur pour un coup scripté ; null si la carte n'est pas là. */
  private resolve(game: GameState, seat: Seat, e: Expect): GameAction | null {
    const me = sideOf(game, seat);
    const opp = sideOf(game, otherSeat(seat));
    const hand = (name: string): number => handIndexOf(me, name);
    switch (e.type) {
      case 'end_phase':
        return { type: 'end_phase' };
      case 'recycle':
        return { type: 'recycle', handIndex: hand(e.card) };
      case 'transform':
        return { type: 'transform', handIndex: hand(e.card) };
      case 'discard':
        return { type: 'discard', handIndex: hand(e.card) };
      case 'summon':
        return {
          type: 'summon',
          handIndex: hand(e.card),
          zoneIndex: e.zone,
          paymentHandIndices: handIndicesOf(me, e.pay ?? []),
          ...(e.onOpponentSide && { onOpponentSide: true }),
          ...(e.releve && {
            releveInstanceIds: e.releve.map(
              (n) => monsterNamed(me, n)?.instanceId ?? '',
            ),
          }),
        };
      case 'play_support':
        return {
          type: 'play_support',
          handIndex: hand(e.card),
          ...(e.zone !== undefined && { zoneIndex: e.zone }),
          ...(e.replace && { replaceInstanceId: replaceable(me, e.replace) }),
          ...(e.target && {
            targetInstanceId: monsterNamed(
              e.targetSide === 'me' ? me : opp,
              e.target,
            )?.instanceId,
          }),
        };
      case 'attack':
        return {
          type: 'attack',
          attackerInstanceId: monsterNamed(me, e.attacker)?.instanceId ?? '',
          ...(e.target
            ? {
                targetInstanceId: monsterNamed(
                  e.targetSide === 'me' ? me : opp,
                  e.target,
                )?.instanceId,
                direct: false,
              }
            : { direct: true }),
        };
      case 'change_mode':
        return {
          type: 'change_mode',
          instanceId: monsterNamed(me, e.monster)?.instanceId ?? '',
          mode: e.mode,
        };
      case 'evolve':
        return {
          type: 'evolve',
          handIndex: hand(e.card),
          targetInstanceId: monsterNamed(me, e.target)?.instanceId ?? '',
          paymentHandIndices: handIndicesOf(me, e.pay ?? []),
        };
      case 'pick_cards': {
        const choice = currentChoice(game);
        const taken = new Set<string>();
        const ids = e.cards.map((n) => {
          const c = choice?.candidates.find(
            (x) => !taken.has(x.instanceId) && same(x.baseCard.name, n),
          );
          if (c) taken.add(c.instanceId);
          return c?.instanceId ?? '';
        });
        return { type: 'pick_cards', instanceIds: ids };
      }
    }
  }

  private hint(
    game: GameState,
    seat: Seat,
    e: Expect,
  ): TutorialHint | undefined {
    const me = sideOf(game, seat);
    const opp = sideOf(game, otherSeat(seat));
    const cards: string[] = [];
    const zones: NonNullable<TutorialHint['zones']> = [];
    let button: TutorialButton | undefined;
    const addHand = (names: readonly string[]) => {
      const idx = handIndicesOf(me, names);
      for (const i of idx) if (i >= 0) cards.push(me.hand[i].instanceId);
    };
    const addBoard = (owner: PlayerGameState, name: string) => {
      const m = monsterNamed(owner, name);
      if (m) cards.push(m.instanceId);
    };

    switch (e.type) {
      case 'end_phase':
        button = 'end_phase';
        break;
      case 'recycle':
        addHand([e.card]);
        button = 'recycle';
        break;
      case 'transform':
      case 'discard':
        addHand([e.card]);
        break;
      case 'summon':
        addHand([e.card, ...(e.pay ?? [])]);
        zones.push({ side: 'me', kind: 'monster', index: e.zone });
        e.releve?.forEach((n) => addBoard(me, n));
        break;
      case 'play_support':
        addHand([e.card]);
        if (e.target) addBoard(e.targetSide === 'me' ? me : opp, e.target);
        if (e.zone !== undefined)
          zones.push({ side: 'me', kind: 'support', index: e.zone });
        break;
      case 'attack':
        addBoard(me, e.attacker);
        if (e.target) addBoard(e.targetSide === 'me' ? me : opp, e.target);
        else button = 'direct_attack';
        break;
      case 'change_mode':
        addBoard(me, e.monster);
        button = e.mode === 'guard' ? 'guard_mode' : 'attack_mode';
        break;
      case 'evolve':
        addHand([e.card, ...(e.pay ?? [])]);
        addBoard(me, e.target);
        break;
      case 'pick_cards': {
        const choice = currentChoice(game);
        for (const n of e.cards) {
          const c: { instanceId: string } | undefined = choice?.candidates.find(
            (x) => same(x.baseCard.name, n),
          );
          if (c) cards.push(c.instanceId);
        }
        break;
      }
    }
    if (!cards.length && !zones.length && !button) return undefined;
    return {
      ...(cards.length && { cards }),
      ...(zones.length && { zones }),
      ...(button && { button }),
    };
  }
}

export type { CardInstance };
