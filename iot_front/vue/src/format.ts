const timeZone = 'Europe/Warsaw'

export const dateTime = (value: string | number) =>
  new Date(value).toLocaleString('pl-PL', { timeZone, hour12: false })
export const clock = (value: string | number) =>
  new Date(value).toLocaleTimeString('pl-PL', { timeZone, hour: '2-digit', minute: '2-digit' })
export const dayMonth = (value: string | number) =>
  new Date(value).toLocaleDateString('pl-PL', { timeZone, day: '2-digit', month: '2-digit' })
export const dateInput = (value: string | number | Date = Date.now()) =>
  new Date(value).toLocaleDateString('sv-SE', { timeZone })
export const dateIso = (value: string, end = false) =>
  value ? new Date(value + (end ? 'T23:59:59' : 'T00:00:00')).toISOString() : null
export const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3600000)
export const number = (value: unknown, digits = 1) =>
  (typeof value === 'number' || (typeof value === 'string' && value.trim())) &&
  Number.isFinite(Number(value)) ? Number(value).toFixed(digits).replace('.', ',') : '—'
export const valueText = (value: unknown) => value == null ? '—' : String(value)

export function age(timestamp?: number) {
  if (!timestamp) return '—'
  const seconds = (Date.now() - timestamp) / 1000
  if (seconds < 90) return Math.round(seconds) + ' s temu'
  if (seconds < 5400) return Math.round(seconds / 60) + ' min temu'
  return Math.round(seconds / 3600) + ' h temu'
}
