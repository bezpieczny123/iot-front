<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { dateTime } from '../format'
import { api } from '../services/api'
import { panel } from '../stores/panel'
import type { EventRow } from '../types'

const props = defineProps<{ limit: number; filter?: string }>()
const rows = ref<EventRow[]>([])
const loading = ref(false)
const error = ref(false)
const visible = computed(() => rows.value.filter(row => !props.filter || [row.source, row.type].includes(props.filter)))
const badge = (type: string) => type === 'granted' || type === 'OK' ? 'OK' : type === 'denied' || type === 'ODMOWA' ? 'ODMOWA' : type

watch(() => [props.limit, panel.eventsVersion], async (_, __, onCleanup) => {
  let current = true
  onCleanup(() => { current = false })
  loading.value = true
  error.value = false
  try {
    const result = await api.events(props.limit)
    if (current) rows.value = result
  } catch {
    if (current) error.value = true
  } finally {
    if (current) loading.value = false
  }
}, { immediate: true })
</script>

<template>
  <p v-if="error" class="field-status">Błąd pobierania zdarzeń</p>
  <p v-else-if="loading && !rows.length" class="field-status">ładowanie…</p>
  <div v-else class="sc">
    <table>
      <thead><tr><th>Czas</th><th>Źródło</th><th>Typ</th><th>Obiekt</th><th>Szczegóły</th></tr></thead>
      <tbody>
        <tr v-for="(row, index) in visible" :key="index">
          <td class="m">{{ dateTime(row.time) }}</td><td>{{ row.source }}</td>
          <td><span class="tag" :class="{ e: badge(row.type) === 'ODMOWA', w: !['OK', 'ODMOWA'].includes(badge(row.type)) }">{{ badge(row.type) }}</span></td>
          <td>{{ row.subject }}</td><td>{{ row.details }}</td>
        </tr>
        <tr v-if="!visible.length"><td colspan="5" class="field-status">brak danych</td></tr>
      </tbody>
    </table>
  </div>
</template>
