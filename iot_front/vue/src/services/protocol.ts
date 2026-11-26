export type Id = number | string
export type Power = 'ON' | 'OFF'
export type Mode = Power | 'AUTO'
export type Scene = 'WORK' | 'NIGHT' | 'ECO'

export type ControlAction =
  | { action: 'SET_SOCKET'; socket: 'l1' | 'l2' | 'l3'; state: Power; confirm?: 'SERVER_POWER_OFF' }
  | { action: 'SET_LIGHT'; state?: Power; brightness?: number; hex?: string }
  | { action: 'SET_FAN_MODE' | 'SET_LIGHTING_MODE'; mode: Mode }
  | { action: 'SCENE'; scene: Scene }
  | { action: 'MUTE_ALARM' }

type Range = { from?: string; to?: string; limit?: number }
export type Request = ControlAction
  | { action: 'GET_AUTH_STATE' | 'GET_SNAPSHOT' | 'SUBSCRIBE' | 'UNSUBSCRIBE' | 'LOCK' | 'PING' }
  | ({ action: 'GET_HISTORY' | 'GET_HOURLY'; entity_id: Id } & Range)
  | ({ action: 'GET_HEAT' | 'GET_DAILY_HEAT'; device_id: Id } & Range)
  | ({ action: 'GET_EVENTS' } & Range)
  | ({ action: 'GET_ACCESS_LOG'; username?: string } & Range)

export interface Envelope {
  v: 2
  timestamp: string
  type: string
  request_id: string | null
  code?: string
}

export interface AuthState extends Envelope {
  type: 'AUTH_STATE'
  unlocked: boolean
  expires_at: string | null
  reason?: string | null
  access_level?: number | null
  username?: string | null
}

export interface SnapshotDevice {
  id: Id
  friendly_name: string
  type: string
  model: string | null
  last_seen: string | null
  battery_pct: number | null
  link_quality: number | null
  availability: 'online' | 'offline' | 'unknown'
}

export interface SnapshotEntity {
  id: Id
  device_id: Id
  source_key: string
  state: unknown
  state_updated_at: string | null
  latest_time: string | null
  retained: boolean
}

export interface Automation {
  lighting_mode: Mode
  fan_mode: Mode
  fan_forced: boolean
  alarms: Record<string, boolean>
}

export interface Snapshot {
  devices: SnapshotDevice[]
  entities: SnapshotEntity[]
  access: { unlocked: boolean; username: string | null; expires_at: string | null; access_level?: number | null }
  automation: Automation
  transport: { mqtt: string }
}

export interface DataResponse<T> extends Envelope {
  data: T
  truncated?: boolean
}

export interface ControlResponse extends Envelope {
  automation: Automation
}

export class SocketError extends Error {
  constructor(readonly code: string) {
    super(code)
  }
}
