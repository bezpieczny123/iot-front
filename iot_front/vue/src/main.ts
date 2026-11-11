import { createApp, watch } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'
import { panel } from './stores/panel'
import Overview from './views/Overview.vue'
import Environment from './views/Environment.vue'
import Energy from './views/Energy.vue'
import Control from './views/Control.vue'
import Events from './views/Events.vue'
import Reports from './views/Reports.vue'
import Users from './views/Users.vue'
import Devices from './views/Devices.vue'
import '../../style.css'
import './panel.css'

export const pages = [
  { path: '/', title: 'Przegląd', role: 1, component: Overview },
  { path: '/srodowisko', title: 'Środowisko', role: 1, component: Environment },
  { path: '/energia', title: 'Ciepłomierz i energia', role: 1, component: Energy },
  { path: '/sterowanie', title: 'Sterowanie', role: 2, group: 'Operacje', component: Control },
  { path: '/zdarzenia', title: 'Dostęp i zdarzenia', role: 2, component: Events },
  { path: '/raporty', title: 'Raporty', role: 2, component: Reports },
  { path: '/uzytkownicy', title: 'Użytkownicy', role: 3, group: 'Administracja', component: Users },
  { path: '/urzadzenia', title: 'Urządzenia', role: 3, component: Devices },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    ...pages.map(({ path, title, role, component }) => ({ path, component, meta: { title, role } })),
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})
router.beforeEach(to => {
  if (to.path !== '/' && (!panel.session || Number(to.meta.role) > panel.session.role)) return '/'
})
watch(() => panel.session, () => { void router.replace('/') })

createApp(App, { pages }).use(router).mount('#root')
