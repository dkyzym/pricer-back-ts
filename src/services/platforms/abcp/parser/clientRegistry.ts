import { createHtmlClient } from './createHtmlClient.js';
import { autoImpulseClient } from '../../../suppliers/autoImpulse/client.js';
import { mikanoClient } from '../../../suppliers/mikano/client.js';

type AbcpClient = ReturnType<typeof createHtmlClient>;

const clientMap: Record<string, AbcpClient> = {
  mikano: mikanoClient,
  autoImpulse: autoImpulseClient,
};

export const resolveHtmlClient = (supplierName: string): AbcpClient => {
  const client = clientMap[supplierName];
  if (!client) {
    throw new Error(`ABCP-клиент для поставщика «${supplierName}» не найден`);
  }
  return client;
};
