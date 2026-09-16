<script setup>
import { computed, ref, useId } from 'vue'
import { spriteUrl } from './scene.js'
import { STATS, createTeamDraft, selectDraftSpecies, normalizeId, findCatalogRecord } from './teamDraft.js'

const props = defineProps({
  team: { type: Array, default: () => [] },
  catalog: { type: Object, default: null },
  presets: { type: Array, default: () => [] },
  disabled: Boolean,
})
const emit = defineEmits(['update:team'])
const id = useId(), activeSlot = ref(0), speciesQuery = ref(''), moveQueries = ref(['', '', '', '']), presetChoice = ref('')
const slots = computed(() => createTeamDraft(props.team))
const current = computed(() => slots.value[activeSlot.value])
const speciesOptions = computed(() => (props.catalog?.species ?? []).filter(record => record.kind !== 'battle-only'))
const selectedSpecies = computed(() => findCatalogRecord(speciesOptions.value, current.value.species))
const selectedNature = computed(() => findCatalogRecord(props.catalog?.natures ?? [], current.value.nature))
const searchKey = value => normalizeId(String(value ?? '').normalize('NFKD').replace(/\p{M}/gu, ''))
const speciesMatches = computed(() => {
  const query = searchKey(speciesQuery.value)
  return speciesOptions.value.filter(record => !query || searchKey(`${record.name} ${record.id} ${String(record.num).padStart(3, '0')} ${record.types.join(' ')}`).includes(query))
})
const preserveSpecies = computed(() => selectedSpecies.value && !speciesMatches.value.some(record => record.id === selectedSpecies.value.id))
const selectedAbilities = computed(() => (selectedSpecies.value?.abilities ?? []).map(abilityId => findCatalogRecord(props.catalog?.abilities ?? [], abilityId)).filter(Boolean))
const abilityDescription = computed(() => findCatalogRecord(props.catalog?.abilities ?? [], current.value.ability)?.shortDesc)
const itemDescription = computed(() => findCatalogRecord(props.catalog?.items ?? [], current.value.item)?.shortDesc)
const availableMoves = computed(() => {
  const ids = new Set(selectedSpecies.value?.moveIds ?? [])
  return (props.catalog?.moves ?? []).filter(move => ids.has(move.id))
})
const moveMatches = computed(() => moveQueries.value.map(query => {
  const text = searchKey(query)
  return availableMoves.value.filter(move => !text || searchKey(`${move.name} ${move.type} ${move.category}`).includes(text))
}))
const chosenMoves = computed(() => current.value.moves.map(name => findCatalogRecord(props.catalog?.moves ?? [], name)))
const chosenCount = computed(() => slots.value.filter(member => member.species).length)
const evTotal = computed(() => STATS.reduce((total, stat) => total + (Number(current.value.evs[stat]) || 0), 0))
const evLimit = computed(() => props.catalog?.rules?.totalEvs ?? 510)
const maxEv = computed(() => props.catalog?.rules?.maxEv ?? 255)
const maxIv = computed(() => props.catalog?.rules?.maxIv ?? 31)
const statLabels = { hp: 'HP', atk: 'Attack', def: 'Defense', spa: 'Sp. Attack', spd: 'Sp. Defense', spe: 'Speed' }
const natureDescription = computed(() => selectedNature.value?.plus && selectedNature.value?.minus
  ? `Raises ${statLabels[selectedNature.value.plus] || selectedNature.value.plus}; lowers ${statLabels[selectedNature.value.minus] || selectedNature.value.minus}.`
  : 'No stat is raised or lowered.')
const speciesLabel = record => `#${String(record.num).padStart(3, '0')} · ${record.name}`

function resetSearch() { speciesQuery.value = ''; moveQueries.value = ['', '', '', ''] }
function chooseSlot(index) {
  if (props.disabled) return
  activeSlot.value = index; resetSearch()
}
function updateMember(patch) {
  if (props.disabled) return
  const next = createTeamDraft(props.team)
  next[activeSlot.value] = { ...next[activeSlot.value], ...patch, level: 100 }
  emit('update:team', next)
}
function chooseSpecies(name) {
  if (props.disabled) return
  const record = findCatalogRecord(speciesOptions.value, name)
  if (!record || record.name === current.value.species) return
  const next = createTeamDraft(props.team)
  next[activeSlot.value] = selectDraftSpecies(next[activeSlot.value], record, props.catalog)
  moveQueries.value = ['', '', '', '']
  emit('update:team', next)
}
function chooseMove(index, name) {
  const moves = [...current.value.moves]
  moves[index] = name
  updateMember({ moves })
}
function boundedInput(input, maximum, fallback) {
  const numeric = Number(input.value)
  const value = Number.isFinite(numeric) ? Math.min(maximum, Math.max(0, Math.trunc(numeric))) : fallback
  // Correct the native field even when clamping leaves the stored number unchanged.
  input.value = String(value)
  return value
}
function setStat(group, stat, input) {
  const maximum = group === 'evs' ? maxEv.value : maxIv.value
  const value = boundedInput(input, maximum, current.value[group][stat])
  updateMember({ [group]: { ...current.value[group], [stat]: value } })
}
function setHappiness(input) {
  updateMember({ happiness: boundedInput(input, 255, current.value.happiness) })
}
function copyPreset() {
  const preset = props.presets.find(value => value.id === presetChoice.value)
  if (props.disabled || !preset) return
  activeSlot.value = 0; resetSearch()
  emit('update:team', createTeamDraft(preset.team))
}
function clearSlot() {
  if (props.disabled) return
  const next = createTeamDraft(props.team)
  next[activeSlot.value] = createTeamDraft()[0]
  resetSearch(); emit('update:team', next)
}
function preserveMove(index) {
  return current.value.moves[index] && !moveMatches.value[index].some(move => move.name === current.value.moves[index])
}
function duplicateMove(index, name) {
  return current.value.moves.some((move, position) => position !== index && normalizeId(move) === normalizeId(name))
}
</script>

<template>
  <section class="team-builder" :aria-labelledby="`${id}-heading`">
    <div class="tb-heading"><div><p class="tb-kicker">BUILD YOUR SIX</p><h3 :id="`${id}-heading`">A team of your own.</h3><p>Choose a slot, then shape its moves and battle setup.</p></div><span class="tb-count">{{ chosenCount }} / 6 Pokémon chosen</span></div>
    <div v-if="presets.length" class="tb-preset-copy">
      <div><label :for="`${id}-preset`">Start from a preset</label><span>Copying replaces all six slots. Make it your own afterward.</span></div>
      <select :id="`${id}-preset`" v-model="presetChoice" :disabled="disabled"><option value="">Choose a preset…</option><option v-for="preset in presets" :key="preset.id" :value="preset.id">{{ preset.name }}</option></select>
      <button type="button" class="tb-copy-button" :disabled="disabled || !presetChoice" @click="copyPreset">Copy preset <span aria-hidden="true">↗</span></button>
    </div>

    <div class="tb-slots" role="group" aria-label="Choose a team slot to edit">
      <button v-for="(member, index) in slots" :key="index" type="button" class="tb-slot" :class="{ 'is-active': activeSlot === index, 'is-empty': !member.species }" :disabled="disabled" :aria-pressed="activeSlot === index" :aria-controls="`${id}-editor`" :aria-label="`Edit slot ${index + 1}: ${member.species || 'Choose Pokémon'}`" @click="chooseSlot(index)">
        <span class="tb-slot-number">0{{ index + 1 }}</span><img v-if="member.species && spriteUrl(member.species)" :src="spriteUrl(member.species)" alt="" width="66" height="66" decoding="async"><span v-else class="tb-slot-empty" aria-hidden="true">＋</span>
        <strong>{{ member.species || 'Choose Pokémon' }}</strong><span class="tb-slot-status">{{ activeSlot === index ? 'Editing this slot' : member.species ? `${member.moves.filter(Boolean).length} moves selected` : 'Empty slot' }}</span>
      </button>
    </div>

    <p v-if="!catalog" class="tb-loading" role="status">Loading the Gen 3 team catalog…</p>
    <fieldset v-else :id="`${id}-editor`" class="tb-editor" :disabled="disabled" :aria-labelledby="`${id}-member-heading`">
      <legend class="tb-sr-only">Edit team slot {{ activeSlot + 1 }}</legend>
      <div class="tb-editor-heading">
        <div class="tb-member-profile"><img v-if="selectedSpecies" :src="spriteUrl(selectedSpecies.name)" alt="" width="88" height="88"><span v-else class="tb-profile-empty" aria-hidden="true">?</span><div><p class="tb-kicker">SLOT 0{{ activeSlot + 1 }} <span>· LEVEL 100</span></p><h4 :id="`${id}-member-heading`">{{ selectedSpecies?.name || 'Choose your Pokémon' }}</h4><div v-if="selectedSpecies" class="tb-types"><span v-for="type in selectedSpecies.types" :key="type">{{ type }}</span><span v-if="selectedSpecies.kind !== 'base'" class="tb-form-label">{{ selectedSpecies.kind === 'cosmetic' ? 'Cosmetic form' : 'Alternate form' }}</span></div><p v-else class="tb-empty-help">Start with a species. Every slot is yours to build.</p></div></div>
        <button v-if="current.species" type="button" class="tb-clear-slot" @click="clearSlot">Clear slot</button>
      </div>

      <div class="tb-species-controls">
        <label :for="`${id}-species-search`">Find a Pokémon<input :id="`${id}-species-search`" v-model="speciesQuery" type="search" placeholder="Name, type or Pokédex number" autocomplete="off" :aria-controls="`${id}-species`" :aria-describedby="`${id}-species-count`"></label>
        <label :for="`${id}-species`">Species<select :id="`${id}-species`" :value="current.species" @change="chooseSpecies($event.target.value)"><option value="" disabled>Choose Pokémon…</option><optgroup v-if="preserveSpecies" label="Current selection"><option :value="selectedSpecies.name">{{ speciesLabel(selectedSpecies) }}</option></optgroup><option v-if="current.species && !selectedSpecies" :value="current.species">{{ current.species }} — choose a catalog species</option><option v-for="record in speciesMatches" :key="record.id" :value="record.name">{{ speciesLabel(record) }}</option></select></label>
      </div>
      <div class="tb-search-summary"><span :id="`${id}-species-count`" aria-live="polite">{{ speciesMatches.length }} matching Pokémon</span><span>Changing species resets this slot’s moves, item and stat settings.</span></div>

      <template v-if="selectedSpecies">
        <div class="tb-loadout-grid">
          <div><label :for="`${id}-ability`">Ability<select :id="`${id}-ability`" :value="current.ability" @change="updateMember({ ability: $event.target.value })"><option value="" disabled>Choose an ability</option><option v-if="current.ability && !selectedAbilities.some(ability => ability.name === current.ability)" :value="current.ability">{{ current.ability }} — check selection</option><option v-for="ability in selectedAbilities" :key="ability.id" :value="ability.name">{{ ability.name }}</option></select></label><p class="tb-field-help">{{ abilityDescription || 'Choose one of this Pokémon’s Gen 3 abilities.' }}</p></div>
          <div><label :for="`${id}-item`">Held item<select :id="`${id}-item`" :value="current.item" @change="updateMember({ item: $event.target.value })"><option value="">None</option><option v-for="item in catalog.items" :key="item.id" :value="item.name">{{ item.name }}</option></select></label><p class="tb-field-help">{{ itemDescription || 'Enter battle without a held item.' }}</p></div>
          <div><label :for="`${id}-nature`">Nature<select :id="`${id}-nature`" :value="current.nature" @change="updateMember({ nature: $event.target.value })"><option v-for="nature in catalog.natures" :key="nature.id" :value="nature.name">{{ nature.name }}</option></select></label><p class="tb-field-help">{{ natureDescription }}</p></div>
        </div>

        <div class="tb-section-heading"><div><p class="tb-kicker">MOVESET</p><h4>Four moves. Your strategy.</h4></div><span>{{ availableMoves.length }} learnset candidates</span></div>
        <div class="tb-moves">
          <div v-for="(_, index) in current.moves" :key="index" class="tb-move-card">
            <div class="tb-move-heading"><label :for="`${id}-move-${index}`">MOVE 0{{ index + 1 }}</label><span v-if="chosenMoves[index]">{{ chosenMoves[index].type }} · {{ chosenMoves[index].category }} · {{ chosenMoves[index].pp }} PP</span></div>
            <input v-model="moveQueries[index]" type="search" :aria-label="`Search moves for slot ${index + 1}`" :aria-controls="`${id}-move-${index}`" placeholder="Search name, type or category" autocomplete="off">
            <select :id="`${id}-move-${index}`" :value="current.moves[index]" @change="chooseMove(index, $event.target.value)"><option value="">Choose a move…</option><optgroup v-if="preserveMove(index)" label="Current selection"><option :value="current.moves[index]">{{ current.moves[index] }}</option></optgroup><option v-for="move in moveMatches[index]" :key="move.id" :value="move.name" :disabled="duplicateMove(index, move.name)">{{ move.name }}</option></select>
            <p class="tb-move-description">{{ chosenMoves[index]?.shortDesc || (moveMatches[index].length ? 'Choose a move from this Pokémon’s learnset candidates.' : 'No matching moves. Try a different search.') }}</p>
          </div>
        </div>
        <p class="tb-validation-note">These are Gen 3 learnset candidates. The server checks the complete team, including move combinations, before a challenge can begin.</p>

        <details class="tb-advanced">
          <summary><span>Advanced settings</span><span>EVs, IVs, gender & friendship <span aria-hidden="true">＋</span></span></summary>
          <div class="tb-advanced-body">
            <div class="tb-stats-heading"><div><h4>Stat training</h4><p>EVs share a {{ evLimit }}-point budget. IVs range from 0 to {{ maxIv }}.</p></div><span :id="`${id}-ev-budget`" class="tb-ev-budget" :class="{ 'is-over': evTotal > evLimit }" role="status">{{ evTotal }} / {{ evLimit }} EVs<span>{{ evTotal > evLimit ? `${evTotal - evLimit} over the limit` : `${evLimit - evTotal} remaining` }}</span></span></div>
            <div class="tb-stat-grid"><span class="tb-stat-column-heading">STAT</span><span class="tb-stat-column-heading">EVs · 0–{{ maxEv }}</span><span class="tb-stat-column-heading">IVs · 0–{{ maxIv }}</span><span class="tb-stat-column-heading tb-training-heading">EV DISTRIBUTION</span>
              <template v-for="stat in STATS" :key="stat"><strong class="tb-stat-name">{{ statLabels[stat] }}</strong><input type="number" :value="current.evs[stat]" min="0" :max="maxEv" step="1" inputmode="numeric" :aria-label="`${statLabels[stat]} EVs`" :aria-describedby="`${id}-ev-budget`" :aria-invalid="evTotal > evLimit ? 'true' : undefined" @input="setStat('evs', stat, $event.target)"><input type="number" :value="current.ivs[stat]" min="0" :max="maxIv" step="1" inputmode="numeric" :aria-label="`${statLabels[stat]} IVs`" @input="setStat('ivs', stat, $event.target)"><span class="tb-stat-meter" aria-hidden="true"><i :style="{ width: `${Math.min(100, (Number(current.evs[stat]) || 0) / maxEv * 100)}%` }"></i></span></template>
            </div>
            <div class="tb-personal-grid"><div><label :for="`${id}-gender`">Gender<select :id="`${id}-gender`" :value="current.gender || ''" @change="updateMember({ gender: $event.target.value })"><option value="">Automatic</option><option value="M">Male</option><option value="F">Female</option><option value="N">Genderless</option></select></label><p class="tb-field-help">The server checks gender against the species.</p></div><div><label :for="`${id}-happiness`">Friendship<input :id="`${id}-happiness`" type="number" :value="current.happiness" min="0" max="255" step="1" inputmode="numeric" @input="setHappiness($event.target)"></label><p class="tb-field-help">0–255. Used by moves such as Return and Frustration.</p></div></div>
          </div>
        </details>
      </template>
    </fieldset>
  </section>
</template>

<style scoped>
.team-builder { color: #dce7d2; }
.tb-heading { display: flex; align-items: center; justify-content: space-between; gap: 18px; margin-bottom: 22px; }
.tb-kicker { font-size: 9px; font-weight: 650; letter-spacing: 1.6px; color: #a8bd92; margin: 0 0 7px; }
.tb-heading h3 { font: 500 27px/1.2 'Space Grotesk', sans-serif; letter-spacing: -.7px; margin: 0; }
.tb-heading > div > p:last-child { color: #94a98a; font-size: 12px; margin-top: 9px; line-height: 1.7; }
.tb-count { color: #c6d8b1; font-size: 11px; white-space: nowrap; padding: 8px 10px; border: 1px solid #57724755; border-radius: 5px; background: #b5d2950a; }
.tb-preset-copy { display: flex; align-items: center; gap: 12px; padding: 16px 18px; border: 1px solid #49614255; border-radius: 8px; margin-bottom: 20px; background: #112118; }
.tb-preset-copy > div { flex: 1; min-width: 0; }
.tb-preset-copy > div > span { display: block; color: #8da17f; font-size: 10px; line-height: 1.6; margin-top: 5px; }
.team-builder label { display: block; color: #bacda9; font-size: 11px; font-weight: 500; line-height: 1.5; }
.team-builder input, .team-builder select { display: block; box-sizing: border-box; min-width: 0; width: 100%; min-height: 39px; border: 1px solid #496243; border-radius: 5px; background: #17271c; color: #e1ebd7; padding: 8px 10px; font: 400 12px 'DM Sans', sans-serif; line-height: 1.5; }
.team-builder label > input, .team-builder label > select { margin-top: 7px; }
.team-builder input::placeholder { color: #829975; }
.team-builder input:focus-visible, .team-builder select:focus-visible, .team-builder button:focus-visible, .team-builder summary:focus-visible { outline: 2px solid #efbd81; outline-offset: 3px; }
.team-builder input:disabled, .team-builder select:disabled, .team-builder button:disabled, .team-builder fieldset:disabled { opacity: .6; }
.team-builder button { font-family: 'DM Sans', sans-serif; cursor: pointer; }
.team-builder button:disabled { cursor: default; }
.tb-preset-copy > select { width: 210px; }
.tb-copy-button { display: flex; align-items: center; justify-content: center; gap: 15px; padding: 10px 14px; border: 1px solid #e8bb8255; border-radius: 5px; background: #ddad79; color: #29321f; font-size: 11px; font-weight: 650; white-space: nowrap; }
.tb-copy-button:hover:not(:disabled) { background: #edbf88; }
.tb-copy-button > span { font-size: 17px; }
.tb-slots { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 9px; margin-bottom: 20px; }
.tb-slot { position: relative; display: flex; align-items: center; flex-direction: column; min-width: 0; gap: 8px; padding: 12px 5px 15px; background: #17271d; border: 1px solid #43583d; color: #c7d6b8; border-radius: 8px; }
.tb-slot:hover:not(:disabled) { border-color: #9fb77a; background: #263828; }
.tb-slot.is-active { border-color: #c7d99d; background: #30412b; box-shadow: inset 0 -2px #bed096; }
.tb-slot-number { position: absolute; left: 9px; top: 8px; font-size: 9px; color: #8da37a; }
.tb-slot img { object-fit: contain; image-rendering: pixelated; max-width: 100%; }
.tb-slot strong { font-size: 11px; font-weight: 600; overflow-wrap: anywhere; text-align: center; }
.tb-slot-status { font-size: 9px; color: #8da27d; text-align: center; }
.tb-slot.is-active .tb-slot-status { color: #cbdbac; }
.tb-slot-empty { display: grid; place-items: center; width: 66px; height: 66px; color: #758c65; font-size: 28px; font-weight: 300; }
.tb-editor { min-width: 0; padding: 23px; margin: 0; border: 1px solid #4e633e77; border-radius: 11px; background: #1d2e22; }
.tb-editor-heading { display: flex; align-items: center; justify-content: space-between; gap: 15px; margin-bottom: 24px; }
.tb-member-profile { display: flex; align-items: center; gap: 18px; min-width: 0; }
.tb-member-profile img { object-fit: contain; image-rendering: pixelated; flex: 0 0 88px; background: radial-gradient(ellipse at center, #b1d48410, transparent 70%); }
.tb-member-profile h4 { font: 500 25px/1.2 'Space Grotesk', sans-serif; letter-spacing: -.5px; margin: 0; overflow-wrap: anywhere; }
.tb-member-profile .tb-kicker > span { color: #879e7a; }
.tb-profile-empty { width: 88px; height: 88px; flex: 0 0 88px; display: grid; place-items: center; color: #789065; border: 1px dashed #74896744; border-radius: 50%; font: 400 34px 'Space Grotesk', sans-serif; }
.tb-empty-help { margin: 9px 0 0; font-size: 11px; color: #93a985; line-height: 1.6; }
.tb-clear-slot { border: 0; background: transparent; color: #b8ba98; font-size: 10px; text-decoration: underline; text-underline-offset: 4px; padding: 8px 0; white-space: nowrap; }
.tb-types { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 10px; }
.tb-types > span { font-size: 9px; color: #c4d6b0; padding: 3px 7px; background: #b8d2960a; border: 1px solid #75915a55; border-radius: 3px; }
.tb-types .tb-form-label { color: #a1b38e; border-color: #70855c33; }
.tb-species-controls { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.tb-search-summary { display: flex; justify-content: space-between; gap: 12px; font-size: 10px; color: #869d76; line-height: 1.7; margin: 9px 0 0; }
.tb-search-summary > span:last-child { text-align: right; }
.tb-loadout-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 17px; margin-top: 28px; padding-top: 24px; border-top: 1px solid #92ae721d; }
.tb-field-help { color: #8ea37f; font-size: 10px; line-height: 1.7; margin: 8px 0 0; }
.tb-section-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; margin: 29px 0 15px; }
.tb-section-heading h4 { font: 500 20px 'Space Grotesk', sans-serif; letter-spacing: -.35px; margin: 0; }
.tb-section-heading > span { color: #95ac83; font-size: 10px; text-align: right; }
.tb-moves { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.tb-move-card { min-width: 0; padding: 15px; border: 1px solid #52644277; border-radius: 7px; background: #16261c; }
.tb-move-heading { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 11px; }
.tb-move-heading > label { font-size: 9px; font-weight: 600; letter-spacing: 1px; color: #c3d5a8; }
.tb-move-heading > span { color: #bcae8c; font-size: 9px; text-align: right; line-height: 1.5; }
.tb-move-card input { margin-bottom: 8px; font-size: 11px; min-height: 35px; background: #102118; }
.tb-move-card select { color: #e5eccf; font-weight: 500; }
.tb-move-description { min-height: 33px; font-size: 10px; color: #8fa580; line-height: 1.7; margin: 9px 0 0; }
.tb-validation-note { font-size: 10px; line-height: 1.8; color: #9aad89; margin: 13px 0 0; }
.tb-advanced { margin-top: 24px; border: 1px solid #50643f77; border-radius: 7px; background: #17281c; }
.tb-advanced > summary { display: flex; align-items: center; justify-content: space-between; gap: 12px; list-style: none; cursor: pointer; padding: 16px 17px; font-size: 12px; color: #c3d2ac; }
.tb-advanced > summary::-webkit-details-marker { display: none; }
.tb-advanced > summary > span:last-child { color: #92a77e; font-size: 10px; }
.tb-advanced > summary > span:last-child > span { display: inline-block; margin-left: 12px; font-size: 15px; }
.tb-advanced[open] > summary { border-bottom: 1px solid #7188562e; }
.tb-advanced[open] > summary > span:last-child > span { transform: rotate(45deg); }
.tb-advanced-body { padding: 20px; }
.tb-stats-heading { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 19px; }
.tb-stats-heading h4 { font: 500 18px 'Space Grotesk', sans-serif; margin: 0; }
.tb-stats-heading p { font-size: 10px; color: #95ac82; line-height: 1.7; margin-top: 7px; }
.tb-ev-budget { color: #c7d8a8; font-size: 12px; text-align: right; white-space: nowrap; }
.tb-ev-budget > span { display: block; font-size: 9px; color: #92a880; margin-top: 5px; }
.tb-ev-budget.is-over, .tb-ev-budget.is-over > span { color: #eda292; }
.tb-stat-grid { display: grid; grid-template-columns: minmax(90px, 1fr) 90px 90px minmax(80px, 1.5fr); align-items: center; gap: 9px 13px; }
.tb-stat-column-heading { color: #849b71; font-size: 8px; letter-spacing: .8px; margin-bottom: 3px; }
.tb-stat-name { font-size: 11px; font-weight: 500; color: #bed0a6; }
.tb-stat-grid input { min-height: 34px; padding: 6px 9px; font-variant-numeric: tabular-nums; }
.tb-stat-grid input[aria-invalid='true'] { border-color: #c28b6c; }
.tb-stat-meter { height: 4px; background: #0d1f14; border-radius: 5px; margin: 0 8px; overflow: hidden; }
.tb-stat-meter > i { display: block; height: 100%; border-radius: inherit; background: #a8c879; }
.tb-personal-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 24px; padding-top: 20px; border-top: 1px solid #819f6326; }
.tb-loading { padding: 30px 15px; font-size: 12px; color: #abc095; text-align: center; }
.tb-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
@media (max-width: 850px) {
  .tb-preset-copy { flex-wrap: wrap; }
  .tb-preset-copy > div { flex-basis: 100%; }
  .tb-preset-copy > select { flex: 1; width: auto; }
  .tb-slots { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .tb-slot { gap: 5px; padding-bottom: 12px; }
  .tb-loadout-grid { gap: 12px; }
  .tb-editor { padding: 19px; }
  .tb-stat-grid { grid-template-columns: minmax(70px, 1fr) 70px 70px minmax(45px, 1fr); gap: 8px 9px; }
}
@media (max-width: 600px) {
  .tb-heading { display: block; margin-bottom: 18px; }
  .tb-heading h3 { font-size: 24px; }
  .tb-heading > div > p:last-child { font-size: 11px; }
  .tb-count { display: inline-block; margin-top: 12px; font-size: 10px; }
  .tb-preset-copy { padding: 14px; gap: 10px; }
  .tb-preset-copy > select { flex-basis: 100%; }
  .tb-copy-button { width: 100%; min-height: 38px; }
  .tb-slots { gap: 7px; margin-bottom: 16px; }
  .tb-slot img, .tb-slot-empty { width: 58px; height: 58px; }
  .tb-slot { padding: 12px 4px; }
  .tb-slot strong { font-size: 10px; }
  .tb-slot-status { font-size: 8px; }
  .tb-slot-number { left: 7px; top: 7px; font-size: 8px; }
  .tb-editor { padding: 16px 13px; }
  .tb-editor-heading { gap: 8px; margin-bottom: 18px; flex-wrap: wrap; }
  .tb-member-profile { gap: 10px; }
  .tb-member-profile img, .tb-profile-empty { width: 65px; height: 65px; flex-basis: 65px; }
  .tb-member-profile h4 { font-size: 21px; }
  .tb-member-profile .tb-kicker { font-size: 8px; letter-spacing: 1px; }
  .tb-empty-help { font-size: 10px; }
  .tb-clear-slot { margin-left: auto; }
  .tb-types > span { font-size: 8px; padding: 2px 5px; }
  .tb-species-controls, .tb-loadout-grid, .tb-moves { grid-template-columns: 1fr; }
  .tb-species-controls { gap: 13px; }
  .tb-search-summary { display: block; font-size: 9px; }
  .tb-search-summary > span { display: block; }
  .tb-search-summary > span:last-child { margin-top: 5px; text-align: left; }
  .tb-loadout-grid { margin-top: 19px; padding-top: 18px; gap: 17px; }
  .tb-field-help { margin-top: 6px; }
  .tb-section-heading { gap: 10px; align-items: flex-start; margin-top: 24px; }
  .tb-section-heading h4 { font-size: 18px; }
  .tb-section-heading > span { max-width: 78px; font-size: 9px; line-height: 1.6; }
  .tb-move-card { padding: 12px; }
  .tb-move-description { min-height: 0; }
  .tb-validation-note { font-size: 9px; }
  .tb-advanced > summary { flex-wrap: wrap; gap: 7px; padding: 13px; font-size: 11px; }
  .tb-advanced > summary > span:last-child { font-size: 9px; }
  .tb-advanced-body { padding: 15px 11px; }
  .tb-stats-heading { display: block; }
  .tb-stats-heading h4 { font-size: 17px; }
  .tb-ev-budget { display: block; margin-top: 11px; text-align: left; }
  .tb-ev-budget > span { display: inline; margin: 0 0 0 9px; }
  .tb-stat-grid { grid-template-columns: minmax(65px, 1fr) 65px 65px; gap: 8px 6px; }
  .tb-training-heading, .tb-stat-meter { display: none; }
  .tb-stat-name { font-size: 10px; }
  .tb-personal-grid { grid-template-columns: 1fr; gap: 16px; margin-top: 19px; padding-top: 17px; }
}
</style>
