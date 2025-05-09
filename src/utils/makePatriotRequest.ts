// import { logger } from '../config/logger/index.js';
// import {
//   clientPatriot,
//   ensurePatriotLoggedIn,
//   loginPatriot,
// } from '../services/patriot/loginPartiot.js';

// export const makePatriotRequest = async (url: string, options: any = {}) => {
//   try {
//     await ensurePatriotLoggedIn();
//     const response = await clientPatriot.get(url, options);

//     // Check if the response indicates we're not logged in
//     if (!response.data.includes('Кизим') || response.status === 401) {
//       logger.info('Session expired, re-logging in...');
//       await loginPatriot();
//       // Retry the request after re-login
//       return await clientPatriot.get(url, options);
//     }

//     return response;
//   } catch (error) {
//     logger.error('Error making request:', error);
//     throw error;
//   }
// };
