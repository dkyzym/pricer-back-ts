import axios from 'axios';
// import { logger } from '../../config/logger';

export const getAutosputnikItemsListByArticleService = async (
  article: string,
  brandId?: string
) => {
  const BASE_URL = 'https://api.auto-sputnik.ru/search_result.php';
  const login = process.env.AUTOSPUTNIK_LOGIN;
  const pass = process.env.AUTOSPUTNIK_PASS;

  if (!login || !pass) {
    throw new Error(
      'Missing AUTOSPUTNIK_LOGIN or AUTOSPUTNIK_PASS in environment variables'
    );
  }

  try {
    const payload = {
      options: {
        login,
        pass,
        datatyp: 'json',
        storage: 'tranzit',
      },
      data: {
        brand: brandId || '',
        articul: article,
      },
    };

    const response = await axios.post(BASE_URL, payload, {
      headers: { 'Content-Type': 'application/json' },
    });

    if (response.data.error) {
      throw new Error(response.data.error);
    }

    // logger.info(chalk.yellow(JSON.stringify(response?.data)));
    return response.data;
  } catch (error) {
    console.error('Error fetching data from Autosputnik API:', error);
    throw error;
  }
};
