import { Router } from 'express';
import { ctrlWrapper } from 'middleware/ctrlWrapper.js';
import { logsController } from '../controllers/logsController.js';

const router = Router();

/**
 * GET /api/logs?date=YYYY-MM-DD
 * Пример: /api/logs?date=2025-03-14
 * Возвращает массив JSON-объектов (логи) за указанный день.
 **/
router.get('/logs', ctrlWrapper(logsController));

export default router;
