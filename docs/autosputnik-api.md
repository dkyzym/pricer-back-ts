# Autosputnik REST API — документация для JavaScript/TypeScript

Описание API интеграции с auto-sputnik.ru.  
Базовый URL: `https://newapi.auto-sputnik.ru`  
Swagger: https://newapi.auto-sputnik.ru/swagger/v1/swagger.json (OAS3, Apiautosputnik2 v1).

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

async function getAutosputnikToken(login: string, password: string): Promise<string> {
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

| Алиас          | Переменные окружения        |
|----------------|-----------------------------|
| autosputnik    | AUTOSPUTNIK_LOGIN, AUTOSPUTNIK_PASS   |
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

| Параметр             | Тип     | Обязательный | По умолчанию | Описание |
|----------------------|--------|--------------|--------------|----------|
| articul              | string | Да           | —            | Артикул  |
| displaycountproduct  | boolean| Нет          | false        | Показывать количество предложений по каждому бренду |

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
  countproduct?: number;  // при displaycountproduct=true
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
  articul: string;   // обяз., minLength: 1
  brand: string;     // наименование бренда, обяз.
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
  delivery_date: string;   // ISO date-time
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

Обязательно указать либо даты, либо номер заказа.

**Тело запроса:**

```ts
interface AutosputnikOrderGetRequest {
  date_start?: string;  // ISO date-time, начало периода
  date_end?: string;    // ISO date-time, конец периода
  orderid?: number;     // 0 — не по номеру, иначе фильтр по заказу
  page?: number;       // страница, в проекте 1
  pageSize?: number;    // размер страницы, в проекте 500
}
```

**Ответ 200:**

```ts
interface AutosputnikProductRaw {
  id: number;
  orderid: number;
  articul: string;
  brand_id: number;
  brand_name: string;
  product_name: string;
  statusid: number;
  status: string;
  date_delivery: string | null;
  price: number;
  quantity: number;
  amount: number;
  comment_product?: string | null;
  return_possible?: boolean | null;
}

interface AutosputnikOrderRaw {
  id: number;
  userid: number;
  date: string;
  comment: string;
  products: AutosputnikProductRaw[];
}

interface AutosputnikGetOrdersResponse {
  error: string | null;
  countorders: number;
  totalpages: number;
  data: AutosputnikOrderRaw[];
}
```

**Пример (по периоду с пагинацией):**

```ts
const payload = {
  date_start: new Date().toISOString(), // или startOf('day')
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
const data = (await res.json()) as AutosputnikGetOrdersResponse;
const orders = data.data ?? [];
// data.countorders, data.totalpages — для пагинации
```

При 401 в проекте токен для текущего алиаса сбрасывается, запрашивается новый и запрос повторяется.

---

## 5. Basket — корзина

Базовый путь: `/basket/...`. Во всех запросах нужен заголовок `Authorization: Bearer <token>`.

### 5.1 GET /basket/get — список позиций в корзине

Параметров нет.

**Ответ 200:** `{ error: string | null; data: BasketProduct[] }`

```ts
interface AutosputnikBasketProduct {
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
```

---

### 5.2 POST /basket/add — добавить позицию

**Тело запроса:**

```ts
interface AutosputnikBasketAddRequest {
  articul: string;
  brandid: number;
  quantity: number;
  price: number;
  id_shop_prices: number;
  comment?: string;
}
```

**Ответ 200:** тот же формат, что у GET /basket/get (обновлённый список в `data`).

---

### 5.3 POST /basket/clear — очистить корзину

Параметров и тела нет. Ответ — как у GET /basket/get (пустой массив в `data`).

---

### 5.4 POST /basket/deleteposition — удалить позиции

**Тело запроса:** массив ID позиций корзины, например `[123, 456]`.

**Ответ 200:** обновлённый список корзины в `data`.

---

### 5.5 POST /basket/editquantity — изменить количество

**Тело запроса:** идентификатор позиции в корзине и новое количество (точная схема в Swagger: BasketViewModelRequest и связанные модели). Ответ — обновлённая корзина.

---

## 6. Формат дат

- В запросах (**date_start**, **date_end**): **ISO 8601** (например `2026-03-07T05:13:24.717Z`). В проекте для периода используется Luxon: `DateTime.fromJSDate(date).startOf('day').toISO()` и т.п.
- В ответах (**date**, **date_delivery**, **delivery_date**): строка в формате **date-time** (ISO 8601).

Парсинг: `new Date(str)` или Luxon `DateTime.fromISO(str)`.

---

## 7. Переменные окружения (проект)

| Переменная           | Описание                          |
|----------------------|-----------------------------------|
| AUTOSPUTNIK_LOGIN    | Логин для контура autosputnik     |
| AUTOSPUTNIK_PASS     | Пароль для контура autosputnik    |
| AUTOSPUTNIK_LOGIN_BN | Логин для контура autosputnik_bn  |
| AUTOSPUTNIK_PASS_BN  | Пароль для контура autosputnik_bn |

Базовый URL зашит в коде (`autosputnikApi.ts`: `BASE_URL = 'https://newapi.auto-sputnik.ru'`). При необходимости его можно вынести в переменную окружения.

---

## 8. Статусы заказа (statusid)

В ответе заказов у каждой позиции есть **statusid** и текст **status**. Маппинг в единый `OrderStatus` выполняется в `autosputnikOrdersMapper.ts` (функция `mapAutosputnikStatus`). Актуальные значения и названия статусов берутся из ответов API или документации поставщика.

---

*Документация собрана по Swagger UI (newapi.auto-sputnik.ru) и коду сервиса autosputnik в репозитории.*
