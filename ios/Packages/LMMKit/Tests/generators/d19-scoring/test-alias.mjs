import * as esbuild from '/Users/charlieramirez/Desktop/latinmusicmastery/node_modules/esbuild/lib/main.js';
import path from 'node:path';

const repoRoot = '/Users/charlieramirez/Desktop/latinmusicmastery';
const entry = '/private/tmp/claude-501/-Users-charlieramirez-Desktop-latinmusicmastery/61fa3ac1-6ba5-461d-986a-c63fa5335c82/scratchpad/d19-gen/entry-test.ts';

const result = await esbuild.build({
  entryPoints: [entry],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node18',
  write: false,
  alias: { '@': repoRoot },
});
console.log(result.outputFiles[0].text.slice(0, 500));
