# Profit (PR-LG) Client API — документация для JavaScript/TypeScript

Клиентское API Профит-Лиги для получения данных в реальном времени: заказы, остатки, формирование заказа без входа на сайт.

**Базовый URL:** `https://api.pr-lg.ru`  
**Формат ответа:** JSON  
**Версия API:** 1.4

---

## 1. Подключение

1. Регистрация на сайте и согласование договора с менеджером.
2. Формирование API-ключа в личном кабинете.
3. Передавать ключ при каждом запросе.

---

## 2. Авторизация

Авторизация — передача GET-параметра `secret` (API-ключ) в каждом запросе.

### 2.1 Базовый клиент (fetch)

```ts
const BASE_URL = 'https://api.pr-lg.ru';

interface ProfitAuth {
  secret: string;
}

async function profitGet<T>(
  path: string,
  auth: ProfitAuth,
  query: Record<string, string | number> = {}
): Promise<T> {
  const search = new URLSearchParams({
    secret: auth.secret,
    ...Object.fromEntries(
      Object.entries(query).map(([k, v]) => [k, String(v)])
    ),
  });
  const res = await fetch(`${BASE_URL}${path}?${search}`);
  if (!res.ok) throw new Error(`Profit API ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function profitPost<T>(
  path: string,
  auth: ProfitAuth,
  body: Record<string, string | number> = {}
): Promise<T> {
  const form = new URLSearchParams({
    secret: auth.secret,
    ...Object.fromEntries(
      Object.entries(body).map(([k, v]) => [k, String(v)])
    ),
  });
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  if (!res.ok) throw new Error(`Profit API ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}
```

---

## 3. Сводка методов

| Метод | Путь | HTTP | Описание |
|-------|------|------|----------|
| Список складов | `/search/warehouses` | GET | Список доступных складов |
| Поиск по артикулу | `/search/products` | GET | Товары по артикулу (без наличия по складам) |
| Поиск с наличием | `/search/items` | GET | Товары по артикулу с наличием по складам |
| Поиск с заменами | `/search/crosses` | GET | Остатки по артикулу и бренду, с заменами |
| Добавить в корзину | `/cart/add` | POST | Добавление позиции в корзину |
| Список корзины | `/cart/list` | GET | Товары в корзине |
| Удалить из корзины | `/cart/remove` | POST | Удаление позиции из корзины |
| Торговая точка | `/cart/point` | POST | Установка торговой точки по умолчанию |
| Настройки заказа | `/cart/params` | GET | Способы доставки, оплаты, точки |
| Оформить заказ | `/cart/order` | POST | Создание заказа из корзины |
| Список заказов | `/orders/list` | GET | Постраничный список заказов с позициями |

---

## 4. Склады и поиск

### 4.1 [GET] Список складов — `/search/warehouses`

Возвращает склады, доступные для офиса обслуживания пользователя.

**Параметры:**

| Параметр | Тип | Обязательный | Описание |
|----------|-----|---------------|----------|
| secret | string | да | API-ключ |
| action | string | да | Значение `"list"` |

**Ответ:** массив объектов склада.

```ts
interface ProfitWarehouse {
  id: number;
  name: string;
  delivery: string;       // например "5 дн."
  delivery_hours: number;
  comment: string;
  own: 0 | 1;            // 1 — склад Профит-лиги, 0 — сторонний
  active: 0 | 1;
}

const warehouses = await profitGet<ProfitWarehouse[]>(
  '/search/warehouses',
  { secret: API_KEY },
  { action: 'list' }
);
```

---

### 4.2 [GET] Поиск товара по артикулу — `/search/products`

Товары по артикулу без разбивки по складам.

**Параметры:** `secret`, `article` (обязательные).

**Ответ:** массив товаров.

```ts
interface ProfitProduct {
  article: string;
  brand: string;
  description: string;
  brand_warranty: number;
  original: 0 | 1;
  countProducts: number;
}

const products = await profitGet<ProfitProduct[]>(
  '/search/products',
  { secret: API_KEY },
  { article: '2382' }
);
```

---

### 4.3 [GET] Поиск с наличием по артикулу — `/search/items`

Товары по артикулу с наличием по складам.

**Параметры:** `secret`, `article` (обязательные).

**Ответ:** массив товаров с вложенным массивом `products` по складам.

```ts
interface ProfitItemProduct {
  article_id: number;
  warehouse_id: number;
  description: string;
  product_code: string;   // для обмена с 1С
  multi: number;          // кратность
  quantity: number;
  price: number;
  sale: 0 | 1;
  comment?: string;
  incart: number;
  custom_warehouse_name: string;
  show_date?: string;
  delivery_time?: number;
  delivery_date?: string;
  sort: number;
  waitings?: number;
  allow_return: 0 | 1;
  return_days?: number;
  delivery_probability?: number;
}

interface ProfitItem {
  id: number;
  article: string;
  brand: string;
  description: string;
  brand_warranty: number;
  original: 0 | 1;
  products: ProfitItemProduct[];
}

const items = await profitGet<ProfitItem[]>(
  '/search/items',
  { secret: API_KEY },
  { article: '2382' }
);
```

---

### 4.4 [GET] Поиск с заменами по артикулу и бренду — `/search/crosses`

Остатки по артикулу и бренду, опционально с заменами.

**Параметры:**

| Параметр | Тип | Обязательный | Описание |
|----------|-----|---------------|----------|
| secret | string | да | API-ключ |
| article | string | да | Артикул |
| brand | string | да | Бренд |
| replaces | 0 \| 1 | нет | Возвращать замены (0/1) |

**Ответ:** та же структура, что у `/search/items` (массив с полем `products` по складам).

```ts
const crosses = await profitGet<ProfitItem[]>(
  '/search/crosses',
  { secret: API_KEY },
  { article: '2382', brand: 'NGK', replaces: 1 }
);
```

---

## 5. Корзина

### 5.1 [POST] Добавить в корзину — `/cart/add`

**Параметры:**

| Параметр | Тип | Обязательный | Описание |
|----------|-----|---------------|----------|
| secret | string | да | API-ключ |
| id | number | да | ID товара (из поиска) |
| warehouse | number | да | ID склада/поставщика |
| quantity | number | да | Количество |
| code | string | да | Системный код товара (product_code), для 1С |
| comment | string | нет | Комментарий к позиции (макс. 255 символов) |

**Ответ:**

```ts
interface ProfitCartAddResult {
  status: 'success' | 'no-quantity' | 'less' | 'error';
  total: number;
  count: number;
}
// no-quantity — запрошено больше, чем есть; less — количество <= 0;
// error — товар не найден, кратность, ошибка записи.
```

```ts
const result = await profitPost<ProfitCartAddResult>('/cart/add', { secret: API_KEY }, {
  id: 12345,
  warehouse: 1,
  quantity: 2,
  code: 'ABC123',
  comment: 'Срочно',
});
```

---

### 5.2 [GET] Список корзины — `/cart/list`

**Параметры:** только `secret`.

**Ответ:** массив позиций корзины.

```ts
interface ProfitCartItem {
  article: string;
  brand: string;
  description: string;
  article_id: number;
  warehouse_id: number;
  product_code: string | number;
  multi: number;
  quantity: number;
  price: number;
  sale: 0 | 1;
  comment?: string;
  incart: number;
  warehouse: string;
  show_date?: string;
  sort: number;
  allow_return: 0 | 1;
}

const cart = await profitGet<ProfitCartItem[]>('/cart/list', { secret: API_KEY });
```

---

### 5.3 [POST] Удалить из корзины — `/cart/remove`

**Параметры:** `secret`, `id` (article_id из корзины), `warehouse` (ID склада).

**Ответ:** `{ status: 'cart-success' | 'cart-error', total: number, count: number }`.

```ts
const result = await profitPost<{ status: string; total: number; count: number }>(
  '/cart/remove',
  { secret: API_KEY },
  { id: 12345, warehouse: 1 }
);
```

---

### 5.4 [POST] Торговая точка по умолчанию — `/cart/point`

Устанавливает торговую точку для расчёта даты доставки. Код точки берётся из `/cart/params` (поле `points[].code`).

**Параметры:** `secret`, `code` (код торговой точки).

**Ответ:** `{ status: 'success' | 'error', err?: string }`.

```ts
await profitPost('/cart/point', { secret: API_KEY }, { code: 'POINT_CODE' });
```

---

### 5.5 [GET] Настройки заказа — `/cart/params`

Способы доставки, оплаты, списки точек доставки и самовывоза, статусы заказа.

**Параметры:** только `secret`.

**Ответ:**

```ts
interface ProfitCartParams {
  methods: Array<{ id: number; name: string }>;
  points: Array<{ code: string; point: string; address: string }>;
  pickup_points: Array<{ code: string; name: string; address: string }>;
  payment: Array<{ id: number; name: string }>;
  statuses: Array<{ id: number; name: string; description: string }>;
}

const params = await profitGet<ProfitCartParams>('/cart/params', { secret: API_KEY });
```

---

### 5.6 [POST] Оформить заказ — `/cart/order`

Создаёт заказ из текущей корзины. Товары автоматически разбиваются по складам.

**Параметры:**

| Параметр | Тип | Обязательный | Описание |
|----------|-----|---------------|----------|
| secret | string | да | API-ключ |
| method | number | да | ID способа доставки (из `cart/params`) |
| payment | number | да | ID способа оплаты |
| point | string | при доставке | Код торговой точки |
| address | string | при доставке | Адрес из настроек |
| pickup_point | string | при самовывозе | Код точки самовывоза |

**Ответ:**

```ts
interface ProfitOrderResult {
  status: 'success' | 'error';
  orders?: string[];   // номера созданных заказов
  err?: string;
}

const result = await profitPost<ProfitOrderResult>('/cart/order', { secret: API_KEY }, {
  method: 1,
  payment: 1,
  point: 'POINT_CODE',
  address: 'Адрес доставки',
});
```

---

## 6. Заказы

### 6.1 [GET] Список заказов — `/orders/list`

Постраничный список заказов с позициями.

**Параметры:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| secret | string | API-ключ |
| page | number | Номер страницы |
| order_id | string | Номер заказа; до 3 номеров через запятую |
| status_id | number | ID статуса (список в `/cart/params`) |
| date_start | string | YYYY-MM-DD (на данный момент отключено) |
| date_end | string | YYYY-MM-DD (на данный момент отключено) |

**Ответ:**

```ts
interface ProfitOrderProduct {
  id: number;
  article_id: number;
  product_code: string;
  price: number;
  quantity: number;
  comment?: string;
  article: string;
  brand: string;
  description: string;
  status_id: number;
  status: string;
  status_description: string;
  status_update?: string;
  custom_warehouse_name: string;
  show_date?: string;
  sale: 0 | 1;
}

interface ProfitOrder {
  order_id: string;
  comment?: string;
  datetime: string;
  delivery_date?: string;
  point_code: string;
  delivery_point_id: number;
  point_name: string;
  point_delivery_address: string;
  delivery_name: string;
  delivery_method_id: number;
  payment_id: number;
  payment_name: string;
  products: ProfitOrderProduct[];
}

interface ProfitOrdersListResult {
  pages: number;
  currentPage: number;
  pageSize: number;
  data: ProfitOrder[];
}

const orders = await profitGet<ProfitOrdersListResult>('/orders/list', { secret: API_KEY }, {
  page: 1,
  order_id: '12345,12346',
});
```

---

## 7. Устаревшее (deprecated)

- **POST `/search/warehouses`** с `action=set` — установка списка складов для API отключена с 10.12.2020. Настройки выполняются в личном кабинете: «Настройки поиска».

---

## 8. Контакты

- Техподдержка API: через личный кабинет, раздел «Техническая поддержка API».
- Вопросы по подключению: dev@pr-lg.ru (если указано на сайте).
