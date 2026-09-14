<script setup>
import { computed, ref, useId } from 'vue'
import { ROSTER_LIST } from '../roster/index.js'

const props = defineProps({
  modelValue: { type: String, required: true },
  label: { type: String, required: true },
  includeShapes: Boolean,
})
const emit = defineEmits(['update:modelValue', 'change'])
const query = ref(''), controlId = useId()
const shapes = [
  { id: 'tall', name: 'Tall test shape', kind: 'shape' },
  { id: 'wide', name: 'Wide test shape', kind: 'shape' },
]
const options = computed(() => props.includeShapes ? [...ROSTER_LIST, ...shapes] : ROSTER_LIST)
const selected = computed(() => options.value.find(record => record.id === props.modelValue))
// Search text may be forgiving; the selected value always remains an exact ID.
const searchText = value => String(value).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '')
const matches = computed(() => {
  const text = searchText(query.value)
  if (!text) return options.value
  return options.value.filter(record => searchText([
    record.id, record.name, record.num == null ? '' : String(record.num).padStart(3, '0'),
  ].join(' ')).includes(text))
})
const preserveSelection = computed(() => selected.value && !matches.value.some(record => record.id === props.modelValue))
const optionLabel = record => record.num == null ? record.name : `#${String(record.num).padStart(3, '0')} · ${record.name}`
const kindLabels = { base: 'Base species', alternate: 'Alternate form', cosmetic: 'Cosmetic form', 'battle-only': 'Battle form' }
const stats = [['hp', 'HP'], ['atk', 'Attack'], ['def', 'Defense'], ['spa', 'Sp. Atk'], ['spd', 'Sp. Def'], ['spe', 'Speed']]

function choose(event) {
  const id = event.target.value
  if (id === props.modelValue || !options.value.some(record => record.id === id)) return
  emit('update:modelValue', id)
  emit('change', id)
}
</script>

<template>
  <div class="roster-picker">
    <label class="picker-label" :for="controlId">{{ label }}</label>
    <input v-model="query" class="picker-control" type="search" placeholder="Search name, ID or Pokédex number"
      :aria-label="`Search ${label.toLowerCase()}`" :aria-controls="controlId" :aria-describedby="`${controlId}-results`" autocomplete="off">
    <select :id="controlId" class="picker-control" :value="modelValue" @change="choose">
      <optgroup v-if="preserveSelection" label="Current selection">
        <option :value="selected.id">{{ optionLabel(selected) }}</option>
      </optgroup>
      <option v-for="record in matches" :key="record.id" :value="record.id">{{ optionLabel(record) }}</option>
    </select>
    <p :id="`${controlId}-results`" class="picker-results" aria-live="polite">
      {{ matches.length ? `${matches.length} ${includeShapes ? 'options' : 'Pokémon'} found` : 'No matches. Current selection is unchanged.' }}
    </p>
    <details v-if="selected" class="reference-details">
      <summary>{{ selected.kind === 'shape' ? 'Test shape details' : 'Pokémon reference details' }}</summary>
      <p v-if="selected.kind === 'shape'">A geometric fixture for checking effect placement.</p>
      <template v-else>
        <p class="reference-heading">{{ optionLabel(selected) }}</p>
        <p>{{ kindLabels[selected.kind] || selected.kind }} · Species introduced in Gen {{ selected.speciesGeneration }}</p>
        <p v-if="selected.forme">Form: {{ selected.forme }}</p>
        <div class="reference-types" aria-label="Types">
          <span v-for="type in selected.types" :key="type">{{ type }}</span>
        </div>
        <p><strong>Abilities:</strong> {{ selected.abilities.join(', ') }}</p>
        <p class="stats-heading">Base stats</p>
        <dl class="base-stats">
          <div v-for="[key, title] in stats" :key="key"><dt>{{ title }}</dt><dd>{{ selected.baseStats[key] }}</dd></div>
        </dl>
        <p class="reference-note">Reference data only. Preview HP and damage use fixed samples.</p>
      </template>
    </details>
  </div>
</template>

<style scoped>
.roster-picker { flex: 1 1 230px; align-self: flex-start; min-width: 0; max-width: 100%; display: grid; gap: 7px; color: #bccab4; font-size: 14px; }
.roster-picker .picker-label { display: block; flex: none; min-width: 0; margin: 0; }
.roster-picker .picker-control { box-sizing: border-box; width: 100%; min-width: 0; padding: 9px; font: inherit; background: #28382f; color: #ecf0e6; border: 1px solid #586c52; border-radius: 6px; }
.roster-picker .picker-control::placeholder { color: #a8b7a1; }
.roster-picker .picker-control:focus-visible, .reference-details summary:focus-visible { outline: 3px solid #ecbe79; outline-offset: 3px; }
.picker-results { color: #a9b7a2; font-size: 12px; line-height: 1.4; min-height: 17px; }
.reference-details { padding: 10px 12px; border: 1px solid #40523e; border-radius: 6px; font-size: 12px; line-height: 1.5; }
.reference-details summary { cursor: pointer; color: #d1ddc5; }
.reference-details p { margin-top: 8px; overflow-wrap: anywhere; }
.reference-heading, .stats-heading { color: #e1e9d7; font-weight: 600; }
.reference-types { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.reference-types span { padding: 2px 7px; background: #344630; border: 1px solid #52694a; border-radius: 4px; color: #dfead4; }
.base-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 7px 0 0; font-variant-numeric: tabular-nums; }
.base-stats div { display: flex; flex-direction: column; }
.base-stats dt { color: #aab9a2; }
.base-stats dd { margin: 0; color: #e1e9d7; font-weight: 600; }
.reference-note { color: #a9b7a2; }
@media (max-width: 700px) { .roster-picker { flex-basis: 100%; } }
</style>
