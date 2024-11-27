import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';

const cookieJar = new CookieJar();
const client = wrapper(axios.create({ jar: cookieJar }));

export const getAutocomplete = async (term: string) => {
  const url = `https://ugautopart.ru/ajax/modules2/search.tips/get`;
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    Accept: 'application/json, text/javascript, */*; q=0.01',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7,uk;q=0.6,sr;q=0.5',
    'X-Requested-With': 'XMLHttpRequest',
  };

  try {
    await client.get('https://ugautopart.ru/', {
      headers: headers,
    });

    const response = await client.get(url, {
      params: {
        term: term,
        locale: 'ru_RU',
      },
      headers: headers,
    });

    return response.data;
  } catch (error) {
    console.error('Ошибка при получении автокомплита:', error);
    throw error;
  }
};
