<script setup lang="ts">
import { ref } from 'vue'
import { dateInput, dateTime, dayMonth, hoursAgo, number } from '../format'
import { api } from '../services/api'
import { notify, panel } from '../stores/panel'

const type = ref<'access' | 'heat'>('access')
const username = ref(panel.session?.username ?? '')
const from = ref(dateInput(hoursAgo(720)))
const to = ref(dateInput())
const report = ref<{ headers: string[]; rows: string[][] }>()
const loading = ref(false)
const error = ref('')

async function generate() {
  const range = { from: from.value, to: to.value }
  report.value = undefined
  error.value = ''
  if (!range.from || !range.to || range.from > range.to) {
    error.value = 'Wybierz poprawny zakres dat'
    return
  }
  loading.value = true
  try {
    if (type.value === 'access') {
      const rows = await api.access(username.value.trim(), range.from, range.to)
      report.value = {
        headers: ['Czas', 'Użytkownik', 'Wynik', 'Powód', 'Czytnik'],
        rows: rows.map(row => [dateTime(row.time), row.username || '—', row.granted ? 'OK' : 'ODMOWA', row.reason ?? '', row.reader || '—']),
      }
    } else {
      const rows = await api.heat(range.from)
      report.value = {
        headers: ['Dzień', 'Zużycie kWh'],
        rows: rows.filter(row => dateInput(row.day) >= range.from && dateInput(row.day) <= range.to)
          .map(row => [dayMonth(row.day), number(row.energy_used_kwh)]),
      }
    }
  } catch {
    error.value = 'Błąd pobierania danych'
  } finally {
    loading.value = false
  }
}

function exportCsv() {
  if (!report.value?.rows.length) return notify('Najpierw wygeneruj raport z danymi')
  const quote = (value: string) => {
    const text = /^[=+\-@\t\r\n]/.test(value) ? "'" + value : value
    return '"' + text.replace(/"/g, '""') + '"'
  }
  const csv = [report.value.headers, ...report.value.rows].map(row => row.map(quote).join(';')).join('\n')
  const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'raport.csv'
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const printReport = () => window.print()
</script>

<template>
  <form class="p noprint form-panel" @submit.prevent="generate">
    <div class="lb">Generator raportu</div>
    <div class="inline-fields">
      <select v-model="type" aria-label="Rodzaj raportu"><option value="access">Dostęp użytkownika</option><option value="heat">Zużycie ciepła</option></select>
      <input v-if="type === 'access'" v-model="username" aria-label="Login" placeholder="login" style="width:140px">
      <input v-model="from" type="date" aria-label="Od" required>
      <input v-model="to" type="date" aria-label="Do" required>
      <button :disabled="loading">Generuj</button>
      <button type="button" :disabled="!report?.rows.length" @click="exportCsv">CSV</button>
      <button type="button" :disabled="!report?.rows.length" @click="printReport">PDF (drukuj)</button>
    </div>
  </form>
  <div class="p">
    <div class="lb">Podgląd</div>
    <p v-if="loading || error || !report" class="field-status">{{ loading ? 'ładowanie…' : error || 'Wybierz parametry i kliknij Generuj.' }}</p>
    <div v-else class="tw">
      <table>
        <thead><tr><th v-for="header in report.headers" :key="header">{{ header }}</th></tr></thead>
        <tbody>
          <tr v-for="(row, i) in report.rows" :key="i"><td v-for="(value, j) in row" :key="j">{{ value }}</td></tr>
          <tr v-if="!report.rows.length"><td :colspan="report.headers.length" class="field-status">brak danych</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
