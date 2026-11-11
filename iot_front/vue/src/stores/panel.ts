import { reactive, ref } from 'vue'
import { devices, uidKey } from '../devices'
import { isMock } from '../services/api'
import { createSimulator } from '../services/mock'
import { connectSocket } from '../services/socket'
import type { Colors, DeviceState, LiveMessage, Payload, Role } from '../types'

const colors: Colors = { ok: '#5aa86b', no: '#d4573f', exp: '#e0a526', wait: '#4f8fd1' }
try {
  const saved = JSON.parse(localStorage.getItem('col') || '{}')
  for (const key of Object.keys(colors) as (keyof Colors)[]) {
    if (typeof saved?.[key] === 'string' && /^#[0-9a-f]{6}$/i.test(saved[key])) colors[key] = saved[key]
  }
} catch {
  // Settings may be unavailable in private browsing.
}

export const panel = reactive({
  devices: Object.create(null) as Record<string, DeviceState | undefined>,
  uid: null as string | null,
  session: null as { username: string; role: Role } | null,
  online: false,
  eventsVersion: 0,
  colors,
})
export const notice = ref('')
let noticeTimer = 0
let eventTimer = 0

export function notify(message: string) {
  notice.value = message
  window.clearTimeout(noticeTimer)
  noticeTimer = window.setTimeout(() => { notice.value = '' }, 1800)
}

function receive(message: LiveMessage) {
  if ('type' in message) {
    if (message.type === 'auth') {
      const level = Math.max(1, Math.min(3, Math.trunc(message.level) || 1)) as Role
      panel.session = { username: message.username, role: level }
    } else {
      window.clearTimeout(eventTimer)
      eventTimer = window.setTimeout(() => { panel.eventsVersion++ }, 600)
    }
    return
  }

  const name = message.topic.replace(/^zigbee2mqtt\//, '')
  const payload = message.payload
  if (name.endsWith('/availability')) {
    const device = name.slice(0, -'/availability'.length)
    const state = payload && typeof payload === 'object' && 'state' in payload ? payload.state : payload
    panel.devices[device] = { ...panel.devices[device], _on: state === 'online' }
  } else if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    panel.devices[name] = { ...panel.devices[name], ...payload, _t: Date.now(), _on: true }
    if (name === devices.rfid) {
      const uid = matchingValue(payload as Payload, uidKey)
      if (uid) panel.uid = String(uid)
    }
  }
}

export function matchingValue(state: Payload | undefined, pattern: RegExp) {
  const entry = Object.entries(state ?? {}).find(([key]) => !key.startsWith('_') && pattern.test(key))
  return entry?.[1]
}

export const simulator = isMock ? createSimulator(receive) : undefined
const send = isMock ? undefined : connectSocket(receive, online => { panel.online = online })
if (simulator) panel.online = true

export function command(device: string, payload: Payload) {
  const message = { type: 'cmd' as const, device, payload }
  if (simulator) {
    simulator.command(message)
    return true
  }
  if (send?.(message)) return true
  notify('Brak połączenia z serwerem')
  return false
}

export function setColor(key: keyof Colors, value: string) {
  panel.colors[key] = value
  try {
    localStorage.setItem('col', JSON.stringify(panel.colors))
  } catch {
    // The reader can still receive the settings.
  }
  if (command(devices.rfid, { colors: { ...panel.colors } })) notify('Wysłano ustawienia koloru')
}

export function logout() {
  panel.session = null
  panel.uid = null
}
