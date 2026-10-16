/** Ouverture totale de l'éventail (degrés) : de -15° à +15°. */
const FAN_SPREAD_DEG = 30;
/** Descente des cartes du bord, par degré de rotation (px). */
const FAN_DROP_PX_PER_DEG = 0.9;
/** Chevauchement minimal, en part de la largeur d'une carte. */
const MIN_OVERLAP_RATIO = 0.2;

export interface FanSlot {
  rotateDeg: number;
  offsetY: number;
  /** Négatif : la carte recouvre la précédente. */
  marginLeft: number;
}

/** Place `count` cartes en éventail dans `containerWidth` px. */
export function fanLayout(
  count: number,
  containerWidth: number,
  cardWidth: number,
): FanSlot[] {
  if (count <= 0) return [];
  if (count === 1) return [{ rotateDeg: 0, offsetY: 0, marginLeft: 0 }];

  const overlapToFit = (count * cardWidth - containerWidth) / (count - 1);
  const overlap = Math.max(cardWidth * MIN_OVERLAP_RATIO, overlapToFit);

  return Array.from({ length: count }, (_, i) => {
    const rotateDeg = -FAN_SPREAD_DEG / 2 + (FAN_SPREAD_DEG * i) / (count - 1);
    return {
      rotateDeg,
      offsetY: Math.abs(rotateDeg) * FAN_DROP_PX_PER_DEG,
      marginLeft: i === 0 ? 0 : -overlap,
    };
  });
}
