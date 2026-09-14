import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

test('browser package resolution does not load the server engine', () => {
  const script = `import { createEngineFactory } from '@battle/battle-engine'; try { createEngineFactory(); process.exit(1); } catch (error) { if (!error.message.includes('runs on the server')) throw error; }`;
  execFileSync(process.execPath, ['--conditions=browser', '--input-type=module', '-e', script], { cwd: new URL('../../..', import.meta.url), stdio: 'pipe' });
});

test('engine modules import no app, browser renderer, preview core, or FX code', () => {
  const directory = new URL('../src/', import.meta.url);
  for (const name of readdirSync(directory).filter(name => name.endsWith('.js'))) {
    const source = readFileSync(new URL(name, directory), 'utf8');
    const imports = [...source.matchAll(/(?:from\s*|import\s*\(|require\s*\()(['"])([^'"\n]+)\1/g)].map(match => match[2]);
    assert(!imports.some(value => /(?:apps\/|battle-core|battle-fx|pokemon-sprites|vue|pixi|gsap)/.test(value)), `${name} imports presentation or preview code`);
  }
});
