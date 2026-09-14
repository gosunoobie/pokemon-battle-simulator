<script setup>
import { computed } from 'vue'
const props = defineProps({ member: Object, opponent: Boolean })
const percentage = computed(() => props.member?.hp?.max ? Math.max(0, Math.min(100, props.member.hp.current / props.member.hp.max * 100)) : 0)
const status = computed(() => props.member?.fainted ? 'Fainted' : ({ brn: 'Burned', par: 'Paralyzed', slp: 'Asleep', tox: 'Badly poisoned', psn: 'Poisoned', frz: 'Frozen' }[props.member?.condition] ?? ''))
const stages = computed(() => Object.entries(props.member?.stages ?? {}).filter(([, value]) => value !== 0).map(([name, value]) => `${name.toUpperCase()} ${value > 0 ? '+' : ''}${value}`))
const volatileLabels = computed(() => (props.member?.volatiles ?? []).map(value => value.replace(/^move: /, '')))
</script>

<template>
  <section class="sim-health" :aria-label="opponent ? 'Opponent active Pokémon' : 'Your active Pokémon'">
    <div class="sim-health-top"><span>{{ opponent ? 'AUTOMATED OPPONENT' : 'YOUR POKÉMON' }}</span><span>Lv. 100</span></div>
    <div class="sim-health-name"><h2>{{ member?.species || 'Awaiting Pokémon' }}</h2><span v-if="status" class="sim-status">{{ status }}</span></div>
    <div class="sim-hp-track" role="progressbar" :aria-label="`${member?.species || 'Pokémon'} HP`" :aria-valuenow="member?.hp?.current ?? 0" :aria-valuemax="member?.hp?.max ?? 100" aria-valuemin="0" :aria-valuetext="opponent ? `Public HP bar: approximately ${Math.round(percentage)} percent` : `${member?.hp?.current ?? 0} of ${member?.hp?.max ?? 0} HP`">
      <span :style="{ width: `${percentage}%`, background: percentage <= 20 ? '#e48f83' : percentage <= 50 ? '#e5c078' : '#bfd993' }"></span>
    </div>
    <div class="sim-health-bottom"><span>{{ opponent ? 'Public HP bar' : 'HP' }}</span><strong>{{ opponent ? `≈ ${Math.round(percentage)}%` : member?.hp ? `${member.hp.current} / ${member.hp.max}` : '—' }}</strong></div>
    <div v-if="stages.length || volatileLabels.length" class="sim-stage-badges"><span v-for="stage in stages" :key="stage">{{ stage }}</span><span v-for="label in volatileLabels" :key="label">{{ label }}</span></div>
    <details v-if="member" class="sim-known-details"><summary>{{ opponent ? 'Revealed details' : 'Ability & item' }}</summary><p>Ability: {{ member.ability || (opponent ? 'Not revealed' : 'None') }}<br>Item: {{ member.item || (opponent ? 'None known' : 'None') }}</p><p v-if="opponent && member.moves?.length">Moves: {{ member.moves.join(', ') }}</p></details>
  </section>
</template>
