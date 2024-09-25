import axios from 'axios';
import { itemsGroupProfit } from 'types';

export const getItemsWithRest = async (items: itemsGroupProfit) => {
  const apiKey = process.env.PROFIT_API_KEY;

  if (!apiKey) {
    throw new Error('API key is not defined');
  }

  try {
    const uri = `https://api.pr-lg.ru/search/items?secret=${apiKey}&article=${items[0].article}&brand=${items[0].brand}`;
    const res = await axios.get(uri);

    return res.data;
  } catch (error) {
    console.error(`getItemsWithRest ${error}`);
    throw error; // Или return []
  }
};

// interface ItemResult {
//   success: boolean;
//   data?: any; // Замените `any` на конкретный тип данных, который вы ожидаете
//   error?: any; // Замените `any` на конкретный тип ошибки, если требуется
//   //   item: itemProfit; // Тип отдельного элемента из itemsGroupProfit
// }

// export const getItemsWithRest = async (
//   items: itemsGroupProfit
// ): Promise<ItemResult[]> => {
//   const apiKey = process.env.PROFIT_API_KEY;

//   if (!apiKey) {
//     throw new Error(
//       'API ключ PROFIT_API_KEY не установлен в переменных окружения.'
//     );
//   }

//   try {
//     const promises = items.map((item) => {
//       const uri = `https://api.pr-lg.ru/search/items?secret=${apiKey}&article=${item.article}&brand=${item.brand}`;
//       return axios.get(uri);
//     });

//     const results = await Promise.allSettled(promises);

//     const finalResults: ItemResult[] = results.map((result, index) => {
//       const currentItem = items[index];

//       if (result.status === 'fulfilled') {
//         return {
//           data: result.value.data,
//           //   success: true,
//           //   data: result.value.data, // Здесь можно извлечь нужные данные из ответа
//           //   item: currentItem,
//         };
//       } else {
//         console.error(
//           `Ошибка при получении данных для артикля ${currentItem.article} и бренда ${currentItem.brand}:`,
//           result.reason.message
//         );
//         return {
//           success: false,
//           error: result.reason, // Можно сохранить всю ошибку или только сообщение
//           item: currentItem,
//         };
//       }
//     });

//     return finalResults;
//   } catch (error) {
//     // Этот блок catch сработает только в случае ошибок, возникающих вне Promise.allSettled
//     console.error('Неожиданная ошибка при обработке запросов:', error);
//     throw error;
//   }
// };
