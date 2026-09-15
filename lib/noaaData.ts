/** Shared, platform-independent NOAA contract for the mobile client and Lambda. */
export const NOAA_SOURCE = {
  id: 'ncei-cag-global-ocean-monthly-1901-2000-v1',
  title: 'Global Ocean Average Temperature Departures',
  units: 'Degrees Celsius',
  baseline: '1901-2000',
} as const;

export interface NOAARecord {
  year: number;
  month: number;
  value: number;
  /** First day of the observation month, not the fetch/publication date. */
  date: string;
}

export function getNOAAEndpoint(nowMs = Date.now()): string {
  const year = new Date(nowMs).getUTCFullYear();
  if (!Number.isInteger(year) || year < 1850 || year > 9999) {
    throw new RangeError('NOAA endpoint requires a valid year from 1850.');
  }
  return `https://www.ncei.noaa.gov/access/monitoring/climate-at-a-glance/global/time-series/globe/ocean/1/0/1850-${year}.json`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validPeriod(year: number, month: number): boolean {
  return Number.isInteger(year) && year >= 1850 && year <= 9999
    && Number.isInteger(month) && month >= 1 && month <= 12;
}

function recordDate(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

/** Reject malformed/missing values and sentinel-like anomalies; never coerce to zero. */
function validValue(value: unknown): value is number {
  // A guard against feed corruption, not an empirically claimed climate range.
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 10;
}

export function validateNOAARecords(value: unknown): NOAARecord[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('NOAA records must be a nonempty array.');
  }
  const seen = new Set<string>();
  const records = value.map((row: unknown) => {
    if (!isObject(row) || typeof row.year !== 'number' || typeof row.month !== 'number'
      || !validPeriod(row.year, row.month) || !validValue(row.value)
      || row.date !== recordDate(row.year, row.month) || seen.has(row.date as string)) {
      throw new Error('Invalid or duplicate NOAA record.');
    }
    const date = recordDate(row.year, row.month);
    seen.add(date);
    return { year: row.year, month: row.month, value: row.value, date };
  });
  return records.sort((a, b) => a.year - b.year || a.month - b.month);
}

/** Verified against the live NOAA CAG response on 2026-09-15. */
export function parseNOAAResponse(value: unknown): NOAARecord[] {
  if (!isObject(value) || !isObject(value.description) || !isObject(value.data)) {
    throw new Error('Invalid NOAA response.');
  }
  const { description, data } = value;
  if (description.title !== NOAA_SOURCE.title || description.units !== NOAA_SOURCE.units
    || description.base_period !== NOAA_SOURCE.baseline) {
    throw new Error('NOAA product, units or baseline changed.');
  }
  const rows = Object.entries(data).map(([period, row]) => {
    if (!/^\d{6}$/.test(period) || !isObject(row)) {
      throw new Error('Invalid NOAA monthly entry.');
    }
    const year = Number(period.slice(0, 4));
    const month = Number(period.slice(4, 6));
    return { year, month, value: row.departure, date: recordDate(year, month) };
  });
  return validateNOAARecords(rows);
}

export function getLatestRecord(records: readonly NOAARecord[]): NOAARecord | null {
  return records.reduce<NOAARecord | null>((latest, row) =>
    latest === null || row.year * 12 + row.month > latest.year * 12 + latest.month
      ? row : latest, null);
}

export function getLatestAnomalyC(records: readonly NOAARecord[]): number | null {
  return getLatestRecord(records)?.value ?? null;
}

export function getAnomaliesBetween(
  records: readonly NOAARecord[], startYear: number, endYear: number,
): NOAARecord[] {
  if (!Number.isInteger(startYear) || !Number.isInteger(endYear) || startYear > endYear) {
    throw new RangeError('Year range must contain ordered integer years.');
  }
  return records.filter(row => row.year >= startYear && row.year <= endYear)
    .sort((a, b) => a.year - b.year || a.month - b.month);
}
