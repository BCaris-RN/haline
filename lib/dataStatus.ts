import type { NOAADataResult } from './noaa';

export function formatNOAAFetchedAt(value: number | null): string {
  if (value === null) return 'No successful fetch yet';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(value));
}

export function noaaDataStatusLabel(data: NOAADataResult): string {
  if (data.source === 'network' && !data.isStale) return 'LIVE';
  if (data.source === 'unavailable') return 'NOAA data unavailable';
  return `NOAA data · fetched ${formatNOAAFetchedAt(data.fetchedAt)}`;
}
