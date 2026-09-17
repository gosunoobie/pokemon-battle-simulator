import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { inspectMp3, stripId3v2 } from '../mp3.mjs';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

function syncsafe(size) {
  return Buffer.from([(size >>> 21) & 127, (size >>> 14) & 127, (size >>> 7) & 127, size & 127]);
}

function id3Frame(id, payload) {
  const header = Buffer.alloc(10);
  header.write(id, 0, 'ascii');
  header.writeUInt32BE(payload.length, 4);
  return Buffer.concat([header, payload]);
}

function tag(payload, { major = 3, revision = 0, flags = 0 } = {}) {
  return Buffer.concat([Buffer.from([0x49, 0x44, 0x33, major, revision, flags]), syncsafe(payload.length), payload]);
}

function audio({ frames = 3, tail = true } = {}) {
  const buffers = Array.from({ length: frames }, (_, index) => {
    const frame = Buffer.alloc(1044, index + 1);
    Buffer.from('fffbe064', 'hex').copy(frame);
    if (index === 0) {
      frame.write('Xing', 36, 'ascii');
      frame.write('LAME3.100', 160, 'ascii');
    }
    return frame;
  });
  if (tail) {
    const id3v1 = Buffer.alloc(128);
    id3v1.write('TAGOriginal title');
    buffers.push(id3v1);
  }
  return Buffer.concat(buffers);
}

function latin1(value) {
  return Buffer.concat([Buffer.from([0]), Buffer.from(value, 'latin1')]);
}

function utf16(value) {
  return Buffer.concat([Buffer.from([1, 0xff, 0xfe]), Buffer.from(`${value}\0`, 'utf16le')]);
}

function taggedAudio(payload) {
  return Buffer.concat([tag(payload), audio()]);
}

test('strips only ID3v2 and preserves every MPEG, Xing/LAME and trailing ID3v1 byte', () => {
  const jpeg = Buffer.from('ffd8ffe000104a46494600ffd9', 'hex');
  const picture = Buffer.concat([Buffer.from([0]), Buffer.from('image/jpeg\0'), Buffer.from([3, 0]), jpeg]);
  const metadata = Buffer.concat([
    id3Frame('TIT2', latin1('Flamethrower')),
    id3Frame('TALB', utf16('Pokémon — Gen 3')),
    id3Frame('APIC', picture),
    Buffer.alloc(24),
  ]);
  const originalAudio = audio();
  const input = Buffer.concat([tag(metadata), originalAudio]);
  const originalHash = sha256(input);
  const result = stripId3v2(input);

  assert.deepEqual(result.bytes, originalAudio);
  assert.equal(result.bytes.buffer, input.buffer, 'output must be a view, not a re-encoded copy');
  assert.equal(result.bytes.byteOffset, input.byteOffset + metadata.length + 10);
  assert.equal(sha256(input), originalHash, 'source bytes must not be modified');
  assert.equal(result.metadata.headerBytes, metadata.length + 10);
  assert.equal(result.metadata.text.TIT2, 'Flamethrower');
  assert.equal(result.metadata.text.TALB, 'Pokémon — Gen 3');
  assert.deepEqual(result.metadata.pictures, [{ mime: 'image/jpeg', bytes: jpeg.length, sha256: sha256(jpeg), frameBytes: picture.length }]);
  assert.equal(result.mpeg.frameCount, 3);
  assert.equal(result.mpeg.sampleRate, 44100);
  assert.equal(result.mpeg.channels, 2);
  assert.equal(result.mpeg.bitrateKbps, 320);
});

test('walks complete MPEG frames with or without an ID3v1 tail', () => {
  for (const tail of [true, false]) {
    const info = inspectMp3(audio({ frames: 2, tail }));
    assert.equal(info.frameCount, 2);
    assert.equal(info.sampleRate, 44100);
    assert.equal(info.channels, 2);
    assert.equal(info.bitrateKbps, 320);
  }
});

test('handles a padded MPEG frame without mistaking its padding byte for another header', () => {
  const padded = Buffer.alloc(1045);
  Buffer.from('fffbe264', 'hex').copy(padded);
  const info = inspectMp3(Buffer.concat([padded, audio({ frames: 1, tail: false })]));
  assert.equal(info.frameCount, 2);
});

test('rejects unsupported ID3 versions, revisions and header flags', () => {
  for (const options of [{ major: 2 }, { major: 4 }, { revision: 1 }, { flags: 0x80 }, { flags: 0x40 }]) {
    assert.throws(() => stripId3v2(Buffer.concat([tag(Buffer.alloc(0), options), audio()])));
  }
});

test('rejects non-syncsafe sizes, truncated headers and oversized tag claims', () => {
  const badSyncsafe = taggedAudio(Buffer.alloc(0));
  badSyncsafe[6] = 0x80;
  const oversized = taggedAudio(Buffer.alloc(0));
  syncsafe(oversized.length).copy(oversized, 6);
  for (const input of [badSyncsafe, oversized, Buffer.from('ID3'), tag(Buffer.alloc(8)).subarray(0, 9)]) {
    assert.throws(() => stripId3v2(input));
  }
});

test('rejects invalid frame IDs, flags and payload overruns', () => {
  const invalidId = id3Frame('tit2', latin1('bad'));
  const nonAsciiId = id3Frame('TIT2', latin1('bad'));
  nonAsciiId[3] = 0xb2;
  const flagged = id3Frame('TIT2', latin1('bad'));
  flagged[9] = 1;
  const oversized = id3Frame('TIT2', latin1('bad'));
  oversized.writeUInt32BE(1000, 4);
  for (const payload of [invalidId, nonAsciiId, flagged, oversized, Buffer.from('TIT2')]) {
    assert.throws(() => stripId3v2(taggedAudio(payload)));
  }
});

test('rejects malformed padding rather than silently discarding nonzero bytes', () => {
  const payload = Buffer.concat([id3Frame('TIT2', latin1('ok')), Buffer.from([0, 0, 0, 0, 1])]);
  assert.throws(() => stripId3v2(taggedAudio(payload)));
});

test('rejects unsupported text encodings and UTF-16 without a BOM', () => {
  for (const payload of [Buffer.from([3, 65]), Buffer.from([1, 65, 0, 66, 0])]) {
    assert.throws(() => stripId3v2(taggedAudio(id3Frame('TIT2', payload))));
  }
});

test('rejects malformed APIC fields', () => {
  const incomplete = Buffer.concat([Buffer.from([0]), Buffer.from('image/jpeg')]);
  assert.throws(() => stripId3v2(taggedAudio(id3Frame('APIC', incomplete))));
});

test('rejects empty, truncated, corrupted and trailing-garbage MPEG data', () => {
  const corrupt = audio({ tail: false });
  corrupt[1044] = 0;
  const badBitrate = audio({ tail: false });
  badBitrate[2] = 0xf0;
  const badSampleRate = audio({ tail: false });
  badSampleRate[2] = 0xec;
  for (const input of [
    Buffer.alloc(0), Buffer.from('TAG'), audio({ tail: false }).subarray(0, 1043),
    corrupt, badBitrate, badSampleRate,
    Buffer.concat([audio({ tail: false }), Buffer.from('garbage')]),
    audio().subarray(0, 3 * 1044 + 127),
    taggedAudio(Buffer.alloc(0)),
  ]) {
    assert.throws(() => inspectMp3(input));
  }
});

test('rejects a valid metadata tag followed by invalid audio', () => {
  assert.throws(() => stripId3v2(Buffer.concat([tag(id3Frame('TIT2', latin1('ok'))), Buffer.alloc(32)])));
});
