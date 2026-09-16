<script setup>
import { computed } from 'vue'
const props = defineProps({ member: Object, opponent: Boolean })
const stages = computed(() => Object.entries(props.member?.stages ?? {}).filter(([, value]) => value !== 0).map(([name, value]) => `${name.toUpperCase()} ${value > 0 ? '+' : ''}${value}`))
const volatileLabels = computed(() => (props.member?.volatiles ?? []).map(value => value.replace(/^move: /, '')))
</script>

<template>
  <section :aria-label="opponent ? 'Opponent battle details' : 'Your battle details'">
    <div v-if="stages.length || volatileLabels.length" class="sim-stage-badges"><span v-for="stage in stages" :key="stage">{{ stage }}</span><span v-for="label in volatileLabels" :key="label">{{ label }}</span></div>
    <details v-if="member" class="sim-known-details"><summary>{{ opponent ? 'Opponent · revealed details' : 'Your Pokémon · ability & item' }}</summary><p>Ability: {{ member.ability || (opponent ? 'Not revealed' : 'None') }}<br>Item: {{ member.item || (opponent ? 'None known' : 'None') }}</p><p v-if="opponent && member.moves?.length">Moves: {{ member.moves.join(', ') }}</p></details>
  </section>
</template>
