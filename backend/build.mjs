// .-~-.  HALINE  ·  lib/warnerWeiss.ts
// Warner-Weiss K_H(T,S) solubility. See Caris (2026) § 2.3.

import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const outputDirectory = new URL('./dist/', import.meta.url);
await mkdir(outputDirectory, { recursive: true });
await build({
  entryPoints: [fileURLToPath(new URL('./lambda/weekly-notification.js', import.meta.url))],
  outfile: fileURLToPath(new URL('./dist/weekly-notification.js', import.meta.url)),
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  sourcemap: true,
  logLevel: 'info',
});
await writeFile(new URL('./dist/package.json', import.meta.url), '{"type":"commonjs"}\n');
