// ─── Shared Chrome 135 profile ──────────────────────────────────────
// UA, Client Hints и Accept-Language обновляются вместе при смене мажорной версии Chrome.

const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';

const chromeBase = {
  'User-Agent': CHROME_UA,
  'Accept-Encoding': 'gzip, deflate, br, zstd',
  'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
  'Sec-CH-UA':
    '"Google Chrome";v="135", "Chromium";v="135", "Not?A_Brand";v="99"',
  'Sec-CH-UA-Mobile': '?0',
  'Sec-CH-UA-Platform': '"Windows"',
};

// ─── ABCP Platform ──────────────────────────────────────────────────

/** ABCP XHR: поиск, добавление в корзину, AJAX-операции. */
export const abcpHeaders = {
  ...chromeBase,
  Accept: 'application/json, text/javascript, */*; q=0.01',
  'X-Requested-With': 'XMLHttpRequest',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
};

/** ABCP навигация / формы: HTML checkout, MAS-формы, загрузка страниц. */
export const abcpNavigationHeaders = {
  ...chromeBase,
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'same-origin',
};

// ─── UG Autocomplete ────────────────────────────────────────────────

/** Заголовки для GET главной UG (первый визит, без referrer). */
export const ugNavigationHeaders = {
  ...chromeBase,
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
};

/** Заголовки для XHR автокомплита UG (same-origin + Referer). */
export const ugXhrHeaders = {
  ...chromeBase,
  Accept: 'application/json, text/javascript, */*; q=0.01',
  Referer: 'https://ugautopart.ru/',
  'X-Requested-With': 'XMLHttpRequest',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
};

// ─── AvtoPartner (Firefox profile) ──────────────────────────────────

export const avtoPartnerUserAgent =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0';
