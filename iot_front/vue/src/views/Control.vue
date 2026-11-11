<script setup lang="ts">
import { computed } from 'vue'
import { devices } from '../devices'
import { age, number, valueText } from '../format'
import { command, matchingValue, panel } from '../stores/panel'

const strip = computed(() => panel.devices[devices.strip])
const bulb = computed(() => panel.devices[devices.bulb])
const inputs = [
  { name: devices.button, pattern: /^action$/ },
  { name: devices.remote, pattern: /^action$/ },
  { name: devices.occ, pattern: /^occupancy$/ },
  { name: devices.alarm, pattern: /alarm|vibration/i },
]
const effects = ['blink', 'breathe', 'okay', 'channel_change', 'finish_effect', 'stop_effect']

function inputValue(name: string, pattern: RegExp) {
  const value = matchingValue(panel.devices[name], pattern)
  return value === true ? 'tak' : value === false ? 'nie' : valueText(value)
}

function changeBulb(event: Event, key: 'brightness' | 'color_temp' | 'color') {
  const input = event.target as HTMLInputElement
  command(devices.bulb, { [key]: key === 'color' ? { hex: input.value } : input.valueAsNumber })
}

function selectEffect(event: Event) {
  const select = event.target as HTMLSelectElement
  if (select.value) command(devices.bulb, { effect: select.value })
  select.value = ''
}
</script>

<template>
  <div class="g c2">
    <div class="p">
      <div class="lb"><span>Listwa ({{ devices.strip }})</span><span v-if="strip?.power != null">{{ number(strip.power) }} W</span></div>
      <div v-for="outlet in 3" :key="outlet" class="row">
        <span>Gniazdo {{ outlet }}</span>
        <button class="tg" :class="{ on: strip?.['state_l' + outlet] === 'ON' }" :aria-label="'Gniazdo ' + outlet" :aria-pressed="strip?.['state_l' + outlet] === 'ON'" @click="command(devices.strip, { ['state_l' + outlet]: 'TOGGLE' })"></button>
      </div>
      <div class="row"><span>Napięcie · prąd · energia</span><span class="mono">{{ number(strip?.voltage, 0) }} V · {{ number(strip?.current, 2) }} A · {{ number(strip?.energy, 2) }} kWh</span></div>
      <div class="note">Przełącznik zmienia się po potwierdzeniu stanu z Zigbee2MQTT.</div>
    </div>
    <div class="p">
      <div class="lb">Wejścia i czujniki</div>
      <div v-for="{ name, pattern } in inputs" :key="name" class="row">
        <span><span class="d" :class="panel.devices[name]?._on ? 'ok' : 'e'"></span>{{ name }}</span>
        <span class="mono">{{ inputValue(name, pattern) }} · {{ age(panel.devices[name]?._t) }}</span>
      </div>
    </div>
  </div>
  <div class="p">
    <div class="lb"><span>Oświetlenie ({{ devices.bulb }})</span><span v-if="bulb?.linkquality != null">lqi {{ bulb.linkquality }}</span></div>
    <div class="row"><span>Zasilanie</span><button class="tg" :class="{ on: bulb?.state === 'ON' }" aria-label="Zasilanie żarówki" :aria-pressed="bulb?.state === 'ON'" @click="command(devices.bulb, { state: 'TOGGLE' })"></button></div>
    <label class="row"><span>Jasność</span><input type="range" min="0" max="254" :value="bulb?.brightness ?? 127" @change="changeBulb($event, 'brightness')"></label>
    <label class="row"><span>Temperatura barwowa</span><input type="range" min="153" max="500" :value="bulb?.color_temp ?? 300" @change="changeBulb($event, 'color_temp')"></label>
    <label class="row"><span>Kolor</span><input type="color" value="#e0a526" @change="changeBulb($event, 'color')"></label>
    <label class="row"><span>Efekt</span><select @change="selectEffect"><option value="">—</option><option v-for="effect in effects" :key="effect">{{ effect }}</option></select></label>
  </div>
</template>
