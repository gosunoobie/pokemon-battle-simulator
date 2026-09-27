<script setup>
import { computed, onBeforeUnmount, shallowRef, useId, watch } from 'vue'
import TeamBuilder from './TeamBuilder.vue'
import { createTeamDraft } from './teamDraft.js'
import { createRandomTeamDraftController } from './randomTeamDraft.js'

const props = defineProps({
  team: { type: Array, default: () => [] },
  catalog: { type: Object, default: null },
  presets: { type: Array, default: () => [] },
  disabled: Boolean,
  generateTeam: { type: Function, required: true },
  // Hosts include lead/seat/selection identity so older responses cannot replace
  // a draft belonging to a different selection, even when team values match.
  resetKey: { type: [String, Number], default: '' },
})
const emit = defineEmits(['update:team', 'busy-change'])
const id = useId(), state = shallowRef(null)
const controller = createRandomTeamDraftController({
  read: () => ({ team: props.team, context: props.resetKey, disabled: props.disabled }),
  generate: (body, options) => props.generateTeam(body, options),
  commit: team => emit('update:team', team),
  onState: next => {
    const wasBusy = state.value?.busy ?? false
    state.value = next
    if (next.busy !== wasBusy) emit('busy-change', next.busy)
  },
})
state.value = controller.getState()
const chosenCount = computed(() => createTeamDraft(props.team).filter(member => member.species).length)
const allLocked = computed(() => state.value.lockedSlots.length === 6)
const isLocked = index => state.value.lockedSlots.includes(index)
watch(() => [props.team, props.resetKey, props.disabled], () => controller.sync(), { deep: true, flush: 'sync' })
onBeforeUnmount(() => controller.dispose())
</script>

<template>
  <div class="random-team-builder">
    <section class="rt-panel" :aria-labelledby="`${id}-random-heading`" :aria-busy="state.busy">
      <div class="rt-intro"><div><p class="rt-kicker">A LITTLE CHANCE. YOUR CHOICE.</p><h3 :id="`${id}-random-heading`">Find your next six.</h3><p>Generate a battle-ready team, lock your favorites, then reroll the rest.</p></div><span class="rt-badge">GEN 1–3 · LEVEL 100</span></div>
      <div class="rt-actions">
        <button type="button" class="rt-primary" :disabled="disabled || state.busy || !catalog || allLocked" @click="controller.run()">{{ state.busy ? 'Building your team…' : chosenCount ? 'Reroll unlocked' : 'Generate six' }} <span aria-hidden="true">↻</span></button>
        <button type="button" :disabled="disabled || state.busy || !state.canUndo" @click="controller.undo()">Undo generation</button>
        <button v-if="state.lockedSlots.length" type="button" :disabled="disabled" @click="controller.unlockAll()">Unlock all ({{ state.lockedSlots.length }})</button>
      </div>
      <p class="rt-help">{{ allLocked ? 'All six are locked. Unlock a Pokémon to reroll.' : 'Each base species has equal odds, including legendaries. Random teams can vary in strength.' }} Locks retain the full set; direct editing is always available.</p>
      <p v-if="state.busy" class="rt-status" role="status">Choosing Pokémon and checking their complete sets. Editing, locking, or changing your lead cancels this result.</p>
      <p v-else-if="state.notice" class="rt-status" role="status">{{ state.notice }}</p>
      <div v-if="state.errors.length" class="rt-errors" role="alert"><strong>Your current team has been kept.</strong><ul><li v-for="(issue, index) in state.errors" :key="index"><span v-if="Number.isInteger(issue.setIndex)">Slot {{ issue.setIndex + 1 }}: </span>{{ issue.message }}</li></ul></div>
    </section>
    <TeamBuilder :team="team" :catalog="catalog" :presets="presets" :disabled="disabled" @update:team="controller.edit($event)">
      <template #slot-actions="{ member, index }">
        <div class="rt-slot-actions">
          <button type="button" class="rt-lock" :class="{ 'is-locked': isLocked(index) }" :disabled="disabled || !member.species" :aria-pressed="isLocked(index)" :aria-label="`${isLocked(index) ? 'Unlock' : 'Lock'} slot ${index + 1}: ${member.species || 'empty slot'}`" @click="controller.toggleLock(index)">{{ isLocked(index) ? 'Locked' : 'Lock' }}</button>
          <button type="button" :disabled="disabled || state.busy || !catalog || !member.species || isLocked(index)" :aria-label="`Reroll slot ${index + 1}${member.species ? `: ${member.species}` : ''}; retain the other chosen Pokémon`" @click="controller.run(index)">Reroll</button>
        </div>
      </template>
    </TeamBuilder>
  </div>
</template>

<style scoped>
.random-team-builder { color: #dce7d2; }
.rt-panel { padding: 23px; margin-bottom: 25px; border: 1px solid #8fa66466; border-radius: 11px; background: linear-gradient(120deg, #293c26, #182a1e); }
.rt-intro { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; }
.rt-kicker { margin: 0 0 8px; font-size: 9px; letter-spacing: 1.5px; color: #b4c993; }
.rt-intro h3 { margin: 0; font: 500 26px/1.2 'Space Grotesk', sans-serif; letter-spacing: -.6px; }
.rt-intro > div > p:last-child { margin: 9px 0 0; color: #a1b78f; font-size: 12px; line-height: 1.7; }
.rt-badge { font-size: 9px; color: #b7c8a0; border: 1px solid #79906066; border-radius: 4px; padding: 7px 9px; white-space: nowrap; }
.rt-actions { display: flex; flex-wrap: wrap; gap: 9px; margin-top: 18px; }
.random-team-builder button { cursor: pointer; font-family: 'DM Sans', sans-serif; }
.rt-actions button { min-height: 41px; padding: 10px 15px; border: 1px solid #6b8354; border-radius: 5px; color: #d5e3be; background: #1c3022; font-size: 11px; font-weight: 500; }
.rt-actions .rt-primary { background: #ddad79; border-color: #e8bb82; color: #29321f; font-weight: 650; }
.rt-primary > span { margin-left: 20px; font-size: 17px; }
.random-team-builder button:disabled { opacity: .5; cursor: default; }
.random-team-builder button:focus-visible { outline: 2px solid #efbd81; outline-offset: 3px; }
.rt-actions button:hover:not(:disabled), .rt-slot-actions button:hover:not(:disabled) { filter: brightness(1.15); }
.rt-help { margin: 12px 0 0; font-size: 10px; line-height: 1.8; color: #96aa85; }
.rt-status { margin: 12px 0 0; color: #c7dbaa; font-size: 11px; line-height: 1.7; }
.rt-errors { margin-top: 15px; padding: 13px 15px; border: 1px solid #b9826266; border-radius: 5px; color: #ebc5a5; background: #3a2d21; font-size: 11px; line-height: 1.7; }
.rt-errors ul { margin: 6px 0 0; padding-left: 18px; }
.rt-slot-actions { display: flex; gap: 4px; margin-top: 6px; }
.rt-slot-actions button { flex: 1; min-width: 0; min-height: 35px; padding: 7px 4px; color: #aabd94; background: #192b1f; border: 1px solid #49623d; border-radius: 4px; font-size: 10px; }
.rt-slot-actions .is-locked { background: #405032; color: #e0e6ba; border-color: #a5b57a; }
@media (max-width: 600px) {
  .rt-panel { padding: 18px 14px; margin-bottom: 22px; }
  .rt-intro { flex-direction: column; gap: 12px; }
  .rt-intro h3 { font-size: 24px; }
  .rt-intro > div > p:last-child { font-size: 11px; }
  .rt-actions .rt-primary { flex-basis: 100%; }
  .rt-actions > button { flex: 1; padding: 10px; }
  .rt-slot-actions button { min-height: 39px; font-size: 9px; }
}
</style>
