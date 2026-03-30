import type { Project } from '@/types'

export const mockProjects: Project[] = [
  {
    id: 'proj001',
    name: '电商平台',
    description: '面向C端用户的电商购物平台，包含商品浏览、搜索、下单、支付等核心链路',
    taskCount: 12,
    scriptCount: 5,
    lastRunAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'proj002',
    name: '支付系统',
    description: '统一支付网关，对接多个支付渠道，承担全平台交易流量',
    taskCount: 8,
    scriptCount: 3,
    lastRunAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'proj003',
    name: '推荐引擎',
    description: '实时个性化推荐服务，为商品详情页、首页等场景提供推荐结果',
    taskCount: 4,
    scriptCount: 2,
    lastRunAt: undefined,
    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
  },
]
