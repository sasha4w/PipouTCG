/** Leçons du tutoriel, dans l'ordre d'apprentissage. L'identifiant est stocké en base. */
export const TUTORIAL_LESSONS = [
  "first-turn",
  "combat",
  "guard",
  "supports",
  "control",
  "pipou",
  "drakon",
  "pixelman",
  "statuses",
] as const;
export type TutorialLessonId = (typeof TUTORIAL_LESSONS)[number];

export const isTutorialLessonId = (v: unknown): v is TutorialLessonId =>
  typeof v === "string" && (TUTORIAL_LESSONS as readonly string[]).includes(v);

/** Récompense versée une seule fois par leçon (valeurs du niveau 1 d'Aventure). */
export const TUTORIAL_REWARD = { gold: 100, xp: 50 } as const;

/** Bouton de l'interface à mettre en avant. */
export type TutorialButton =
  | "end_phase"
  | "end_turn"
  | "recycle"
  | "attack_mode"
  | "guard_mode"
  | "direct_attack";

/** Ce que la bulle de la leçon désigne : cartes, zones libres ou bouton. */
export interface TutorialHint {
  /** `instanceId` des cartes à mettre en avant (main, plateau, adversaire). */
  cards?: string[];
  /** Zones vides à mettre en avant. */
  zones?: { side: "me" | "opponent"; kind: "monster" | "support"; index: number }[];
  button?: TutorialButton;
}

/**
 * - `info`     : explication, le joueur clique « Suivant » ;
 * - `player`   : le joueur doit jouer l'action désignée (toute autre est refusée) ;
 * - `opponent` : l'adversaire scripté joue seul.
 */
export type TutorialStepKind = "info" | "player" | "opponent";

export interface TutorialStepView {
  lessonId: TutorialLessonId;
  /** Rang de l'étape, à partir de 0. */
  index: number;
  total: number;
  kind: TutorialStepKind;
  /** Clé i18n du texte : `tutorial.<leçon>.<étape>`. */
  textKey: string;
  hint?: TutorialHint;
}
