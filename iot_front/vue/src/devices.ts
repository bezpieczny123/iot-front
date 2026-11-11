export const devices = {
  temp: 'termometr_higrometr',
  occ: 'czujnik_obecnosci',
  strip: 'listwa',
  button: 'przycisk',
  remote: 'pilot',
  alarm: 'alarm',
  air: 'jakosc_powietrza',
  rfid: 'czytnik_rfid',
  heat: 'cieplomierz',
  bulb: 'zarowka',
}

export const roles = { 1: 'Obserwator', 2: 'Operator', 3: 'Administrator' }
export const uidKey = /uid|analog_input.*10$/i
export const dailyHeatKey = /energia_dzienna|analog_input.*11$/i
