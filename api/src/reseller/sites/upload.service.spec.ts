import {
  UPLOAD_ALLOWED_TYPES,
  UPLOAD_EXPIRES_SECONDS,
  UPLOAD_MAX_BYTES,
  buildScopedUploadKey,
  buildUploadObjectKey,
  uploadPostConditions,
} from './upload.service';

describe('presigned upload constraints', () => {
  it('allows only jpeg/png/webp', () => {
    expect([...UPLOAD_ALLOWED_TYPES].sort()).toEqual([
      'image/jpeg',
      'image/png',
      'image/webp',
    ]);
    expect(UPLOAD_ALLOWED_TYPES.has('image/gif')).toBe(false);
  });

  it('expires in at most 5 minutes and caps size', () => {
    expect(UPLOAD_EXPIRES_SECONDS).toBeLessThanOrEqual(300);
    expect(UPLOAD_MAX_BYTES).toBe(5 * 1024 * 1024);
  });

  it('builds object keys under the reseller prefix', () => {
    const resellerId = '11111111-1111-4111-8111-111111111111';
    const key = buildUploadObjectKey(resellerId, 'image/png');
    expect(key.startsWith(`resellers/${resellerId}/`)).toBe(true);
    expect(key.endsWith('.png')).toBe(true);
  });

  it('builds scoped keys for reseller, admin and customer', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    expect(buildScopedUploadKey({ kind: 'reseller', resellerId: id }, 'image/jpeg')).toMatch(
      new RegExp(`^resellers/${id}/[0-9a-f-]{36}\\.jpg$`),
    );
    expect(buildScopedUploadKey({ kind: 'admin' }, 'image/png')).toMatch(
      /^admin\/[0-9a-f-]{36}\.png$/,
    );
    expect(buildScopedUploadKey({ kind: 'customer', userId: id }, 'image/webp')).toMatch(
      new RegExp(`^customers/${id}/[0-9a-f-]{36}\\.webp$`),
    );
    expect(() => buildScopedUploadKey({ kind: 'reseller', resellerId: '' }, 'image/png')).toThrow();
  });

  it('includes content-length-range and content-type in post conditions', () => {
    const conditions = uploadPostConditions('image/jpeg', UPLOAD_MAX_BYTES);
    expect(conditions).toEqual(
      expect.arrayContaining([
        ['content-length-range', 1, UPLOAD_MAX_BYTES],
        ['eq', '$Content-Type', 'image/jpeg'],
      ]),
    );
  });
});
