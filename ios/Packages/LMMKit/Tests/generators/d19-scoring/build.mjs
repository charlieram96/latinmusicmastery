// Bundles entry.ts (which re-exports the real lib/play-sense + lib/playsense-studio
// modules, untouched) into plain JS so gen.mjs can `import()` it directly under Node.
import * as esbuild from '/Users/charlieramirez/Desktop/latinmusicmastery/node_modules/esbuild/lib/main.js';

const repoRoot = '/Users/charlieramirez/Desktop/latinmusicmastery';
const outfile = new URL('./bundle.mjs', import.meta.url).pathname;

await esbuild.build({
  entryPoints: [new URL('./entry.ts', import.meta.url).pathname],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node18',
  outfile,
  alias: { '@': repoRoot },
});

console.log('built', outfile);
