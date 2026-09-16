<script setup>
import { computed } from 'vue'
const props = defineProps({ member: Object, opponent: Boolean, impact: Object })
const percentage = computed(() => props.member?.hp?.max ? Math.max(0, Math.min(100, props.member.hp.current / props.member.hp.max * 100)) : 0)
const status = computed(() => props.member?.fainted ? 'Fainted' : ({ brn: 'Burned', par: 'Paralyzed', slp: 'Asleep', tox: 'Badly poisoned', psn: 'Poisoned', frz: 'Frozen' }[props.member?.condition] ?? ''))
</script>

<template>
  <section class="sim-health" :class="{ 'sim-health-own': !opponent }" :aria-label="opponent ? 'Opponent active Pokémon' : 'Your active Pokémon'">
    <span v-if="impact && impact.memberId === member?.memberId" :key="impact.key" class="sim-health-impact" :class="[`sim-health-impact-${impact.kind}`, { 'sim-health-impact-reduced': impact.reducedMotion }]" :style="{ '--impact-duration': `${impact.durationMs}ms` }" aria-hidden="true"></span>
    <div class="sim-health-name"><h2>{{ member?.species || 'Awaiting Pokémon' }}</h2><span>Lv. 100</span></div>
    <div class="sim-hp-line"><span>HP</span><div class="sim-hp-track" role="progressbar" :aria-label="`${member?.species || 'Pokémon'} HP`" :aria-valuenow="member?.hp?.current ?? 0" :aria-valuemax="member?.hp?.max ?? 100" aria-valuemin="0" :aria-valuetext="opponent ? `Public HP bar: approximately ${Math.round(percentage)} percent` : `${member?.hp?.current ?? 0} of ${member?.hp?.max ?? 0} HP`">
      <span :style="{ width: `${percentage}%`, background: percentage <= 20 ? '#e48f83' : percentage <= 50 ? '#e5c078' : '#bddb7c' }"></span>
    </div></div>
    <div class="sim-health-bottom"><span>{{ opponent ? 'Public HP bar' : 'Your HP' }}</span><strong>{{ opponent ? `≈ ${Math.round(percentage)}%` : member?.hp ? `${member.hp.current} / ${member.hp.max}` : '—' }}</strong></div>
    <span v-if="status" class="sim-status">{{ status }}</span>
  </section>
</template>
