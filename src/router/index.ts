import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/Home.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/auth/Login.vue'),
    meta: { guest: true }
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('../views/auth/Register.vue'),
    meta: { guest: true }
  },
  {
    path: '/oauth-callback',
    name: 'OAuthCallback',
    component: () => import('../views/auth/OAuthCallback.vue'),
    meta: { public: true }
  },
  {
    path: '/game',
    name: 'Game',
    component: () => import('../views/Game.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/submit',
    name: 'SubmitCode',
    component: () => import('../views/SubmitCode.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/profile',
    name: 'UserProfile',
    component: () => import('../views/UserProfile.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/recordings',
    name: 'GameRecordings',
    component: () => import('../views/GameRecordings.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/replay',
    name: 'GameReplay',
    component: () => import('../views/GameReplay.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/rules',
    name: 'GameRules',
    component: () => import('../views/GameRules.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('../views/NotFound.vue')
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

// 路由守卫
router.beforeEach((to, from, next) => {
  const isLoggedIn = localStorage.getItem('accessToken');

  // 公共页面无需任何检查
  if (to.matched.some(record => record.meta.public)) {
    next();
  }
  // 需要登录的页面但未登录
  else if (to.matched.some(record => record.meta.requiresAuth) && !isLoggedIn) {
    next({ name: 'Login' });
  }
  // 已登录用户不能访问登录/注册页面
  else if (to.matched.some(record => record.meta.guest) && isLoggedIn) {
    next({ name: 'Home' });
  }
  else {
    next();
  }
});

export default router;