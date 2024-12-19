import axios from 'axios';
import { logger } from 'config/logger';
import { AddToCartConfig } from 'types';

export const addToCartProfitService = async ({
  id,
  warehouse,
  quantity,
  code,
}: AddToCartConfig) => {
  try {
    const apiKey = process.env.PROFIT_API_KEY;

    if (!apiKey) {
      throw new Error('Отсутствует API ключ для Profit');
    }

    const url = `https://api.pr-lg.ru/cart/add?secret=${apiKey}`;
    const payload = {
      id, // innerId
      warehouse, // warehouse_id
      quantity, // количество
      code, // inner_product_code
    };

    // Отправка POST-запроса к внешнему API
    const response = await axios.post(url, payload);

    // Возврат данных ответа
    return response.data;
  } catch (error) {
    // Логирование ошибки
    logger.error('Ошибка при добавлении в корзину:', error);

    // Генерация ошибки для дальнейшей обработки в контроллере
    throw new Error('Не удалось добавить товар в корзину');
  }
};
