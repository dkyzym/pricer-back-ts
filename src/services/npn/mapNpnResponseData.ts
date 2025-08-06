import { v4 as uuidv4 } from 'uuid';
import { Logger } from 'winston';
import {
  SearchResultsParsed,
  abcpArticleSearchResult,
} from '../../types/index.js';
import { calculateDeliveryDate } from '../../utils/calculateDates/index.js';
import { suppliersConfig } from '../../utils/calculateDates/suppliersConfig/suppliersConfig.js';
import { isRelevantBrand } from '../../utils/isRelevantBrand.js';
import { calculateNpnDeadlineHours } from '../../utils/npn/calculateNpnDeadline.js';

export const mapNpnResponseData = (
  data: abcpArticleSearchResult[],
  brand: string,
  userLogger: Logger,
  supplier: 'npn'
): SearchResultsParsed[] => {
  // Находим конфиг для текущего поставщика один раз
  const supplierConfig = suppliersConfig.find(
    (c) => c.supplierName === supplier
  );

  const mappedResponseData: Omit<SearchResultsParsed, 'deliveryDate'>[] =
    data.map((item) => {
      let deadlines = {
        deadline: item.deliveryPeriod || 24,
        deadLineMax: item.deliveryPeriodMax || item.deliveryPeriod || 24,
      };

      // Если поставщик - 'npn' и мы нашли его конфиг, вызываем расчет с доп. параметром
      if (supplier === 'npn' && supplierConfig) {
        deadlines = calculateNpnDeadlineHours(
          item,
          supplierConfig.workingDays,
          userLogger
        );
      } else if (supplier === 'npn') {
        // Запасной вариант, если конфиг не найден
        userLogger.warn(
          `[NPN] Конфигурация для поставщика не найдена. Расчет часов может быть неточным.`
        );
        deadlines = calculateNpnDeadlineHours(item, [], userLogger); // Передаем пустой массив
      }

      // --- Используем реальную вероятность поставки из API ---
      const probability =
        item.deliveryProbability > 0 ? item.deliveryProbability : 95;

      return {
        id: uuidv4(),
        article: item.number,
        brand: item.brand,
        description: item.description,
        availability: item.availability,
        price: item.price,
        warehouse: item.supplierDescription,
        imageUrl: '',
        deadline: deadlines.deadline,
        deadLineMax: deadlines.deadLineMax,
        deadlineReplace: item.deadlineReplace,
        supplier: supplier,
        probability, // Используем значение из API
        needToCheckBrand: !isRelevantBrand(brand, item.brand),
        returnable: Number(!item.noReturn),
        multi: item.packing || 1,
        allow_return: !item.noReturn,
        warehouse_id: String(item.supplierCode),
        inner_product_code: item.itemKey,
        [supplier]: {
          itemKey: item.itemKey,
          supplierCode: String(item.supplierCode),
        },
      };
    });

  const resultsWithFinalDeliveryDate = mappedResponseData.map((result) => {
    const deliveryDate = calculateDeliveryDate(
      result as SearchResultsParsed,
      userLogger
    );

    return {
      ...result,
      deliveryDate,
    };
  });

  return resultsWithFinalDeliveryDate;
};
