import type { AdventureArchetype, DrakonElement } from '@pipou/shared';

/** Variante de l'archétype portée par une IA ; la carte sert aussi de portrait. */
export type Signature = {
  archetype: AdventureArchetype;
  cardName: string;
  /** Drakon : élément mis en avant (absent pour le boss multi-éléments). */
  element?: DrakonElement;
};

type FiveSignatures = [Signature, Signature, Signature, Signature, Signature];

const pipou = (cardName: string): Signature => ({
  archetype: 'pipou',
  cardName,
});
const pixelman = (cardName: string): Signature => ({
  archetype: 'pixelman',
  cardName,
});
const dragon = (cardName: string, element?: DrakonElement): Signature => ({
  archetype: 'dragon',
  cardName,
  element,
});

/** Spec « Signature de chaque IA » : niveau 1 à 5 (5 = boss). */
export const LAUNCH_SIGNATURES: Record<AdventureArchetype, FiveSignatures> = {
  pipou: [
    pipou('Recrue Andouille'),
    pipou('Caporal Gazouille'),
    pipou('Capitaine Gribouille'),
    pipou('Commandant Quenouille'),
    pipou('Général Chatouille'),
  ],
  pixelman: [
    pixelman('Noyau Alpha'),
    pixelman('Noyau Beta'),
    pixelman('Noyau Zeta'),
    pixelman('Noyau Delta'),
    pixelman('Noyau Omega'),
  ],
  // La carte portrait est l'adulte de l'élément (« Teros » = lignée).
  dragon: [
    dragon('Adulte Teros', 'earth'),
    dragon('Adulte Feros', 'fire'),
    dragon('Adulte Ackos', 'water'),
    dragon('Adulte Tempestu', 'wind'),
    dragon('Œuf Céleste'),
  ],
};
