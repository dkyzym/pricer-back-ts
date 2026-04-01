import { Logger } from 'winston';
import { ICartItemDocument } from '../../../models/CartItem.js';
import { CheckoutHandler, CheckoutResult } from '../cart/cart.types.js';
import { armtekCheckoutHandler } from '../../suppliers/armtek/armtekCheckoutService.js';
import { turboCarsCheckoutHandler } from '../../suppliers/turboCars/turboCarsCheckoutService.js';
import { createAbcpCheckoutHandler } from '../../platforms/abcp/abcpCheckoutService.js';
import { profitCheckoutHandler } from '../../suppliers/profit/profitCheckoutService.js';
import { manualCheckoutHandler } from './manualCheckoutService.js';
import { autosputnikCheckoutHandler } from '../../suppliers/autosputnik/autosputnikCheckoutService.js';
import { avtoPartnerCheckoutHandler } from '../../suppliers/avtopartner/avtopartnerCheckoutService.js';

// ─────────────────────────────────────────────────────────────────────────────
//  Вспомогательная фабрика «заглушки»
// ─────────────────────────────────────────────────────────────────────────────

/** Паттерн «Factory» — создаёт именованную заглушку, логирующую вызов. */
const notImplemented =
  (supplierKey: string): CheckoutHandler =>
  async (items: ICartItemDocument[], userLogger: Logger): Promise<CheckoutResult> => {
    userLogger.warn(`[CheckoutHandler] ${supplierKey}: адаптер не реализован`, {
      itemCount: items.length,
    });
    return {
      success: false,
      cartItemIds: items.map((i) => String(i._id)),
      error: 'Not implemented',
    };
  };

// ─────────────────────────────────────────────────────────────────────────────
//  Armtek  →  реализация в armtekCheckoutService.ts (тестовый endpoint)
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
//  TurboCars  →  реализация в turboCarsCheckoutService.ts (тестовый режим)
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
//  ABCP  (покрывает: ug, patriot, npn и аналогичные ABCP-площадки)
//  Реализация: createAbcpCheckoutHandler (abcpCheckoutService.ts)
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
//  Profit  →  реализация в profitCheckoutService.ts
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
//  Autosputnik  →  реализация в autosputnikCheckoutService.ts
//                   (basket/clear → basket/add; финальный order endpoint не документирован)
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
//  AvtoPartner  →  реализация в avtopartnerCheckoutService.ts
//                   (Drupal Commerce: add-to-cart scraping → /checkout/{orderId} form submit)
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
//  Реестр обработчиков checkout (Паттерн «Registry / Strategy»)
//  Ключи соответствуют значениям поля `supplier` в ICartItemDocument.
// ─────────────────────────────────────────────────────────────────────────────

export const checkoutHandlers: Record<string, CheckoutHandler> = {
  armtek: armtekCheckoutHandler,
  turboCars: turboCarsCheckoutHandler,
  profit: profitCheckoutHandler,
  autosputnik: autosputnikCheckoutHandler,
  autosputnik_bn: autosputnikCheckoutHandler,

  /** ABCP-площадки — фабрика создаёт адаптер под конкретный supplierAlias (аккаунт/витрину). */
  ug: createAbcpCheckoutHandler('ug'),
  ug_f: createAbcpCheckoutHandler('ug_f'),
  ug_bn: createAbcpCheckoutHandler('ug_bn'),
  patriot: createAbcpCheckoutHandler('patriot'),
  npn: createAbcpCheckoutHandler('npn'),
  avtodinamika: createAbcpCheckoutHandler('avtodinamika'),

  /** HTML-скраперы — ручное оформление на сайте поставщика. */
  mikano: manualCheckoutHandler,
  autoImpulse: manualCheckoutHandler,

  /** Drupal Commerce — автоматическое оформление через scraping checkout-формы. */
  avtoPartner: avtoPartnerCheckoutHandler,
};
