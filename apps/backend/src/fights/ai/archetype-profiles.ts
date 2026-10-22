import type { AdventureArchetype } from '@pipou/shared';

/**
 * Philosophie d'un archétype pour l'IA : ce qu'elle valorise sur son terrain
 * et dans sa main. Données seulement ; `evaluate` applique la même formule à
 * tous les archétypes. Une extension = de nouvelles lignes ici, au besoin.
 */
export interface ArchetypeProfile {
  /** Par monstre en jeu (l'union fait la force). */
  perMonster: number;
  /** Par équipement du monstre le plus équipé. */
  perEquipment: number;
  /** Un équipement sur un Noyau compte davantage : c'est lui qu'on bombarde. */
  coreFactor: number;
  /** Présence d'au moins un Noyau. */
  corePresence: number;
  /** Par stade de Drakon (œuf 1 … adulte 4). */
  perStage: number;
  /** Part des PV des unités en croissance (œuf, bébé, jeune). */
  growingHp: number;
  /** Quels monstres protéger du tour adverse. */
  protect: 'equipments' | 'growing' | 'boosters';
  /** Carte d'évolution en main avec une base valide sur le terrain. */
  prepEvolve: number;
  /** Équipement en main avec un porteur. */
  prepEquip: number;
  /** Éphémère ciblé en main avec une cible. */
  prepTarget: number;
}

const NONE = {
  perMonster: 0,
  perEquipment: 0,
  coreFactor: 1,
  corePresence: 0,
  perStage: 0,
  growingHp: 0,
};

export const ARCHETYPE_PROFILES: Record<AdventureArchetype, ArchetypeProfile> =
  {
    pipou: {
      ...NONE,
      perMonster: 400,
      protect: 'boosters',
      prepEvolve: 150,
      prepEquip: 100,
      prepTarget: 50,
    },
    pixelman: {
      ...NONE,
      perEquipment: 400,
      coreFactor: 1.25,
      corePresence: 300,
      protect: 'equipments',
      prepEvolve: 150,
      prepEquip: 300,
      prepTarget: 50,
    },
    dragon: {
      ...NONE,
      perStage: 300,
      growingHp: 0.3,
      protect: 'growing',
      prepEvolve: 400,
      prepEquip: 100,
      prepTarget: 50,
    },
  };
