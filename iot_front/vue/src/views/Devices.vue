<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { age, dateTime, number } from '../format'
import { api } from '../services/api'
import { panel } from '../stores/panel'
import type { Device, DeviceState } from '../types'

const inventory = ref<Device[]>([])
const selected = ref('')
const loading = ref(true)
const error = ref(false)
const rows = computed(() => inventory.value.map(device => {
  const live = panel.devices[device.friendly_name]
  return {
    ...device,
    online: live?._on ?? device.is_online,
    battery: live?.battery ?? device.battery_pct,
    quality: live?.linkquality ?? device.link_quality,
    lastSeen: live?._t ? age(live._t) : device.last_seen ? dateTime(device.last_seen) : '—',
    summary: Object.entries(payload(live))
      .filter(([key, value]) => typeof value !== 'object' && !['battery', 'linkquality'].includes(key))
      .map(([key, value]) => key + '=' + (typeof value === 'number' ? number(value, value % 1 ? 1 : 0) : value))
      .join(' '),
  }
}))
const raw = computed(() => {
  const live = panel.devices[selected.value]
  return live ? JSON.stringify(payload(live), null, 2) : ''
})

function payload(device?: DeviceState) {
  return Object.fromEntries(Object.entries(device ?? {}).filter(([key]) => !key.startsWith('_')))
}

onMounted(async () => {
  try {
    inventory.value = await api.devices()
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="p">
    <div class="lb"><span>Urządzenia Zigbee</span><span v-if="!loading && !error">{{ rows.length }} urządzeń</span></div>
    <p v-if="loading || error" class="field-status">{{ loading ? 'ładowanie…' : 'Błąd pobierania urządzeń' }}</p>
    <div v-else class="tw">
      <table>
        <thead><tr><th>Urządzenie</th><th>Typ</th><th>Model</th><th>Status</th><th>Bat.</th><th>LQI</th><th>Odczyt</th><th>Dane</th></tr></thead>
        <tbody>
          <tr v-for="row in rows" :key="row.friendly_name">
            <td><span class="d" :class="row.online ? 'ok' : 'e'"></span><button class="device-name text-button" @click="selected = row.friendly_name">{{ row.friendly_name }}</button></td>
            <td>{{ row.type }}</td><td>{{ row.model }}</td><td>{{ row.online ? 'online' : 'offline' }}</td>
            <td>{{ row.battery == null ? '—' : row.battery + ' %' }}</td><td>{{ row.quality ?? '—' }}</td>
            <td>{{ row.lastSeen }}</td><td class="mono">{{ row.summary }}</td>
          </tr>
          <tr v-if="!rows.length"><td colspan="8" class="field-status">brak urządzeń</td></tr>
        </tbody>
      </table>
    </div>
  </div>
  <div v-if="selected" class="p" style="margin-top:16px">
    <div class="lb"><span>Surowy payload: {{ selected }}</span><button @click="selected = ''">Zamknij</button></div>
    <pre v-if="raw" class="mono raw-payload">{{ raw }}</pre>
    <p v-else class="field-status">Brak komunikatów odebranych w tej sesji</p>
  </div>
</template>
