<script setup lang="ts">
import { computed, onUnmounted, ref, watchEffect } from 'vue'
import { devices } from '../devices'
import { age, number, valueText } from '../format'
import type { ControlAction, Mode, Scene } from '../services/protocol'
import { command, control, errorMessage, matchingValue, notify, panel, simulator } from '../stores/panel'

const strip = computed(() => panel.devices[devices.strip])
const bulb = computed(() => panel.devices[devices.bulb])
const inputs = [
  { name: devices.button, pattern: /^action$/ },
  { name: devices.remote, pattern: /^action$/ },
  { name: devices.occ, pattern: /^occupancy$/ },
  { name: devices.alarm, pattern: /alarm|vibration/i },
]
const effects = ['blink', 'breathe', 'okay', 'channel_change', 'finish_effect', 'stop_effect']
const outlets = ['l1', 'l2', 'l3'] as const
const modes: Mode[] = ['AUTO', 'ON', 'OFF']
const scenes: Scene[] = ['WORK', 'NIGHT', 'ECO']
const automation = computed(() => panel.snapshot?.automation)
const busy = ref(false)
const waitingFor = ref<(() => boolean) | null>(null)
const controlDisabled = computed(() => !simulator &&
  (busy.value || waitingFor.value !== null || panel.snapshot?.transport.mqtt !== 'connected'))
let timer = 0
let active = true

watchEffect(() => {
  if (waitingFor.value?.()) {
    waitingFor.value = null
    window.clearTimeout(timer)
  }
})
onUnmounted(() => {
  active = false
  window.clearTimeout(timer)
})

async function run(action: ControlAction, matches?: () => boolean) {
  if (controlDisabled.value) return
  busy.value = true
  try {
    const response = await control(action)
    if (!active) return
    if (response.type === 'CONTROL_APPLIED') {
      notify('Zapisano ustawienie automatyki')
    } else if (!matches) {
      notify('Polecenie przyjęte do realizacji')
    } else if (!matches()) {
      waitingFor.value = matches
      timer = window.setTimeout(() => {
        waitingFor.value = null
        notify('Brak oczekiwanego odczytu z urządzenia')
      }, 10000)
    }
  } catch (error) {
    if (active) notify(errorMessage(error))
  } finally {
    busy.value = false
  }
}

function nextPower(value: unknown) {
  if (value === 'ON') return 'OFF'
  if (value === 'OFF') return 'ON'
}

function toggleOutlet(outlet: typeof outlets[number]) {
  const key = 'state_' + outlet
  if (simulator) return command(devices.strip, { [key]: 'TOGGLE' })
  const state = nextPower(strip.value?.[key])
  if (!state) return
  const serverOff = outlet === 'l2' && state === 'OFF'
  if (serverOff && !window.confirm('Wyłączyć zasilanie serwera na gnieździe L2?')) return
  void run({ action: 'SET_SOCKET', socket: outlet, state, confirm: serverOff ? 'SERVER_POWER_OFF' : undefined },
    () => strip.value?.[key] === state)
}

function toggleBulb() {
  if (simulator) return command(devices.bulb, { state: 'TOGGLE' })
  const state = nextPower(bulb.value?.state)
  if (state) void run({ action: 'SET_LIGHT', state }, () => bulb.value?.state === state)
}

const bulbHex = computed(() => {
  const color = bulb.value?.color
  const hex = color && typeof color === 'object' && 'hex' in color ? color.hex : bulb.value?.hex
  return typeof hex === 'string' && /^#[0-9a-f]{6}$/i.test(hex) ? hex.toLowerCase() : undefined
})

function inputValue(name: string, pattern: RegExp) {
  const value = matchingValue(panel.devices[name], pattern)
  return value === true ? 'tak' : value === false ? 'nie' : valueText(value)
}

function changeBulb(event: Event, key: 'brightness' | 'color_temp' | 'color') {
  const input = event.target as HTMLInputElement
  if (simulator) return command(devices.bulb, { [key]: key === 'color' ? { hex: input.value } : input.valueAsNumber })
  if (key === 'color') {
    const hex = input.value
    input.value = bulbHex.value ?? '#e0a526'
    void run({ action: 'SET_LIGHT', hex }, () => bulbHex.value === hex.toLowerCase())
  } else if (key === 'brightness') {
    const brightness = input.valueAsNumber
    input.value = String(bulb.value?.brightness ?? 127)
    void run({ action: 'SET_LIGHT', brightness }, () => Number(bulb.value?.brightness) === brightness)
  }
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
      <div v-for="(outlet, index) in outlets" :key="outlet" class="row">
        <span>Gniazdo {{ index + 1 }}</span>
        <button class="tg" :class="{ on: strip?.['state_' + outlet] === 'ON' }" :aria-label="'Gniazdo ' + (index + 1)" :aria-pressed="strip?.['state_' + outlet] === 'ON'" :disabled="controlDisabled || (!simulator && !nextPower(strip?.['state_' + outlet]))" @click="toggleOutlet(outlet)"></button>
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
    <div class="row"><span>Zasilanie</span><button class="tg" :class="{ on: bulb?.state === 'ON' }" aria-label="Zasilanie żarówki" :aria-pressed="bulb?.state === 'ON'" :disabled="controlDisabled || (!simulator && !nextPower(bulb?.state))" @click="toggleBulb"></button></div>
    <label class="row"><span>Jasność</span><input type="range" min="0" max="254" :value="bulb?.brightness ?? 127" :disabled="controlDisabled" @change="changeBulb($event, 'brightness')"></label>
    <label v-if="simulator" class="row"><span>Temperatura barwowa</span><input type="range" min="153" max="500" :value="bulb?.color_temp ?? 300" @change="changeBulb($event, 'color_temp')"></label>
    <label class="row"><span>Kolor</span><input type="color" :value="bulbHex ?? '#e0a526'" :disabled="controlDisabled" @change="changeBulb($event, 'color')"></label>
    <label v-if="simulator" class="row"><span>Efekt</span><select @change="selectEffect"><option value="">-</option><option v-for="effect in effects" :key="effect">{{ effect }}</option></select></label>
  </div>
  <div v-if="automation" class="p">
    <div class="lb">Automatyka</div>
    <div class="row">
      <span>Tryb oświetlenia</span>
      <div class="seg"><button v-for="mode in modes" :key="mode" :class="{ on: automation.lighting_mode === mode }" :disabled="controlDisabled" @click="run({ action: 'SET_LIGHTING_MODE', mode }, () => automation?.lighting_mode === mode)">{{ mode }}</button></div>
    </div>
    <div class="row">
      <span>Tryb wentylacji{{ automation.fan_forced ? ' · wymuszony przez alarm' : '' }}</span>
      <div class="seg"><button v-for="mode in modes" :key="mode" :class="{ on: automation.fan_mode === mode }" :disabled="controlDisabled" @click="run({ action: 'SET_FAN_MODE', mode }, () => automation?.fan_mode === mode)">{{ mode }}</button></div>
    </div>
    <div class="row">
      <span>Sceny</span>
      <div class="seg"><button v-for="scene in scenes" :key="scene" :disabled="controlDisabled" @click="run({ action: 'SCENE', scene })">{{ scene }}</button></div>
    </div>
    <div class="row"><span>Sygnalizacja</span><button :disabled="controlDisabled" @click="run({ action: 'MUTE_ALARM' })">Wycisz alarm</button></div>
  </div>
  <p v-if="busy || waitingFor" class="field-status" role="status">{{ busy ? 'Wysyłanie polecenia…' : 'Oczekiwanie na aktualizację stanu…' }}</p>
</template>
