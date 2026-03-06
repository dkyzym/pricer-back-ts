import { v4 as uuidv4 } from 'uuid';
import { Logger } from 'winston';

import { SearchResultsParsed } from '../../types/search.types.js';
import { calculateDeliveryDate } from '../../utils/calculateDates/calculateDeliveryDate.js';
import { isRelevantBrand } from '../../utils/data/brand/isRelevantBrand.js';
import { needToCheckBrand } from '../../utils/data/brand/needToCheckBrand.js';
import { transformArticleByBrand } from '../../utils/data/brand/transformArticleByBrand.js';
import {
  TurboCarsOfferRaw,
  TurboCarsOffersSearchSuccess,
} from './turboCars.types.js';
import {
  getTurboCarsBrands,
  getTurboCarsOffers,
} from './turboCarsApi.js';

const parseTurboCarsNumber = (value: number | string): number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const normalized = trimmed.replace(/\s+/g, '').replace(',', '.');
  const parsed = Number.parseFloat(normalized);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const pickDeliveryDateString = (offer: TurboCarsOfferRaw): string => {
  const source =
    offer.delivery_date_time_end ||
    offer.delivery_date_time_start;

  if (!source) return '';

  return source.slice(0, 10);
};

const mapOfferToResult = (
  offer: TurboCarsOfferRaw,
  expectedBrand: string
): SearchResultsParsed => {
  const price = parseTurboCarsNumber(offer.price);
  const probability = offer.our_stock ? 95 : 90;

  const base: SearchResultsParsed = {
    id: uuidv4(),
    article: offer.code,
    brand: offer.brand,
    description: offer.name,
    price,
    availability: offer.count,
    warehouse: 'TurboCars',
    deliveryDate: pickDeliveryDateString(offer),
    deadline: 0,
    deadLineMax: 0,
    supplier: 'turboCars',
    imageUrl: '',
    probability,
    needToCheckBrand: needToCheckBrand(expectedBrand, offer.brand),
    returnable: offer.is_returnable ? offer.days_for_return : 0,
    multi: offer.multiplicity,
    allow_return: offer.is_returnable,
    warehouse_id: String(offer.provider_id),
    inner_product_code: '',
    turboCars: {
      provider_id: offer.provider_id,
      our_stock: offer.our_stock,
      cross: offer.cross,
      available_more: offer.available_more,
      is_returnable: offer.is_returnable,
      days_for_return: offer.days_for_return,
    },
  };

  return base;
};

export const parseTurboCarsData = async (
  item: {
    article: string;
    brand: string;
  },
  userLogger: Logger
): Promise<SearchResultsParsed[]> => {
  const articleToSearch = transformArticleByBrand(
    item.article,
    item.brand,
    'turboCars'
  );

  const brandsResponse = await getTurboCarsBrands(articleToSearch, userLogger);

  if (!brandsResponse || !Array.isArray(brandsResponse.brands) || !brandsResponse.brands.length) {
    return [];
  }

  const relevantBrands = brandsResponse.brands.filter((brandName) =>
    isRelevantBrand(item.brand, brandName)
  );

  if (!relevantBrands.length) {
    return [];
  }

  const offersResults = await Promise.allSettled(
    relevantBrands.map((brandName) =>
      getTurboCarsOffers(
        {
          code: articleToSearch,
          brand: brandName,
          withNonReturnable: 0,
          withOffers: 1,
        },
        userLogger
      )
    )
  );

  const allOffers: TurboCarsOfferRaw[] = [];

  offersResults.forEach((result) => {
    if (result.status !== 'fulfilled') {
      return;
    }

    const value = result.value as TurboCarsOffersSearchSuccess | null;

    if (!value || !Array.isArray(value.offers)) {
      return;
    }

    allOffers.push(...value.offers);
  });

  if (!allOffers.length) {
    return [];
  }

  const mapped = allOffers.map((offer) => mapOfferToResult(offer, item.brand));

  return mapped.map((result) => ({
    ...result,
    deliveryDate: calculateDeliveryDate(result, userLogger),
  }));
};

