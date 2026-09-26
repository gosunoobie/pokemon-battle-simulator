# Background music

Home, private multiplayer and solo league pages create one `createExperienceAudio`
owner from `apps/shared/music/audio.js`. It composes the shared audio session,
streamed music player, soundtrack director, preferences and optional battle-audio
adapter. Home does not import battle sound catalogs.

## Soundtrack policy

| Context | Themed track |
| --- | --- |
| Home, selections and lobby | Opening theme |
| Private battle or legacy solo battle | Wild battle |
| Regional league, including its Champion | Elite Four |
| Generic tournament (available policy for a future host) | Gym Leader |
| Results and between battles | Continue the current battle track |

`public/music/wild_batle.mp3` is the supplied filename. Its stable catalog ID is
`wild-battle`. All asset URLs use the host base URL. There is no dedicated Champion
recording, so the existing Elite Four track is the explicit fallback.

Random mode hashes the confirmed match ID and catalog version into the three
battle tracks. The opening theme is never in that pool. Track selection is pinned
for the match, including when the preference changes. Up to 64 validated choices
are retained in session storage to survive document reloads; blocked storage falls
back to memory. New matches use the current preference. This is cosmetic policy
and never uses battle-rule RNG or changes the server protocol.

Hosts request battle music before the opening presentation and retain it through
turns, results, reconnects and the wait for the next battle. Syncing or reloading
an already-completed match selects that match's battle track. Advancing selects
the next match's track directly, without the opening theme in between. Menu music
returns only when the host returns to home, selection or a lobby without a match.
Old presentation callbacks are guarded by each host's existing generation checks.

## Ownership and playback

`createAudioSession` in `packages/battle-audio` owns the single lazy AudioContext
and master gain. `createAudioPlayer({ session })` borrows it for short sounds;
`createMusicPlayer({ session })` borrows it for one reusable HTMLAudioElement.
Standalone short-sound callers retain their existing API and resource limits.
Stopping, cancelling or disposing a short-sound player never closes the shared
session or stops music. Only the page owner disposes the shared session.

The transient branch is attenuated to a maximum native-sample peak allocation of
0.75 after accounting for configured category multipliers. Music has a 0.25
allocation, multiplied by its own volume and catalog attenuation. The master
volume applies once after both branches. This is gain budgeting, not a claim of
true-peak limiting or device loudness normalization.

Music defaults to 80% of its branch. Battle hosts use category multipliers of
approximately 1.61847 for SFX and 0.41072 for cries. Their nominal gains are 0.405
for SFX and 0.144 per cry, versus music's 0.20 default (0.25 ceiling). Compared with the previous
normalized mix (SFX 1.67475, cries 0.55), this raises move sounds another 10% and
lowers cries 15%. Super-effective and not-very-effective cues additionally use
an event multiplier of 1.25/1.1, raising them 25% in total. These adjustments
leave the source recordings and authored move gains intact; simultaneous SFX
retain their existing peak-budget normalization. Saved user volume choices
still take precedence over defaults.

Track changes fade out for 160 ms, change source, then fade in for 260 ms. There
is no second player, decoded music cache, per-turn restart or automatic ducking.
Desired track identity, load deadlines, media errors and play promises are guarded
against stale work. Neither audio loading nor playback gates battle progress.

An explicit click/tap/activation key unlocks playback. AudioContext resume and
media play are separate browser gates; later gestures retry a locked player. Hidden
documents pause music without replaying old SFX. BFCache navigation retains a
paused owner for `pageshow`; ordinary page exit releases it. Full-document
navigation restarts playback after activation; continuous cross-page playback is
not implemented.

## Assets and loops

The supplied MP3s are unchanged. They are stereo 44.1 kHz, approximately 129–157
seconds long, and contain authored fade-outs. Signal inspection found long silent
tails in Wild Battle and Elite Four. Conservative catalog `loopEnd` markers skip
the already-silent portions at 137.35 s and 125.3 s, and the opening theme at
155.7 s. Gym Leader uses its full duration. A guarded media-time observer seeks to
the beginning without allocating another player or invoking play again.

These are fade/restart loops, not sample-accurate musical loops. Browser timeupdate
cadence may add a short delay at the silence boundary. New recordings need an
endpoint and listening review; seamless musical looping requires suitable assets.

## Preferences and checks

Player-facing pages omit audio settings and animation toggles. Playback uses the
configured mix and any existing saved preferences; reduced motion follows the
device preference. The FX playground retains its own testing controls.

`battle-lab:audio:v3` stores master, music, cries, move sounds and themed/random
preferences. Valid v1/v2 settings migrate without losing mute or volume choices.
The standalone battle adapter uses this same service, preserving music settings
when users visit the move preview. Storage failures remain an in-memory fallback;
cross-tab preference events never echo writes.

Run `node --test tests/audio-session.test.mjs tests/music-*.test.mjs` for focused
coverage. Shared-runtime changes also require `npm test` and `npm run build`.
Browser checks should cover gesture unlock, same-match refresh, final-result
timing, mute, background/return, missing media and back navigation. Mobile Safari
playback requires a real-device check; a narrow desktop viewport verifies layout
only.
