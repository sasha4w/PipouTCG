import type { ValueTransformer } from 'typeorm';

/**
 * mysql2 renvoie les colonnes BIGINT sous forme de chaîne ("500").
 * Ce transformer les relit en `number` pour que l'API respecte ses types
 * (les montants restent très en dessous de Number.MAX_SAFE_INTEGER).
 */
export const bigintTransformer: ValueTransformer = {
  to: (value: number | null | undefined) => value,
  from: (value: string | number | null) =>
    value === null ? null : Number(value),
};
