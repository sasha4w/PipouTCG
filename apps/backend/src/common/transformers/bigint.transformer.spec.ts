import { bigintTransformer } from './bigint.transformer';

describe('bigintTransformer', () => {
  it('reads BIGINT strings from the driver as numbers', () => {
    expect(bigintTransformer.from('500')).toBe(500);
  });

  it('keeps null', () => {
    expect(bigintTransformer.from(null)).toBeNull();
  });

  it('writes values unchanged', () => {
    expect(bigintTransformer.to(500)).toBe(500);
  });
});
