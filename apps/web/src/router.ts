import { createRouter, createWebHashHistory } from 'vue-router';
import NameLab from './pages/NameLab.vue';
import Teams from './pages/Teams.vue';
import Pool from './pages/Pool.vue';
import Battle from './pages/Battle.vue';
import History from './pages/History.vue';
import Ladder from './pages/Ladder.vue';

/** hash 路由：静态部署无需 SPA fallback，战报链接可直接分享 */
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'lab', component: NameLab },
    { path: '/teams', name: 'teams', component: Teams },
    { path: '/pool', name: 'pool', component: Pool },
    { path: '/battle/:id', name: 'battle', component: Battle },
    { path: '/battle/local', name: 'battle-local', component: Battle },
    { path: '/history', name: 'history', component: History },
    { path: '/ladder', name: 'ladder', component: Ladder },
  ],
});
