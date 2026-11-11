import type {
  CombatMode,
  GamePhase,
  Seat,
  TutorialLessonId,
} from '@pipou/shared';
import type { PlayerSpec } from '../fights/helpers/board-builder';

/**
 * Action attendue (joueur) ou scriptée (adversaire), exprimée avec des noms de
 * cartes : les `instanceId` n'existent qu'au lancement de la leçon. Un nom
 * désigne la première carte de ce nom (main) ou le monstre de ce nom (plateau) ;
 * les plateaux des leçons n'ont donc jamais deux monstres homonymes du même côté.
 */
export type Expect =
  | { type: 'end_phase' }
  | { type: 'recycle'; card: string }
  | {
      type: 'summon';
      card: string;
      zone: number;
      /** Cartes de la main défaussées en paiement ; absent = paiement libre. */
      pay?: string[];
      /** Alliés Pipou sacrifiés (Relève). */
      releve?: string[];
      /** Invocation sur une zone libre du terrain adverse (Zeta). */
      onOpponentSide?: boolean;
    }
  | {
      type: 'play_support';
      card: string;
      /** Monstre visé (côté `targetSide`, adverse par défaut). */
      target?: string;
      targetSide?: 'me' | 'opponent';
      zone?: number;
      replace?: string;
    }
  | {
      type: 'attack';
      attacker: string;
      target?: string;
      /** Camp de la cible : adverse par défaut ; `me` = désinfection d'un Zeta implanté chez soi. */
      targetSide?: 'me' | 'opponent';
    }
  | { type: 'change_mode'; monster: string; mode: CombatMode }
  | { type: 'evolve'; card: string; target: string; pay?: string[] }
  | { type: 'transform'; card: string }
  | { type: 'discard'; card: string }
  | { type: 'pick_cards'; cards: string[] };

/** Étape sans action : le joueur lit puis clique « Suivant ». */
export interface InfoStep {
  kind: 'info';
  key: string;
}

/** Le joueur doit jouer exactement `expect`. */
export interface PlayerStep {
  kind: 'player';
  key: string;
  expect: Expect;
  /**
   * Le moteur doit REFUSER l'action : la leçon montre un refus (immunité) puis
   * avance sans rien changer au plateau.
   */
  refused?: boolean;
}

/** L'adversaire scripté joue seul. */
export interface OpponentStep {
  kind: 'opponent';
  key: string;
  do: Expect;
}

export type LessonStep = InfoStep | PlayerStep | OpponentStep;

export interface LessonBoard {
  /** Cartes par nom ; le joueur est `p1`, l'adversaire scripté `p2`. */
  p1: PlayerSpecByName;
  p2: PlayerSpecByName;
  phase?: GamePhase;
  /** Joueur actif au départ (p1 par défaut). */
  turn?: Seat;
  turnNumber?: number;
}

/** `PlayerSpec` dont les cartes sont désignées par leur nom. */
export type PlayerSpecByName = Omit<
  PlayerSpec,
  'hand' | 'deck' | 'graveyard' | 'monsters' | 'supports'
> & {
  hand?: string[];
  /** Ordre de pioche : le premier nom est la prochaine carte piochée. */
  deck?: string[];
  graveyard?: string[];
  monsters?: (MonsterSpecByName | string | null)[];
  supports?: (string | null)[];
};

export interface MonsterSpecByName {
  card: string;
  mode?: CombatMode;
  currentHp?: number;
  equipments?: string[];
  summonedThisTurn?: boolean;
  /** Monstre implanté (Zeta) par ce siège, chez l'autre joueur. */
  implantedBy?: Seat;
  /** Compte à rebours restant (Zeta). */
  turnCounter?: number;
}

export interface Lesson {
  id: TutorialLessonId;
  board: LessonBoard;
  steps: LessonStep[];
}

/** Noms de toutes les cartes dont la leçon a besoin (plateau, scripts, étapes). */
export function lessonCardNames(lesson: Lesson): string[] {
  const names = new Set<string>();
  const mon = (m: MonsterSpecByName | string | null | undefined) => {
    if (!m) return;
    if (typeof m === 'string') names.add(m);
    else {
      names.add(m.card);
      m.equipments?.forEach((e) => names.add(e));
    }
  };
  for (const p of [lesson.board.p1, lesson.board.p2]) {
    [...(p.hand ?? []), ...(p.deck ?? []), ...(p.graveyard ?? [])].forEach(
      (n) => names.add(n),
    );
    p.monsters?.forEach(mon);
    p.supports?.forEach((s) => s && names.add(s));
  }
  return [...names];
}
