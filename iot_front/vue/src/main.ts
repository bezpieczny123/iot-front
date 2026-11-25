import { createApp, watch } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'
import { canView } from './stores/panel'
import Overview from './views/Overview.vue'
import Environment from './views/Environment.vue'
import Energy from './views/Energy.vue'
import Control from './views/Control.vue'
import Events from './views/Events.vue'
import Reports from './views/Reports.vue'
import Users from './views/Users.vue'
import Devices from './views/Devices.vue'
import './style.css'
import './panel.css'

export const pages = [
  { path: '/', title: 'Przegląd', role: 1, component: Overview },
  { path: '/srodowisko', title: 'Środowisko', role: 1, component: Environment },
  { path: '/energia', title: 'Ciepłomierz i energia', role: 1, component: Energy },
  { path: '/sterowanie', title: 'Sterowanie', role: 2, group: 'Operacje', component: Control },
  { path: '/zdarzenia', title: 'Dostęp i zdarzenia', role: 2, component: Events },
  { path: '/raporty', title: 'Raporty', role: 2, component: Reports },
  { path: '/uzytkownicy', title: 'Użytkownicy', role: 3, group: 'Administracja', demoOnly: true, component: Users },
  { path: '/urzadzenia', title: 'Urządzenia', role: 3, component: Devices },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    ...pages.map(({ path, title, role, demoOnly, component }) => ({ path, component, meta: { title, role, demoOnly } })),
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})
const allowed = (meta: typeof router.currentRoute.value.meta) => canView(Number(meta.role), meta.demoOnly === true)
router.beforeEach(to => {
  if (to.path !== '/' && !allowed(to.meta)) return '/'
})
watch(() => allowed(router.currentRoute.value.meta), permitted => {
  if (!permitted && router.currentRoute.value.path !== '/') void router.replace('/')
})

createApp(App, { pages }).use(router).mount('#root')
