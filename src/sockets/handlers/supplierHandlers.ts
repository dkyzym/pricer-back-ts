import { Logger } from 'winston';
import {
  getItemResultsParams,
  SearchResultsParsed,
} from '../../types/index.js';
import { handleArmtek } from './armtekHandler.js';
import { handleAutoImpulse } from './autoImpulseHandler.js';
import { handleAutosputnik } from './autosputnikHandler.js';
import { handleMikano } from './mikanoHandler.js';
import { handleNpn } from './npnHandler.js';
import { handlePatriot } from './patriotHandler.js';
import { handleProfit } from './profitHandler.js';
import { handleTurboCars } from './turboCarsHandler.js';
import { handleUg } from './ugHandler.js';

type SupplierHandler = (
  data: getItemResultsParams,
  userLogger: Logger
) => Promise<SearchResultsParsed[]>;

export const supplierHandlers: Record<string, SupplierHandler> = {
  profit: handleProfit,
  autosputnik: handleAutosputnik,
  autosputnik_bn: handleAutosputnik,
  ug: handleUg,
  ug_f: handleUg,
  ug_bn: handleUg,
  patriot: handlePatriot,
  autoImpulse: handleAutoImpulse,
  mikano: handleMikano,
  turboCars: handleTurboCars,
  armtek: handleArmtek,
  npn: handleNpn,
};
