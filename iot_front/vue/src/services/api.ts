import { devices } from '../devices'
import { calendarDay, dateInput, warsawMidnight } from '../format'
import { panel, requestLive } from '../stores/panel'
import type { AccessRow, Device, EventRow, HeatReading, HistoryPoint } from '../types'
import { isMock, mockApi } from './mock'
import { SocketError, type DataResponse, type Id } from './protocol'

function deviceId(name: string) {
  const device = panel.snapshot?.devices.find(item => item.friendly_name === name)
  if (!device) throw new SocketError('DEVICE_NOT_REGISTERED')
  return device.id
}

function entityId(name: string, key: string) {
  const device = deviceId(name)
  const entity = panel.snapshot?.entities.find(item =>
    String(item.device_id) === String(device) && item.source_key === key)
  if (!entity) throw new SocketError('ENTITY_NOT_REGISTERED')
  return entity.id
}

function dateRange(from: string, to: string) {
  return { from: warsawMidnight(from), to: warsawMidnight(calendarDay(to, 1)) }
}

interface ServerEvent {
  id: Id
  time: string
  entity_id: Id | null
  device_id: Id | null
  user_id: Id | null
  event_type: string
  data: unknown
}

export const api = {
  async history(params: URLSearchParams) {
    if (isMock) return { data: await mockApi.history(params), truncated: false }
    const query = {
      entity_id: entityId(params.get('device') ?? '', params.get('key') ?? ''),
      from: params.get('from') ?? undefined,
      to: params.get('to') ?? undefined,
      limit: 1000,
    }
    if (params.get('agg') !== 'hour') {
      return requestLive<DataResponse<HistoryPoint[]>>({ action: 'GET_HISTORY', ...query }, 'HISTORY')
    }
    const response = await requestLive<DataResponse<{ hour: string; avg_value: number }[]>>(
      { action: 'GET_HOURLY', ...query }, 'HOURLY')
    return {
      data: response.data.map(row => ({ time: row.hour, value: row.avg_value })),
      truncated: response.truncated,
    }
  },
  async heat(from: string, to = dateInput()): Promise<HeatReading[]> {
    if (isMock) return (await mockApi.heat(from)).filter(row => row.day <= to)
    const response = await requestLive<DataResponse<HeatReading[]>>({
      action: 'GET_DAILY_HEAT', device_id: deviceId(devices.heat), ...dateRange(from, to),
    }, 'DAILY_HEAT')
    return response.data
  },
  async events(limit: number) {
    if (isMock) return { data: await mockApi.events(limit), truncated: false }
    const response = await requestLive<DataResponse<ServerEvent[]>>({ action: 'GET_EVENTS', limit }, 'EVENTS')
    const snapshot = panel.snapshot
    const data: EventRow[] = response.data.map(event => {
      const entity = snapshot?.entities.find(item => String(item.id) === String(event.entity_id))
      const device = snapshot?.devices.find(item => String(item.id) === String(event.device_id ?? entity?.device_id))
      const fields = event.data && typeof event.data === 'object' ? event.data as Record<string, unknown> : {}
      return {
        time: event.time,
        source: typeof fields.source === 'string' ? fields.source : 'automatyka',
        type: event.event_type,
        subject: device?.friendly_name ?? entity?.source_key ?? (event.user_id == null ? '-' : String(event.user_id)),
        details: typeof event.data === 'string' ? event.data : JSON.stringify(event.data ?? ''),
      }
    })
    return { data, truncated: response.truncated }
  },
  async access(username: string, from: string, to: string) {
    if (isMock) return { data: await mockApi.access(username, from, to), truncated: false }
    return requestLive<DataResponse<AccessRow[]>>({
      action: 'GET_ACCESS_LOG', username: username || undefined, ...dateRange(from, to), limit: 1000,
    }, 'ACCESS_LOG')
  },
}

export function liveDevices(): Device[] {
  return panel.snapshot?.devices.map(device => ({
    friendly_name: device.friendly_name,
    type: device.type,
    model: device.model ?? undefined,
    is_online: device.availability === 'unknown' ? undefined : device.availability === 'online',
    battery_pct: device.battery_pct ?? undefined,
    link_quality: device.link_quality ?? undefined,
    last_seen: device.last_seen ?? undefined,
  })) ?? []
}
