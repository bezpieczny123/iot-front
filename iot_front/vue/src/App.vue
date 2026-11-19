<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { roles } from './devices'
import { dateTime } from './format'
import { canView, logout, notice, panel, simulator } from './stores/panel'

const props = defineProps<{ pages: { path: string; title: string; role: number; group?: string; demoOnly?: boolean }[] }>()
const route = useRoute()
const roleOptions = [1, 2, 3] as const
const navigation = computed(() => props.pages.filter(page => canView(page.role, page.demoOnly)))
const gateMessage = computed(() => {
  if (simulator || panel.access === 'locked') return 'Zbliż kartę do czytnika'
  if (!panel.online) return 'Łączenie z serwerem…'
  if (panel.connectionError) return panel.connectionError
  return panel.access === 'unlocked' ? 'Pobieranie stanu urządzeń…' : 'Sprawdzanie dostępu…'
})
</script>

<template>
  <div v-if="!canView(1)" id="gate">
    <h1>Serwerownia</h1>
    <p>{{ gateMessage }}</p>
  </div>
  <div v-else id="app">
    <aside class="side">
      <div class="t">SERWEROWNIA</div>
      <nav class="nav" aria-label="Widoki">
        <template v-for="(page, index) in navigation" :key="page.path">
          <div v-if="page.group" class="sep lb">{{ page.group }}</div>
          <RouterLink :to="page.path" exact-active-class="on">
            <b>{{ String(index + 1).padStart(2, '0') }}</b>{{ page.title }}
          </RouterLink>
        </template>
      </nav>
    </aside>
    <main>
      <div class="top">
        <h2>{{ route.meta.title }}</h2>
        <div class="who">
          <span><span class="d" :class="panel.online ? 'ok' : 'e'"></span>{{ panel.online ? simulator ? 'mock' : 'online' : 'offline' }}</span>
          <span v-if="panel.session">{{ panel.session.username }} · {{ roles[panel.session.role] }}</span>
          <span v-else-if="panel.snapshot?.access.username">{{ panel.snapshot.access.username }}</span>
          <span v-if="panel.expiresAt">Dostęp do {{ dateTime(panel.expiresAt) }}</span>
          <span v-if="!simulator && panel.snapshot?.transport.mqtt !== 'connected'" role="status">MQTT niedostępne</span>
          <button @click="logout">{{ simulator ? 'Wyloguj' : 'Zablokuj system' }}</button>
        </div>
      </div>
      <RouterView v-if="canView(Number(route.meta.role), route.meta.demoOnly === true)" />
    </main>
  </div>
  <div v-if="simulator" class="dev">
    <span>TRYB MOCK – symuluj kartę:</span>
    <span>
      <button v-for="role in roleOptions" :key="role" @click="simulator?.login(role)">{{ roles[role] }}</button>
      <button @click="simulator?.scan()">Skanuj nową kartę</button>
    </span>
  </div>
  <div v-if="notice" id="toast" role="status" style="display:block">{{ notice }}</div>
</template>
