import { Router } from 'express';
import os from 'os';
import { performance, monitorEventLoopDelay } from 'node:perf_hooks';
import { HEALTH_METRICS_TOKEN } from 'config/index.js';
import { probeUgAutocomplete } from '../services/catalog/probeUgAutocomplete.js';

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

/**
 * Проверка доступности цепочки автокомплита UG (внешний сайт). Тот же токен, что у /health/detailed.
 * Не дергать агрессивно — каждый вызов бьёт по ugautopart.ru.
 */
router.get('/health/autocomplete-ug', async (req, res) => {
  const token = req.get('x-metrics-token');
  if (!HEALTH_METRICS_TOKEN || token !== HEALTH_METRICS_TOKEN) {
    res.status(404).json({ success: false, message: 'Not found' });
    return;
  }

  try {
    const probe = await probeUgAutocomplete();
    res.json({ success: true, probe });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, message });
  }
});

export default router;
