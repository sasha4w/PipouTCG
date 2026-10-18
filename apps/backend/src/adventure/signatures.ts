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

export type Persona = { name: string; quote: string };

/** Nom et réplique par défaut des 5 IA de chaque monde (modifiables en admin). */
export const LAUNCH_PERSONAS: Record<
  AdventureArchetype,
  [Persona, Persona, Persona, Persona, Persona]
> = {
  pipou: [
    {
      name: 'Recrue Andouille',
      quote: 'Première mission : te barrer le passage !',
    },
    {
      name: 'Caporal Gazouille',
      quote: 'Au rapport, sinon je gazouille plus fort.',
    },
    {
      name: 'Capitaine Gribouille',
      quote: 'Mon plan de bataille est un chef-d’œuvre... illisible.',
    },
    {
      name: 'Commandant Quenouille',
      quote: 'Ma brigade ne recule jamais, elle patauge.',
    },
    {
      name: 'Général Chatouille',
      quote: 'Rends-toi, ou je sors les plumes.',
    },
  ],
  pixelman: [
    { name: 'Noyau Alpha', quote: 'Initialisation du duel. Tu es en retard.' },
    {
      name: 'Noyau Beta',
      quote: 'Version de test : toujours meilleure que toi.',
    },
    {
      name: 'Noyau Zeta',
      quote: 'Chaque pixel de ton deck est déjà analysé.',
    },
    {
      name: 'Noyau Delta',
      quote: 'Erreur 404 : ta victoire est introuvable.',
    },
    {
      name: 'Noyau Omega',
      quote: 'Je suis le dernier processus. Pas de redémarrage possible.',
    },
  ],
  dragon: [
    {
      name: 'Dompteur de Teros',
      quote: 'La terre tremble quand mon dragon s’éveille.',
    },
    { name: 'Dompteuse de Feros', quote: 'Ça va chauffer, apprenti.' },
    { name: 'Dompteur d’Ackos', quote: 'Laisse la marée t’emporter.' },
    {
      name: 'Dompteuse de Tempestu',
      quote: 'Le vent a déjà choisi son vainqueur.',
    },
    {
      name: 'Gardien de l’Œuf Céleste',
      quote: 'Tous les éléments se rassemblent ici. Prouve ta valeur.',
    },
  ],
};
