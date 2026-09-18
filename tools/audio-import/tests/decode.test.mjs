import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { analyzePcm, decodeSound, inspectDecoderIdentity, DECODER_SPEC, DECODE_LIMITS } from '../decode.mjs'
import { inspectMp3, sha256 } from '../mp3.mjs'

const pcm = (channels, sampleRate = 44100) => ({ channelData: channels.map(channel => Float32Array.from(channel)), samplesDecoded: channels[0].length, sampleRate, errors: [] })

test('audits interleaved Float32 samples, quiet edges, gain and stereo correlation without changing them', () => {
  const source = pcm([[0, 0.5, -1.25, 0], [0, 0.25, -0.625, 0]])
  const before = source.channelData.map(channel => [...channel])
  const result = analyzePcm(source)
  const expectedBytes = Buffer.alloc(32)
  ;[0, 0, 0.5, 0.25, -1.25, -0.625, 0, 0].forEach((value, index) => expectedBytes.writeFloatLE(value, index * 4))
  assert.equal(result.pcmSha256, sha256(expectedBytes))
  assert.equal(result.decodedBytes, 32)
  assert.equal(result.sampleFrames, 4)
  assert.equal(result.peak, 1.25)
  assert.equal(result.peakDbfs, Number((20 * Math.log10(1.25)).toFixed(8)))
  assert.equal(result.rmsDbfs, Number((20 * Math.log10(Math.sqrt((0.25 + 0.0625 + 1.5625 + 0.390625) / 8))).toFixed(8)))
  assert.equal(result.samplesAboveFullScale, 1)
  assert.equal(result.leadingQuietFrames, 1)
  assert.equal(result.trailingQuietFrames, 1)
  assert.equal(result.stereoCorrelation, 1)
  assert.equal(result.truePeakDbfs, null)
  assert.equal(result.truePeakStatus, 'not-measured')
  assert.deepEqual(result.warnings, ['sample-peak-above-full-scale'])
  assert.deepEqual(source.channelData.map(channel => [...channel]), before)
})

test('either channel crossing the quiet threshold ends the quiet edge; quiet frames are not automatic trims', () => {
  const result = analyzePcm(pcm([[0, 0.0009, 0, 0], [0, 0.0011, 0, 0]]))
  assert.equal(result.leadingQuietFrames, 1)
  assert.equal(result.trailingQuietFrames, 2)
  assert.equal(result.sampleFrames, 4)
  assert.equal(result.allBelowThreshold, false)
})

test('digital silence is explicitly reviewable with null dBFS and undefined correlation', () => {
  const result = analyzePcm(pcm([[0, 0], [0, 0]]))
  assert.equal(result.allBelowThreshold, true)
  assert.equal(result.leadingQuietFrames, 2)
  assert.equal(result.trailingQuietFrames, 2)
  assert.equal(result.peak, 0)
  assert.equal(result.peakDbfs, null)
  assert.equal(result.rmsDbfs, null)
  assert.equal(result.stereoCorrelation, null)
  assert.deepEqual(result.warnings, ['entire-recording-below-quiet-threshold', 'stereo-correlation-undefined-zero-variance'])
  assert.doesNotMatch(JSON.stringify(result), /Infinity|NaN/)
})

test('correlation is mean-centered and distinguishes mono, constant and phase-inverted material', () => {
  assert.equal(analyzePcm(pcm([[1, -1, 1, -1], [-1, 1, -1, 1]])).stereoCorrelation, -1)
  assert.equal(analyzePcm(pcm([[1, 2, 3], [2, 3, 4]])).stereoCorrelation, 1)
  assert.equal(analyzePcm(pcm([[0.5, 0.5], [0.25, 0.25]])).stereoCorrelation, null)
  assert.equal(analyzePcm(pcm([[0.5, -0.5]])).stereoCorrelation, null)
})

test('rejects decoder errors, empty output, unsupported channels, sample mismatches and non-finite PCM', () => {
  for (const change of [
    { errors: [{ message: 'MPG123_ERR' }] }, { errors: undefined },
    { channelData: [] }, { channelData: [new Float32Array(1), new Float32Array(1), new Float32Array(1)] },
    { samplesDecoded: 0 }, { samplesDecoded: 1.5 }, { sampleRate: 0 }, { sampleRate: Infinity },
    { channelData: [Float32Array.from([NaN])] }, { channelData: [Float32Array.from([Infinity])] },
    { channelData: [Float32Array.from([1, 2])] }, { channelData: [[1]] },
  ]) assert.throws(() => analyzePcm({ ...pcm([[0.25]]), ...change }))
})

test('rejects excessive frame claims before allocating the interleaved audit buffer', () => {
  assert.throws(() => analyzePcm({ ...pcm([[0]]), samplesDecoded: Number.MAX_SAFE_INTEGER }), /resource limits/)
  assert.throws(() => analyzePcm({ ...pcm([[0]]), samplesDecoded: 1000, sampleRate: 1 }), /resource limits/)
})

test('pinned decoder produces repeatable, gapless native-rate output for a real collection file', async () => {
  const bytes = await readFile(new URL('../../../public/sound_effects/Absorb part 1.mp3', import.meta.url))
  const initialHash = sha256(bytes), format = inspectMp3(bytes)
  const result = await decodeSound(bytes, format)
  assert.equal(result.sampleRate, 44100)
  assert.equal(result.channels, 2)
  assert.equal(result.sampleFrames, 71442)
  assert.equal(result.durationSeconds, 1.62)
  assert.equal(result.pcmSha256, '00a515a048dffa36a0c287d872c09804209f48b1e5259a85fe3e98ed33526a58')
  assert.notEqual(result.sampleFrames, format.frameCount * 1152, 'MPEG encoded sample count is not the gapless decoded sample count')
  assert.deepEqual(await decodeSound(bytes, format), result)
  assert.equal(sha256(bytes), initialHash)
})

test('checks MPEG metadata and bounded input before loading or allocating a decoder', async () => {
  const bytes = await readFile(new URL('../../../public/sound_effects/Absorb part 1.mp3', import.meta.url))
  const format = inspectMp3(bytes)
  await assert.rejects(decodeSound(bytes, { ...format, frameCount: format.frameCount + 1 }), /disagrees/)
  await assert.rejects(decodeSound(bytes, { ...format, sampleRate: 48000 }), /disagrees/)
  await assert.rejects(decodeSound(bytes.subarray(0, bytes.length - 1), format), /MPEG/)
  await assert.rejects(decodeSound(new Uint8Array(DECODE_LIMITS.inputBytes + 1), format), /resource limits/)
  await assert.rejects(decodeSound(new Uint8Array(0), format), /empty/)
  await assert.rejects(decodeSound('not audio', format), /empty/)
  const mono = Buffer.alloc(1044); Buffer.from('fffbe0c4', 'hex').copy(mono)
  await assert.rejects(decodeSound(mono, inspectMp3(mono)), /stereo collection only/)
})

test('decoder identity pins installed code, embedded WASM and every dependency', async () => {
  const identity = await inspectDecoderIdentity()
  assert.equal(identity.name, DECODER_SPEC.name)
  assert.equal(identity.version, '1.0.3')
  assert.equal(identity.enableGapless, true)
  assert.match(identity.packageLockSha256, /^[a-f0-9]{64}$/)
  assert.match(identity.referenceConvention, /not a guarantee of browser-decoder sample alignment/)
  assert.equal(identity.dependencies.length, 4)
  assert.ok(identity.files.some(file => file.path === 'mpg123-decoder/src/EmscriptenWasm.js'))
  assert.ok(identity.files.some(file => file.path === '@wasm-audio-decoders/common/src/WASMAudioDecoderCommon.js'))
  assert.ok(identity.files.every(file => /^[a-f0-9]{64}$/.test(file.sha256) && file.bytes > 0 && !file.path.startsWith('/')))
  assert.deepEqual(await inspectDecoderIdentity(), identity)
})
