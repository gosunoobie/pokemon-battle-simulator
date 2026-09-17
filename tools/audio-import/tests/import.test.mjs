import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkAudio, optimizeAudio } from '../import.mjs';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const exists = async path => readFile(path).then(() => true, error => {
  if (error.code === 'ENOENT') return false;
  throw error;
});

function sourceAudio(title) {
  const frames = [['TIT2', title], ['TALB', 'Gen 3 supplied collection'], ['TPE1', 'Original embedded credit']].map(([id, text]) => {
    const data = Buffer.concat([Buffer.from([0]), Buffer.from(text)]);
    const header = Buffer.alloc(10);
    header.write(id); header.writeUInt32BE(data.length, 4);
    return Buffer.concat([header, data]);
  });
  const payload = Buffer.concat(frames);
  const header = Buffer.from([73, 68, 51, 3, 0, 0, 0, 0, 0, 0]);
  let size = payload.length;
  for (let index = 9; index >= 6; index--) { header[index] = size & 127; size >>>= 7; }
  const audio = Buffer.alloc(1044, 1);
  Buffer.from('fffbe064', 'hex').copy(audio);
  audio.write('Xing', 36); audio.write('LAME3.100', 160);
  const tail = Buffer.alloc(128); tail.write('TAGKept original title');
  return Buffer.concat([header, payload, audio, tail]);
}

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'battle-audio-import-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const output = join(root, 'public/sound_effects');
  const backup = join(root, 'tools/audio-import/.cache/originals');
  const lock = join(root, 'tools/audio-import/source-lock.json');
  const report = join(root, 'tools/audio-import/reports/optimization.json');
  const originals = new Map([['A Tackle.mp3', sourceAudio('Tackle')], ['B Surf.mp3', sourceAudio('Surf')]]);
  await mkdir(output, { recursive: true });
  for (const [name, bytes] of originals) await writeFile(join(output, name), bytes);
  return { root, output, backup, lock, report, originals };
}

async function snapshot(directory) {
  return Object.fromEntries(await Promise.all((await readdir(directory)).sort().map(async name => [name, digest(await readFile(join(directory, name)))])));
}

test('initialization pins source bytes, verifies backups and retains credits in the manifest', async t => {
  const f = await fixture(t);
  const report = await optimizeAudio({ root: f.root, initialize: true });
  const lock = await json(f.lock);
  const manifest = await json(join(f.output, 'manifest.json'));
  assert.equal(report.fileCount, 2);
  assert.equal(report.outputBytes, 2 * (1044 + 128));
  assert.equal(lock.source.kind, 'user-provided-local-files');
  assert.equal(lock.source.rightsStatus, 'unverified');
  assert.match(lock.source.reportedCollectionUrl, /^https:\/\/downloads\.khinsider\.com\//);
  assert.equal(manifest.embeddedCredits[0].TPE1, 'Original embedded credit');
  assert.equal(manifest.files[0].url, '/sound_effects/A%20Tackle.mp3');
  for (const row of lock.files) {
    const original = f.originals.get(row.file);
    const output = await readFile(join(f.output, row.file));
    assert.deepEqual(await readFile(join(f.backup, row.file)), original);
    assert.equal(row.original.sha256, digest(original));
    assert.equal(row.output.sha256, digest(output));
    assert.deepEqual(output, original.subarray(row.metadata.headerBytes));
    assert.equal(row.metadata.text.TPE1, 'Original embedded credit');
  }
  assert.deepEqual(await checkAudio({ root: f.root }), report);
});

test('optimization is byte-idempotent and checked output works without the local cache', async t => {
  const f = await fixture(t);
  await optimizeAudio({ root: f.root, initialize: true });
  const before = await snapshot(f.output);
  const lock = await readFile(f.lock), report = await readFile(f.report);
  await optimizeAudio({ root: f.root });
  assert.deepEqual(await snapshot(f.output), before);
  assert.deepEqual(await readFile(f.lock), lock);
  assert.deepEqual(await readFile(f.report), report);
  await rm(join(f.root, 'tools/audio-import/.cache'), { recursive: true });
  await checkAudio({ root: f.root });
  await optimizeAudio({ root: f.root });
  assert.deepEqual(await snapshot(f.output), before);
});

test('source or backup drift refuses changes to every existing output', async t => {
  const f = await fixture(t);
  await optimizeAudio({ root: f.root, initialize: true });
  const sourceDirectory = join(f.root, 'supplied-originals');
  await mkdir(sourceDirectory);
  for (const [name, bytes] of f.originals) await writeFile(join(sourceDirectory, name), bytes);
  const before = await snapshot(f.output);
  await writeFile(join(sourceDirectory, 'B Surf.mp3'), sourceAudio('Changed source'));
  await assert.rejects(optimizeAudio({ root: f.root, sourceDirectory }), /checksum mismatch/);
  assert.deepEqual(await snapshot(f.output), before);
  await writeFile(join(sourceDirectory, 'B Surf.mp3'), f.originals.get('B Surf.mp3'));
  await writeFile(join(f.backup, 'B Surf.mp3'), sourceAudio('Changed backup'));
  await assert.rejects(optimizeAudio({ root: f.root, sourceDirectory }), /backup/);
  assert.deepEqual(await snapshot(f.output), before);
});

test('optimization refuses to overwrite an edited output', async t => {
  const f = await fixture(t);
  await optimizeAudio({ root: f.root, initialize: true });
  await writeFile(join(f.output, 'B Surf.mp3'), Buffer.from('user edit'));
  const before = await snapshot(f.output);
  await assert.rejects(optimizeAudio({ root: f.root }), /Refusing to overwrite changed output/);
  assert.deepEqual(await snapshot(f.output), before);
});

test('verification detects changed, missing or extra audio and altered generated metadata', async t => {
  for (const mutation of ['changed', 'missing', 'extra', 'manifest', 'report']) {
    await t.test(mutation, async child => {
      const f = await fixture(child);
      await optimizeAudio({ root: f.root, initialize: true });
      if (mutation === 'changed') await writeFile(join(f.output, 'A Tackle.mp3'), Buffer.from('changed'));
      if (mutation === 'missing') await rm(join(f.output, 'A Tackle.mp3'));
      if (mutation === 'extra') await writeFile(join(f.output, 'Extra.mp3'), Buffer.from('extra'));
      if (mutation === 'manifest') await writeFile(join(f.output, 'manifest.json'), '{}\n');
      if (mutation === 'report') await writeFile(f.report, '{}\n');
      await assert.rejects(checkAudio({ root: f.root }));
    });
  }
});

test('a malformed later source fails preflight before any original is replaced', async t => {
  const f = await fixture(t);
  await writeFile(join(f.output, 'B Surf.mp3'), Buffer.from('malformed source'));
  const before = await snapshot(f.output);
  await assert.rejects(optimizeAudio({ root: f.root, initialize: true }));
  assert.deepEqual(await snapshot(f.output), before);
  assert.equal(await exists(f.lock), false);
  assert.equal(await exists(join(f.backup, 'A Tackle.mp3')), false);
});

test('a missing output is restored byte-for-byte from the pinned local cache', async t => {
  const f = await fixture(t);
  await optimizeAudio({ root: f.root, initialize: true });
  const before = await snapshot(f.output);
  await rm(join(f.output, 'B Surf.mp3'));
  await optimizeAudio({ root: f.root });
  assert.deepEqual(await snapshot(f.output), before);
  await checkAudio({ root: f.root });
});

test('initialization cannot replace an existing lock and ordinary runs require enrollment', async t => {
  const f = await fixture(t);
  await assert.rejects(optimizeAudio({ root: f.root }), /Missing source lock/);
  await optimizeAudio({ root: f.root, initialize: true });
  const before = await readFile(f.lock);
  await assert.rejects(optimizeAudio({ root: f.root, initialize: true }), /already exists/);
  assert.deepEqual(await readFile(f.lock), before);
});
