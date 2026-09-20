import { describe, expect, test } from 'vitest';
import { noaaDataStatusLabel } from '../dataStatus';
import { NOAA_SOURCE, type NOAADataResult } from '../noaa';

function result(source: NOAADataResult['source'], fetchedAt: number | null, isStale = false): NOAADataResult {
  return {
    records: [],
    source,
    isStale,
    fetchedAt,
    metadata: NOAA_SOURCE,
  };
}

describe('NOAA data status label', () => {
  test('shows LIVE only for non-stale network data fetched in the current session', () => {
    expect(noaaDataStatusLabel(result('network', Date.UTC(2026, 7, 15)))).toBe('LIVE');
  });

  test('shows fetched timestamp wording for cached data', () => {
    expect(noaaDataStatusLabel(result('cache', Date.UTC(2026, 7, 15)))).toContain('NOAA data · fetched');
  });

  test('does not show LIVE for stale network data', () => {
    expect(noaaDataStatusLabel(result('network', Date.UTC(2026, 7, 15), true))).toContain('NOAA data · fetched');
  });
});
