import { describe, expect, it } from 'vitest';
import { prefOf } from './pref';

describe('prefOf', () => {
  it('所在地の先頭から都道府県を取り出す', () => {
    expect(prefOf('東京都渋谷区道玄坂1-1-1')).toBe('東京都');
    expect(prefOf('〒530-0001 大阪府大阪市北区梅田')).toBe('大阪府');
    expect(prefOf('〒０６０－０００１　北海道札幌市')).toBe('北海道');
  });
  it('分からないときは null', () => {
    expect(prefOf('')).toBeNull();
    expect(prefOf(undefined)).toBeNull();
    expect(prefOf('Singapore 018989')).toBeNull();
  });
});
