import test from 'node:test'
import assert from 'node:assert/strict'
import { deflateSync } from 'node:zlib'
import { PNG } from 'pngjs'
import { inspectPng, gitBlobHash } from '../png.mjs'

function rgbaFixture(width, height, pixels = []) {
  const data = Buffer.alloc(width * height * 4)
  for (const [x, y, alpha] of pixels) {
    const at = (y * width + x) * 4
    data.set([20, 120, 220, alpha], at)
  }
  return PNG.sync.write({ width, height, data }, { colorType: 6, inputColorType: 6 })
}

// A tiny indexed fixture exercises PLTE/tRNS decoding, which the PNG writer does not support.
function chunk(type, bytes) {
  const body = Buffer.concat([Buffer.from(type), bytes])
  let crc = 0xffffffff
  for (const byte of body) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
  }
  const size = Buffer.alloc(4), checksum = Buffer.alloc(4)
  size.writeUInt32BE(bytes.length)
  checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0)
  return Buffer.concat([size, body, checksum])
}
function indexedFixture() {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(2, 0)
  header.writeUInt32BE(2, 4)
  header[8] = 8
  header[9] = 3
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('PLTE', Buffer.from([0, 0, 0, 120, 30, 50, 20, 40, 60])),
    chunk('tRNS', Buffer.from([0, 1, 255])),
    chunk('IDAT', deflateSync(Buffer.from([0, 0, 1, 0, 2, 0]))),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

test('measures decoded RGBA pixels including alpha 1 and excludes transparent padding', () => {
  const bytes = rgbaFixture(6, 5, [[1, 1, 1], [4, 3, 255], [2, 2, 128], [5, 4, 0]])
  const original = Buffer.from(bytes)
  assert.deepEqual(inspectPng(bytes), { width: 6, height: 5, bounds: { x: 1, y: 1, width: 4, height: 3 }, opaquePixels: 3 })
  assert.deepEqual(bytes, original, 'inspection preserves the source bytes')
})

test('measures indexed palette PNG alpha accurately', () => {
  assert.deepEqual(inspectPng(indexedFixture()), { width: 2, height: 2, bounds: { x: 0, y: 0, width: 2, height: 2 }, opaquePixels: 2 })
})

test('preserves positive alpha below eight-bit precision in a sixteen-bit PNG', () => {
  const header = Buffer.alloc(13), scanline = Buffer.alloc(17)
  header.writeUInt32BE(2, 0)
  header.writeUInt32BE(1, 4)
  header[8] = 16
  header[9] = 6
  scanline.writeUInt16BE(1, 7)
  const bytes = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header), chunk('IDAT', deflateSync(scanline)), chunk('IEND', Buffer.alloc(0)),
  ])
  assert.deepEqual(inspectPng(bytes), { width: 2, height: 1, bounds: { x: 0, y: 0, width: 1, height: 1 }, opaquePixels: 1 })
})

test('single pixels have inclusive one-pixel bounds and accept Uint8Array views', () => {
  const png = rgbaFixture(3, 4, [[2, 3, 255]])
  const padded = Buffer.concat([Buffer.alloc(7), png, Buffer.alloc(5)])
  const view = new Uint8Array(padded.buffer, padded.byteOffset + 7, png.length)
  assert.deepEqual(inspectPng(view), { width: 3, height: 4, bounds: { x: 2, y: 3, width: 1, height: 1 }, opaquePixels: 1 })
})

test('rejects fully transparent images and accepts the exact maximum dimension', () => {
  assert.throws(() => inspectPng(rgbaFixture(2, 2)), /no visible pixels/)
  assert.equal(inspectPng(rgbaFixture(512, 1, [[511, 0, 1]])).bounds.x, 511)
  assert.equal(inspectPng(rgbaFixture(1, 512, [[0, 511, 1]])).bounds.y, 511)
})

test('rejects corrupt PNG chunk CRCs', () => {
  const bytes = indexedFixture()
  // Change a palette value without updating its chunk checksum.
  const paletteAt = bytes.indexOf(Buffer.from('PLTE'))
  bytes[paletteAt + 4] ^= 1
  assert.doesNotThrow(() => PNG.sync.read(bytes, { checkCRC: false }), 'only the checksum is invalid')
  assert.throws(() => inspectPng(bytes), /CRC mismatch/)
})

test('checks ancillary chunk CRCs that the decoder would otherwise skip', () => {
  const bytes = indexedFixture()
  const annotation = chunk('tEXt', Buffer.from('Comment\0Test'))
  const annotated = Buffer.concat([bytes.subarray(0, 33), annotation, bytes.subarray(33)])
  assert.equal(inspectPng(annotated).opaquePixels, 2)
  annotated[33 + 8] ^= 1
  assert.doesNotThrow(() => PNG.sync.read(annotated, { checkCRC: true }), 'pngjs skips unknown ancillary checksums')
  assert.throws(() => inspectPng(annotated), /CRC mismatch in tEXt/)
})

test('rejects wrong headers, truncated files, and invalid dimensions before decoding', () => {
  assert.throws(() => inspectPng(Buffer.from('not a PNG file')), /signature/)
  const wrongHeader = rgbaFixture(1, 1, [[0, 0, 255]])
  wrongHeader.write('IDAT', 12, 'ascii')
  assert.throws(() => inspectPng(wrongHeader), /first chunk/)
  const zeroWidth = rgbaFixture(1, 1, [[0, 0, 255]])
  zeroWidth.writeUInt32BE(0, 16)
  assert.throws(() => inspectPng(zeroWidth), /dimensions/)
  assert.throws(() => inspectPng(rgbaFixture(513, 1, [[0, 0, 255]])), /dimensions/)
  assert.throws(() => inspectPng(rgbaFixture(1, 513, [[0, 0, 255]])), /dimensions/)
  assert.throws(() => inspectPng(rgbaFixture(2, 2, [[0, 0, 255]]).subarray(0, 40)), /Invalid PNG/)
  const original = rgbaFixture(1, 1, [[0, 0, 255]])
  assert.throws(() => inspectPng(Buffer.concat([original.subarray(0, 33), original.subarray(8)])), /duplicate IHDR/)
  assert.throws(() => inspectPng(Buffer.concat([original, Buffer.from([0])])), /trailing bytes/)
  assert.throws(() => inspectPng('image.png'), /Buffer or Uint8Array/)
})

test('computes Git blob identity from the exact bytes rather than a re-encoded PNG', () => {
  assert.equal(gitBlobHash(Buffer.alloc(0)), 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391')
  assert.equal(gitBlobHash(Buffer.from('hello\n')), 'ce013625030ba8dba906f756967f9e9ca394464a')
  const png = indexedFixture(), padded = Buffer.concat([Buffer.from('prefix'), png])
  assert.equal(gitBlobHash(new Uint8Array(padded.buffer, padded.byteOffset + 6, png.length)), gitBlobHash(png))
})
