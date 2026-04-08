# Описание WS Status строк заказа подробно V2 ver. 1.1.7 (с примерами TypeScript)

## Оглавление

1. [Описание сервиса](#описание-сервиса)
2. [Входные параметры](#входные-параметры)
3. [Структуры данных TypeScript](#структуры-данных-typescript)
4. [Ответ сервиса](#ответ-сервиса)
5. [Режимы работы](#режимы-работы)
6. [Примеры использования](#примеры-использования)
7. [Обработка ошибок](#обработка-ошибок)
8. [Типичные сценарии](#типичные-сценарии)

---

## Описание сервиса

Сервис **`getOrder2`** (Подробная информация по номеру заказа, версия 2) предоставляет детализированную информацию по заказам и статусам строк заказа с поддержкой расшифровки статусов позиций.

### Основные отличия версии V2

- Добавлен параметр `STATUS` для получения расшифровки статусов
- Новая структура `STATUSES` с вложенными массивами для детализации статусов позиций
- Поддержка работы в двух режимах: базовом и с расшифровкой статусов

---

## Входные параметры

### Таблица параметров запроса

| Параметр | Наименование | Тип | Обязательный | Примечание |
|----------|--------------|-----|--------------|-----------|
| VKORG | Сбытовая организация | строка (4) | Да | Настройка находится в "Сервис получения сбытовых организаций клиента". Пример: `4000` |
| KUNRG | Покупатель | строка (10) | Да | Доступные значения из "Сервис получения структуры клиента", таблица `RG_TAB-KUNNR`. Пример: `00000000` |
| ORDER | Номер заказа | строка (10) | Да | Номер созданного заказа |
| STATUS | Расшифровка статусов | 0, 1 или пустая строка | Нет | Если `STATUS = 1`, в результат добавляется полное описание статусов по позиции |

---

## Структуры данных TypeScript

### Основные интерфейсы запроса

```typescript
/**
 * Параметры запроса к сервису getOrder2
 */
interface GetOrder2Request {
  /** Сбытовая организация (код, например: 4000) */
  vkorg: string;
  
  /** Код покупателя (например: 00000001) */
  kunrg: string;
  
  /** Номер заказа */
  order: string;
  
  /** Флаг расшифровки статусов (0, 1 или пусто) */
  status?: '0' | '1' | '';
}

/**
 * Параметры запроса со значениями по умолчанию
 */
interface GetOrder2RequestConfig extends GetOrder2Request {
  /** Базовый URL API */
  baseUrl: string;
  
  /** Timeout запроса в миллисекундах */
  timeout?: number;
  
  /** Флаг для трассировки запросов */
  debug?: boolean;
}
```

### Интерфейсы ответа - Заголовок заказа (HEADER)

```typescript
/**
 * Информация о заголовке заказа
 */
interface OrderHeader {
  /** Номер заказа */
  order?: string;
  
  /** Тип заказа */
  orderType?: OrderType;
  
  /** Статус заказа */
  orderStatus?: OrderStatus;
  
  /** Дата заказа (формат: YYYYMMDDHHMMSS) */
  orderDate?: string;
  
  /** Сумма заказа */
  orderSum?: string;
  
  /** Валюта (примеры: RUB, USD, EUR) */
  currency?: string;
  
  /** Код покупателя */
  kunrg?: string;
  
  /** Наименование покупателя */
  nameRg?: string;
  
  /** Код грузополучателя */
  kunwe?: string;
  
  /** Наименование грузополучателя */
  nameWe?: string;
  
  /** Адрес доставки / Пункт выдачи (код) */
  kunza?: string;
  
  /** Адрес доставки / Пункт выдачи (наименование) */
  nameZa?: string;
  
  /** Полный адрес доставки */
  addrZa?: string;
  
  /** Код создателя заказа */
  parNrAp?: string;
  
  /** Наименование создателя заказа */
  nameAp?: string;
  
  /** Код контактного лица */
  parNrZp?: string;
  
  /** Наименование контактного лица */
  nameZp?: string;
  
  /** Дата начала поставки (формат: YYYYMMDDHHMMSS) */
  etdat?: string;
  
  /** Дата окончания поставки (формат: YYYYMMDDHHMMSS) */
  vdatu?: string;
  
  /** Номер заказа в учетной системе клиента */
  docNum?: string;
  
  /** Дата заказа в учетной системе клиента */
  docDate?: string;
  
  /** Номер договора */
  numdog?: string;
  
  /** Полная поставка (1 - да, 0 - нет) */
  complDlv?: '0' | '1';
  
  /** Комментарий по заказу */
  comment?: string;
  
  /** Комментарий к экспедиции */
  commentExp?: string;
  
  /** Вид доставки */
  incotermsTxt?: DeliveryType;
  
  /** Наименование пункта выдачи */
  vstelName?: string;
}

/**
 * Тип заказа
 */
type OrderType = 
  | 'Отгрузка с ОСНОВНЫХ складов АРМТЕК'
  | 'Доставка с БЛИЖНИХ складов АРМТЕК'
  | 'Доставка с ДАЛЬНИХ складов АРМТЕК'
  | 'Доставка с ЦЗ';

/**
 * Статус заказа
 */
type OrderStatus = 
  | 'Создан'
  | 'В работе'
  | 'Закрыт'
  | 'Отклонен';

/**
 * Вид доставки
 */
type DeliveryType = 
  | 'Доставка до Клиента'
  | 'Самовывоз';
```

### Интерфейсы ответа - Позиции заказа (ITEMS)

```typescript
/**
 * Информация о позиции заказа
 */
interface OrderItem {
  /** Номер позиции в заказе */
  posnr?: string;
  
  /** Бренд */
  brand?: string;
  
  /** Номер артикула (ПИН) */
  pin?: string;
  
  /** Наименование артикула */
  name?: string;
  
  /** Количество в заказе */
  kwmeng?: string;
  
  /** Количество к поставке (в getOrder_get заменен на READY или ReadyToIssue) */
  kwmengP?: string;
  
  /** Отгруженное количество (в getOrder_get заменен на Issued) */
  kwmengR?: string;
  
  /** Отклоненное количество (в getOrder_get заменен на REJECTED или REJ_MENGE) */
  kwmengRej?: string;
  
  /** Цена за единицу */
  price?: string;
  
  /** Сумма позиции */
  summa?: string;
  
  /** Валюта */
  currency?: string;
  
  /** Статус позиции */
  status?: ItemStatus;
  
  /** Примечание к позиции */
  note?: string;
  
  /** Ожидаемая дата поставки (формат: YYYYMMDDHHMMSS) */
  dlvrd?: string;
  
  /** Гарантированная дата поставки (формат: YYYYMMDDHHMMSS) */
  wrntd?: string;
  
  /** Причина отклонения (если позиция отклонена) */
  abgruTxt?: string;
  
  /** Код материала */
  matnr?: string;
  
  /** Полная поставка (1 - да, 0 - нет) */
  complDlv?: '0' | '1';
  
  /** Ссылка на родительскую позицию */
  posex?: string;
  
  /** Ссылка на корневую позицию */
  posroot?: string;
  
  /** Признак некондиции */
  charg?: string;
  
  /** Признак блокировки некондиции к отгрузке */
  chargBlk?: boolean;
  
  /** Код склада партнера АРМТЕК (при заказе с ЦЗ) */
  supplier?: number;
  
  /** Изначально заказанное количество */
  zzKwmeng?: string;
  
  /** Суммарно отклоненное количество */
  rejected?: string;
  
  /** Количество в работе */
  processing?: string;
  
  /** Количество готово к отгрузке */
  ready?: string;
  
  /** Количество от которого отказался клиент */
  rejMenge?: string;
  
  /** Готово к выдаче (для самовывоза) */
  readyToIssue?: string;
  
  /** Выдано (для самовывоза) */
  issued?: string;
}

/**
 * Статус позиции заказа
 */
type ItemStatus = 
  | '' // пустое значение
  | 'позиция полностью поставлена'
  | 'позиция частично поставлена'
  | 'позиция частично отклонена'
  | 'позиция полностью отклонена';
```

### Интерфейсы ответа - Расшифровка статусов

```typescript
/**
 * Полный ответ сервиса getOrder2
 */
interface GetOrder2Response {
  /** Информация о заголовке заказа */
  header?: OrderHeader;
  
  /** Список позиций заказа */
  items?: OrderItem[];
  
  /** Расшифровка статусов (только если STATUS = 1) */
  statuses?: OrderStatusDetail[];
}

/**
 * Деталь статуса позиции заказа
 */
interface OrderStatusDetail {
  /** Номер заказа */
  order: string;
  
  /** Номер позиции */
  posnr: string;
  
  /** Общее количество */
  quan: string;
  
  /** Наименование пункта выдачи */
  vstelName: string;
  
  /** Детали по статусу "В обработке" */
  processing?: StatusDetailProcessing[];
  
  /** Детали по статусу "Готово к отгрузке" */
  ready?: StatusDetailReady[];
  
  /** Детали по статусу "Отгружено" */
  delivered?: StatusDetailDelivered[];
}

/**
 * Детали статуса "В обработке" (Processing)
 */
interface StatusDetailProcessing {
  /** Субстатус */
  subStatus: SubStatusType;
  
  /** Код склада АРМТЕК */
  werks?: string;
  
  /** Наименование склада АРМТЕК */
  werksName?: string;
  
  /** Описание/пояснение статуса */
  lsegEtp?: string;
  
  /** Количество в данном статусе */
  quan: string;
  
  /** Дата последнего события (формат: YYYYMMDD) */
  bldat?: string;
  
  /** Время последнего события (формат: HHMMSS) */
  cputm?: string;
  
  /** Единица измерения */
  unit: string;
  
  /** Расчетная дата получения (формат: YYYYMMDDHHMMSS) */
  dateDelNew?: string;
}

/**
 * Детали статуса "Готово к отгрузке" (Ready)
 */
interface StatusDetailReady {
  /** Номер документа поставки */
  deliveryNum?: string;
  
  /** Номер позиции в поставке */
  deliveryPos?: string;
  
  /** Дата и время создания поставки (формат: YYYYMMDDHHMMSS) */
  deliveryTime?: string;
  
  /** Количество в позиции поставки */
  deliveryQuan?: string;
  
  /** Единица измерения */
  deliveryUnit?: string;
  
  /** Количество на складе отгрузки */
  warehouseQuan?: string;
  
  /** Расчетная дата получения (формат: YYYYMMDDHHMMSS) */
  dateDelNew?: string;
}

/**
 * Детали статуса "Отгружено" (Delivered)
 */
interface StatusDetailDelivered {
  /** Номер фактуры */
  invoiceNum: string;
  
  /** Номер позиции в фактуре */
  invoicePos: string;
  
  /** Печатный номер фактуры (УПД/Товарный чек) */
  printNum: string;
  
  /** Номер ТН/ТТН */
  waybill?: string;
  
  /** Дата и время создания фактуры (формат: YYYYMMDDHHMMSS) */
  createTime: string;
  
  /** Отгруженное количество */
  quan: string;
  
  /** Единица измерения */
  unit: string;
  
  /** Стоимость по строке */
  cost: string;
  
  /** Валюта */
  currency: string;
  
  /** Номер поставки */
  deliveryNum: string;
}

/**
 * Субстатус обработки
 */
type SubStatusType = 
  | 'WayQuan'      // товар в пути между пунктами логистической цепочки
  | 'Planned'      // запланировано к закупке
  | 'Waiting'      // ожидание подтверждения от партнера
  | 'Confirmed'    // партнер подтвердил готовность отгрузить
  | 'Shipped';     // партнер отгрузил товар в адрес АРМТЕК
```

---

## Ответ сервиса

### Таблица HEADER (Заголовок заказа)

| Параметр | Наименование | Тип | Примечание |
|----------|--------------|-----|-----------|
| ORDER | Номер заказа | строка (10) | Номер созданного заказа |
| ORDER_TYPE | Тип заказа | строка (100) | Зависит от места отгрузки |
| ORDER_STATUS | Статус заказа | строка (100) | Создан / В работе / Закрыт / Отклонен |
| ORDER_DATE | Дата заказа | строка (20) | Формат: YYYYMMDDHHMMSS |
| ORDER_SUM | Сумма заказа | строка (20) | Сумма всего заказа |
| CURRENCY | Валюта | строка (4) | RUB, USD, EUR и т.д. |
| KUNRG | Покупатель | строка (10) | Код покупателя |
| KUNWE | Грузополучатель | строка (10) | Код грузополучателя |
| KUNZA | Адрес доставки | строка (10) | Код адреса или пункта выдачи |
| COMPL_DLV | Полная поставка | 0 / 1 | 1 - да, 0 - нет |
| COMMENT | Комментарий по заказу | строка (100) | Произвольный комментарий |
| INCOTERMS_TXT | Вид доставки | строка (100) | Доставка до Клиента / Самовывоз |

### Таблица ITEMS (Позиции заказа)

| Параметр | Наименование | Тип | Примечание |
|----------|--------------|-----|-----------|
| POSNR | Номер позиции | строка (10) | Порядковый номер позиции |
| BRAND | Бренд | строка (18) | Наименование бренда |
| PIN | Номер артикула | строка (40) | ПИН (строка поиска) |
| NAME | Наименование | строка (100) | Описание товара |
| KWMENG | Количество в заказе | строка (20) | Заказанное количество |
| PRICE | Цена за единицу | строка (20) | Цена товара |
| STATUS | Статус позиции | строка (100) | Статус доставки позиции |
| READY | Готово к отгрузке | строка (20) | Количество готовое к отгрузке |
| PROCESSING | В работе | строка (20) | Количество в обработке |
| REJECTED | Отклонено | строка (20) | Общее отклоненное количество |
| DLVRD | Ожидаемая дата | строка (20) | Формат: YYYYMMDDHHMMSS |
| CHARG | Признак некондиции | строка (10) | Признак дефектного товара |
| SUPPLIER | Код склада партнера | число (10) | Для товара с ЦЗ |

---

## Режимы работы

### Режим 1: Базовый (STATUS = 0 или пусто)

Возвращает информацию о статусах строк заказа, соответствующих отображению в ЭТП на странице "Заказ подробно".

**Структура ответа:**

```
{
  "header": { ... },
  "items": [ ... ]
}
```

### Режим 2: С расшифровкой статусов (STATUS = 1)

Возвращает детальную расшифровку статусов позиций с информацией:

- По статусу "В обработке" (Processing) - с субстатусами и движением товара
- По статусу "Готово к отгрузке" (Ready) - с номерами поставок
- По статусу "Отгружено" (Delivered) - с номерами фактур и доставок

**Структура ответа:**

```
{
  "header": { ... },
  "items": [ ... ],
  "statuses": [
    {
      "order": "...",
      "posnr": "...",
      "processing": [ ... ],
      "ready": [ ... ],
      "delivered": [ ... ]
    }
  ]
}
```

---

## Примеры использования

### Пример 1: Простой запрос информации о заказе

```typescript
import axios from 'axios';

interface GetOrder2Request {
  vkorg: string;
  kunrg: string;
  order: string;
  status?: '0' | '1' | '';
}

interface GetOrder2Response {
  header?: Record<string, any>;
  items?: Record<string, any>[];
}

async function getOrderInfo(
  baseUrl: string,
  vkorg: string,
  kunrg: string,
  order: string
): Promise<GetOrder2Response> {
  try {
    const response = await axios.get(`${baseUrl}/getOrder2`, {
      params: {
        vkorg,
        kunrg,
        order,
        status: '0'
      },
      timeout: 10000
    });

    return response.data;
  } catch (error) {
    console.error('Ошибка при получении информации о заказе:', error);
    throw error;
  }
}

// Использование
(async () => {
  const orderData = await getOrderInfo(
    'https://api.armtek.ru',
    '4000',
    '00000001',
    '0000000123'
  );

  console.log('Информация о заказе:', orderData.header);
  console.log('Позиции:', orderData.items);
})();
```

### Пример 2: Запрос с расшифровкой статусов

```typescript
async function getOrderWithStatusDetails(
  baseUrl: string,
  vkorg: string,
  kunrg: string,
  order: string
): Promise<GetOrder2Response> {
  try {
    const response = await axios.get(`${baseUrl}/getOrder2`, {
      params: {
        vkorg,
        kunrg,
        order,
        status: '1'  // Запрос с расшифровкой
      },
      timeout: 10000
    });

    return response.data;
  } catch (error) {
    console.error('Ошибка при получении статусов:', error);
    throw error;
  }
}

// Использование с расшифровкой
(async () => {
  const orderData = await getOrderWithStatusDetails(
    'https://api.armtek.ru',
    '4000',
    '00000001',
    '0000000123'
  );

  // Обработка расшифровки статусов
  if (orderData.statuses) {
    orderData.statuses.forEach(status => {
      console.log(`\nПозиция ${status.posnr}:`);
      
      if (status.processing) {
        console.log('Статус "В обработке":');
        status.processing.forEach(proc => {
          console.log(
            `  - ${proc.subStatus} (${proc.quan} шт) ${
              proc.werksName || 'склад партнера'
            }`
          );
        });
      }

      if (status.ready) {
        console.log('Готово к отгрузке:');
        status.ready.forEach(rdy => {
          console.log(
            `  - Поставка ${rdy.deliveryNum}: ${
              rdy.deliveryQuan || rdy.warehouseQuan
            } шт`
          );
        });
      }

      if (status.delivered) {
        console.log('Отгружено:');
        status.delivered.forEach(dlv => {
          console.log(
            `  - Фактура ${dlv.printNum}: ${dlv.quan} ${dlv.unit}`
          );
        });
      }
    });
  }
})();
```

### Пример 3: Класс-обертка для работы с API

```typescript
class ArmtekOrderService {
  private baseUrl: string;
  private vkorg: string;
  private timeout: number;

  constructor(
    baseUrl: string,
    vkorg: string,
    timeout: number = 10000
  ) {
    this.baseUrl = baseUrl;
    this.vkorg = vkorg;
    this.timeout = timeout;
  }

  /**
   * Получить информацию о заказе без расшифровки статусов
   */
  async getOrder(
    kunrg: string,
    orderNumber: string
  ): Promise<GetOrder2Response> {
    return this.fetchOrder(kunrg, orderNumber, '0');
  }

  /**
   * Получить информацию о заказе с расшифровкой статусов
   */
  async getOrderWithDetails(
    kunrg: string,
    orderNumber: string
  ): Promise<GetOrder2Response> {
    return this.fetchOrder(kunrg, orderNumber, '1');
  }

  /**
   * Получить статус конкретной позиции
   */
  async getItemStatus(
    kunrg: string,
    orderNumber: string,
    positionNumber: string
  ): Promise<{item?: Record<string, any>; statuses?: any}> {
    const order = await this.getOrderWithDetails(kunrg, orderNumber);

    const item = order.items?.find(
      it => it.posnr === positionNumber
    );
    const statuses = order.statuses?.find(
      st => st.posnr === positionNumber
    );

    return {item, statuses};
  }

  /**
   * Получить количество, готовое к отгрузке по всем позициям
   */
  async getTotalReadyQuantity(
    kunrg: string,
    orderNumber: string
  ): Promise<number> {
    const order = await this.getOrder(kunrg, orderNumber);

    return (order.items || []).reduce((sum, item) => {
      const ready = parseInt(item.ready || '0', 10);
      return sum + ready;
    }, 0);
  }

  /**
   * Получить обработанное количество по позиции
   */
  async getProcessingQuantity(
    kunrg: string,
    orderNumber: string,
    positionNumber: string
  ): Promise<{processing: number; ready: number}> {
    const order = await this.getOrder(kunrg, orderNumber);
    const item = order.items?.find(it => it.posnr === positionNumber);

    return {
      processing: parseInt(item?.processing || '0', 10),
      ready: parseInt(item?.ready || '0', 10)
    };
  }

  /**
   * Проверить, отклонена ли позиция
   */
  isItemRejected(item: Record<string, any>): boolean {
    return item.status?.includes('отклонена') || false;
  }

  /**
   * Получить причину отклонения позиции
   */
  getRejectionReason(item: Record<string, any>): string | null {
    return item.abgruTxt || null;
  }

  private async fetchOrder(
    kunrg: string,
    orderNumber: string,
    statusFlag: '0' | '1'
  ): Promise<GetOrder2Response> {
    try {
      const response = await axios.get(`${this.baseUrl}/getOrder2`, {
        params: {
          vkorg: this.vkorg,
          kunrg,
          order: orderNumber,
          status: statusFlag
        },
        timeout: this.timeout
      });

      return response.data;
    } catch (error) {
      console.error(
        `Ошибка при получении заказа ${orderNumber}:`,
        error
      );
      throw error;
    }
  }
}

// Использование класса
(async () => {
  const service = new ArmtekOrderService('https://api.armtek.ru', '4000');

  try {
    // Получить заказ
    const order = await service.getOrder('00000001', '0000000123');
    console.log('Заказ:', order);

    // Получить статус конкретной позиции
    const positionStatus = await service.getItemStatus(
      '00000001',
      '0000000123',
      '10'
    );
    console.log('Статус позиции 10:', positionStatus);

    // Получить общее готовое количество
    const readyQty = await service.getTotalReadyQuantity(
      '00000001',
      '0000000123'
    );
    console.log('Готово к отгрузке:', readyQty);

  } catch (error) {
    console.error('Ошибка:', error);
  }
})();
```

### Пример 4: Обработка дат и форматирование

```typescript
/**
 * Парсер дат для ARMTEK API
 */
class DateParser {
  /**
   * Парсить дату в формате YYYYMMDDHHMMSS
   */
  static parseDateTime(dateStr: string): Date | null {
    if (!dateStr || dateStr.length !== 14) {
      return null;
    }

    const year = parseInt(dateStr.substring(0, 4), 10);
    const month = parseInt(dateStr.substring(4, 6), 10);
    const day = parseInt(dateStr.substring(6, 8), 10);
    const hours = parseInt(dateStr.substring(8, 10), 10);
    const minutes = parseInt(dateStr.substring(10, 12), 10);
    const seconds = parseInt(dateStr.substring(12, 14), 10);

    return new Date(year, month - 1, day, hours, minutes, seconds);
  }

  /**
   * Парсить дату в формате YYYYMMDD
   */
  static parseDate(dateStr: string): Date | null {
    if (!dateStr || dateStr.length !== 8) {
      return null;
    }

    const year = parseInt(dateStr.substring(0, 4), 10);
    const month = parseInt(dateStr.substring(4, 6), 10);
    const day = parseInt(dateStr.substring(6, 8), 10);

    return new Date(year, month - 1, day);
  }

  /**
   * Форматировать дату в YYYYMMDDHHMMSS
   */
  static formatDateTime(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
      date.getFullYear() +
      pad(date.getMonth() + 1) +
      pad(date.getDate()) +
      pad(date.getHours()) +
      pad(date.getMinutes()) +
      pad(date.getSeconds())
    );
  }

  /**
   * Форматировать дату в YYYYMMDD
   */
  static formatDate(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
      date.getFullYear() +
      pad(date.getMonth() + 1) +
      pad(date.getDate())
    );
  }
}

// Использование
const dateStr = '20240315143000';
const parsedDate = DateParser.parseDateTime(dateStr);
console.log('Распарсена дата:', parsedDate);
console.log('Отформатирована обратно:', DateParser.formatDateTime(parsedDate!));
```

---

## Обработка ошибок

### Типичные ошибки и решения

```typescript
/**
 * Типы ошибок API
 */
enum ArmtekErrorCode {
  INVALID_VKORG = 'INVALID_VKORG',           // Неверный код организации
  INVALID_KUNRG = 'INVALID_KUNRG',           // Неверный код покупателя
  ORDER_NOT_FOUND = 'ORDER_NOT_FOUND',       // Заказ не найден
  INVALID_STATUS_PARAM = 'INVALID_STATUS_PARAM', // Неверный параметр STATUS
  TIMEOUT = 'TIMEOUT',                       // Превышено время ожидания
  NETWORK_ERROR = 'NETWORK_ERROR',           // Ошибка сети
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'            // Неизвестная ошибка
}

/**
 * Пользовательская ошибка API
 */
class ArmtekApiError extends Error {
  code: ArmtekErrorCode;
  status?: number;
  originalError?: any;

  constructor(
    code: ArmtekErrorCode,
    message: string,
    status?: number,
    originalError?: any
  ) {
    super(message);
    this.code = code;
    this.status = status;
    this.originalError = originalError;
    this.name = 'ArmtekApiError';
  }
}

/**
 * Обработчик ошибок
 */
class ErrorHandler {
  static handle(error: any): ArmtekApiError {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED') {
        return new ArmtekApiError(
          ArmtekErrorCode.TIMEOUT,
          'Превышено время ожидания ответа от сервера',
          undefined,
          error
        );
      }

      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;

        switch (status) {
          case 400:
            if (data?.message?.includes('VKORG')) {
              return new ArmtekApiError(
                ArmtekErrorCode.INVALID_VKORG,
                'Неверный код сбытовой организации (VKORG)',
                status,
                error
              );
            }
            if (data?.message?.includes('KUNRG')) {
              return new ArmtekApiError(
                ArmtekErrorCode.INVALID_KUNRG,
                'Неверный код покупателя (KUNRG)',
                status,
                error
              );
            }
            if (data?.message?.includes('STATUS')) {
              return new ArmtekApiError(
                ArmtekErrorCode.INVALID_STATUS_PARAM,
                'Неверный параметр STATUS (должен быть 0, 1 или пусто)',
                status,
                error
              );
            }
            break;

          case 404:
            return new ArmtekApiError(
              ArmtekErrorCode.ORDER_NOT_FOUND,
              `Заказ не найден. Проверьте номер заказа и код покупателя`,
              status,
              error
            );

          case 500:
          case 502:
          case 503:
            return new ArmtekApiError(
              ArmtekErrorCode.UNKNOWN_ERROR,
              'Ошибка сервера. Попробуйте позже',
              status,
              error
            );
        }
      }

      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        return new ArmtekApiError(
          ArmtekErrorCode.NETWORK_ERROR,
          'Ошибка сети. Проверьте подключение и адрес сервера',
          undefined,
          error
        );
      }
    }

    return new ArmtekApiError(
      ArmtekErrorCode.UNKNOWN_ERROR,
      'Неизвестная ошибка при работе с API',
      undefined,
      error
    );
  }
}

// Использование
async function safeGetOrder(
  service: ArmtekOrderService,
  kunrg: string,
  order: string
) {
  try {
    return await service.getOrder(kunrg, order);
  } catch (error) {
    const apiError = ErrorHandler.handle(error);
    console.error(`[${apiError.code}] ${apiError.message}`);

    switch (apiError.code) {
      case ArmtekErrorCode.ORDER_NOT_FOUND:
        console.log('Повторите проверку номера заказа');
        break;
      case ArmtekErrorCode.TIMEOUT:
        console.log('Попробуйте запрос позже');
        break;
      case ArmtekErrorCode.NETWORK_ERROR:
        console.log('Проверьте подключение к интернету');
        break;
    }

    throw apiError;
  }
}
```

---

## Типичные сценарии

### Сценарий 1: Отслеживание статуса доставки заказа

```typescript
/**
 * Сценарий: Клиент хочет узнать статус доставки заказа
 */
async function trackOrderDelivery(
  service: ArmtekOrderService,
  kunrg: string,
  orderNumber: string
): Promise<void> {
  try {
    const order = await service.getOrderWithDetails(kunrg, orderNumber);

    console.log(`\n=== Отслеживание заказа ${order.header?.order} ===`);
    console.log(`Статус: ${order.header?.orderStatus}`);
    console.log(`Дата заказа: ${order.header?.orderDate}`);
    console.log(`Вид доставки: ${order.header?.incotermsTxt}`);

    if (order.statuses) {
      order.statuses.forEach(status => {
        console.log(`\n--- Позиция ${status.posnr} ---`);

        if (status.delivered && status.delivered.length > 0) {
          console.log('✓ Отгружено');
          status.delivered.forEach(dlv => {
            const createDate = DateParser.parseDateTime(dlv.createTime);
            console.log(
              `  Фактура: ${dlv.printNum} от ${
                createDate?.toLocaleDateString('ru-RU')
              }`
            );
            console.log(`  Количество: ${dlv.quan} ${dlv.unit}`);
            if (dlv.waybill) {
              console.log(`  ТН/ТТН: ${dlv.waybill}`);
            }
          });
        } else if (status.ready && status.ready.length > 0) {
          console.log('▶ Готово к отгрузке');
          status.ready.forEach(rdy => {
            const dlvDate = DateParser.parseDateTime(rdy.dateDelNew);
            console.log(`  Поставка: ${rdy.deliveryNum}`);
            console.log(`  Количество: ${rdy.deliveryQuan || rdy.warehouseQuan}`);
            if (dlvDate) {
              console.log(
                `  Ожидаемая дата: ${dlvDate.toLocaleDateString('ru-RU')}`
              );
            }
          });
        } else if (status.processing && status.processing.length > 0) {
          console.log('⏳ В обработке');
          status.processing.forEach(proc => {
            const date = DateParser.parseDateTime(proc.dateDelNew);
            console.log(
              `  ${proc.subStatus} (${proc.werksName || 'у партнера'})`
            );
            console.log(`  Количество: ${proc.quan}`);
            if (date) {
              console.log(
                `  Ожидаемая дата: ${date.toLocaleDateString('ru-RU')}`
              );
            }
          });
        }
      });
    }
  } catch (error) {
    const apiError = ErrorHandler.handle(error);
    console.error(`Ошибка: ${apiError.message}`);
  }
}
```

### Сценарий 2: Проверка наличия дефектных товаров

```typescript
/**
 * Сценарий: Проверить, есть ли в заказе товары с признаком некондиции
 */
async function checkDefectiveItems(
  service: ArmtekOrderService,
  kunrg: string,
  orderNumber: string
): Promise<void> {
  try {
    const order = await service.getOrder(kunrg, orderNumber);

    const defectiveItems = (order.items || []).filter(
      item => item.charg && item.charg !== ''
    );

    if (defectiveItems.length === 0) {
      console.log('✓ В заказе нет товаров с признаком некондиции');
      return;
    }

    console.log(`\n⚠ Обнаружено товаров с дефектами: ${defectiveItems.length}`);

    defectiveItems.forEach(item => {
      console.log(`\n Позиция ${item.posnr}: ${item.name}`);
      console.log(`  ПИН: ${item.pin}`);
      console.log(`  Дефект: ${item.charg}`);

      if (item.chargBlk) {
        console.log(
          `  ⛔ БЛОКИРОВАНА К ОТГРУЗКЕ - требуется принять решение`
        );
        console.log(`     Отгружать или отказать от товара?`);
      } else {
        console.log(`  ✓ Разблокирована, можно отгружать`);
      }
    });

  } catch (error) {
    const apiError = ErrorHandler.handle(error);
    console.error(`Ошибка: ${apiError.message}`);
  }
}
```

### Сценарий 3: Выявление отклоненных позиций

```typescript
/**
 * Сценарий: Выявить отклоненные позиции и причины отклонения
 */
async function analyzeRejections(
  service: ArmtekOrderService,
  kunrg: string,
  orderNumber: string
): Promise<void> {
  try {
    const order = await service.getOrder(kunrg, orderNumber);

    const rejectedItems = (order.items || []).filter(
      item => 
        item.status?.includes('отклонена') ||
        (item.rejected && parseInt(item.rejected, 10) > 0)
    );

    if (rejectedItems.length === 0) {
      console.log('✓ Отклоненных позиций не найдено');
      return;
    }

    console.log(`\n❌ Отклоненных позиций: ${rejectedItems.length}`);

    let totalRejected = 0;

    rejectedItems.forEach(item => {
      const rejected = parseInt(item.rejected || '0', 10);
      const ordered = parseInt(item.kwmeng || '0', 10);
      const percentage = ((rejected / ordered) * 100).toFixed(1);

      totalRejected += rejected;

      console.log(`\n Позиция ${item.posnr}: ${item.name}`);
      console.log(
        `  Отклонено: ${rejected} из ${ordered} (${percentage}%)`
      );

      if (item.abgruTxt) {
        console.log(`  Причина: ${item.abgruTxt}`);
      }

      if (item.note) {
        console.log(`  Примечание: ${item.note}`);
      }
    });

    console.log(`\n📊 Итого отклонено: ${totalRejected} единиц товара`);

  } catch (error) {
    const apiError = ErrorHandler.handle(error);
    console.error(`Ошибка: ${apiError.message}`);
  }
}
```

### Сценарий 4: Мониторинг сроков доставки

```typescript
/**
 * Сценарий: Проверить, не просрочены ли сроки доставки
 */
async function checkDeliveryDeadlines(
  service: ArmtekOrderService,
  kunrg: string,
  orderNumber: string
): Promise<void> {
  try {
    const order = await service.getOrderWithDetails(kunrg, orderNumber);
    const today = new Date();

    console.log(`\n=== Проверка сроков доставки ===`);
    console.log(`Дата проверки: ${today.toLocaleDateString('ru-RU')}`);

    const overdueItems: any[] = [];
    const upcomingItems: any[] = [];

    if (order.statuses) {
      order.statuses.forEach(status => {
        const item = order.items?.find(it => it.posnr === status.posnr);

        // Проверить ожидаемую дату (DLVRD)
        const dlvrd = item?.dlvrd
          ? DateParser.parseDateTime(item.dlvrd)
          : null;

        if (dlvrd && dlvrd < today) {
          overdueItems.push({
            posnr: status.posnr,
            name: item?.name,
            dueDate: dlvrd,
            daysOverdue: Math.floor(
              (today.getTime() - dlvrd.getTime()) / (1000 * 60 * 60 * 24)
            )
          });
        } else if (dlvrd && dlvrd < new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)) {
          upcomingItems.push({
            posnr: status.posnr,
            name: item?.name,
            dueDate: dlvrd,
            daysUntil: Math.ceil(
              (dlvrd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
            )
          });
        }
      });
    }

    if (overdueItems.length > 0) {
      console.log(`\n❌ ПРОСРОЧЕННЫЕ (${overdueItems.length}):`);
      overdueItems.forEach(item => {
        console.log(
          `  Позиция ${item.posnr}: ${item.name} (просрочена на ${
            item.daysOverdue
          } дней)`
        );
      });
    }

    if (upcomingItems.length > 0) {
      console.log(`\n⚠ ГОТОВЯТСЯ К ПРОСРОЧКЕ (${upcomingItems.length}):`);
      upcomingItems.forEach(item => {
        console.log(
          `  Позиция ${item.posnr}: ${item.name} (${
            item.daysUntil
          } дней до срока)`
        );
      });
    }

    if (overdueItems.length === 0 && upcomingItems.length === 0) {
      console.log('\n✓ Все сроки доставки в норме');
    }

  } catch (error) {
    const apiError = ErrorHandler.handle(error);
    console.error(`Ошибка: ${apiError.message}`);
  }
}
```

---

## Сервис getOrderReportByDate - Отчет по заказам за интервал времени

Сервис **`getOrderReportByDate`** предоставляет отчет по заказам за определенный период времени с поддержкой различных фильтров и типов заказов.

### Характеристики сервиса

- **Метод:** POST
- **Формат:** JSON
- **URL:** `http://ws.armtek.ru/api/ws_reports/getOrderReportByDate?format=json`

---

## Входные параметры getOrderReportByDate

### Таблица параметров

| Параметр | Наименование | Тип | Обязательный | Примечание |
|----------|--------------|-----|--------------|-----------|
| VKORG | Сбытовая организация | строка (4) | Да | Пример: `4000` |
| KUNNR_RG | Покупатель | строка (10) | Да | Пример: `00000000` |
| SCRDATE | Дата создания С | строка (10) | Нет | Формат: YYYYMMDD. По умолчанию - текущая дата |
| ECRDATE | Дата создания ПО | строка (10) | Нет | Формат: YYYYMMDD. По умолчанию - текущая дата |
| SDLDATE | Поставка товара С | строка (10) | Нет | Формат: YYYYMMDD |
| EDLDATE | Поставка товара ПО | строка (10) | Нет | Формат: YYYYMMDD |
| TYPEZK_SALE | Продажи | 0, 1 или пусто | Нет | Включить продажные заказы |
| TYPEZK_RETN | Возвраты и Количественные разницы | 0, 1 или пусто | Нет | Включить возвраты и разницы |
| KURR_LOGIN | Текущий логин | 0, 1 или пусто | Нет | Фильтрация по текущему логину |

---

## TypeScript интерфейсы для getOrderReportByDate

```typescript
/**
 * Параметры запроса к сервису getOrderReportByDate
 */
interface GetOrderReportByDateRequest {
  /** Сбытовая организация */
  vkorg: string;
  
  /** Код покупателя */
  kunrRg: string;
  
  /** Дата создания заказа С (формат: YYYYMMDD) */
  scrdate?: string;
  
  /** Дата создания заказа ПО (формат: YYYYMMDD) */
  ecrdate?: string;
  
  /** Дата поставки товара С (формат: YYYYMMDD) */
  sdldate?: string;
  
  /** Дата поставки товара ПО (формат: YYYYMMDD) */
  edldate?: string;
  
  /** Включить продажные заказы (0 или 1) */
  typeskSale?: '0' | '1';
  
  /** Включить возвраты (0 или 1) */
  typeskRetn?: '0' | '1';
  
  /** Фильтровать по текущему логину (0 или 1) */
  kurrLogin?: '0' | '1';
}

/**
 * Конфигурация запроса с дополнительными параметрами
 */
interface GetOrderReportByDateRequestConfig extends GetOrderReportByDateRequest {
  baseUrl: string;
  timeout?: number;
  debug?: boolean;
}

/**
 * Строка отчета по заказам
 */
interface OrderReportItem {
  /** Номер заказа */
  order?: string;
  
  /** Тип заказа */
  orderType?: OrderType;
  
  /** Дата заказа (формат: YYYYMMDDHHMMSS) */
  orderDate?: string;
  
  /** Статус заказа */
  orderStatus?: OrderStatus;
  
  /** Сумма заказа */
  orderSum?: string;
  
  /** Валюта */
  currency?: string;
  
  /** Номер поставки */
  delivery?: string;
  
  /** Номер фактуры */
  invoice?: string;
  
  /** Статус по кредиту */
  statCred?: CreditStatus;
  
  /** Статус МинСум (минимальная сумма) */
  minSum?: MinSumStatus;
  
  /** Поставлять товар С (формат: YYYYMMDDHHMMSS) */
  etdat?: string;
  
  /** Поставлять товар По (формат: YYYYMMDDHHMMSS) */
  vdatu?: string;
  
  /** Вид доставки */
  incotermsTxt?: DeliveryType;
  
  /** Номер договора */
  numdog?: string;
  
  /** Комментарий по заказу */
  comment?: string;
  
  /** Комментарий к экспедиции */
  commentExp?: string;
}

/**
 * Суммарная информация по результатам запроса
 */
interface OrderReportSummary {
  /** Общая сумма по заказам */
  sum?: string;
  
  /** Валюта */
  currency?: string;
  
  /** Количество уникальных номеров заказов */
  num?: string;
}

/**
 * Полный ответ сервиса getOrderReportByDate
 */
interface GetOrderReportByDateResponse {
  /** Таблица результатов поиска */
  data?: OrderReportItem[];
  
  /** Суммарная информация */
  inf?: OrderReportSummary;
}

/**
 * Статус по кредиту
 */
type CreditStatus = 
  | 'Проверен'
  | 'Блокирован'
  | 'Деблокирован';

/**
 * Статус по минимальной сумме
 */
type MinSumStatus = 
  | 'Не блокирован'
  | 'Блокирован'
  | 'Деблокирован';
```

---

## Примеры использования getOrderReportByDate

### Пример 1: Простой отчет по заказам за месяц

```typescript
/**
 * Получить отчет по заказам за определенный месяц
 */
async function getOrderReportByMonth(
  baseUrl: string,
  vkorg: string,
  kunrRg: string,
  year: number,
  month: number
): Promise<GetOrderReportByDateResponse> {
  const pad = (n: number) => String(n).padStart(2, '0');
  
  const scrdate = `${year}${pad(month)}01`;
  const ecrdate = `${year}${pad(month)}${new Date(
    year,
    month,
    0
  ).getDate()}`;

  try {
    const response = await axios.post(
      `${baseUrl}/api/ws_reports/getOrderReportByDate`,
      {
        vkorg,
        kunrRg,
        scrdate,
        ecrdate,
        format: 'json'
      },
      { timeout: 15000 }
    );

    return response.data;
  } catch (error) {
    console.error('Ошибка при получении отчета:', error);
    throw error;
  }
}

// Использование
(async () => {
  const report = await getOrderReportByMonth(
    'https://ws.armtek.ru',
    '4000',
    '00000001',
    2024,
    3 // Март 2024
  );

  console.log(`Количество заказов: ${report.inf?.num}`);
  console.log(`Общая сумма: ${report.inf?.sum} ${report.inf?.currency}`);
  console.log(`Заказов в отчете: ${report.data?.length}`);
})();
```

### Пример 2: Расширенный отчет с фильтрацией

```typescript
/**
 * Получить отчет с различными фильтрами
 */
async function getDetailedOrderReport(
  baseUrl: string,
  vkorg: string,
  kunrRg: string,
  filters: {
    dateFrom: Date;
    dateTo: Date;
    includeSales?: boolean;
    includeReturns?: boolean;
    filterByLogin?: boolean;
  }
): Promise<GetOrderReportByDateResponse> {
  const formatDate = (date: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
      date.getFullYear() +
      pad(date.getMonth() + 1) +
      pad(date.getDate())
    );
  };

  try {
    const params = {
      vkorg,
      kunrRg,
      scrdate: formatDate(filters.dateFrom),
      ecrdate: formatDate(filters.dateTo),
      typeskSale: filters.includeSales ? '1' : '0',
      typeskRetn: filters.includeReturns ? '1' : '0',
      kurrLogin: filters.filterByLogin ? '1' : '0',
      format: 'json'
    };

    const response = await axios.post(
      `${baseUrl}/api/ws_reports/getOrderReportByDate`,
      params,
      { timeout: 15000 }
    );

    return response.data;
  } catch (error) {
    console.error('Ошибка при получении расширенного отчета:', error);
    throw error;
  }
}

// Использование
(async () => {
  const report = await getDetailedOrderReport(
    'https://ws.armtek.ru',
    '4000',
    '00000001',
    {
      dateFrom: new Date('2024-01-01'),
      dateTo: new Date('2024-03-31'),
      includeSales: true,
      includeReturns: true,
      filterByLogin: false
    }
  );

  console.log('Отчет получен успешно');
  console.log(`Сумма: ${report.inf?.sum} ${report.inf?.currency}`);
})();
```

### Пример 3: Класс для работы с отчетами

```typescript
/**
 * Сервис для работы с отчетами по заказам
 */
class ArmtekReportService {
  private baseUrl: string;
  private vkorg: string;

  constructor(baseUrl: string, vkorg: string) {
    this.baseUrl = baseUrl;
    this.vkorg = vkorg;
  }

  /**
   * Получить отчет по заказам
   */
  async getOrderReport(
    kunrRg: string,
    dateFrom: Date,
    dateTo: Date,
    options?: {
      includeSales?: boolean;
      includeReturns?: boolean;
      byDeliveryDate?: boolean;
    }
  ): Promise<GetOrderReportByDateResponse> {
    const formatDate = (date: Date) => {
      const pad = (n: number) => String(n).padStart(2, '0');
      return (
        date.getFullYear() +
        pad(date.getMonth() + 1) +
        pad(date.getDate())
      );
    };

    const params: Record<string, any> = {
      vkorg: this.vkorg,
      kunrRg,
      format: 'json'
    };

    if (options?.byDeliveryDate) {
      params.sdldate = formatDate(dateFrom);
      params.edldate = formatDate(dateTo);
    } else {
      params.scrdate = formatDate(dateFrom);
      params.ecrdate = formatDate(dateTo);
    }

    if (options?.includeSales !== undefined) {
      params.typeskSale = options.includeSales ? '1' : '0';
    }

    if (options?.includeReturns !== undefined) {
      params.typeskRetn = options.includeReturns ? '1' : '0';
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/api/ws_reports/getOrderReportByDate`,
        params,
        { timeout: 15000 }
      );

      return response.data;
    } catch (error) {
      throw ErrorHandler.handle(error);
    }
  }

  /**
   * Получить отчет по статусам кредита
   */
  getCreditStatusBreakdown(
    report: GetOrderReportByDateResponse
  ): Record<string, number> {
    const breakdown: Record<string, number> = {};

    (report.data || []).forEach(item => {
      const status = item.statCred || 'Не определен';
      breakdown[status] = (breakdown[status] || 0) + 1;
    });

    return breakdown;
  }

  /**
   * Получить отчет по типам доставки
   */
  getDeliveryTypeBreakdown(
    report: GetOrderReportByDateResponse
  ): Record<string, number> {
    const breakdown: Record<string, number> = {};

    (report.data || []).forEach(item => {
      const type = item.incotermsTxt || 'Не определено';
      breakdown[type] = (breakdown[type] || 0) + 1;
    });

    return breakdown;
  }

  /**
   * Получить заказы с заблокированным кредитом
   */
  getBlockedCreditOrders(
    report: GetOrderReportByDateResponse
  ): OrderReportItem[] {
    return (report.data || []).filter(
      item => item.statCred === 'Блокирован'
    );
  }

  /**
   * Получить заказы с заблокированной минимальной суммой
   */
  getBlockedMinSumOrders(
    report: GetOrderReportByDateResponse
  ): OrderReportItem[] {
    return (report.data || []).filter(
      item => item.minSum === 'Блокирован'
    );
  }

  /**
   * Получить статистику по статусам заказов
   */
  getOrderStatusStatistics(
    report: GetOrderReportByDateResponse
  ): Record<OrderStatus, number> {
    const stats: Record<OrderStatus, number> = {
      'Создан': 0,
      'В работе': 0,
      'Закрыт': 0,
      'Отклонен': 0
    };

    (report.data || []).forEach(item => {
      const status = item.orderStatus as OrderStatus;
      if (status && status in stats) {
        stats[status]++;
      }
    });

    return stats;
  }

  /**
   * Получить средний размер заказа
   */
  getAverageOrderSum(report: GetOrderReportByDateResponse): number {
    if (!report.inf?.num || !report.inf?.sum) {
      return 0;
    }

    const totalSum = parseFloat(report.inf.sum);
    const orderCount = parseInt(report.inf.num, 10);

    return orderCount > 0 ? totalSum / orderCount : 0;
  }

  /**
   * Группировать заказы по типам
   */
  groupByOrderType(
    report: GetOrderReportByDateResponse
  ): Record<string, OrderReportItem[]> {
    const grouped: Record<string, OrderReportItem[]> = {};

    (report.data || []).forEach(item => {
      const type = item.orderType || 'Не определен';
      if (!grouped[type]) {
        grouped[type] = [];
      }
      grouped[type].push(item);
    });

    return grouped;
  }
}

// Использование сервиса
(async () => {
  const reportService = new ArmtekReportService(
    'https://ws.armtek.ru',
    '4000'
  );

  const report = await reportService.getOrderReport(
    '00000001',
    new Date('2024-01-01'),
    new Date('2024-03-31'),
    {
      includeSales: true,
      includeReturns: true
    }
  );

  // Получить статистику
  const statusStats = reportService.getOrderStatusStatistics(report);
  console.log('Статистика по статусам:', statusStats);

  // Получить заказы с проблемами кредита
  const blockedCredit = reportService.getBlockedCreditOrders(report);
  console.log(`Заказов с блокированным кредитом: ${blockedCredit.length}`);

  // Получить среднюю сумму заказа
  const avgSum = reportService.getAverageOrderSum(report);
  console.log(`Средняя сумма заказа: ${avgSum.toFixed(2)}`);

  // Группировка по типам
  const byType = reportService.groupByOrderType(report);
  Object.entries(byType).forEach(([type, orders]) => {
    console.log(`${type}: ${orders.length} заказов`);
  });
})();
```

### Пример 4: Анализ отчета и экспорт в CSV

```typescript
/**
 * Экспортер отчетов в различные форматы
 */
class ReportExporter {
  /**
   * Экспортировать отчет в CSV
   */
  static exportToCSV(report: GetOrderReportByDateResponse): string {
    const headers = [
      'Номер заказа',
      'Тип заказа',
      'Дата заказа',
      'Статус',
      'Сумма',
      'Валюта',
      'Поставка',
      'Фактура',
      'Статус кредита',
      'МинСум',
      'Доставка с',
      'Доставка по',
      'Вид доставки',
      'Договор',
      'Комментарий'
    ];

    const rows = (report.data || []).map(item => [
      item.order || '',
      item.orderType || '',
      item.orderDate || '',
      item.orderStatus || '',
      item.orderSum || '',
      item.currency || '',
      item.delivery || '',
      item.invoice || '',
      item.statCred || '',
      item.minSum || '',
      item.etdat || '',
      item.vdatu || '',
      item.incotermsTxt || '',
      item.numdog || '',
      item.comment || ''
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return csv;
  }

  /**
   * Экспортировать в JSON
   */
  static exportToJSON(report: GetOrderReportByDateResponse): string {
    return JSON.stringify(report, null, 2);
  }

  /**
   * Создать HTML таблицу
   */
  static exportToHTML(report: GetOrderReportByDateResponse): string {
    let html = '<table border="1" cellpadding="5">\n';
    html += '<thead>\n<tr>\n';
    html +=
      '<th>Заказ</th><th>Тип</th><th>Дата</th><th>Статус</th>' +
      '<th>Сумма</th><th>Поставка</th><th>Кредит</th>\n';
    html += '</tr>\n</thead>\n<tbody>\n';

    (report.data || []).forEach(item => {
      html += '<tr>\n';
      html += `<td>${item.order || '-'}</td>\n`;
      html += `<td>${item.orderType || '-'}</td>\n`;
      html += `<td>${item.orderDate || '-'}</td>\n`;
      html += `<td>${item.orderStatus || '-'}</td>\n`;
      html += `<td>${item.orderSum} ${item.currency}</td>\n`;
      html += `<td>${item.delivery || '-'}</td>\n`;
      html += `<td>${item.statCred || '-'}</td>\n`;
      html += '</tr>\n';
    });

    html += '</tbody>\n</table>\n';
    return html;
  }
}

// Использование экспортера
(async () => {
  const reportService = new ArmtekReportService(
    'https://ws.armtek.ru',
    '4000'
  );

  const report = await reportService.getOrderReport(
    '00000001',
    new Date('2024-01-01'),
    new Date('2024-03-31')
  );

  // Экспортировать в CSV
  const csv = ReportExporter.exportToCSV(report);
  console.log(csv);

  // Экспортировать в JSON
  const json = ReportExporter.exportToJSON(report);
  console.log(json);

  // Создать HTML
  const html = ReportExporter.exportToHTML(report);
  console.log(html);
})();
```

---

## Важные особенности getOrderReportByDate

### ⚠️ Особенность 1: Повторяющиеся строки при частичных поставках

Если заказ поставляется несколькими поставками:

- В отчете будет несколько строк с одним номером заказа
- "Сумма заказа" (ORDER_SUM) будет одинакова во всех строках
- Каждая поставка будет в отдельной строке с собственным номером DELIVERY

```typescript
// Пример обработки
const uniqueOrders = Array.from(
  new Set((report.data || []).map(item => item.order))
);
console.log(`Уникальных заказов: ${uniqueOrders.length}`);
console.log(`Всего строк в отчете: ${report.data?.length}`);
```

### ⚠️ Особенность 2: Объединение нескольких поставок в одну фактуру

Несколько поставок и заказов могут объединяться в одну фактуру:

- Номер фактуры (INVOICE) может появиться в разных строках
- С разными номерами заказов и поставок

```typescript
// Пример группировки по фактурам
const groupByInvoice = (report: GetOrderReportByDateResponse) => {
  const invoices: Record<string, OrderReportItem[]> = {};
  
  (report.data || []).forEach(item => {
    const inv = item.invoice || 'Без фактуры';
    if (!invoices[inv]) {
      invoices[inv] = [];
    }
    invoices[inv].push(item);
  });
  
  return invoices;
};
```

### ⚠️ Особенность 3: Количество заказов vs количество строк

Поле NUM в INF содержит количество **уникальных** номеров заказов:

- Может быть меньше чем количество строк в таблице DATA
- Если заказ разбит на несколько поставок

```typescript
const summary = report.inf;
console.log(`Уникальных заказов (NUM): ${summary?.num}`);
console.log(`Строк в отчете: ${report.data?.length}`);
```

---

## Типичные сценарии использования getOrderReportByDate

### Сценарий 1: Ежемесячный отчет продаж

```typescript
async function getMonthlySalesReport(
  baseUrl: string,
  vkorg: string,
  kunrRg: string,
  month: number,
  year: number
): Promise<void> {
  const service = new ArmtekReportService(baseUrl, vkorg);

  const report = await service.getOrderReport(
    kunrRg,
    new Date(year, month - 1, 1),
    new Date(year, month, 0),
    { includeSales: true, includeReturns: false }
  );

  console.log(`\n=== Отчет продаж ${month}/${year} ===`);
  console.log(`Количество заказов: ${report.inf?.num}`);
  console.log(`Сумма продаж: ${report.inf?.sum} ${report.inf?.currency}`);

  const stats = service.getOrderStatusStatistics(report);
  console.log('\nРаспределение по статусам:');
  Object.entries(stats).forEach(([status, count]) => {
    if (count > 0) {
      console.log(`  ${status}: ${count}`);
    }
  });

  const avg = service.getAverageOrderSum(report);
  console.log(`\nСредняя сумма заказа: ${avg.toFixed(2)}`);
}
```

### Сценарий 2: Анализ проблемных заказов

```typescript
async function analyzeProblematicOrders(
  baseUrl: string,
  vkorg: string,
  kunrRg: string
): Promise<void> {
  const service = new ArmtekReportService(baseUrl, vkorg);

  const report = await service.getOrderReport(
    kunrRg,
    new Date(new Date().setDate(new Date().getDate() - 30)),
    new Date()
  );

  console.log('\n=== Анализ проблемных заказов ===');

  // Заказы с блокированным кредитом
  const blockedCredit = service.getBlockedCreditOrders(report);
  if (blockedCredit.length > 0) {
    console.log(`\n⛔ Заказы с блокированным кредитом (${blockedCredit.length}):`);
    blockedCredit.forEach(order => {
      console.log(`  ${order.order}: ${order.orderSum} ${order.currency}`);
    });
  }

  // Заказы с блокированной МинСум
  const blockedMinSum = service.getBlockedMinSumOrders(report);
  if (blockedMinSum.length > 0) {
    console.log(
      `\n⚠️ Заказы с блокированной МинСум (${blockedMinSum.length}):`
    );
    blockedMinSum.forEach(order => {
      console.log(`  ${order.order}: ${order.orderSum} ${order.currency}`);
    });
  }

  // Отклоненные заказы
  const rejected = (report.data || []).filter(
    item => item.orderStatus === 'Отклонен'
  );
  if (rejected.length > 0) {
    console.log(`\n❌ Отклоненные заказы (${rejected.length}):`);
    rejected.forEach(order => {
      console.log(
        `  ${order.order}: ${order.orderSum} ${order.currency}`
      );
    });
  }
}
```

### Сценарий 3: Сравнение периодов

```typescript
async function compareOrderPeriods(
  baseUrl: string,
  vkorg: string,
  kunrRg: string,
  month1: number,
  month2: number,
  year: number
): Promise<void> {
  const service = new ArmtekReportService(baseUrl, vkorg);

  const report1 = await service.getOrderReport(
    kunrRg,
    new Date(year, month1 - 1, 1),
    new Date(year, month1, 0)
  );

  const report2 = await service.getOrderReport(
    kunrRg,
    new Date(year, month2 - 1, 1),
    new Date(year, month2, 0)
  );

  const sum1 = parseFloat(report1.inf?.sum || '0');
  const sum2 = parseFloat(report2.inf?.sum || '0');
  const num1 = parseInt(report1.inf?.num || '0', 10);
  const num2 = parseInt(report2.inf?.num || '0', 10);

  const sumChange = ((sum2 - sum1) / sum1) * 100;
  const numChange = ((num2 - num1) / num1) * 100;

  console.log(`\n=== Сравнение ${month1}/${year} и ${month2}/${year} ===`);
  console.log(`\nСумма заказов:`);
  console.log(`  ${month1}/${year}: ${sum1.toFixed(2)} ${report1.inf?.currency}`);
  console.log(`  ${month2}/${year}: ${sum2.toFixed(2)} ${report2.inf?.currency}`);
  console.log(`  Изменение: ${sumChange > 0 ? '+' : ''}${sumChange.toFixed(1)}%`);

  console.log(`\nКоличество заказов:`);
  console.log(`  ${month1}/${year}: ${num1}`);
  console.log(`  ${month2}/${year}: ${num2}`);
  console.log(`  Изменение: ${numChange > 0 ? '+' : ''}${numChange.toFixed(1)}%`);
}
```

---

## Заключение

Документация описывает полную работу с WS-сервисами ARMTEK API:

- **getOrder2** - подробная информация по конкретному заказу
- **getOrderReportByDate** - отчет по заказам за интервал времени

**Ключевые моменты:**

- Используйте TypeScript интерфейсы для типизации данных
- Всегда обрабатывайте ошибки с помощью `try-catch` блоков
- Для детальной информации о статусах используйте параметр `STATUS = 1`
- Помните о различных форматах дат (YYYYMMDDHHMMSS и YYYYMMDD)
- Обратите внимание на связи позиций через `POSEX` и `POSROOT` для понимания перезаказов

**Контакты для вопросов:**

- Документация: <https://docs.armtek.ru/ws-api>
- Техподдержка: <support@armtek.ru>
