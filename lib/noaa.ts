import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getNOAAEndpoint, NOAA_SOURCE, parseNOAAResponse, validateNOAARecords,
  type NOAARecord,
} from './noaaData';

export { getAnomaliesBetween, getLatestAnomalyC, getLatestRecord, NOAA_SOURCE } from './noaaData';
export type { NOAARecord } from './noaaData';

export const NOAA_CACHE_KEY = 'haline_noaa_global_ocean_monthly_v1';
export const NOAA_CACHE_VALIDITY_MS = 24 * 60 * 60 * 1000;

interface CachedData {
  version: 1;
  sourceId: typeof NOAA_SOURCE.id;
  timestamp: number;
  records: NOAARecord[];
}

export interface NOAADataResult {
  records: NOAARecord[];
  source: 'network' | 'cache' | 'unavailable';
  /** Fetch-cache age, not age of the monthly observation. Always show observation month. */
  isStale: boolean;
  fetchedAt: number | null;
  metadata: typeof NOAA_SOURCE;
  error?: string;
  cacheWarning?: string;
}

export interface NOAAClientOptions {
  storage: {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
  };
  fetch: typeof globalThis.fetch;
  now?: () => number;
  timeoutMs?: number;
}

function readCache(raw: string | null, now: number): CachedData | null {
  if (raw === null) return null;
  const value: unknown = JSON.parse(raw);
  if (typeof value !== 'object' || value === null) return null;
  const cache = value as Record<string, unknown>;
  if (cache.version !== 1 || cache.sourceId !== NOAA_SOURCE.id
    || typeof cache.timestamp !== 'number' || !Number.isFinite(cache.timestamp)
    || cache.timestamp < 0 || cache.timestamp > now) return null;
  return {
    version: 1, sourceId: NOAA_SOURCE.id, timestamp: cache.timestamp,
    records: validateNOAARecords(cache.records),
  };
}

function cacheResult(cache: CachedData, now: number): NOAADataResult {
  return {
    records: cache.records.map(record => ({ ...record })),
    source: 'cache',
    isStale: now - cache.timestamp >= NOAA_CACHE_VALIDITY_MS,
    fetchedAt: cache.timestamp,
    metadata: NOAA_SOURCE,
  };
}

/**
 * Cache-first for 24 hours; expired records remain available offline with an
 * explicit stale flag. Concurrent callers share one fetch. A successful fetch
 * remains usable if persistence fails. Failures do not renew cache timestamps.
 * Network failures may retry on a later call, so reconnecting recovers promptly.
 */
export function createNOAAClient(options: NOAAClientOptions) {
  const now = options.now ?? Date.now;
  const timeoutMs = options.timeoutMs ?? 10_000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError('NOAA request timeout must be positive and finite.');
  }
  let memoryCache: CachedData | null = null;
  let inFlight: Promise<NOAADataResult> | null = null;

  async function load(): Promise<NOAADataResult> {
    const startedAt = now();
    // Reject future timestamps after device-clock changes.
    let cache = memoryCache && memoryCache.timestamp <= startedAt ? memoryCache : null;
    if (!cache) {
      try {
        cache = readCache(await options.storage.getItem(NOAA_CACHE_KEY), startedAt);
      } catch {
        // A corrupt or unavailable cache must not prevent a network recovery.
      }
    }
    if (cache && startedAt - cache.timestamp < NOAA_CACHE_VALIDITY_MS) {
      memoryCache = cache;
      return cacheResult(cache, startedAt);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let records: NOAARecord[];
    try {
      const response = await options.fetch(getNOAAEndpoint(startedAt), {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`NOAA HTTP ${response.status}`);
      // Keep the timeout active until the complete body has been consumed.
      records = parseNOAAResponse(await response.json());
    } catch (error) {
      const message = controller.signal.aborted ? 'NOAA request timed out.'
        : error instanceof Error ? error.message : 'NOAA data unavailable.';
      return cache
        ? { ...cacheResult(cache, now()), error: message }
        : {
            records: [], source: 'unavailable', isStale: true,
            fetchedAt: null, metadata: NOAA_SOURCE, error: message,
          };
    } finally {
      clearTimeout(timeout);
    }

    const updated: CachedData = {
      version: 1, sourceId: NOAA_SOURCE.id, timestamp: now(), records,
    };
    memoryCache = updated;
    let cacheWarning: string | undefined;
    try {
      await options.storage.setItem(NOAA_CACHE_KEY, JSON.stringify(updated));
    } catch {
      cacheWarning = 'Fresh NOAA data could not be saved for future offline use.';
    }
    return {
      ...cacheResult(updated, now()), source: 'network',
      ...(cacheWarning ? { cacheWarning } : {}),
    };
  }

  function fetchNOAASSTData(): Promise<NOAADataResult> {
    if (!inFlight) {
      inFlight = load().finally(() => { inFlight = null; });
    }
    // Give each caller its own records so UI mutation cannot corrupt the cache.
    return inFlight.then(result => ({
      ...result, records: result.records.map(record => ({ ...record })),
    }));
  }

  async function fetchNOAASSTAnomaly(): Promise<NOAARecord[]> {
    return (await fetchNOAASSTData()).records;
  }

  return { fetchNOAASSTData, fetchNOAASSTAnomaly };
}

const defaultClient = createNOAAClient({
  storage: AsyncStorage,
  fetch: (input, init) => globalThis.fetch(input, init),
});

/** Prefer this status-aware API for UI: it exposes source, age and failures. */
export const fetchNOAASSTData = defaultClient.fetchNOAASSTData;
/** Compatibility API from the Day 1 brief. Empty records mean unavailable, not zero. */
export const fetchNOAASSTAnomaly = defaultClient.fetchNOAASSTAnomaly;
