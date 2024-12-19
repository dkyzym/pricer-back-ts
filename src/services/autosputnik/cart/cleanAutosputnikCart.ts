import axios, { AxiosError } from 'axios';

export const cleanAutosputnikCart = async () => {
  const login = process.env.AUTOSPUTNIK_LOGIN;
  const pass = process.env.AUTOSPUTNIK_PASS;
  const URL = 'https://api.auto-sputnik.ru/api_del_basket.php';

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
    await axios.post(URL, payload);
  } catch (error) {
    console.log(error as AxiosError);
    throw error;
  }
};
