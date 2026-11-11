<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import Tile from '../components/Tile.vue'
import { dailyHeatKey, devices } from '../devices'
import { age, dayMonth, hoursAgo, number } from '../format'
import { api } from '../services/api'
import { matchingValue, panel } from '../stores/panel'
import type { HeatReading } from '../types'

const readings = ref<HeatReading[]>([])
const loading = ref(true)
const failed = ref(false)
const meter = computed(() => panel.devices[devices.heat])
const today = computed(() => readings.value.at(-1)?.energy_used_kwh ?? matchingValue(meter.value, dailyHeatKey))
const maximum = computed(() => Math.max(1, ...readings.value.map(row => row.energy_used_kwh)))

onMounted(async () => {
  try {
    readings.value = (await api.heat(hoursAgo(720).toISOString())).sort((a, b) => a.day.localeCompare(b.day))
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="g c4">
    <Tile label="Dziś" :value="number(today)" unit="kWh" />
    <Tile label="Wczoraj" :value="number(readings.at(-2)?.energy_used_kwh)" unit="kWh" />
    <Tile label="Bateria modułu" :value="number(meter?.battery, 0)" unit="%" :detail="'ostatni odczyt: ' + age(meter?._t)" />
    <Tile label="Odczyty" :value="readings.length" detail="ostatnie 30 dni" />
  </div>
  <div class="p">
    <div class="lb"><span>Dzienne zużycie</span><span>kWh · 30 dni</span></div>
    <p v-if="loading || !readings.length" class="field-status">{{ loading ? 'ładowanie…' : failed ? 'Błąd pobierania danych' : 'brak danych z ciepłomierza' }}</p>
    <template v-else>
      <div class="bars">
        <i v-for="row in readings" :key="row.day" :style="{ height: row.energy_used_kwh / maximum * 100 + '%' }" :title="dayMonth(row.day) + ': ' + number(row.energy_used_kwh) + ' kWh'"></i>
      </div>
      <div class="ax"><span>{{ dayMonth(readings[0].day) }}</span><span>{{ dayMonth(readings[readings.length - 1].day) }}</span></div>
    </template>
  </div>
</template>
