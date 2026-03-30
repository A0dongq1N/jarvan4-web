import type { Report } from '@/types'

export const mockReports: Report[] = [
  {
    id: 'report001',
    taskId: 'task002',
    taskName: '搜索接口阶梯压测',
    executionId: 'exec002',
    status: 'success',
    startTime: '2026-03-14T14:00:00Z',
    endTime: '2026-03-14T14:10:00Z',
    duration: 600,
    summary: {
      rps: 1256,
      avgResponseTime: 89,
      p99ResponseTime: 412,
      errorRate: 0.002,
      totalRequests: 753600,
      successRequests: 752094,
      failedRequests: 1506,
      concurrent: 500,
    },
    rpsData: Array.from({ length: 60 }, (_, i) => ({
      timestamp: new Date('2026-03-14T14:00:00Z').getTime() + i * 10000,
      value: 800 + Math.sin(i / 5) * 200 + (i > 30 ? 400 : 0) + Math.random() * 100,
    })),
    responseTimeData: Array.from({ length: 60 }, (_, i) => ({
      timestamp: new Date('2026-03-14T14:00:00Z').getTime() + i * 10000,
      value: 80 + Math.cos(i / 8) * 20 + (i > 40 ? 50 : 0) + Math.random() * 15,
    })),
    errorRateData: Array.from({ length: 60 }, (_, i) => ({
      timestamp: new Date('2026-03-14T14:00:00Z').getTime() + i * 10000,
      value: (i > 45 ? 0.5 : 0.1) + Math.random() * 0.1,
    })),
    concurrentData: Array.from({ length: 60 }, (_, i) => {
      let concurrent = 50
      if (i > 10) concurrent = 100
      if (i > 20) concurrent = 200
      if (i > 30) concurrent = 300
      if (i > 40) concurrent = 500
      return { timestamp: new Date('2026-03-14T14:00:00Z').getTime() + i * 10000, value: concurrent }
    }),
    percentiles: [
      {
        api: '/v1/search', requests: 602880, errors: 1356, errorRate: 0.00225, p50: 65, p75: 89, p90: 142, p95: 198, p99: 412, max: 892, min: 12,
        rpsData:          Array.from({ length: 60 }, (_, i) => ({ timestamp: new Date('2026-03-14T14:00:00Z').getTime() + i * 10000, value: 560 + Math.sin(i / 5) * 140 + (i > 30 ? 280 : 0) + Math.random() * 70 })),
        responseTimeData: Array.from({ length: 60 }, (_, i) => ({ timestamp: new Date('2026-03-14T14:00:00Z').getTime() + i * 10000, value: 75 + Math.cos(i / 8) * 18 + (i > 40 ? 45 : 0) + Math.random() * 12 })),
        errorRateData:    Array.from({ length: 60 }, (_, i) => ({ timestamp: new Date('2026-03-14T14:00:00Z').getTime() + i * 10000, value: (i > 45 ? 0.4 : 0.08) + Math.random() * 0.08 })),
      },
      {
        api: '/v1/search/suggest', requests: 150720, errors: 150, errorRate: 0.00100, p50: 23, p75: 35, p90: 56, p95: 78, p99: 123, max: 345, min: 8,
        rpsData:          Array.from({ length: 60 }, (_, i) => ({ timestamp: new Date('2026-03-14T14:00:00Z').getTime() + i * 10000, value: 140 + Math.sin(i / 5) * 40 + (i > 30 ? 80 : 0) + Math.random() * 20 })),
        responseTimeData: Array.from({ length: 60 }, (_, i) => ({ timestamp: new Date('2026-03-14T14:00:00Z').getTime() + i * 10000, value: 22 + Math.cos(i / 8) * 5 + Math.random() * 4 })),
        errorRateData:    Array.from({ length: 60 }, (_, i) => ({ timestamp: new Date('2026-03-14T14:00:00Z').getTime() + i * 10000, value: 0.05 + Math.random() * 0.05 })),
      },
    ],
    errors: [
      { code: '10001', message: '余额不足',          errorType: 'business', count: 892, percentage: 59.2 },
      { code: '10032', message: '库存不足',          errorType: 'business', count: 389, percentage: 25.8 },
      { code: 'TIMEOUT', message: 'context deadline exceeded (5000ms)', errorType: 'system', count: 225, percentage: 14.9 },
    ],
    createdAt: '2026-03-14T14:10:05Z',
    scriptSnapshots: [
      { scriptId: 'script002', scriptName: 'http_search', commitHash: 'b7e9f2a1c3d6', weight: 70 },
      { scriptId: 'script003', scriptName: 'http_order', commitHash: 'c9d1e3f7a2b8', weight: 30 },
    ],
    workerSnapshots: [
      { workerId: 'worker-node-01', hostname: 'stress-worker-01', ip: '10.0.1.11', cpuCores: 16, maxConcurrency: 5000 },
      { workerId: 'worker-node-02', hostname: 'stress-worker-02', ip: '10.0.1.12', cpuCores: 16, maxConcurrency: 5000 },
      { workerId: 'worker-node-03', hostname: 'stress-worker-03', ip: '10.0.1.13', cpuCores: 16, maxConcurrency: 5000 },
    ],
  },
  {
    id: 'report002',
    taskId: 'task003',
    taskName: '首页接口 RPS 测试',
    executionId: 'exec003',
    status: 'failed',
    startTime: '2026-03-13T09:00:00Z',
    endTime: '2026-03-13T09:05:30Z',
    duration: 330,
    scenarioMode: 'rps',
    targetRps: 1000,
    summary: {
      rps: 423,
      avgResponseTime: 1230,
      p99ResponseTime: 8900,
      errorRate: 0.35,
      totalRequests: 139590,
      successRequests: 90733,
      failedRequests: 48857,
      concurrent: 150,
    },
    rpsData: Array.from({ length: 33 }, (_, i) => ({
      timestamp: new Date('2026-03-13T09:00:00Z').getTime() + i * 10000,
      value: i < 15 ? 800 + Math.random() * 100 : 200 + Math.random() * 100,
    })),
    responseTimeData: Array.from({ length: 33 }, (_, i) => ({
      timestamp: new Date('2026-03-13T09:00:00Z').getTime() + i * 10000,
      value: i < 15 ? 200 + Math.random() * 50 : 2000 + Math.random() * 500,
    })),
    errorRateData: Array.from({ length: 33 }, (_, i) => ({
      timestamp: new Date('2026-03-13T09:00:00Z').getTime() + i * 10000,
      value: i < 15 ? 0.5 + Math.random() * 0.5 : 30 + Math.random() * 10,
    })),
    concurrentData: Array.from({ length: 33 }, (_, i) => ({
      timestamp: new Date('2026-03-13T09:00:00Z').getTime() + i * 10000,
      value: 150,
    })),
    percentiles: [
      {
        api: '/v1/home', requests: 139590, errors: 48857, errorRate: 0.350, p50: 890, p75: 1456, p90: 3200, p95: 5600, p99: 8900, max: 15000, min: 45,
        rpsData:          Array.from({ length: 33 }, (_, i) => ({ timestamp: new Date('2026-03-13T09:00:00Z').getTime() + i * 10000, value: i < 15 ? 800 + Math.random() * 100 : 200 + Math.random() * 100 })),
        responseTimeData: Array.from({ length: 33 }, (_, i) => ({ timestamp: new Date('2026-03-13T09:00:00Z').getTime() + i * 10000, value: i < 15 ? 200 + Math.random() * 50 : 2000 + Math.random() * 500 })),
        errorRateData:    Array.from({ length: 33 }, (_, i) => ({ timestamp: new Date('2026-03-13T09:00:00Z').getTime() + i * 10000, value: i < 15 ? 0.5 + Math.random() * 0.5 : 30 + Math.random() * 10 })),
      },
    ],
    errors: [
      { code: 'TIMEOUT',            message: 'context deadline exceeded (5000ms)', errorType: 'system',   count: 28934, percentage: 59.2 },
      { code: 'CONNECTION_REFUSED', message: 'dial tcp: connection refused',       errorType: 'system',   count: 14523, percentage: 29.7 },
      { code: '50001',              message: '服务内部错误',                         errorType: 'business', count: 5400,  percentage: 11.1 },
    ],
    createdAt: '2026-03-13T09:05:35Z',
    scriptSnapshots: [
      { scriptId: 'script001', scriptName: 'http_login', commitHash: 'a3f8c1d2e4b5', weight: 100 },
    ],
    workerSnapshots: [
      { workerId: 'worker-node-04', hostname: 'stress-worker-04', ip: '10.0.1.14', cpuCores: 8, maxConcurrency: 2000 },
      { workerId: 'worker-node-05', hostname: 'stress-worker-05', ip: '10.0.1.15', cpuCores: 8, maxConcurrency: 2000 },
    ],
  },
  {
    id: 'report003',
    taskId: 'task006',
    taskName: '容量验证 RPS 300',
    executionId: 'exec006',
    status: 'success',
    startTime: '2026-03-19T09:00:00Z',
    endTime: '2026-03-19T09:03:00Z',
    duration: 180,
    scenarioMode: 'rps',
    targetRps: 300,
    summary: {
      rps: 296,
      avgResponseTime: 92,
      p99ResponseTime: 318,
      errorRate: 0.0008,
      totalRequests: 53280,
      successRequests: 53237,
      failedRequests: 43,
      concurrent: 28,
    },
    // RPS 曲线：0→20s 线性爬升，20s→126s 平稳 ~300，126s→180s 轻微抖动
    rpsData: Array.from({ length: 54 }, (_, i) => {
      const elapsed = i * (180 / 54)
      const warmupProgress = Math.min(elapsed / 20, 1)
      const stressFactor = Math.max(0, (elapsed - 180 * 0.7) / (180 * 0.3))
      const base = 300 * warmupProgress
      const jitter = stressFactor > 0 ? (Math.random() - 0.5) * 20 : (Math.random() - 0.5) * 10
      return {
        timestamp: new Date('2026-03-19T09:00:00Z').getTime() + i * (180000 / 54),
        value: Math.max(0, base + jitter),
      }
    }),
    // RT 曲线：稳定期 ~85-95ms，后期缓慢抬升至 ~130ms
    responseTimeData: Array.from({ length: 54 }, (_, i) => {
      const elapsed = i * (180 / 54)
      const stressFactor = Math.max(0, (elapsed - 180 * 0.7) / (180 * 0.3))
      return {
        timestamp: new Date('2026-03-19T09:00:00Z').getTime() + i * (180000 / 54),
        value: 85 + stressFactor * stressFactor * 50 + Math.random() * 8,
      }
    }),
    errorRateData: Array.from({ length: 54 }, (_, i) => ({
      timestamp: new Date('2026-03-19T09:00:00Z').getTime() + i * (180000 / 54),
      value: Math.random() * 0.05,
    })),
    // 并发随 RT 略微增大（Little's Law: C = RPS × RT）
    concurrentData: Array.from({ length: 54 }, (_, i) => {
      const elapsed = i * (180 / 54)
      const warmupProgress = Math.min(elapsed / 20, 1)
      const stressFactor = Math.max(0, (elapsed - 180 * 0.7) / (180 * 0.3))
      const rps = 300 * warmupProgress
      const rt = (85 + stressFactor * stressFactor * 50) / 1000
      return {
        timestamp: new Date('2026-03-19T09:00:00Z').getTime() + i * (180000 / 54),
        value: Math.max(1, Math.ceil(rps * rt)),
      }
    }),
    percentiles: [
      {
        api: '/v1/search', requests: 26640, errors: 21, errorRate: 0.00079, p50: 72, p75: 95, p90: 138, p95: 189, p99: 318, max: 512, min: 11,
        rpsData:          Array.from({ length: 54 }, (_, i) => ({ timestamp: new Date('2026-03-19T09:00:00Z').getTime() + i * (180000 / 54), value: Math.max(0, 180 * Math.min((i * (180/54)) / 20, 1) + (Math.random() - 0.5) * 10) })),
        responseTimeData: Array.from({ length: 54 }, (_, i) => ({ timestamp: new Date('2026-03-19T09:00:00Z').getTime() + i * (180000 / 54), value: 72 + Math.random() * 8 })),
        errorRateData:    Array.from({ length: 54 }, (_, i) => ({ timestamp: new Date('2026-03-19T09:00:00Z').getTime() + i * (180000 / 54), value: Math.random() * 0.04 })),
      },
      {
        api: '/v1/login',  requests: 26640, errors: 22, errorRate: 0.00083, p50: 88, p75: 112, p90: 156, p95: 210, p99: 298, max: 445, min: 18,
        rpsData:          Array.from({ length: 54 }, (_, i) => ({ timestamp: new Date('2026-03-19T09:00:00Z').getTime() + i * (180000 / 54), value: Math.max(0, 120 * Math.min((i * (180/54)) / 20, 1) + (Math.random() - 0.5) * 8) })),
        responseTimeData: Array.from({ length: 54 }, (_, i) => ({ timestamp: new Date('2026-03-19T09:00:00Z').getTime() + i * (180000 / 54), value: 88 + Math.random() * 10 })),
        errorRateData:    Array.from({ length: 54 }, (_, i) => ({ timestamp: new Date('2026-03-19T09:00:00Z').getTime() + i * (180000 / 54), value: Math.random() * 0.04 })),
      },
    ],
    errors: [
      { code: 'TIMEOUT', message: 'context deadline exceeded (5000ms)', errorType: 'system', count: 43, percentage: 100 },
    ],
    createdAt: '2026-03-19T09:03:05Z',
    scriptSnapshots: [
      { scriptId: 'script002', scriptName: 'http_search', commitHash: 'b7e9f2a1c3d6', weight: 60 },
      { scriptId: 'script001', scriptName: 'http_login', commitHash: 'a3f8c1d2e4b5', weight: 40 },
    ],
    workerSnapshots: [
      { workerId: 'worker-node-04', hostname: 'stress-worker-04', ip: '10.0.1.14', cpuCores: 8, maxConcurrency: 2000 },
      { workerId: 'worker-node-05', hostname: 'stress-worker-05', ip: '10.0.1.15', cpuCores: 8, maxConcurrency: 2000 },
    ],
  },
]

