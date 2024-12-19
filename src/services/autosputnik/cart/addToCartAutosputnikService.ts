import axios from 'axios';
import { addToCartAutosputnikData } from '../../../types';
import { AddToCardAutosputnik } from '../../../types/autosputnik';

export const addToCartAutosputnikService = async (
  data: addToCartAutosputnikData
) => {
  const CART_URL = 'https://api.auto-sputnik.ru/orders_new.php';

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
      },
      data: data,
    };
    const response = await axios.post(CART_URL, payload);
    console.log(response.data);
    if (response.data.error) {
      throw new Error(response.data.error);
    }

    return response.data as AddToCardAutosputnik;
  } catch (error) {
    console.error('Error adding to cart from Autosputnik API:', error);
    throw error;
  }
};
