# Accepted sound and animation rollout

On 2026-09-18 the user approved Batch 7 and authorized the latest versions from all seven batches in move preview, solo simulation and private multiplayer. The shared host composition now selects 44 unique move plans and 45 original sound assets. Ancient Power appears in two reviews; Batch 6 v2 is the selected runtime version.

`tools/audio-import/review/sync-rollout-001.approval.json` records that instruction, immutable latest Batch 4–7 snapshots, the actual Batch 7 browser feedback, and 73 source hashes. Earlier final approvals and all historical review files remain unchanged. The final rollout approval covers Eruption and Blizzard v4 without rewriting their preceding unreviewed browser verdicts. Batch 4’s page preserves its historical Ancient Power final; the game uses the later Batch 6 version.

`tools/audio-import/accepted-runtime.mjs` compiles the earlier three final batches and the verified rollout. `packages/battle-fx/src/accepted-recipes.js` selects package-owned final recipes independently of sound and battle state. The shared `reviewedFx.js` applies the approved pace once and gives longer clips a duration-aware deadline. Ancient Power loads its Rock Slide texture before the presentation clock starts. Reduced motion, misses, preparation, cancellation and custom registries keep their existing behavior.

Batch 5 alone opts into its reviewed 12 ms tapers at edited source boundaries. Full recordings and the earlier batches retain their original envelopes. All sounds remain at native speed; completion permits natural audio tails, while cancellation/reset stops owned voices.

The 2026-09-19 playback fix removes the Chrome-major and exact-frame-count restriction from these seconds-based accepted plans. All three hosts now validate actual decoded duration within 100 ms of the measured source, preserving approved offsets, regions, gain and pace across Web Audio browsers and device sample rates. Explicit endpoints tolerate at most one native sample of rounding; null endings use the whole native tail. Hash/byte checks still verify the original source, and neither an invalid decode nor a missing asset falls back to an older version. Historical listening and decoder evidence remains unchanged. The older frame-based pilot retains its separate decoder contract.

Presenters give an uncached move recording up to 500 ms to load before starting the animation clock. Failed or slow loads cannot delay committed battle decisions or start sound after its visual cue has passed. Skip/reset and deadlines cancel this preparation immediately.

Run `npm run sfx:accepted:check` to validate approval evidence, frozen playback sources and hash-addressed original audio delivery. Application tests cover exact final geometry in both directions, all 44 scheduling plans, preload/cancellation and deadline behavior. Sound-tool tests cover evidence integrity and final review routes. Build with `npm run build` for all production hosts.
