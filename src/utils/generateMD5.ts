import { createHash } from 'crypto';

export const generateMD5 = (data: string) => {
  return createHash('md5').update(data).digest('hex');
};
