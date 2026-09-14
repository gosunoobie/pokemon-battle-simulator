import { createHash } from 'node:crypto'
import { crc32 } from 'node:zlib'
import { PNG } from 'pngjs'

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
const MAX_DIMENSION = 512

function byteBuffer(bytes) {
  if (!(bytes instanceof Uint8Array)) throw new TypeError('Expected PNG bytes as a Buffer or Uint8Array.')
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
}

function validateChunks(input) {
  let offset = 8
  while (offset < input.length) {
    if (offset + 12 > input.length) throw new Error('Invalid PNG: truncated chunk header or checksum.')
    const length = input.readUInt32BE(offset), end = offset + length + 12
    if (end > input.length) throw new Error('Invalid PNG: truncated chunk data.')
    const type = input.toString('ascii', offset + 4, offset + 8)
    if (type === 'IHDR' && offset !== 8) throw new Error('Invalid PNG: duplicate IHDR chunk.')
    // pngjs skips CRC checks for ancillary chunks it does not interpret.
    if (crc32(input.subarray(offset + 4, end - 4)) !== input.readUInt32BE(end - 4)) {
      throw new Error(`Invalid PNG: CRC mismatch in ${type} chunk.`)
    }
    if (type === 'IEND') {
      if (length !== 0 || end !== input.length) throw new Error('Invalid PNG: malformed IEND or trailing bytes.')
      return
    }
    offset = end
  }
  throw new Error('Invalid PNG: missing IEND chunk.')
}

/** Decode without modifying the source image; every pixel with alpha > 0 is visible. */
export function inspectPng(bytes) {
  const input = byteBuffer(bytes)
  if (input.length < 33 || !input.subarray(0, 8).equals(SIGNATURE)) throw new Error('Invalid PNG signature or truncated header.')
  if (input.readUInt32BE(8) !== 13 || input.toString('ascii', 12, 16) !== 'IHDR') throw new Error('Invalid PNG: the first chunk must be a 13-byte IHDR.')

  // Read the declared dimensions before decoding to bound the decoded allocation.
  const width = input.readUInt32BE(16), height = input.readUInt32BE(20)
  if (width < 1 || height < 1 || width > MAX_DIMENSION || height > MAX_DIMENSION) {
    throw new Error(`Unexpected PNG dimensions ${width}×${height}; each dimension must be 1..${MAX_DIMENSION}.`)
  }
  validateChunks(input)
  let decoded
  try {
    // Keep native channel precision: a 16-bit alpha value of 1 must not round to 0.
    decoded = PNG.sync.read(input, { checkCRC: true, skipRescale: true })
  } catch (error) {
    throw new Error(`Invalid PNG: ${error.message}`, { cause: error })
  }
  if (decoded.width !== width || decoded.height !== height || decoded.data.length !== width * height * 4) {
    throw new Error('Invalid PNG: decoded dimensions or RGBA byte length do not match its header.')
  }

  let left = width, top = height, right = -1, bottom = -1, opaquePixels = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (decoded.data[(y * width + x) * 4 + 3] === 0) continue
      opaquePixels++
      if (x < left) left = x
      if (x > right) right = x
      if (y < top) top = y
      if (y > bottom) bottom = y
    }
  }
  if (opaquePixels === 0) throw new Error('Invalid PNG: the image has no visible pixels (all alpha values are zero).')
  return { width, height, bounds: { x: left, y: top, width: right - left + 1, height: bottom - top + 1 }, opaquePixels }
}

/** Git blob object identity for provenance; this does not replace an artifact SHA-256. */
export function gitBlobHash(bytes) {
  const input = byteBuffer(bytes)
  return createHash('sha1').update(`blob ${input.length}\0`).update(input).digest('hex')
}
