# Stage A battle SFX audit

**530 files decoded; 354 moves accounted for; zero approved playback mappings.** No recordings or battle playback were changed.

| Measurement | Result |
| --- | ---: |
| Encoded bytes | 43609096 |
| Reference PCM bytes | 371809856 |
| Total decoded seconds | 1053.882812 |
| Duration range, seconds | 0.45510204–6.78 |
| Files with samples above full scale | 1 |
| Maximum sample peak | 1.00584316 |
| Moves with filename candidates | 352/354 |
| Moves with FX | 335/354 |
| Exact decoded PCM duplicate groups | 0 |

Decoder: mpg123-decoder 1.0.3. Its package integrity and installed implementation hashes are pinned in [audit-lock.json](../audit-lock.json). Metrics use decoded Float32 PCM at the source sample rate, not encoded frame duration. Samples above full scale are warnings, not proof that the original source was clipped. Sample peak is not oversampled true peak.

Missing named assets: **mirrormove, naturepower**. Called-move policies remain explicit; there is no inferred recording or client battle-rule implementation.

No FX recipe: acid, camouflage, conversion, conversion2, covet, growth, haze, heatwave, mist, powdersnow, pursuit, shockwave, sludge, snatch, spore, stockpile, swallow, thief, waterspout. Audio candidate coverage is independent of FX availability.

All mappings are candidates or explicit unresolved policies. Regions, gain, audible cue identity, source vintage/rights, perceptual duplication and browser alignment remain unapproved. Quiet boundaries use a fixed -60 dBFS sample threshold; they are not perceptual onset annotations.

See [full decoded measurements](decoded.json), [coverage](sfx-coverage.json), [discrepancies](sfx-discrepancies.json), and [generation receipt](sfx-generation.json). Stage B must audition sounds against animations before any move playback is enabled.
