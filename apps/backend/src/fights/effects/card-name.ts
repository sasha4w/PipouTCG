import type { CardNameMatch } from '@pipou/shared';

/** Nom comparable : sans accents, en minuscules, espaces réduits. */
export function normalizeCardName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function cardNameMatches(
  actual: string,
  expected: string,
  mode: CardNameMatch = 'exact',
): boolean {
  const a = normalizeCardName(actual);
  const e = normalizeCardName(expected);
  return mode === 'contains' ? a.includes(e) : a === e;
}
