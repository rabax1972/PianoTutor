import { describe, expect, it } from 'vitest';
import { checkContent } from './content-check';

describe('contenuti in content/', () => {
  it('sono tutti validi', () => {
    const { files, errors } = checkContent();
    expect(errors).toEqual([]);
    expect(files).toBeGreaterThan(0);
  });
});
