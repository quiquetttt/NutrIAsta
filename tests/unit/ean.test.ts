import { describe, expect, it } from 'vitest';
import { isValidEan, normalizeEan } from '@/mvp/ean';

describe('EAN local', () => {
  it('valida EAN-13 y EAN-8 mediante checksum', () => {
    expect(isValidEan('8412345678905')).toBe(true);
    expect(isValidEan('96385074')).toBe(true);
    expect(isValidEan('8412345678906')).toBe(false);
    expect(isValidEan('123')).toBe(false);
    expect(normalizeEan('84 123-45678905')).toBe('8412345678905');
  });
});
