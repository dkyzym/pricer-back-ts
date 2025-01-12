import axios from 'axios';
import { CartContentAutosputnik } from '../../../types/autosputnik.js';

export const getAutosputnikCart = async () => {
  const login = process.env.AUTOSPUTNIK_LOGIN;
  const pass = process.env.AUTOSPUTNIK_PASS;
  const URL = 'https://api.auto-sputnik.ru/get_api_basket.php';
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
      },
    };
    const response = await axios.post(URL, payload);

    if (response.data.error) {
      throw new Error(response.data.error);
    }

    return response.data as CartContentAutosputnik;
  } catch (error) {
    console.error('Error adding to cart from Autosputnik API:', error);
    throw error;
  }
};
