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

/**
 * из нашего объекта.
 */
// добавить бы к товару больше параметров. returnable, multi, allow_return

`
"e6e4c16850a2e84cca08b00f6bc4602e": {
"donkey": "d2e35577c22cb67091eff285ce7345c8",
"warehouse_id": "32",
"brand_id": 2996,
"brand": "HI-Q",
"article": "SP1165",
"product_code": "1eaadb093ac2d5b5dd760a7b7eccd8d6",
"multi": 1,
"quantity": ">50",
"price": 903.21,
"returnable": -1,
"description": "КОЛОДКА ПЕРЕДНЯЯ SANGSIN ВАЗ-2108",
"article_id": "54479",
"return_days": 10,
"brand_info": true,
"brand_warranty": false,
"original": false,
"waitings": 0,
"custom_warehouse_name": "ЮФО-UT7",
"show_date": "26 ч.",
"delivery_time": 26,
"allow_return": "1",
"delivery_date": "2024-10-26 08:30:00",
"delivery_probability": 92.39
},
`;
