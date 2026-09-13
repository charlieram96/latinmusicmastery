// Extracts the Bravura and Academico WOFF2 bytes that VexFlow bundles as
// base64 data URIs into public/fonts/notation/. Both fonts are SIL OFL.
// Run with: node scripts/extract-notation-fonts.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const outDir = path.join(root, 'public', 'fonts', 'notation');
mkdirSync(outDir, { recursive: true });

const sources = {
  'bravura.woff2': 'node_modules/vexflow/build/esm/src/fonts/bravura.js',
  'academico.woff2': 'node_modules/vexflow/build/esm/src/fonts/academico.js',
};

for (const [outName, src] of Object.entries(sources)) {
  const js = readFileSync(path.join(root, src), 'utf8');
  const match = /data:font\/woff2;charset=utf-8;base64,([A-Za-z0-9+/=]+)/.exec(js);
  if (!match) throw new Error(`No woff2 data URI found in ${src}`);
  const bytes = Buffer.from(match[1], 'base64');
  writeFileSync(path.join(outDir, outName), bytes);
  console.log(`${outName}: ${bytes.length} bytes`);
}
