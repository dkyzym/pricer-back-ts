import { SOCKET_EVENTS } from '../constants/socketEvents.js';
import { getSocketIo } from './socketServerRegistry.js';

/** Минимальный payload для инвалидации кэша корзины на клиенте администратора. */
export type NotifyVirtualCartChangedPayload = {
  reason?: string;
};

/**
 * Уведомляет всех подключённых администраторов об изменении виртуальной корзины.
 * Без активного Socket.IO — no-op, чтобы контроллеры не падали при тестах без сервера.
 */
export const notifyAdminsVirtualCartChanged = (
  payload: NotifyVirtualCartChangedPayload = {}
): void => {
  const io = getSocketIo();
  if (!io) return;
  io.to('admin').emit(SOCKET_EVENTS.VIRTUAL_CART_CHANGED, payload);
};
