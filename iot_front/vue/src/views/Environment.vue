<script setup lang="ts">
import { computed, ref } from 'vue'
import HistoryChart from '../components/HistoryChart.vue'
import { devices } from '../devices'
import { age, dateInput, hoursAgo, number } from '../format'
import { panel } from '../stores/panel'

const ranges = [{ hours: 24, title: '24 h' }, { hours: 168, title: '7 dni' }, { hours: 720, title: '30 dni' }, { hours: 0, title: 'własny' }]
const hours = ref(24)
const from = ref(dateInput(hoursAgo(168)))
const to = ref(dateInput())
const sensors = computed(() => Object.entries(panel.devices).flatMap(([name, data]) =>
  data && (data.temperature != null || data.humidity != null) ? [{ name, data }] : []))
</script>

<template>
  <div class="inline-fields form-panel">
    <div class="seg">
      <button v-for="range in ranges" :key="range.hours" :class="{ on: hours === range.hours }" @click="hours = range.hours">{{ range.title }}</button>
    </div>
    <template v-if="!hours">
      <input v-model="from" type="date" aria-label="Od">
      <input v-model="to" type="date" aria-label="Do">
    </template>
  </div>
  <div class="g c2">
    <HistoryChart title="Temperatura" :device="devices.temp" metric="temperature" unit="°C" :hours="hours" :from="hours ? undefined : from" :to="hours ? undefined : to" />
    <HistoryChart title="Wilgotność" :device="devices.temp" metric="humidity" unit="%" :hours="hours" :from="hours ? undefined : from" :to="hours ? undefined : to" />
  </div>
  <div class="p">
    <div class="lb">Czujniki (na żywo)</div>
    <div class="tw">
      <table>
        <thead><tr><th>Czujnik</th><th>Temp.</th><th>Wilg.</th><th>Bateria</th><th>Odczyt</th></tr></thead>
        <tbody>
          <tr v-for="{ name, data } in sensors" :key="name">
            <td><span class="d" :class="data._on ? 'ok' : 'e'"></span>{{ name }}</td>
            <td>{{ number(data.temperature) }} °C</td><td>{{ number(data.humidity, 0) }} %</td>
            <td>{{ data.battery == null ? '—' : data.battery + ' %' }}</td><td>{{ age(data._t) }}</td>
          </tr>
          <tr v-if="!sensors.length"><td colspan="5" class="field-status">brak danych</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
