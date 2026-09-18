# Sound and animation: accepted batch 1

The six final versions were accepted by the user on 2026-09-18. Open
`/sfx-bench?batch=sync-001` during `npm run dev` to replay the accepted versions.
This batch is read-only. Superseded comparison controls and editable drafts are
removed from its page. Batches 2 and 3 are also accepted. Continue reviewing at `/sfx-bench?batch=sync-004`.

| Move | Accepted sound timing | Accepted animation |
| --- | --- | --- |
| Body Slam | Whole recording starts about 0.031 s after the visual | 90% pace; authored impact 0.82 s occurs at about 0.911 s |
| Aerial Ace | Whole recording starts at 0.27 s | Original pacing |
| Hydro Pump | Whole recording starts at 0.49 s | Original pacing |
| Thunderbolt | Source region 0–1.91 s starts at 0.09 s; ends at 2.00 s | Original pacing |
| Triple Kick | One-hit recording starts at 0.24, 0.58 and 0.94 s | Original contacts at 0.50, 0.84 and 1.20 s; one final result cue |
| Absorb | Whole recording starts at 0.30 s | Original pacing |

## Review evidence

The initial numeric alignment proposals were reviewed by the user. Five were
kept immediately; Thunderbolt was shortened after feedback that its sound ran
past the animation. The 1.91-second source cutoff falls inside a measured quiet
gap (below −60 dBFS from 1.8412 to 2.0575 s), excluding the later loud section.
The revised batch was then explicitly accepted in chat.

`tools/audio-import/review/sync-batch-001.final.json` captures the six exact final
plans, source/PCM/visual identities, native decoder measurements and the explicit
acceptance. The earlier feedback exports remain historical provenance, not
selectable playback alternatives. Original MP3s remain unchanged and are shared
with other packages; no source recording is destroyed or re-encoded.

## Runtime use

`npm run sfx:accepted` generates the independent
`@battle/battle-sfx/accepted-runtime` catalog from the final record. Its six
accepted plans take precedence over historical pilot/draft defaults in the shared
audio host. Simulation, move preview and multiplayer therefore use the final
versions. No server or battle-rule change is involved.

The host supplies cosmetic pacing to the optional FX clock. Body Slam's 90% pace
works with sound muted too; recipe time, contact geometry and result cues remain
unchanged. The player receives the reviewed native-second regions, original
pitch/rate and attenuation. Triple Kick's three sounds never add battle hits.

The accepted sounds retain the reviewed Chrome 152 / 48 kHz native decoder gate.
Unsupported browser/decode profiles stay silent for these sounds rather than
falling back to superseded versions. Reduced motion, effects off, missed moves,
cancellation and skip retain the existing optional-presentation behavior.

`npm run sfx:accepted:check` verifies provenance, the generated catalog and the
existing hash-addressed asset files. The accepted runtime module contains only
final playback data; no audition UI, old proposals or user notes are bundled.
