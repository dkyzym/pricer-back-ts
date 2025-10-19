import { Logger } from 'winston';

import { handleArmtek } from './suppliers/armtekHandler.js';
import { handleAutoImpulse } from './suppliers/autoImpulseHandler.js';
import { handleAutosputnik } from './suppliers/autosputnikHandler.js';
import { handleAvtodinamika } from './suppliers/avtodinamikaHandler.js';
import { handleAvtoPartner } from './suppliers/avtoPartner.js';
import { handleMikano } from './suppliers/mikanoHandler.js';
import { handleNpn } from './suppliers/npnHandler.js';
import { handlePatriot } from './suppliers/patriotHandler.js';
import { handleProfit } from './suppliers/profitHandler.js';
import { handleUg } from './suppliers/ugHandler.js';
import { getItemResultsParams, SearchResultsParsed } from '../../types/search.types.js';

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
  armtek: handleArmtek,
  npn: handleNpn,
  avtodinamika: handleAvtodinamika,
  avtoPartner: handleAvtoPartner,
};
