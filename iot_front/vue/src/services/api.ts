import type { AccessRow, Device, EventRow, HeatReading, HistoryPoint, NewCard, NewUser, Role, User, Validity } from '../types'
import { mockApi } from './mock'

export const isMock = new URLSearchParams(location.search).has('mock')

async function get<T>(path: string, query?: Record<string, string>): Promise<T> {
  const response = await fetch('/api' + path + (query ? '?' + new URLSearchParams(query) : ''))
  if (!response.ok) throw Error('HTTP ' + response.status)
  return response.json()
}

async function post(path: string, body: object = {}) {
  const response = await fetch('/api' + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw Error('HTTP ' + response.status)
}

const liveApi: typeof mockApi = {
  history: (params) => get<HistoryPoint[]>('/history', Object.fromEntries(params)),
  heat: (from) => get<HeatReading[]>('/heat', { from }),
  events: (limit) => get<EventRow[]>('/events', { limit: String(limit) }),
  access: (user, from, to) => get<AccessRow[]>('/access', { user, from, to: to + 'T23:59:59' }),
  devices: () => get<Device[]>('/devices'),
  users: () => get<User[]>('/users'),
  addUser: (body: NewUser) => post('/users', body),
  deactivateUser: (id) => post('/users/' + id + '/deactivate'),
  setLevel: (id, access_level: Role) => post('/users/' + id + '/level', { access_level }),
  addCard: (id, body: NewCard) => post('/users/' + id + '/cards', body),
  deactivateCard: (id) => post('/cards/' + id + '/deactivate'),
  setValidity: (id, body: Validity) => post('/cards/' + id + '/validity', body),
}

export const api = isMock ? mockApi : liveApi
