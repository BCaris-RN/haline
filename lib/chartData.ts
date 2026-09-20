import type { NOAARecord } from './noaaData';

export const CHART_SERIES_LENGTH = 120;

export function latestRecords(records: readonly NOAARecord[], count = CHART_SERIES_LENGTH): NOAARecord[] {
  return [...records]
    .sort((a, b) => a.year - b.year || a.month - b.month)
    .slice(-count);
}

export function chartObservationLabel(records: readonly NOAARecord[]): string {
  return `${records.length} monthly observations`;
}
