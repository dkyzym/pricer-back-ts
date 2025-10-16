import { logger } from '../config/logger/index.js';
import {
  clientAutoImpulse,
  ensureAutoImpulseLoggedIn,
  loginAutoImpulse,
} from '../services/autoimpulse/loginAutoImpulse.js';

export const makeAutoImpulseRequest = async (
  url: string, options: any = {}
) => {
  try {
    await ensureAutoImpulseLoggedIn();
    const response = await clientAutoImpulse.get(url, options);

    // Check if the response indicates we're not logged in
    if (!response.data.includes('Кизим') || response.status === 401) {
      logger.info('Session expired, re-logging in...');
      await loginAutoImpulse();
      // Retry the request after re-login
      return await clientAutoImpulse.get(url, options);
    }

    return response;
  } catch (error) {
    logger.error('Error making request:', error);
    throw error;
  }
};
