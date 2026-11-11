<script setup lang="ts">
import { ref } from 'vue'
import EventTable from '../components/EventTable.vue'
import { devices } from '../devices'
import { age } from '../format'
import { panel, setColor } from '../stores/panel'
import type { Colors } from '../types'

const filter = ref('')
const limit = ref(100)
const types = ['granted', 'denied', 'button_press', 'state_change', 'offline', 'alarm']
const colors: { key: keyof Colors; label: string }[] = [
  { key: 'ok', label: 'Dostęp przyznany' },
  { key: 'no', label: 'Odmowa dostępu' },
  { key: 'exp', label: 'Kod wygasły / blokada' },
  { key: 'wait', label: 'Oczekiwanie na kod' },
]
</script>

<template>
  <div class="g c2 split-wide">
    <div class="p">
      <div class="lb">
        <span>Dziennik zdarzeń</span>
        <div class="inline-fields">
          <select v-model="filter" aria-label="Typ zdarzenia"><option value="">Wszystkie</option><option v-for="type in types" :key="type">{{ type }}</option></select>
          <select v-model.number="limit" aria-label="Limit zdarzeń"><option :value="100">100</option><option :value="500">500</option></select>
        </div>
      </div>
      <EventTable :limit="limit" :filter="filter" />
    </div>
    <div class="p">
      <div class="lb">Sygnalizacja czytnika</div>
      <label v-for="{ key, label } in colors" :key="key" class="row">
        <span>{{ label }}</span><input type="color" :value="panel.colors[key]" @change="setColor(key, ($event.target as HTMLInputElement).value)">
      </label>
      <div class="lb" style="margin:18px 0 6px">Czytnik</div>
      <div class="row">
        <span><span class="d" :class="panel.devices[devices.rfid]?._on ? 'ok' : 'e'"></span>{{ devices.rfid }}</span>
        <span class="mono">{{ age(panel.devices[devices.rfid]?._t) }}</span>
      </div>
      <div class="row"><span>Ostatni UID</span><span class="mono">{{ panel.uid || '—' }}</span></div>
    </div>
  </div>
</template>
