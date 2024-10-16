import axios from 'axios';
import { logger } from '../../config/logger';

const apiKey = process.env.PROFIT_API_KEY;

try {
  const url = `https://api.pr-lg.ru/cart/add?secret=${apiKey}`;
  const payload = {
    id: 54479, // id
    warehouse: 32, // someID.warehouse_id
    quantity: 1,
    code: '1eaadb093ac2d5b5dd760a7b7eccd8d6', // someID.product_code
  };

  const response = await axios.post(url, payload);
} catch (error) {
  logger.http('Ошибка при добавлении в корзину:', error);
}
