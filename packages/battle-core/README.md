# @battle/battle-core

Pure ES-module state and fixed-result move rules for the battle showcase. No runtime dependencies, browser APIs or rendering imports.

```js
import { createBattleState, resolveMove } from '@battle/battle-core'
const before = createBattleState()
const tx = resolveMove(before, {
  moveId: 'surf', sourceId: 'source', targetId: 'target',
})
const committedState = tx.after
```

Exports: `createBattleState`, `resolveMove`, `MOVE_RULES`. `@battle/battle-core/moves` exposes just `MOVE_RULES`. Supply arbitrary actors as `{ id, name, hp, maxHp, condition? }` to createBattleState. Results are immutable `{ id, before, after, event }` transactions; the host commits after before optional presentation. Rejects invalid/fainted participants and clamps damage to remaining HP.

The included rules provide fixed-damage previews, selected status changes and source-level damage for Seismic Toss (level defaults to 50, integer 1–100). They do not implement full Pokémon mechanics or a turn scheduler. This package can run and resolve moves in Node without the FX package installed. Local packaging: `npm pack --workspace @battle/battle-core` from the workspace root.
