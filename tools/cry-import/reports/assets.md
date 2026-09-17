# Validated Gen 1–3 cry assets

All **419 identities** map to **386 source files**, including six explicitly evidenced form aliases. Every file passed source length/Git blob verification, Ogg CRC/structure checks and full decoding with the pinned @wasm-audio-decoders/ogg-vorbis 0.1.20.

- Source and deployed audio: **2,245,221 bytes**.
- Transform: **none**; deployed bytes exactly match the upstream originals.
- Channels: 1. Sample rates: 10512 Hz.
- Duration: 0.181–2.238 seconds.
- Files with decoded samples above full scale: 284. Peak: 1.19033456.

## Optimization decision

Keep these already compact Ogg files unchanged. Content hashes provide stable file identity; forms share existing assets. No additional lossy encoding, silence trimming, pitch changes or normalization is justified by this audit. Original files are cached outside public and excluded from Git and Heroku.

## Audio review

Vorbis float decoding can overshoot full scale. These are measurements, not a claim that the source recording clipped. Preserve source bytes; allow headroom in the future mixer. No gain is applied here.

Use the development-only listening tool at `/tools/cry-import/preview.html` while running `npm run dev`. Nothing autoplays. Its native decode audit tests the current browser, not every supported device.

## Mapping evidence

Castform Rainy/Snowy/Sunny share legacy/351.ogg; Deoxys Attack/Defense/Speed share legacy/386.ogg. See [pinned source evidence](../form-evidence/README.md). These are six explicit mappings; unknown forms still have no fallback.

## Remaining limitations

- Legacy recording vintage and redistribution rights remain unverified.
- Automated decoding does not replace listening review.
- Native browser/device compatibility is recorded separately; no MP3 fallback is generated.
- Battle playback integration remains stage three.
