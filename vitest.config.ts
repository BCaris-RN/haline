// .-~-.  HALINE  ·  lib/warnerWeiss.ts
// Warner-Weiss K_H(T,S) solubility. See Caris (2026) § 2.3.

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/__tests__/**/*.test.ts', 'backend/lambda/__tests__/**/*.test.*'],
    clearMocks: true,
    restoreMocks: true,
  },
});
