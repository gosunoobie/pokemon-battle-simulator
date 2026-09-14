# @battle/pokemon-sprites

Front/back static artwork for all **386 Gen 1–3 species and 33 explicit forms**.
The package contains 838 unchanged PNGs (600,849 bytes total), measured alpha
bounds, bundler-compatible asset URLs and source provenance. It has no runtime
dependencies and imports no battle engine, data simulator, Vue or FX code.

```js
import { SPRITE_VIEWS, SPRITE_URLS } from '@battle/pokemon-sprites'

const back = SPRITE_VIEWS.pikachu.back
const url = SPRITE_URLS[back.file]
// back.bounds is the actual visible PNG rectangle; back.nativeFacing is 1.
```

`SPRITE_VIEWS` is deeply frozen. `SPRITE_URLS` is a frozen map of filenames to
static `new URL(..., import.meta.url).href` values. Bundlers can emit these as
separate assets; Node resolves them to package-local file URLs. The host should
load only the selected images, rather than inline all sprites into JavaScript.
This workspace's Vite config disables inlining for this package's PNGs.

Provenance is available separately as `@battle/pokemon-sprites/manifest.json`.
It is not loaded by the regular runtime entry. The manifest records each file's
source path, Git blob hash, SHA-256, dimensions and measured visible bounds.

The source is the pinned PokeAPI default **Gen 5 style** static collection,
matching the existing preview art. The game's reference data uses authentic
Gen 3 mechanics metadata; artwork style is independent of that ruleset.

All Castform, Deoxys and Unown forms have explicit front/back identities.
No missing form is silently replaced by its base artwork. These are visual
preview choices, not a claim of legal team selection or automatic form changes.

The package supplies no anatomical sockets. New species use the host's generic
attachment defaults. The game host overlays its 18 existing starter profiles,
preserving calibrated emission/origin sockets and original pixel proportions.
Hand-calibration of new species remains separate visual work.

See [the importer guide](../../tools/roster-import/README.md) and
[validation report](../../tools/roster-import/reports/REPORT.md).

The original artwork ownership notice and repository license are reproduced in
`UPSTREAM-LICENCE.txt`; see `NOTICE` for the distinction between repository
licensing and Pokémon artwork ownership.
