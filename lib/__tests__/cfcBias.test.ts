import { describe, expect, test } from 'vitest';
import { cfcUptakeReductionPercent, calculateCFCBias } from '../cfcBias';
import type { CFCSpecies } from '../warnerWeiss';

const SPECIES: CFCSpecies[] = ['cfc11', 'cfc12'];

describe('CFC thermal solubility proxy', () => {
  test.each(SPECIES)('%s zero anomaly returns zero reduction', (species) => {
    expect(cfcUptakeReductionPercent(0, species)).toBe(0);
  });

  /**
   * Independent 50-digit Decimal references using Warner–Weiss coefficients
   * tabulated at https://water.usgs.gov/lab/chlorofluorocarbons/background/.
   * Baseline here is the requested 15°C and salinity 35. The +1.0228°C value
   * appears in Paper 1 (DOI 10.5281/zenodo.20804280), but these KH ratios do
   * not reproduce that paper's dynamic uptake-efficiency or mass-shift model.
   */
  test.each([
    { species: 'cfc11' as const, expected: 4.854499005058474 },
    { species: 'cfc12' as const, expected: 4.288408051097338 },
  ])('$species +1.0228°C matches the corrected 15°C solubility reference', ({ species, expected }) => {
    expect(cfcUptakeReductionPercent(1.0228, species)).toBeCloseTo(expected, 9);
  });

  test.each([
    { species: 'cfc11' as const, expected: -5.083250076367576 },
    { species: 'cfc12' as const, expected: -4.4647031813993765 },
  ])('$species cooling preserves a negative reduction instead of clamping it', ({ species, expected }) => {
    expect(cfcUptakeReductionPercent(-1, species)).toBeCloseTo(expected, 9);
  });

  test.each(SPECIES)('%s reduction increases continuously across the supported anomaly range', (species) => {
    const anomalies = [-15, -5, 0, 1, 5, 15, 25];
    const reductions = anomalies.map((anomaly) => cfcUptakeReductionPercent(anomaly, species));
    expect(reductions[0]).toBeLessThan(0);
    expect(reductions[reductions.length - 1]).toBeGreaterThan(0);
    expect(reductions[reductions.length - 1]).toBeLessThan(100);
    for (let index = 1; index < reductions.length; index += 1) {
      expect(reductions[index]).toBeGreaterThan(reductions[index - 1]!);
    }
  });

  test.each([1, 1.0228, 5])('CFC-11 is more temperature-sensitive than CFC-12 for +%s°C', (anomaly) => {
    expect(cfcUptakeReductionPercent(anomaly, 'cfc11'))
      .toBeGreaterThan(cfcUptakeReductionPercent(anomaly, 'cfc12'));
  });

  test('aggregation retains the input and reports an unweighted mean of the two species', () => {
    const result = calculateCFCBias(1.0228);
    expect(Object.keys(result).sort()).toEqual([
      'average_reduction_percent', 'cfc11_reduction_percent',
      'cfc12_reduction_percent', 'sstAnomalyC',
    ]);
    expect(result.sstAnomalyC).toBe(1.0228);
    expect(result.cfc11_reduction_percent).toBeCloseTo(4.854499005058474, 9);
    expect(result.cfc12_reduction_percent).toBeCloseTo(4.288408051097338, 9);
    expect(result.average_reduction_percent).toBeCloseTo(4.571453528077906, 9);
  });

  test('aggregation preserves cooling and zero-anomaly semantics', () => {
    const cooling = calculateCFCBias(-1);
    expect(cooling.sstAnomalyC).toBe(-1);
    expect(cooling.average_reduction_percent).toBeCloseTo(-4.773976628883476, 9);
    expect(calculateCFCBias(0)).toEqual({
      cfc11_reduction_percent: 0,
      cfc12_reduction_percent: 0,
      average_reduction_percent: 0,
      sstAnomalyC: 0,
    });
  });

  test.each([NaN, Infinity, -Infinity, -15.01, 25.01])('rejects nonfinite or out-of-domain anomaly %s', (anomaly) => {
    expect(() => cfcUptakeReductionPercent(anomaly, 'cfc11')).toThrow(RangeError);
    expect(() => cfcUptakeReductionPercent(anomaly, 'cfc12')).toThrow(RangeError);
    expect(() => calculateCFCBias(anomaly)).toThrow(RangeError);
  });

  test('rejects invalid species passed by JavaScript callers', () => {
    expect(() => cfcUptakeReductionPercent(1, 'cfc113' as CFCSpecies)).toThrow(RangeError);
  });
});
