# Project contract — first playable release

**Version:** 0.2 · **Date:** 14 September 2026 · **Status:** Roster and mechanics confirmed; remaining proposed defaults are marked below. Team, timer and performance values are not measured capabilities.

**Outcome:** Two players can build legal teams, enter a competitive battle room, complete a server-authoritative singles battle and recover after a connection interruption. This scopes the first playable multiplayer release; the independent FX package remains its first engineering milestone.

| Area | Release contract |
| --- | --- |
| Format | Turn-based singles: two players, one active Pokémon each. **Proposed:** exactly six distinct species per team, level 100, 1–4 legal moves each; one legal ability, nature, validated IVs/EVs and optional held item. Duplicate held items allowed; bag items unavailable. |
| Legal roster — confirmed | **All National Dex species #001–386, Bulbasaur through Deoxys**, including forms available in Gen 3. Legendary and mythical species are included. Later species/forms are excluded. Existing preview artwork for nine species does not limit this release roster. |
| Rules — confirmed | **Authentic Generation 3 mechanics.** Use Gen 3 typing, move values, damage rules, status effects, items, abilities, turn interactions and legal learnsets. Content is restricted to what is available through Gen 3; later-generation mechanics must not replace historical behavior. Pin the exact mechanics reference, rules implementation, data and legality versions for every match. The existing fixed-damage preview cannot serve as the release engine. |
| Competitive policy | **Proposed:** custom Open Singles, unranked; Species Clause, no opponent team preview, no tier bans or additional competitive clauses. A 500-turn limit produces a draw if the rules have not already ended the battle. |
| Team and identity | **Proposed:** stable anonymous browser session; create, edit, validate, save and select teams locally. Server validates again before entry. Ready confirmation locks teams for the match. Cross-device accounts/saves are deferred. |
| Room entry | Private invite link/code or a simple unranked queue matching the same format. Both players confirm readiness. No skill rating or ladder. |
| Battle and result | Choose legal moves/switches; support PP, accuracy, damage, statuses, abilities, held items, forced replacements and victory according to the selected rules. Show win/loss/draw/forfeit to both players. **Proposed:** 90-second deadline per requested decision; expiry forfeits. Infrastructure termination produces an explicit no-contest. |
| Reconnection | Refresh or reconnect with the same valid session restores the same seat, latest permitted state and remaining decision time. Deadlines continue and never reset on reconnect. Duplicate commands cannot repeat an action; completed matches return their result. |
| Module boundaries | Separate data, engine/rules, protocol/server, scene, FX, audio and presentation through public contracts. Server owns outcomes and private choices. FX/audio are optional presentation; missing artwork uses a fallback and cannot change legality or results. |

**Compatibility and capacity — proposed acceptance targets**

- Desktop: latest two stable Chrome, Edge and Firefox releases; current/previous Safari major. Mobile: current/previous iOS Safari major and latest Android Chrome. Minimum width: 360 CSS pixels; mouse, keyboard and touch controls.
- Reference devices: a documented four-core/8 GB desktop, Pixel 6 and iPhone 12. Freeze exact OS/browser versions for release testing.
- At 20 Mbps downstream and 100 ms round-trip latency: p95 cold team-screen readiness ≤3 seconds; battle readiness ≤5 seconds after the second ready confirmation; command acknowledgment ≤250 ms, excluding animation.
- Sustain **100 simultaneous matches: 200 battle clients plus 50 lobby clients for 60 minutes** on documented deployment hardware while meeting latency targets. Target p95 frame time ≤16.7 ms desktop / ≤33.3 ms mobile during representative effects.

**Excluded:** doubles, ranked matchmaking/ratings, spectators, trading, overworld, collection/progression, chat, tournaments, public replay sharing and later-generation content. Internal logs/recovery records remain in scope.

**Release gate:** Two independent browser sessions complete both invite and queue flows; all 386 species have validated data and usable appearance/fallback; all allowed mechanics resolve correctly; illegal teams are rejected; reconnect, duplicate/stale commands, timeout and no-contest paths pass; private opponent information stays private; disabling/failing FX or audio preserves results; compatibility/load targets and a deployment/rollback exercise pass.

**Scope control:** Unfinished mechanics must be completed or explicitly removed through a revised contract. A cosmetic fallback does not justify skipping battle rules. Changes to roster, mechanics or acceptance targets create a new contract version. Architecture detail: [production guide](/Users/cdr/pokemon-battle-vue/docs/PRODUCTION_ARCHITECTURE_GUIDE.md).
