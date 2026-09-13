/**
 * Kör hela röksviten: e2e-filen först, sedan varje fas egen fil. Filer som
 * börjar med `_` är hjälpare, inte sviter.
 *
 * Varje svit körs i en egen process — de öppnar var sin browser och sätter sin
 * egen exitkod. Körningen fortsätter förbi en röd svit så att utfallet syns i
 * sin helhet, och exitkoden blir röd om någon föll.
 */
import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(here, '..', '..');

const phaseSuites = (await readdir(here))
  .filter((f) => f.endsWith('.mjs') && !f.startsWith('_'))
  .sort()
  .map((f) => path.join('tests', 'smoke', f));

const suites = [path.join('scripts', 'smoke-e2e.mjs'), ...phaseSuites];

const run = (file) =>
  new Promise((resolve) => {
    console.log(`\n=== ${file} ===`);
    spawn(process.execPath, [file], { cwd: root, stdio: 'inherit' }).on('close', (code) =>
      resolve(code ?? 1),
    );
  });

const results = [];
for (const suite of suites) results.push([suite, await run(suite)]);

const failedSuites = results.filter(([, code]) => code !== 0);
console.log('\n=== sammanfattning ===');
for (const [suite, code] of results) console.log(`${code === 0 ? '✓' : '✗'} ${suite}`);
process.exit(failedSuites.length === 0 ? 0 : 1);
