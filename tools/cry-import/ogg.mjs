// Structural inspection for the cry importer's single-stream Ogg Vorbis assets.
// Specs: https://xiph.org/ogg/doc/framing.html and
// https://xiph.org/vorbis/doc/Vorbis_I_spec.html (sections 4, 5 and appendix A).
// This is not a codec decoder: setup codebooks, setup framing and audio synthesis
// must also pass the separately pinned Vorbis decoder before an asset is accepted.
const MAX_BYTES = 16 * 1024 * 1024
const MAX_PACKET_BYTES = 4 * 1024 * 1024
const MAX_COMMENT_COUNT = 4096
const MAX_TEXT_BYTES = 1024 * 1024
const MAX_DURATION_SECONDS = 30
const SIGNATURE = Buffer.from('vorbis')
const CAPTURE = Buffer.from('OggS')
const utf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })
const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  let crc = value << 24
  for (let bit = 0; bit < 8; bit++) crc = (crc << 1) ^ (crc & 0x80000000 ? 0x04c11db7 : 0)
  return crc >>> 0
})

function requireValue(valid, message) {
  if (!valid) throw new Error(`Invalid cry Ogg: ${message}`)
}

function checksum(page) {
  let crc = 0
  for (let index = 0; index < page.length; index++) {
    const byte = index >= 22 && index < 26 ? 0 : page[index]
    crc = ((crc << 8) ^ crcTable[((crc >>> 24) ^ byte) & 255]) >>> 0
  }
  return crc
}

function readComments(packet) {
  let offset = 7
  function integer() {
    requireValue(offset + 4 <= packet.length, 'truncated comment length')
    const value = packet.readUInt32LE(offset)
    offset += 4
    return value
  }
  function text() {
    const length = integer()
    requireValue(length <= MAX_TEXT_BYTES && offset + length <= packet.length, 'invalid comment text length')
    let value
    try {
      value = utf8.decode(packet.subarray(offset, offset + length))
    } catch {
      throw new Error('Invalid cry Ogg: comment text is not valid UTF-8')
    }
    offset += length
    return value
  }
  const vendor = text()
  const count = integer()
  requireValue(count <= MAX_COMMENT_COUNT && count <= Math.floor((packet.length - offset) / 4), 'invalid comment count')
  const comments = Array.from({ length: count }, text)
  requireValue(offset < packet.length && (packet[offset] & 1) === 1, 'missing comment framing bit')
  // Preserve complete strings and duplicate fields; never flatten metadata to an object.
  return { vendor, comments }
}

/**
 * Inspect complete bytes without changing them. Duration is the final Ogg granule
 * divided by the declared sample rate; full decoding must independently confirm
 * that sample count. The 30-second limit is this cry pipeline's resource bound,
 * not a restriction imposed by the Ogg/Vorbis specifications.
 */
export function inspectOgg(bytes) {
  requireValue(bytes instanceof Uint8Array, 'expected a Uint8Array or Buffer')
  requireValue(bytes.byteLength >= 58 && bytes.byteLength <= MAX_BYTES, 'file size outside cry limits')
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 0, serial, pageCount = 0, packetCount = 0
  let parts = [], packetBytes = 0, sampleRate, channels, vendor, comments
  let previousGranule = 0n, finalGranule, ended = false

  function packetComplete(packet) {
    if (packetCount < 3) {
      const expectedType = [1, 3, 5][packetCount]
      requireValue(packet.length >= 8 && packet[0] === expectedType && packet.subarray(1, 7).equals(SIGNATURE), 'missing or out-of-order Vorbis header')
      if (packetCount === 0) {
        requireValue(packet.length === 30, 'identification header must contain 30 bytes')
        requireValue(packet.readUInt32LE(7) === 0, 'unsupported Vorbis version')
        channels = packet[11]
        sampleRate = packet.readUInt32LE(12)
        requireValue(channels > 0 && sampleRate > 0, 'zero channels or sample rate')
        const shortBlock = packet[28] & 15, longBlock = packet[28] >>> 4
        requireValue(shortBlock >= 6 && longBlock <= 13 && shortBlock <= longBlock, 'invalid Vorbis block sizes')
        requireValue((packet[29] & 1) === 1, 'missing identification framing bit')
      } else if (packetCount === 1) {
        ;({ vendor, comments } = readComments(packet))
      }
    } else {
      requireValue(packet.length > 0 && (packet[0] & 1) === 0, 'invalid Vorbis audio packet type')
    }
    packetCount++
  }

  while (offset < buffer.length) {
    requireValue(!ended, 'bytes or chained stream after end of stream')
    requireValue(offset + 27 <= buffer.length, 'truncated page header')
    requireValue(buffer.subarray(offset, offset + 4).equals(CAPTURE), 'missing page capture pattern')
    requireValue(buffer[offset + 4] === 0, 'unsupported Ogg version')
    const flags = buffer[offset + 5], segmentCount = buffer[offset + 26]
    requireValue((flags & ~7) === 0, 'unknown page flags')
    requireValue(segmentCount > 0, 'empty page is outside the cry profile')
    requireValue(offset + 27 + segmentCount <= buffer.length, 'truncated lacing table')
    const lacing = buffer.subarray(offset + 27, offset + 27 + segmentCount)
    const bodyBytes = lacing.reduce((sum, size) => sum + size, 0)
    const pageBytes = 27 + segmentCount + bodyBytes
    requireValue(offset + pageBytes <= buffer.length, 'truncated page body')
    const page = buffer.subarray(offset, offset + pageBytes)
    requireValue(page.readUInt32LE(22) === checksum(page), 'page CRC mismatch')
    const streamSerial = page.readUInt32LE(14), sequence = page.readUInt32LE(18)
    if (pageCount === 0) {
      serial = streamSerial
      requireValue(flags === 2 && pageBytes === 58 && segmentCount === 1 && lacing[0] === 30, 'invalid beginning-of-stream identification page')
    } else {
      requireValue((flags & 2) === 0, 'unexpected beginning-of-stream flag')
      requireValue(streamSerial === serial, 'multiple logical streams are not supported')
    }
    requireValue(sequence === pageCount, 'nonsequential page number')
    requireValue(Boolean(flags & 1) === (packetBytes > 0), 'packet continuation flag mismatch')
    const granule = page.readBigInt64LE(6)
    requireValue(granule >= -1n && granule <= BigInt(Number.MAX_SAFE_INTEGER), 'invalid or unsafe granule position')
    const beforePackets = packetCount
    let bodyOffset = 27 + segmentCount
    for (const length of lacing) {
      parts.push(page.subarray(bodyOffset, bodyOffset + length))
      packetBytes += length
      requireValue(packetBytes <= MAX_PACKET_BYTES, 'packet exceeds cry resource limit')
      bodyOffset += length
      if (length < 255) {
        packetComplete(parts.length === 1 ? parts[0] : Buffer.concat(parts, packetBytes))
        parts = []
        packetBytes = 0
      }
    }
    if (beforePackets < 3) {
      requireValue(packetCount <= 3 && (packetCount < 3 || packetBytes === 0), 'audio must begin on a fresh page after setup')
      requireValue(granule === 0n, 'header page granule must be zero')
    } else if (packetCount === beforePackets) {
      requireValue(granule === -1n, 'page without a completed audio packet must have granule -1')
    } else {
      requireValue(granule >= previousGranule, 'audio granule moved backwards or is unknown')
      previousGranule = granule
    }
    ended = Boolean(flags & 4)
    if (ended) {
      requireValue(packetBytes === 0 && packetCount > 3 && granule > 0n, 'incomplete or empty end of stream')
      finalGranule = granule
    }
    pageCount++
    offset += pageBytes
  }
  requireValue(ended && packetBytes === 0 && finalGranule !== undefined, 'missing complete end of stream')
  const sampleFrames = Number(finalGranule), durationSeconds = sampleFrames / sampleRate
  requireValue(durationSeconds <= MAX_DURATION_SECONDS, 'duration exceeds the 30-second cry limit')
  return { container: 'ogg', codec: 'vorbis', channels, sampleRate, sampleFrames, durationSeconds, pageCount, packetCount, vendor, comments }
}
