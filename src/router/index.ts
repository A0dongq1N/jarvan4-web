import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: () => import('@/views/login/LoginView.vue'),
      meta: { layout: 'blank' },
    },
    {
      path: '/project',
      name: 'ProjectSelect',
      component: () => import('@/views/project/ProjectSelectView.vue'),
      meta: { layout: 'blank', title: '选择项目' },
    },
    {
      path: '/',
      component: () => import('@/components/layout/AppLayout.vue'),
      redirect: '/project',
      children: [
        {
          path: 'task',
          name: 'TaskList',
          component: () => import('@/views/task/TaskListView.vue'),
          meta: { keepAlive: true, title: '压测任务' },
        },
        {
          path: 'task/create',
          name: 'TaskCreate',
          component: () => import('@/views/task/TaskDetailView.vue'),
          meta: { title: '新建任务' },
        },
        {
          path: 'task/:id',
          name: 'TaskDetail',
          component: () => import('@/views/task/TaskDetailView.vue'),
          meta: { title: '任务详情' },
        },
        {
          path: 'script',
          name: 'ScriptList',
          component: () => import('@/views/script/ScriptListView.vue'),
          meta: { keepAlive: true, title: '脚本管理' },
        },
        {
          path: 'execution/:taskId',
          name: 'Execution',
          component: () => import('@/views/execution/ExecutionView.vue'),
          meta: { title: '压测执行' },
        },
        {
          path: 'report',
          name: 'ReportList',
          component: () => import('@/views/report/ReportListView.vue'),
          meta: { keepAlive: true, title: '压测报告' },
        },
        {
          path: 'report/:id',
          name: 'ReportDetail',
          component: () => import('@/views/report/ReportDetailView.vue'),
          meta: { title: '报告详情' },
        },
        {
          path: 'account',
          name: 'Account',
          component: () => import('@/views/account/AccountView.vue'),
          meta: { title: '用户信息' },
        },
        {
          path: 'users',
          name: 'UserAdmin',
          component: () => import('@/views/user/UserAdminView.vue'),
          meta: { title: '用户管理' },
        },
        {
          path: 'worker',
          name: 'WorkerList',
          component: () => import('@/views/worker/WorkerListView.vue'),
          meta: { keepAlive: true, title: '节点管理' },
        },
        {
          path: 'audit',
          name: 'AuditLog',
          component: () => import('@/views/audit/AuditLogView.vue'),
          meta: { keepAlive: true, title: '审计日志' },
        },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/project',
    },
  ],
})

// 路由守卫
router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('stress_token')

  // 未登录：只允许访问登录页
  if (!token) {
    if (to.path === '/login') {
      next()
    } else {
      next('/login')
    }
    return
  }

  // 已登录访问登录页 → 跳转项目选择
  if (to.path === '/login') {
    next('/project')
    return
  }

  // 已登录访问项目选择页 → 直接放行
  if (to.path === '/project') {
    next()
    return
  }

  // 已登录访问 AppLayout 子路由：节点管理、审计日志不需要选择项目
  if (to.path.startsWith('/worker') || to.path.startsWith('/audit') || to.path.startsWith('/account') || to.path.startsWith('/users')) {
    if (to.path.startsWith('/users')) {
      const raw = localStorage.getItem('stress_userinfo')
      const role = raw ? JSON.parse(raw)?.role : ''
      if (role !== 'admin') {
        next('/account')
        return
      }
    }
    next()
    return
  }

  // 其他子路由需要已选择项目
  const savedProject = localStorage.getItem('stress_project')
  if (!savedProject) {
    next('/project')
    return
  }

  next()
})

export default router
