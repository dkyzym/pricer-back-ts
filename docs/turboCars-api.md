# TurboCars REST API — документация для JavaScript/TypeScript

Спецификации: **Заказ** (`orders.yaml`), **Корзина** (`carts.yaml`).  
Базовый URL: `https://turbo-cars.ru/api`  
Swagger UI: https://turbo-cars.ru/api-docs (L5 Swagger).

---

## 1. Авторизация и заголовки

### 1.1 Bearer-токен (рекомендуется для серверной интеграции)

Все запросы выполняются с заголовком `Authorization: Bearer <token>`. Токен задаётся в переменной окружения `TURBOCARS_API_TOKEN`.

```ts
const BASE_URL = process.env.TURBOCARS_BASE_URL || 'https://turbo-cars.ru/api';
const token = process.env.TURBOCARS_API_TOKEN;

const headers = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/json',
};
```

### 1.2 Сессия в браузере (Swagger UI)

При работе через браузер в Swagger UI к запросам добавляется заголовок **X-CSRF-TOKEN** (значение выдаётся после входа). OAuth2 redirect: `https://turbo-cars.ru/api/oauth2-callback`.

---

## 2. Общий формат ошибок

При 4xx/5xx тело ответа может иметь вид:

```ts
interface TurboCarsErrorResponse {
  error_code: string;
  error_message: string | { description: string; [key: string]: unknown };
}
```

Проверка в коде:

```ts
function isTurboCarsError(data: unknown): data is TurboCarsErrorResponse {
  if (!data || typeof data !== 'object') return false;
  return typeof (data as any).error_code === 'string';
}

// после response.json()
if (isTurboCarsError(data)) {
  const msg = typeof data.error_message === 'string'
    ? data.error_message
    : (data.error_message as any)?.description ?? JSON.stringify(data.error_message);
  throw new Error(`TurboCars: ${data.error_code} — ${msg}`);
}
```

---

## 3. API заказов (orders)

Базовый путь для методов ниже: `https://turbo-cars.ru/api`.

### 3.1 Поиск брендов по артикулу — brands:search

- **Метод:** `GET`
- **Путь:** `/brands:search`

**Query-параметры:**

| Параметр | Тип   | Обязательный | Описание   |
|----------|--------|--------------|------------|
| code     | string | Да          | Артикул    |

**Ответ 200 (успех):**

```ts
interface TurboCarsBrandSearchSuccess {
  code: string;   // артикул из запроса
  brands: string[];
}
```

**Пример:**

```ts
const params = new URLSearchParams({ code: '102870' });
const res = await fetch(`${BASE_URL}/brands:search?${params}`, {
  headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
});
const data = await res.json();

if (!res.ok) {
  if (isTurboCarsError(data)) throw new Error(data.error_message as string);
  throw new Error(`HTTP ${res.status}`);
}
const brands: string[] = data.brands; // например ["Mahle"]
```

---

### 3.2 Поиск предложений — offers:search

- **Метод:** `GET`
- **Путь:** `/offers:search`

**Query-параметры:**

| Параметр            | Тип    | Обязательный | По умолчанию | Описание                              |
|---------------------|--------|--------------|--------------|----------------------------------------|
| code                | string | Да           | —            | Артикул                                |
| brand               | string | Да           | —            | Наименование бренда/производителя      |
| with_crosses        | number | Нет          | 0            | 1 — включить аналоги/кроссы            |
| with_offers         | number | Нет          | 0            | 1 — включить партнёрские предложения  |
| with_non_returnable | number | Нет          | 0            | 1 — включить невозвратные позиции      |

**Ответ 200 (успех):**

```ts
interface TurboCarsOfferRaw {
  provider_id: number;
  our_stock: boolean;
  cross: boolean;
  brand: string;
  code: string;
  name: string;
  price: string;
  multiplicity: number;
  currency: string;
  count: number;
  available_more: boolean;
  delivery_date_time_start: string | null;  // ISO 8601
  delivery_date_time_end: string | null;
  is_returnable: boolean;
  days_for_return: number;
  [key: string]: unknown;
}

interface TurboCarsOffersSearchSuccess {
  code: string;
  brand: string;
  offers: TurboCarsOfferRaw[];
}
```

**Пример:**

```ts
const params = new URLSearchParams({
  code: '102870',
  brand: 'MOTUL',
  with_crosses: '0',
  with_offers: '1',
  with_non_returnable: '0',
});
const res = await fetch(`${BASE_URL}/offers:search?${params}`, {
  headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
});
const data = await res.json();
const offers = data.offers ?? [];
```

---

### 3.3 Оформление заказа — order:create

- **Метод:** `POST`
- **Путь:** `/order:create`

**Тело запроса (JSON):**

```ts
interface TurboCarsOrderCreatePosition {
  provider_id: number;
  price: number;
  code: string;
  brand: string;
  count: number;
  comment?: string;
}

interface TurboCarsOrderCreateRequest {
  is_test: 0 | 1;
  positions: TurboCarsOrderCreatePosition[];
}
```

**Ответ 200 (успех):**

```ts
interface TurboCarsOrderCreateBadOffer {
  code: string;
  brand: string;
  reason: string;
}

interface TurboCarsOrderCreateResponse {
  order_number: string;       // например "1166-26112024"
  is_test: 0 | 1;
  bad_offers?: TurboCarsOrderCreateBadOffer[];
}
```

**Пример:**

```ts
const body: TurboCarsOrderCreateRequest = {
  is_test: 0,
  positions: [
    {
      provider_id: 811,
      price: 500.5,
      code: '102870',
      brand: 'MOTUL',
      count: 10,
      comment: 'комментарий',
    },
  ],
};

const res = await fetch(`${BASE_URL}/order:create`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(body),
});
const data = await res.json();
const orderNumber = data.order_number;
const badOffers = data.bad_offers ?? [];
```

---

### 3.4 Информация по заказам — orders:info

- **Метод:** `GET`
- **Путь:** `/orders:info`

**Query-параметры:**

| Параметр        | Тип    | Обязательный | Описание                    |
|-----------------|--------|--------------|-----------------------------|
| order_numbers[] | array  | Нет          | Номера заказов             |
| period_start    | string | Нет          | Фильтр по дате создания    |
| period_end      | string | Нет          | Фильтр по дате создания    |
| per_page        | number | Нет          | Размер страницы             |
| page            | number | Нет          | Номер страницы (пагинация)  |

Формат дат: **YYYY-MM-DD**.

**Ответ 200:**

```ts
interface TurboCarsPositionRaw {
  id: number;
  code: string;
  brand: string;
  name: string;
  price: string;
  delivery_date_time_start: string | null;  // ISO 8601
  delivery_date_time_end: string | null;
  count: number;
  status: string;
  comment?: string | null;
  status_id?: number | null;
  [key: string]: unknown;
}

interface TurboCarsOrderRaw {
  order_number: string;
  positions: TurboCarsPositionRaw[];
  [key: string]: unknown;
}

interface TurboCarsOrdersInfoResponse {
  orders_data: TurboCarsOrderRaw[];
  meta?: Record<string, unknown>;
}
```

**Пример (пагинация по периоду):**

```ts
const periodStart = '2024-01-01';
const periodEnd = '2024-12-31';
const perPage = 100;
let page = 1;
const allOrders: TurboCarsOrderRaw[] = [];

while (true) {
  const params = new URLSearchParams({
    period_start: periodStart,
    period_end: periodEnd,
    per_page: String(perPage),
    page: String(page),
  });
  const res = await fetch(`${BASE_URL}/orders:info?${params}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  const data = await res.json() as TurboCarsOrdersInfoResponse;
  const orders = data.orders_data ?? [];
  allOrders.push(...orders);
  if (orders.length < perPage) break;
  page++;
}
```

---

### 3.5 Статусы заказа — order:statuses

- **Метод:** `GET`
- **Путь:** `/order:statuses`

**Параметры:** нет.

**Ответ 200:** массив объектов вида `{ id: number; name: string }`, например:

```ts
interface TurboCarsOrderStatus {
  id: number;
  name: string;
}

// Пример: [{ id: 5, name: "Снято" }, ...]
const statuses: TurboCarsOrderStatus[] = await res.json();
```

---

## 4. API корзины (carts)

Спецификация описана в **carts.yaml** (Swagger: выбор «Корзина» в селекторе). Группы операций в UI:

- **carts** — корзина
- **cart_groups** — группы корзин

Точные пути и схемы запросов/ответов берутся из актуального `carts.yaml` (по ссылке из Swagger или после экспорта). Базовый URL тот же: `https://turbo-cars.ru/api`.

При необходимости интеграции с корзиной используйте Swagger UI (https://turbo-cars.ru/api-docs) и выберите определение «Корзина», либо запросите YAML по адресу: `https://turbo-cars.ru/api-docs/v1/carts.yaml`.

---

## 5. Формат дат

- В query-параметрах (**period_start**, **period_end**): строка **YYYY-MM-DD**.
- В ответах (**delivery_date_time_start**, **delivery_date_time_end** и т.п.): **ISO 8601** (например `2024-11-28T09:00:00.000000Z`).

Парсинг в JS: `new Date(str)` или Luxon `DateTime.fromISO(str)`.

---

## 6. Переменные окружения (проект)

| Переменная           | Описание                          |
|----------------------|-----------------------------------|
| TURBOCARS_BASE_URL   | Базовый URL API (по умолчанию `https://turbo-cars.ru/api`) |
| TURBOCARS_API_TOKEN  | Bearer-токен для авторизации      |

---

*Документация собрана по Swagger UI (orders.yaml, carts.yaml) и коду сервиса turboCars в репозитории.*
