import { OggVorbisDecoder } from '@wasm-audio-decoders/ogg-vorbis'
import { sha256 } from './metadata.mjs'

export async function decodeCry(bytes, format) {
  if (format.channels > 2 || format.sampleRate > 192000 || format.durationSeconds > 30) throw new Error('Cry exceeds decoder resource limits')
  const decoder = new OggVorbisDecoder()
  try {
    await decoder.ready
    const result = await decoder.decodeFile(bytes)
    if (result.errors.length || result.sampleRate !== format.sampleRate || result.channelData.length !== format.channels || result.samplesDecoded !== format.sampleFrames) {
      throw new Error(`Cry decode failed or disagrees with Ogg headers: ${JSON.stringify(result.errors)}`)
    }
    const pcm = Buffer.alloc(result.samplesDecoded * format.channels * 4)
    let peak = 0, sumSquares = 0, samplesAboveFullScale = 0, firstAudible = -1, lastAudible = -1, offset = 0
    for (let frame = 0; frame < result.samplesDecoded; frame++) {
      for (const channel of result.channelData) {
        const value = channel[frame]
        if (!Number.isFinite(value)) throw new Error('Non-finite decoded cry sample')
        pcm.writeFloatLE(value, offset); offset += 4
        const magnitude = Math.abs(value)
        peak = Math.max(peak, magnitude); sumSquares += value * value
        if (magnitude > 1) samplesAboveFullScale++
        if (magnitude > 0.001) { if (firstAudible < 0) firstAudible = frame; lastAudible = frame }
      }
    }
    if (firstAudible < 0) throw new Error('Entire cry is below the -60 dBFS audit threshold')
    return {
      pcmFormat: 'interleaved-float32-le', pcmSha256: sha256(pcm), decodedBytes: pcm.length,
      peak: Number(peak.toFixed(8)), rmsDbfs: Number((20 * Math.log10(Math.sqrt(sumSquares / (result.samplesDecoded * format.channels)))).toFixed(6)),
      samplesAboveFullScale, quietThresholdDbfs: -60, leadingQuietFrames: firstAudible,
      trailingQuietFrames: result.samplesDecoded - 1 - lastAudible,
    }
  } finally { decoder.free() }
}
