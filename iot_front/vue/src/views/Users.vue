<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { roles } from '../devices'
import { dateInput, dateIso } from '../format'
import { api } from '../services/api'
import { notify, panel } from '../stores/panel'
import type { Card, Role, User } from '../types'

const users = ref<User[]>([])
const query = ref('')
const username = ref('')
const level = ref<Role>(2)
const from = ref('')
const to = ref('')
const editing = ref<{ id: number; userId: number }>()
const editFrom = ref('')
const editTo = ref('')
const busy = ref(false)
const loading = ref(true)
const error = ref(false)
const levels = [1, 2, 3] as const
const visible = computed(() => users.value.filter(user => user.username.toLowerCase().includes(query.value.trim().toLowerCase())))

async function load() {
  error.value = false
  try {
    users.value = await api.users()
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}

async function save(operation: () => Promise<void>, message: string, finish?: () => void) {
  if (busy.value) return
  busy.value = true
  try {
    await operation()
    finish?.()
    notify(message)
    await load()
  } catch {
    notify('Błąd zapisu')
  } finally {
    busy.value = false
  }
}

function validity(start: string, end: string) {
  if (start && end && start > end) {
    notify('Data końcowa musi przypadać w dniu rozpoczęcia lub później')
    return
  }
  return { valid_from: dateIso(start), valid_to: dateIso(end, true) }
}

function clearScannedCard(uid: string | null) {
  if (panel.uid === uid) panel.uid = null
  from.value = ''
  to.value = ''
}

function addUser() {
  const name = username.value.trim()
  if (!name) return notify('Podaj login')
  const uid = panel.uid
  if (!uid && (from.value || to.value)) return notify('Daty dotyczą karty. Zbliż kartę do czytnika')
  const dates = validity(from.value, to.value)
  if (!dates) return
  void save(() => api.addUser({ username: name, access_level: level.value, uid, ...dates }), 'Dodano użytkownika', () => {
    clearScannedCard(uid)
    username.value = ''
  })
}

function addCard(id: number) {
  const uid = panel.uid
  if (!uid) return notify('Najpierw zbliż kartę do czytnika')
  const dates = validity(from.value, to.value)
  if (!dates) return
  void save(() => api.addCard(id, { uid, label: 'karta', ...dates }), 'Dodano kartę', () => clearScannedCard(uid))
}

function changeRole(user: User, event: Event) {
  const select = event.target as HTMLSelectElement
  const role = Number(select.value) as Role
  select.value = String(user.access_level)
  if (role !== user.access_level) void save(() => api.setLevel(user.id, role), 'Zmieniono poziom')
}

function editCard(userId: number, card: Card) {
  editFrom.value = card.valid_from ? dateInput(card.valid_from) : ''
  editTo.value = card.valid_to ? dateInput(card.valid_to) : ''
  editing.value = { id: card.id, userId }
}

function saveCard() {
  const card = editing.value
  if (!card) return
  const dates = validity(editFrom.value, editTo.value)
  if (dates) void save(() => api.setValidity(card.id, dates), 'Zapisano ważność', () => { editing.value = undefined })
}

function cardStatus(card: Card) {
  if (!card.is_active) return { text: 'dezaktywowana', style: 'e' }
  if (card.valid_from && Date.parse(card.valid_from) > Date.now()) return { text: 'jeszcze nieważna', style: 'w' }
  if (card.valid_to && Date.parse(card.valid_to) < Date.now()) return { text: 'wygasła', style: 'e' }
  return { text: 'aktywna', style: '' }
}

function cardDates(card: Card) {
  return [
    card.valid_from ? 'od ' + dateInput(card.valid_from) : '',
    card.valid_to ? 'do ' + dateInput(card.valid_to) : '',
  ].filter(Boolean).join(' ') || 'bez ograniczeń'
}

onMounted(load)
</script>

<template>
  <div class="g c2 split-wide">
    <div class="p">
      <div class="lb"><span>Konta i uprawnienia</span><span>{{ query.trim() ? visible.length + ' z ' : '' }}{{ users.length }} kont</span></div>
      <input v-model="query" type="search" aria-label="Szukaj po loginie" placeholder="szukaj po loginie" style="width:100%;margin-bottom:10px">
      <p v-if="loading || error" class="field-status">{{ loading ? 'ładowanie…' : 'Błąd pobierania użytkowników' }}</p>
      <div v-else class="sc">
        <table>
          <thead><tr><th>Login</th><th>Poziom</th><th>Karty</th><th>Status</th><th>Akcje</th></tr></thead>
          <tbody>
            <template v-for="user in visible" :key="user.id">
              <tr>
                <td>{{ user.username }}</td>
                <td><select :value="user.access_level" :disabled="busy" :aria-label="'Poziom: ' + user.username" @change="changeRole(user, $event)">
                  <option v-for="role in levels" :key="role" :value="role">{{ roles[role] }}</option>
                </select></td>
                <td>
                  <template v-if="!user.cards?.length">—</template>
                  <div v-for="card in user.cards" :key="card.id" class="card-actions">
                    <span class="mono">{{ cardDates(card) }}</span>
                    <span class="tag" :class="cardStatus(card).style">{{ cardStatus(card).text }}</span>
                    <template v-if="card.is_active">
                      <button type="button" :disabled="busy" @click="editCard(user.id, card)">Edytuj</button>
                      <button type="button" :disabled="busy" aria-label="Dezaktywuj kartę" @click="save(() => api.deactivateCard(card.id), 'Dezaktywowano kartę', () => { if (editing?.id === card.id) editing = undefined })">×</button>
                    </template>
                  </div>
                </td>
                <td><span class="d" :class="user.is_active ? 'ok' : 'e'"></span>{{ user.is_active ? 'aktywny' : 'nieaktywny' }}</td>
                <td><div v-if="user.is_active" class="card-actions">
                  <button :disabled="busy" @click="addCard(user.id)">+ karta</button>
                  <button :disabled="busy" @click="save(() => api.deactivateUser(user.id), 'Dezaktywowano użytkownika')">Dezaktywuj</button>
                </div></td>
              </tr>
              <tr v-if="editing && editing.userId === user.id">
                <td colspan="5">
                  <form class="inline-fields" @submit.prevent="saveCard">
                    <label>Ważna od <input v-model="editFrom" type="date"></label>
                    <label>Ważna do <input v-model="editTo" type="date"></label>
                    <button :disabled="busy">Zapisz</button>
                    <button type="button" @click="editing = undefined">Anuluj</button>
                  </form>
                </td>
              </tr>
            </template>
            <tr v-if="!visible.length"><td colspan="5" class="field-status">brak wyników</td></tr>
          </tbody>
        </table>
      </div>
    </div>
    <form class="p" @submit.prevent="addUser">
      <div class="lb">Nowy użytkownik</div>
      <label class="row"><span>Login</span><input v-model="username" required></label>
      <label class="row"><span>Poziom</span><select v-model.number="level"><option v-for="role in levels" :key="role" :value="role">{{ roles[role] }}</option></select></label>
      <div class="row"><span>Karta</span><b class="mono">{{ panel.uid || 'zbliż kartę do czytnika' }}</b></div>
      <label class="row"><span>Ważna od</span><input v-model="from" type="date"></label>
      <label class="row"><span>Ważna do</span><input v-model="to" type="date"></label>
      <button :disabled="busy" style="margin-top:14px">+ Dodaj użytkownika</button>
    </form>
  </div>
</template>
