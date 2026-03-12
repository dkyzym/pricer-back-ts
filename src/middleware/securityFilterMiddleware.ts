import type { RequestHandler } from 'express';
import { logger } from '../config/logger/index.js';

const blockedIPs = new Set<string>();
const BLOCKED_PATHS = ['.php', '/wp-admin', '/wp-includes', '.env', '.git'];

export const securityFilter: RequestHandler = (req, res, next) => {
  const clientIp = req.ip;

  if (clientIp && blockedIPs.has(clientIp)) {
    req.socket.destroy();
    return;
  }

  const url = req.url.toLowerCase();
  const isScanner = BLOCKED_PATHS.some(path => url.includes(path));

  if (isScanner) {
    if (clientIp) {
      blockedIPs.add(clientIp);
    }
    // Пишем в наш кастомный логгер (warn уровень), чтобы видеть активность,
    logger.warn(`[Security] IP ${clientIp || 'Unknown'} blocked. Malicious path: ${req.url}`);
    
    req.socket.destroy();
    return;
  }

  next();
};
