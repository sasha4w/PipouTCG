import { Archetype } from "@pipou/shared";

/** Ordre d'affichage des onglets du choix de starter deck. */
export const STARTER_ORDER: Archetype[] = [
  Archetype.PIPOU,
  Archetype.PIXELMAN,
  Archetype.DRAGON,
];

/** Préfixe des clés i18n d'un deck : `.name`, `.gameplay`, `.how_to_play`. */
export function starterTextKey(archetype: Archetype): string {
  return `starter.deck.${archetype}`;
}
