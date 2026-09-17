import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { inspectOgg } from '../ogg.mjs'

// Synthetic framing fixtures deliberately do not contain a decodable setup
// codebook. These tests exercise the structural inspector, not the codec decoder.
function repairCrc(page) {
  page.writeUInt32LE(0, 22)
  let crc = 0
  for (const byte of page) {
    crc ^= byte << 24
    for (let bit = 0; bit < 8; bit++) crc = (crc << 1) ^ (crc & 0x80000000 ? 0x04c11db7 : 0)
  }
  page.writeUInt32LE(crc >>> 0, 22)
  return page
}

function page(sequence, flags, granule, body, lacing = [body.length], serial = 123456) {
  const header = Buffer.alloc(27 + lacing.length)
  header.write('OggS')
  header[5] = flags
  header.writeBigInt64LE(BigInt(granule), 6)
  header.writeUInt32LE(serial, 14)
  header.writeUInt32LE(sequence, 18)
  header[26] = lacing.length
  Buffer.from(lacing).copy(header, 27)
  return repairCrc(Buffer.concat([header, body]))
}

function vector(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value)
  const size = Buffer.alloc(4)
  size.writeUInt32LE(bytes.length)
  return Buffer.concat([size, bytes])
}

function commentHeader(comments = ['TITLE=テスト', 'ARTIST=one', 'ARTIST=two'], vendor = 'Test encoder') {
  const count = Buffer.alloc(4)
  count.writeUInt32LE(comments.length)
  return Buffer.concat([Buffer.from('\x03vorbis'), vector(vendor), count, ...comments.map(vector), Buffer.from([1])])
}

function identification() {
  const header = Buffer.alloc(30)
  header.write('\x01vorbis')
  header[11] = 1
  header.writeUInt32LE(22050, 12)
  header[28] = 0x98
  header[29] = 1
  return header
}

const setup = Buffer.from('\x05vorbis\x01')
const audio = Buffer.from([0, 1, 2, 3])
function pages({ identificationHeader = identification(), comments = commentHeader(), setupHeader = setup } = {}) {
  return [
    page(0, 2, 0, identificationHeader),
    page(1, 0, 0, Buffer.concat([comments, setupHeader]), [comments.length, setupHeader.length]),
    page(2, 4, 11025, audio),
  ]
}
function file(options) { return Buffer.concat(pages(options)) }
function changePage(index, mutate) {
  const output = pages()
  mutate(output[index])
  repairCrc(output[index])
  return Buffer.concat(output)
}

test('reports bounded single-stream Vorbis structure without mutating bytes', () => {
  const bytes = file(), original = Buffer.from(bytes)
  assert.deepEqual(inspectOgg(bytes), {
    container: 'ogg', codec: 'vorbis', channels: 1, sampleRate: 22050,
    sampleFrames: 11025, durationSeconds: 0.5, pageCount: 3, packetCount: 4,
    vendor: 'Test encoder', comments: ['TITLE=テスト', 'ARTIST=one', 'ARTIST=two'],
  })
  assert.deepEqual(bytes, original)
  const surrounded = Buffer.concat([Buffer.alloc(19), bytes, Buffer.alloc(7)])
  assert.deepEqual(inspectOgg(new Uint8Array(surrounded.buffer, surrounded.byteOffset + 19, bytes.length)), inspectOgg(bytes))
})

test('real pinned source #1 has expected structure in the published assets', async () => {
  let bytes
  try {
    const manifest = JSON.parse(await readFile(new URL('../../../public/audio/cries/manifest.json', import.meta.url), 'utf8'))
    const source = manifest.files.find(file => file.source.path === 'cries/pokemon/legacy/1.ogg')
    assert.ok(source, 'Published manifest must contain the pinned Bulbasaur source')
    bytes = await readFile(new URL(`../../../public/audio/cries/${source.asset}`, import.meta.url))
  } catch (error) {
    // Permits running the unit tests while first-time publication is in progress;
    // a finished checkout has published bytes and never requires this cache.
    if (error.code !== 'ENOENT') throw error
    bytes = await readFile(new URL('../.cache/originals/1.ogg', import.meta.url))
  }
  const result = inspectOgg(bytes)
  assert.equal(result.sampleFrames, 8184)
  assert.equal(result.sampleRate, 10512)
  assert.equal(result.channels, 1)
  assert.equal(result.pageCount, 3)
  assert.equal(result.packetCount, 36)
  assert.equal(result.vendor, 'Xiph.Org libVorbis I 20090709')
})

test('rejects nonbinary input, implausible size and every truncated prefix', () => {
  assert.throws(() => inspectOgg('OggS'), /expected a Uint8Array/)
  assert.throws(() => inspectOgg(Buffer.alloc(16 * 1024 * 1024 + 1)), /file size/)
  const bytes = file()
  for (let length = 0; length < bytes.length; length++) {
    assert.throws(() => inspectOgg(bytes.subarray(0, length)), /Invalid cry Ogg/)
  }
})

test('rejects a changed payload with an invalid CRC', () => {
  const bytes = file()
  bytes[bytes.length - 1] ^= 1
  assert.throws(() => inspectOgg(bytes), /CRC mismatch/)
})

test('capture magic is an exact byte match, and Ogg version and flags are validated', () => {
  assert.throws(() => inspectOgg(changePage(1, p => { p[0] |= 0x80 })), /capture pattern/)
  assert.throws(() => inspectOgg(changePage(1, p => { p[4] = 1 })), /Ogg version/)
  assert.throws(() => inspectOgg(changePage(1, p => { p[5] = 8 })), /page flags/)
})

test('rejects missing/repeated BOS, changed serial, missing page and repeated page', () => {
  assert.throws(() => inspectOgg(changePage(0, p => { p[5] = 0 })), /beginning-of-stream/)
  assert.throws(() => inspectOgg(changePage(1, p => { p[5] = 2 })), /beginning-of-stream/)
  assert.throws(() => inspectOgg(changePage(1, p => { p.writeUInt32LE(2, 14) })), /multiple logical streams/)
  for (const sequence of [0, 2]) {
    assert.throws(() => inspectOgg(changePage(1, p => { p.writeUInt32LE(sequence, 18) })), /nonsequential/)
  }
})

test('rejects missing EOS, appended junk and concatenated logical streams', () => {
  assert.throws(() => inspectOgg(changePage(2, p => { p[5] = 0 })), /missing complete end/)
  assert.throws(() => inspectOgg(Buffer.concat([file(), Buffer.from([0])])), /after end/)
  assert.throws(() => inspectOgg(Buffer.concat([file(), file()])), /after end/)
})

test('identification version, channels, sample rate, block sizes and framing are mandatory', () => {
  for (const [mutate, expected] of [
    [p => p.writeUInt32LE(1, 7), /Vorbis version/],
    [p => { p[11] = 0 }, /channels/],
    [p => p.writeUInt32LE(0, 12), /sample rate/],
    [p => { p[28] = 0x95 }, /block sizes/],
    [p => { p[28] = 0xe8 }, /block sizes/],
    [p => { p[28] = 0x89 }, /block sizes/],
    [p => { p[29] = 0 }, /framing bit/],
  ]) {
    const header = identification()
    mutate(header)
    assert.throws(() => inspectOgg(file({ identificationHeader: header })), expected)
  }
})

test('all three header signatures and order are checked', () => {
  for (const key of ['identificationHeader', 'comments', 'setupHeader']) {
    const value = key === 'identificationHeader' ? identification() : key === 'comments' ? commentHeader() : Buffer.from(setup)
    value[0] ^= 2
    assert.throws(() => inspectOgg(file({ [key]: value })), /out-of-order Vorbis header/)
  }
  assert.throws(() => inspectOgg(file({ setupHeader: Buffer.from('\x05vorbis') })), /Vorbis header/)
})

test('comment length, count, UTF-8 and framing are bounded and checked', () => {
  const comments = commentHeader()
  const hugeLength = Buffer.from(comments)
  hugeLength.writeUInt32LE(0xffffffff, 7)
  assert.throws(() => inspectOgg(file({ comments: hugeLength })), /text length/)
  const hugeCount = Buffer.from(comments)
  hugeCount.writeUInt32LE(0xffffffff, 11 + Buffer.byteLength('Test encoder'))
  assert.throws(() => inspectOgg(file({ comments: hugeCount })), /comment count/)
  assert.throws(() => inspectOgg(file({ comments: commentHeader([], Buffer.from([0xff])) })), /UTF-8/)
  assert.throws(() => inspectOgg(file({ comments: commentHeader([Buffer.from([0xff])]) })), /UTF-8/)
  const missingFraming = Buffer.from(comments)
  missingFraming[missingFraming.length - 1] = 0
  assert.throws(() => inspectOgg(file({ comments: missingFraming })), /comment framing/)
})

test('requires nonnegative, safe, positive terminal granules and a bounded duration', () => {
  for (const granule of [-2n, 9007199254740992n]) {
    assert.throws(() => inspectOgg(changePage(2, p => p.writeBigInt64LE(granule, 6))), /unsafe granule/)
  }
  assert.throws(() => inspectOgg(changePage(2, p => p.writeBigInt64LE(0n, 6))), /empty end/)
  assert.throws(() => inspectOgg(changePage(2, p => p.writeBigInt64LE(22050n * 31n, 6))), /30-second/)
  assert.throws(() => inspectOgg(changePage(1, p => p.writeBigInt64LE(1n, 6))), /header page granule/)
  const base = pages().slice(0, 2)
  assert.throws(() => inspectOgg(Buffer.concat([...base, page(2, 0, 11025, audio), page(3, 4, 100, audio)])), /moved backwards/)
})

test('audio begins on its own page and cannot contain another header packet', () => {
  const base = pages()
  const comments = commentHeader()
  const mixed = page(1, 0, 0, Buffer.concat([comments, setup, audio]), [comments.length, setup.length, audio.length])
  assert.throws(() => inspectOgg(Buffer.concat([base[0], mixed, base[2]])), /fresh page/)
  assert.throws(() => inspectOgg(changePage(2, p => { p[28] = 1 })), /audio packet type/)
})

test('accepts correctly continued packets and rejects either mismatched continuation flag', () => {
  const headerPages = pages().slice(0, 2)
  const longAudio = Buffer.alloc(260, 2)
  const first = page(2, 0, -1, longAudio.subarray(0, 255), [255])
  const last = page(3, 5, 11025, longAudio.subarray(255), [5])
  assert.equal(inspectOgg(Buffer.concat([...headerPages, first, last])).packetCount, 4)
  const missing = Buffer.from(last)
  missing[5] = 4
  repairCrc(missing)
  assert.throws(() => inspectOgg(Buffer.concat([...headerPages, first, missing])), /continuation flag/)
  assert.throws(() => inspectOgg(changePage(2, p => { p[5] = 5 })), /continuation flag/)
  const wrongGranule = Buffer.from(first)
  wrongGranule.writeBigInt64LE(0n, 6)
  repairCrc(wrongGranule)
  assert.throws(() => inspectOgg(Buffer.concat([...headerPages, wrongGranule, last])), /granule -1/)
  const unfinished = Buffer.from(first)
  unfinished[5] = 4
  repairCrc(unfinished)
  assert.throws(() => inspectOgg(Buffer.concat([...headerPages, unfinished])), /incomplete/)
})

test('accepts a zero-length final segment completing a 255-byte continued packet', () => {
  const headerPages = pages().slice(0, 2)
  const first = page(2, 0, -1, Buffer.alloc(255, 2), [255])
  const last = page(3, 5, 11025, Buffer.alloc(0), [0])
  assert.equal(inspectOgg(Buffer.concat([...headerPages, first, last])).packetCount, 4)
})

test('comment packets may span header pages without losing UTF-8 or duplicate fields', () => {
  const comments = commentHeader(['TITLE=' + 'x'.repeat(280)])
  const output = [
    pages()[0],
    page(1, 0, 0, comments.subarray(0, 255), [255]),
    page(2, 1, 0, Buffer.concat([comments.subarray(255), setup]), [comments.length - 255, setup.length]),
    page(3, 4, 11025, audio),
  ]
  assert.deepEqual(inspectOgg(Buffer.concat(output)).comments, ['TITLE=' + 'x'.repeat(280)])
})
