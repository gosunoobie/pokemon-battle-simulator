# Remaining SFX technical preparation

Measured all **530 audited recordings** and accounted for **354 move policies**, **339 animated phases**, and all event policies.

Preserved **11 existing approvals**; generated **502 technical drafts** in 8 importable batches. 27 candidates have no registered animation and remain report-only; 12 subjects have no source.

**No listening approval, native-browser alignment approval, or runtime mapping is added.** Each draft has false near/far checks, unmeasured native fields, and a null approval fingerprint. Whole original recordings remain unchanged.

## Measurements and proposals

- The pinned decoder rechecks every compressed hash and every reference PCM measurement against Stage A.
- Exact 10 ms RMS windows identify numeric energy maxima and positive energy changes, never semantic impacts or audible onsets.
- Defaults retain the whole recording at visual time zero. Only downward gain to the approved pilot maximum sample peak and whole-recording RMS is suggested, with an additional -3 dBFS hard peak ceiling. Quiet sounds are never boosted. This is not perceived loudness normalization or true-peak certification.
- 158 explicit comparison alternatives can delay a whole, unambiguous recording to align its strongest energy-window start with the declared visual result cue. A negative start is rejected instead of cutting the lead-in.
- 524 optional threshold-edge comparisons retain 20 ms before and 50 ms after samples exceeding -60 dBFS. Below-threshold samples can remain perceptually relevant; these are suggestions, not automatic edits or priming corrections.
- Part numbers, hit counts, preparation sounds, outcomes and event roles remain unassigned. Their filename labels do not establish chronology or gameplay semantics.
- RMS outliers and long tails are review flags only. The recordings are not reencoded, rate-shifted, normalized or shortened.

## Reproduction

Run `node tools/audio-import/analysis.mjs` to generate, or `node tools/audio-import/analysis.mjs --check` to recompute and verify without writing. Install the isolated pinned decoder first with the repository audio setup command. All output is developer authoring data.

Policy SHA-256: `3be2d2a85d405234e3959162403680e9a9c0bedf505b058c00c2da028699ae6a`

Algorithm SHA-256: `fdb63a0dbff3e857156f68018549c158a34ac709f329e04f44ded9a302b17bc1`

## Draft batches

| Batch | Records | First/last subject |
| --- | ---: | --- |
| [batch-001](../review/remaining/batch-001.json) | 64 | absorb – cosmicpower |
| [batch-002](../review/remaining/batch-002.json) | 64 | cottonspore – firepunch |
| [batch-003](../review/remaining/batch-003.json) | 64 | firespin – icebeam |
| [batch-004](../review/remaining/batch-004.json) | 64 | icepunch – moonlight |
| [batch-005](../review/remaining/batch-005.json) | 64 | morningsun – revenge |
| [batch-006](../review/remaining/batch-006.json) | 64 | reversal – softboiled |
| [batch-007](../review/remaining/batch-007.json) | 64 | solarbeam – tickle |
| [batch-008](../review/remaining/batch-008.json) | 54 | torment – battle.status.sleep |

## Complete candidate matrix

| Subject | Phase | Asset | Disposition | Review flags |
| --- | --- | --- | --- | --- |
| move:absorb | attack | source.absorb-part-1 | approved-existing | — |
| move:absorb | attack | source.absorb-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:absorb | attack | source.absorb | approved-existing | — |
| move:acid | attack | source.acid | report-only | listening-unreviewed; native-decoder-unmeasured; no-registered-visual |
| move:acidarmor | attack | source.acid-armor | draft | listening-unreviewed; native-decoder-unmeasured |
| move:aerialace | attack | source.aerial-ace | draft | listening-unreviewed; native-decoder-unmeasured |
| move:aeroblast | attack | source.aeroblast | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:agility | attack | source.agility | draft | listening-unreviewed; native-decoder-unmeasured |
| move:aircutter | attack | source.air-cutter | draft | listening-unreviewed; native-decoder-unmeasured |
| move:amnesia | attack | source.amnesia | draft | listening-unreviewed; native-decoder-unmeasured |
| move:ancientpower | attack | source.ancient-power | draft | listening-unreviewed; native-decoder-unmeasured |
| move:armthrust | attack | source.arm-thrust-1hit | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:hit-count |
| move:armthrust | attack | source.arm-thrust-2hits | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:hit-count |
| move:aromatherapy | attack | source.aromatherapy-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:aromatherapy | attack | source.aromatherapy-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part; whole-recording-tail-exceeds-animation |
| move:aromatherapy | attack | source.aromatherapy | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:assist | attack | source.assist | draft | listening-unreviewed; native-decoder-unmeasured |
| move:astonish | attack | source.astonish | draft | listening-unreviewed; native-decoder-unmeasured |
| move:attract | attack | source.attract-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:attract | attack | source.attract-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part; whole-recording-tail-exceeds-animation |
| move:attract | attack | source.attract | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:aurorabeam | attack | source.aurora-beam | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:barrage | attack | source.barrage-1hit | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:hit-count |
| move:barrage | attack | source.barrage-2hits | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:hit-count; whole-recording-tail-exceeds-animation |
| move:barrier | attack | source.barrier | draft | listening-unreviewed; native-decoder-unmeasured |
| move:batonpass | attack | source.baton-pass | draft | listening-unreviewed; native-decoder-unmeasured |
| move:beatup | attack | source.beat-up | draft | listening-unreviewed; native-decoder-unmeasured |
| move:bellydrum | attack | source.belly-drum | draft | listening-unreviewed; native-decoder-unmeasured |
| move:bide | attack | source.bide | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:bind | attack | source.bind-turn-damage | draft | listening-unreviewed; native-decoder-unmeasured; audio-only-variant-no-compatible-visual; variant-role-unassigned:turn-effect; outcome-visual-compatibility-unconfirmed |
| move:bind | attack | source.bind | draft | listening-unreviewed; native-decoder-unmeasured |
| move:bite | attack | source.bite | draft | listening-unreviewed; native-decoder-unmeasured |
| move:blastburn | attack | source.blast-burn | draft | listening-unreviewed; native-decoder-unmeasured |
| move:blazekick | attack | source.blaze-kick | draft | listening-unreviewed; native-decoder-unmeasured |
| move:blizzard | attack | source.blizzard-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:blizzard | attack | source.blizzard-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:blizzard | attack | source.blizzard | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:block | attack | source.block | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:bodyslam | attack | source.body-slam | draft | listening-unreviewed; native-decoder-unmeasured |
| move:boneclub | attack | source.bone-club | draft | listening-unreviewed; native-decoder-unmeasured |
| move:bonemerang | attack | source.bonemerang-1hit | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:hit-count |
| move:bonemerang | attack | source.bonemerang-2hits | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:hit-count; whole-recording-tail-exceeds-animation |
| move:bonerush | attack | source.bone-rush-1hit | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:hit-count |
| move:bonerush | attack | source.bone-rush-2hits | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:hit-count |
| move:bounce | attack | source.bounce | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:bounce | prepare | source.bounce | draft | listening-unreviewed; native-decoder-unmeasured; prepare-role-unassigned; whole-recording-tail-exceeds-animation |
| move:brickbreak | attack | source.brick-break | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:bubble | attack | source.bubble-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:bubble | attack | source.bubble-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part; whole-recording-tail-exceeds-animation |
| move:bubble | attack | source.bubble | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:bubblebeam | attack | source.bubble-beam-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:bubblebeam | attack | source.bubble-beam-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:bubblebeam | attack | source.bubble-beam | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:bulkup | attack | source.bulk-up | draft | listening-unreviewed; native-decoder-unmeasured |
| move:bulletseed | attack | source.bullet-seed-1hit | approved-existing | — |
| move:bulletseed | attack | source.bullet-seed-2hits | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:hit-count; whole-recording-tail-exceeds-animation |
| move:calmmind | attack | source.calm-mind | draft | listening-unreviewed; native-decoder-unmeasured |
| move:camouflage | attack | source.camouflage | report-only | listening-unreviewed; native-decoder-unmeasured; no-registered-visual |
| move:charge | attack | source.charge | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:charm | attack | source.charm | draft | listening-unreviewed; native-decoder-unmeasured |
| move:clamp | attack | source.clamp | draft | listening-unreviewed; native-decoder-unmeasured |
| move:cometpunch | attack | source.comet-punch-1hit | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:hit-count |
| move:cometpunch | attack | source.comet-punch-2hits | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:hit-count |
| move:confuseray | attack | source.confuse-ray-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:confuseray | attack | source.confuse-ray-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:confuseray | attack | source.confuse-ray | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:confusion | attack | source.confusion | draft | listening-unreviewed; native-decoder-unmeasured |
| move:constrict | attack | source.constrict | draft | listening-unreviewed; native-decoder-unmeasured |
| move:conversion | attack | source.conversion | report-only | listening-unreviewed; native-decoder-unmeasured; no-registered-visual |
| move:conversion2 | attack | source.conversion-2 | report-only | listening-unreviewed; native-decoder-unmeasured; no-registered-visual |
| move:cosmicpower | attack | source.cosmic-power | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:cottonspore | attack | source.cotton-spore | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:counter | attack | source.counter | draft | listening-unreviewed; native-decoder-unmeasured |
| move:covet | attack | source.covet-part-1 | report-only | listening-unreviewed; native-decoder-unmeasured; no-registered-visual; variant-role-unassigned:part |
| move:covet | attack | source.covet-part-2 | report-only | listening-unreviewed; native-decoder-unmeasured; no-registered-visual; variant-role-unassigned:part |
| move:covet | attack | source.covet | report-only | listening-unreviewed; native-decoder-unmeasured; no-registered-visual |
| move:crabhammer | attack | source.crabhammer | draft | listening-unreviewed; native-decoder-unmeasured |
| move:crosschop | attack | source.cross-chop | draft | listening-unreviewed; native-decoder-unmeasured |
| move:crunch | attack | source.crunch | draft | listening-unreviewed; native-decoder-unmeasured |
| move:crushclaw | attack | source.crush-claw | draft | listening-unreviewed; native-decoder-unmeasured |
| move:curse | attack | source.curse | draft | listening-unreviewed; native-decoder-unmeasured |
| move:cut | attack | source.cut | draft | listening-unreviewed; native-decoder-unmeasured |
| move:defensecurl | attack | source.defense-curl | draft | listening-unreviewed; native-decoder-unmeasured |
| move:destinybond | attack | source.destiny-bond-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:destinybond | attack | source.destiny-bond-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:destinybond | attack | source.destiny-bond | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:detect | attack | source.detect | draft | listening-unreviewed; native-decoder-unmeasured |
| move:dig | attack | source.dig-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part; whole-recording-tail-exceeds-animation |
| move:dig | attack | source.dig-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:dig | attack | source.dig | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:dig | prepare | source.dig-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part; prepare-role-unassigned; whole-recording-tail-exceeds-animation |
| move:dig | prepare | source.dig-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part; prepare-role-unassigned |
| move:dig | prepare | source.dig | draft | listening-unreviewed; native-decoder-unmeasured; prepare-role-unassigned; whole-recording-tail-exceeds-animation |
| move:disable | attack | source.disable | draft | listening-unreviewed; native-decoder-unmeasured |
| move:dive | attack | source.dive-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:dive | attack | source.dive-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:dive | attack | source.dive | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:dive | prepare | source.dive-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part; prepare-role-unassigned; whole-recording-tail-exceeds-animation |
| move:dive | prepare | source.dive-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part; prepare-role-unassigned |
| move:dive | prepare | source.dive | draft | listening-unreviewed; native-decoder-unmeasured; prepare-role-unassigned; whole-recording-tail-exceeds-animation |
| move:dizzypunch | attack | source.dizzy-punch | draft | listening-unreviewed; native-decoder-unmeasured |
| move:doomdesire | attack | source.doom-desire | draft | listening-unreviewed; native-decoder-unmeasured |
| move:doubleedge | attack | source.double-edge | draft | listening-unreviewed; native-decoder-unmeasured |
| move:doublekick | attack | source.double-kick-1hit | approved-existing | — |
| move:doublekick | attack | source.double-kick-2hits | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:hit-count |
| move:doubleslap | attack | source.double-slap-1hit | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:hit-count |
| move:doubleslap | attack | source.double-slap-2hits | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:hit-count |
| move:doubleteam | attack | source.double-team | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:dragonbreath | attack | source.dragon-breath | draft | listening-unreviewed; native-decoder-unmeasured |
| move:dragonclaw | attack | source.dragon-claw | draft | listening-unreviewed; native-decoder-unmeasured |
| move:dragondance | attack | source.dragon-dance | draft | listening-unreviewed; native-decoder-unmeasured |
| move:dragonrage | attack | source.dragon-rage-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:dragonrage | attack | source.dragon-rage-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:dragonrage | attack | source.dragon-rage | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:dreameater | attack | source.dream-eater-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:dreameater | attack | source.dream-eater-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:dreameater | attack | source.dream-eater | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:drillpeck | attack | source.drill-peck | draft | listening-unreviewed; native-decoder-unmeasured |
| move:dynamicpunch | attack | source.dynamic-punch | draft | listening-unreviewed; native-decoder-unmeasured |
| move:earthquake | attack | source.earthquake | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:eggbomb | attack | source.egg-bomb | draft | listening-unreviewed; native-decoder-unmeasured |
| move:ember | attack | source.ember | draft | listening-unreviewed; native-decoder-unmeasured |
| move:encore | attack | source.encore | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:endeavor | attack | source.endeavor | draft | listening-unreviewed; native-decoder-unmeasured |
| move:endure | attack | source.endure | draft | listening-unreviewed; native-decoder-unmeasured |
| move:eruption | attack | source.eruption-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:eruption | attack | source.eruption-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part; whole-recording-tail-exceeds-animation |
| move:eruption | attack | source.eruption | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:explosion | attack | source.explosion | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:extrasensory | attack | source.extrasensory | draft | listening-unreviewed; native-decoder-unmeasured |
| move:extremespeed | attack | source.extreme-speed | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:facade | attack | source.facade | draft | listening-unreviewed; native-decoder-unmeasured |
| move:fakeout | attack | source.fake-out | draft | listening-unreviewed; native-decoder-unmeasured |
| move:faketears | attack | source.fake-tears | draft | listening-unreviewed; native-decoder-unmeasured |
| move:falseswipe | attack | source.false-swipe | draft | listening-unreviewed; native-decoder-unmeasured |
| move:featherdance | attack | source.feather-dance | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:feintattack | attack | source.feint-attack | draft | listening-unreviewed; native-decoder-unmeasured |
| move:fireblast | attack | source.fire-blast | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:firepunch | attack | source.fire-punch | draft | listening-unreviewed; native-decoder-unmeasured |
| move:firespin | attack | source.fire-spin-turn-damage | draft | listening-unreviewed; native-decoder-unmeasured; audio-only-variant-no-compatible-visual; variant-role-unassigned:turn-effect; outcome-visual-compatibility-unconfirmed |
| move:firespin | attack | source.fire-spin | draft | listening-unreviewed; native-decoder-unmeasured |
| move:fissure | attack | source.fissure | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:flail | attack | source.flail | draft | listening-unreviewed; native-decoder-unmeasured |
| move:flamethrower | attack | source.flamethrower | approved-existing | — |
| move:flamewheel | attack | source.flame-wheel-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:flamewheel | attack | source.flame-wheel-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:flamewheel | attack | source.flame-wheel | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:flash | attack | source.flash | draft | listening-unreviewed; native-decoder-unmeasured |
| move:flatter | attack | source.flatter | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:fly | attack | source.fly-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:fly | attack | source.fly-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:fly | attack | source.fly | approved-existing | — |
| move:fly | prepare | source.fly-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part; prepare-role-unassigned |
| move:fly | prepare | source.fly-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part; prepare-role-unassigned |
| move:fly | prepare | source.fly | draft | listening-unreviewed; native-decoder-unmeasured; prepare-role-unassigned; whole-recording-tail-exceeds-animation |
| move:focusenergy | attack | source.focus-energy | draft | listening-unreviewed; native-decoder-unmeasured |
| move:focuspunch | attack | source.focus-punch | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:followme | attack | source.follow-me | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:foresight | attack | source.foresight | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:frenzyplant | attack | source.frenzy-plant | draft | listening-unreviewed; native-decoder-unmeasured |
| move:frustration | attack | source.frustration | draft | listening-unreviewed; native-decoder-unmeasured |
| move:furyattack | attack | source.fury-attack-1hit | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:hit-count |
| move:furyattack | attack | source.fury-attack-2hits | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:hit-count |
| move:furycutter | attack | source.fury-cutter | draft | listening-unreviewed; native-decoder-unmeasured |
| move:furyswipes | attack | source.fury-swipes-1hit | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:hit-count |
| move:furyswipes | attack | source.fury-swipes-2hits | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:hit-count |
| move:futuresight | attack | source.future-sight-turn-damage | draft | listening-unreviewed; native-decoder-unmeasured; audio-only-variant-no-compatible-visual; variant-role-unassigned:turn-effect; outcome-visual-compatibility-unconfirmed |
| move:futuresight | attack | source.future-sight | draft | listening-unreviewed; native-decoder-unmeasured |
| move:gigadrain | attack | source.giga-drain-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:gigadrain | attack | source.giga-drain-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:gigadrain | attack | source.giga-drain | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:glare | attack | source.glare-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:glare | attack | source.glare-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:glare | attack | source.glare | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:grasswhistle | attack | source.grass-whistle | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:growl | attack | source.growl | draft | listening-unreviewed; native-decoder-unmeasured |
| move:growth | attack | source.growth | report-only | listening-unreviewed; native-decoder-unmeasured; no-registered-visual |
| move:grudge | attack | source.grudge-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:grudge | attack | source.grudge-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:grudge | attack | source.grudge | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:guillotine | attack | source.guillotine | draft | listening-unreviewed; native-decoder-unmeasured |
| move:gust | attack | source.gust | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:hail | attack | source.hail-turn-damage | draft | listening-unreviewed; native-decoder-unmeasured; audio-only-variant-no-compatible-visual; variant-role-unassigned:turn-effect; outcome-visual-compatibility-unconfirmed |
| move:hail | attack | source.hail | draft | listening-unreviewed; native-decoder-unmeasured |
| move:harden | attack | source.harden-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:harden | attack | source.harden-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:harden | attack | source.harden | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:haze | attack | source.haze | report-only | listening-unreviewed; native-decoder-unmeasured; no-registered-visual |
| move:headbutt | attack | source.headbutt | draft | listening-unreviewed; native-decoder-unmeasured |
| move:healbell | attack | source.heal-bell-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:healbell | attack | source.heal-bell-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:healbell | attack | source.heal-bell | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:heatwave | attack | source.heat-wave | report-only | listening-unreviewed; native-decoder-unmeasured; no-registered-visual |
| move:helpinghand | attack | source.helping-hand | draft | listening-unreviewed; native-decoder-unmeasured |
| move:hiddenpower | attack | source.hidden-power | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:highjumpkick | attack | source.high-jump-kick | draft | listening-unreviewed; native-decoder-unmeasured |
| move:hornattack | attack | source.horn-attack | draft | listening-unreviewed; native-decoder-unmeasured |
| move:horndrill | attack | source.horn-drill | draft | listening-unreviewed; native-decoder-unmeasured |
| move:howl | attack | source.howl | draft | listening-unreviewed; native-decoder-unmeasured |
| move:hydrocannon | attack | source.hydro-cannon | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:hydropump | attack | source.hydro-pump | draft | listening-unreviewed; native-decoder-unmeasured |
| move:hyperbeam | attack | source.hyper-beam | approved-existing | — |
| move:hyperfang | attack | source.hyper-fang | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:hypervoice | attack | source.hyper-voice | draft | listening-unreviewed; native-decoder-unmeasured |
| move:hypnosis | attack | source.hypnosis | draft | listening-unreviewed; native-decoder-unmeasured |
| move:iceball | attack | source.ice-ball | draft | listening-unreviewed; native-decoder-unmeasured |
| move:icebeam | attack | source.ice-beam-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:icebeam | attack | source.ice-beam-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:icebeam | attack | source.ice-beam | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:icepunch | attack | source.ice-punch | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:iciclespear | attack | source.icicle-spear-1hit | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:hit-count |
| move:iciclespear | attack | source.icicle-spear-2hits | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:hit-count; whole-recording-tail-exceeds-animation |
| move:icywind | attack | source.icy-wind-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:icywind | attack | source.icy-wind-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:icywind | attack | source.icy-wind | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:imprison | attack | source.imprison | draft | listening-unreviewed; native-decoder-unmeasured |
| move:ingrain | attack | source.ingrain-turn-heal | draft | listening-unreviewed; native-decoder-unmeasured; audio-only-variant-no-compatible-visual; variant-role-unassigned:turn-effect; outcome-visual-compatibility-unconfirmed; whole-recording-tail-exceeds-animation |
| move:ingrain | attack | source.ingrain | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:irondefense | attack | source.iron-defense | draft | listening-unreviewed; native-decoder-unmeasured |
| move:irontail | attack | source.iron-tail-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:irontail | attack | source.iron-tail-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:irontail | attack | source.iron-tail | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:jumpkick | attack | source.jump-kick | draft | listening-unreviewed; native-decoder-unmeasured |
| move:karatechop | attack | source.karate-chop | draft | listening-unreviewed; native-decoder-unmeasured |
| move:kinesis | attack | source.kinesis | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:knockoff | attack | source.knock-off | draft | listening-unreviewed; native-decoder-unmeasured |
| move:leafblade | attack | source.leaf-blade | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:leechlife | attack | source.leech-life-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:leechlife | attack | source.leech-life-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:leechlife | attack | source.leech-life | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:leechseed | attack | source.leech-seed-turn-damage | draft | listening-unreviewed; native-decoder-unmeasured; audio-only-variant-no-compatible-visual; variant-role-unassigned:turn-effect; outcome-visual-compatibility-unconfirmed; whole-recording-tail-exceeds-animation |
| move:leechseed | attack | source.leech-seed | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:leer | attack | source.leer | draft | listening-unreviewed; native-decoder-unmeasured |
| move:lick | attack | source.lick | draft | listening-unreviewed; native-decoder-unmeasured |
| move:lightscreen | attack | source.light-screen | draft | listening-unreviewed; native-decoder-unmeasured |
| move:lockon | attack | source.lock-on | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:lovelykiss | attack | source.lovely-kiss | draft | listening-unreviewed; native-decoder-unmeasured |
| move:lowkick | attack | source.low-kick | draft | listening-unreviewed; native-decoder-unmeasured |
| move:lusterpurge | attack | source.luster-purge | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:machpunch | attack | source.mach-punch | draft | listening-unreviewed; native-decoder-unmeasured |
| move:magicalleaf | attack | source.magical-leaf-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:magicalleaf | attack | source.magical-leaf-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part; whole-recording-tail-exceeds-animation |
| move:magicalleaf | attack | source.magical-leaf | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:magiccoat | attack | source.magic-coat | draft | listening-unreviewed; native-decoder-unmeasured |
| move:magnitude | attack | source.magnitude | draft | listening-unreviewed; native-decoder-unmeasured |
| move:meanlook | attack | source.mean-look | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:meditate | attack | source.meditate | draft | listening-unreviewed; native-decoder-unmeasured |
| move:megadrain | attack | source.mega-drain-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:megadrain | attack | source.mega-drain-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:megadrain | attack | source.mega-drain | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:megahorn | attack | source.megahorn | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:megakick | attack | source.mega-kick | draft | listening-unreviewed; native-decoder-unmeasured |
| move:megapunch | attack | source.mega-punch | draft | listening-unreviewed; native-decoder-unmeasured |
| move:memento | attack | source.memento | draft | listening-unreviewed; native-decoder-unmeasured |
| move:metalclaw | attack | source.metal-claw-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:metalclaw | attack | source.metal-claw-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:metalclaw | attack | source.metal-claw | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:metalsound | attack | source.metal-sound | draft | listening-unreviewed; native-decoder-unmeasured |
| move:meteormash | attack | source.meteor-mash-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:meteormash | attack | source.meteor-mash-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:meteormash | attack | source.meteor-mash | draft | listening-unreviewed; native-decoder-unmeasured |
| move:metronome | attack | source.metronome | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:milkdrink | attack | source.milk-drink-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:milkdrink | attack | source.milk-drink-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:milkdrink | attack | source.milk-drink | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:mimic | attack | source.mimic | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:mindreader | attack | source.mind-reader | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:minimize | attack | source.minimize | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:mirrorcoat | attack | source.mirror-coat | draft | listening-unreviewed; native-decoder-unmeasured |
| move:mirrormove | attack | — | missing-source | no-source-candidate |
| move:mist | attack | source.mist | report-only | listening-unreviewed; native-decoder-unmeasured; no-registered-visual |
| move:mistball | attack | source.mist-ball | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:moonlight | attack | source.moonlight-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part; whole-recording-tail-exceeds-animation |
| move:moonlight | attack | source.moonlight-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:moonlight | attack | source.moonlight | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:morningsun | attack | source.morning-sun-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part; whole-recording-tail-exceeds-animation |
| move:morningsun | attack | source.morning-sun-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:morningsun | attack | source.morning-sun | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:muddywater | attack | source.muddy-water | draft | listening-unreviewed; native-decoder-unmeasured |
| move:mudshot | attack | source.mud-shot | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:mudslap | attack | source.mud-slap | draft | listening-unreviewed; native-decoder-unmeasured |
| move:mudsport | attack | source.mud-sport | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:naturepower | attack | — | missing-source | no-source-candidate |
| move:needlearm | attack | source.needle-arm | draft | listening-unreviewed; native-decoder-unmeasured |
| move:nightmare | attack | source.nightmare | draft | listening-unreviewed; native-decoder-unmeasured |
| move:nightshade | attack | source.night-shade | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:octazooka | attack | source.octazooka | draft | listening-unreviewed; native-decoder-unmeasured |
| move:odorsleuth | attack | source.odor-sleuth | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:outrage | attack | source.outrage | draft | listening-unreviewed; native-decoder-unmeasured |
| move:overheat | attack | source.overheat | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:painsplit | attack | source.pain-split | draft | listening-unreviewed; native-decoder-unmeasured |
| move:payday | attack | source.pay-day | draft | listening-unreviewed; native-decoder-unmeasured |
| move:peck | attack | source.peck | draft | listening-unreviewed; native-decoder-unmeasured |
| move:perishsong | attack | source.perish-song | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:petaldance | attack | source.petal-dance-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part; whole-recording-tail-exceeds-animation |
| move:petaldance | attack | source.petal-dance-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:petaldance | attack | source.petal-dance | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:pinmissile | attack | source.pin-missile-1hit | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:hit-count |
| move:pinmissile | attack | source.pin-missile-2hits | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:hit-count; whole-recording-tail-exceeds-animation |
| move:poisonfang | attack | source.poison-fang | draft | listening-unreviewed; native-decoder-unmeasured |
| move:poisongas | attack | source.poison-gas-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part; whole-recording-tail-exceeds-animation |
| move:poisongas | attack | source.poison-gas-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:poisongas | attack | source.poison-gas | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:poisonpowder | attack | source.poison-powder-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:poisonpowder | attack | source.poison-powder-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:poisonpowder | attack | source.poison-powder | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:poisonsting | attack | source.poison-sting | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:poisontail | attack | source.poison-tail | draft | listening-unreviewed; native-decoder-unmeasured |
| move:pound | attack | source.pound | draft | listening-unreviewed; native-decoder-unmeasured |
| move:powdersnow | attack | source.powder-snow-part-1 | report-only | listening-unreviewed; native-decoder-unmeasured; no-registered-visual; variant-role-unassigned:part |
| move:powdersnow | attack | source.powder-snow-part-2 | report-only | listening-unreviewed; native-decoder-unmeasured; no-registered-visual; variant-role-unassigned:part |
| move:powdersnow | attack | source.powder-snow | report-only | listening-unreviewed; native-decoder-unmeasured; no-registered-visual |
| move:present | attack | source.present-damage | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:outcome; outcome-visual-compatibility-unconfirmed; whole-recording-tail-exceeds-animation |
| move:present | attack | source.present-heal | draft | listening-unreviewed; native-decoder-unmeasured; audio-only-variant-no-compatible-visual; variant-role-unassigned:outcome; outcome-visual-compatibility-unconfirmed; source-sample-peak-exceeds-full-scale; whole-recording-tail-exceeds-animation |
| move:present | attack | source.present-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:present | attack | source.present-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:protect | attack | source.protect | approved-existing | — |
| move:psybeam | attack | source.psybeam | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:psychic | attack | source.psychic | draft | listening-unreviewed; native-decoder-unmeasured |
| move:psychoboost | attack | source.psycho-boost | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:psychup | attack | source.psych-up-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:psychup | attack | source.psych-up-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:psychup | attack | source.psych-up | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:psywave | attack | source.psywave | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:pursuit | attack | source.pursuit | report-only | listening-unreviewed; native-decoder-unmeasured; no-registered-visual |
| move:quickattack | attack | source.quick-attack | draft | listening-unreviewed; native-decoder-unmeasured |
| move:rage | attack | source.rage | draft | listening-unreviewed; native-decoder-unmeasured |
| move:raindance | attack | source.rain-dance | approved-existing | — |
| move:rapidspin | attack | source.rapid-spin | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:razorleaf | attack | source.razor-leaf-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:razorleaf | attack | source.razor-leaf-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:razorleaf | attack | source.razor-leaf | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:razorwind | attack | source.razor-wind | draft | listening-unreviewed; native-decoder-unmeasured |
| move:recover | attack | source.recover-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:recover | attack | source.recover-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:recover | attack | source.recover | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:recycle | attack | source.recycle-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:recycle | attack | source.recycle-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:recycle | attack | source.recycle | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:reflect | attack | source.reflect | draft | listening-unreviewed; native-decoder-unmeasured |
| move:refresh | attack | source.refresh | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:rest | attack | source.rest | draft | listening-unreviewed; native-decoder-unmeasured |
| move:return | attack | source.return-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:return | attack | source.return-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:return | attack | source.return | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:revenge | attack | source.revenge | draft | listening-unreviewed; native-decoder-unmeasured |
| move:reversal | attack | source.reversal | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:roar | attack | source.roar | draft | listening-unreviewed; native-decoder-unmeasured |
| move:rockblast | attack | source.rock-blast-1hit | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:hit-count |
| move:rockblast | attack | source.rock-blast-2hits | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:hit-count; whole-recording-tail-exceeds-animation |
| move:rockslide | attack | source.rock-slide | draft | listening-unreviewed; native-decoder-unmeasured |
| move:rocksmash | attack | source.rock-smash | draft | listening-unreviewed; native-decoder-unmeasured |
| move:rockthrow | attack | source.rock-throw | draft | listening-unreviewed; native-decoder-unmeasured |
| move:rocktomb | attack | source.rock-tomb | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:roleplay | attack | source.role-play | draft | listening-unreviewed; native-decoder-unmeasured |
| move:rollingkick | attack | source.rolling-kick | draft | listening-unreviewed; native-decoder-unmeasured |
| move:rollout | attack | source.rollout-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:rollout | attack | source.rollout-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:rollout | attack | source.rollout | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:sacredfire | attack | source.sacred-fire-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:sacredfire | attack | source.sacred-fire-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part; whole-recording-tail-exceeds-animation |
| move:sacredfire | attack | source.sacred-fire | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:safeguard | attack | source.safeguard | draft | listening-unreviewed; native-decoder-unmeasured |
| move:sandattack | attack | source.sand-attack | draft | listening-unreviewed; native-decoder-unmeasured |
| move:sandstorm | attack | source.sandstorm | draft | listening-unreviewed; native-decoder-unmeasured |
| move:sandtomb | attack | source.sand-tomb-turn-damage | draft | listening-unreviewed; native-decoder-unmeasured; audio-only-variant-no-compatible-visual; variant-role-unassigned:turn-effect; outcome-visual-compatibility-unconfirmed |
| move:sandtomb | attack | source.sand-tomb | draft | listening-unreviewed; native-decoder-unmeasured |
| move:scaryface | attack | source.scary-face | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:scratch | attack | source.scratch | draft | listening-unreviewed; native-decoder-unmeasured |
| move:screech | attack | source.screech | draft | listening-unreviewed; native-decoder-unmeasured |
| move:secretpower | attack | source.secret-power | draft | listening-unreviewed; native-decoder-unmeasured |
| move:seismictoss | attack | source.seismic-toss-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:seismictoss | attack | source.seismic-toss-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:seismictoss | attack | source.seismic-toss | draft | listening-unreviewed; native-decoder-unmeasured |
| move:selfdestruct | attack | source.self-destruct | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:shadowball | attack | source.shadow-ball | draft | listening-unreviewed; native-decoder-unmeasured |
| move:shadowpunch | attack | source.shadow-punch | draft | listening-unreviewed; native-decoder-unmeasured |
| move:sharpen | attack | source.sharpen | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:sheercold | attack | source.sheer-cold | draft | listening-unreviewed; native-decoder-unmeasured |
| move:shockwave | attack | source.shock-wave | report-only | listening-unreviewed; native-decoder-unmeasured; no-registered-visual |
| move:signalbeam | attack | source.signal-beam | draft | listening-unreviewed; native-decoder-unmeasured |
| move:silverwind | attack | source.silver-wind | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:sing | attack | source.sing | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:sketch | attack | source.sketch | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:skillswap | attack | source.skill-swap | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:skullbash | attack | source.skull-bash-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:skullbash | attack | source.skull-bash-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:skullbash | attack | source.skull-bash | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:skyattack | attack | source.sky-attack-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:skyattack | attack | source.sky-attack-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:skyattack | attack | source.sky-attack | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:skyuppercut | attack | source.sky-uppercut | draft | listening-unreviewed; native-decoder-unmeasured |
| move:slackoff | attack | source.slack-off | draft | listening-unreviewed; native-decoder-unmeasured |
| move:slam | attack | source.slam | draft | listening-unreviewed; native-decoder-unmeasured |
| move:slash | attack | source.slash | draft | listening-unreviewed; native-decoder-unmeasured |
| move:sleeppowder | attack | source.sleep-powder-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:sleeppowder | attack | source.sleep-powder-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:sleeppowder | attack | source.sleep-powder | draft | listening-unreviewed; native-decoder-unmeasured |
| move:sleeptalk | attack | source.sleep-talk | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:sludge | attack | source.sludge | report-only | listening-unreviewed; native-decoder-unmeasured; no-registered-visual |
| move:sludgebomb | attack | source.sludge-bomb-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:sludgebomb | attack | source.sludge-bomb-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:sludgebomb | attack | source.sludge-bomb | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:smellingsalts | attack | source.smelling-salts | draft | listening-unreviewed; native-decoder-unmeasured |
| move:smog | attack | source.smog | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:smokescreen | attack | source.smokescreen-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:smokescreen | attack | source.smokescreen-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:smokescreen | attack | source.smokescreen | draft | listening-unreviewed; native-decoder-unmeasured |
| move:snatch | attack | source.snatch | report-only | listening-unreviewed; native-decoder-unmeasured; no-registered-visual |
| move:snore | attack | source.snore | draft | listening-unreviewed; native-decoder-unmeasured |
| move:softboiled | attack | source.soft-boiled-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:softboiled | attack | source.soft-boiled-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:softboiled | attack | source.soft-boiled | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:solarbeam | attack | source.solar-beam-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:solarbeam | attack | source.solar-beam-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part; whole-recording-tail-exceeds-animation |
| move:solarbeam | attack | source.solar-beam | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:sonicboom | attack | source.sonic-boom | draft | listening-unreviewed; native-decoder-unmeasured |
| move:spark | attack | source.spark | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:spiderweb | attack | source.spider-web | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:spikecannon | attack | source.spike-cannon-1hit | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:hit-count |
| move:spikecannon | attack | source.spike-cannon-2hits | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:hit-count; whole-recording-tail-exceeds-animation |
| move:spikes | attack | source.spikes | draft | listening-unreviewed; native-decoder-unmeasured |
| move:spite | attack | source.spite | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:spitup | attack | source.spit-up | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:splash | attack | source.splash | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:spore | attack | source.spore-part-1 | report-only | listening-unreviewed; native-decoder-unmeasured; no-registered-visual; variant-role-unassigned:part |
| move:spore | attack | source.spore-part-2 | report-only | listening-unreviewed; native-decoder-unmeasured; no-registered-visual; variant-role-unassigned:part |
| move:spore | attack | source.spore | report-only | listening-unreviewed; native-decoder-unmeasured; no-registered-visual |
| move:steelwing | attack | source.steel-wing | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:stockpile | attack | source.stockpile | report-only | listening-unreviewed; native-decoder-unmeasured; no-registered-visual |
| move:stomp | attack | source.stomp | draft | listening-unreviewed; native-decoder-unmeasured |
| move:strength | attack | source.strength | draft | listening-unreviewed; native-decoder-unmeasured |
| move:stringshot | attack | source.string-shot | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:struggle | attack | source.struggle | draft | listening-unreviewed; native-decoder-unmeasured |
| move:stunspore | attack | source.stun-spore-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:stunspore | attack | source.stun-spore-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:stunspore | attack | source.stun-spore | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:submission | attack | source.submission | draft | listening-unreviewed; native-decoder-unmeasured |
| move:substitute | attack | source.substitute | draft | listening-unreviewed; native-decoder-unmeasured |
| move:sunnyday | attack | source.sunny-day | draft | listening-unreviewed; native-decoder-unmeasured |
| move:superfang | attack | source.super-fang-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:superfang | attack | source.super-fang-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:superfang | attack | source.super-fang | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:superpower | attack | source.superpower | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:supersonic | attack | source.supersonic-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:supersonic | attack | source.supersonic-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:supersonic | attack | source.supersonic | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:surf | attack | source.surf | draft | listening-unreviewed; native-decoder-unmeasured |
| move:swagger | attack | source.swagger | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:swallow | attack | source.swallow | report-only | listening-unreviewed; native-decoder-unmeasured; no-registered-visual |
| move:sweetkiss | attack | source.sweet-kiss-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:sweetkiss | attack | source.sweet-kiss-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:sweetkiss | attack | source.sweet-kiss | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:sweetscent | attack | source.sweet-scent | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:swift | attack | source.swift | draft | listening-unreviewed; native-decoder-unmeasured |
| move:swordsdance | attack | source.swords-dance | draft | listening-unreviewed; native-decoder-unmeasured |
| move:synthesis | attack | source.synthesis-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:synthesis | attack | source.synthesis-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:synthesis | attack | source.synthesis | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:tackle | attack | source.tackle | approved-existing | — |
| move:tailglow | attack | source.tail-glow | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:tailwhip | attack | source.tail-whip | draft | listening-unreviewed; native-decoder-unmeasured |
| move:takedown | attack | source.take-down | draft | listening-unreviewed; native-decoder-unmeasured |
| move:taunt | attack | source.taunt | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:teeterdance | attack | source.teeter-dance | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:teleport | attack | source.teleport | draft | listening-unreviewed; native-decoder-unmeasured |
| move:thief | attack | source.thief | report-only | listening-unreviewed; native-decoder-unmeasured; no-registered-visual |
| move:thrash | attack | source.thrash | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:thunder | attack | source.thunder-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:thunder | attack | source.thunder-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:thunder | attack | source.thunder | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:thunderbolt | attack | source.thunderbolt-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:thunderbolt | attack | source.thunderbolt-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:thunderbolt | attack | source.thunderbolt | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:thunderpunch | attack | source.thunder-punch | draft | listening-unreviewed; native-decoder-unmeasured |
| move:thundershock | attack | source.thunder-shock-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:thundershock | attack | source.thunder-shock-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:thundershock | attack | source.thunder-shock | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:thunderwave | attack | source.thunder-wave-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:thunderwave | attack | source.thunder-wave-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:thunderwave | attack | source.thunder-wave | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:tickle | attack | source.tickle-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:tickle | attack | source.tickle-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:tickle | attack | source.tickle | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:torment | attack | source.torment | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:toxic | attack | source.toxic | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:transform | attack | source.transform | draft | listening-unreviewed; native-decoder-unmeasured |
| move:triattack | attack | source.tri-attack | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:trick | attack | source.trick | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:triplekick | attack | source.triple-kick-1hit | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:hit-count |
| move:triplekick | attack | source.triple-kick-2hits | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:hit-count |
| move:twineedle | attack | source.twineedle-1hit | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:hit-count |
| move:twineedle | attack | source.twineedle-2hits | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:hit-count; whole-recording-tail-exceeds-animation |
| move:twister | attack | source.twister | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:uproar | attack | source.uproar | draft | listening-unreviewed; native-decoder-unmeasured |
| move:vinewhip | attack | source.vine-whip | draft | listening-unreviewed; native-decoder-unmeasured |
| move:visegrip | attack | source.vice-grip | draft | listening-unreviewed; native-decoder-unmeasured |
| move:vitalthrow | attack | source.vital-throw | draft | listening-unreviewed; native-decoder-unmeasured |
| move:volttackle | attack | source.volt-tackle-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part; whole-recording-tail-exceeds-animation |
| move:volttackle | attack | source.volt-tackle-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:volttackle | attack | source.volt-tackle | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:waterfall | attack | source.waterfall-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:waterfall | attack | source.waterfall-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:waterfall | attack | source.waterfall | draft | listening-unreviewed; native-decoder-unmeasured |
| move:watergun | attack | source.water-gun | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:waterpulse | attack | source.water-pulse | draft | listening-unreviewed; native-decoder-unmeasured |
| move:watersport | attack | source.water-sport | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:waterspout | attack | source.water-spout-part-1 | report-only | listening-unreviewed; native-decoder-unmeasured; no-registered-visual; variant-role-unassigned:part |
| move:waterspout | attack | source.water-spout-part-2 | report-only | listening-unreviewed; native-decoder-unmeasured; no-registered-visual; variant-role-unassigned:part |
| move:waterspout | attack | source.water-spout | report-only | listening-unreviewed; native-decoder-unmeasured; no-registered-visual |
| move:weatherball | attack | source.weather-ball | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:whirlpool | attack | source.whirlpool-turn-damage | draft | listening-unreviewed; native-decoder-unmeasured; audio-only-variant-no-compatible-visual; variant-role-unassigned:turn-effect; outcome-visual-compatibility-unconfirmed |
| move:whirlpool | attack | source.whirlpool | draft | listening-unreviewed; native-decoder-unmeasured |
| move:whirlwind | attack | source.whirlwind | draft | listening-unreviewed; native-decoder-unmeasured |
| move:willowisp | attack | source.will-o-wisp | approved-existing | — |
| move:wingattack | attack | source.wing-attack | draft | listening-unreviewed; native-decoder-unmeasured |
| move:wish | attack | source.wish-part-1 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:wish | attack | source.wish-part-2 | draft | listening-unreviewed; native-decoder-unmeasured; variant-role-unassigned:part |
| move:wish | attack | source.wish | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:withdraw | attack | source.withdraw | draft | listening-unreviewed; native-decoder-unmeasured |
| move:wrap | attack | source.wrap-turn-damage | draft | listening-unreviewed; native-decoder-unmeasured; audio-only-variant-no-compatible-visual; variant-role-unassigned:turn-effect; outcome-visual-compatibility-unconfirmed |
| move:wrap | attack | source.wrap | draft | listening-unreviewed; native-decoder-unmeasured |
| move:yawn | attack | source.yawn | draft | listening-unreviewed; native-decoder-unmeasured; whole-recording-tail-exceeds-animation |
| move:zapcannon | attack | source.zap-cannon | draft | listening-unreviewed; native-decoder-unmeasured |
| event:battle.failure | attack | — | missing-source | no-source-candidate |
| event:battle.faint | attack | source.in-battle-faint-no-health | draft | listening-unreviewed; native-decoder-unmeasured; event-role-unassigned; variant-role-unassigned:generic |
| event:battle.heal | attack | source.in-battle-heal-hp-restore | draft | listening-unreviewed; native-decoder-unmeasured; event-role-unassigned; variant-role-unassigned:generic |
| event:battle.hit.normal | attack | source.hit-normal-damage | draft | listening-unreviewed; native-decoder-unmeasured; event-role-unassigned; variant-role-unassigned:generic |
| event:battle.hit.resisted | attack | source.hit-weak-not-very-effective | draft | listening-unreviewed; native-decoder-unmeasured; event-role-unassigned; variant-role-unassigned:generic |
| event:battle.hit.super-effective | attack | source.hit-super-effective | draft | listening-unreviewed; native-decoder-unmeasured; event-role-unassigned; variant-role-unassigned:generic |
| event:battle.immune | attack | — | missing-source | no-source-candidate |
| event:battle.intro | attack | — | missing-source | no-source-candidate |
| event:battle.item.activate | attack | source.in-battle-held-item-activate | draft | listening-unreviewed; native-decoder-unmeasured; event-role-unassigned; variant-role-unassigned:generic |
| event:battle.low-health.loop | attack | source.in-battle-health-low-loop | draft | listening-unreviewed; native-decoder-unmeasured; event-role-unassigned; variant-role-unassigned:generic |
| event:battle.low-health.notice | attack | source.in-battle-health-low | draft | listening-unreviewed; native-decoder-unmeasured; event-role-unassigned; variant-role-unassigned:generic |
| event:battle.miss | attack | — | missing-source | no-source-candidate |
| event:battle.recall.flee | attack | source.in-battle-recall-switch-flee-run | draft | listening-unreviewed; native-decoder-unmeasured; event-role-unassigned; variant-role-unassigned:generic |
| event:battle.recall.pokeball | attack | source.in-battle-recall-switch-pokeball | draft | listening-unreviewed; native-decoder-unmeasured; event-role-unassigned; variant-role-unassigned:generic |
| event:battle.release.pokeball | attack | — | missing-source | no-source-candidate |
| event:battle.result.defeat | attack | — | missing-source | no-source-candidate |
| event:battle.result.victory | attack | — | missing-source | no-source-candidate |
| event:battle.stat.fall | attack | source.stat-fall-down | draft | listening-unreviewed; native-decoder-unmeasured; event-role-unassigned; variant-role-unassigned:generic |
| event:battle.stat.rise | attack | source.stat-rise-up | draft | listening-unreviewed; native-decoder-unmeasured; event-role-unassigned; variant-role-unassigned:generic |
| event:battle.status.burn | attack | source.status-burned | draft | listening-unreviewed; native-decoder-unmeasured; event-role-unassigned; variant-role-unassigned:generic |
| event:battle.status.confusion | attack | source.status-confused | draft | listening-unreviewed; native-decoder-unmeasured; event-role-unassigned; variant-role-unassigned:generic |
| event:battle.status.freeze | attack | source.status-frozen | draft | listening-unreviewed; native-decoder-unmeasured; event-role-unassigned; variant-role-unassigned:generic |
| event:battle.status.paralysis | attack | source.status-paralyzed | draft | listening-unreviewed; native-decoder-unmeasured; event-role-unassigned; variant-role-unassigned:generic |
| event:battle.status.poison | attack | source.status-poisoned | draft | listening-unreviewed; native-decoder-unmeasured; event-role-unassigned; variant-role-unassigned:generic |
| event:battle.status.sleep | attack | source.status-sleep | draft | listening-unreviewed; native-decoder-unmeasured; event-role-unassigned; variant-role-unassigned:generic |
| event:battle.ui.cancel | attack | — | missing-source | no-source-candidate |
| event:battle.ui.confirm | attack | — | missing-source | no-source-candidate |
| event:battle.weather.ambience | attack | — | missing-source | no-source-candidate |

