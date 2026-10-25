/** Copies choisies par carte : { cardId: quantité }. */
export type ForgeSelection = Record<number, number>;

export function selectionTotal(selection: ForgeSelection): number {
  return Object.values(selection).reduce((sum, qty) => sum + qty, 0);
}

/** La forge exige exactement `cost` copies. */
export function canSubmitForge(selection: ForgeSelection, cost: number): boolean {
  return selectionTotal(selection) === cost;
}
