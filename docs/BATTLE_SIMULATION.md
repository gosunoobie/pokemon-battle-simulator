# Visual battle simulation

The home page (`/`) links the live battle simulation (`/simulation.html`), existing move preview (`/preview.html`) and independent effects playground (`/playground.html`). The preview and FX recipes keep their existing behavior.

## Run the complete slice

Use the existing Node 24 workspace installation, then `npm run dev`. The Vite server hosts all pages and the simulation API. For a built local version, run `npm run build` followed by `npm start`, then open `http://127.0.0.1:3000`. `npm run preview` also provides the API. An HTML-only static host can serve home/preview/playground but cannot run the Node engine.

Select a Kanto, Johto or Hoenn preset, then choose its lead. Every six-member team validates through the engine's `gen3opensinglesv1` profile. The match starts immediately without team preview. Choose one legal move or switch per decision; a faint or other forced replacement exposes the replacement choices supplied by the engine. A simple automated opponent chooses legal actions, preferring the first available damaging move. This is a mechanics demonstration, not a strategic AI benchmark.

The interface shows move PP and pinned Gen 3 metadata, exact own HP, public opponent HP, major conditions, stat changes, side conditions, revealed abilities/items and a battle log. Opponent HP is shown as an approximate percentage of the public bar, never reconstructed as exact HP. Finish normally or forfeit, then choose another team. Refreshing or navigating back resumes the browser's current in-memory match without replaying old animations.

## Pokémon send-outs

Starting a new battle releases both leads from Poké Balls. Voluntary switches and forced replacements release only the incoming Pokémon, and the presenter waits for the release before showing the next move. A larger ball tumbles twice along an arc with a tapered speed trail; its moving button and curved seam make the rotation visible. A bright opening flash, cyan/gold rings and sparks accompany a white Pokémon silhouette that quickly resolves into its normal colors and resting position. Sprite proportions, visible-size minimums and ground platforms remain the host's existing geometry.

**Battle animations** controls send-outs, moves and fainting. **Skip animations** immediately reconciles the full server view and its final lineup. Reduced motion uses short fades without a thrown ball, flash or sinking motion. Reconnect/sync restores the current field without repeating old transitions; form changes and identity corrections also do not throw another ball.

The cosmetic transition is a separate `@battle/battle-fx/transitions` export, loaded on demand. It receives the scene and entering actor IDs, never species data, HP or battle rules. The scene coordinator hides incoming art before mounting it, owns cancellation and rejects stale loads. A renderer or transition failure must leave the final Pokémon visible and battle controls usable.

When server facts report a new knockout, HP reaches zero at the hit's impact while the outgoing sprite remains for the attack's recovery. The presenter then waits for a 0.9-second faint: a brief desaturated dip and a full-size silhouette sinking behind its own ground line, with a subtle ripple and dust. Only an owned snapshot is masked; platforms and shared sprite textures remain untouched. Reduced motion uses a 0.22-second fade. Either side, simultaneous knockouts, recoil and residual damage follow the same ordering before a replacement enters. Skip, failure, timeout or reset clears the retained outgoing artwork and restores the authoritative lineup; reconnect never replays a prior faint.

## Idle motion

Living Pokémon breathe and sway gently while waiting for a choice, with different phases for the two sides. Uniform growth stays within 1.2% and sway within 0.26 degrees; both are reduced when artwork is close to the field edge. The sprite's visible bottom-center remains anchored to its platform, and the existing minimum sprite sizes are preserved.

`apps/simulation/src/idle.js` owns one optional GSAP timeline for the current scene. The host restores resting poses synchronously before attacks, send-outs, fainting or scene replacement, and resumes with a short ease-in after presentation settles. Fainted actors and completed matches do not idle. Turning off **Battle animations**, enabling **Reduced motion**, hiding the tab or leaving the page stops idle motion. This is host presentation only: it imports no rules, species data or move artwork, and the move preview/playground remain unchanged.

## Ownership and data flow

```mermaid
flowchart LR
  UI[Vue simulation controls] -->|match-bound choice| API[Node simulation service]
  API -->|validated decision| Engine[Independent Gen 3 engine]
  Engine -->|permitted p1 view and events| API
  API --> UI
  UI --> Presenter[Display event presenter]
  Presenter --> Scene[Existing sprite scene]
  Presenter -. optional move request .-> FX[Independent battle FX]
```

- `apps/server/simulation.js` owns the engine factory and match sessions, validates HTTP input, drives the automated seat, and returns only the permitted p1 view/events. The engine, its rule seed, checkpoints, and private p2 requests never enter the browser bundle.
- `apps/simulation/src/api.js` handles bounded same-origin requests. The random HttpOnly session cookie remains browser-managed. Decision retries retain the same command ID; every mutation binds to the displayed match so a stale tab cannot alter a replacement battle.
- `App.vue` keeps the latest authoritative view separate from the displayed snapshot. Buttons use legal options from the latest view and remain disabled while a request or presentation is active. Uncertain requests offer sync/retry rather than submitting a different command silently.
- `presentation.js` reads ordered, already-redacted protocol facts into display snapshots. It groups each move for optional animation, applies HP/status facts at an impact cue, and preserves switch/form/faint ordering. Missing FX, errors, missing cues, skip, reduced motion and deadlines all converge on the same final server view. Residual damage follows the move instead of being presented as contact damage.
- `scene.js` maps species to the existing pinned sprite profiles. Near and far actors retain stable `source`/`target` scene IDs. Replacements rebuild only the scene, preserving native artwork, sockets, scale and platform geometry. Late asynchronous loads cannot attach stale canvases. A renderer failure leaves DOM sprites and all engine controls available.

The browser does not import `battle-engine`, vendor Showdown code or the preview's fixed-result `battle-core`. FX receives only move ID, source/target field IDs, cosmetic phase/outcome and visual seed. The existing preview presenter remains independent. Animation clips are cosmetic: for example, a multi-hit recipe can show a different number of visible strikes from the engine's rolled hit count; the log and HP reflect the engine's complete result.

## Verification and limits

`npm run test:simulation` covers transport deadlines/retry payloads; presentation perspectives, preparation, miss/failure, HP reveal, switching, knockout, residuals, cancellation and late loads; and actual HTTP validation, privacy, stale-tab conflicts, session recovery, expiry, complete battles and static path protection. `npm test` includes that suite alongside the existing visual and boundary tests. `npm run test:engine` tests the headless package independently.

Send-out coverage uses real Pixi objects and paused GSAP timelines for all 838 sprite views, with bounds, custom pivots, cancellation and reduced motion checks. Coordinator/presenter tests cover opening pairs, same-species switches, no replay, delayed modules/renderers, skip, reset and final-lineup recovery after timeouts. Browser checks confirm opening throws, visible emergence on switches, skip, reduced motion and reconnect without replay.

Faint tests cover both sides, varied sprite bounds and pivots, mask/filter ownership, reduced motion and failure cleanup. Integration tests connect the actual transition to the presenter and scene coordinator, verifying zero-HP retention, attack recovery, final hiding, replacement entry and cancellation of stalled or superseded faint playback.

Idle tests check continuous loops, custom pivots, fixed feet/platforms, complete sprite bounds and cancellation of stale callbacks. Scene and real-FX integration tests verify preference changes, late imports, replacement/faint lifecycle, exact Tackle contact after pausing idle, and recovery without reviving defeated actors.

This is a single-process simulation interface. Sessions expire after 30 minutes without requests and are lost on server restart. The server defaults to 24 active sessions; that bound is not a measured production capacity target. Custom teams, invite rooms, human opponents, accounts, persistent match recovery, deadlines, deployment hardening and capacity testing remain future host-service work. The independent engine and data package support the full agreed species scope; this interface currently exposes three preset teams.
