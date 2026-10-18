import type { ValueTransformer } from 'typeorm';

/** mysql2 renvoie les DECIMAL sous forme de chaîne ("12.50") : relus en `number`. */
export const decimalTransformer: ValueTransformer = {
  to: (value: number | null | undefined) => value,
  from: (value: string | number | null) =>
    value === null ? null : Number(value),
};
