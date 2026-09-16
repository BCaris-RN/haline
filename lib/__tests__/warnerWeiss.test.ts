import { describe, expect, test } from 'vitest';
import { KH, lnKH, dKHdT, type CFCSpecies } from '../warnerWeiss';

const SPECIES: CFCSpecies[] = ['cfc11', 'cfc12'];

/**
 * Independent reference values evaluated using Python Decimal at 50-digit
 * precision from the mol/kg/atm coefficients in USGS Table 1:
 * https://water.usgs.gov/lab/chlorofluorocarbons/background/
 * These are equilibrium solubilities, not measured ocean uptake fluxes.
 */
const REFERENCES = [
  { species: 'cfc11', salinity: 0, kh: 0.016285757279746059 },
  { species: 'cfc11', salinity: 35, kh: 0.011398160743979296 },
  { species: 'cfc12', salinity: 0, kh: 0.0043470659342078685 },
  { species: 'cfc12', salinity: 35, kh: 0.0030764838009911697 },
] satisfies { species: CFCSpecies; salinity: number; kh: number }[];

describe('Warner–Weiss equilibrium CFC solubility', () => {
  test.todo('matches a published K_H table value');

  test.each(REFERENCES)('$species at 15°C, salinity $salinity matches the independent reference', ({ species, salinity, kh }) => {
    expect(KH(288.15, salinity, species)).toBeCloseTo(kh, 13);
    expect(lnKH(288.15, salinity, species)).toBeCloseTo(Math.log(kh), 11);
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
