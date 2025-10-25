import { AxiosError, AxiosResponse } from 'axios';
import { BasketPositionUG, UgCartResponse } from '../../../controllers/data/cart/cart.types.js';
import { createAxiosInstance } from '../../apiClient/apiClient.js';
import { AbcpSupplierAlias } from '../abcpPlatform.types.js';

// Примечание: Эта функция не экспортируется, так как она является вспомогательной.
// Она отправляет сырой запрос к API.
const sendCartRequest = async (
    positions: BasketPositionUG[],
    supplier: AbcpSupplierAlias
): Promise<AxiosResponse<UgCartResponse>> => {
    const axiosInstance = await createAxiosInstance(supplier);
    const params = new URLSearchParams();

    positions.forEach((position, index) => {
        const prefix = `positions[${index}]`;
        params.append(`${prefix}[number]`, position.number);
        params.append(`${prefix}[brand]`, position.brand);
        params.append(`${prefix}[supplierCode]`, position.supplierCode);
        params.append(`${prefix}[itemKey]`, position.itemKey);
        params.append(`${prefix}[quantity]`, position.quantity.toString());
    });

    return axiosInstance.post('/basket/add', params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
};


/**
 * Универсальный сервис для добавления и обновления товаров в корзине для всех поставщиков ABCP.
 * Инкапсулирует логику обработки ошибки "товар уже в корзине",
 * выполняя удаление и повторное добавление.
 * @param positions - Позиции для добавления/обновления.
 * @param supplier - Алиас поставщика ABCP.
 * @returns - Ответ от API ABCP.
 */
export const updateAbcpCart = async (
    positions: BasketPositionUG[],
    supplier: AbcpSupplierAlias
): Promise<UgCartResponse> => {
    try {
        const response = await sendCartRequest(positions, supplier);

        // Унифицируем логику "уже в корзине" для всех поставщиков ABCP
        const isAlreadyInCart = response.data.errorMessage?.includes('Такой товар уже есть в корзине');
        const isAddOperation = positions[0]?.quantity > 0;

        if (isAlreadyInCart && isAddOperation) {
            console.warn(`Товар уже в корзине ${supplier}. Обновляем количество...`);

            // Создаем позиции для удаления (с quantity: 0)
            const positionsToRemove = positions.map(p => ({ ...p, quantity: 0 }));

            // 1. Сначала удаляем старую позицию
            await sendCartRequest(positionsToRemove, supplier);

            // 2. Затем снова добавляем с актуальным количеством
            const retryResponse = await sendCartRequest(positions, supplier);
            return retryResponse.data;
        }

        return response.data;
    } catch (error) {
        const axiosError = error as AxiosError;
        console.error(`Ошибка при работе с корзиной ${supplier}:`, axiosError.message);
        throw axiosError;
    }
};

/**
 * Отдельная функция для удаления из корзины.
 * @param positions - Позиции для удаления.
 * @param supplier - Алиас поставщика.
 * @returns - Ответ от API.
 */
export const removeAbcpCart = async (
    positions: BasketPositionUG[],
    supplier: AbcpSupplierAlias
): Promise<UgCartResponse> => {
    const positionsToRemove = positions.map(p => ({ ...p, quantity: 0 }));
    const response = await sendCartRequest(positionsToRemove, supplier);
    return response.data;
};
