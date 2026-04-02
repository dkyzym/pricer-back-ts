import { AutoImpulseCartStrategy } from './AutoImpulseCartStrategy.js';
import { MikanoCartStrategy } from './MikanoCartStrategy.js';
import type { IAbcpCartStrategy } from './abcpStrategy.types.js';

export const getAbcpStrategy = (supplierName: string): IAbcpCartStrategy => {
  if (supplierName === 'autoImpulse') {
    return new AutoImpulseCartStrategy();
  }
  return new MikanoCartStrategy();
};
