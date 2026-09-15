import { KH, type CFCSpecies } from './warnerWeiss';

export const BASELINE_T_K = 288.15;
export const BASELINE_S = 35;

/**
 * Percent change in equilibrium CFC solubility relative to an assumed 15°C,
 * salinity-35 ocean. Positive = lower solubility; negative = higher solubility.
 * Historical API name retained: this is a thermal solubility proxy, not a
 * measurement of uptake flux, haline capping, or an emissions inversion error.
 * NOAA's climatological anomaly baseline is separate from this assumed 15°C.
 */
export function cfcUptakeReductionPercent(sstAnomalyC: number, species: CFCSpecies): number {
  if (!Number.isFinite(sstAnomalyC)) {
    throw new RangeError('SST anomaly must be finite.');
  }
  const baseline = KH(BASELINE_T_K, BASELINE_S, species);
  return (1 - KH(BASELINE_T_K + sstAnomalyC, BASELINE_S, species) / baseline) * 100;
}

export interface CFCBiasResult {
  cfc11_reduction_percent: number;
  cfc12_reduction_percent: number;
  /** Unweighted display summary, not a combined physical flux. */
  average_reduction_percent: number;
  sstAnomalyC: number;
}

export function calculateCFCBias(sstAnomalyC: number): CFCBiasResult {
  const cfc11 = cfcUptakeReductionPercent(sstAnomalyC, 'cfc11');
  const cfc12 = cfcUptakeReductionPercent(sstAnomalyC, 'cfc12');
  return {
    cfc11_reduction_percent: cfc11,
    cfc12_reduction_percent: cfc12,
    average_reduction_percent: (cfc11 + cfc12) / 2,
    sstAnomalyC,
  };
}
