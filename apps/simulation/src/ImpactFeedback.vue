<script setup>
import { computed } from 'vue'

const props = defineProps({ feedback: { type: Object, default: null } })
const coordinate = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : .5))
const surfaceStyle = computed(() => ({
  '--hit-x': `${coordinate(props.feedback?.x) * 100}%`,
  '--hit-y': `${coordinate(props.feedback?.y) * 100}%`,
  '--feedback-duration': `${Math.max(1, props.feedback?.durationMs || 1100)}ms`,
}))
const rayAngles = [0, 37, 79, 123, 163, 202, 248, 287, 326]
</script>

<template>
  <div v-if="feedback" :key="feedback.key" class="impact-feedback" :data-kind="feedback.kind" :data-actor="feedback.actorId"
    :data-motion="feedback.reducedMotion ? 'reduced' : 'full'" :style="surfaceStyle" role="status" aria-live="polite" aria-atomic="true">
    <span class="impact-announcement">{{ feedback.label }}</span>
    <div class="impact-art" aria-hidden="true">
      <template v-if="feedback.kind === 'super-effective'">
        <span class="impact-bloom"></span>
        <svg class="impact-burst" viewBox="-100 -100 200 200" fill="none">
          <circle class="strong-ring" r="43" stroke="currentColor" stroke-width="2"/>
          <g class="strong-rays"><path v-for="angle in rayAngles" :key="angle" :transform="`rotate(${angle})`" d="M0-37 2-56 0-81-2-56Z" fill="currentColor"/></g>
          <path class="strong-spark" d="m0-21 5 15 16 6-16 5-5 16-5-16-16-5 16-6Z" fill="currentColor"/>
        </svg>
      </template>
      <svg v-else-if="feedback.kind === 'resisted'" class="impact-ripple" viewBox="-100 -100 200 200" fill="none">
        <ellipse class="resisted-ring" rx="42" ry="34" stroke="currentColor" stroke-width="2"/>
        <path class="resisted-arc" d="M-57-5a58 45 0 0 1 114 0M-51 20a59 43 0 0 0 102 0" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <path class="resisted-tick" d="m-69-19 8 4m-8 26 8-3m122-23 8-4m-8 27 8 3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <svg v-else class="impact-shield" viewBox="-100 -100 200 200" fill="none">
        <path class="immune-shield" d="M0-45 34-30v30C34 24 12 39 0 46-12 39-34 24-34 0v-30L0-45Z" fill="currentColor" fill-opacity=".055" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>
        <path class="immune-mark" d="m-12 12 24-24" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
        <g class="immune-deflect" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m-43-26-15-10m16 36-18 3m104-29 15-10m-16 36 18 3"/></g>
      </svg>
    </div>
    <div class="impact-label-position" aria-hidden="true">
      <div class="impact-label">
        <span class="impact-label-text">{{ feedback.label }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.impact-feedback {
  --impact-color: #ee3658;
  --impact-border: #ed365875;
  position: absolute;
  inset: 0;
  z-index: 2;
  overflow: hidden;
  pointer-events: none;
  container-type: size;
  color: var(--impact-color);
  font-family: 'DM Sans', sans-serif;
}
.impact-announcement { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
[data-kind='resisted'] { --impact-color: #bbd1d2; --impact-border: #a9cbd052; }
[data-kind='immune'] { --impact-color: #d0c9df; --impact-border: #c8b9db52; }
.impact-art { position: absolute; left: var(--hit-x); top: var(--hit-y); width: clamp(80px, 18cqw, 205px); aspect-ratio: 1; transform: translate(-50%, -50%); }
.impact-art > svg { display: block; width: 100%; height: 100%; overflow: visible; }
.impact-bloom { position: absolute; inset: 10%; border-radius: 50%; background: radial-gradient(circle, #ff6f8b3d 0%, #dc143c24 30%, #b8103400 68%); opacity: 0; }
.strong-ring, .strong-rays, .strong-spark, .resisted-ring, .resisted-arc, .resisted-tick, .immune-shield, .immune-mark, .immune-deflect { transform-box: view-box; transform-origin: 50% 50%; opacity: 0; }
[data-kind='resisted'] .impact-art { width: clamp(66px, 14cqw, 160px); }
[data-kind='immune'] .impact-art { width: clamp(70px, 15cqw, 170px); }
.impact-label-position {
  --label-width: clamp(130px, 23cqw, 230px);
  position: absolute;
  width: var(--label-width);
  left: clamp(calc(var(--label-width) * .5 + 7px), var(--hit-x), calc(100% - var(--label-width) * .5 - 7px));
  top: clamp(44%, calc(var(--hit-y) - 21%), calc(100% - 68px));
  transform: translateX(-50%);
}
.impact-label { width: max-content; max-width: 100%; margin: 0 auto; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 7px 12px 8px; border: 1px solid var(--impact-border); border-radius: 7px; background: #18251ee8; box-shadow: 0 3px 13px #08140d36; opacity: 0; text-align: center; }
.impact-label-text { color: var(--impact-color); font-size: clamp(10px, 1.65cqw, 18px); font-weight: 650; letter-spacing: .01em; line-height: 1.35; text-wrap: balance; }
[data-kind='super-effective'] .impact-label-text { color: #ff8199; }
[data-kind='immune'] .impact-label { border-radius: 15px; }

[data-motion='full'] .impact-label { animation: feedback-label var(--feedback-duration) ease-out both; }
[data-motion='full'] .impact-bloom { animation: impact-bloom calc(var(--feedback-duration) * .47) ease-out both; }
[data-motion='full'] .strong-ring { animation: strong-ring calc(var(--feedback-duration) * .53) ease-out both; }
[data-motion='full'] .strong-rays { animation: strong-rays calc(var(--feedback-duration) * .43) ease-out both; }
[data-motion='full'] .strong-spark { animation: strong-spark calc(var(--feedback-duration) * .32) ease-out both; }
[data-motion='full'] .resisted-ring { animation: soft-ripple calc(var(--feedback-duration) * .59) ease-out both; }
[data-motion='full'] .resisted-arc { animation: soft-ripple calc(var(--feedback-duration) * .51) ease-out both; animation-delay: calc(var(--feedback-duration) * .06); }
[data-motion='full'] .resisted-tick { animation: quiet-art calc(var(--feedback-duration) * .36) ease both; }
[data-motion='full'] .immune-shield, [data-motion='full'] .immune-mark { animation: shield-arrive calc(var(--feedback-duration) * .7) ease-out both; }
[data-motion='full'] .immune-deflect { animation: deflect-out calc(var(--feedback-duration) * .43) ease-out both; }
[data-motion='reduced'] .impact-label { animation: quiet-label var(--feedback-duration) ease both; }
[data-motion='reduced'] .impact-art { display: none; }

@keyframes feedback-label { 0% { opacity: 0; transform: translateY(5px) scale(.97); } 14%, 71% { opacity: 1; transform: translateY(0) scale(1); } 100% { opacity: 0; transform: translateY(-6px) scale(1); } }
@keyframes impact-bloom { 0% { opacity: 0; transform: scale(.6); } 24% { opacity: .85; } 100% { opacity: 0; transform: scale(1.3); } }
@keyframes strong-ring { 0% { opacity: 0; transform: scale(.55); } 22% { opacity: .8; } 100% { opacity: 0; transform: scale(1.6); } }
@keyframes strong-rays { 0% { opacity: 0; transform: scale(.6); } 25% { opacity: .86; } 100% { opacity: 0; transform: scale(1.15); } }
@keyframes strong-spark { 0% { opacity: 0; transform: scale(.5) rotate(-9deg); } 25% { opacity: .75; } 100% { opacity: 0; transform: scale(.8) rotate(9deg); } }
@keyframes soft-ripple { 0% { opacity: 0; transform: scale(.8); } 24% { opacity: .57; } 100% { opacity: 0; transform: scale(1.2); } }
@keyframes quiet-art { 0%, 100% { opacity: 0; } 30% { opacity: .45; } }
@keyframes shield-arrive { 0% { opacity: 0; transform: scale(.93); } 20%, 48% { opacity: .65; transform: scale(1); } 100% { opacity: 0; transform: scale(1); } }
@keyframes deflect-out { 0% { opacity: 0; transform: scale(.8); } 24% { opacity: .55; } 100% { opacity: 0; transform: scale(1.22); } }
@keyframes quiet-label { 0%, 100% { opacity: 0; } 16%, 78% { opacity: 1; } }
@container (max-width: 440px) {
  .impact-label-position { --label-width: 130px; top: clamp(32%, calc(var(--hit-y) - 21%), calc(100% - 49px)); }
  .impact-label { padding: 5px 8px 6px; gap: 2px; border-radius: 5px; }
  .impact-label-text { font-size: 10px; }
}
@media (prefers-reduced-motion: reduce) {
  .impact-feedback[data-motion] .impact-art { display: none; }
  .impact-feedback[data-motion] .impact-label { animation: quiet-label var(--feedback-duration) ease both; }
}
</style>
