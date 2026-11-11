import { devices } from '../devices'
import type { AccessRow, Card, Command, Device, EventRow, HeatReading, HistoryPoint, LiveMessage, NewCard, NewUser, Payload, Role, User, Validity } from '../types'

const models = [
  [devices.remote, 'binary_input', '4 button portable remote control'],
  [devices.button, 'binary_input', 'Sonoff SNZB-01P'],
  [devices.temp, 'env_sensor', 'NOUS E5'],
  [devices.alarm, 'env_sensor', 'Vibration alarm sensor'],
  [devices.strip, 'binary_output', 'NOUS A11Z'],
  [devices.heat, 'heat_meter', 'własny moduł'],
  [devices.rfid, 'rfid_keypad', 'własny moduł'],
  [devices.occ, 'env_sensor', 'Sonoff SNZB-06P'],
  [devices.air, 'other', 'własny moduł'],
  [devices.bulb, 'light', 'E27 RGB light bulb'],
]

const names = { 1: 'a.nowak', 2: 'j.kowalski', 3: 'admin' }
const hour = 3600000
const day = 24 * hour
const iso = (timestamp: number) => new Date(timestamp).toISOString()
const makeCard = (id: number, body: Partial<Pick<NewCard, 'label' | 'valid_from' | 'valid_to'>>): Card => ({
  id, label: body.label || 'karta', is_active: true,
  valid_from: body.valid_from, valid_to: body.valid_to,
})
const users: User[] = ([3, 2, 1] as const).map((role, i) => ({
  id: i + 1, username: names[role], access_level: role, is_active: true,
  cards: role === 1 ? [] : [makeCard(i + 1, role === 2 ? { valid_to: iso(Date.now() + 30 * day) } : {})],
}))
let cardId = 2
let seed = 7
const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
const events: EventRow[] = [
  ['j.kowalski', 'granted', ''],
  ['a.nowak', 'granted', ''],
  ['nieznana karta', 'denied', 'unknown_card'],
  ['admin', 'granted', ''],
  ['a.nowak', 'denied', 'expired'],
].map(([subject, type, details], i) => ({
  time: iso(Date.now() - i * hour), source: 'dostęp', subject, type, details,
}))

export const mockApi = {
  async history(params: URLSearchParams): Promise<HistoryPoint[]> {
    const from = Date.parse(params.get('from') ?? '')
    const to = Date.parse(params.get('to') ?? '')
    const humidity = params.get('key') === 'humidity'
    const amplitude = humidity ? 5 : 1.3
    return Array.from({ length: 60 }, (_, i) => ({
      time: iso(from + (to - from) * i / 59),
      value: (humidity ? 46 : 22.4) + amplitude * Math.sin(i / 60 * 12) + (random() - 0.5) * amplitude * 0.4,
    }))
  },
  async heat(from: string): Promise<HeatReading[]> {
    const today = new Date().toISOString().slice(0, 10)
    const start = from.slice(0, 10)
    return Array.from({ length: 30 }, (_, i) => ({
      day: iso(Date.parse(today) - (29 - i) * day).slice(0, 10),
      energy_used_kwh: 55 + 15 * Math.sin(i / 4) + random() * 6,
    })).filter(row => row.day >= start)
  },
  async events(limit: number) { return events.slice(0, limit) },
  async access(user: string, from: string, to: string): Promise<AccessRow[]> {
    return events.filter(event => (!user || event.subject === user) &&
      event.time.slice(0, 10) >= from && event.time.slice(0, 10) <= to)
      .map(event => ({
        time: event.time, username: event.subject, granted: event.type === 'granted',
        reason: event.details, reader: devices.rfid,
      }))
  },
  async devices(): Promise<Device[]> {
    return models.map(([friendly_name, type, model]) => ({
      friendly_name, type, model, is_online: true, battery_pct: 90,
      link_quality: 200, last_seen: iso(Date.now()),
    }))
  },
  async users() { return structuredClone(users) },
  async addUser(body: NewUser) {
    if (users.some(user => user.username === body.username)) throw Error('Login już istnieje')
    users.push({
      id: users.length + 1, username: body.username, access_level: body.access_level,
      is_active: true, cards: body.uid ? [makeCard(++cardId, body)] : [],
    })
  },
  async deactivateUser(id: number) { userById(id).is_active = false },
  async setLevel(id: number, role: Role) { userById(id).access_level = role },
  async addCard(id: number, body: NewCard) { userById(id).cards.push(makeCard(++cardId, body)) },
  async deactivateCard(id: number) { cardById(id).is_active = false },
  async setValidity(id: number, body: Validity) { Object.assign(cardById(id), body) },
}

function userById(id: number) {
  const user = users.find(item => item.id === id)
  if (!user) throw Error('Nie znaleziono użytkownika')
  return user
}

function cardById(id: number) {
  const card = users.flatMap(user => user.cards).find(item => item.id === id)
  if (!card) throw Error('Nie znaleziono karty')
  return card
}

export function createSimulator(receive: (message: LiveMessage) => void) {
  const state: Record<string, Payload> = {}
  function publish(device: string, payload: Payload) {
    Object.assign(state[device] ??= {}, payload)
    receive({ topic: 'zigbee2mqtt/' + device, payload })
  }

  function tick() {
    const time = Date.now() / 60000
    publish(devices.temp, {
      temperature: +(22.4 + Math.sin(time) * 1.2 + random() * 0.3).toFixed(1),
      humidity: Math.round(46 + Math.sin(time / 2) * 4), battery: 100, linkquality: 127,
    })
    publish(devices.strip, { power: 120 + random() * 15, voltage: 236, current: 0.01, energy: 0, linkquality: 127 })
    publish(devices.occ, { occupancy: random() > 0.6, illumination: 'bright', linkquality: 189 })
    publish(devices.heat, { energia_suma: 22 + time % 10, energia_dzienna: 21.5, linkquality: 222 })
    publish(devices.air, { analog_input_1: 70, binary_input_2: 'ON', linkquality: 131 })
  }

  tick()
  publish(devices.strip, { state_l1: 'OFF', state_l2: 'OFF', state_l3: 'OFF' })
  publish(devices.bulb, { state: 'ON', brightness: 150, color_temp: 300, linkquality: 105 })
  publish(devices.alarm, { alarm: 'normal', battery_state: 'high', linkquality: 167 })
  publish(devices.button, { battery: 100, voltage: 3000, action: '', linkquality: 105 })
  publish(devices.remote, { battery: 90, voltage: 2900, linkquality: 174 })
  publish(devices.rfid, { analog_input_10: 0, linkquality: 218 })
  window.setInterval(tick, 3000)

  return {
    login(role: Role) {
      const username = names[role]
      receive({ type: 'auth', username, level: role })
      events.unshift({ time: iso(Date.now()), source: 'dostęp', type: 'granted', subject: username })
      receive({ type: 'event' })
    },
    scan() { publish(devices.rfid, { analog_input_10: Math.floor(1e7 + random() * 9e7) }) },
    command({ device, payload }: Command) {
      window.setTimeout(() => {
        const next: Payload = { ...payload }
        for (const key of Object.keys(next)) {
          if (next[key] === 'TOGGLE') next[key] = state[device]?.[key] === 'ON' ? 'OFF' : 'ON'
        }
        publish(device, next)
      }, 300)
    },
  }
}
