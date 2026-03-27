import { Router } from 'express';
import os from 'os';
import { performance, monitorEventLoopDelay } from 'node:perf_hooks';
import { HEALTH_METRICS_TOKEN } from 'config/index.js';

/**
 * Мониторинг задержки event loop: фиксирует max/min за интервал между запросами к /detailed.
 * Замыкание держит ссылку на Histogram — один экземпляр на процесс, без утечки по запросам.
 */
const eventLoopHistogram = monitorEventLoopDelay({ resolution: 20 });
eventLoopHistogram.enable();

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptimeSeconds: Math.floor(process.uptime()) });
});

router.get('/health/detailed', (req, res) => {
  const token = req.get('x-metrics-token');
  if (!HEALTH_METRICS_TOKEN || token !== HEALTH_METRICS_TOKEN) {
    res.status(404).json({ success: false, message: 'Not found' });
    return;
  }

  const mem = process.memoryUsage();
  const elMin = eventLoopHistogram.min;
  const elMax = eventLoopHistogram.max;
  const elMean = eventLoopHistogram.mean;
  eventLoopHistogram.reset();

  res.json({
    collectedAt: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    memoryBytes: {
      rss: mem.rss,
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external,
      arrayBuffers: mem.arrayBuffers,
    },
    cpuUsageMicros: process.cpuUsage(),
    eventLoopDelayNs: { min: elMin, max: elMax, mean: elMean },
    host: {
      loadAvg: os.loadavg(),
      freeMem: os.freemem(),
      totalMem: os.totalmem(),
    },
    hrTimeMs: Math.round(performance.now()),
  });
});

export default router;
