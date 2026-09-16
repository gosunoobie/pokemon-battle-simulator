<script setup>
import { computed } from 'vue'

const props = defineProps({ overlay: { type: Object, default: null } })
const winning = computed(() => props.overlay?.kind === 'victory')
const fallbackTitle = computed(() => ({ victory: 'Victory', defeat: 'Defeat', draw: 'Draw', 'no-contest': 'No contest' }[props.overlay?.kind] ?? 'Battle'))
const announcement = computed(() => {
  const value = props.overlay
  if (!value) return ''
  return value.kind === 'intro'
    ? [value.eyebrow, value.roundLabel, `${value.playerLabel || 'Your team'} versus ${[value.opponentTitle, value.opponentName].filter(Boolean).join(' ') || 'your opponent'}`, value.detail].filter(Boolean).join('. ')
    : [value.eyebrow, value.title || fallbackTitle.value, value.detail].filter(Boolean).join('. ')
})

// Fixed decorative positions keep replay appearance deterministic and cosmetic.
const particles = Array.from({ length: 18 }, (_, index) => ({
  '--x': `${8 + (index * 29 % 85)}%`,
  '--y': `${13 + (index * 17 % 35)}%`,
  '--delay': (index % 6) * .032,
  '--drift': `${(index % 2 ? 1 : -1) * (12 + index % 5 * 10)}px`,
  '--rotation': `${index * 41}deg`,
}))
</script>

<template>
  <div v-if="overlay" :key="overlay.key" class="battle-overlay" :class="{ 'is-champion': overlay.champion }"
    :data-stage="overlay.kind" :data-motion="overlay.motion" :data-animated="overlay.animated"
    :style="{ '--overlay-duration': `${overlay.durationMs || 2000}ms` }" role="status" aria-live="polite" aria-atomic="true">
    <span class="overlay-announcement">{{ announcement }}</span>

    <div v-if="overlay.kind === 'intro'" class="intro-scene" aria-hidden="true">
      <div class="intro-panel intro-panel-player"></div><div class="intro-panel intro-panel-opponent"></div>
      <div class="intro-streaks"><i></i><i></i><i></i><i></i><i></i><i></i></div>
      <div class="intro-heading"><span>{{ overlay.eyebrow }}</span><strong v-if="overlay.roundLabel">{{ overlay.roundLabel }}</strong></div>
      <div class="intro-matchup">
        <div class="intro-contender intro-player"><span class="contender-label">YOUR TEAM</span><strong>{{ overlay.playerLabel || 'Challenger' }}</strong><span class="contender-rule"></span></div>
        <div class="intro-versus"><span class="versus-ring"></span><strong>VS</strong><span class="versus-cross"></span></div>
        <div class="intro-contender intro-opponent"><span class="contender-label">{{ overlay.opponentTitle || 'OPPONENT' }}</span><strong>{{ overlay.opponentName || 'Challenger' }}</strong><span class="contender-rule"></span></div>
      </div>
      <p v-if="overlay.detail" class="intro-detail">{{ overlay.detail }}</p>
      <span class="intro-bottom-line"></span>
    </div>

    <div v-else class="result-scene" aria-hidden="true">
      <div class="result-scrim"></div>
      <div v-if="winning" class="result-celebration"><span class="victory-ring"></span><span class="victory-ring victory-ring-second"></span><i v-for="(particle, index) in particles" :key="index" class="result-particle" :class="{ 'particle-spark': index % 3 === 0 }" :style="particle"></i></div>
      <div v-else-if="overlay.kind === 'defeat'" class="result-shards"><i v-for="(particle, index) in particles.slice(0, 8)" :key="index" :style="particle"></i></div>
      <div class="result-content">
        <svg v-if="overlay.champion" class="champion-crown" viewBox="0 0 76 45" fill="none"><path d="m8 12 15 11L38 5l15 18 15-11-6 26H14L8 12Z" fill="currentColor" fill-opacity=".13" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M17 43h42M30 30h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="8" cy="9" r="3" fill="currentColor"/><circle cx="38" cy="4" r="3" fill="currentColor"/><circle cx="68" cy="9" r="3" fill="currentColor"/></svg>
        <p v-if="overlay.eyebrow" class="result-eyebrow">{{ overlay.eyebrow }}</p>
        <h2 class="result-title">{{ overlay.title || fallbackTitle }}</h2>
        <span class="result-rule"><i></i></span>
        <p v-if="overlay.detail" class="result-detail">{{ overlay.detail }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.battle-overlay {
  --overlay-accent: #e5c889;
  position: absolute;
  inset: 0;
  z-index: 5;
  overflow: hidden;
  pointer-events: none;
  container-type: size;
  color: #f0efd8;
  font-family: 'DM Sans', sans-serif;
}
.overlay-announcement { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.intro-scene, .result-scene, .intro-panel, .intro-streaks, .result-scrim, .result-celebration, .result-shards { position: absolute; inset: 0; }
.intro-scene { background: #14261feb; }
.intro-panel-player { background: linear-gradient(115deg, #3f5838, #223c2c 77%); clip-path: polygon(0 0, 57% 0, 44% 100%, 0 100%); }
.intro-panel-opponent { background: linear-gradient(295deg, #523d2e, #2b3429 78%); clip-path: polygon(57.5% 0, 100% 0, 100% 100%, 44.5% 100%); }
.intro-panel::after { content: ''; position: absolute; inset: 0; background: repeating-linear-gradient(135deg, transparent 0 24px, #f1e1b503 24px 25px); }
.intro-heading { position: absolute; left: 7%; right: 7%; top: 12%; display: flex; align-items: center; justify-content: center; gap: 1.5cqw; flex-wrap: wrap; text-align: center; }
.intro-heading > span { font-size: clamp(9px, 1.1cqw, 13px); text-transform: uppercase; letter-spacing: .2em; color: #bbcaab; }
.intro-heading > strong { padding: .45em .9em; border: 1px solid #d9d7a42b; border-radius: 3px; font-size: clamp(8px, 1cqw, 11px); font-weight: 500; color: #e3cc9f; letter-spacing: .1em; }
.intro-matchup { position: absolute; inset: 27% 7% 24%; display: grid; grid-template-columns: minmax(0, 1fr) 20% minmax(0, 1fr); align-items: center; gap: 3%; }
.intro-contender { min-width: 0; display: flex; align-items: center; flex-direction: column; text-align: center; }
.contender-label { font-size: clamp(8px, 1.1cqw, 13px); text-transform: uppercase; letter-spacing: .2em; color: #c0d3ad; margin-bottom: 1cqw; line-height: 1.5; }
.intro-opponent .contender-label { color: #e7be97; }
.intro-contender > strong { font: 600 clamp(16px, 3.6cqw, 43px)/1.1 'Space Grotesk', sans-serif; letter-spacing: -.035em; overflow-wrap: anywhere; text-wrap: balance; }
.contender-rule { width: 35%; height: 2px; margin-top: 1.8cqw; background: linear-gradient(90deg, transparent, #d0dda7, transparent); }
.intro-opponent .contender-rule { background: linear-gradient(90deg, transparent, #edb887, transparent); }
.intro-versus { position: relative; display: grid; place-items: center; aspect-ratio: 1; }
.intro-versus > strong { position: relative; z-index: 1; font: 600 italic clamp(36px, 10.5cqw, 125px)/1 'Space Grotesk', sans-serif; letter-spacing: -.095em; padding-right: .13em; color: #f8e6b5; text-shadow: 0 3px 0 #283c28, 0 0 35px #dfc78829; }
.versus-ring { position: absolute; inset: -2%; border: 1px solid #e5cf952e; border-radius: 50%; }
.versus-ring::before { content: ''; position: absolute; inset: 11%; border: 1px solid #e5cf9515; border-radius: 50%; }
.versus-cross { position: absolute; height: 145%; width: 1px; background: linear-gradient(transparent, #eacf9a55, transparent); transform: rotate(27deg); }
.intro-detail { position: absolute; bottom: 13%; left: 10%; right: 10%; text-align: center; font-size: clamp(9px, 1.15cqw, 13px); line-height: 1.6; color: #c0cbb4; margin: 0; text-wrap: balance; }
.intro-bottom-line { position: absolute; bottom: 7%; left: 42%; right: 42%; height: 2px; background: #e6c88990; }
.intro-streaks { overflow: hidden; opacity: .4; }
.intro-streaks i { position: absolute; height: 1px; width: 34%; background: linear-gradient(90deg, transparent, #d6ddb970, transparent); left: -36%; top: 22%; transform: rotate(-10deg); }
.intro-streaks i:nth-child(2) { top: 29%; width: 24%; }
.intro-streaks i:nth-child(3) { top: 73%; width: 41%; }
.intro-streaks i:nth-child(4) { top: 80%; width: 26%; }
.intro-streaks i:nth-child(5) { top: 49%; width: 18%; }
.intro-streaks i:nth-child(6) { top: 64%; width: 20%; }

.result-scrim { background: radial-gradient(ellipse at center, #13291de0 0%, #17291d9c 32%, #10231a38 70%, #10231a17); }
.result-content { position: absolute; inset: 12% 12%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.result-eyebrow { color: var(--overlay-accent); text-transform: uppercase; font-size: clamp(8px, 1.2cqw, 14px); letter-spacing: .22em; line-height: 1.5; margin: 0 0 1.2cqw; }
.result-title { color: var(--overlay-accent); font: 600 clamp(29px, 9cqw, 108px)/1 'Space Grotesk', sans-serif; letter-spacing: -.04em; text-transform: uppercase; margin: 0; text-shadow: 0 3px 0 #132019, 0 0 38px #e3c58417; text-wrap: balance; }
.result-rule { position: relative; width: 24%; height: 1px; margin: 2.2cqw 0 1.7cqw; background: linear-gradient(90deg, transparent, var(--overlay-accent), transparent); }
.result-rule i { position: absolute; width: 5px; height: 5px; left: calc(50% - 2.5px); top: -2px; transform: rotate(45deg); background: var(--overlay-accent); }
.result-detail { color: #e0e6cd; max-width: 38em; font-size: clamp(9px, 1.35cqw, 16px); line-height: 1.65; margin: 0; text-wrap: balance; }
.champion-crown { color: #edcd86; width: clamp(30px, 6cqw, 72px); height: auto; flex-shrink: 0; margin-bottom: 1cqw; }
.is-champion { --overlay-accent: #f6d993; }
.is-champion .result-title { font-size: clamp(27px, 8.3cqw, 99px); }
[data-stage='defeat'] { --overlay-accent: #d4a496; }
[data-stage='defeat'] .result-scrim { background: radial-gradient(ellipse at center, #251e1dde, #251e1d80 35%, #17231a2e 75%); }
[data-stage='draw'], [data-stage='no-contest'] { --overlay-accent: #cdd4be; }
[data-stage='no-contest'] .result-title { font-size: clamp(26px, 7cqw, 84px); }
.victory-ring { position: absolute; left: 50%; top: 48%; width: 28%; aspect-ratio: 1; border: 1px solid #efd497; border-radius: 50%; opacity: 0; transform: translate(-50%, -50%); }
.result-particle, .result-shards i { position: absolute; left: var(--x); top: var(--y); width: clamp(3px, .55cqw, 6px); height: clamp(5px, 1cqw, 11px); background: #e7c986; opacity: 0; }
.result-particle:nth-of-type(2n) { background: #b8ce8b; }
.result-particle:nth-of-type(3n) { background: #eddcb6; }
.particle-spark { clip-path: polygon(50% 0, 61% 38%, 100% 50%, 61% 62%, 50% 100%, 39% 62%, 0 50%, 39% 38%); width: clamp(6px, 1.1cqw, 13px); height: clamp(6px, 1.1cqw, 13px); }
.result-shards i { background: #c19484; width: clamp(3px, .55cqw, 6px); height: clamp(7px, 1.35cqw, 15px); clip-path: polygon(30% 0, 100% 15%, 50% 100%, 0 80%); }

[data-stage='intro'][data-animated='true'][data-motion='full'] .intro-scene { animation: intro-curtain var(--overlay-duration) ease both; }
[data-stage='intro'][data-animated='true'][data-motion='full'] .intro-panel-player { animation: panel-left var(--overlay-duration) cubic-bezier(.2,.7,.2,1) both; }
[data-stage='intro'][data-animated='true'][data-motion='full'] .intro-panel-opponent { animation: panel-right var(--overlay-duration) cubic-bezier(.2,.7,.2,1) both; }
[data-stage='intro'][data-animated='true'][data-motion='full'] .intro-player { animation: contender-left var(--overlay-duration) ease both; }
[data-stage='intro'][data-animated='true'][data-motion='full'] .intro-opponent { animation: contender-right var(--overlay-duration) ease both; }
[data-stage='intro'][data-animated='true'][data-motion='full'] .intro-versus { animation: versus-arrive var(--overlay-duration) cubic-bezier(.2,.7,.2,1) both; }
[data-stage='intro'][data-animated='true'][data-motion='full'] .intro-streaks i { animation: streak-travel calc(var(--overlay-duration) * .52) ease-out both; animation-delay: calc(var(--overlay-duration) * .12); }
[data-stage='intro'][data-animated='true'][data-motion='full'] .intro-streaks i:nth-child(2n) { animation-delay: calc(var(--overlay-duration) * .27); }
[data-stage='intro'][data-animated='true'][data-motion='full'] .intro-bottom-line { animation: line-arrive var(--overlay-duration) ease both; }
[data-animated='true'][data-motion='full'] .result-content { animation: result-arrive calc(var(--overlay-duration) * .43) cubic-bezier(.2,.7,.2,1) both; }
[data-animated='true'][data-motion='full'] .victory-ring { animation: victory-ripple calc(var(--overlay-duration) * .84) ease-out both; }
[data-animated='true'][data-motion='full'] .victory-ring-second { animation-delay: calc(var(--overlay-duration) * .12); }
[data-animated='true'][data-motion='full'] .result-particle { animation: confetti-fall calc(var(--overlay-duration) * .8) cubic-bezier(.15,.5,.65,1) both; animation-delay: calc(var(--overlay-duration) * var(--delay)); }
[data-animated='true'][data-motion='full'] .result-shards i { animation: shard-fall calc(var(--overlay-duration) * .65) ease-in both; animation-delay: calc(var(--overlay-duration) * var(--delay)); }
[data-animated='true'][data-motion='reduced'] .intro-scene { animation: quiet-intro var(--overlay-duration) ease both; }
[data-animated='true'][data-motion='reduced'] .result-content { animation: quiet-result var(--overlay-duration) ease both; }

@keyframes intro-curtain { 0% { opacity: 0; } 12%, 83% { opacity: 1; } 100% { opacity: 0; } }
@keyframes panel-left { 0% { transform: translateX(-75%); } 22%, 80% { transform: translateX(0); } 100% { transform: translateX(-25%); } }
@keyframes panel-right { 0% { transform: translateX(75%); } 22%, 80% { transform: translateX(0); } 100% { transform: translateX(25%); } }
@keyframes contender-left { 0%, 12% { opacity: 0; transform: translateX(-18%); } 32%, 80% { opacity: 1; transform: translateX(0); } 100% { opacity: 0; transform: translateX(-8%); } }
@keyframes contender-right { 0%, 12% { opacity: 0; transform: translateX(18%); } 32%, 80% { opacity: 1; transform: translateX(0); } 100% { opacity: 0; transform: translateX(8%); } }
@keyframes versus-arrive { 0%, 15% { opacity: 0; transform: scale(.78) rotate(-8deg); } 35%, 81% { opacity: 1; transform: scale(1) rotate(0); } 100% { opacity: 0; transform: scale(1.05); } }
@keyframes streak-travel { 0% { transform: translateX(0) rotate(-10deg); opacity: 0; } 25% { opacity: .8; } 100% { transform: translateX(430%) rotate(-10deg); opacity: 0; } }
@keyframes line-arrive { 0%, 25% { transform: scaleX(0); } 46%, 84% { transform: scaleX(1); } 100% { transform: scaleX(0); } }
@keyframes result-arrive { 0% { opacity: 0; transform: translateY(12px) scale(.95); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes victory-ripple { 0% { opacity: 0; transform: translate(-50%, -50%) scale(.7); } 16% { opacity: .4; } 100% { opacity: 0; transform: translate(-50%, -50%) scale(2.5); } }
@keyframes confetti-fall { 0% { opacity: 0; transform: translate(0, -16px) rotate(var(--rotation)); } 20% { opacity: .85; } 75% { opacity: .5; } 100% { opacity: 0; transform: translate(var(--drift), 100px) rotate(calc(var(--rotation) + 135deg)); } }
@keyframes shard-fall { 0% { opacity: 0; transform: translateY(-8px) rotate(var(--rotation)); } 25% { opacity: .4; } 100% { opacity: 0; transform: translateY(55px) rotate(calc(var(--rotation) + 25deg)); } }
@keyframes quiet-intro { 0% { opacity: 0; } 18%, 82% { opacity: 1; } 100% { opacity: 0; } }
@keyframes quiet-result { from { opacity: 0; } to { opacity: 1; } }
@container (max-width: 440px) {
  .intro-heading { top: 10%; gap: 6px 10px; }
  .intro-heading > span { letter-spacing: .12em; }
  .intro-matchup { inset: 28% 5% 25%; grid-template-columns: minmax(0, 1fr) 21% minmax(0, 1fr); gap: 2%; }
  .contender-label { letter-spacing: .12em; margin-bottom: 6px; }
  .contender-rule { margin-top: 9px; }
  .intro-detail { left: 7%; right: 7%; bottom: 11%; font-size: 9px; }
  /* Reserve the upper field for the two HP cards, including their wrapped names. */
  .result-content { inset: 46% 7% 4%; justify-content: flex-start; }
  .result-eyebrow { font-size: 8px; line-height: 1.3; margin-bottom: 5px; letter-spacing: .14em; }
  .result-rule { margin: 7px 0 6px; }
  .result-detail { max-width: 30em; font-size: 10px; line-height: 1.5; }
  .champion-crown { width: 22px; margin-bottom: 4px; }
  .victory-ring { top: 66%; }
}
@media (prefers-reduced-motion: reduce) {
  .battle-overlay[data-animated='true'][data-motion] :is(.intro-scene, .intro-panel, .intro-player, .intro-opponent, .intro-versus, .intro-bottom-line, .intro-streaks i, .result-content, .victory-ring, .result-particle, .result-shards i) { animation: none; }
  .intro-streaks, .result-celebration, .result-shards { display: none; }
}
</style>
