import { v4 as uuidv4 } from 'uuid';
import { Logger } from 'winston';
import { SearchResultsParsed } from '../../types/search.types.js';
import { calculateDeliveryDate } from '../../utils/calculateDates/calculateDeliveryDate.js';
import { isRelevantBrand } from '../../utils/data/brand/isRelevantBrand.js';
import { AbcpArticleSearchResult, AbcpSupplierAlias } from './abcpPlatform.types.js';

/**
 * Интерфейс конфигурации для маппера.
 * Определяет, какие части логики являются уникальными для каждого поставщика.
 * @property getWarehouse - Функция для определения названия склада.
 * @property getProbability - Функция для расчета вероятности доставки.
 * @property getDeadlines - Функция для расчета сроков поставки. Теперь принимает логгер.
 */
export interface AbcpMapperConfig {
    getWarehouse: (item: AbcpArticleSearchResult) => string;
    getProbability: (item: AbcpArticleSearchResult) => number;
    getDeadlines: (item: AbcpArticleSearchResult, logger: Logger) => { deadline: number; deadLineMax: number };
}

/**
 * Универсальная функция для маппинга результатов поиска от любого поставщика на платформе ABCP.
 * @param data - Массив с результатами поиска от API.
 * @param brand - Искомый бренд.
 * @param userLogger - Экземпляр логгера.
 * @param supplier - Алиас поставщика.
 * @param config - Объект конфигурации с уникальной логикой для данного поставщика.
 * @returns - Массив с результатами, приведенными к стандартной структуре SearchResultsParsed.
 */
export const mapAbcpResponse = (
    data: AbcpArticleSearchResult[],
    brand: string,
    userLogger: Logger,
    supplier: AbcpSupplierAlias,
    config: AbcpMapperConfig
): SearchResultsParsed[] => {
    // 1. Первичный маппинг в промежуточную структуру
    const mappedData = data.map((item) => {
        // Получаем уникальные значения через функции из конфигурации
        // *** ИЗМЕНЕНИЕ: Передаем userLogger в функцию getDeadlines ***
        const deadlines = config.getDeadlines(item, userLogger);
        const warehouse = config.getWarehouse(item);
        const probability = config.getProbability(item);

        // Собираем общий объект
        return {
            id: uuidv4(),
            article: item.number,
            brand: item.brand,
            description: item.description,
            availability: item.availability,
            price: item.price,
            imageUrl: '',

            // Уникальные поля, полученные из конфига
            warehouse,
            probability,
            deadline: deadlines.deadline,
            deadLineMax: deadlines.deadLineMax,

            // Остальная общая логика
            supplier,
            needToCheckBrand: !isRelevantBrand(brand, item.brand),
            returnable: Number(!item.noReturn),
            multi: item.packing || 1,
            allow_return: !item.noReturn,
            warehouse_id: String(item.supplierCode),
            inner_product_code: item.itemKey,
            deadlineReplace: item.deadlineReplace, // Сохраняем оригинальное поле
            [supplier]: {
                itemKey: item.itemKey,
                supplierCode: String(item.supplierCode),
            },
        };
    });

    // 2. Финальный маппинг для расчета даты доставки
    return mappedData.map((result) => ({
        ...result,
        deliveryDate: calculateDeliveryDate(result as SearchResultsParsed, userLogger),
    }));
};

