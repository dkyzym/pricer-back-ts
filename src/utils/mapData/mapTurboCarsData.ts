import { XMLParser } from 'fast-xml-parser';
import { v4 as uuidv4 } from 'uuid';
import { SearchResultsParsed } from '../../types';
import { calculateDeliveryDate } from '../calculateDates';
import { isBrandMatch } from '../data/isBrandMatch';
import { normalizeBrandName } from '../data/normalizeBrandName';

const convertDeliveryDelayToHours = (deliveryDelayDays: number): number => {
  return deliveryDelayDays === 0 ? 1 : deliveryDelayDays * 24;
};

export const parseXmlToSearchResults = (
  xmlString: string,
  brandToMatch: string,
  withAnalogs: 0 | 1
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

  for (const row of codeListRows) {
    const codeType = row.CodeType as string;

    // Если CodeType === 'Analog' и мы не хотим аналоги (withAnalogsFlag = 0), пропускаем
    if (
      (codeType === 'Analog' || codeType === 'AnalogOEM') &&
      withAnalogs === 0
    ) {
      continue;
    }

    const producerBrand = row.ProducerBrand as string;

    if (
      !normalizeBrandName(producerBrand).includes(
        normalizeBrandName(brandToMatch)
      )
    ) {
      console.log(
        'producerBrand ',
        producerBrand,
        'brandToMatch',
        brandToMatch
      );
      continue;
    }
    const producerCode = row.ProducerCode as string;
    const nameValue = row.Name as string;
    const parsedPrice = parseFloat(row.PriceRUR);
    const minOrderQuantity = parseFloat(row.MinZakazQTY);

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
        },
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
