import { DefaultAbcpStrategy } from './DefaultAbcpStrategy.js';
import { MasAbcpStrategy } from './MasAbcpStrategy.js';
import type { IAbcpCartStrategy } from './types.js';

export const getAbcpStrategy = (supplierName: string): IAbcpCartStrategy => {
  if (supplierName === 'autoImpulse') {
    return new MasAbcpStrategy();
  }
  return new DefaultAbcpStrategy();
};
