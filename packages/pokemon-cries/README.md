# @battle/pokemon-cries

An independent, generated Gen 1–3 cry catalog. It maps the exact 419 existing species/form IDs to 386 pinned, validated legacy recordings. It imports no battle engine, rules, sprites, Vue, FX, browser APIs or decoder. Lookup never starts a download or playback.

```js
import { getPokemonCry } from '@battle/pokemon-cries'

const cry = getPokemonCry('deoxysattack')
// cry.url, mime, bytes, sha256, durationSeconds, sampleRate, channels
// cry.status === 'verified-form-alias'; cry.sharedWith === 'deoxys'
getPokemonCry('unknown') // null; no guessed fallback
getPokemonCry('bulbasaur', { baseUrl: 'https://assets.example.com/audio/cries/' })
```

The workspace deploys audio from `public/audio/cries`; this package contains only the catalog and lookup code. A consumer outside this workspace must also publish those files and supply the matching base URL. `CRY_CATALOG` is recursively frozen; returned descriptors are immutable. IDs are case-sensitive project IDs, not display names or National Dex numbers.

All shipped Ogg bytes match upstream. Form aliases have explicit pinned source evidence in `tools/cry-import/form-aliases.json`. The upstream `legacy` label does not establish authentic Gen 3 recording vintage.

No battle integration is enabled yet. The future host audio player must handle user activation, decoding support, caching, volume/headroom, cancellation and reveal cues. The catalog has Ogg Vorbis only; older browsers without native Ogg decoding need a separately reviewed fallback before they can be promised support.

See `tools/cry-import/README.md` for acquisition, validation and rebuild commands. Generated data is not edited by hand.
