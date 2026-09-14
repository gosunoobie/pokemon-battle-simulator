<script setup>
import { computed } from 'vue'
const props = defineProps({ actor: Object, types: { type: Array, default: () => [] }, active: Boolean, animate: Boolean, reducedMotion: Boolean })
const conditions = { paralysis: 'PARALYZED', poison: 'POISONED', sleep: 'ASLEEP', 'bad-poison': 'BADLY POISONED', burn: 'BURNED' }
const badges = computed(() => {
  const a = props.actor
  const stages = [['attackStage', 'ATTACK'], ['defenseStage', 'DEFENSE'], ['specialAttackStage', 'SP. ATK'], ['specialDefenseStage', 'SP. DEF'], ['speedStage', 'SPEED'], ['evasionStage', 'EVASION'], ['accuracyStage', 'ACCURACY']]
  return [...stages.filter(([key]) => a[key]).map(([key, label]) => `${label} ${a[key] > 0 ? '+' : '−'}${Math.abs(a[key])}`),
    a.attention && 'FOLLOW ME · PREVIEW', a.drowsy && 'DROWSY · PREVIEW', a.cursed && 'CURSED · PREVIEW', a.destinyBond && 'DESTINY BOND · PREVIEW', a.nightmare && 'NIGHTMARE · PREVIEW', a.grudge && 'GRUDGE · PREVIEW', a.seeded && 'SEEDED · PREVIEW', a.ingrained && 'ROOTED · PREVIEW', a.focusEnergy && 'FOCUSED', a.trapped && 'TRAPPED · PREVIEW', a.confused && 'CONFUSED · PREVIEW',
    a.disabled && 'DISABLE · PREVIEW', a.encored && 'ENCORE · PREVIEW', a.tormented && 'TORMENT · PREVIEW', a.imprisoning && 'IMPRISON · PREVIEW', a.taunted && 'TAUNT · PREVIEW',
    a.infatuated && 'ATTRACT · PREVIEW', a.wishPending && 'WISH PENDING', a.perishSong && 'PERISH SONG · PREVIEW',
    a.safeguard && 'SAFEGUARD', a.magicCoat && 'MAGIC COAT', a.enduring && 'ENDURE', a.heldItem && `ITEM: ${a.heldItem}`,
    a.aimed && 'AIMED · PREVIEW', a.identified && 'IDENTIFIED · PREVIEW', a.substituteHp > 0 && `SUBSTITUTE: ${a.substituteHp} HP`, a.spikesLayers > 0 && `SPIKES: ${a.spikesLayers} · PREVIEW`,
    a.protected && 'PROTECTED', a.lightScreen && 'LIGHT SCREEN', a.reflect && 'REFLECT', a.hp === 0 && 'FAINTED'].filter(Boolean)
})
</script>
<template>
  <div class="pokemon-info" :class="{ 'active-actor-info': active }">
    <div class="name-line"><h2>{{ actor.name }}</h2><span>Lv. {{ actor.level }}</span></div>
    <div class="hp-line"><span>HP</span><div class="hp-track" role="progressbar" :aria-label="`${actor.name} HP`" :aria-valuenow="actor.hp" :aria-valuemax="actor.maxHp" :aria-valuemin="0"><div class="hp-fill" :class="{ animated: animate && !reducedMotion }" :style="{ width: `${actor.hp / actor.maxHp * 100}%` }"></div></div></div>
    <div class="info-bottom"><span class="pokemon-types"><span v-for="type in types" :key="type" class="type-label" :class="type.toLowerCase()">{{ type.toUpperCase() }}</span></span><span>{{ actor.hp }} / {{ actor.maxHp }}</span></div>
    <p v-if="conditions[actor.condition]" class="condition-badge" :class="`condition-${actor.condition}`">{{ conditions[actor.condition] }}</p>
    <div v-if="badges.length" class="guard-badges"><span v-for="badge in badges" :key="badge" class="condition-badge guard-badge">{{ badge }}</span></div>
  </div>
</template>

<style scoped>
.pokemon-types { display: flex; flex-wrap: wrap; gap: 7px; }
.info-bottom { gap: 8px; }
.info-bottom > span:last-child { white-space: nowrap; }
</style>
