<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import Tile from '../components/Tile.vue'
import HistoryChart from '../components/HistoryChart.vue'
import EventTable from '../components/EventTable.vue'
import { dailyHeatKey, devices } from '../devices'
import { hoursAgo, number } from '../format'
import { api } from '../services/api'
import { matchingValue, panel } from '../stores/panel'

const environment = computed(() => panel.devices[devices.temp])
const presence = computed(() => panel.devices[devices.occ]?.occupancy)
const lastHeat = ref<number>()
const heat = computed(() => lastHeat.value ?? matchingValue(panel.devices[devices.heat], dailyHeatKey))

onMounted(async () => {
  try {
    lastHeat.value = (await api.heat(hoursAgo(72).toISOString())).at(-1)?.energy_used_kwh
  } catch {
    // The tile can still use the current reading from the socket.
  }
})
</script>

<template>
  <div class="g c4">
    <Tile label="Temperatura" :value="number(environment?.temperature)" unit="°C" :detail="devices.temp" />
    <Tile label="Wilgotność" :value="number(environment?.humidity, 0)" unit="%" />
    <Tile label="Ciepłomierz" :value="number(heat)" unit="kWh" detail="zużycie dziś" />
    <Tile label="Obecność" :value="presence == null ? '—' : presence ? 'Obecność' : 'Brak ruchu'" :detail="devices.occ" />
  </div>
  <div class="g c2">
    <HistoryChart title="Temperatura 24 h" :device="devices.temp" metric="temperature" unit="°C" :hours="24" />
    <HistoryChart title="Wilgotność 24 h" :device="devices.temp" metric="humidity" unit="%" :hours="24" />
  </div>
  <div class="p">
    <div class="lb">
      <span>Ostatnie zdarzenia</span>
      <RouterLink v-if="(panel.session?.role ?? 0) >= 2" to="/zdarzenia">wszystkie →</RouterLink>
    </div>
    <EventTable :limit="5" />
  </div>
</template>
