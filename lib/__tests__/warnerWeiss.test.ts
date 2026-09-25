// .-~-.  HALINE  ·  lib/warnerWeiss.ts
// Warner-Weiss K_H(T,S) solubility. See Caris (2026) § 2.3.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import { calculateCFCBias } from '../cfcBias';
import { KH, lnKH, type CFCSpecies } from '../warnerWeiss';

type WarnerWeissCoefficients = {
  a1: number;
  a2: number;
  a3: number;
  b1: number;
  b2: number;
  b3: number;
};

const SPECIES: CFCSpecies[] = ['cfc11', 'cfc12'];
const COEFFICIENT_NAMES = ['a1', 'a2', 'a3', 'b1', 'b2', 'b3'] as const;


const CARIS_2026_SECTION_2_3_GRAVIMETRIC_COEFFICIENTS = {
  cfc11: {
    a1: -136.2685,
    a2: 206.1150,
    a3: 57.2805,
    b1: -0.148598,
    b2: 0.095114,
    b3: -0.0163396,
  },
  cfc12: {
    a1: -124.4395,
    a2: 185.4299,
    a3: 51.6383,
    b1: -0.149779,
    b2: 0.094668,
    b3: -0.0160043,
  },
} satisfies Record<CFCSpecies, WarnerWeissCoefficients>;

function readSourceCoefficients(): Record<CFCSpecies, WarnerWeissCoefficients> {
  const source = readFileSync(resolve(__dirname, '../warnerWeiss.ts'), 'utf8');

  return Object.fromEntries(SPECIES.map((species) => {
    const blockPattern = new RegExp(`${species}:\\s*{(?<body>[^}]+)}`, 'm');
    const body = blockPattern.exec(source)?.groups?.body;
    if (!body) {
      throw new Error(`Could not find ${species} coefficients in warnerWeiss.ts`);
    }

    const entries = Object.fromEntries(COEFFICIENT_NAMES.map((name) => {
      const valuePattern = new RegExp(`${name}:\\s*(?<value>-?\\d+(?:\\.\\d+)?)`);
      const value = valuePattern.exec(body)?.groups?.value;
      if (!value) {
        throw new Error(`Could not find ${species}.${name} in warnerWeiss.ts`);
      }
      return [name, Number(value)];
    }));

    return [species, entries];
  })) as Record<CFCSpecies, WarnerWeissCoefficients>;
}

function analyticDlnKdT(
  temperatureK: number,
  salinity: number,
  coefficients: WarnerWeissCoefficients,
): number {
  return (-100 * coefficients.a2) / (temperatureK ** 2)
    + coefficients.a3 / temperatureK
    + salinity * (coefficients.b2 / 100 + (2 * coefficients.b3 * temperatureK) / 1e4);
}

function numericalDlnKdT(
  species: CFCSpecies,
  temperatureK: number,
  salinity: number,
  h = 0.01,
): number {
  return (lnKH(temperatureK + h, salinity, species) - lnKH(temperatureK - h, salinity, species)) / (2 * h);
}

describe('Warner-Weiss gravimetric CFC solubility', () => {
  describe('coefficient fidelity', () => {
    test.each(SPECIES)('%s source coefficients match hand-typed Caris 2026 section 2.3 values', (species) => {
      const sourceCoefficients = readSourceCoefficients();

      expect(sourceCoefficients[species]).toEqual(CARIS_2026_SECTION_2_3_GRAVIMETRIC_COEFFICIENTS[species]);
    });
  });

  describe('analytical derivative', () => {
    test.each(SPECIES.flatMap((species) => [288.15, 298.15].map((temperatureK) => ({
      species,
      temperatureK,
    }))))('$species d lnK/dT at $temperatureK K, S=35 matches the central difference', ({
      species,
      temperatureK,
    }) => {
      const sourceCoefficients = readSourceCoefficients();
      const analytic = analyticDlnKdT(temperatureK, 35, sourceCoefficients[species]);
      const numerical = numericalDlnKdT(species, temperatureK, 35);

      expect(Math.abs(numerical - analytic)).toBeLessThan(1e-6);
    });
  });

  describe('physical invariants', () => {
    test.each(SPECIES)('%s K is positive and finite across the ocean range', (species) => {
      for (const temperatureK of [273.15, 288.15, 298.15, 313.15]) {
        for (const salinity of [0, 20, 35, 40]) {
          const value = KH(temperatureK, salinity, species);

          expect(Number.isFinite(value)).toBe(true);
          expect(value).toBeGreaterThan(0);
        }
      }
    });

    test.each(SPECIES)('%s d lnK/dT is negative across the ocean range', (species) => {
      const sourceCoefficients = readSourceCoefficients();

      for (const temperatureK of [273.15, 288.15, 298.15, 313.15]) {
        for (const salinity of [0, 20, 35, 40]) {
          expect(analyticDlnKdT(temperatureK, salinity, sourceCoefficients[species])).toBeLessThan(0);
        }
      }
    });

    test.each(SPECIES)('%s K decreases as salinity increases at fixed temperature', (species) => {
      for (const temperatureK of [273.15, 288.15, 298.15, 313.15]) {
        expect(KH(temperatureK, 20, species)).toBeLessThan(KH(temperatureK, 0, species));
        expect(KH(temperatureK, 35, species)).toBeLessThan(KH(temperatureK, 20, species));
        expect(KH(temperatureK, 40, species)).toBeLessThan(KH(temperatureK, 35, species));
      }
    });

    test.each([272.15, 314.15])('rejects out-of-domain temperature %s K', (temperatureK) => {
      expect(() => lnKH(temperatureK, 35, 'cfc11')).toThrow(RangeError);
      expect(() => KH(temperatureK, 35, 'cfc11')).toThrow(RangeError);
    });
  });

  describe('app output consistency', () => {
    test('dashboard percent decrease for a +1.08 C anomaly is positive and matches the analytic approximation', () => {
      const sourceCoefficients = readSourceCoefficients();
      const dashboard = calculateCFCBias(1.08);
      const dashboardAverageFraction = dashboard.average_reduction_percent / 100;
      const analyticAverageFraction = SPECIES
        .map((species) => 1 - Math.exp(analyticDlnKdT(288.15, 35, sourceCoefficients[species]) * 1.08))
        .reduce((sum, value) => sum + value, 0) / SPECIES.length;
      const differencePercentagePoints = Math.abs((dashboardAverageFraction - analyticAverageFraction) * 100);

      expect(dashboardAverageFraction).toBeGreaterThan(0);
      expect(differencePercentagePoints).toBeLessThan(0.1);
    });

    test('dashboard percent decrease for a -1.0 C anomaly is negative', () => {
      expect(calculateCFCBias(-1).average_reduction_percent).toBeLessThan(0);
    });
  });
});
