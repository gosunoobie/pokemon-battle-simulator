# Effectiveness sounds

The 2026-09-19 request enables `Hit Super Effective.mp3` and `Hit Weak Not Very Effective.mp3`. Both original recordings play whole at native speed with −6 dB gain, mixed through the existing SFX bus. No move animation, accepted sound plan, damage rule or result message changes.

The solo and private battle simulators use their shared impact presentation. It derives the feedback from published `-supereffective` / `-resisted` events for the active recipient, then starts the sound once at the same reveal as the label and HP display. Substitute hits remain eligible because effectiveness does not require visible HP loss. Neutral hits, immunity, misses, preparation and unrelated damage receive no added sound.

Move preview uses only the existing fixed `effective === true` move metadata and successful result. Its examples do not calculate type matchups or define resisted results. The hook plays once at impact; a successful animation lacking an impact cue gets it at final reveal.

Sound and Move sounds controls govern both cues. Reduced motion retains the event feedback; effects-off and reconnect do not replay skipped events. Batch ownership cancels sounds on skip, failure, replacement, reset, mute, hidden tabs and disposal. Natural completion permits the whole tail without extending the battle’s presentation wait. A missing audio buffer is skipped immediately rather than playing late.

`@battle/battle-sfx/event-runtime` is an independent event catalog with hash-addressed assets, source verification and an explicit whole-native policy. It now also includes the [Poké Ball and faint recordings](SFX_TRANSITION_AUDIO.md). It does not claim a listening review or browser trim measurements. The 44 accepted move plans retain their approved artwork and seconds-based edits; their current browser compatibility policy is described in the [rollout guide](SFX_ACCEPTED_ROLLOUT.md).

Generate with `npm run sfx:events`; check with `npm run sfx:events:check`. The source pair totals 101,609 encoded bytes. Tests cover both seats and directions, duplicate delivery, Substitute, natural tails, cancellation, decoder bounds, source integrity, production delivery and preview result gating.
