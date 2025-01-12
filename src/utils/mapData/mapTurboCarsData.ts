import { XMLParser } from 'fast-xml-parser';
import { v4 as uuidv4 } from 'uuid';
import { SearchResultsParsed } from '../../types/index.js';
import { calculateDeliveryDate } from '../calculateDates/index.js';
import { isBrandMatch } from '../data/isBrandMatch.js';

// Нормализация бренда
const normalizeBrandNameExtended = (
  brand: string | null | undefined
): string[] => {
  if (!brand) return [];
  const normalized = brand.replace(/\s+/g, '').toLowerCase();
  const parts = normalized
    .split(/[()]/)
    .filter(Boolean)
    .map((p) => p.trim());
  return parts.length > 1 ? [normalized, ...parts] : [normalized];
};

const convertDeliveryDelayToHours = (deliveryDelayDays: number): number => {
  return deliveryDelayDays === 0 ? 1 : deliveryDelayDays * 24;
};

export const parseXmlToSearchResults = (
  xmlString: string,
  brandToMatch: string,
  withAnalogsFlag: 0 | 1
): SearchResultsParsed[] => {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    removeNSPrefix: true,
  });

  const parsedResult = parser.parse(xmlString);
  const codeListRows = Array.isArray(
    parsedResult.Code_List?.List?.Code_List_Row
  )
    ? parsedResult.Code_List.List.Code_List_Row
    : [parsedResult.Code_List.List.Code_List_Row].filter(Boolean);

  const results: SearchResultsParsed[] = [];

  // Подготовим варианты для искомого бренда
  const brandVariantsToMatch = normalizeBrandNameExtended(brandToMatch);

  for (const row of codeListRows) {
    const codeType = row.CodeType as string;

    // Аналоги игнорируем при withAnalogsFlag=0
    if (codeType === 'Analog' && withAnalogsFlag === 0) {
      continue;
    }
    const zakazCode = row.ZakazCode as string;
    const producerBrand = row.ProducerBrand as string;
    const producerCode = row.ProducerCode as string;
    const nameValue = row.Name as string;
    const parsedPrice = parseFloat(row.PriceRUR);

    const minOrderQuantity = row.MinZakazQTY ? parseFloat(row.MinZakazQTY) : 1;

    // Проверка бренда аналогично той, что была в старом коде:
    // Нормализуем бренд производителя:
    const producerBrandVariants = normalizeBrandNameExtended(producerBrand);

    // Проверим совпадение бренда: если ни один вариант не совпадает
    // значит, пропускаем эту строку
    const brandMatched = producerBrandVariants.some((pbVariant) =>
      brandVariantsToMatch.some((bVariant) => isBrandMatch(pbVariant, bVariant))
    );

    if (!brandMatched) {
      // Если бренд совсем не совпадает ни по одному варианту – пропускаем
      continue;
    }

    const stockLines = Array.isArray(row.OnStocks?.StockLine)
      ? row.OnStocks.StockLine
      : [row.OnStocks.StockLine].filter(Boolean);

    for (const stockLine of stockLines) {
      const stockName = stockLine.StokName as string;
      const stockID = stockLine.StokID as string;
      const stockQuantity = parseFloat(stockLine.StockQTY);
      const deliveryDelayValue = parseFloat(stockLine.DeliveryDelay);
      const deadlineHours = convertDeliveryDelayToHours(deliveryDelayValue);

      const parsedItem: SearchResultsParsed = {
        id: uuidv4(),
        article: producerCode,
        brand: producerBrand,
        description: nameValue,
        availability: stockQuantity,
        price: parsedPrice,
        warehouse: stockName,
        imageUrl: '',
        deadline: deadlineHours,
        deadLineMax: deadlineHours,
        supplier: 'turboCars',
        probability: 99,
        multi: minOrderQuantity,
        turboCars: {
          stock_id: stockID,
          zakazCode: zakazCode,
        },
        // По условию, needToCheckBrand – это инверсия isBrandMatch(brandToMatch, producerBrand)
        // Но поскольку мы тут уже отсеяли неподходящие бренды, можно просто использовать старую логику:
        needToCheckBrand: !isBrandMatch(brandToMatch, producerBrand),
      };

      results.push(parsedItem);
    }
  }

  return results.map((parsedItem) => ({
    ...parsedItem,
    deliveryDate: calculateDeliveryDate(parsedItem),
  }));
};
