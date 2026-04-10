export const abcpHeaders = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Accept: 'application/json, text/javascript, */*; q=0.01',
  'Accept-Encoding': 'gzip, deflate, br, zstd',
  'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7,uk;q=0.6,sr;q=0.5',
  'X-Requested-With': 'XMLHttpRequest',
};

export const avtoPartnerUserAgent =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0';

// ─── UG Autocomplete ────────────────────────────────────────────────
// Связный Chrome-профиль: UA, Client Hints и Sec-Fetch-* должны
// обновляться вместе при смене мажорной версии Chrome.

const UG_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';

const ugCommonHeaders = {
  'User-Agent': UG_UA,
  'Accept-Encoding': 'gzip, deflate, br, zstd',
  'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
  'Sec-CH-UA': '"Google Chrome";v="135", "Chromium";v="135", "Not?A_Brand";v="99"',
  'Sec-CH-UA-Mobile': '?0',
  'Sec-CH-UA-Platform': '"Windows"',
};

/** Заголовки для GET главной UG (навигация, как при открытии в браузере). */
export const ugNavigationHeaders = {
  ...ugCommonHeaders,
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
};

/** Заголовки для XHR автокомплита UG (Sec-Fetch-Site: same-origin + Referer). */
export const ugXhrHeaders = {
  ...ugCommonHeaders,
  Accept: 'application/json, text/javascript, */*; q=0.01',
  Referer: 'https://ugautopart.ru/',
  'X-Requested-With': 'XMLHttpRequest',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
};
