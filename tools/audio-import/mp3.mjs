import { createHash } from 'node:crypto'

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const fail = message => { throw new Error(message) }

// Intentionally narrow: this collection is MPEG-1 Layer III, not a general MP3 editor.
// Walk every frame so a bad tag boundary cannot silently truncate the audio.
export function inspectMp3(bytes) {
  const end = bytes.length >= 128 && bytes.toString('latin1', bytes.length - 128, bytes.length - 125) === 'TAG'
    ? bytes.length - 128 : bytes.length
  const rates = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
  let offset = 0, frameCount = 0, format
  while (offset < end) {
    if (end - offset < 4) fail('Truncated MPEG header')
    const header = bytes.readUInt32BE(offset)
    if ((header >>> 21) !== 0x7ff || ((header >>> 19) & 3) !== 3 || ((header >>> 17) & 3) !== 1) fail('Expected MPEG-1 Layer III frame')
    const bitrateKbps = rates[(header >>> 12) & 15]
    const sampleRate = [44100, 48000, 32000][(header >>> 10) & 3]
    if (!bitrateKbps || !sampleRate) fail('Unsupported MPEG bitrate or sample rate')
    const channels = ((header >>> 6) & 3) === 3 ? 1 : 2
    const next = { sampleRate, channels, bitrateKbps }
    if (format && Object.keys(next).some(key => format[key] !== next[key])) fail('Changing MPEG format is unsupported')
    format = next
    const size = Math.floor(144000 * bitrateKbps / sampleRate) + ((header >>> 9) & 1)
    if (offset + size > end) fail('Truncated MPEG frame')
    offset += size; frameCount++
  }
  if (!frameCount) fail('Missing MPEG audio')
  return { frameCount, ...format }
}

function textValue(data) {
  if (!data.length) fail('Empty ID3 text frame')
  let value
  if (data[0] === 0) value = data.subarray(1).toString('latin1')
  else if (data[0] === 1) {
    if (data.length < 3 || (data.length - 3) % 2) fail('Invalid UTF-16 ID3 text')
    if (data[1] === 0xff && data[2] === 0xfe) value = data.subarray(3).toString('utf16le')
    else if (data[1] === 0xfe && data[2] === 0xff) value = Buffer.from(data.subarray(3)).swap16().toString('utf16le')
    else fail('Missing UTF-16 ID3 byte order mark')
  } else fail('Unsupported ID3 text encoding')
  return value.replace(/\0+$/, '')
}

export function stripId3v2(input) {
  if (input.length < 10 || input.toString('latin1', 0, 3) !== 'ID3') fail('Missing original ID3v2 header')
  if (input[3] !== 3 || input[4] !== 0 || input[5] !== 0) fail('Only unflagged ID3v2.3.0 is supported')
  if ([...input.subarray(6, 10)].some(value => value & 0x80)) fail('Invalid synchsafe ID3 size')
  const headerBytes = 10 + [...input.subarray(6, 10)].reduce((value, byte) => value * 128 + byte, 0)
  if (headerBytes > input.length) fail('Truncated ID3 tag')
  const text = {}, pictures = []
  let offset = 10
  while (offset < headerBytes) {
    if (input[offset] === 0) {
      if (input.subarray(offset, headerBytes).some(byte => byte !== 0)) fail('Nonzero ID3 padding')
      break
    }
    if (offset + 10 > headerBytes) fail('Truncated ID3 frame header')
    const id = input.toString('latin1', offset, offset + 4)
    const size = input.readUInt32BE(offset + 4)
    if (!/^[A-Z0-9]{4}$/.test(id) || !size || offset + 10 + size > headerBytes) fail('Invalid ID3 frame')
    if (input.readUInt16BE(offset + 8) !== 0) fail('Unsupported ID3 frame flags')
    const data = input.subarray(offset + 10, offset + 10 + size)
    if (id.startsWith('T') && id !== 'TXXX') {
      if (Object.hasOwn(text, id)) fail('Duplicate ID3 text field')
      text[id] = textValue(data)
    } else if (id === 'APIC') {
      if (data[0] !== 0) fail('Unsupported APIC encoding')
      const mimeEnd = data.indexOf(0, 1), descriptionEnd = data.indexOf(0, mimeEnd + 2)
      if (mimeEnd < 2 || descriptionEnd < mimeEnd + 2 || descriptionEnd + 1 >= data.length) fail('Invalid APIC frame')
      const picture = data.subarray(descriptionEnd + 1)
      pictures.push({ mime: data.toString('latin1', 1, mimeEnd), bytes: picture.length, sha256: sha256(picture), frameBytes: data.length })
    } else fail(`Unsupported ID3 frame ${id}; preserve and review it before optimizing`)
    offset += 10 + size
  }
  // Preserve ALL remaining bytes, including Xing/LAME gapless data and ID3v1.
  const bytes = input.subarray(headerBytes)
  return { bytes, metadata: { headerBytes, text, pictures }, mpeg: inspectMp3(bytes) }
}
