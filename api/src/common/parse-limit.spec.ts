import { BadRequestException } from '@nestjs/common';

import { parseLimit, parseOffset } from './parse-limit';

describe('parseLimit', () => {
  it('defaults and caps', () => {
    expect(parseLimit(undefined)).toBe(20);
    expect(parseLimit('999', { max: 50 })).toBe(50);
  });

  it('rejects NaN / non-integer', () => {
    expect(() => parseLimit('abc')).toThrow(BadRequestException);
    expect(() => parseLimit('1.5')).toThrow(BadRequestException);
    expect(() => parseOffset('-1')).toThrow(BadRequestException);
  });
});
