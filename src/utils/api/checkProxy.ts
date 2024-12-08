import axios, { AxiosError } from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';

/**
 * checkProxy - Checks if the proxy is working by requesting an IP check service.
 * @param agent - The proxy agent instance
 * @returns boolean - true if proxy works, otherwise false
 */
export const checkProxy = async (
  agent: HttpsProxyAgent<string>
): Promise<boolean> => {
  try {
    // Creating a test axios instance with the proxy agent
    const testInstance = axios.create({
      httpAgent: agent,
      httpsAgent: agent,
      timeout: 5000,
    });

    // Using a simple IPify service to check what IP is seen through the proxy
    const response = await testInstance.get('http://api.ipify.org?format=json');
    console.log('IP through proxy:', response.data);
    return true;
  } catch (error) {
    console.error('Proxy check error:', (error as AxiosError).message);
    return false;
  }
};
