<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { api } from '../services/api'
import { clock, dateTime, dayMonth, hoursAgo, number } from '../format'

const props = defineProps<{
  title: string; device: string; metric: string; unit: string; hours: number; from?: string; to?: string
}>()
const points = ref<{ time: number; value: number }[]>([])
const loading = ref(false)
const error = ref('')
const daily = ref(false)
const hover = ref<number | null>(null)
const timespan = computed(() => (points.value.at(-1)?.time ?? 0) - (points.value[0]?.time ?? 0) || 1)
const limits = computed(() => {
  const values = points.value.map(point => point.value)
  return { low: Math.min(...values), high: Math.max(...values) }
})
const x = (time: number) => (time - points.value[0].time) / timespan.value
const line = computed(() => {
  const { low, high } = limits.value
  const padding = (high - low || 1) * 0.1
  return points.value.map(point => {
    const y = 150 - (point.value - low + padding) / (high - low + 2 * padding) * 150
    return (x(point.time) * 600).toFixed(1) + ',' + y.toFixed(1)
  }).join(' ')
})
const labels = computed(() => {
  const format = daily.value ? dayMonth : clock
  return [points.value[0], points.value[Math.floor(points.value.length / 2)], points.value.at(-1)]
    .map(point => point ? format(point.time) : '')
})
const active = computed(() => hover.value == null ? null : points.value[hover.value])

watch(() => [props.hours, props.from, props.to, props.device, props.metric], async (_, __, onCleanup) => {
  let current = true
  onCleanup(() => { current = false })
  hover.value = null
  points.value = []
  error.value = ''
  let from = props.hours ? hoursAgo(props.hours) : new Date(props.from + 'T00:00:00')
  let to = props.hours ? new Date() : new Date(props.to + 'T23:59:59')
  if (!Number.isFinite(+from) || !Number.isFinite(+to)) {
    loading.value = false
    error.value = 'Wybierz obie daty'
    return
  }
  if (from > to) [from, to] = [to, from]
  daily.value = +to - +from > 1.5 * 86400000
  loading.value = true
  try {
    const result = await api.history(new URLSearchParams({
      device: props.device, key: props.metric, from: from.toISOString(), to: to.toISOString(),
      agg: daily.value ? 'hour' : 'raw',
    }))
    if (current) points.value = result.map(point => ({ time: +new Date(point.time), value: +point.value }))
      .filter(point => Number.isFinite(point.time) && Number.isFinite(point.value))
      .sort((a, b) => a.time - b.time)
  } catch {
    if (current) error.value = 'Błąd pobierania pomiarów'
  } finally {
    if (current) loading.value = false
  }
}, { immediate: true })

function track(event: PointerEvent) {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const time = points.value[0].time + (event.clientX - rect.left) / rect.width * timespan.value
  let nearest = 0
  points.value.forEach((point, index) => {
    if (Math.abs(point.time - time) < Math.abs(points.value[nearest].time - time)) nearest = index
  })
  hover.value = nearest
}
</script>

<template>
  <div class="p">
    <div class="lb">
      <span>{{ title }}</span>
      <span>{{ unit }}<template v-if="points.length"> · {{ number(limits.low) }}–{{ number(limits.high) }}</template></span>
    </div>
    <div v-if="loading || !points.length" class="chart-empty">{{ loading ? 'ładowanie…' : error || 'brak danych' }}</div>
    <template v-else>
      <div class="cw" @pointermove="track" @pointerleave="hover = null">
        <svg viewBox="0 0 600 150" preserveAspectRatio="none" class="ch" role="img" :aria-label="title">
          <line v-for="y in [0, 50, 100, 150]" :key="y" x1="0" x2="600" :y1="y" :y2="y" />
          <polyline :points="line" />
          <circle v-if="points.length === 1" cx="0" cy="75" r="3" fill="currentColor" />
        </svg>
        <template v-if="active">
          <div class="vl" :style="{ display: 'block', left: x(active.time) * 100 + '%' }"></div>
          <div class="tip" :style="{ display: 'block', left: x(active.time) * 100 + '%', transform: x(active.time) > 0.6 ? 'translateX(-100%)' : 'none' }">{{ dateTime(active.time) }} · {{ number(active.value, 2) }} {{ unit }}</div>
        </template>
      </div>
      <div class="ax"><span v-for="(label, index) in labels" :key="index">{{ label }}</span></div>
    </template>
  </div>
</template>
