import type { StressTask } from '@/types'

export const mockTasks: StressTask[] = [
  {
    id: 'task001',
    name: '登录接口压测',
    description: '测试用户登录接口在高并发下的性能表现',
    status: 'idle',
    scenarioConfig: {
      mode: 'step',
      duration: 300,
      steps: [
        { concurrent: 200, duration: 240, rampTime: 60 },
      ],
    },
    scripts: [{ scriptId: 'script001', scriptName: 'http_login', weight: 100 }],
    createdAt: '2026-03-15T10:00:00Z',
    updatedAt: '2026-03-15T10:00:00Z',
  },
  {
    id: 'task002',
    name: '搜索接口阶梯压测',
    description: '阶梯式增加并发数，测试搜索接口性能极限',
    status: 'success',
    scenarioConfig: {
      mode: 'step',
      duration: 600,
      steps: [
        { concurrent: 50,  duration: 120, rampTime: 0  },
        { concurrent: 100, duration: 120, rampTime: 20 },
        { concurrent: 200, duration: 120, rampTime: 30 },
        { concurrent: 300, duration: 120, rampTime: 30 },
        { concurrent: 500, duration: 120, rampTime: 60 },
      ],
    },
    scripts: [
      { scriptId: 'script002', scriptName: 'http_search', weight: 70, envVars: { INTERFACE_WEIGHTS: '{"search":60,"detail":40}' } },
      { scriptId: 'script003', scriptName: 'http_order', weight: 30 },
    ],
    createdAt: '2026-03-14T14:00:00Z',
    updatedAt: '2026-03-14T16:30:00Z',
    lastExecutionId: 'exec002',
  },
  {
    id: 'task003',
    name: '首页接口 RPS 测试',
    description: '以固定 RPS 模式测试首页接口吞吐量',
    status: 'idle',
    scenarioConfig: {
      mode: 'rps',
      duration: 180,
      targetRps: 1000,
      rpsRampTime: 0,
    },
    scripts: [{ scriptId: 'script001', scriptName: 'http_login', weight: 100 }],
    createdAt: '2026-03-13T09:00:00Z',
    updatedAt: '2026-03-13T09:30:00Z',
    lastExecutionId: 'exec003',
  },
  {
    id: 'task004',
    name: '支付接口稳定性测试',
    description: '长时间运行测试支付接口的稳定性',
    status: 'idle',
    scenarioConfig: {
      mode: 'step',
      duration: 3600,
      steps: [
        { concurrent: 50, duration: 3480, rampTime: 120 },
      ],
    },
    scripts: [{ scriptId: 'script005', scriptName: 'http_pay', weight: 100 }],
    createdAt: '2026-03-12T15:00:00Z',
    updatedAt: '2026-03-12T15:00:00Z',
  },
  {
    id: 'task005',
    name: '商品详情 gRPC 压测',
    description: '商品详情 gRPC 接口并发压测，P99 目标 < 50ms',
    status: 'idle',
    scenarioConfig: {
      mode: 'step',
      duration: 300,
      steps: [
        { concurrent: 500, duration: 270, rampTime: 30 },
      ],
    },
    scripts: [{ scriptId: 'script004', scriptName: 'grpc_goods', weight: 100 }],
    createdAt: '2026-03-11T10:00:00Z',
    updatedAt: '2026-03-11T10:00:00Z',
  },
  {
    id: 'task006',
    name: '容量验证 RPS 300',
    description: 'RPS 模式以 300 req/s 稳定注入，验证系统容量与 SLA 合规性',
    status: 'idle',
    scenarioConfig: {
      mode: 'rps',
      duration: 180,
      targetRps: 300,
      rpsRampTime: 20,
    },
    scripts: [
      { scriptId: 'script002', scriptName: 'http_search', weight: 60 },
      { scriptId: 'script001', scriptName: 'http_login', weight: 40 },
    ],
    createdAt: '2026-03-19T08:00:00Z',
    updatedAt: '2026-03-19T08:00:00Z',
  },
]
