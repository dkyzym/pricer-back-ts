# ABCP Client API — документация для TypeScript

Платформа ABCP (автозапчасти). Клиентское API для поиска, корзины, заказов, пользователей и каталога.

**Базовый URL:** `https://demo.public.api.abcp.ru` (демо) / ваш домен API  
**Формат ответа:** JSON

Типы, используемые в проекте для ABCP, см. в `src/services/abcp/abcpPlatform.types.d.ts`.

---

## 1. Типы TypeScript (сводка)

Структуры запросов и ответов описаны типами. Для заказов и статей поиска в коде используются типы из `abcpPlatform.types.d.ts`.

### 1.1 Авторизация и общее

```ts
/** Учётные данные для всех запросов. userpsw — MD5-хэш пароля. */
interface AbcpAuth {
  userlogin: string;
  userpsw: string;
}
```

### 1.2 Поиск

```ts
/** Элемент ответа GET /search/brands/ */
interface AbcpBrandHit {
  brand: string;
  number: string;
  numberFix: string;
  description: string;
  availability: boolean;
}

/**
 * Элемент ответа GET /search/articles/.
 * availability: отрицательные -1,-2,-3 — неточное наличие ("+","++","+++"); -10 — под заказ.
 * itemKey и supplierCode обязательны для добавления в корзину и заказа.
 */
interface AbcpArticle {
  brand: string;
  number: string;
  numberFix: string;
  description: string;
  availability: number;
  packing?: number;
  deliveryPeriod?: number;
  deliveryPeriodMax?: number;
  deadlineReplace?: string;
  distributorCode?: string;
  supplierCode: string | number;
  supplierColor?: string | null;
  supplierDescription?: string;
  itemKey: string;
  price: number;
  maxPrice?: number;
  weight?: number;
  volume?: number | null;
  deliveryProbability?: number;
  descriptionOfDeliveryProbability?: string;
  lastUpdateTime?: string;
  additionalPrice?: number;
  noReturn?: boolean;
  isUsed?: boolean;
  meta?: {
    tnved?: string;
    okpd2?: string;
    gtin?: string;
    productId?: number;
    wearout?: number;
    images?: unknown;
    abcpWh?: string;
  };
  distributorId?: number;
  grp?: string | null;
  code?: string;
  nonliquid?: boolean;
}

/** Элемент тела POST /search/batch (до 100 пар). */
interface AbcpSearchBatchItem {
  brand: string;
  number: string;
}

/** Ответ POST /search/batch — массив массивов AbcpArticle (по одному на каждый search[i]). */
type AbcpSearchBatchResponse = AbcpArticle[][];

/** Элемент ответа GET /search/history */
interface AbcpSearchHistoryItem {
  brand: string;
  number: string;
  numberFix: string;
  description: string;
  /** Формат ГГГГММДДччммсс */
  datetime: string;
}

/** Элемент ответа GET /search/tips */
interface AbcpSearchTip {
  brand: string;
  number: string;
  description: string;
}

/** Элемент ответа GET /advices/ */
interface AbcpAdviceItem {
  brand: string;
  number: string;
  total: number;
  description: string;
}

/** Элемент ответа POST /advices/batch */
interface AbcpAdviceBatchItem {
  brand: string;
  number: string;
  advices: Array<{ brand: string; number: string; total: number }>;
}
```

### 1.3 Корзина

```ts
/** Элемент ответа GET /basket/multibasket */
interface AbcpBasketItem {
  id: string | number;
  name: string;
}

/** Позиция для POST /basket/add (вариант по brand/number или по code) */
interface AbcpBasketAddPosition {
  number?: string;
  brand?: string;
  code?: string;
  supplierCode: string;
  itemKey: string;
  quantity: number;
  comment?: string;
}

/** Результат по одной позиции в ответе basket/add */
interface AbcpBasketAddPositionResult {
  brand: string;
  number: string;
  numberFix?: string;
  code?: string;
  supplierCode: string;
  description?: string;
  quantity: number;
  comment?: string;
  status: 0 | 1;
  errorMessage?: string;
}

/** Ответ POST /basket/add */
interface AbcpBasketAddResponse {
  status: 0 | 1;
  positions: AbcpBasketAddPositionResult[];
}

/** Ответ POST /basket/clear */
interface AbcpBasketClearResponse {
  status: 0 | 1;
  errorMessage?: string;
}

/** Позиция в ответе GET /basket/content */
interface AbcpBasketContentPosition {
  brand: string;
  number: string;
  numberFix?: string;
  code?: string;
  supplierCode: string;
  itemKey: string;
  description?: string;
  price: number;
  priceRate?: number;
  priceInSiteCurrency?: number;
  quantity: number;
  deadline?: number;
  deadlineMax?: number;
  comment?: string;
  status: 0 | 1;
  positionId?: number;
  packing?: number;
  errorMessage?: string;
}

/** Элемент options в ответе GET /basket/options */
interface AbcpBasketOption {
  disallow_new_shipment_address?: 1 | 2;
  self_shipment?: unknown;
}

/** Элемент ответа GET /basket/paymentMethods */
interface AbcpPaymentMethod {
  id: number | string;
  name: string;
}

/** Элемент ответа GET /basket/shipmentMethods (id нужен при оформлении заказа) */
interface AbcpShipmentMethod {
  id: number | string;
  name: string;
}

/** Элемент ответа GET /basket/shipmentOffices */
interface AbcpShipmentOffice {
  id: number | string;
  name: string;
}

/** Элемент ответа GET /basket/shipmentAddresses; id передаётся как shipmentAddress (0 — самовывоз) */
interface AbcpShipmentAddress {
  id: number | string;
  name: string;
}

/** Элемент ответа GET /basket/shipmentDates */
interface AbcpShipmentDate {
  date: string; // 'YYYY-MM-DD'
  name: string;
}

/** Ответ POST /basket/shipmentAddress */
interface AbcpShipmentAddressAddResponse {
  shipmentAddressId: number | string;
}
```

### 1.4 Оформление заказа и заказы

```ts
/** Параметры POST /basket/order и POST /orders/instant */
interface AbcpOrderParams {
  paymentMethod: number | string;
  shipmentMethod?: number | string; // обязателен с 20.10.2025, если включены типы доставки
  shipmentAddress: number | string; // 0 при самовывозе
  shipmentOffice?: number | string;
  shipmentDate?: string;
  comment?: string;
  basketId?: number | string;
  wholeOrderOnly?: 0 | 1;
  positionIds?: (number | string)[];
  clientOrderNumber?: string;
}

/** Ответ POST /basket/order и POST /orders/instant */
interface AbcpOrderResult {
  status: 0 | 1;
  errorMessage?: string;
  clientOrderNumber?: string;
  orders?: AbcpOrderRaw[];
}

/**
 * Элемент заказа в ответах orders и basket/order.
 * В GET /orders/ API возвращает quantity, price, sum строками (например "2 040,74").
 */
interface AbcpOrderPosition {
  positionId: string | number;
  brand: string;
  number: string;
  numberFix?: string;
  code?: string;
  supplierCode: string;
  itemKey: string;
  description: string;
  quantityOrdered?: number | string;
  quantity: number | string;
  price: number | string;
  priceRate?: number | string;
  priceInSiteCurrency?: number | string;
  deadline?: string | number;
  deadlineMax?: string | number;
  comment?: string;
  commentAnswer?: string;
  status: string;
  statusId?: string | number;
  statusCode?: string;
  statusColor?: string;
  statusDate?: string;
  noReturn?: boolean;
  reference?: string;
}

/**
 * Элемент списка заказов (GET /orders/). items в ответе — словарь по number.
 * См. AbcpOrderRaw, AbcpOrdersResponse в abcpPlatform.types.d.ts.
 */
interface AbcpOrderRaw {
  number: string;
  date: string;
  status: string;
  statusId?: string | number;
  sum: string;
  positionsQuantity?: number;
  deliveryAddress?: string;
  deliveryAddressId?: number | string;
  deliveryOfficeId?: number | string;
  deliveryOffice?: string;
  deliveryTypeId?: number | string;
  deliveryType?: string;
  paymentTypeId?: number | string;
  paymentType?: string;
  deliveryCost?: number | string;
  shipmentDate?: string;
  debt?: number | string;
  comment?: string;
  clientOrderNumber?: string;
  code?: string;
  positions?: AbcpOrderPosition[];
  notes?: unknown[];
}

/** Ответ GET /orders/ (постраничный список). В проекте: AbcpOrdersResponse. */
interface AbcpOrdersResponse {
  count: string | number;
  items: Record<string, AbcpOrderRaw>;
}

/** Параметры GET /orders/ (помимо userlogin/userpsw). См. FetchOrdersParams в abcpPlatform.types.d.ts. */
interface FetchOrdersParams {
  limit?: number;
  skip?: number;
  format?: 'p';
  dateStart?: string; // 'DD.MM.YYYY'
  dateEnd?: string;
}

/** Элемент ответа GET /orders/statuses */
interface AbcpOrderStatusItem {
  id: number;
  name: string;
  color: string;
  isFinalStatus: boolean;
}
```

### 1.5 Алиасы поставщиков ABCP (проект)

```ts
/** См. AbcpSupplierAlias в abcpPlatform.types.d.ts */
type AbcpSupplierAlias =
  | 'ug'
  | 'patriot'
  | 'ug_f'
  | 'npn'
  | 'ug_bn'
  | 'avtodinamika';
```

---

## 2. Авторизация

Во всех запросах к API передаются учётные данные: **userlogin** (логин) и **userpsw**. Пароль в API **никогда** не передаётся в открытом виде — только MD5-хэш строки пароля. Для GET-запросов параметры добавляются в query; для POST с телом `application/x-www-form-urlencoded` — в тело формы. При использовании JSON-тела (например advices/batch) userlogin и userpsw передаются внутри JSON.

**Формирование userpsw (MD5):**

```ts
import crypto from 'node:crypto';

const userlogin = 'username';
const password = 'myPassword';
const userpsw = crypto.createHash('md5').update(password).digest('hex');
```

**Использование в GET-запросе:**

```ts
const params = new URLSearchParams({ userlogin, userpsw });
params.set('number', '01089');
const url = `${BASE_URL}/search/brands/?${params}`;
const data = await fetch(url).then((r) => r.json());
```

**Использование в POST (form-urlencoded):**

```ts
const form = new URLSearchParams();
form.set('userlogin', auth.userlogin);
form.set('userpsw', auth.userpsw);
form.set('paymentMethod', '37');
// ... остальные поля
const res = await fetch(`${BASE_URL}/basket/order`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: form.toString(),
});
```

Тип учётных данных описан в разделе типов как `AbcpAuth`.

---

## 3. Поиск

### 3.1 GET /search/brands/ — бренды по артикулу

Осуществляет поиск по номеру детали и возвращает массив брендов, у которых есть деталь с таким артикулом. Аналог этапа выбора бренда на сайте: сначала пользователь вводит номер, затем выбирает производителя.

**Метод:** GET.

**Параметры запроса (query):**

| Параметр         | Тип     | Описание |
|------------------|--------|----------|
| userlogin        | string | Логин (обязателен) |
| userpsw          | string | MD5 пароля (обязателен) |
| number           | string | Искомый номер детали (обязателен) |
| useOnlineStocks  | 0 \| 1 | Использовать online-склады; 0 — быстрее, без online (по умолчанию 0) |
| officeId         | number | Id офиса; работает только под API-администратором |
| locale           | string | Локаль, например `ru_RU` |

**Ответ:** массив `AbcpBrandHit[]`. В каждом элементе: бренд, номер, очищенный номер, описание, флаг наличия.

```ts
const brands = await abcpGet<AbcpBrandHit[]>('/search/brands/', auth, {
  number: '01089',
});
```

---

### 3.2 GET /search/articles/ — товар по артикулу и бренду

Поиск по номеру детали и бренду. Возвращает массив предложений от разных поставщиков: цены, сроки, наличие, кратность. Один и тот же производитель может иметь синонимы (например GM и General Motors) — система учитывает базу синонимов брендов. Поля **itemKey** и **supplierCode** из ответа обязательны для добавления в корзину и оформления заказа.

**Метод:** GET.

**Параметры запроса (query):**

| Параметр               | Тип     | Описание |
|------------------------|--------|----------|
| userlogin, userpsw     | string | Авторизация |
| number                 | string | Номер детали (обязателен) |
| brand                  | string | Фильтр по бренду (обязателен) |
| useOnlineStocks        | 0 \| 1 | Использовать online-склады (по умолчанию 0) |
| disableOnlineFiltering | 0 \| 1 | Отключить фильтры online-поставщиков (по умолчанию 0) |
| disableFiltering       | 0 \| 1 | 0 — сокращённая выдача, 1 — полная («Показать все варианты») |
| withOutAnalogs         | 0 \| 1 | Исключить поиск по аналогам (по умолчанию 0) |
| profileId              | —      | Только для API-администратора: выдача как для клиента с данным профилем |
| officeId               | —      | Только для API-администратора: выдача как для сотрудника офиса |
| locale                 | string | Локаль |

**Ответ:** массив `AbcpArticle[]`. В каждом элементе: бренд, артикул, описание, наличие (число: отрицательные -1/-2/-3 — неточное «+»/«++»/«+++», -10 — под заказ), сроки, цены, **supplierCode**, **itemKey** и др.

```ts
const articles = await abcpGet<AbcpArticle[]>('/search/articles/', auth, {
  number: '01089',
  brand: 'Febi',
});
```

---

### 3.3 POST /search/batch — пакетный поиск без аналогов

Пакетный поиск по нескольким парам «бренд — номер» за один запрос. Максимум 100 пар. **Online-склады не используются** — только офлайн-прайсы, ответ быстрее. Удобно для массовой проверки наличия и цен.

**Метод:** POST. Тело: `application/x-www-form-urlencoded`.

**Параметры:** userlogin, userpsw, массив `search`: для каждого элемента передаются `search[i][number]` и `search[i][brand]`. Опционально `profileId` (для API-администратора).

**Ответ:** `AbcpSearchBatchResponse` — массив массивов. i-й элемент массива соответствует i-й паре в `search` и содержит массив предложений `AbcpArticle[]` по этой паре.

```ts
const search = [
  { number: '01089', brand: 'Febi' },
  { number: '333305', brand: 'Kyb' },
];
const form = new URLSearchParams({ userlogin: auth.userlogin, userpsw: auth.userpsw });
search.forEach((item, i) => {
  form.set(`search[${i}][number]`, item.number);
  form.set(`search[${i}][brand]`, item.brand);
});
const data = await fetch(`${BASE_URL}/search/batch`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: form.toString(),
}).then((r) => r.json()) as AbcpSearchBatchResponse;
```

---

### 3.4 GET /search/history — история поиска

Возвращает последние поисковые запросы текущего пользователя (не более 50). Каждый элемент — пара бренд/номер и дата-время поиска. Используется для отображения «недавних поисков» в UI.

**Метод:** GET. Параметры: только userlogin, userpsw.

**Ответ:** массив `AbcpSearchHistoryItem[]`. Поле `datetime` в формате ГГГГММДДччммсс.

```ts
const history = await abcpGet<AbcpSearchHistoryItem[]>('/search/history', auth);
```

---

### 3.5 GET /search/tips — подсказки по поиску

Возвращает по части номера массив подходящих пар «бренд — номер» и описание. Для автодополнения в поле ввода артикула.

**Метод:** GET.

**Параметры:** userlogin, userpsw, **number** (часть номера), опционально **locale**.

**Ответ:** массив `AbcpSearchTip[]`.

```ts
const tips = await abcpGet<AbcpSearchTip[]>('/search/tips', auth, {
  number: '0108',
});
```

---

### 3.6 GET /advices/ — сопутствующие товары (один товар)

Реализует механизм «с этим товаром покупают» на основе статистики покупок. По одной паре бренд–номер возвращает список товаров, которые часто покупают вместе (например масляный фильтр — остальные товары для ТО). Можно ограничить выдачу параметром `limit` (рекомендуется 5).

**Метод:** GET.

**Параметры:** userlogin, userpsw, **brand**, **number**, опционально **limit**, **locale**.

**Ответ:** массив `AbcpAdviceItem[]` (brand, number, total — количество заказов с этим сочетанием, description).

```ts
const advices = await abcpGet<AbcpAdviceItem[]>('/advices/', auth, {
  brand: 'MB',
  number: 'A2058350147',
  limit: '5',
});
```

---

### 3.7 POST /advices/batch — сопутствующие товары (несколько товаров)

Тот же механизм «с этим товаром покупают», но для нескольких товаров за один запрос. Параметры товаров передаются в теле в виде JSON-массива **articles** с объектами `{ brand, number }`. Обязателен заголовок **Content-Type: application/json**.

**Метод:** POST. Тело: JSON.

**Тело запроса:** `{ userlogin, userpsw, articles: [{ brand, number }, ...], limit? }`.

**Ответ:** массив `AbcpAdviceBatchItem[]`. Каждый элемент содержит brand, number и вложенный массив **advices** с рекомендациями (brand, number, total).

```ts
const body = {
  userlogin: auth.userlogin,
  userpsw: auth.userpsw,
  articles: [
    { brand: 'Shell', number: '550051529' },
    { brand: 'LUKOIL', number: '3148675' },
  ],
  limit: 5,
};
const data = await fetch(`${BASE_URL}/advices/batch`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
}).then((r) => r.json()) as AbcpAdviceBatchItem[];
```

---

## 4. Корзина

### 4.1 GET /basket/multibasket — список корзин

Возвращает список корзин пользователя при включённой мультикорзине. Каждая корзина имеет идентификатор и название. Если мультикорзина не используется, метод всё равно может возвращать одну корзину по умолчанию.

**Метод:** GET. Параметры: userlogin, userpsw.

**Ответ:** массив `AbcpBasketItem[]` (`id`, `name`).

```ts
const baskets = await abcpGet<AbcpBasketItem[]>('/basket/multibasket', auth);
```

---

### 4.2 POST /basket/add — добавить или удалить позицию

Добавляет позиции в корзину по паре brand–number–itemKey–supplierCode (или по внутреннему коду **code**) с указанием количества и комментария. Если та же позиция уже есть в корзине, количество прибавляется к существующему. **Удаление:** передать ту же позицию с **quantity=0**. Для изменения количества рекомендуется удалить позицию и добавить заново с нужным quantity. Поля itemKey и supplierCode берутся из ответа search/articles.

**Метод:** POST. Тело: `application/x-www-form-urlencoded`.

**Параметры тела:** userlogin, userpsw; опционально **basketId** (при мультикорзине). Массив позиций: для каждой — либо `positions[i][number]`, `positions[i][brand]`, либо `positions[i][code]`, плюс `positions[i][supplierCode]`, `positions[i][itemKey]`, `positions[i][quantity]`, `positions[i][comment]` (comment опционально).

**Ответ:** `AbcpBasketAddResponse`. Поле **status** 0 при ошибке хотя бы по одной позиции, 1 — успех. В **positions** — результат по каждой позиции (status 0/1, errorMessage при ошибке).

```ts
await abcpPost('/basket/add', auth, {
  positions: [
    {
      number: '01089',
      brand: 'Febi',
      supplierCode: '54325',
      itemKey: 'HFGJKfkdjghreiHJhfdjKhjskhfk',
      quantity: 15,
      comment: '',
    },
  ],
});
```

---

### 4.3 POST /basket/clear — очистка корзины

Удаляет все позиции из корзины. При мультикорзине можно передать **basketId**, иначе очищается корзина по умолчанию.

**Метод:** POST. Тело: userlogin, userpsw, опционально basketId.

**Ответ:** `AbcpBasketClearResponse` (status 0|1, errorMessage при ошибке).

```ts
const result = await abcpPost<AbcpBasketClearResponse>('/basket/clear', auth, {});
```

---

### 4.4 GET /basket/content — содержимое корзины

Возвращает список позиций в корзине с ценами, сроками, positionId и статусом. При включённой опции «разрешать частичное оформление заказа» в ответ попадают только отмеченные позиции. **positionId** из ответа используется для частичного оформления (positionIds в basket/order).

**Метод:** GET. Параметры: userlogin, userpsw, опционально basketId.

**Ответ:** массив `AbcpBasketContentPosition[]` (brand, number, code, supplierCode, itemKey, description, price, priceRate, priceInSiteCurrency, quantity, deadline, deadlineMax, comment, status, positionId, packing, errorMessage).

```ts
const content = await abcpGet<AbcpBasketContentPosition[]>('/basket/content', auth);
```

---

### 4.5 GET /basket/options — опции корзины

Возвращает значения настроек корзины: например, запрет создания нового адреса доставки, настройка «Самовывоз» в адресах. Нужно для корректного отображения и блокировки полей в UI оформления заказа.

**Метод:** GET. Параметры: userlogin, userpsw.

**Ответ:** объект с полем **options** — массив `AbcpBasketOption[]` (disallow_new_shipment_address: 1 или 2, self_shipment и др.), опционально **errors** — массив ошибок.

```ts
const { options, errors } = await abcpGet<{ options: AbcpBasketOption[]; errors?: unknown[] }>(
  '/basket/options',
  auth
);
```

---

### 4.6 GET /basket/paymentMethods — способы оплаты

Возвращает список доступных способов оплаты. Идентификатор способа оплаты нужен при отправке заказа (если на сайте включена опция «Корзина: показывать тип оплаты»). Передаётся в параметре **paymentMethod** при вызове basket/order или orders/instant.

**Метод:** GET. Параметры: userlogin, userpsw.

**Ответ:** массив `AbcpPaymentMethod[]` (id, name).

```ts
const methods = await abcpGet<AbcpPaymentMethod[]>('/basket/paymentMethods', auth);
```

---

### 4.7 GET /basket/shipmentMethods — способы доставки

Возвращает список способов доставки. Идентификатор нужен при оформлении заказа. **С 20.10.2025 параметр shipmentMethod обязателен**, если этот метод возвращает непустой список (при включённой опции «Корзина: показывать типы доставки»).

**Метод:** GET. Параметры: userlogin, userpsw.

**Ответ:** массив `AbcpShipmentMethod[]` (id, name).

```ts
const methods = await abcpGet<AbcpShipmentMethod[]>('/basket/shipmentMethods', auth);
```

---

### 4.8 GET /basket/shipmentOffices — офисы самовывоза

Возвращает список офисов самовывоза. Используется при выборе «Самовывоз» — идентификатор офиса передаётся в **shipmentOffice** при оформлении заказа. Параметр **officesType** задаёт контекст: `order` (по умолчанию) или `registration`.

**Метод:** GET. Параметры: userlogin, userpsw, опционально **officesType** (`order` | `registration`).

**Ответ:** массив `AbcpShipmentOffice[]` (id, name).

```ts
const offices = await abcpGet<AbcpShipmentOffice[]>('/basket/shipmentOffices', auth);
```

---

### 4.9 GET /basket/shipmentAddresses — адреса доставки

Возвращает список сохранённых адресов доставки пользователя. Идентификатор адреса передаётся в **shipmentAddress** при оформлении заказа. При самовывозе передаётся **shipmentAddress=0**. Если метод не возвращает адресов, параметр shipmentAddress может быть необязательным (по правилам сайта).

**Метод:** GET. Параметры: userlogin, userpsw.

**Ответ:** массив `AbcpShipmentAddress[]` (id, name).

```ts
const addresses = await abcpGet<AbcpShipmentAddress[]>('/basket/shipmentAddresses', auth);
```

---

### 4.10 GET /basket/shipmentDates — даты отгрузки

Возвращает доступные даты отгрузки. Нужен при включённой опции «Корзина: показывать дату отгрузки» — выбранная дата передаётся в **shipmentDate** при оформлении заказа. Даты зависят от сроков поставки позиций (minDeadlineTime, maxDeadlineTime) и при необходимости от адреса доставки (shipmentAddress) для учёта времени комплектации офиса.

**Метод:** GET. Параметры: userlogin, userpsw; опционально **minDeadlineTime**, **maxDeadlineTime** (часы), **shipmentAddress** (id адреса).

**Ответ:** массив `AbcpShipmentDate[]` (date в формате YYYY-MM-DD, name — дата и день недели для отображения).

```ts
const dates = await abcpGet<AbcpShipmentDate[]>('/basket/shipmentDates', auth, {
  minDeadlineTime: '24',
  maxDeadlineTime: '48',
});
```

---

### 4.11 POST /basket/shipmentAddress — добавить адрес доставки

Создаёт новый адрес доставки для пользователя. После создания его можно выбрать в shipmentAddresses и передать в shipmentAddress при заказе.

**Метод:** POST. Тело: userlogin, userpsw, **address** (строка — текст адреса).

**Ответ:** `AbcpShipmentAddressAddResponse` (shipmentAddressId — идентификатор созданного адреса).

```ts
const result = await abcpPost<AbcpShipmentAddressAddResponse>('/basket/shipmentAddress', auth, {
  address: 'г. Москва, ул. Примерная, д. 1',
});
```

---

### 4.12 POST /basket/order — оформить заказ из корзины

Отправляет позиции из корзины в заказ. Возвращает статус операции и список созданных заказов с позициями. Даже при status=0 часть позиций могла уйти — нужно проверять узел **orders** на наличие сформированных заказов. **Ограничение: не более 500 позиций в одном заказе.** При включённой опции «разрешать частичное оформление» можно передать **positionIds** — номера позиций из basket/content.

**Метод:** POST. Тело: userlogin, userpsw и параметры из `AbcpOrderParams` (paymentMethod, shipmentMethod при включённых типах доставки с 20.10.2025, shipmentAddress, опционально shipmentOffice, shipmentDate, comment, basketId, wholeOrderOnly, positionIds, clientOrderNumber).

**Ответ:** `AbcpOrderResult`. Поле **orders** — массив заказов `AbcpOrderRaw[]`, в каждом заказе **positions** — массив `AbcpOrderPosition[]`.

```ts
const result = await abcpPost<AbcpOrderResult>('/basket/order', auth, {
  paymentMethod: 37,
  shipmentMethod: 4323,
  shipmentAddress: 788,
  shipmentDate: '2012-12-21',
  comment: 'срочно',
});
```

---

## 5. Заказы

### 5.1 POST /orders/instant — моментальный заказ

Объединяет добавление позиций в корзину и отправку заказа в одном запросе: переданные в **positions** товары добавляются в корзину и сразу отправляются в заказ. Позиции, которые уже лежат в корзине, в этот заказ **не попадают** и остаются в корзине. Удобно для автоматического перезаказа у клиентов платформы ABCP. Лимит — 500 позиций. Требования к параметрам доставки/оплаты те же, что у basket/order (shipmentAddress обязателен, с 20.10.2025 — shipmentMethod при включённых типах доставки, shipmentDate при «днях отгрузки»).

**Метод:** POST. Тело: userlogin, userpsw; массив **positions** в том же формате, что для basket/add (brand, number, supplierCode, itemKey, quantity, comment или code вместо brand/number); плюс параметры оформления: paymentMethod, shipmentMethod, shipmentAddress, опционально shipmentOffice, shipmentDate, comment, basketId, wholeOrderOnly, clientOrderNumber.

**Ответ:** `AbcpOrderResult` (status, errorMessage, clientOrderNumber, orders — массив созданных заказов с positions).

```ts
const result = await abcpPost<AbcpOrderResult>('/orders/instant', auth, {
  positions: [
    {
      number: '01089',
      brand: 'Febi',
      supplierCode: '54325',
      itemKey: 'HFGJKfkdjghreiHJhfdjKhjskhfk',
      quantity: 15,
    },
  ],
  paymentMethod: 37,
  shipmentMethod: 4323,
  shipmentAddress: 788,
  shipmentDate: '2012-12-21',
  comment: 'срочно',
});
```

---

### 5.2 GET /orders/statuses — список статусов заказов и позиций

Возвращает справочник всех статусов заказов и позиций в системе: id, название, цвет, признак конечного статуса (isFinalStatus). Используется для отображения статусов в списке заказов и детализации. В проекте тип `AbcpOrderStatusItem` объявлен в `abcpPlatform.types.d.ts`.

**Метод:** GET. Параметры: userlogin, userpsw.

**Ответ:** массив `AbcpOrderStatusItem[]` (id, name, color, isFinalStatus).

```ts
const statuses = await abcpGet<AbcpOrderStatusItem[]>('/orders/statuses', auth);
```

---

### 5.3 GET /orders/list — позиции заказов со статусами

Принимает список номеров заказов и возвращает полную информацию по каждому заказу: статус, адрес доставки, сумму, дату, список позиций с детальными статусами, заметки (notes). Удобно для детального просмотра выбранных заказов без постраничной выборки.

**Метод:** GET. Параметры: userlogin, userpsw, **orders[]** — массив номеров заказов (например orders[0]=5642365&orders[1]=8765875).

**Ответ:** массив заказов с полной структурой (как `AbcpOrderRaw`): number, status, statusId, statusCode, statusColor, positionsQuantity, deliveryAddressId, deliveryAddress, deliveryOfficeId, deliveryOffice, deliveryTypeId, deliveryType, paymentTypeId, paymentType, deliveryCost, shipmentDate, sum, date, code, debt, comment, clientOrderNumber, **positions[]**, **notes[]**. В positions — positionId, brand, number, code, supplierCode, itemKey, quantityOrdered, quantity, price, priceRate, priceInSiteCurrency, deadline, deadlineMax, comment, commentAnswer, status, statusId, statusCode, statusColor, statusDate, noReturn, reference.

```ts
const orders = await abcpGet<AbcpOrderRaw[]>('/orders/list', auth, {
  orders: ['5642365', '8765875'],
});
```

---

### 5.4 GET /orders/ — список заказов постранично

Возвращает список всех заказов клиента с постраничной навигацией. Сортировка по номеру заказа по убыванию (сначала новые). При **format=p** к каждому заказу добавляется массив позиций. В ответе **items** — объект (словарь), ключ — номер заказа. В проекте используется в `fetchAbcpOrders` и маппинге в `abcpOrdersMapper`; типы `AbcpOrdersResponse`, `FetchOrdersParams` — в `abcpPlatform.types.d.ts`. API может возвращать count, sum, quantity, price строками (например «2 040,74») — маппер приводит их к числам.

**Метод:** GET. Параметры: userlogin, userpsw; опционально **format** (`p` — с позициями), **skip** (сколько пропустить, по умолчанию 0), **limit** (1–1000, по умолчанию 100), **dateStart**, **dateEnd** (формат DD.MM.YYYY).

**Ответ:** `AbcpOrdersResponse`: **count** (общее количество заказов), **items** — объект `Record<string, AbcpOrderRaw>` (ключ — number заказа).

```ts
const data = await abcpGet<AbcpOrdersResponse>('/orders/', auth, {
  format: 'p',
  skip: 0,
  limit: 200,
});
```

---

### 5.5 POST /orders/cancelPosition — запрос на отмену позиции

Выставляет позиции признак «Запрос на отмену». Передаётся идентификатор позиции (positionId), полученный из списка заказов или из ответа basket/order / orders/list.

**Метод:** POST. Тело: userlogin, userpsw, **positionId** (идентификатор позиции заказа).

**Ответ:** при успехе — сообщение в поле **message**; при ошибке — сообщение об ошибке.

```ts
await abcpPost('/orders/cancelPosition', auth, { positionId: '232324455' });
```

---

### 5.6 GET /orders/version — версия подсистемы заказов

Возвращает версию подсистемы заказов, используемую магазином. Доступные значения: 1 или 2. Может использоваться для условной логики или отладки.

**Метод:** GET. Параметры: userlogin, userpsw.

**Ответ:** число 1 или 2.

---

## 6. Пользователь

### 6.1 POST /user/new — регистрация

Регистрация нового пользователя. Набор полей зависит от настроек сайта (форма регистрации). Обычно передаются: marketType (1 — розница, 2 — опт), filialId, имя, email, телефон, пароль и др. по документации и form/fields.

**Метод:** POST. Тело: параметры регистрации по настройкам магазина.

**Ответ:** статус, учётные данные нового пользователя или сообщение об ошибке.

---

### 6.2 POST /user/activation — активация

Активация учётной записи по коду из письма или по правилам, заданным на сайте. Параметры запроса зависят от инструкции активации.

**Метод:** POST. Тело: параметры по инструкции активации.

---

### 6.3 GET /user/info — данные пользователя (профиль)

Возвращает данные профиля текущего пользователя после авторизации. Используется для проверки учётных данных и отображения информации в личном кабинете.

**Метод:** GET. Параметры: userlogin, userpsw.

**Ответ:** объект с данными профиля пользователя.

```ts
const profile = await abcpGet<Record<string, unknown>>('/user/info', auth);
```

---

### 6.4 POST /user/restore — восстановление пароля

Инициация восстановления пароля. Тело и ответ зависят от правил, настроенных на сайте (например email или логин).

**Метод:** POST. Тело: по правилам восстановления пароля на сайте.

---

## 7. Гараж (автомобили пользователя)

### 7.1 GET /user/garage — список автомобилей

Возвращает список автомобилей, привязанных к пользователю (гараж). Каждый элемент содержит идентификатор и краткие данные для отображения в списке.

**Метод:** GET. Параметры: userlogin, userpsw.

**Ответ:** массив объектов с данными автомобилей.

```ts
const garage = await abcpGet<unknown[]>('/user/garage', auth);
```

---

### 7.2 GET /user/garage/car — информация об автомобиле

Возвращает полные данные по одному автомобилю по его идентификатору. Используется для просмотра и редактирования карточки автомобиля.

**Метод:** GET. Параметры: userlogin, userpsw, **carId** (идентификатор автомобиля).

**Ответ:** объект с данными автомобиля (марка, модель, год, модификация и т.д.).

```ts
const car = await abcpGet<Record<string, unknown>>('/user/garage/car', auth, {
  carId: '12345',
});
```

---

### 7.3 POST /user/garage/add — добавить автомобиль

Добавляет новый автомобиль в гараж пользователя. Набор полей (марка, модель, год, модификация и т.д.) можно получить из GET /form/fields для соответствующей формы.

**Метод:** POST. Тело: userlogin, userpsw и параметры автомобиля по form/fields.

---

### 7.4 POST /user/garage/update — обновить автомобиль

Обновляет данные существующего автомобиля. В теле передаётся carId и изменяемые поля.

**Метод:** POST. Тело: userlogin, userpsw, **carId**, и обновляемые поля.

---

### 7.5 POST /user/garage/delete — удалить автомобиль

Удаляет автомобиль из гаража пользователя.

**Метод:** POST. Тело: userlogin, userpsw, **carId**.

---

## 8. Дерево автомобилей (каталог)

Справочники для построения цепочки выбора: год → производитель → модель → модификация. Используются в UI подбора запчастей по автомобилю.

### 8.1 GET /cartree/years — годы

Возвращает список доступных годов выпуска для выбора в каталоге.

**Метод:** GET. Параметры: по документации (часто без дополнительных).

**Ответ:** массив годов.

---

### 8.2 GET /cartree/manufacturers — производители

Возвращает список производителей (марок) автомобилей для выбранного года.

**Метод:** GET. Параметры: **year** (год).

**Ответ:** массив объектов производителей (id, name и др.).

```ts
const manufacturers = await abcpGet<unknown[]>('/cartree/manufacturers', auth, {
  year: '2020',
});
```

---

### 8.3 GET /cartree/models — модели

Возвращает список моделей выбранного производителя за выбранный год.

**Метод:** GET. Параметры: **year**, **manufacturerId** или **manufacturer**.

**Ответ:** массив моделей.

```ts
const models = await abcpGet<unknown[]>('/cartree/models', auth, {
  year: '2020',
  manufacturerId: '123',
});
```

---

### 8.4 GET /cartree/modifications — модификации

Возвращает список модификаций (двигатель, кузов и т.д.) для выбранной модели.

**Метод:** GET. Параметры: **year**, **manufacturerId**, **modelId** или **model**.

**Ответ:** массив модификаций.

```ts
const modifications = await abcpGet<unknown[]>('/cartree/modifications', auth, {
  year: '2020',
  manufacturerId: '123',
  modelId: '456',
});
```

---

## 9. Прочее

### 9.1 GET /form/fields — поля форм

Возвращает описание полей форм сайта (регистрация, гараж, профиль и т.д.): названия, типы, обязательность, варианты значений. Используется для динамического построения UI форм без жёсткой привязки к настройкам конкретного магазина.

**Метод:** GET. Параметры: по документации (часто userlogin, userpsw).

**Ответ:** список полей и их параметров.

```ts
const fields = await abcpGet<unknown>('/form/fields', auth);
```

---

### 9.2 GET /articles/brands — справочник брендов

Возвращает данные справочника брендов (производителей запчастей). Может использоваться для автодополнения, фильтров и отображения названий. Опционально поддерживаются фильтры по документации.

**Метод:** GET. Параметры: userlogin, userpsw, опционально фильтры по документации.

**Ответ:** данные справочника брендов (структура по ответу API).

```ts
const brandsData = await abcpGet<unknown>('/articles/brands', auth);
```

---

### 9.3 GET /articles/card — карточка товара

Возвращает расширенную карточку товара по бренду и номеру: описание, изображения, аналоги, применение по автомобилям и т.д. Параметры могут дополняться по документации (например модификация автомобиля для уточнения применения).

**Метод:** GET. Параметры: userlogin, userpsw, **brand**, **number**, и др. по документации.

**Ответ:** объект с полной карточкой товара.

```ts
const card = await abcpGet<Record<string, unknown>>('/articles/card', auth, {
  brand: 'Febi',
  number: '01089',
});
```

---

## 10. Важные замечания

1. **Пароль:** передаётся только MD5-хэш в `userpsw`.
2. **Корзина и заказ:** для добавления в корзину и заказа нужны **itemKey** и **supplierCode** из результата search/articles.
3. **Оформление заказа:** с 20.10.2025 при включённых способах доставки обязателен **shipmentMethod**. **shipmentAddress** обязателен (0 при самовывозе), если в настройках требуется адрес.
4. **Лимит:** один заказ — не более 500 позиций.
5. **Типы в проекте:** заказы и статьи поиска типизированы в `src/services/abcp/abcpPlatform.types.d.ts` (`AbcpOrderRaw`, `AbcpOrderPosition`, `AbcpOrdersResponse`, `AbcpOrderStatusItem`, `AbcpArticleSearchResult`, `FetchOrdersParams`, `AbcpSupplierAlias`). Ответы API могут приходить со строковыми полями (например `quantity`, `price`, `sum`) — маппер в `abcpOrdersMapper.ts` приводит их к числам.
6. **Демо:** для тестов — `https://demo.public.api.abcp.ru`; для продакшена — базовый URL вашего ABCP-сайта.

Оригинальная документация: [ABCP Documentation — API.ABCP.Client](https://www.abcp.ru/wiki/API.ABCP.Client). Сырые данные: `temp/API_ABCP_Client.md`.
