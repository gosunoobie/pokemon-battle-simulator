# Migration and integration contracts

## What moved

| Previous path/API | Current owner |
| --- | --- |
| `src/App.vue` | `apps/game/src/components/BattleDemo.vue` |
| `src/moves.js` | Rules in `packages/battle-core/src/moves.js`; UI copy in `apps/game/src/moveDetails.js`; FX tint/name in `packages/battle-fx/src/catalog.js` |
| `src/battleResult.js` | `packages/battle-core/src/index.js` |
| `src/battle.js` scene setup | `apps/game/src/scene` |
| Original handlers and move factories | `packages/battle-fx/src/moves/restored/<move-id>.js` and `registry.js` |
| `playMove()` and HP callbacks | Committed core transaction + presenter enqueue + optional FX play |
| Effect images in `public/assets` | `packages/battle-fx/assets` |

The old `createBattle()` / `playMove()` / `flamethrower()` API is removed. Consumers must adopt the explicit contracts below. There is no hidden legacy wrapper that still applies damage from the animation timeline.

## Core usage

```js
import { createBattleState, resolveMove } from '@battle/battle-core'

let state = createBattleState([
  { id: 'hero', name: 'Hero', hp: 200, maxHp: 200 },
  { id: 'rival', name: 'Rival', hp: 140, maxHp: 140 },
])
const transaction = resolveMove(state, {
  moveId: 'hydro-pump', sourceId: 'hero', targetId: 'rival',
})
state = transaction.after // Commit now. No renderer or await required.
// Optional: presenter.enqueue(transaction, { effectsEnabled: true })
```

States and transaction/event records are frozen. `resolveMove` rejects unknown moves and invalid/fainted participants; it clamps damage to remaining HP. The game is responsible for dispatching each command once. A cosmetic replay never invokes the resolver again for an already committed command. The demo's Replay button intentionally creates a fresh preview state.

Drain rules set `drain: 0.5`. Core restores `Math.round(actualDamage * drain)`, capped by source missing HP, and commits both actors' HP in the same `after` snapshot. Drain events additionally carry `healing`, `sourceBeforeHp`, `sourceAfterHp` and `impactMessage`; `resultMessage` includes recovery. The optional FX package receives none of these HP fields. `apps/game/src/previewState.js` starts only drain previews at 65% source HP; this is host demo setup, not a battle rule.

Field weather rules use `target: 'field'` and set top-level `weather` to `rain`, `sun`, `sandstorm` or `hail` (initially `null`). Only a living source is required. Events use `targetIds: []` and omit actor HP fields; every actor remains unchanged. Subsequent weather replaces the field value, other moves preserve it, and fresh preview state clears it. This adds no turn duration, damage modifiers, residual damage or ability logic. The presenter reconciles the field badge using the ordinary impact/final snapshot flow.

Rules with `target: 'self'` resolve on `sourceId` without requiring an opponent and emit `targetIds: [sourceId]`. Event HP belongs to that affected actor. Barrier changes `defenseStage` (bounded −6…6); Protect, Light Screen and Reflect set the boolean preview fields `protected`, `lightScreen` and `reflect`. These flags can coexist. They do not yet alter fixed damage or expire over turns; the screens represent own-side effects in the singles preview.

Cure rules use `cure: 'refresh'` (burn, poison/bad poison or paralysis) or `cure: 'all'` (the user's status condition). They explicitly assign null and preserve HP, stat stages and guard flags. Bell/Aromatherapy are source-only previews because no party ownership is modeled. `rest: true` fills source HP and replaces its condition with sleep, except when already asleep or at maximum HP. Those failures and cures with no eligible condition return `outcome: 'failed'` with unchanged actors; FX skips them and the presenter still reconciles the result. Rest uses the ordinary impact phase, without drain-only event fields. Host fixtures start statused, and Rest starts at 70/156 HP. There is no sleep-turn engine or ability interaction layer.

Actors also carry `attackStage`, `specialAttackStage` and `specialDefenseStage` (integers −6…6, default zero), and boolean `focusEnergy` (default false). The new self rules use `attackChange`, `specialAttackChange`, `specialDefenseChange` or `focusEnergy`. Each requested stat clamps independently; a move fails only if every requested boost is capped. Focus Energy stores one +2 critical-hit-ratio effect and repeated use fails. These changes are committed in `after`, revealed at the ordinary impact cue, preserved through cures/Rest/damage, and reset only by a fresh host preview here. Stat multipliers, critical-hit rolls and switch-based expiry are not simulated.

`speedStage` follows the same integer −6…6 contract and defaults to zero; `speedChange` declares Dragon Dance's boost. Bulk Up includes Defense in combined cap checks and messages: Attack or Defense may still rise when the other is capped. Barrier retains its previous standalone Defense preview behavior, including its capped message. Howl remains `target: 'self'` in this singles host; allied targets and sound-related abilities are not modeled. Stat summary text is derived from the move's declared changes so single/double boosts and combined stats display accurately.

`evasionStage` is an integer −6…6 (default zero), changed by `evasionChange` for Double Team/Minimize. Evasion is stored without accuracy rolls or an unused minimized volatile. Acid Armor's Defense change participates in ordinary capped boost failure handling; Barrier retains its previous standalone capped result. Double Team uses the optional host snapshot provider for matching afterimages and a local outline fallback otherwise. Minimize/Acid Armor transform only cosmetic pose layers around the supplied floor and restore them before completion; no size value enters battle state.

## FX usage without any battle engine

```js
import { createBattleFx } from '@battle/battle-fx'

const fx = createBattleFx()
const controller = new AbortController()
const handle = fx.play({
  moveId: 'hydro-pump', sourceId: 'hero', targetIds: ['rival'],
  outcome: 'hit', visualSeed: 42,
}, {
  scene, signal: controller.signal, reducedMotion: false,
  onCue: cue => console.log(cue.type), // Cosmetic only
})
const result = await handle.finished
// result.status: completed | skipped | cancelled | failed
fx.dispose()
```

`scene` is provided by the host, not created by the package. `handle.cancel()` and an AbortSignal stop playback. Missing move/participants and unsupported outcomes settle as skipped; loader/builder/callback failures settle as failed; disposal cancels active work. Deadlines are finite (FX default 6000 ms, presenter default 6500 ms). The first target is used. A visual seed only controls effect variation and has no relationship to combat randomness.

Weather registry entries use `subject: 'field'`. Runtime aliases the optional target view to the source for lifecycle ownership, while each recipe draws directly with `scene.width`, `scene.height` and `scene.unit`. No opponent lookup, sprite metrics or battle weather state is needed. Reduced motion is a 10%-opacity field wash. The four recipes keep world gravity and composition when either side acts.

`createBattleFx` supports injected `assetLoader(key, url)`, `glowTexture`, `timelineEngine`, `effects` registry and `deadlineMs` for host integration/testing. Each registry entry is `{ build(context), contact, duration, subject?, recovery? }`. Optional `subject: 'source'` overrides the requested visual target before lookup: the recipe receives the source as both actor views, and normal/reduced effects center on the user. Such effects accept omitted, self or opponent target IDs; offensive effects still reject self targets. Cleanup resets each participating actor once. Normal recipes explicitly schedule their own cues; contact and optional recovery times are metadata checked against playback tests. Runtime accepts impact once and recovery once after impact for entries declaring recovery. Reduced motion uses impact at 0.20 s, optional recovery at 0.45 s, and completion at 0.80 s. The default implementation is browser PixiJS/GSAP; importing the package does not create a canvas.

## Scene contract

| Member | Meaning |
| --- | --- |
| `width`, `height`, `unit` | Logical stage dimensions and bounded stage scale |
| `effects` | PixiJS Container for temporary effect children |
| `camera` | Dedicated shake container, resting at zero |
| `actor(id)` | Actor view or undefined |
| `actor.metrics` | Resting visible-art width and height |
| `actor.facing` | Right = +1, left = −1 |
| `actor.anchor(name)` | Current posed semantic point in effect-layer space |
| `actor.base(name)` | Resting semantic point in the same space |
| `actor.hasAnchor(name)` | Optional: reports an explicitly available socket; beak/horn moves otherwise use emission |
| `actor.pose` | Resettable position/rotation/scale/alpha/tint layer |
| `actor.resetPose()` | Restore all cosmetic offsets |
| `actor.snapshot()` | Optional new display object showing current appearance |

Supported sockets: center, emission, hand, foot, body and ground. Transform anchors through the full display hierarchy, including padding, facing, scale and rotation. Keep layout roots stable during a play; cancel and reconstruct the scene when logical layout changes. Uniform window resizing can happen during playback. FX needs no actual sprite dimensions beyond the supplied visible metrics.

## Presentation and failures

`createPresenter` lives in the game app because it owns that app's display behavior. Inject `loadFx`, `getScene`, `onDisplay`, and optional `onBusy`, `onError`, `deadlineMs`. `enqueue(transaction, options)` queues a committed transaction. Options are effectsEnabled, reducedMotion and visualSeed. Its return status describes presentation, never whether damage happened.

For events with positive healing, impact reveals target damage while a display-only snapshot holds source HP at `sourceBeforeHp`. Recovery reveals the original full `after` snapshot and result message. Early, duplicate and stale cues are ignored. Completion, missing recovery, effects-off, skip and failure all reconcile `after`; neither display phase mutates a committed transaction or calculates healing.

`skip()` stops the current display and shows its committed result. `reset(snapshot, message)` clears the queue, invalidates late callbacks and displays a new authoritative snapshot. `destroy()` cancels work and disposes the loaded FX instance, including one that finishes loading late. An import deadline makes subsequent effects skip immediately; `retryEffects()` explicitly resets that failed loader state. Callback/cancellation errors cannot keep a transaction or busy state pending.

To integrate real combat later, replace the showcase resolver with your engine/server result adapter, commit that result before enqueue, and keep animation events cosmetic. Preserve event ordering at the host boundary; do not let completion callbacks advance authoritative turns or recalculate damage.

## Restoration after migration

All 33 original effects are now restored in separate move files. Shared visual primitives were removed because their introduction changed the approved choreography. The package boundaries, optional effects, lazy loading and presenter remain. Only coordinate/ownership adaptation is shared; each recipe owns its visuals. Semantic sockets now also support registration origin, floor, tackle, slam, trail and profile-specific attachments. See `ANIMATION_SPEC.md` for restoration evidence and `ADDING_MOVES.md` for the current recipe contract.

Struggle adds optional rule field `recoilMaxHp` and event fields `recoil`, `sourceBeforeHp`, `sourceAfterHp`. Both HP losses are committed in the same immutable result and displayed at the existing impact cue. These fields do not imply drain healing: only drain events carry `healing` and the delayed recovery presentation. FX still receives no HP or recoil rule values.

Leer/Scary Face use negative `defenseChange`/`speedChange` with direction-aware result text and the existing −6…6 stage bounds. Mean Look adds rule `trapPreview` and actor `trapped` (boolean, default false), marking the target without implementing switch/escape/expiry rules. Repeated trapping fails without changing actors. Glare reuses paralysis. These outcomes use the existing impact presentation; FX receives no stat or trapping state.

Take Down and Double-Edge use optional `recoilDamage` (0.25/0.33 of actual removed target HP), alongside Struggle’s distinct `recoilMaxHp`. The existing `recoil`, `sourceBeforeHp` and `sourceAfterHp` event fields apply to either basis. Positive recoil rounds to nearest HP with minimum one and caps at current HP; both losses commit together. No FX or presenter API change is required. Return uses a fixed maximum-friendship showcase and stores no friendship state.

Dynamic Punch adds optional rule `confuses` and actor `confused` (validated boolean, default false), separate from the major `condition`. A surviving target receives confusion without replacing poison, burn, paralysis or sleep. Existing confusion persists; repeated hits still deal damage. The ordinary impact reveal displays HP and confusion together, and a fresh preview clears the flag. Confusion duration, self-damage and immunity/ability interactions are not simulated. FX and presenter APIs are unchanged.

Rock Tomb reuses `speedChange` for a damaging move. Capped stat-only moves still fail, but a damaging move remains a hit at the cap. Damaging secondaries are skipped when the target faints, and combined result text includes actual damage. HP and Speed remain one immutable snapshot, revealed by the existing impact cue; no presenter or FX contract changed.

Hypnosis adds the rule flag `requiresClearCondition`: an occupied major `condition` makes this status move fail unchanged. Confuse Ray reuses `confuses`/`confused`, with status-only failure on repeated application and no zero-damage hit wording. Dynamic Punch remains successful against an already-confused target because its damage still applies. Confusion omits random secondary rolls. No actor, presenter or FX API fields were added.

Explosion and Self-Destruct add rule/event `selfDestruct`. Core sets source HP to zero and patches it with target damage atomically, exposing `sourceBeforeHp`/`sourceAfterHp` without recoil or healing fields. The ordinary impact reveal already displays this complete snapshot, so no presenter change is needed. Both recipes remain offensive; their artwork originating at the source does not change gameplay targeting. Fainted badges derive from displayed HP in the host; no HP data enters FX.

Seismic Toss adds rule `levelDamage` and actor `level` (integer 1–100, default 50). Core resolves its damage from the source level before committing the ordinary immutable result; the presenter and FX contract do not change. Submission reuses damage-based recoil. The host actor adapter adds reserved `visualCenter` at the visible-art midpoint for geometric pivot/bounds calculations, while custom anatomical `center` remains unchanged. New throw recipes fall back to `center` for external adapters lacking the optional socket.

## Opponent preview integration

Stable field IDs now work as either attacker or receiver in the host UI. `createPreviewState(move, { sourceId, actors })` applies recovery fixtures to the selected actor. `createPreviewTransaction` resolves one preview with an optional host-supplied `allowedMoveIds` list. There are no new battle-core rules or move IDs. Both status panels use the same component. Host actor defaults respect `nativeFacing`, partial anchors merge with profile anatomy, and scene creation accepts per-actor URL/texture overrides. The optional `scene.updateDepth(source, target)` hook controls overlap without changing geometry or state. See [Opponent previews](OPPONENT_PREVIEW.md).


## Optional two-round previews

Fly, Bounce, Dig and Dive accept an optional FX `request.phase`: `prepare` or `attack` (default). Phase selection precedes participant lookup; preparation requires only its source, emits `prepared` and resets its pose afterward. `PHASE_TIMINGS` exposes both clips; `EFFECT_TIMINGS` continues to describe default attacks. No state crosses clip boundaries.

The host's `createPreviewTransaction(MOVES.find(...), { phase: 'prepare', ... })` requires the enriched host move containing `preparation` text. It returns a frozen no-op with `before === after`, no revision increment, empty target IDs and `event.phase: 'prepare'`. A bare core `MOVE_RULES` item supports the default attack only. The presenter forwards the optional phase and reveals preparation text on `prepared` without HP animation. Effects-off, skip, failure and stale-callback handling retain their normal guarantees. Core gains only four attack rules; it does not implement turns, preparation state or invulnerability.

## Retaliation and special HP previews

`resolveMove(before, {moveId, sourceId, targetId, previousHit})` accepts an optional `previousHit: {sourceId, targetId, category, damage}` for Counter/Mirror Coat. It describes an already-received hit selected by the integrating game from the current turn: the record's source must be the current target, its target must be the current source, category must match `physical`/`special`, and damage must be a positive safe integer. A missing or ineligible record produces a failed action with unchanged actor state. The core does not store or select history; the host demo supplies labeled 32-physical/36-special samples and starts after that sample HP loss.

Pain Split commits both actors to `floor((source.hp + target.hp)/2)`, independently capped at their maximum HP. Endeavor reduces only a healthier target to the user's current HP, otherwise failing unchanged. Special events include `sourceBeforeHp`/`sourceAfterHp`; Pain Split also includes `hpSplit: true`, with no `healing`/recovery phase. The existing presenter reveals both committed HP values at one impact cue. FX receives only the existing cosmetic request; it never receives `previousHit`, HP values or calculation authority. Host sample setup leaves fainted custom actors unchanged so core validation still rejects them.

The disruption additions use five optional, validated actor booleans: `disabled`, `encored`, `tormented`, `imprisoning`, and `taunted` (all default false). `restrictionPreview` sets a badge only; it does not select a last move, disable actions, track duration or enforce restrictions. Reapplying an existing badge returns a failed unchanged-actor result. Imprison targets the source and needs no opponent. Swagger and Flatter commit their target stat increase and confusion together, succeeding if either can change; the existing presenter reveals both at impact. These fields remain entirely outside FX requests.

Support additions introduce optional validated booleans `infatuated`, `wishPending`, `perishSong`, `safeguard`, `magicCoat`, and `enduring`, plus nullable nonempty-string `heldItem`. All booleans default false. They are immutable core fields and host badges, never FX inputs. Wish is a cast marker; Perish Song marks living actors without changing weather or HP. No delayed-turn resolver is introduced. Trick exchanges item labels; the host berries are fixture data. Direct healing, weather healing and Belly Drum commit source HP at once and omit the drain-only `healing` event field. Existing presenter reconciliation handles their source-targeted results without a new cue or queue phase. Sleep-only Snore uses a host asleep fixture, and all new fixtures preserve fainted sources.

Facade and Smelling Salts require no new state fields or FX inputs. Core uses existing major conditions to double fixed preview damage for a qualified user (Facade) or paralyzed target (Smelling Salts). Smelling Salts clears paralysis only when HP remains after damage, in the same immutable snapshot; the ordinary impact reveals HP and condition together. The host's `createPreviewState(move, {sourceId, targetId, actors})` now accepts the explicit recipient for the paralysis sample, preserving other participants and fainted actors. Without an explicit target the fixture selects the first other actor; transaction callers should supply both stable participant IDs when reversing sides. The standalone FX playground needs no condition fixture and plays identical choreography.

Zap Cannon uses `conditionOnHit: 'paralysis'` on its immutable core move rule. After damage, core adds the condition only if the target survives and has no major condition; the damaging hit still succeeds when that secondary cannot apply. Existing status-only move rules retain their behavior. HP and status commit together and use the ordinary impact reveal, with no new actor fields, presenter phases or FX inputs. Hidden Power and Weather Ball remain explicitly labeled fixed samples; they introduce no IV, type or weather calculation contract.
