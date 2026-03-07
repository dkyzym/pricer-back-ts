# ABCP Client API — документация для JavaScript/TypeScript

Платформа ABCP (автозапчасти). Клиентское API для поиска, корзины, заказов, пользователей и каталога.

**Базовый URL:** `https://demo.public.api.abcp.ru` (демо) / ваш домен API  
**Формат ответа:** JSON

---

## 1. Авторизация

Все запросы передают учётные данные в query-параметрах (GET) или в теле (POST, `application/x-www-form-urlencoded`).

- **userlogin** — логин пользователя
- **userpsw** — пароль в виде **MD5-хэша** (не исходный пароль)

### 1.1 Формирование параметров в JS/Node

```ts
import crypto from 'node:crypto';

const userlogin = 'username';
const password = 'myPassword';
const userpsw = crypto.createHash('md5').update(password).digest('hex');

const params = new URLSearchParams({ userlogin, userpsw });
// GET: `${BASE_URL}/search/brands/?${params}&number=01089`
// POST body: params.toString()
```

### 1.2 Базовый клиент (fetch)

```ts
const BASE_URL = 'https://demo.public.api.abcp.ru';

interface AbcpAuth {
  userlogin: string;
  userpsw: string; // MD5 пароля
}

async function abcpGet<T>(path: string, auth: AbcpAuth, query: Record<string, string> = {}): Promise<T> {
  const search = new URLSearchParams({ ...auth, ...query });
  const res = await fetch(`${BASE_URL}${path}?${search}`);
  if (!res.ok) throw new Error(`ABCP ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function abcpPost<T>(path: string, auth: AbcpAuth, body: Record<string, string | Record<string, string>[]>) {
  const form = new URLSearchParams();
  form.set('userlogin', auth.userlogin);
  form.set('userpsw', auth.userpsw);
  for (const [k, v] of Object.entries(body)) {
    if (Array.isArray(v)) {
      v.forEach((obj, i) => {
        for (const [kk, vv] of Object.entries(obj)) form.set(`${k}[${i}][${kk}]`, String(vv));
      });
    } else {
      form.set(k, String(v));
    }
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  if (!res.ok) throw new Error(`ABCP ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}
```

---

## 2. Поиск

### 2.1 Искать бренды по артикулу — search/brands

**Метод:** GET  
**Путь:** `/search/brands/`

По номеру детали возвращает массив брендов, у которых есть такой артикул.

**Параметры:**

| Параметр       | Тип    | Описание |
|----------------|--------|----------|
| userlogin      | string | Логин |
| userpsw        | string | MD5 пароля |
| number         | string | Номер детали |
| useOnlineStocks| 0 \| 1 | Использовать online-склады (0 — быстрее) |
| officeId       | number | Id офиса (только для API-администратора) |
| locale         | string | Локаль, например `ru_RU` |

**Ответ:** массив `{ brand, number, numberFix, description, availability }`

```ts
interface AbcpBrandHit {
  brand: string;
  number: string;
  numberFix: string;
  description: string;
  availability: boolean;
}

const brands = await abcpGet<AbcpBrandHit[]>('/search/brands/', auth, { number: '01089' });
```

---

### 2.2 Искать товар по артикулу и бренду — search/articles

**Метод:** GET  
**Путь:** `/search/articles/`

Поиск по номеру и бренду. Возвращает массив предложений (поставщики, цены, сроки).

**Параметры:** userlogin, userpsw, **number**, **brand**, useOnlineStocks (0|1), disableOnlineFiltering (0|1), disableFiltering (0|1), withOutAnalogs (0|1), profileId, officeId, locale.

**Ответ:** массив позиций с полями brand, number, numberFix, description, availability, packing, deliveryPeriod, deliveryPeriodMax, distributorCode, **supplierCode**, **itemKey**, price, maxPrice, weight, volume, deliveryProbability, noReturn, isUsed, meta (tnved, okpd2, gtin), distributorId, grp, code, nonliquid и др.

- **availability:** число; отрицательные -1,-2,-3 — неточное наличие ("+", "++", "+++"); -10 — под заказ.
- **itemKey** и **supplierCode** нужны для добавления в корзину.

```ts
interface AbcpArticle {
  brand: string;
  number: string;
  numberFix: string;
  description: string;
  availability: number;
  packing?: number;
  deliveryPeriod?: number;
  deliveryPeriodMax?: number;
  distributorCode?: string;
  supplierCode: string;
  itemKey: string;
  price: number;
  maxPrice?: number;
  weight?: number;
  volume?: number;
  deliveryProbability?: number;
  noReturn?: boolean;
  isUsed?: boolean;
  code?: string;
}

const articles = await abcpGet<AbcpArticle[]>('/search/articles/', auth, {
  number: '01089',
  brand: 'Febi',
});
```

---

### 2.3 Пакетный поиск без аналогов — search/batch

**Метод:** POST  
**Путь:** `/search/batch`

До 100 пар brand–number за один запрос. **Не использует online-склады.**

**Тело (form):** userlogin, userpsw, `search[0][number]`, `search[0][brand]`, `search[1][number]`, `search[1][brand]`, …

**Ответ:** массив массивов (по одному на каждый элемент search) с теми же полями, что и у search/articles.

```ts
// Формирование тела: search[0][number]=01089&search[0][brand]=Febi&search[1][number]=333305&search[1][brand]=Kyb
const search = [
  { number: '01089', brand: 'Febi' },
  { number: '333305', brand: 'Kyb' },
];
const form = new URLSearchParams({ ...auth });
search.forEach((item, i) => {
  form.set(`search[${i}][number]`, item.number);
  form.set(`search[${i}][brand]`, item.brand);
});
const res = await fetch(`${BASE_URL}/search/batch`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form });
const data = await res.json();
```

---

### 2.4 История поиска — search/history

**Метод:** GET  
**Путь:** `/search/history`

До 50 последних поисков пользователя.

**Ответ:** массив `{ brand, number, numberFix, description, datetime }` (datetime в формате ГГГГММДДччммсс).

---

### 2.5 Подсказки по поиску — search/tips

**Метод:** GET  
**Путь:** `/search/tips`

Подсказки по части номера. Параметры: userlogin, userpsw, **number**, locale.

**Ответ:** массив `{ brand, number, description }`.

---

### 2.6 Сопутствующие товары — advices и advices/batch

**advices** (GET): один товар (brand, number), опционально limit. Возвращает массив `{ brand, number, total, description }`.

**advices/batch** (POST): массив статей `articles: [{ brand, number }, ...]`, опционально limit. В теле нужен **Content-Type: application/json**, тело JSON: `{ userlogin, userpsw, articles, limit? }`.

**Ответ batch:** массив `{ brand, number, advices: [{ brand, number, total }] }`.

---

## 3. Корзина

### 3.1 Список корзин — basket/multibasket

**Метод:** GET  
**Ответ:** массив `{ id, name }`.

---

### 3.2 Добавить/удалить позицию — basket/add

**Метод:** POST  
**Путь:** `/basket/add`

**Тело (form):** userlogin, userpsw, basketId (опционально), позиции:

- Вариант 1: `positions[i][number]`, `positions[i][brand]`, `positions[i][supplierCode]`, `positions[i][itemKey]`, `positions[i][quantity]`, `positions[i][comment]`.
- Вариант 2: `positions[i][code]` (внутренний код детали), `positions[i][itemKey]`, `positions[i][quantity]`, `positions[i][comment]`.

Удаление: та же позиция с **quantity=0**.

**Ответ:** `{ status: 0|1, positions: [{ brand, number, code, supplierCode, description, quantity, comment, status, errorMessage? }] }`.

```ts
await abcpPost('/basket/add', auth, {
  positions: [
    {
      number: '01089',
      brand: 'Febi',
      supplierCode: '54325',
      itemKey: 'HFGJKfkdjghreiHJhfdjKhjskhfk',
      quantity: '15',
      comment: '',
    },
  ],
} as any);
```

---

### 3.3 Очистка корзины — basket/clear

**Метод:** POST. Тело: userlogin, userpsw (и при необходимости basketId).

**Ответ:** `{ status: 0|1, errorMessage? }`.

---

### 3.4 Содержимое корзины — basket/content

**Метод:** GET  
**Путь:** `/basket/content`

Параметры: userlogin, userpsw, basketId (опционально).

**Ответ:** массив позиций с полями brand, number, numberFix, code, supplierCode, itemKey, description, price, priceRate, priceInSiteCurrency, quantity, deadline, deadlineMax, comment, status, positionId, packing, errorMessage.

---

### 3.5 Опции корзины — basket/options

**Метод:** GET  
**Ответ:** `{ options: [{ disallow_new_shipment_address, self_shipment }], errors? }`.

---

### 3.6 Способы оплаты — basket/paymentMethods

**Метод:** GET  
**Ответ:** массив `{ id, name }`. id нужен при оформлении заказа.

---

### 3.7 Способы доставки — basket/shipmentMethods

**Метод:** GET  
**Ответ:** массив `{ id, name }`. **С 20.10.2025 shipmentMethod при заказе обязателен**, если метод возвращает непустой список.

---

### 3.8 Офисы самовывоза — basket/shipmentOffices

**Метод:** GET  
Параметр officesType: `order` (по умолчанию) или `registration`.  
**Ответ:** массив `{ id, name }`.

---

### 3.9 Адреса доставки — basket/shipmentAddresses

**Метод:** GET  
**Ответ:** массив `{ id, name }`. id передаётся в заказе как shipmentAddress (или 0 при самовывозе).

---

### 3.10 Даты отгрузки — basket/shipmentDates

**Метод:** GET  
Параметры: userlogin, userpsw, minDeadlineTime, maxDeadlineTime (часы), shipmentAddress (id адреса, опционально).  
**Ответ:** массив `{ date: 'YYYY-MM-DD', name }`.

---

### 3.11 Добавить адрес доставки — basket/shipmentAddress

**Метод:** POST  
Тело: userlogin, userpsw, **address** (строка).  
**Ответ:** `{ shipmentAddressId }`.

---

### 3.12 Оформить заказ из корзины — basket/order

**Метод:** POST  
**Путь:** `/basket/order`

**Тело (form):** userlogin, userpsw, paymentMethod, **shipmentMethod** (обязателен с 20.10.2025, если включены типы доставки), **shipmentAddress** (id или 0 при самовывозе), shipmentOffice (при самовывозе), shipmentDate (если включена опция «показывать дату отгрузки»), comment, basketId, wholeOrderOnly (0|1), positionIds[] (при частичном оформлении), clientOrderNumber.

**Ответ:** `{ status: 0|1, errorMessage?, clientOrderNumber?, orders: [{ number, status, statusId, statusCode, positionsQuantity, sum, date, comment, positions: [...] }] }`.

Ограничение: не более 500 позиций в одном заказе.

```ts
interface AbcpOrderPosition {
  brand: string;
  number: string;
  code?: string;
  supplierCode: string;
  itemKey: string;
  description: string;
  quantity: number;
  price: number;
  deadline?: number;
  deadlineMax?: number;
  comment?: string;
  status: string;
  statusId?: number;
  statusCode?: string;
  positionId?: number;
}
```

---

## 4. Заказы

### 4.1 Моментальный заказ — orders/instant

**Метод:** POST  
**Путь:** `/orders/instant`

Добавляет переданные позиции в корзину и сразу отправляет их в заказ (уже лежащие в корзине позиции в заказ не попадают).

**Тело:** те же параметры, что у basket/order (paymentMethod, shipmentMethod, shipmentAddress, shipmentOffice, shipmentDate, comment, …), плюс **positions** в том же формате, что для basket/add.

**Ответ:** как у basket/order — `{ status, errorMessage?, clientOrderNumber?, orders }`. Лимит 500 позиций.

---

### 4.2 Список статусов — orders/statuses

**Метод:** GET  
**Путь:** `/orders/statuses`  
**Ответ:** массив `{ id, name, color, isFinalStatus }`.

---

### 4.3 Позиции заказов со статусами — orders/list

**Метод:** GET  
**Путь:** `/orders/list`  
Параметры: userlogin, userpsw, **orders[]** — номера заказов.

**Ответ:** массив заказов с полными полями (number, status, statusId, statusCode, positionsQuantity, deliveryAddressId, deliveryAddress, sum, date, comment, clientOrderNumber, positions[], notes[]). В positions — positionId, brand, number, code, supplierCode, itemKey, quantityOrdered, quantity, price, status, statusId, statusCode, statusDate, noReturn, commentAnswer и др.

---

### 4.4 Список заказов (постранично) — orders

**Метод:** GET  
**Путь:** `/orders/`  
Параметры: userlogin, userpsw, format (`p` — с позициями), skip, limit (1–1000, по умолчанию 100).

**Ответ:** `{ count, items: [{ number, status, statusId, positionsQuantity, sum, date, deliveryAddress, … positions? }] }`.

---

### 4.5 Запрос на отмену позиции — orders/cancelPosition

**Метод:** POST  
**Путь:** `/orders/cancelPosition`  
Тело: userlogin, userpsw, **positionId**.  
**Ответ:** message об успехе или ошибке.

---

### 4.6 Версия подсистемы заказов — orders/version

**Метод:** GET  
**Ответ:** версия (1 или 2).

---

## 5. Пользователь

### 5.1 Регистрация — user/new

**Метод:** POST  
**Путь:** `/user/new`  
Тело: marketType (1 — розница, 2 — опт), filialId, и остальные поля по документации (имя, email, телефон, пароль и т.д. в зависимости от настроек сайта).  
**Ответ:** статус, учётные данные нового пользователя или сообщение об ошибке.

---

### 5.2 Активация — user/activation

**Метод:** POST  
**Путь:** `/user/activation`  
Параметры по инструкции активации (например, код из письма).

---

### 5.3 Данные пользователя (авторизация) — user/info

**Метод:** GET  
**Путь:** `/user/info`  
Параметры: userlogin, userpsw.  
**Ответ:** данные профиля пользователя.

---

### 5.4 Восстановление пароля — user/restore

**Метод:** POST  
**Путь:** `/user/restore`  
Тело по правилам восстановления пароля на сайте.

---

## 6. Гараж (автомобили пользователя)

### 6.1 Список автомобилей — user/garage

**Метод:** GET  
**Ответ:** массив автомобилей (идентификаторы и краткие данные).

---

### 6.2 Информация об автомобиле — user/garage/car

**Метод:** GET  
Параметр: **carId**.  
**Ответ:** объект с данными автомобиля.

---

### 6.3 Добавить автомобиль — user/garage/add

**Метод:** POST  
**Путь:** `/user/garage/add`  
Тело: параметры автомобиля (марка, модель, год, модификация и т.д. по form/fields).

---

### 6.4 Обновить автомобиль — user/garage/update

**Метод:** POST  
**Путь:** `/user/garage/update`  
Тело: carId и обновляемые поля.

---

### 6.5 Удалить автомобиль — user/garage/delete

**Метод:** POST  
**Путь:** `/user/garage/delete`  
Тело: **carId**.

---

## 7. Дерево автомобилей (каталог)

Справочники для построения цепочки: год → производитель → модель → модификация.

### 7.1 Годы — cartree/years

**Метод:** GET  
**Ответ:** массив годов.

---

### 7.2 Производители — cartree/manufacturers

**Метод:** GET  
Параметр: **year**.  
**Ответ:** массив производителей.

---

### 7.3 Модели — cartree/models

**Метод:** GET  
Параметры: **year**, **manufacturerId** (или manufacturer).  
**Ответ:** массив моделей.

---

### 7.4 Модификации — cartree/modifications

**Метод:** GET  
Параметры: **year**, **manufacturerId**, **modelId** (или model).  
**Ответ:** массив модификаций.

---

## 8. Прочее

### 8.1 Поля формы — form/fields

**Метод:** GET  
**Путь:** `/form/fields`  
Возвращает список полей форм (регистрация, гараж и т.д.) и их параметры для построения UI.

---

### 8.2 Справочник брендов — articles/brands

**Метод:** GET  
**Путь:** `/articles/brands`  
Параметры: userlogin, userpsw, опционально фильтры.  
**Ответ:** данные справочника брендов.

---

### 8.3 Карточка товара — articles/card

**Метод:** GET  
Параметры: userlogin, userpsw, brand, number (и др. по документации).  
**Ответ:** расширенная карточка товара.

---

## 9. Типы для TypeScript (сводка)

```ts
interface AbcpAuth {
  userlogin: string;
  userpsw: string; // MD5
}

interface AbcpBrandHit {
  brand: string;
  number: string;
  numberFix: string;
  description: string;
  availability: boolean;
}

interface AbcpArticle {
  brand: string;
  number: string;
  numberFix: string;
  description: string;
  availability: number;
  supplierCode: string;
  itemKey: string;
  price: number;
  packing?: number;
  deliveryPeriod?: number;
  deliveryPeriodMax?: number;
  [key: string]: unknown;
}

interface AbcpBasketPosition {
  brand: string;
  number: string;
  code?: string;
  supplierCode: string;
  itemKey: string;
  quantity: number;
  price?: number;
  positionId?: number;
  status?: number;
  errorMessage?: string;
}

interface AbcpOrderResult {
  status: 0 | 1;
  errorMessage?: string;
  clientOrderNumber?: string;
  orders?: Array<{
    number: string;
    status: string;
    statusId?: number;
    positionsQuantity?: number;
    sum?: number;
    date?: string;
    comment?: string;
    positions?: AbcpOrderPosition[];
  }>;
}

interface AbcpOrderPosition {
  brand: string;
  number: string;
  code?: string;
  supplierCode: string;
  itemKey: string;
  description: string;
  quantity: number;
  price: number;
  status?: string;
  statusId?: number;
  positionId?: number;
}
```

---

## 10. Важные замечания

1. **Пароль:** всегда передаётся только MD5-хэш в `userpsw`.
2. **Корзина и заказ:** для добавления в корзину и заказа нужны **itemKey** и **supplierCode** из результата поиска (search/articles).
3. **Оформление заказа:** с 20.10.2025 при включённых способах доставки обязателен **shipmentMethod**. **shipmentAddress** обязателен (0 при самовывозе), если в настройках требуется адрес.
4. **Лимит:** один заказ — не более 500 позиций.
5. **Демо:** для тестов используется `https://demo.public.api.abcp.ru`; для продакшена — базовый URL вашего ABCP-сайта.

Оригинальная документация: [ABCP Documentation — API.ABCP.Client](https://www.abcp.ru/wiki/API.ABCP.Client).
