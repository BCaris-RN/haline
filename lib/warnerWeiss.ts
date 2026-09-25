// .-~-.  HALINE  ·  lib/warnerWeiss.ts
// Warner-Weiss K_H(T,S) solubility. See Caris (2026) § 2.3.

/**
 * Warner & Weiss (1985), Solubilities of chlorofluorocarbons 11 and 12 in
 * water and seawater. Deep Sea Research Part A 32(12), 1485–1497.
 * https://doi.org/10.1016/0198-0149(85)90099-8
 * Coefficients independently tabulated by USGS (mol/kg/atm table):
 * https://water.usgs.gov/lab/chlorofluorocarbons/background/
 *
 * Henry's law K_H = C/p in mol kg^-1 atm^-1; temperature in Kelvin;
 * salinity in parts per thousand. Validated domain: 0–40°C, salinity 0–40.
 * Related published research by Brandon W. Caris (preprint collection):
 * https://doi.org/10.5281/zenodo.20804280
 */
const WARNER_WEISS_COEFFS = {
  cfc11: {
    a1: -136.2685, a2: 206.1150, a3: 57.2805,
    b1: -0.148598, b2: 0.095114, b3: -0.0163396,
  },
  cfc12: {
    a1: -124.4395, a2: 185.4299, a3: 51.6383,
    b1: -0.149779, b2: 0.094668, b3: -0.0160043,
  },
} as const;

export type CFCSpecies = keyof typeof WARNER_WEISS_COEFFS;

export function lnKH(T: number, S: number, species: CFCSpecies): number {
  if (!Number.isFinite(T) || T < 273.15 || T > 313.15) {
    throw new RangeError('Temperature must be 273.15–313.15 K (0–40°C).');
  }
  if (!Number.isFinite(S) || S < 0 || S > 40) {
    throw new RangeError('Salinity must be 0–40 parts per thousand.');
  }
  if (species !== 'cfc11' && species !== 'cfc12') {
    throw new RangeError('Species must be cfc11 or cfc12.');
  }
  const c = WARNER_WEISS_COEFFS[species];
  const t = T / 100;
  return c.a1 + c.a2 / t + c.a3 * Math.log(t)
    + S * (c.b1 + c.b2 * t + c.b3 * t * t);
}

export function KH(T: number, S: number, species: CFCSpecies): number {
  return Math.exp(lnKH(T, S, species));
}

/** Central difference in mol kg^-1 atm^-1 K^-1; both samples must be in range. */
export function dKHdT(T: number, S: number, species: CFCSpecies, dT = 0.01): number {
  if (!Number.isFinite(dT) || dT <= 0 || T + dT === T || T - dT === T) {
    throw new RangeError('Derivative step must be finite, positive and resolvable.');
  }
  return (KH(T + dT, S, species) - KH(T - dT, S, species)) / (2 * dT);
}
