<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { roles } from './devices'
import { logout, notice, panel, simulator } from './stores/panel'

const props = defineProps<{ pages: { path: string; title: string; role: number; group?: string }[] }>()
const route = useRoute()
const roleOptions = [1, 2, 3] as const
const navigation = computed(() => props.pages.filter(page => page.role <= (panel.session?.role ?? 0)))
</script>

<template>
  <div v-if="!panel.session" id="gate">
    <h1>Serwerownia</h1>
    <p>ZBLIŻ KARTĘ DO CZYTNIKA, ABY SIĘ ZALOGOWAĆ</p>
    <p>{{ simulator ? 'tryb demo' : panel.online ? 'połączono z serwerem' : 'łączenie z serwerem…' }}</p>
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
          <span>{{ panel.session.username }} · {{ roles[panel.session.role] }}</span>
          <button @click="logout">Wyloguj</button>
        </div>
      </div>
      <RouterView v-if="Number(route.meta.role) <= panel.session.role" />
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
