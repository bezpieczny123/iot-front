import { reactive, ref } from 'vue'
import { devices, uidKey } from '../devices'
import { createSimulator, isMock } from '../services/mock'
import { SocketError, type AuthState, type ControlAction, type DataResponse, type Envelope, type Request, type Snapshot } from '../services/protocol'
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
  snapshot: null as Snapshot | null,
  access: 'checking' as 'checking' | 'locked' | 'unlocked',
  expiresAt: null as string | null,
  connectionError: '',
  online: false,
  eventsVersion: 0,
  colors,
})
export const notice = ref('')
let noticeTimer = 0
let eventTimer = 0
let lastEventRefresh = 0
let accessGeneration = 0
let authRevision = 0
let connectionGeneration = 0
let subscription: Promise<void> | undefined
let subscribed = false
let snapshotTime = -Infinity

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
const send = isMock ? undefined : connectSocket(receiveLive, connectionChanged)
if (simulator) panel.online = true

export function canView(role: number, demoOnly = false) {
  return isMock
    ? role <= (panel.session?.role ?? 0)
    : !demoOnly && panel.access === 'unlocked' && panel.snapshot !== null
}

function clearAccess(state: 'checking' | 'locked') {
  accessGeneration++
  authRevision++
  panel.access = state
  panel.expiresAt = null
  panel.snapshot = null
  panel.devices = Object.create(null)
  lastEventRefresh = 0
  snapshotTime = -Infinity
}

function connectionChanged(online: boolean) {
  panel.online = online
  panel.connectionError = ''
  connectionGeneration++
  subscription = undefined
  subscribed = false
  clearAccess('checking')
  if (online) void loadAccess()
}

async function loadAccess() {
  if (!send) return
  const revision = authRevision
  try {
    const response = await send<AuthState>({ action: 'GET_AUTH_STATE' }, 'AUTH_STATE')
    if (revision === authRevision) updateAccess(response)
  } catch (error) {
    if (revision !== authRevision) return
    panel.connectionError = errorMessage(error)
    window.setTimeout(() => { if (revision === authRevision) void loadAccess() }, 3000)
  }
}

function receiveLive(message: Envelope) {
  if (message.type === 'AUTH_STATE') updateAccess(message as AuthState)
  if (message.type === 'SYSTEM_LOCKED') clearAccess('locked')
  if (message.type === 'SNAPSHOT') applySnapshot(message as DataResponse<Snapshot>)
  if (message.type === 'RFID_RESULT' && message.code === 'ACCESS_DENIED') {
    notify('Karta nie ma dostępu')
    panel.eventsVersion++
  }
  if (message.type === 'CONTROL_DENIED' && message.code === 'AUTH_REQUIRED') {
    notify('Sterowanie wymaga odblokowania kartą')
  }
}

function updateAccess(message: AuthState) {
  if (typeof message.unlocked !== 'boolean') return
  panel.connectionError = ''
  authRevision++
  if (!message.unlocked) {
    clearAccess('locked')
    return
  }
  panel.access = 'unlocked'
  panel.expiresAt = message.expires_at
  const generation = accessGeneration
  if (!panel.snapshot) {
    void requestLive<DataResponse<Snapshot>>({ action: 'GET_SNAPSHOT' }, 'SNAPSHOT')
      .then(applySnapshot)
      .catch(error => {
        if (generation === accessGeneration && !panel.snapshot) panel.connectionError = errorMessage(error)
      })
  }
  subscribe()
}

function subscribe() {
  if (!send || panel.access !== 'unlocked' || subscribed || subscription) return
  const connection = connectionGeneration
  const generation = accessGeneration
  subscription = send({ action: 'SUBSCRIBE' }, 'SUBSCRIBED')
    .then(() => { if (connection === connectionGeneration) subscribed = true })
    .catch(error => {
      if (connection !== connectionGeneration) return
      if (generation === accessGeneration && handleAccessError(error)) return
      if (generation === accessGeneration) notify(errorMessage(error))
      window.setTimeout(() => { if (connection === connectionGeneration) subscribe() }, 3000)
    })
    .finally(() => { if (connection === connectionGeneration) subscription = undefined })
}

function applySnapshot({ data: snapshot, timestamp }: DataResponse<Snapshot>) {
  if (panel.access !== 'unlocked' || !snapshot?.access?.unlocked) return
  if (!Array.isArray(snapshot.devices) || !Array.isArray(snapshot.entities)) return
  const time = Date.parse(timestamp)
  if (!Number.isFinite(time) || time < snapshotTime) return
  snapshotTime = time
  const state: typeof panel.devices = Object.create(null)
  const names = new Map<string, string>()
  for (const device of snapshot.devices) {
    names.set(String(device.id), device.friendly_name)
    state[device.friendly_name] = {
      _on: device.availability === 'unknown' ? undefined : device.availability === 'online',
      _t: Date.parse(device.last_seen ?? '') || undefined,
      battery: device.battery_pct,
      linkquality: device.link_quality,
    }
  }
  for (const entity of snapshot.entities) {
    const name = names.get(String(entity.device_id))
    const device = name === undefined ? undefined : state[name]
    if (!device) continue
    const value = entity.state
    if (value != null && (typeof value !== 'object' || Object.keys(value).length > 0)) {
      device[entity.source_key] = typeof value === 'object' && Object.hasOwn(value, entity.source_key)
        ? (value as Payload)[entity.source_key]
        : value
    }
    const updated = Date.parse(entity.state_updated_at ?? entity.latest_time ?? '')
    if (updated > (device._t ?? 0)) device._t = updated
  }
  panel.devices = state
  panel.snapshot = snapshot
  panel.expiresAt = snapshot.access.expires_at
  panel.connectionError = ''
  if (Date.now() - lastEventRefresh >= 10000) {
    lastEventRefresh = Date.now()
    panel.eventsVersion++
  }
}

function handleAccessError(error: unknown) {
  if (!(error instanceof SocketError) || !['AUTH_REQUIRED', 'SYSTEM_REVOKED'].includes(error.code)) return false
  clearAccess('locked')
  return true
}

export async function requestLive<T extends Envelope>(body: Request, ...expected: string[]): Promise<T> {
  if (!send || panel.access !== 'unlocked') throw new SocketError('AUTH_REQUIRED')
  const generation = accessGeneration
  try {
    const response = await send<T>(body, ...expected)
    if (generation !== accessGeneration) throw new SocketError('ACCESS_CHANGED')
    return response
  } catch (error) {
    if (generation === accessGeneration) handleAccessError(error)
    throw error
  }
}

const errors: Record<string, string> = {
  AUTH_REQUIRED: 'Zbliż kartę do czytnika',
  SYSTEM_REVOKED: 'Dostęp został cofnięty',
  DISCONNECTED: 'Brak połączenia z serwerem',
  TIMEOUT: 'Serwer nie odpowiedział na żądanie',
  MQTT_OFFLINE: 'Broker MQTT jest niedostępny',
  DATABASE_ERROR: 'Błąd bazy danych',
  DEVICE_NOT_REGISTERED: 'Urządzenie nie jest zarejestrowane',
  ENTITY_NOT_REGISTERED: 'Brak zarejestrowanego pomiaru',
  SERVER_CONFIRMATION_REQUIRED: 'Potwierdź wyłączenie zasilania serwera',
  RATE_LIMIT: 'Zbyt wiele żądań, spróbuj ponownie',
  INVALID_RANGE: 'Niepoprawny zakres dat',
  CLIENT_LIMIT: 'Osiągnięto limit klientów WebSocket',
}

export function errorMessage(error: unknown) {
  return error instanceof SocketError
    ? errors[error.code] ?? 'Błąd serwera: ' + error.code
    : 'Nie udało się wykonać operacji'
}

export function command(device: string, payload: Payload) {
  simulator?.command({ type: 'cmd', device, payload })
}

export async function control(action: ControlAction) {
  return requestLive(action, 'COMMAND_QUEUED', 'CONTROL_APPLIED')
}

export function setColor(key: keyof Colors, value: string) {
  panel.colors[key] = value
  try {
    localStorage.setItem('col', JSON.stringify(panel.colors))
  } catch {
    // The simulator can still receive the settings.
  }
  command(devices.rfid, { colors: { ...panel.colors } })
  notify('Zapisano ustawienia koloru')
}

export async function logout() {
  if (isMock) {
    panel.session = null
    panel.uid = null
    return
  }
  const generation = accessGeneration
  try {
    await requestLive({ action: 'LOCK' }, 'SYSTEM_LOCKED')
    if (generation === accessGeneration) clearAccess('locked')
  } catch (error) {
    if (generation === accessGeneration) notify(errorMessage(error))
  }
}
