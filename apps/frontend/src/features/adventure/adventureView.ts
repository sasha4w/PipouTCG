import type {
  AdventureOpponentView,
  AdventureOverview,
  AdventureWorldView,
  MatchFoundPayload,
} from "@pipou/shared";

export type PathOffset = -1 | 0 | 1;

/**
 * Décalage horizontal des ronds du chemin, du bas (IA 1) vers le haut (boss) :
 * premier et dernier centrés, ceux du milieu en zigzag gauche/droite.
 */
export function pathLayout(count: number): { offset: PathOffset }[] {
  return Array.from({ length: count }, (_, i) => {
    if (i === 0 || i === count - 1) return { offset: 0 };
    return { offset: i % 2 === 1 ? -1 : 1 };
  });
}

/** Plafond quotidien des récompenses de farm atteint. */
export function capReached(
  overview: Pick<AdventureOverview, "farmRewardsToday" | "dailyCap">,
): boolean {
  return overview.farmRewardsToday >= overview.dailyCap;
}

/** Mondes dans l'ordre de progression (copie). */
export function sortWorlds(worlds: AdventureWorldView[]): AdventureWorldView[] {
  return [...worlds].sort((a, b) => a.order - b.order || a.id - b.id);
}

export function findOpponent(
  overview: AdventureOverview,
  opponentId: number,
): { world: AdventureWorldView; opponent: AdventureOpponentView } | null {
  for (const world of overview.worlds) {
    const opponent = world.opponents.find((o) => o.id === opponentId);
    if (opponent) return { world, opponent };
  }
  return null;
}

/**
 * Partie retrouvée à la connexion : null si c'est celle de cette IA (on la
 * reprend sur place), sinon l'écran où elle se joue.
 */
export function resumeTarget(
  resumed: MatchFoundPayload,
  opponentId: number,
): string | null {
  if (resumed.adventureOpponentId === undefined) return "/fight";
  if (resumed.adventureOpponentId === opponentId) return null;
  return `/adventure/fight/${resumed.adventureOpponentId}`;
}

/**
 * Où aller quand l'écran de duel JcJ retrouve une partie (`fight:resumed`) :
 * une partie contre une IA s'affiche sur son écran d'aventure (null = rester).
 */
export function pvpResumeTarget(resumed: MatchFoundPayload): string | null {
  if (resumed.adventureOpponentId === undefined) return null;
  return `/adventure/fight/${resumed.adventureOpponentId}`;
}

/** Thème de couleur (dégradé) d'une carte de monde, selon son rang : 0 à 3. */
export function worldTheme(index: number): number {
  return index % 4;
}
