import { afterEach, describe, expect, test, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
  },
}));

import {
  createNOAAClient,
  NOAA_CACHE_KEY,
  NOAA_CACHE_VALIDITY_MS,
} from '../noaa';
import {
  getAnomaliesBetween,
  getLatestAnomalyC,
  getNOAAEndpoint,
  NOAA_SOURCE,
  parseNOAAResponse,
  validateNOAARecords,
} from '../noaaData';

// Excerpt fetched from the real ocean/1/0/1850-2026.json feed on 2026-09-15.
// The live feed reports 1901-2000 anomalies rounded to hundredths of a degree.
const fixture = {
  description: {
    title: 'Global Ocean Average Temperature Departures',
    units: 'Degrees Celsius',
    base_period: '1901-2000',
  },
  data: {
    '202308': { departure: 1.02 },
    '202601': { departure: 0.82 },
    '202607': { departure: 1.02 },
    '202608': { departure: 1.08 },
  },
};

const records = [
  { year: 2023, month: 8, value: 1.02, date: '2023-08-01' },
  { year: 2026, month: 1, value: 0.82, date: '2026-01-01' },
  { year: 2026, month: 7, value: 1.02, date: '2026-07-01' },
  { year: 2026, month: 8, value: 1.08, date: '2026-08-01' },
];
const now = Date.UTC(2026, 8, 15, 12);

function cache(timestamp: number, overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    version: 1,
    sourceId: NOAA_SOURCE.id,
    timestamp,
    records,
    ...overrides,
  });
}

function setup(cached: string | null = null, timeoutMs = 10_000) {
  const storage = {
    getItem: vi.fn(async (_key: string): Promise<string | null> => cached),
    setItem: vi.fn(async (_key: string, _value: string): Promise<void> => undefined),
  };
  const fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json(fixture));
  const client = createNOAAClient({ storage, fetch, now: () => now, timeoutMs });
  return { storage, fetch, client };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('NOAA monthly global ocean contract', () => {
  test('parses the actual YYYYMM -> departure payload with explicit metadata', () => {
    expect(parseNOAAResponse(fixture)).toEqual(records);
    expect(getNOAAEndpoint(now)).toBe(
      'https://www.ncei.noaa.gov/access/monitoring/climate-at-a-glance/global/time-series/globe/ocean/1/0/1850-2026.json',
    );
    expect(getNOAAEndpoint(Date.UTC(2027, 0, 1))).toContain('/1850-2027.json');
  });

  test.each([
    ['title', 'Global Land and Ocean Average Temperature Departures'],
    ['units', 'Degrees Fahrenheit'],
    ['base_period', '1981-2010'],
  ])('rejects a changed %s instead of silently altering the science input', (key, value) => {
    expect(() => parseNOAAResponse({
      ...fixture,
      description: { ...fixture.description, [key]: value },
    })).toThrow();
  });

  test.each([
    null,
    {},
    { data: fixture.data },
    { ...fixture, data: [[2026, 8, 1.08]] },
    { ...fixture, data: {} },
  ])('rejects missing metadata, array triples, and an empty product', payload => {
    expect(() => parseNOAAResponse(payload)).toThrow();
  });

  test.each(['202600', '202613', '2026-08', '184912'])('rejects invalid month key %s', period => {
    expect(() => parseNOAAResponse({
      ...fixture,
      data: { [period]: { departure: 1.08 } },
    })).toThrow();
  });

  test.each([null, undefined, '', '1.08', Number.NaN, Infinity, -999, -9999, 9999])(
    'rejects malformed or sentinel-like anomalies rather than converting to zero: %s',
    departure => {
      expect(() => parseNOAAResponse({
        ...fixture,
        data: { '202608': { departure } },
      })).toThrow();
    },
  );

  test('retains real zero and negative anomalies', () => {
    expect(parseNOAAResponse({
      ...fixture,
      data: { '188001': { departure: -0.16 }, '188002': { departure: 0 } },
    }).map(record => record.value)).toEqual([-0.16, 0]);
  });

  test('cached records must have matching dates and unique observation months', () => {
    expect(() => validateNOAARecords([{ ...records[0], date: '2023-09-01' }])).toThrow();
    expect(() => validateNOAARecords([records[0], records[0]])).toThrow();
    expect(() => validateNOAARecords([])).toThrow();
  });

  test('latest observation and inclusive year ranges work on unsorted records', () => {
    const unsorted = [records[2]!, records[3]!, records[0]!, records[1]!];
    const before = [...unsorted];
    expect(getLatestAnomalyC(unsorted)).toBe(1.08);
    expect(getLatestAnomalyC([])).toBeNull();
    expect(getAnomaliesBetween(unsorted, 2026, 2026)).toEqual(records.slice(1));
    expect(getAnomaliesBetween(unsorted, 2023, 2026)).toEqual(records);
    expect(getAnomaliesBetween(unsorted, 2024, 2025)).toEqual([]);
    expect(unsorted).toEqual(before);
    expect(() => getAnomaliesBetween(unsorted, 2026, 2023)).toThrow();
  });
});

describe('NOAA client freshness and offline behavior', () => {
  test('a cache younger than 24 hours skips HTTP and preserves observation metadata', async () => {
    const timestamp = now - NOAA_CACHE_VALIDITY_MS + 1;
    const { client, fetch, storage } = setup(cache(timestamp));
    const result = await client.fetchNOAASSTData();
    expect(result).toMatchObject({
      records,
      source: 'cache',
      isStale: false,
      fetchedAt: timestamp,
      metadata: NOAA_SOURCE,
    });
    expect(storage.getItem).toHaveBeenCalledWith(NOAA_CACHE_KEY);
    expect(fetch).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  test('the 24-hour boundary refreshes NOAA and persists the verified source identity', async () => {
    const { client, fetch, storage } = setup(cache(now - NOAA_CACHE_VALIDITY_MS));
    const result = await client.fetchNOAASSTData();
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0]?.[0]).toBe(getNOAAEndpoint(now));
    expect(result).toMatchObject({
      records,
      source: 'network',
      isStale: false,
      fetchedAt: now,
      metadata: NOAA_SOURCE,
    });
    expect(storage.setItem).toHaveBeenCalledOnce();
    const [key, serialized] = storage.setItem.mock.calls[0]!;
    expect(key).toBe(NOAA_CACHE_KEY);
    expect(JSON.parse(serialized)).toMatchObject({
      version: 1,
      sourceId: NOAA_SOURCE.id,
      timestamp: now,
      records,
    });
  });

  test.each(['network', 'http', 'json', 'contract'] as const)(
    'a %s failure returns explicitly stale cached data with its original fetch time',
    async failure => {
      const timestamp = now - 3 * NOAA_CACHE_VALIDITY_MS;
      const { client, fetch } = setup(cache(timestamp));
      if (failure === 'network') fetch.mockRejectedValueOnce(new Error('Offline'));
      if (failure === 'http') fetch.mockResolvedValueOnce(new Response('Unavailable', { status: 503 }));
      if (failure === 'json') fetch.mockResolvedValueOnce(new Response('not json'));
      if (failure === 'contract') fetch.mockResolvedValueOnce(Response.json({
        ...fixture, description: { ...fixture.description, base_period: '1991-2020' },
      }));
      const result = await client.fetchNOAASSTData();
      expect(result).toMatchObject({
        records,
        source: 'cache',
        isStale: true,
        fetchedAt: timestamp,
        metadata: NOAA_SOURCE,
      });
      expect(result.error).toEqual(expect.any(String));
    },
  );

  test('network failure without usable cache reports unavailable instead of a zero anomaly', async () => {
    const { client, fetch } = setup();
    fetch.mockRejectedValue(new Error('Offline'));
    const result = await client.fetchNOAASSTData();
    expect(result).toMatchObject({ records: [], source: 'unavailable', fetchedAt: null });
    expect(result.error).toEqual(expect.any(String));
    expect(getLatestAnomalyC(result.records)).toBeNull();
    expect(await client.fetchNOAASSTAnomaly()).toEqual([]);
  });

  test('the records-only API returns normalized ocean observations', async () => {
    const { client } = setup();
    expect(await client.fetchNOAASSTAnomaly()).toEqual(records);
  });

  test('a cache read failure still fetches fresh NOAA observations', async () => {
    const { client, storage, fetch } = setup();
    storage.getItem.mockRejectedValueOnce(new Error('Storage unavailable'));
    expect(await client.fetchNOAASSTData()).toMatchObject({ records, source: 'network' });
    expect(fetch).toHaveBeenCalledOnce();
  });

  test('a cache write failure preserves fresh results and reuses them in memory', async () => {
    const { client, storage, fetch } = setup();
    storage.setItem.mockRejectedValue(new Error('Disk full'));
    const first = await client.fetchNOAASSTData();
    expect(first).toMatchObject({ records, source: 'network', isStale: false });
    expect(first.cacheWarning).toEqual(expect.any(String));
    expect(await client.fetchNOAASSTData()).toMatchObject({ records, isStale: false });
    expect(fetch).toHaveBeenCalledOnce();
  });

  test('simultaneous callers share a single HTTP request and cache write', async () => {
    const { client, storage, fetch } = setup();
    let complete!: (response: Response) => void;
    fetch.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
    const first = client.fetchNOAASSTData();
    const second = client.fetchNOAASSTData();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    complete(Response.json(fixture));
    const [one, two] = await Promise.all([first, second]);
    expect(one).toMatchObject({ records, source: 'network' });
    expect(two).toEqual(one);
    expect(storage.setItem).toHaveBeenCalledOnce();
  });

  test('mutating returned observations cannot contaminate another caller or the cache', async () => {
    const { client } = setup();
    const [first, second] = await Promise.all([
      client.fetchNOAASSTData(), client.fetchNOAASSTData(),
    ]);
    first.records[0]!.value = 9;
    first.records.pop();
    expect(second.records).toEqual(records);
    expect((await client.fetchNOAASSTData()).records).toEqual(records);
  });

  test.each([
    ['invalid JSON', '{'],
    ['future timestamp', cache(now + 1)],
    ['wrong source', cache(now - 1, { sourceId: 'land-ocean-1981-2010' })],
    ['wrong version', cache(now - 1, { version: 0 })],
    ['empty observations', cache(now - 1, { records: [] })],
    ['invalid observation', cache(now - 1, { records: [{ ...records[0], value: -999 }] })],
    ['invalid timestamp', cache(now - 1, { timestamp: '2026-09-15' })],
  ])('rejects %s cache even when the network is unavailable', async (_reason, cached) => {
    const { client, fetch } = setup(cached);
    fetch.mockRejectedValueOnce(new Error('Offline'));
    expect(await client.fetchNOAASSTData()).toMatchObject({
      records: [], source: 'unavailable', fetchedAt: null,
    });
    expect(fetch).toHaveBeenCalledOnce();
  });

  test('timeout aborts the HTTP request, returns stale data, and allows a later retry', async () => {
    vi.useFakeTimers();
    const { client, fetch } = setup(cache(now - 2 * NOAA_CACHE_VALIDITY_MS), 100);
    let signal: AbortSignal | null | undefined;
    fetch.mockImplementationOnce((_url, init) => {
      signal = init?.signal;
      return new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      });
    });
    const pending = client.fetchNOAASSTData();
    await vi.advanceTimersByTimeAsync(100);
    expect(signal?.aborted).toBe(true);
    expect(await pending).toMatchObject({ records, source: 'cache', isStale: true });
    expect(vi.getTimerCount()).toBe(0);
    expect(await client.fetchNOAASSTData()).toMatchObject({ records, source: 'network', isStale: false });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  test('successful requests cancel the deadline timer', async () => {
    vi.useFakeTimers();
    const { client } = setup();
    expect(await client.fetchNOAASSTData()).toMatchObject({ records, source: 'network' });
    expect(vi.getTimerCount()).toBe(0);
  });

  test('the timeout remains active while the response body is being consumed', async () => {
    vi.useFakeTimers();
    const { client, fetch } = setup(cache(now - 2 * NOAA_CACHE_VALIDITY_MS), 100);
    let signal: AbortSignal | null | undefined;
    let bodyStarted = false;
    fetch.mockImplementationOnce(async (_url, init) => {
      signal = init?.signal;
      const response = Response.json(fixture);
      vi.spyOn(response, 'json').mockImplementation(() => {
        bodyStarted = true;
        return new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        });
      });
      return response;
    });
    const pending = client.fetchNOAASSTData();
    await vi.advanceTimersByTimeAsync(100);
    expect(bodyStarted).toBe(true);
    expect(signal?.aborted).toBe(true);
    expect(await pending).toMatchObject({ records, source: 'cache', isStale: true });
    expect(vi.getTimerCount()).toBe(0);
  });
});
