<script setup>
defineProps({ audio: { type: Object, required: true }, state: { type: Object, required: true }, cries: { type: Boolean, default: true } })
</script>

<template>
  <div class="battle-audio-controls">
    <label><input type="checkbox" :checked="state.enabled" @change="audio.setEnabled($event.target.checked)">Sound</label>
    <label v-if="cries"><input type="checkbox" :checked="state.criesEnabled" :disabled="!state.enabled" @change="audio.setCriesEnabled($event.target.checked)">Pokémon cries</label>
    <label><input type="checkbox" :checked="state.sfxEnabled" :disabled="!state.enabled || !state.sfxAvailable" @change="audio.setSfxEnabled($event.target.checked)">Move sounds</label>
    <label>Volume <input type="range" aria-label="Sound volume" min="0" max="100" step="5" :value="Math.round(state.volume * 100)" :disabled="!state.enabled" @input="audio.setVolume(Number($event.target.value) / 100)"><output>{{ Math.round(state.volume * 100) }}%</output></label>
    <button v-if="state.enabled && state.status === 'locked'" @click="audio.unlock()">Enable sound</button>
    <span v-if="state.enabled && state.status === 'unavailable'" role="status">Sound is unavailable. Battle controls still work.</span>
    <span v-else-if="state.enabled && state.loadError" role="status">Some sounds could not load. Battle controls still work.</span>
    <span v-else-if="state.enabled && !state.sfxAvailable">Move sounds are unavailable in this browser or release.</span>
  </div>
</template>

<style scoped>
.battle-audio-controls{display:flex;align-items:center;gap:12px 20px;flex-wrap:wrap;padding:12px 0;color:#afbaa8;font-size:12px}.battle-audio-controls label{display:flex;align-items:center;gap:7px}.battle-audio-controls input[type=checkbox]{accent-color:#c6d8a1}.battle-audio-controls input[type=range]{width:90px;accent-color:#c6d8a1}.battle-audio-controls output{min-width:3ch;font-variant-numeric:tabular-nums}.battle-audio-controls button{border:1px solid #52634e;border-radius:5px;padding:6px 10px;color:#e6eddc;background:#24352c;font:inherit;cursor:pointer}.battle-audio-controls>span{font-size:11px}
</style>
