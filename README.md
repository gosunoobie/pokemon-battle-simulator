# Pokémon battle animation workspace

Vue 3 + PixiJS 8 + GSAP 3, with **257 independently authored moves**, an optional effects package, previews from either side, and an independent animation playground.

Explosion builds into a broad source-centered blast with pressure rings and smoke; Self-Destruct uses a shorter shudder and sharper burst. Both send a narrow pressure wave toward the opponent. The user’s HP becomes zero alongside target damage, and the host shows a fainted badge even with effects off. Replay resets both actors.

Confusion adds a compact psychic pulse; Hypnosis sends five sleep rings; Confuse Ray uses a wavering golden ray and spiraling glints. Hypnosis preserves an occupied major status, while Confuse Ray uses a separate confusion flag without HP damage. Confusion’s random secondary effect and sleep/confusion turns remain outside the preview.

Rock Blast fires three small rocks; Ancient Power lifts glowing stones before launching them; Rock Tomb drops four boulders around the opponent and closes inward. Rock Tomb previews damage and Speed −1 together, with effects optional. Rock Blast’s random hit count and Ancient Power’s random stat boost are not simulated.

Mega Punch uses a heavy fist strike; Meteor Mash adds a steel fist and starry trail; Dynamic Punch bursts into fragments and dizzy stars; Focus Punch holds a longer charge before striking. Dynamic Punch displays a separate confusion badge without replacing other status conditions. Meteor Mash’s random Attack boost and Focus Punch’s interruption are not simulated.

- Game: `/` — choose Your side or Opponent side, choose either Pokémon, then preview a move. Effects toggle, skip, replay, and reset remain available. The selected move description and Use button stay above the move grid.
- Playground: `/playground.html` — play any effect without importing battle logic; change actors, size, facing, stage proportions, and motion preference.

## Run

Use Node 24 and the included lockfile:

```bash
npm ci
npm run dev
npm test
npm run build
npm run preview
```

Vite builds both HTML entries into `dist`. The game can resolve and display moves when effects are disabled, missing, or broken. Battle results never wait for an animation to become authoritative.

## Source layout

| Path | Responsibility |
| --- | --- |
| `packages/battle-core` | Pure state and rules; no Vue, PixiJS, GSAP, DOM, or FX imports |
| `packages/battle-fx` | Vue-free PixiJS effects, seeded visual randomness, timelines, assets and cleanup |
| `apps/game/src/presentation` | Ordered presentation of committed transactions; fallback and cancellation |
| `apps/game/src/scene` | Host-owned actor artwork, semantic anchors, pose layers and camera |
| `apps/game/src/components` | Vue controls and displayed battle state |
| `apps/fx-playground` | Independent effect authoring page with no battle engine |
| `tests` | Rules, isolation, geometry, playback and failure integration tests |

The packages have their own manifests and can be packed independently with `npm pack --workspace @battle/battle-core` and `npm pack --workspace @battle/battle-fx`. They are local workspace packages, not published npm releases. FX peers are PixiJS and GSAP; battle-core has no dependencies.

Read [the project overview](docs/PROJECT_OVERVIEW.md), [migration contracts](docs/MIGRATION.md), [animation specification](docs/ANIMATION_SPEC.md), and [adding moves guide](docs/ADDING_MOVES.md). Future agents should start with [AGENTS.md](AGENTS.md).

This remains a fixed-result, guaranteed-hit showcase. It is not a complete Pokémon battle simulator: no turn scheduling, move legality, PP, accuracy rolls, type calculation, or secondary-effect rolls. Thunder Wave and Stun Spore preview paralysis, Poison Powder and Poison Gas preview poison, Sleep Powder previews sleep, and Toxic previews bad poisoning. Smokescreen lowers a core-owned accuracy stage and shows a badge; hits stay guaranteed. Immunities and ongoing status effects are not simulated. The core supports arbitrary named actors and HP; the game page intentionally uses the existing Charizard/Venusaur matchup and resets each replay.

Sprites remain in `public/assets`; effect assets and attribution notices travel with `battle-fx/assets`. Preserve Pokémon credits and the Bootstrap leaf / Lorc rock notices. Browser visual verification of this migration is pending because the preview browser was blocked by the environment.

Barrier, Protect, Light Screen and Reflect appear around the move user. The core previews Defense +2 or a protection flag; badges appear on the user's panel and clear on reset/replay. These moves cause no HP loss. Blocking, damage reduction, side-wide team handling and turn expiry remain outside the showcase. They work with effects disabled, and the FX playground needs no battle rules to select the correct visual subject.

Absorb, Mega Drain, Giga Drain and Leech Life restore half the HP removed, rounded and capped at the user's maximum HP. Their previews start the user at 65% HP so recovery is visible. Core commits both HP changes immediately; the presenter reveals damage at contact and healing as energy returns. Disabling or skipping effects preserves the same result.

Refresh, Heal Bell and Aromatherapy preview status cures with distinct rings, bell waves and drifting herbs. Rest restores full HP and leaves the user asleep. These results resolve in core with effects off too. Bell/Aromatherapy are user-only previews; party targeting and sleep turn progression are not simulated.

Meditate raises Attack, Calm Mind raises both special stats, Amnesia raises Special Defense, and Focus Energy stores a non-stacking critical-hit-ratio boost. Their badges reflect core state even with effects disabled; the showcase still uses fixed damage and no critical-hit rolls.

Bulk Up, Howl, Swords Dance and Dragon Dance add compact bracing, sound-wave, circling-blade and ribbon-dance effects. Their Attack, Defense and Speed badges follow committed state; Howl previews only the user, and turn order remains outside this fixed-damage demo.

Agility, Double Team, Minimize and Acid Armor add quick footwork, actor-derived afterimages, a visible shrinking dodge and a flowing liquid coat. Speed/Evasion/Defense badges reflect core results; accuracy rolls and Minimize-specific damage interactions remain outside this preview.

Rage, Thrash, Outrage and Struggle add a tense body charge, three uneven strikes, a dragon-energy rush and an awkward tackle with recoil. Struggle commits quarter-maximum-HP recoil in core; Rage’s later Attack boost and multi-turn lock/confusion remain outside the single-use preview.

Leer, Scary Face, Glare and Mean Look add sharp pressure ripples, a looming face, a paralyzing gaze and a watchful violet eye. Opponent Defense/Speed and trapping badges show core results; Mean Look is a trapping preview without switching rules.

Scratch, Metal Claw and Dragon Claw add a light claw rake, a polished steel sweep with sparks and charged energy talons. Each has separate artwork and timing, with optional claw anchors and a hand fallback. Metal Claw’s chance-based Attack boost is not simulated.

Tackle, Return, Take Down and Double-Edge add a compact body check, a warm bounding strike and two heavier charges with recoil. Return uses maximum friendship for its power label. Take Down/Double-Edge calculate recoil from actual damage in core; animation playback remains optional.

Slam, Stomp and Strength add a blunt swinging strike, a focused foot impact and a braced shove. Stomp limits its extra lift to available headroom; Strength keeps contact aligned through the push. Each keeps its own animation, with flinch and Minimize interactions outside the preview.

Vital Throw, Submission, Sky Uppercut and Seismic Toss add bounded flips, grapples, rising fist contact and a high downward throw. Submission includes actual-damage recoil; Seismic Toss uses the source level (default 50), resolved in core even with FX disabled.

See [Opponent previews](docs/OPPONENT_PREVIEW.md) for using all 257 moves from either side, adding artwork, supplying legal move IDs and the per-move verification coverage.


Fly, Bounce, Dig and Dive have separate **Round 1 · Prepare** and **Round 2 · Attack** controls in the battle demo and FX playground. Each clip can be replayed independently and restores the Pokémon afterward. Preparation leaves HP unchanged; the attack uses the normal fixed preview result. No turn engine or semi-invulnerability state is added.
