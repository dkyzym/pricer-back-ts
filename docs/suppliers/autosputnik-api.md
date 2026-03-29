# Autosputnik REST API — документация для JavaScript/TypeScript

Описание API интеграции с auto-sputnik.ru.  
Базовый URL: `https://newapi.auto-sputnik.ru`  
Swagger: <https://newapi.auto-sputnik.ru/swagger/v1/swagger.json> (OAS3, Apiautosputnik2 v1).

---

## 1. Авторизация и ограничения

### 1.1 Получение токена

Сначала вызывается **POST /users/login**; в ответ приходит токен. Далее во всех запросах передаётся заголовок:

```
Authorization: Bearer <token>
```

```ts
const BASE_URL = 'https://newapi.auto-sputnik.ru';

interface AutosputnikLoginRequest {
  login: string;
  password: string;
}

interface AutosputnikAuthResponse {
  error: string | null;
  token: string | null;
  userid: number;
}

async function getAutosputnikToken(
  login: string,
  password: string
): Promise<string> {
  const res = await fetch(`${BASE_URL}/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login, password }),
  });
  const data = (await res.json()) as AutosputnikAuthResponse;
  if (data.error || !data.token) {
    throw new Error(data.error ?? 'Auth failed');
  }
  return data.token;
}
```

### 1.2 Два контура (проект)

В проекте используются два набора учётных данных для одного и того же API:

| Алиас          | Переменные окружения                      |
| -------------- | ----------------------------------------- |
| autosputnik    | AUTOSPUTNIK_LOGIN, AUTOSPUTNIK_PASS       |
| autosputnik_bn | AUTOSPUTNIK_LOGIN_BN, AUTOSPUTNIK_PASS_BN |

Токен кешируется отдельно по алиасу (`tokenCache` в autosputnikApi.ts). При 401 токен для этого алиаса сбрасывается и запрос повторяется с новым токеном.

### 1.3 Лимит и ошибки

- **Ограничение: 30 запросов в минуту.** При превышении в ответе возвращается ошибка в поле **error**.
- Во многих ответах есть поле **error** (string | null). При успехе — `null` или пустая строка.

### 1.4 Формат ответа (XML)

Для получения ответа в XML в пути вместо сегмента по умолчанию подставляется **XML**, например:  
`/products/getbrands.XML?articul=z90`. В коде обычно используется JSON (без .XML).

---

## 2. User — авторизация

### 2.1 POST /users/login — получение токена

**Тело запроса:**

```ts
interface AutosputnikLoginRequest {
  login: string;
  password: string;
}
```

**Ответ 200:** см. `AutosputnikAuthResponse` выше (`error`, `token`, `userid`).

---

## 3. Products — бренды и товары

### 3.1 GET /products/getbrands — бренды по артикулу

**Query-параметры:**

| Параметр            | Тип     | Обязательный | По умолчанию | Описание                                            |
| ------------------- | ------- | ------------ | ------------ | --------------------------------------------------- |
| articul             | string  | Да           | —            | Артикул                                             |
| displaycountproduct | boolean | Нет          | false        | Показывать количество предложений по каждому бренду |

**Ответ 200:**

```ts
interface AutosputnikBrandObj {
  id: number;
  name: string;
}

interface AutosputnikBrandItem {
  articul: string;
  brand: AutosputnikBrandObj;
  name: string;
  countproduct?: number; // при displaycountproduct=true
}

interface AutosputnikGetBrandsResponse {
  error: string | null;
  data: AutosputnikBrandItem[];
}
```

**Пример:**

```ts
const params = new URLSearchParams({
  articul: '102870',
  displaycountproduct: 'true',
});
const res = await fetch(`${BASE_URL}/products/getbrands?${params}`, {
  headers: { Authorization: `Bearer ${token}` },
});
const data = (await res.json()) as AutosputnikGetBrandsResponse;
const brands = data.error ? [] : (data.data ?? []);
```

---

### 3.2 GET /products/getbrandsAll — все производители

Параметров нет. Ответ: `{ error: string | null; data: Array<{ id: number; name: string }> }`.

---

### 3.3 POST /products/getproducts — предложения по артикулу и бренду

**Тело запроса:**

```ts
interface AutosputnikGetProductsRequest {
  articul: string; // обяз., minLength: 1
  brand: string; // наименование бренда, обяз.
  analogi?: boolean; // аналоги, по умолчанию false
  tranzit?: boolean; // транзит, в проекте true
}
```

**Ответ 200:**

```ts
interface AutosputnikProductItem {
  articul: string;
  articul_search: string;
  brand: AutosputnikBrandObj;
  name: string;
  quantity: number;
  price: number;
  delivery_day: number;
  price_name: string | null;
  delivery_date: string; // ISO date-time
  our: boolean;
  analog: boolean;
  id_shop_prices: number;
  unit: string | null;
  min: number;
  cratnost: number;
  vozvrat: boolean;
  official_diler: boolean;
  ismark: boolean;
  shipping_proc: number;
}

interface AutosputnikGetProductsResponse {
  error: string | null;
  data: AutosputnikProductItem[];
}
```

**Пример:**

```ts
const res = await fetch(`${BASE_URL}/products/getproducts`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    articul: '102870',
    brand: 'MOTUL',
    analogi: false,
    tranzit: true,
  }),
});
const data = (await res.json()) as AutosputnikGetProductsResponse;
const products = data.error ? [] : (data.data ?? []);
```

---

## 4. Order — заказы

### 4.1 POST /order/get — список заказов

Получение списка заказов. **Обязательно указать либо даты, либо номер заказа.**

Доступны два маршрута:
- `POST /order/get` — возвращает JSON (по умолчанию)
- `POST /order/get.{format}` — позволяет указать формат ответа (json или xml)

**Параметры пути (для `/order/get.{format}`):**

| Параметр | Тип    | Обязательный | Описание                                     |
| -------- | ------ | ------------ | -------------------------------------------- |
| format   | string | Нет          | Формат ответа: json или xml                  |

**Тело запроса:**

```ts
interface OrderGetViewModelPost {
  date_start?: string; // ISO date-time, начало периода
  date_end?: string; // ISO date-time, конец периода
  orderid?: number; // 0 — не по номеру, иначе фильтр по номеру заказа
  page?: number; // номер страницы (по умолчанию 1)
  pageSize?: number; // размер страницы (по умолчанию 500)
}
```

**Ответ 200:**

Возвращает `OrderViewModelRequestcs` (см. раздел Schemas).

**Пример (запрос по периоду дат):**

```ts
const payload: OrderGetViewModelPost = {
  date_start: new Date().toISOString(),
  date_end: new Date().toISOString(),
  orderid: 0,
  page: 1,
  pageSize: 500,
};

const res = await fetch(`${BASE_URL}/order/get`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(payload),
});

const data = (await res.json()) as OrderViewModelRequestcs;
if (!data.error) {
  const orders = data.data ?? [];
  console.log(`Всего заказов: ${data.countorders}, страниц: ${data.totalpages}`);
}
```

**Пример (запрос с указанием формата):**

```ts
const res = await fetch(`${BASE_URL}/order/get.json`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(payload),
});
```

При 401 в проекте токен для текущего алиаса сбрасывается, запрашивается новый и запрос повторяется.

---

### 4.2 POST /order/create — создание заказа

Создание нового заказа на основе товаров в корзине.

Доступны два маршрута:
- `POST /order/create` — возвращает JSON (по умолчанию)
- `POST /order/create.{format}` — позволяет указать формат ответа (json или xml)

**Параметры пути (для `/order/create.{format}`):**

| Параметр | Тип    | Обязательный | Описание                  |
| -------- | ------ | ------------ | ------------------------- |
| format   | string | Нет          | Формат ответа: json или xml |

**Тело запроса:**

```ts
interface CreateOrderModelViewPost {
  comment?: string; // опциональный комментарий к заказу
}
```

**Ответ 200:**

Возвращает `OrderViewModelRequestcs` (см. раздел Schemas). В поле `data` будет массив с созданным заказом.

**Пример:**

```ts
const payload: CreateOrderModelViewPost = {
  comment: 'Срочный заказ',
};

const res = await fetch(`${BASE_URL}/order/create`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(payload),
});

const data = (await res.json()) as OrderViewModelRequestcs;
if (!data.error && data.data && data.data.length > 0) {
  const createdOrder = data.data[0];
  console.log(`Заказ создан, ID: ${createdOrder.id}`);
} else {
  console.error('Ошибка создания заказа:', data.error);
}
```

**Примечание:** Перед созданием заказа убедитесь, что в корзине есть товары (см. раздел 5 Basket).

---

## 5. Basket — корзина

Базовый путь: `/basket/...`. Во всех запросах нужен заголовок `Authorization: Bearer <token>`.

### 5.1 GET /basket/get — список позиций в корзине

Получение содержимого корзины пользователя.

Доступны два маршрута:
- `GET /basket/get` — возвращает JSON (по умолчанию)
- `GET /basket/get.{format}` — позволяет указать формат ответа (json или xml)

**Параметры пути (для `/basket/get.{format}`):**

| Параметр | Тип    | Обязательный | Описание                  |
| -------- | ------ | ------------ | ------------------------- |
| format   | string | Нет          | Формат ответа: json или xml |

**Ответ 200:**

Возвращает `BasketViewModelRequest` (см. раздел Schemas).

**Пример:**

```ts
const res = await fetch(`${BASE_URL}/basket/get`, {
  headers: { Authorization: `Bearer ${token}` },
});

const data = (await res.json()) as BasketViewModelRequest;
if (!data.error) {
  const basketItems = data.data ?? [];
  console.log(`В корзине ${basketItems.length} позиций`);
  basketItems.forEach(item => {
    console.log(`${item.name} (${item.articul}): ${item.quantity} шт. = ${item.amount}`);
  });
}
```

---

### 5.2 POST /basket/add — добавить позицию

Добавление товара в корзину.

Доступны два маршрута:
- `POST /basket/add` — возвращает JSON (по умолчанию)
- `POST /basket/add.{format}` — позволяет указать формат ответа (json или xml)

**Параметры пути (для `/basket/add.{format}`):**

| Параметр | Тип    | Обязательный | Описание                  |
| -------- | ------ | ------------ | ------------------------- |
| format   | string | Нет          | Формат ответа: json или xml |

**Тело запроса:**

```ts
interface AddBasketViewModelPost {
  articul: string; // артикул товара
  brandid: number; // ID производителя
  quantity: number; // количество товара
  price: number; // цена товара
  id_shop_prices: number; // ID склада
  comment?: string; // опциональный комментарий (переносится в заказ при оформлении)
}
```

**Ответ 200:**

Возвращает обновлённый список корзины (`BasketViewModelRequest`).

**Пример:**

```ts
const payload: AddBasketViewModelPost = {
  articul: '102870',
  brandid: 1,
  quantity: 2,
  price: 1500,
  id_shop_prices: 5,
  comment: 'Оригинал',
};

const res = await fetch(`${BASE_URL}/basket/add`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(payload),
});

const data = (await res.json()) as BasketViewModelRequest;
if (!data.error) {
  console.log('Товар добавлен в корзину');
}
```

---

### 5.3 POST /basket/clear — очистить корзину

Полная очистка корзины пользователя.

Доступны два маршрута:
- `POST /basket/clear` — возвращает JSON (по умолчанию)
- `POST /basket/clear.{format}` — позволяет указать формат ответа (json или xml)

**Параметры пути (для `/basket/clear.{format}`):**

| Параметр | Тип    | Обязательный | Описание                  |
| -------- | ------ | ------------ | ------------------------- |
| format   | string | Нет          | Формат ответа: json или xml |

**Тело запроса:** пусто

**Ответ 200:**

Возвращает пустой список корзины (`BasketViewModelRequest` с `data: []`).

**Пример:**

```ts
const res = await fetch(`${BASE_URL}/basket/clear`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({}),
});

const data = (await res.json()) as BasketViewModelRequest;
if (!data.error) {
  console.log('Корзина очищена');
}
```

---

### 5.4 POST /basket/deleteposition — удалить позиции

Удаление одной или нескольких позиций из корзины.

Доступны два маршрута:
- `POST /basket/deleteposition` — возвращает JSON (по умолчанию)
- `POST /basket/deleteposition.{format}` — позволяет указать формат ответа (json или xml)

**Параметры пути (для `/basket/deleteposition.{format}`):**

| Параметр | Тип    | Обязательный | Описание                  |
| -------- | ------ | ------------ | ------------------------- |
| format   | string | Нет          | Формат ответа: json или xml |

**Тело запроса:**

Массив ID позиций корзины (число или массив чисел):

```ts
type DeleteBasketPositions = number | number[];

// Пример: [123, 456] — удалить две позиции
```

**Ответ 200:**

Возвращает обновлённый список корзины (`BasketViewModelRequest`).

**Пример:**

```ts
const positionsToDelete = [123, 456];

const res = await fetch(`${BASE_URL}/basket/deleteposition`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(positionsToDelete),
});

const data = (await res.json()) as BasketViewModelRequest;
if (!data.error) {
  console.log('Позиции удалены из корзины');
}
```

---

### 5.5 POST /basket/editquantity — изменить количество

Изменение количества товара в корзине.

Доступны два маршрута:
- `POST /basket/editquantity` — возвращает JSON (по умолчанию)
- `POST /basket/editquantity.{format}` — позволяет указать формат ответа (json или xml)

**Параметры пути (для `/basket/editquantity.{format}`):**

| Параметр | Тип    | Обязательный | Описание                  |
| -------- | ------ | ------------ | ------------------------- |
| format   | string | Нет          | Формат ответа: json или xml |

**Параметры query:**

| Параметр   | Тип    | Обязательный | Описание                           |
| ---------- | ------ | ------------ | ---------------------------------- |
| basketid   | number | Да           | ID позиции в корзине               |
| quantity   | number | Да           | Новое количество товара            |

**Ответ 200:**

Возвращает обновлённый список корзины (`BasketViewModelRequest`).

**Пример:**

```ts
const basketItemId = 123;
const newQuantity = 5;

const params = new URLSearchParams({
  basketid: String(basketItemId),
  quantity: String(newQuantity),
});

const res = await fetch(`${BASE_URL}/basket/editquantity?${params}`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
});

const data = (await res.json()) as BasketViewModelRequest;
if (!data.error) {
  console.log(`Количество обновлено на ${newQuantity}`);
}
```

**Альтернативный вариант (с форматом):**

```ts
const res = await fetch(
  `${BASE_URL}/basket/editquantity.json?basketid=${basketItemId}&quantity=${newQuantity}`,
  {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  }
);
```

---

## 6. Schemas — модели данных

Полная типизация для TypeScript/JavaScript проектов.

### Авторизация

```ts
interface LoginViewModel {
  login: string | null;
  password: string | null;
}

interface AutosputnikAuthResponse {
  error: string | null;
  token: string | null;
  userid: number;
}
```

### Бренды и товары

```ts
interface Brand {
  id: number;
  name: string | null;
}

interface Product_short {
  articul: string | null;
  brand: Brand;
  name: string | null;
  countproduct: number;
}

interface BrandsViewModelRequest {
  error: string | null;
  data: Product_short[] | null;
}

interface BrandsViewModelRequestAll {
  error: string | null;
  data: Brand[] | null;
}

interface Product {
  articul: string;
  articul_search: string;
  brand: Brand;
  name: string;
  quantity: number;
  price: number;
  delivery_day: number;
  price_name: string | null;
  delivery_date: string;
  our: boolean;
  analog: boolean;
  id_shop_prices: number;
  unit: string | null;
  min: number;
  cratnost: number;
  vozvrat: boolean;
  official_diler: boolean;
  ismark: boolean;
  shipping_proc: number;
}
```

### Заказы

```ts
interface OrderGetViewModelPost {
  date_start?: string; // ISO date-time
  date_end?: string; // ISO date-time
  orderid?: number;
  page?: number;
  pageSize?: number;
}

interface CreateOrderModelViewPost {
  comment?: string | null;
}

interface Order_product {
  id: number;
  orderid: number;
  articul: string | null;
  brand_id: number | null;
  brand_name: string | null;
  product_name: string | null;
  statusid: number | null;
  status: string | null;
  date_delivery: string | null; // ISO date-time
  price: number;
  quantity: number;
  amount: number;
  id_shop_prices: number | null;
  return_possible: boolean | null;
  comment_product: string | null;
}

interface Order {
  id: number;
  userid: number;
  date: string; // ISO date-time
  comment: string | null;
  products: Order_product[] | null;
}

interface OrderViewModelRequestcs {
  error: string | null;
  countorders: number;
  totalpages: number;
  data: Order[] | null;
}
```

### Корзина

```ts
interface AddBasketViewModelPost {
  articul: string; // обязательный, minLength: 1
  brandid: number;
  quantity: number;
  price: number;
  id_shop_prices: number;
  comment?: string | null;
}

interface Basket_product {
  id: number;
  articul: string | null;
  brand: string | null;
  name: string | null;
  brandid: number;
  userid: number;
  price: number;
  quantity: number;
  amount: number;
  id_shop_prices: number;
  comment: string | null;
}

interface BasketViewModelRequest {
  error: string | null;
  data: Basket_product[] | null;
}
```

---

## 7. Формат дат

- В запросах (**date_start**, **date_end**): **ISO 8601** (например `2026-03-07T05:13:24.717Z`). В проекте для периода используется Luxon: `DateTime.fromJSDate(date).startOf('day').toISO()` и т.п.
- В ответах (**date**, **date_delivery**, **delivery_date**): строка в формате **date-time** (ISO 8601).

Парсинг: `new Date(str)` или Luxon `DateTime.fromISO(str)`.

---

## 8. Переменные окружения (проект)

| Переменная           | Описание                          |
| -------------------- | --------------------------------- |
| AUTOSPUTNIK_LOGIN    | Логин для контура autosputnik     |
| AUTOSPUTNIK_PASS     | Пароль для контура autosputnik    |
| AUTOSPUTNIK_LOGIN_BN | Логин для контура autosputnik_bn  |
| AUTOSPUTNIK_PASS_BN  | Пароль для контура autosputnik_bn |

Базовый URL зашит в коде (`autosputnikApi.ts`: `BASE_URL = 'https://newapi.auto-sputnik.ru'`). При необходимости его можно вынести в переменную окружения.

---

## 9. Статусы заказа (statusid)

В ответе заказов у каждой позиции есть **statusid** и текст **status**. Маппинг в единый `OrderStatus` выполняется в `autosputnikOrdersMapper.ts` (функция `mapAutosputnikStatus`). Актуальные значения и названия статусов берутся из ответов API или документации поставщика.

---

_Документация собрана по Swagger UI (newapi.auto-sputnik.ru) и коду сервиса autosputnik в репозитории._
