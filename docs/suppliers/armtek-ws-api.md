# ARMTEK REST API — документация для JavaScript/TypeScript

Версия API: **1.1.7**  
Базовый URL: `http://ws.armtek.by`  
Формат ответа: **JSON** (`?format=json`)

---

## 1. Авторизация и общий формат ответа

### 1.1 Basic Authentication

Все запросы выполняются с заголовком Basic Auth. В JS/Node:

```ts
const BASE_URL = 'http://ws.armtek.by';
const credentials = Buffer.from(`${login}:${password}`).toString('base64');

const response = await fetch(`${BASE_URL}/api/ws_order/getOrder?VKORG=4000&KUNRG=...&ORDER=...&format=json`, {
  headers: {
    Authorization: `Basic ${credentials}`,
    'Content-Type': 'application/json',
  },
});
```

### 1.2 Структура ответа (все методы)

Каждый ответ обёрнут в общую оболочку:

```ts
/** Коды HTTP, возвращаемые в STATUS */
const HTTP_OK = 200;
const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_NOT_FOUND = 404;
const HTTP_INTERNAL_SERVER_ERROR = 500;

/** Типы сообщений в MESSAGES[].TYPE */
type MessageType = 'A' | 'E' | 'S' | 'W' | 'I';
// A — критическая ошибка, E — ошибка, S — успех, W — предупреждение, I — информация

interface ArmtekApiMessage {
  TYPE: MessageType;
  TEXT: string;
  DATE: string; // дата сообщения
}

interface ArmtekApiResponse<T> {
  STATUS: number;      // HTTP-код (200 = успех)
  MESSAGES: ArmtekApiMessage[];
  RESP: T;             // тело ответа метода (описано ниже по каждому сервису)
}
```

Проверка успешности:

```ts
const data = await response.json() as ArmtekApiResponse<YourRespType>;
if (data.STATUS !== 200) {
  const errors = data.MESSAGES?.filter(m => m.TYPE === 'A' || m.TYPE === 'E') ?? [];
  throw new Error(errors.map(e => e.TEXT).join('; ') || `HTTP ${data.STATUS}`);
}
const payload = data.RESP;
```

---

## 2. Формат дат

Во всех полях дат используется строка: **`YYYYMMDDHHIISS`** (год, месяц, день, часы, минуты, секунды).

Пример парсинга в JS:

```ts
function parseArmtekDate(s: string): Date | null {
  if (!s || s.length < 14) return null;
  const y = +s.slice(0, 4), m = +s.slice(4, 6) - 1, d = +s.slice(6, 8);
  const h = +s.slice(8, 10), min = +s.slice(10, 12), sec = +s.slice(12, 14);
  return new Date(y, m, d, h, min, sec);
}

function formatArmtekDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}
```

---

## 3. Сервисы по работе с заказами (ws_order)

Базовый путь: `/api/ws_order/<method>?format=json`

### 3.1 Создание заказа — createOrder

- **Метод:** `POST`
- **URL:** `http://ws.armtek.by/api/ws_order/createOrder?format=json`

**Тело запроса (JSON):**

```ts
interface CreateOrderItem {
  PIN: string;        // артикул, макс. 40
  BRAND: string;       // бренд, макс. 18
  KWMENG: number;      // количество
  KEYZAK?: string;     // код склада (из search) — рекомендуется всегда передавать
  PRICEMAX?: string;
  DATEMAX?: string;    // YYYYMMDDHHIISS
  COMMENT?: string;
  COMPL_DLV?: '0' | '1'; // 1 — полная поставка
}

interface CreateOrderRequest {
  VKORG: string;      // сбытовая организация, 4 символа (обяз.)
  KUNRG: string;      // покупатель, 10 символов (обяз.)
  KUNWE?: string;     // грузополучатель
  KUNZA?: string;     // адрес доставки / пункт выдачи
  INCOTERMS?: '0' | '1'; // 1 — самовывоз
  PARNR?: string;     // контактное лицо
  VBELN?: string;     // договор
  TEXT_ORD?: string;  // комментарий по заказу, макс. 100
  TEXT_EXP?: string;  // комментарий к экспедиции, макс. 100
  DBTYP?: '1' | '2' | '3'; // 1/пусто — только основной склад; 2 — все склады АРМТЕК; 3 — + партнёры
  ITEMS: CreateOrderItem[];
}
```

**Ответ (RESP):**

```ts
interface CreateOrderResultItem {
  PIN?: string;
  BRAND?: string;
  KEYZAK?: string;
  KWMENG?: number;
  PRICEMAX?: string;
  DATEMAX?: string;
  COMMENT?: string;
  COMPL_DLV?: string;
  ARTID?: string;
  REMAIN?: number;     // 0 — позиция заказана полностью
  ERROR?: string;
  ERROR_MESSAGE?: string;
  RESULT?: Array<{
    POSID?: string;
    POSNR?: string;
    KEYZAK?: string;
    NUM_ZAK?: string;
    KWMENG?: number;
    PRICE?: string;
    WAERS?: string;
    DLVDT?: string;
    VBELN?: string;    // номер созданного заказа
    BLOCK?: 'A' | 'B' | 'C' | 'D'; // A — не блокирован, B — блокирован, C — закрыт, D — деблокирован
    ERROR?: string;
  }>;
}

interface CreateOrderResponse {
  ITEMS?: CreateOrderResultItem[];
}
```

**Пример вызова:**

```ts
const body: CreateOrderRequest = {
  VKORG: '4000',
  KUNRG: '0000000001',
  ITEMS: [
    { PIN: '12345', BRAND: 'BRAND', KWMENG: 2, KEYZAK: '01' },
  ],
};
const res = await fetch(`${BASE_URL}/api/ws_order/createOrder?format=json`, {
  method: 'POST',
  headers: {
    Authorization: `Basic ${credentials}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(body),
});
const data = await res.json() as ArmtekApiResponse<CreateOrderResponse>;
```

---

### 3.2 Создание тестового заказа — createTestOrder

- **Метод:** `POST`
- **URL:** `http://ws.armtek.by/api/ws_order/createTestOrder?format=json`

Параметры и структура ответа аналогичны **createOrder** (те же типы `CreateOrderRequest` / `CreateOrderResponse`).

---

### 3.3 Подробная информация по заказу — getOrder

- **Метод:** `GET`
- **URL:** `http://ws.armtek.by/api/ws_order/getOrder?VKORG=...&KUNRG=...&ORDER=...&format=json`

**Query-параметры:**

| Параметр | Тип    | Обязательный | Описание |
|----------|--------|--------------|----------|
| VKORG    | string(4) | Да        | Сбытовая организация |
| KUNRG    | string(10) | Да       | Покупатель |
| ORDER    | string(10) | Да       | Номер заказа |
| EDIT     | '0' \| '1' | Нет     | Для изменения |

**Ответ (RESP):**

```ts
interface GetOrderHeader {
  ORDER?: string;
  ORDER_TYPE?: string;
  ORDER_STATUS?: string;  // Создан | В работе | Закрыт | Отклонен
  ORDER_DATE?: string;
  ORDER_SUM?: string;
  CURRENCY?: string;
  KUNRG?: string;
  NAMERG?: string;
  KUNWE?: string;
  NAMEWE?: string;
  KUNZA?: string;
  NAMEZA?: string;
  ADDRZA?: string;
  PARNRAP?: string;
  NAMEAP?: string;
  PARNRZP?: string;
  NAMEZP?: string;
  ETDAT?: string;
  VDATU?: string;
  DOC_NUM?: string;
  DOC_DATE?: string;
  NUMDOG?: string;
  COMPL_DLV?: '0' | '1';
  COMMENT?: string;
  COMMENT_EXP?: string;
  INCOTERMS_TXT?: string;
  VSTELT?: string;
}

interface GetOrderItem {
  POSNR?: string;
  BRAND?: string;
  PIN?: string;
  NAME?: string;
  KWMENG?: string;
  KWMENG_REQ?: string;
  KWMENG_PROC?: string;
  KWMENG_L?: string;
  KWMENG_REJ_P?: string;
  KWMENG_WAYIN?: string;
  KWMENG_P?: string;
  KWMENG_R?: string;
  KWMENG_REJ?: string;
  PRICE?: string;
  SUMMA?: string;
  CURRENCY?: string;
  STATUS?: string;
  NOTE?: string;
  DLVRD?: string;
  WRNTD?: string;
  ABGRU_TXT?: string;
  MATNR?: string;
  COMPL_DLV?: string;
  POSEX?: string;
  POSROOT?: string;
  CHARG?: string;
  CHARG_BLK?: boolean;
}

interface GetOrderAbgruItem {
  ABGRU?: string;
  BEZEI?: string;
  DEFAULT?: string;
}

interface GetOrderResponse {
  HEADER?: GetOrderHeader[];
  ITEMS?: GetOrderItem[];
  ABGRU_ITEMS?: GetOrderAbgruItem[];
}
```

**Пример:**

```ts
const params = new URLSearchParams({
  VKORG: '4000',
  KUNRG: '0000000001',
  ORDER: '1234567890',
  format: 'json',
});
const res = await fetch(`${BASE_URL}/api/ws_order/getOrder?${params}`, {
  headers: { Authorization: `Basic ${credentials}` },
});
const data = await res.json() as ArmtekApiResponse<GetOrderResponse>;
const header = data.RESP?.HEADER?.[0];
const items = data.RESP?.ITEMS ?? [];
```

---

### 3.4 Подробная информация по заказу (v2) — getOrder2

- **Метод:** `GET`
- **URL:** `http://ws.armtek.by/api/ws_order/getOrder2?VKORG=...&KUNRG=...&ORDER=...&format=json`

**Доп. параметр:** `STATUS=1` — в ответ добавляется расшифровка статусов по позициям (вложенные массивы `STATUSES` с полями Processing, Ready, Delivered и т.д.).

Структура ответа совпадает с getOrder, плюс при `STATUS=1` в ответе появляется массив **STATUSES** с элементами:

- **ORDER**, **POSNR**, **QUAN**, **VSTELNAME**
- **Processing** — в обработке (подробности по складам/партнёрам)
- **Ready** — готово к отгрузке (массив с DeliveryNum, DeliveryPos, DeliveryTime, DeliveryQuan, WarehouseQuan, DateDelNew)
- **Delivered** — отгружено (массив с InvoiceNum, InvoicePos, PrintNum, Waybill, CreateTime, Quan, Unit, Cost, Currency, DeliveryNum)

Для статуса **Processing** при расшифровке используются **SubStatus**: WayQuan, Planned, Waiting, Confirmed, Shipped (и поля Werks, WerksName, LsegETP, Quan, Bldat, Cputm, Unit, DateDelNew).

Подробное описание полей — в разделе «Описание WS Статус строк заказа подробно V2» (ниже).

---

### 3.5 Подробная информация по возврату — getRefund

- **Метод:** `GET`
- **URL:** `http://ws.armtek.by/api/ws_order/getRefund?VKORG=...&KUNRG=...&RETURN=...&format=json`

**Query:** VKORG, KUNRG, RETURN (номер возврата) — все обязательные.

**RESP:** `HEADER` (аналогично getOrder), `ITEMS` (позиции возврата).

---

### 3.6 Редактирование заказа — editOrder

- **Метод:** `POST`
- **URL:** `http://ws.armtek.by/api/ws_order/editOrder?format=json`

**Тело запроса:**

```ts
interface EditOrderPositionInput {
  POSNR: string;   // номер позиции
  KWMENG: number;  // количество
  ABGRU: string;   // код причины отклонения (из ABGRU_ITEMS getOrder)
  NOTE?: string;
}

interface EditOrderRequest {
  VKORG: string;
  KUNRG: string;
  ORDER: string;
  POSITION_INPUT: EditOrderPositionInput[];
}
```

**Пример:**

```ts
const body: EditOrderRequest = {
  VKORG: '4000',
  KUNRG: '0000000001',
  ORDER: '1234567890',
  POSITION_INPUT: [
    { POSNR: '000010', KWMENG: 1, ABGRU: '001' },
  ],
};
await fetch(`${BASE_URL}/api/ws_order/editOrder?format=json`, {
  method: 'POST',
  headers: {
    Authorization: `Basic ${credentials}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(body),
});
```

---

## 4. Сервисы поиска (ws_search)

Базовый путь: `/api/ws_search/<method>?format=json`

### 4.1 Поиск по ассортименту — assortment_search

- **Метод:** `POST`
- **URL:** `http://ws.armtek.by/api/ws_search/assortment_search?format=json`

**Тело запроса:**

```ts
interface AssortmentSearchRequest {
  VKORG: string;   // 4 символа, обяз.
  PIN: string;     // артикул, макс. 40, обяз.
  PROGRAM?: 'LP' | 'GP'; // LP — легковая, GP — грузовая
}
```

**Ответ (RESP):**

```ts
interface AssortmentSearchItem {
  PIN?: string;
  BRAND?: string;
  NAME?: string;
}

interface AssortmentSearchResponse {
  ARRAY?: AssortmentSearchItem[];
}
```

---

### 4.2 Поиск (остатки, цены, аналоги) — search

- **Метод:** `POST`
- **URL:** `http://ws.armtek.by/api/ws_search/search?format=json`

**Тело запроса:**

```ts
interface SearchRequest {
  VKORG: string;      // обяз.
  KUNNR_RG: string;   // покупатель, обяз.
  PIN: string;        // артикул, обяз.
  BRAND?: string;     // рекомендуется всегда заполнять
  QUERY_TYPE?: '1' | '2'; // 1 — без аналогов, 2 — с аналогами (при пустом BRAND лучше 1)
  PROGRAM?: 'LP' | 'GP';
  KUNNR_ZA?: string;  // адрес доставки / пункт выдачи
  INCOTERMS?: '0' | '1';
  VBELN?: string;     // договор
}
```

**Ответ (RESP):**

```ts
interface SearchResponseItem {
  PIN?: string;
  BRAND?: string;
  NAME?: string;
  ARTID?: string;
  PARNR?: string;
  KEYZAK?: string;    // код склада — передавать в createOrder ITEMS[].KEYZAK
  RVALUE?: string;   // доступное количество
  RETDAYS?: number;
  RDPRF?: string;
  MINBM?: string;
  VENSL?: string;
  PRICE?: string;
  WAERS?: string;
  DLVDT?: string;    // YYYYMMDDHHIISS
  WRNTDT?: string;
  ANALOG?: string;
  TYPEB?: string;    // I | IP | PP (импорт/производитель, РБ)
  DSPEC?: string;
  RCOST?: string;
  MRKBY?: string;
  PNOTE?: string;
  IMP_ADD?: string;
  SELLP?: string;
  REST_ADD?: string;
  REST_ADD_P?: string;
}

interface SearchResponse {
  ARRAY?: SearchResponseItem[];
}
```

**Пример:** перед созданием заказа вызвать search, взять `KEYZAK` из нужной строки и передать в `createOrder` в каждый элемент `ITEMS`, иначе поиск остатков только на основном складе.

---

## 5. Справочник кодов ответа (STATUS)

Используются стандартные HTTP-коды, например:

- 100–226 — информационные и успешные (200 — OK)
- 300–308 — перенаправления
- 400 — Bad Request, 401 — Unauthorized, 403 — Forbidden, 404 — Not Found, 405 — Method Not Allowed, 408 — Request Timeout, 409 — Conflict
- 500 — Internal Server Error, 501–511 — ошибки сервера/шлюза

Проверять успех: `data.STATUS === 200`.

---

## 6. Поля перезаказа и некондиции (v1.1.7)

В ответах getOrder / getOrder2 по позициям (ITEMS) могут быть:

| Поле      | Описание |
|-----------|----------|
| POSEX     | Ссылка на родительскую позицию (перезаказ/некондиция) |
| POSROOT   | Ссылка на корневую позицию |
| CHARG     | Признак некондиции (если не пусто) |
| CHARG_BLK | Блокировка некондиции к отгрузке (true — нужна разблокировка в ЭТП или у менеджера) |

---

## 7. getOrder2: расшифровка статусов (STATUS=1)

При вызове getOrder2 с параметром **STATUS=1** в ответ добавляется массив **STATUSES**. Каждый элемент привязан к позиции заказа (ORDER, POSNR) и содержит:

- **QUAN** — количество для расшифровки  
- **VSTELNAME** — пункт выдачи  
- **Processing** — массив подстатусов (SubStatus: WayQuan, Planned, Waiting, Confirmed, Shipped; поля Werks, WerksName, LsegETP, Quan, Bldat, Cputm, Unit, DateDelNew)  
- **Ready** — массив (DeliveryNum, DeliveryPos, DeliveryTime, DeliveryQuan, WarehouseQuan, DateDelNew)  
- **Delivered** — массив (InvoiceNum, InvoicePos, PrintNum, Waybill, CreateTime, Quan, Unit, Cost, Currency, DeliveryNum)

SubStatus для **Processing**:

- **WayQuan** — товар в пути между складами  
- **Planned** — запланировано к закупке у партнёра  
- **Waiting** — ожидание подтверждения от партнёра  
- **Confirmed** — партнёр подтвердил  
- **Shipped** — партнёр отгрузил в адрес АРМТЕК  

Если Werks/WerksName пусты — субстатус относится к складу партнёра.

---

*Документация собрана из официальных материалов ws.armtek.by (возвращаемый ответ, заказы, поиск, описание getOrder2) и адаптирована для использования в JavaScript/TypeScript.*
