import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join, relative } from 'node:path'
import { inspectMp3, sha256 } from './mp3.mjs'

const TOOL_ROOT = fileURLToPath(new URL('.', import.meta.url))
const PINS = Object.freeze({
  'mpg123-decoder': '1.0.3',
  '@wasm-audio-decoders/common': '9.0.7',
  '@eshaz/web-worker': '1.2.2',
  'simple-yenc': '1.0.4',
})
export const DECODE_LIMITS = Object.freeze({ inputBytes: 8 * 1024 * 1024, durationSeconds: 120, decodedBytes: 32 * 1024 * 1024 })
export const DECODER_SPEC = Object.freeze({
  name: 'mpg123-decoder', version: PINS['mpg123-decoder'], enableGapless: true,
  referenceConvention: 'Native-rate mpg123 Float32 output with Xing/LAME gapless handling enabled; no resampling, normalization, trimming or fades are added by this tool. This is a reference measurement, not a guarantee of browser-decoder sample alignment.',
})
const fail = message => { throw new Error(message) }
const round = value => Number(value.toFixed(8))
const db = magnitude => magnitude === 0 ? null : round(20 * Math.log10(magnitude))

// The WASM binary is embedded in EmscriptenWasm.js. Hash implementation files,
// including dependencies, so audit enrollment pins more than a version label.
export async function inspectDecoderIdentity() {
  const lockBytes = await readFile(join(TOOL_ROOT, 'package-lock.json'))
  const lock = JSON.parse(lockBytes)
  const manifest = JSON.parse(await readFile(join(TOOL_ROOT, 'package.json'), 'utf8'))
  if (manifest.devDependencies?.['mpg123-decoder'] !== DECODER_SPEC.version || lock.packages?.['']?.devDependencies?.['mpg123-decoder'] !== DECODER_SPEC.version) fail('MP3 decoder dependency is not exactly pinned')
  const dependencies = [], files = []
  const walk = async directory => {
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
      if (entry.isSymbolicLink()) fail('Unexpected symlink in MP3 decoder installation')
      const path = join(directory, entry.name)
      if (entry.isDirectory()) await walk(path)
      else if (/\.(?:[cm]?js|wasm)$/.test(entry.name) || entry.name === 'package.json') {
        const bytes = await readFile(path)
        files.push({ path: relative(join(TOOL_ROOT, 'node_modules'), path).split('\\').join('/'), bytes: bytes.length, sha256: sha256(bytes) })
      }
    }
  }
  const installedKeys = Object.keys(lock.packages ?? {}).filter(key => key !== '').sort()
  if (JSON.stringify(installedKeys) !== JSON.stringify(Object.keys(PINS).map(name => `node_modules/${name}`).sort())) fail('Unexpected MP3 decoder dependency graph')
  for (const [name, version] of Object.entries(PINS)) {
    const pin = lock.packages[`node_modules/${name}`]
    const root = join(TOOL_ROOT, 'node_modules', name)
    const installed = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
    if (pin?.version !== version || installed.version !== version || installed.name !== name || !/^sha512-/.test(pin.integrity ?? '')) fail(`MP3 decoder package pin mismatch: ${name}`)
    dependencies.push({ name, version, integrity: pin.integrity })
    await walk(root)
  }
  files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
  return { ...DECODER_SPEC, packageLockSha256: sha256(lockBytes), dependencies, files }
}

export function analyzePcm(result) {
  if (!result || !Array.isArray(result.errors) || result.errors.length) fail('MP3 decode reported errors')
  const { channelData, samplesDecoded: sampleFrames, sampleRate } = result
  if (!Array.isArray(channelData) || ![1, 2].includes(channelData.length)) fail('Unsupported decoded channel count')
  if (!Number.isSafeInteger(sampleRate) || sampleRate < 1 || sampleRate > 192000) fail('Invalid decoded sample rate')
  if (!Number.isSafeInteger(sampleFrames) || sampleFrames <= 0) fail('Empty or invalid decoded sample count')
  const channels = channelData.length, decodedBytes = sampleFrames * channels * 4
  if (!Number.isSafeInteger(decodedBytes) || decodedBytes > DECODE_LIMITS.decodedBytes || sampleFrames / sampleRate > DECODE_LIMITS.durationSeconds) fail('Decoded audio exceeds audit resource limits')
  if (channelData.some(channel => !(channel instanceof Float32Array) || channel.length !== sampleFrames)) fail('Decoded channel length/type mismatch')
  const pcm = Buffer.alloc(decodedBytes)
  let peak = 0, sumSquares = 0, samplesAboveFullScale = 0, firstAudible = -1, lastAudible = -1, offset = 0
  let meanLeft = 0, meanRight = 0, varianceLeft = 0, varianceRight = 0, covariance = 0
  for (let frame = 0; frame < sampleFrames; frame++) {
    for (const channel of channelData) {
      const value = channel[frame]
      if (!Number.isFinite(value)) fail('Non-finite decoded audio sample')
      pcm.writeFloatLE(value, offset); offset += 4
      const magnitude = Math.abs(value)
      peak = Math.max(peak, magnitude); sumSquares += value * value
      if (magnitude > 1) samplesAboveFullScale++
      if (magnitude > 0.001) { if (firstAudible < 0) firstAudible = frame; lastAudible = frame }
    }
    if (channels === 2) {
      // Online, mean-centered Pearson correlation avoids cancellation for DC.
      const deltaLeft = channelData[0][frame] - meanLeft, deltaRight = channelData[1][frame] - meanRight
      meanLeft += deltaLeft / (frame + 1); meanRight += deltaRight / (frame + 1)
      varianceLeft += deltaLeft * (channelData[0][frame] - meanLeft)
      varianceRight += deltaRight * (channelData[1][frame] - meanRight)
      covariance += deltaLeft * (channelData[1][frame] - meanRight)
    }
  }
  const allBelowThreshold = firstAudible < 0
  const stereoCorrelation = channels === 2 && varianceLeft > 0 && varianceRight > 0
    ? round(Math.max(-1, Math.min(1, covariance / Math.sqrt(varianceLeft * varianceRight)))) : null
  const warnings = []
  if (samplesAboveFullScale) warnings.push('sample-peak-above-full-scale')
  if (allBelowThreshold) warnings.push('entire-recording-below-quiet-threshold')
  if (channels === 2 && stereoCorrelation === null) warnings.push('stereo-correlation-undefined-zero-variance')
  return {
    sampleRate, channels, sampleFrames, durationSeconds: round(sampleFrames / sampleRate), decodedBytes,
    pcmFormat: 'interleaved-float32-le', pcmSha256: sha256(pcm), peak: round(peak), peakDbfs: db(peak),
    rmsDbfs: db(Math.sqrt(sumSquares / (sampleFrames * channels))), samplesAboveFullScale,
    quietThresholdDbfs: -60, leadingQuietFrames: allBelowThreshold ? sampleFrames : firstAudible,
    trailingQuietFrames: allBelowThreshold ? sampleFrames : sampleFrames - 1 - lastAudible,
    stereoCorrelation, allBelowThreshold, truePeakDbfs: null, truePeakStatus: 'not-measured', warnings,
  }
}

export async function decodeSound(bytes, format) {
  if (!(bytes instanceof Uint8Array) || !bytes.length || bytes.length > DECODE_LIMITS.inputBytes) fail('MP3 input exceeds audit resource limits or is empty')
  const input = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes)
  const actual = inspectMp3(input)
  if (!format || Object.keys(actual).some(key => actual[key] !== format[key])) fail('MP3 format disagrees with inspected MPEG frames')
  // This pinned wrapper outputs stereo even for mono inputs. Reject unsupported
  // source channels instead of claiming its duplicated output is native mono.
  if (format.channels !== 2) fail('Reference decoder audit currently supports the stereo collection only')
  const upperFrames = format.frameCount * 1152
  if (!Number.isSafeInteger(upperFrames) || upperFrames / format.sampleRate > DECODE_LIMITS.durationSeconds || upperFrames * format.channels * 4 > DECODE_LIMITS.decodedBytes) fail('MP3 exceeds decoder resource limits')
  const { MPEGDecoder } = await import('mpg123-decoder')
  const decoder = new MPEGDecoder({ enableGapless: true })
  let initialized = false
  try {
    await decoder.ready; initialized = true
    const result = decoder.decode(input)
    if (result.sampleRate !== format.sampleRate || result.channelData.length !== format.channels || result.samplesDecoded > upperFrames) fail('MP3 decoded format or sample count disagrees with MPEG bounds')
    return analyzePcm(result)
  } finally { if (initialized) decoder.free() }
}
