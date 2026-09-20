import { describe, expect, test } from 'vitest';
import { chartObservationLabel, latestRecords } from '../chartData';
import type { NOAARecord } from '../noaaData';

function record(index: number): NOAARecord {
  const date = new Date(Date.UTC(2010, index, 1));
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  return {
    date: `${year}-${String(month).padStart(2, '0')}-01`,
    year,
    month,
    value: index / 100,
  };
}

describe('chart display record selection', () => {
  test('the observation label count matches the selected records drawn by the chart', () => {
    const selected = latestRecords(Array.from({ length: 140 }, (_value, index) => record(index)), 120);

    expect(selected).toHaveLength(120);
    expect(chartObservationLabel(selected)).toBe('120 monthly observations');
  });
});
