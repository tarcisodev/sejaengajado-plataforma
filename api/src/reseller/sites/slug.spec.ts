import { BadRequestException } from '@nestjs/common';

import { assertSlugFormat, assertSlugNotBrand, normalizeSlug, SLUG_REGEX } from './slug';

describe('slug helpers', () => {
  it('accepts valid slugs and rejects short or invalid ones', () => {
    expect(SLUG_REGEX.test('abc')).toBe(true);
    expect(SLUG_REGEX.test('a-b-c')).toBe(true);
    expect(SLUG_REGEX.test('ab')).toBe(false);
    expect(SLUG_REGEX.test('A_B')).toBe(false);
    expect(() => assertSlugFormat('ab')).toThrow(BadRequestException);
  });

  it('blocks brand names and normalizes case', () => {
    expect(normalizeSlug('FooBar')).toBe('foobar');
    expect(() => assertSlugNotBrand('google')).toThrow(BadRequestException);
    expect(() => assertSlugNotBrand('nubank')).toThrow(BadRequestException);
  });
});
