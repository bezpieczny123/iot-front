export type Role = 1 | 2 | 3
export type Payload = Record<string, unknown>
export type DeviceState = Payload & { _on?: boolean; _t?: number }
export type Command = { type: 'cmd'; device: string; payload: Payload }
export type LiveMessage =
  | { topic: string; payload: unknown }
  | { type: 'auth'; username: string; level: number }
  | { type: 'event' }

export interface HistoryPoint { time: string; value: number }
export interface HeatReading { day: string; energy_used_kwh: number }
export interface Device {
  friendly_name: string
  type: string
  model?: string
  is_online?: boolean
  battery_pct?: number
  link_quality?: number
  last_seen?: string
}
export interface EventRow {
  time: string
  source: string
  type: string
  subject: string
  details?: string
}
export interface AccessRow {
  time: string
  username: string
  granted: boolean
  reason?: string
  reader?: string
}
export interface Validity { valid_from: string | null; valid_to: string | null }
export interface Card extends Partial<Validity> { id: number; label?: string; is_active: boolean }
export interface User { id: number; username: string; access_level: Role; is_active: boolean; cards: Card[] }
export interface NewUser extends Validity { username: string; access_level: Role; uid: string | null }
export interface NewCard extends Validity { uid: string; label: string }
export type Colors = Record<'ok' | 'no' | 'exp' | 'wait', string>
