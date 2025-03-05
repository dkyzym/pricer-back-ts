import axios from 'axios';

export async function getLocalIP(): Promise<string> {
  const res = await axios.get<{ ip: string }>(
    'https://api.ipify.org?format=json',
    {
      timeout: 5000,
    }
  );
  return res.data.ip;
}
