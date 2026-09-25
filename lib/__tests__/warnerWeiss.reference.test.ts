// .-~-.  HALINE  ·  lib/warnerWeiss.ts
// Warner-Weiss K_H(T,S) solubility. See Caris (2026) § 2.3.

import { describe, expect, test } from 'vitest';
import { KH, lnKH, dKHdT, type CFCSpecies } from '../warnerWeiss';

const SPECIES: CFCSpecies[] = ['cfc11', 'cfc12'];

/**
 * Independent reference values evaluated using Python Decimal at 50-digit
 * precision from the mol/kg/atm coefficients in USGS Table 1:
 * https://water.usgs.gov/lab/chlorofluorocarbons/background/
 * These are equilibrium solubilities, not measured ocean uptake fluxes.
 */
const GOLDEN_GRID = [
  { species: 'cfc11' as const, temperature: 273.15, salinity: 0, kh: 0.0387122864010433345 },
  { species: 'cfc11' as const, temperature: 273.15, salinity: 20, kh: 0.0312509441695431513 },
  { species: 'cfc11' as const, temperature: 273.15, salinity: 35, kh: 0.0266148414710233126 },
  { species: 'cfc11' as const, temperature: 273.15, salinity: 40, kh: 0.0252276887335071526 },
  { species: 'cfc11' as const, temperature: 288.15, salinity: 0, kh: 0.0162857572797460587 },
  { species: 'cfc11' as const, temperature: 288.15, salinity: 20, kh: 0.0132816445948992571 },
  { species: 'cfc11' as const, temperature: 288.15, salinity: 35, kh: 0.0113981607439792961 },
  { species: 'cfc11' as const, temperature: 288.15, salinity: 40, kh: 0.0108316782643322841 },
  { species: 'cfc11' as const, temperature: 293.15, salinity: 0, kh: 0.0128799242786439154 },
  { species: 'cfc11' as const, temperature: 293.15, salinity: 20, kh: 0.0105054459426462757 },
  { species: 'cfc11' as const, temperature: 293.15, salinity: 35, kh: 0.00901654966683244068 },
  { species: 'cfc11' as const, temperature: 293.15, salinity: 40, kh: 0.008568714541036339 },
  { species: 'cfc11' as const, temperature: 298.15, salinity: 0, kh: 0.0104364329233885084 },
  { species: 'cfc11' as const, temperature: 298.15, salinity: 20, kh: 0.00849964788635651449 },
  { species: 'cfc11' as const, temperature: 298.15, salinity: 35, kh: 0.00728681210271199985 },
  { species: 'cfc11' as const, temperature: 298.15, salinity: 40, kh: 0.00692228989755136823 },
  { species: 'cfc11' as const, temperature: 313.15, salinity: 0, kh: 0.00633148660137209484 },
  { species: 'cfc11' as const, temperature: 313.15, salinity: 20, kh: 0.00508323068851864626 },
  { species: 'cfc11' as const, temperature: 313.15, salinity: 35, kh: 0.00431137118563123147 },
  { species: 'cfc11' as const, temperature: 313.15, salinity: 40, kh: 0.00408106908527582395 },
  { species: 'cfc12' as const, temperature: 273.15, salinity: 0, kh: 0.00941956021598128769 },
  { species: 'cfc12' as const, temperature: 273.15, salinity: 20, kh: 0.00761964718437408771 },
  { species: 'cfc12' as const, temperature: 273.15, salinity: 35, kh: 0.00649924695370059244 },
  { species: 'cfc12' as const, temperature: 273.15, salinity: 40, kh: 0.00616366601869975231 },
  { species: 'cfc12' as const, temperature: 288.15, salinity: 0, kh: 0.00434706593420786848 },
  { species: 'cfc12' as const, temperature: 288.15, salinity: 20, kh: 0.00356780434798338643 },
  { species: 'cfc12' as const, temperature: 288.15, salinity: 35, kh: 0.00307648380099116969 },
  { species: 'cfc12' as const, temperature: 288.15, salinity: 40, kh: 0.00292823436730519799 },
  { species: 'cfc12' as const, temperature: 293.15, salinity: 0, kh: 0.00352631946299570734 },
  { species: 'cfc12' as const, temperature: 293.15, salinity: 20, kh: 0.00289892200199324257 },
  { species: 'cfc12' as const, temperature: 293.15, salinity: 35, kh: 0.00250278006813891356 },
  { species: 'cfc12' as const, temperature: 293.15, salinity: 40, kh: 0.00238315015466615979 },
  { species: 'cfc12' as const, temperature: 298.15, salinity: 0, kh: 0.0029235462528519184 },
  { species: 'cfc12' as const, temperature: 298.15, salinity: 20, kh: 0.00240347639240355091 },
  { species: 'cfc12' as const, temperature: 298.15, salinity: 35, kh: 0.00207509163375627867 },
  { species: 'cfc12' as const, temperature: 298.15, salinity: 40, kh: 0.00197592179812651163 },
  { species: 'cfc12' as const, temperature: 313.15, salinity: 0, kh: 0.00187461402140621292 },
  { species: 'cfc12' as const, temperature: 313.15, salinity: 20, kh: 0.00152656904310314595 },
  { species: 'cfc12' as const, temperature: 313.15, salinity: 35, kh: 0.00130863910488151942 },
  { species: 'cfc12' as const, temperature: 313.15, salinity: 40, kh: 0.00124314286394419003 },
] satisfies { species: CFCSpecies; temperature: number; salinity: number; kh: number }[];

describe('Warner–Weiss equilibrium CFC solubility', () => {
  test.each(GOLDEN_GRID)('$species K_H at $temperature K, salinity $salinity matches the published coefficient table', ({
    species,
    temperature,
    salinity,
    kh,
  }) => {
    expect(KH(temperature, salinity, species)).toBeCloseTo(kh, 13);
    expect(lnKH(temperature, salinity, species)).toBeCloseTo(Math.log(kh), 11);
  });

  test.each(SPECIES)('%s remains positive and decreases with temperature across the valid domain', (species) => {
    for (const salinity of [0, 20, 40]) {
      const values = [273.15, 283.15, 293.15, 303.15, 313.15]
        .map((temperature) => KH(temperature, salinity, species));
      values.forEach((value) => expect(value).toBeGreaterThan(0));
      for (let index = 1; index < values.length; index += 1) {
        expect(values[index]).toBeLessThan(values[index - 1]!);
      }
    }
  });

  test.each(SPECIES)('%s salting-out reduces solubility at cold and warm limits', (species) => {
    for (const temperature of [273.15, 288.15, 313.15]) {
      expect(KH(temperature, 35, species)).toBeLessThan(KH(temperature, 0, species));
      expect(KH(temperature, 40, species)).toBeLessThan(KH(temperature, 35, species));
    }
  });

  // Paper 1, section 2.3, pp.5–6: 20→21°C at salinity 35 is approximately
  // 4.33% / 3.82%. DOI 10.5281/zenodo.20804280 is the preprint collection.
  // This verifies its solubility example, not its paired-model flux results.
  test.each([
    { species: 'cfc11' as const, percent: 4.329679276734533 },
    { species: 'cfc12' as const, percent: 3.820574170313662 },
  ])('$species reproduces Paper 1’s 20→21°C solubility example', ({ species, percent }) => {
    const reduction = 100 * (1 - KH(294.15, 35, species) / KH(293.15, 35, species));
    expect(reduction).toBeCloseTo(percent, 9);
  });

  // Analytic references use dKH/dT = KH * [-100*a2/T² + a3/T
  // + S*(b2/100 + 2*b3*T/10000)], evaluated separately at 50-digit precision.
  // Comparing with the central difference detects step/scaling/sign mistakes.
  test.each([
    { species: 'cfc11' as const, temperature: 288.15, derivative: -0.000559890608251292 },
    { species: 'cfc12' as const, temperature: 288.15, derivative: -0.00013311643164777775 },
    { species: 'cfc11' as const, temperature: 293.15, derivative: -0.00040292924849874896 },
    { species: 'cfc12' as const, temperature: 293.15, derivative: -0.00009844058621368272 },
  ])('$species central derivative at $temperature K matches the analytic sensitivity', ({ species, temperature, derivative }) => {
    const numerical = dKHdT(temperature, 35, species);
    expect(numerical).toBeLessThan(0);
    expect(Math.abs((numerical - derivative) / derivative)).toBeLessThan(2e-7);
  });

  test.each([NaN, Infinity, -Infinity, 0, 273.14, 313.16])('rejects invalid temperature %s through every public calculation', (temperature) => {
    expect(() => lnKH(temperature, 35, 'cfc11')).toThrow(RangeError);
    expect(() => KH(temperature, 35, 'cfc11')).toThrow(RangeError);
    expect(() => dKHdT(temperature, 35, 'cfc11')).toThrow(RangeError);
  });

  test.each([NaN, Infinity, -Infinity, -0.01, 40.01])('rejects invalid salinity %s', (salinity) => {
    expect(() => lnKH(288.15, salinity, 'cfc12')).toThrow(RangeError);
    expect(() => KH(288.15, salinity, 'cfc12')).toThrow(RangeError);
    expect(() => dKHdT(288.15, salinity, 'cfc12')).toThrow(RangeError);
  });

  test.each(['cfc113', '', 'toString', '__proto__'])('rejects unsupported runtime species %s', (species) => {
    const invalidSpecies = species as CFCSpecies;
    expect(() => lnKH(288.15, 35, invalidSpecies)).toThrow(RangeError);
    expect(() => KH(288.15, 35, invalidSpecies)).toThrow(RangeError);
    expect(() => dKHdT(288.15, 35, invalidSpecies)).toThrow(RangeError);
  });

  test.each([0, -0.01, NaN, Infinity, -Infinity, Number.MIN_VALUE])('rejects invalid or unresolvable derivative step %s', (step) => {
    expect(() => dKHdT(288.15, 35, 'cfc11', step)).toThrow(RangeError);
  });

  test.each([273.15, 313.15])('does not extrapolate derivative samples beyond the valid domain at %s K', (temperature) => {
    expect(() => dKHdT(temperature, 35, 'cfc12')).toThrow(RangeError);
  });
});
