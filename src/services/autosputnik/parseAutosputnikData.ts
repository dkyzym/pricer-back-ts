import { DateTime } from 'luxon';
import { v4 as uuidV4 } from 'uuid';
import { Logger } from 'winston';
import { SearchResultsParsed } from '../../types/search.types.js';
import { calculateDeliveryDate } from '../../utils/calculateDates/calculateDeliveryDate.js';
import { isRelevantBrand } from '../../utils/data/brand/isRelevantBrand.js';
import { transformArticleByBrand } from '../../utils/data/brand/transformArticleByBrand.js';
import { AutosputnikProductItem } from './autosputnik.types.js';
import {
  getAutosputnikBrands,
  getAutosputnikProducts,
} from './autosputnikApi.js';

export const parseAutosputnikData = async (
  item: {
    article: string;
    brand: string;
  },
  userLogger: Logger,
  supplier: 'autosputnik' | 'autosputnik_bn'
) => {
  try {
    const articleToSearch = transformArticleByBrand(
      item.article,
      item.brand,
      supplier
    );

    // 1. Получаем бренды
    const brandsResponse = await getAutosputnikBrands(
      articleToSearch,
      userLogger,
      supplier
    );

    if (
      brandsResponse.error ||
      !Array.isArray(brandsResponse.data) ||
      brandsResponse.data.length === 0
    ) {
      return [];
    }

    // 2. Фильтруем (собираем имена брендов для запроса)
    const uniqueBrandNames = new Set<string>();

    brandsResponse.data.forEach((brandItem) => {
      const apiBrandName = brandItem.brand.name;
      if (isRelevantBrand(item.brand, apiBrandName)) {
        uniqueBrandNames.add(apiBrandName);
      }
    });

    if (uniqueBrandNames.size === 0) {
      return [];
    }

    // 3. Запрашиваем цены (параллельно по каждому бренду)
    const promises = Array.from(uniqueBrandNames).map((brandName) =>
      getAutosputnikProducts(articleToSearch, brandName, userLogger, supplier)
    );

    const results = await Promise.allSettled(promises);

    const allProducts: AutosputnikProductItem[] = [];

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        const payload = result.value;
        if (!payload.error && Array.isArray(payload.data)) {
          allProducts.push(...payload.data);
        }
      }
    });

    // 4. Преобразуем в наш формат
    const parsedResults: SearchResultsParsed[] = allProducts.map((prod) => {
      const deliveryDt = DateTime.fromISO(prod.delivery_date);

      const newItem: any = {
        id: uuidV4(),
        article: prod.articul,
        availability: String(prod.quantity),
        brand: prod.brand.name,
        price: Number(prod.price),
        allow_return: prod.vozvrat,
        supplier,
        warehouse: prod.price_name || 'Autosputnik',
        imageUrl: '',

        // Дата доставки
        deliveryDate: deliveryDt.isValid
          ? deliveryDt.toFormat('yyyy-MM-dd')
          : '',

        multi: Number(prod.cratnost),

        // Новая логика вероятности
        // probability: calculateProbability(prod),
        probability: prod.shipping_proc === 0 ? 80 : prod.shipping_proc,

        warehouse_id: String(prod.id_shop_prices),
        description: prod.name,
        [supplier]: {
          brand: String(prod.brand.id),
          id_shop_prices: String(prod.id_shop_prices),
        },
        deadline: Number(prod.delivery_day) * 24,
        deadLineMax: Number(prod.delivery_day) * 24,
      };

      return {
        ...newItem,
        deliveryDate: calculateDeliveryDate(newItem, userLogger),
      };
    });

    return parsedResults;
  } catch (error) {
    userLogger.error('Error in parseAutosputnikData:', error);
    throw error;
  }
};
