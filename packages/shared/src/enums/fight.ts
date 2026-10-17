/** Cause d'une destruction de monstre en duel, transmise au client pour l'animation. */
export const DestroyCause = {
  COMBAT: "combat",
  EFFECT: "effect",
  SACRIFICE: "sacrifice",
  SELF_DESTRUCT: "self_destruct",
  HP_DEPLETED: "hp_depleted",
} as const;
export type DestroyCause = (typeof DestroyCause)[keyof typeof DestroyCause];
